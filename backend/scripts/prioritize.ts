import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/db.js";
import type { RawDisasterEvent, RawHabitation, RawSite } from "../src/ingest/types.js";
import { computeCapacityPersons, computeSuitabilityScore } from "../src/scoring/carryingCapacity.js";
import { computeExposureScore, computeVulnerabilityScore } from "../src/scoring/exposure.js";
import { computeDisasterHistoryScore, computePriorityScore, deriveTier, suggestSites } from "../src/scoring/prioritization.js";
import type { HazardType } from "../src/types.js";

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROCESSED_DIR = process.env.PROCESSED_DATA_PATH
  ? path.resolve(BACKEND_ROOT, "..", process.env.PROCESSED_DATA_PATH)
  : path.resolve(BACKEND_ROOT, "../data/processed");

const HAZARD_TYPES: HazardType[] = ["landslide", "flood", "coastal_erosion", "cloudburst"];
const EXPOSURE_BUFFER_METERS = 2000;
const SITE_SEARCH_RADIUS_METERS = 15000;
const TARGET_DENSITY_PERSONS_PER_HECTARE = Number(process.env.ANALYSIS_TARGET_DENSITY ?? 250);

function readProcessed<T>(file: string): T {
  const filePath = path.join(PROCESSED_DIR, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`${filePath} not found — run "npm run ingest" first`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

async function upsertHabitations(habitations: RawHabitation[]) {
  for (const h of habitations) {
    await prisma.$executeRaw`
      INSERT INTO habitations (id, name, "stateCode", "districtCode", population, "kutchaHousingShare", "elderlyChildShare", "connectivityScore", geom)
      VALUES (
        ${h.id}, ${h.name}, ${h.stateCode}, ${h.districtCode}, ${h.population},
        ${h.kutchaHousingShare}, ${h.elderlyChildShare}, ${h.connectivityScore},
        ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(h.geometry)}), 4326)
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, "stateCode" = EXCLUDED."stateCode", "districtCode" = EXCLUDED."districtCode",
        population = EXCLUDED.population, "kutchaHousingShare" = EXCLUDED."kutchaHousingShare",
        "elderlyChildShare" = EXCLUDED."elderlyChildShare", "connectivityScore" = EXCLUDED."connectivityScore",
        geom = EXCLUDED.geom
    `;
  }
  console.log(`[prioritize] upserted ${habitations.length} habitations`);
}

async function upsertSitesAndComputeCapacity(sites: RawSite[]) {
  for (const s of sites) {
    await prisma.$executeRaw`
      INSERT INTO relocation_sites (id, name, "stateCode", "districtCode", "suitabilityScore", "capacityPersons", "subScores", geom)
      VALUES (
        ${s.id}, ${s.name}, ${s.stateCode}, ${s.districtCode}, 0, 0, ${JSON.stringify(s.subScores)}::jsonb,
        ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(s.geometry)}), 4326)
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, "stateCode" = EXCLUDED."stateCode", "districtCode" = EXCLUDED."districtCode",
        "subScores" = EXCLUDED."subScores", geom = EXCLUDED.geom
    `;

    const [{ area_ha }] = await prisma.$queryRaw<{ area_ha: number }[]>`
      SELECT ST_Area(geom::geography) / 10000 AS area_ha FROM relocation_sites WHERE id = ${s.id}
    `;

    const suitabilityScore = computeSuitabilityScore(s.subScores);
    const capacityPersons = computeCapacityPersons(area_ha, TARGET_DENSITY_PERSONS_PER_HECTARE);

    await prisma.$executeRaw`
      UPDATE relocation_sites SET "suitabilityScore" = ${suitabilityScore}, "capacityPersons" = ${capacityPersons}
      WHERE id = ${s.id}
    `;

    console.log(`[prioritize] site ${s.id}: ${area_ha.toFixed(2)} ha -> suitability ${suitabilityScore}, capacity ${capacityPersons}`);
  }
}

async function upsertDisasterEvents(events: RawDisasterEvent[]) {
  for (const e of events) {
    await prisma.$executeRaw`
      INSERT INTO disaster_events (id, "habitationId", "hazardType", "eventDate", severity, source)
      VALUES (${e.id}, ${e.habitationId}, ${e.hazardType}::"HazardType", ${new Date(e.eventDate)}, ${e.severity}, ${e.source})
      ON CONFLICT (id) DO UPDATE SET severity = EXCLUDED.severity, "eventDate" = EXCLUDED."eventDate"
    `;
  }
  console.log(`[prioritize] upserted ${events.length} disaster events`);
}

async function computeHazardScoresForHabitation(habitationId: string): Promise<Record<HazardType, number>> {
  const rows = await prisma.$queryRaw<{ hazard_type: HazardType; max_severity: number }[]>`
    SELECT hz."hazardType" AS hazard_type, MAX(hz."severityScore") AS max_severity
    FROM hazard_zones hz, habitations h
    WHERE h.id = ${habitationId} AND ST_DWithin(hz.geom::geography, h.geom::geography, ${EXPOSURE_BUFFER_METERS})
    GROUP BY hz."hazardType"
  `;

  const scores = Object.fromEntries(HAZARD_TYPES.map((t) => [t, 0])) as Record<HazardType, number>;
  for (const row of rows) scores[row.hazard_type] = Number(row.max_severity);
  return scores;
}

async function main() {
  const { habitations } = readProcessed<{ habitations: RawHabitation[] }>("habitations.json");
  const { sites } = readProcessed<{ sites: RawSite[] }>("relocation_sites.json");
  const { events } = readProcessed<{ events: RawDisasterEvent[] }>("disaster_events.json");

  await upsertHabitations(habitations);
  await upsertSitesAndComputeCapacity(sites);
  await upsertDisasterEvents(events);

  for (const h of habitations) {
    const hazardScores = await computeHazardScoresForHabitation(h.id);
    const vulnerabilityScore = computeVulnerabilityScore(h);
    const exposureScore = computeExposureScore(hazardScores, vulnerabilityScore);

    await prisma.$executeRaw`
      INSERT INTO habitation_exposure ("habitationId", "hazardScores", "vulnerabilityScore", "exposureScore")
      VALUES (${h.id}, ${JSON.stringify(hazardScores)}::jsonb, ${vulnerabilityScore}, ${exposureScore})
      ON CONFLICT ("habitationId") DO UPDATE SET
        "hazardScores" = EXCLUDED."hazardScores", "vulnerabilityScore" = EXCLUDED."vulnerabilityScore",
        "exposureScore" = EXCLUDED."exposureScore", "computedAt" = now()
    `;

    const habitationEvents = events.filter((e) => e.habitationId === h.id);
    const now = Date.now();
    const disasterHistoryScore = computeDisasterHistoryScore(
      habitationEvents.map((e) => ({
        severity: e.severity,
        yearsAgo: (now - new Date(e.eventDate).getTime()) / (365.25 * 24 * 3600 * 1000),
      })),
    );

    const hazardSeverity = Math.max(...Object.values(hazardScores));
    const priorityScore = computePriorityScore(hazardSeverity, exposureScore, disasterHistoryScore);
    const tier = deriveTier(priorityScore);

    const nearbySites = await prisma.$queryRaw<{ id: string; suitability_score: number; distance_km: number }[]>`
      SELECT rs.id, rs."suitabilityScore" AS suitability_score, ST_Distance(rs.geom::geography, h.geom::geography) / 1000 AS distance_km
      FROM relocation_sites rs, habitations h
      WHERE h.id = ${h.id} AND ST_DWithin(rs.geom::geography, h.geom::geography, ${SITE_SEARCH_RADIUS_METERS})
    `;
    const suggestedSiteIds = suggestSites(
      nearbySites.map((s) => ({ id: s.id, suitabilityScore: Number(s.suitability_score), distanceKm: Number(s.distance_km) })),
    );

    await prisma.$executeRaw`
      INSERT INTO prioritization_results ("habitationId", tier, "priorityScore", "componentScores", "suggestedSiteIds")
      VALUES (${h.id}, ${tier}::"Tier", ${priorityScore}, ${JSON.stringify({ hazardScores, exposureScore, disasterHistoryScore })}::jsonb, ${suggestedSiteIds})
      ON CONFLICT ("habitationId") DO UPDATE SET
        tier = EXCLUDED.tier, "priorityScore" = EXCLUDED."priorityScore",
        "componentScores" = EXCLUDED."componentScores", "suggestedSiteIds" = EXCLUDED."suggestedSiteIds",
        "computedAt" = now()
    `;

    console.log(`[prioritize] ${h.name}: priority ${priorityScore} -> ${tier}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
