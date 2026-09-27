import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db.js";
import { parseBboxFilter, parsePagination } from "../gis.js";

export const hazardsRouter = Router();

interface HazardRow {
  id: string;
  hazardType: string;
  severityScore: number;
  stateCode: string;
  districtCode: string;
  geojson: string;
}

/**
 * @openapi
 * /hazards:
 *   get:
 *     summary: Hazard-zone polygons (Red Zones)
 *     tags: [Hazards]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [landslide, flood, coastal_erosion, cloudburst] }
 *       - in: query
 *         name: bbox
 *         schema: { type: string }
 *         description: "minLon,minLat,maxLon,maxLat"
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: offset
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: GeoJSON FeatureCollection of hazard zones (public — no auth required)
 */
hazardsRouter.get("/", async (req, res) => {
  const { type } = req.query;
  const { limit, offset } = parsePagination(req.query);
  const bboxFilter = parseBboxFilter(req.query.bbox, "geom");

  const conditions: Prisma.Sql[] = [];
  if (typeof type === "string") conditions.push(Prisma.sql`"hazardType" = ${type}::"HazardType"`);
  if (bboxFilter) conditions.push(bboxFilter);

  const whereClause = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;

  const rows = await prisma.$queryRaw<HazardRow[]>`
    SELECT id, "hazardType", "severityScore", "stateCode", "districtCode", ST_AsGeoJSON(geom) AS geojson
    FROM hazard_zones
    ${whereClause}
    ORDER BY "severityScore" DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  res.json({
    type: "FeatureCollection",
    features: rows.map((r) => ({
      type: "Feature",
      id: r.id,
      properties: {
        hazardType: r.hazardType,
        severityScore: r.severityScore,
        state: r.stateCode,
        district: r.districtCode,
      },
      geometry: JSON.parse(r.geojson),
    })),
  });
});
