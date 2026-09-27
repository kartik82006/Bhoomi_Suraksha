import { Router } from "express";
import { prisma } from "../db.js";

export const summaryRouter = Router();

/**
 * @openapi
 * /summary:
 *   get:
 *     summary: Aggregated district/state statistics (public — no habitation-level data)
 *     tags: [Summary]
 *     parameters:
 *       - in: query
 *         name: level
 *         schema: { type: string, enum: [state, district], default: district }
 *     responses:
 *       200: { description: Aggregated counts and tier breakdown }
 */
summaryRouter.get("/", async (req, res) => {
  const { level = "district" } = req.query;

  // Aggregate across all habitations in scope. Grouping by district and taking one
  // row (the previous behaviour) under-counts when the dataset spans multiple
  // districts, so counts are computed state-wide and districts are counted, not sliced.
  const [{ state_count, state, district_count, habitation_count, total_population }] = await prisma.$queryRaw<
    {
      state_count: bigint;
      state: string | null;
      district_count: bigint;
      habitation_count: bigint;
      total_population: bigint | null;
    }[]
  >`SELECT
      COUNT(DISTINCT "stateCode") AS state_count,
      MIN("stateCode") AS state,
      COUNT(DISTINCT "districtCode") AS district_count,
      COUNT(*) AS habitation_count,
      SUM(population) AS total_population
    FROM habitations`;

  const tierRows = await prisma.$queryRaw<{ tier: string; count: bigint }[]>`
    SELECT tier, COUNT(*) AS count FROM prioritization_results GROUP BY tier
  `;

  const hazardRows = await prisma.$queryRaw<{ hazard_type: string; count: bigint }[]>`
    SELECT "hazardType" AS hazard_type, COUNT(*) AS count FROM hazard_zones GROUP BY "hazardType"
  `;

  res.json({
    level,
    state: Number(state_count) > 1 ? "Multiple states" : state,
    districtCount: Number(district_count ?? 0),
    habitationCount: Number(habitation_count ?? 0),
    totalPopulationExposed: Number(total_population ?? 0),
    tierCounts: Object.fromEntries(tierRows.map((r) => [r.tier, Number(r.count)])),
    hazardZoneCount: hazardRows.reduce((sum, r) => sum + Number(r.count), 0),
    hazardTypesPresent: hazardRows.map((r) => r.hazard_type),
  });
});
