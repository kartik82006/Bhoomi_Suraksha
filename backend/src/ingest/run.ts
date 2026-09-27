import fs from "node:fs";
import path from "node:path";
import { computeBbox } from "./bbox.js";
import { hashFile, isUpToDate, writeManifestEntry } from "./manifest.js";

export interface IngestSourceDef<T> {
  source: string;
  rawFilePath: string;
  processedFilePath: string;
  manifestPath: string;
  extractGeometries: (data: T) => GeoJSON.Geometry[];
}

/** Idempotent: skips re-processing if the raw file's hash matches the last recorded manifest entry. */
export function ingestSource<T>(def: IngestSourceDef<T>): { skipped: boolean } {
  if (isUpToDate(def.manifestPath, def.source, def.rawFilePath)) {
    return { skipped: true };
  }

  const raw = JSON.parse(fs.readFileSync(def.rawFilePath, "utf-8")) as T;
  fs.mkdirSync(path.dirname(def.processedFilePath), { recursive: true });
  fs.writeFileSync(def.processedFilePath, JSON.stringify(raw, null, 2));

  writeManifestEntry(def.manifestPath, {
    source: def.source,
    fetchedAt: new Date().toISOString(),
    spatialExtent: computeBbox(def.extractGeometries(raw)),
    crs: "EPSG:4326",
    sha256: hashFile(def.rawFilePath),
  });

  return { skipped: false };
}
