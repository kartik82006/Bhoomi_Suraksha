import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db.js";
import { parsePagination } from "../gis.js";
import { authenticate, requireRole, resolveStateScope } from "../middleware/auth.js";
import { computeHazardSeverity, loadAhpWeights } from "../scoring/ahp.js";
import { computeExposureScore, computeVulnerabilityScore } from "../scoring/exposure.js";
import { computeDisasterHistoryScore, computePriorityScore, deriveTier, PRIORITY_WEIGHTS } from "../scoring/prioritization.js";
import type { HazardType, Tier } from "../types.js";

const VALID_TIERS: Tier[] = ["immediate", "short_term", "medium_term"];
const HAZARD_TYPES: HazardType[] = ["landslide", "flood", "coastal_erosion", "cloudburst"];

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROCESSED_DIR = process.env.PROCESSED_DATA_PATH
  ? path.resolve(BACKEND_ROOT, process.env.PROCESSED_DATA_PATH)
  : path.resolve(BACKEND_ROOT, "data/processed");
const AHP_WEIGHTS_FILE = process.env.AHP_WEIGHTS_FILE
  ? path.resolve(BACKEND_ROOT, process.env.AHP_WEIGHTS_FILE)
  : path.resolve(BACKEND_ROOT, "config/ahp_weights.yaml");

interface ZoneFactors {
  hazardType: HazardType;
  factors: Record<string, number>;
}

/** Zone factors from the ingested processed file, keyed by zone id. */
function loadZoneFactors(): Map<string, ZoneFactors> {
  const file = path.join(PROCESSED_DIR, "hazard_factors.json");
  const { zones } = JSON.parse(fs.readFileSync(file, "utf-8")) as {
    zones: { id: string; hazardType: HazardType; factors: Record<string, number> }[];
  };
  return new Map(zones.map((z) => [z.id, { hazardType: z.hazardType, factors: z.factors }]));
}

export const prioritizationRouter = Router();

prioritizationRouter.use(authenticate, requireRole("admin", "state_official"));

interface PrioritizationRow {
  habitationId: string;
  name: string;
  stateCode: string;
  districtCode: string;
  population: number;
  tier: Tier;
  priorityScore: number;
  componentScores: {
    hazardScores: Record<HazardType, number>;
    exposureScore: number;
    disasterHistoryScore: number;
  };
  suggestedSiteIds: string[];
}

interface ExposureRow {
  habitationId: string;
  vulnerabilityScore: number;
}

/**
 * @openapi
 * /prioritization:
 *   get:
 *     summary: Ranked relocation priorities
 *     tags: [Prioritization]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *       - in: query
 *         name: tier
 *         schema: { type: string, enum: [immediate, short_term, medium_term] }
 *     responses:
 *       200: { description: Ranked list of habitations with component scores and suggested sites }
 */
prioritizationRouter.get("/", async (req, res) => {
  const { tier } = req.query;
  const state = resolveStateScope(req.auth!, req.query.state as string | undefined);
  const { limit, offset } = parsePagination(req.query);

  const conditions: Prisma.Sql[] = [];
  if (state) conditions.push(Prisma.sql`h."stateCode" = ${state}`);
  if (typeof tier === "string") conditions.push(Prisma.sql`pr.tier = ${tier}::"Tier"`);
  const whereClause = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;

  const rows = await prisma.$queryRaw<PrioritizationRow[]>`
    SELECT
      pr."habitationId", h.name, h."stateCode", h."districtCode", h.population,
      pr.tier, pr."priorityScore", pr."componentScores", pr."suggestedSiteIds"
    FROM prioritization_results pr
    JOIN habitations h ON h.id = pr."habitationId"
    ${whereClause}
    ORDER BY CASE pr.tier WHEN 'immediate' THEN 0 WHEN 'short_term' THEN 1 ELSE 2 END, pr."priorityScore" DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const habitationIds = rows.map((r) => r.habitationId);
  const exposureRows = habitationIds.length
    ? await prisma.$queryRaw<ExposureRow[]>`
        SELECT "habitationId", "vulnerabilityScore" FROM habitation_exposure WHERE "habitationId" IN (${Prisma.join(habitationIds)})
      `
    : [];
  const vulnerabilityById = new Map(exposureRows.map((e) => [e.habitationId, e.vulnerabilityScore]));

  const siteIds = [...new Set(rows.flatMap((r) => r.suggestedSiteIds))];
  const sites = siteIds.length
    ? await prisma.$queryRaw<{ id: string; name: string; suitabilityScore: number; capacityPersons: number }[]>`
        SELECT id, name, "suitabilityScore", "capacityPersons" FROM relocation_sites WHERE id IN (${Prisma.join(siteIds)})
      `
    : [];
  const siteById = new Map(sites.map((s) => [s.id, s]));

  const weights = { alpha: PRIORITY_WEIGHTS.hazardSeverity, beta: PRIORITY_WEIGHTS.exposure, gamma: PRIORITY_WEIGHTS.disasterHistory, delta: 0 };
  res.json(rows.map((r) => {
    const hazardSeverity = Math.max(...Object.values(r.componentScores.hazardScores));
    return {
      habitationId: r.habitationId,
      name: r.name,
      state: r.stateCode,
      district: r.districtCode,
      population: r.population,
      tier: r.tier,
      priorityScore: r.priorityScore,
      componentScores: r.componentScores,
      breakdown: {
        hazard_severity: hazardSeverity,
        population_exposure: r.componentScores.exposureScore,
        disaster_history: r.componentScores.disasterHistoryScore,
        vulnerability_modifier: vulnerabilityById.get(r.habitationId) ?? 0,
      },
      weights,
      suggestedSites: r.suggestedSiteIds.map((id) => siteById.get(id)).filter(Boolean),
    };
  }));
});

/**
 * @openapi
 * /prioritization/simulate:
 *   get:
 *     summary: What-if — recompute tiers with a rainfall-intensity multiplier (no DB writes)
 *     tags: [Prioritization]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: rainfall
 *         schema: { type: number, default: 1 }
 *         description: Multiplier applied to every zone's rainfall_intensity factor (0-3).
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *     responses:
 *       200: { description: Re-ranked habitations under the simulated rainfall (transient) }
 */
prioritizationRouter.get("/simulate", async (req, res) => {
  const rainfallMultiplier = Math.max(0, Math.min(3, Number(req.query.rainfall ?? 1)));
  const state = resolveStateScope(req.auth!, req.query.state as string | undefined);

  const ahp = loadAhpWeights(AHP_WEIGHTS_FILE);
  const zoneFactors = loadZoneFactors();

  const whereState = state ? Prisma.sql`WHERE h."stateCode" = ${state}` : Prisma.empty;
  const habitations = await prisma.$queryRaw<
    {
      id: string;
      name: string;
      stateCode: string;
      districtCode: string;
      population: number;
      kutchaHousingShare: number;
      elderlyChildShare: number;
      connectivityScore: number;
      zone_ids: string[];
    }[]
  >`
    SELECT h.id, h.name, h."stateCode", h."districtCode", h.population,
      h."kutchaHousingShare", h."elderlyChildShare", h."connectivityScore",
      array_remove(array_agg(hz.id), NULL) AS zone_ids
    FROM habitations h
    LEFT JOIN hazard_zones hz ON ST_DWithin(hz.geom::geography, h.geom::geography, 2000)
    ${whereState}
    GROUP BY h.id
  `;

  const events = await prisma.$queryRaw<{ habitationId: string; severity: number; eventDate: Date }[]>`
    SELECT "habitationId", severity, "eventDate" FROM disaster_events
  `;
  const eventsByHab = new Map<string, { severity: number; yearsAgo: number }[]>();
  const now = Date.now();
  for (const e of events) {
    const arr = eventsByHab.get(e.habitationId) ?? [];
    arr.push({ severity: e.severity, yearsAgo: (now - new Date(e.eventDate).getTime()) / (365.25 * 24 * 3600 * 1000) });
    eventsByHab.set(e.habitationId, arr);
  }

  const results = habitations.map((h) => {
    const hazardScores = Object.fromEntries(HAZARD_TYPES.map((t) => [t, 0])) as Record<HazardType, number>;
    for (const zoneId of h.zone_ids) {
      const z = zoneFactors.get(zoneId);
      if (!z) continue;
      const factors = { ...z.factors };
      if ("rainfall_intensity" in factors) {
        factors.rainfall_intensity = Math.max(0, Math.min(100, factors.rainfall_intensity * rainfallMultiplier));
      }
      const severity = computeHazardSeverity(z.hazardType, factors, ahp);
      if (severity > hazardScores[z.hazardType]) hazardScores[z.hazardType] = severity;
    }

    const vulnerabilityScore = computeVulnerabilityScore(h);
    const exposureScore = computeExposureScore(hazardScores, vulnerabilityScore);
    const disasterHistoryScore = computeDisasterHistoryScore(eventsByHab.get(h.id) ?? []);
    const hazardSeverity = Math.max(...Object.values(hazardScores));
    const priorityScore = computePriorityScore(hazardSeverity, exposureScore, disasterHistoryScore);
    const tier = deriveTier(priorityScore);

    return {
      habitationId: h.id,
      name: h.name,
      state: h.stateCode,
      district: h.districtCode,
      population: h.population,
      tier,
      priorityScore,
      componentScores: { hazardScores, exposureScore, disasterHistoryScore },
      breakdown: {
        hazard_severity: hazardSeverity,
        population_exposure: exposureScore,
        disaster_history: disasterHistoryScore,
        vulnerability_modifier: vulnerabilityScore,
      },
      weights: { alpha: PRIORITY_WEIGHTS.hazardSeverity, beta: PRIORITY_WEIGHTS.exposure, gamma: PRIORITY_WEIGHTS.disasterHistory, delta: 0 },
    };
  });

  const tierRank: Record<Tier, number> = { immediate: 0, short_term: 1, medium_term: 2 };
  results.sort((a, b) => tierRank[a.tier] - tierRank[b.tier] || b.priorityScore - a.priorityScore);

  res.json({ rainfallMultiplier, results });
});

/**
 * @openapi
 * /prioritization/{id}/review:
 *   post:
 *     summary: Record a review action on a habitation's prioritization (audited)
 *     tags: [Prioritization]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [justification]
 *             properties:
 *               tier: { type: string, enum: [immediate, short_term, medium_term] }
 *               justification: { type: string }
 *     responses:
 *       200: { description: Updated tier and the audit log entry it created }
 *       400: { description: Missing justification or invalid tier }
 *       404: { description: Habitation not found or outside the caller's state scope }
 */
prioritizationRouter.post("/:id/review", async (req, res) => {
  const [habitation] = await prisma.$queryRaw<{ id: string; stateCode: string }[]>`
    SELECT id, "stateCode" FROM habitations WHERE id = ${req.params.id}
  `;
  const allowedState = resolveStateScope(req.auth!, habitation?.stateCode);
  if (!habitation || (req.auth!.role === "state_official" && habitation.stateCode !== allowedState)) {
    return res.status(404).json({ error: "Habitation not found" });
  }

  const { tier, justification } = req.body ?? {};
  if (typeof justification !== "string" || justification.trim().length === 0) {
    return res.status(400).json({ error: "justification is required for any prioritization action" });
  }
  if (tier !== undefined && !VALID_TIERS.includes(tier)) {
    return res.status(400).json({ error: `tier must be one of ${VALID_TIERS.join(", ")}` });
  }

  const [current] = await prisma.$queryRaw<{ tier: Tier }[]>`
    SELECT tier FROM prioritization_results WHERE "habitationId" = ${habitation.id}
  `;
  const previousTier = current?.tier;
  const newTier: Tier | undefined = tier ?? previousTier;

  if (tier) {
    await prisma.$executeRaw`
      UPDATE prioritization_results SET tier = ${tier}::"Tier" WHERE "habitationId" = ${habitation.id}
    `;
  }

  const auditEntry = await prisma.auditLog.create({
    data: {
      actorEmail: req.auth!.email,
      action: tier ? "tier_adjusted" : "reviewed",
      habitationId: habitation.id,
      previousTier,
      newTier,
      justification,
    },
  });

  res.json({ habitationId: habitation.id, tier: newTier, auditEntry });
});
