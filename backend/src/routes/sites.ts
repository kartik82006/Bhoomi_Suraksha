import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db.js";
import { parseBboxFilter, parsePagination } from "../gis.js";

export const sitesRouter = Router();

interface SiteRow {
  id: string;
  name: string;
  stateCode: string;
  districtCode: string;
  suitabilityScore: number;
  capacityPersons: number;
  subScores: unknown;
  geojson: string;
}

/**
 * @openapi
 * /sites:
 *   get:
 *     summary: Candidate relocation sites with suitability scoring
 *     tags: [Sites]
 *     parameters:
 *       - in: query
 *         name: minScore
 *         schema: { type: number }
 *       - in: query
 *         name: near
 *         schema: { type: string }
 *         description: "lon,lat — sorts by distance and adds distanceKm"
 *       - in: query
 *         name: bbox
 *         schema: { type: string }
 *     responses:
 *       200: { description: GeoJSON FeatureCollection of relocation sites }
 */
sitesRouter.get("/", async (req, res) => {
  const minScore = req.query.minScore ? Number(req.query.minScore) : 0;
  const { limit, offset } = parsePagination(req.query);
  const bboxFilter = parseBboxFilter(req.query.bbox, "geom");

  const conditions: Prisma.Sql[] = [Prisma.sql`"suitabilityScore" >= ${minScore}`];
  if (bboxFilter) conditions.push(bboxFilter);
  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;

  const near = typeof req.query.near === "string" ? req.query.near.split(",").map(Number) : null;
  const validNear = near && near.length === 2 && near.every((n) => !Number.isNaN(n)) ? near : null;

  const orderClause = validNear
    ? Prisma.sql`ORDER BY geom <-> ST_SetSRID(ST_MakePoint(${validNear[0]}, ${validNear[1]}), 4326)`
    : Prisma.sql`ORDER BY "suitabilityScore" DESC`;

  const distanceSelect = validNear
    ? Prisma.sql`, ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(${validNear[0]}, ${validNear[1]}), 4326)::geography) / 1000 AS distance_km`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<(SiteRow & { distance_km?: number })[]>`
    SELECT id, name, "stateCode", "districtCode", "suitabilityScore", "capacityPersons", "subScores",
      ST_AsGeoJSON(geom) AS geojson ${distanceSelect}
    FROM relocation_sites
    ${whereClause}
    ${orderClause}
    LIMIT ${limit} OFFSET ${offset}
  `;

  res.json({
    type: "FeatureCollection",
    features: rows.map((r) => ({
      type: "Feature",
      id: r.id,
      properties: {
        id: r.id, // see habitations.ts comment: MapLibre coerces string .id to an integer internally
        name: r.name,
        state: r.stateCode,
        district: r.districtCode,
        suitabilityScore: r.suitabilityScore,
        capacityPersons: r.capacityPersons,
        subScores: r.subScores,
        ...(r.distance_km !== undefined ? { distanceKm: Math.round(r.distance_km * 100) / 100 } : {}),
      },
      geometry: JSON.parse(r.geojson),
    })),
  });
});
