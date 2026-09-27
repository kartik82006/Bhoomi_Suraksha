import { Prisma } from "@prisma/client";

/** Parses `bbox=minLon,minLat,maxLon,maxLat` into an ST_MakeEnvelope SQL fragment, or null if absent/invalid. */
export function parseBboxFilter(bbox: unknown, geomColumn: string): Prisma.Sql | null {
  if (typeof bbox !== "string") return null;
  const parts = bbox.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
  const [minLon, minLat, maxLon, maxLat] = parts;

  return Prisma.sql`ST_Intersects(${Prisma.raw(geomColumn)}, ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326))`;
}

export interface PaginationParams {
  limit: number;
  offset: number;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export function parsePagination(query: { limit?: unknown; offset?: unknown }): PaginationParams {
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));
  const offset = Math.max(0, Number(query.offset) || 0);
  return { limit, offset };
}
