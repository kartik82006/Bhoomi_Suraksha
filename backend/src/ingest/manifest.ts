import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface ManifestEntry {
  source: string;
  fetchedAt: string;
  spatialExtent: [number, number, number, number] | null;
  crs: string;
  sha256: string;
}

type Manifest = Record<string, ManifestEntry>;

export function readManifest(manifestPath: string): Manifest {
  if (!fs.existsSync(manifestPath)) return {};
  return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
}

export function writeManifestEntry(manifestPath: string, entry: ManifestEntry): void {
  const manifest = readManifest(manifestPath);
  manifest[entry.source] = entry;
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

export function hashFile(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function isUpToDate(manifestPath: string, source: string, rawFilePath: string): boolean {
  const entry = readManifest(manifestPath)[source];
  return entry !== undefined && entry.sha256 === hashFile(rawFilePath);
}
