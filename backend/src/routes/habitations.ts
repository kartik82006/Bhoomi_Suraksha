import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db.js";
import { parseBboxFilter, parsePagination } from "../gis.js";
import { authenticate, requireRole, resolveStateScope } from "../middleware/auth.js";

export const habitationsRouter = Router();

habitationsRouter.use(authenticate, requireRole("admin", "state_official"));

interface HabitationRow {
  id: string;
  name: string;
  stateCode: string;
  districtCode: string;
  population: number;
  hazardScores: unknown;
  exposureScore: number | null;
  tier: string | null;
  priorityScore: number | null;
  suggestedSiteIds: string[] | null;
  geojson: string;
}

/**
 * @openapi
 * /habitations:
 *   get:
 *     summary: Habitations with exposure and tier (admin / state official only)
 *     tags: [Habitations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *       - in: query
 *         name: district
 *         schema: { type: string }
 *       - in: query
 *         name: tier
 *         schema: { type: string, enum: [immediate, short_term, medium_term] }
 *       - in: query
 *         name: bbox
 *         schema: { type: string }
 *     responses:
 *       200: { description: GeoJSON FeatureCollection of habitations }
 *       403: { description: Forbidden for public viewers }
 */
habitationsRouter.get("/", async (req, res) => {
  const { district, tier } = req.query;
  const state = resolveStateScope(req.auth!, req.query.state as string | undefined);
  const { limit, offset } = parsePagination(req.query);
  const bboxFilter = parseBboxFilter(req.query.bbox, "h.geom");

  const conditions: Prisma.Sql[] = [];
  if (state) conditions.push(Prisma.sql`h."stateCode" = ${state}`);
  if (typeof district === "string") conditions.push(Prisma.sql`h."districtCode" = ${district}`);
  if (typeof tier === "string") conditions.push(Prisma.sql`pr.tier = ${tier}::"Tier"`);
  if (bboxFilter) conditions.push(bboxFilter);

  const whereClause = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;

  const rows = await prisma.$queryRaw<HabitationRow[]>`
    SELECT
      h.id, h.name, h."stateCode", h."districtCode", h.population,
      he."hazardScores", he."exposureScore",
      pr.tier, pr."priorityScore", pr."suggestedSiteIds",
      ST_AsGeoJSON(h.geom) AS geojson
    FROM habitations h
    LEFT JOIN habitation_exposure he ON he."habitationId" = h.id
    LEFT JOIN prioritization_results pr ON pr."habitationId" = h.id
    ${whereClause}
    ORDER BY pr."priorityScore" DESC NULLS LAST
    LIMIT ${limit} OFFSET ${offset}
  `;

  res.json({
    type: "FeatureCollection",
    features: rows.map((r) => ({
      type: "Feature",
      id: r.id,
      properties: {
        // MapLibre tiles GeoJSON sources internally, and vector-tile feature ids
        // must be integers — a string id here gets silently replaced with an
        // auto-incrementing index on the event's top-level .id. Carry the real
        // id in properties too so click handlers can read it reliably.
        id: r.id,
        name: r.name,
        state: r.stateCode,
        district: r.districtCode,
        population: r.population,
        hazardScores: r.hazardScores,
        exposureScore: r.exposureScore,
        priorityScore: r.priorityScore,
        tier: r.tier,
        suggestedSiteIds: r.suggestedSiteIds ?? [],
      },
      geometry: JSON.parse(r.geojson),
    })),
  });
});

habitationsRouter.get("/:id", async (req, res) => {
  const rows = await prisma.$queryRaw<HabitationRow[]>`
    SELECT
      h.id, h.name, h."stateCode", h."districtCode", h.population,
      he."hazardScores", he."exposureScore",
      pr.tier, pr."priorityScore", pr."suggestedSiteIds",
      ST_AsGeoJSON(h.geom) AS geojson
    FROM habitations h
    LEFT JOIN habitation_exposure he ON he."habitationId" = h.id
    LEFT JOIN prioritization_results pr ON pr."habitationId" = h.id
    WHERE h.id = ${req.params.id}
  `;
  const habitation = rows[0];
  const allowedState = resolveStateScope(req.auth!, habitation?.stateCode);

  if (!habitation || (req.auth!.role === "state_official" && habitation.stateCode !== allowedState)) {
    return res.status(404).json({ error: "Habitation not found" });
  }

  res.json({
    id: habitation.id,
    name: habitation.name,
    state: habitation.stateCode,
    district: habitation.districtCode,
    population: habitation.population,
    hazardScores: habitation.hazardScores,
    exposureScore: habitation.exposureScore,
    priorityScore: habitation.priorityScore,
    tier: habitation.tier,
    suggestedSiteIds: habitation.suggestedSiteIds ?? [],
    geometry: JSON.parse(habitation.geojson),
  });
});
