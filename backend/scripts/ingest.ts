import path from "node:path";
import { fileURLToPath } from "node:url";
import { ingestSource } from "../src/ingest/run.js";
import type { RawHabitation, RawSite, RawZone } from "../src/ingest/types.js";

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = path.join(BACKEND_ROOT, "fixtures/raw");
const PROCESSED_DIR = process.env.PROCESSED_DATA_PATH
  ? path.resolve(BACKEND_ROOT, "..", process.env.PROCESSED_DATA_PATH)
  : path.resolve(BACKEND_ROOT, "../data/processed");
const MANIFEST_PATH = path.join(PROCESSED_DIR, "manifest.json");

const { skipped: zonesSkipped } = ingestSource<{ zones: RawZone[] }>({
  source: "hazard_factors",
  rawFilePath: path.join(RAW_DIR, "factors/demo_district_zones.json"),
  processedFilePath: path.join(PROCESSED_DIR, "hazard_factors.json"),
  manifestPath: MANIFEST_PATH,
  extractGeometries: (d) => d.zones.map((z) => z.geometry),
});
console.log(`[ingest] hazard_factors: ${zonesSkipped ? "up to date" : "ingested"}`);

const { skipped: habitationsSkipped } = ingestSource<{ habitations: RawHabitation[] }>({
  source: "habitations",
  rawFilePath: path.join(RAW_DIR, "habitations/demo_district_habitations.json"),
  processedFilePath: path.join(PROCESSED_DIR, "habitations.json"),
  manifestPath: MANIFEST_PATH,
  extractGeometries: (d) => d.habitations.map((h) => h.geometry),
});
console.log(`[ingest] habitations: ${habitationsSkipped ? "up to date" : "ingested"}`);

const { skipped: sitesSkipped } = ingestSource<{ sites: RawSite[] }>({
  source: "relocation_sites",
  rawFilePath: path.join(RAW_DIR, "sites/demo_district_sites.json"),
  processedFilePath: path.join(PROCESSED_DIR, "relocation_sites.json"),
  manifestPath: MANIFEST_PATH,
  extractGeometries: (d) => d.sites.map((s) => s.geometry),
});
console.log(`[ingest] relocation_sites: ${sitesSkipped ? "up to date" : "ingested"}`);

const { skipped: eventsSkipped } = ingestSource({
  source: "disaster_events",
  rawFilePath: path.join(RAW_DIR, "disaster_events/demo_district_events.json"),
  processedFilePath: path.join(PROCESSED_DIR, "disaster_events.json"),
  manifestPath: MANIFEST_PATH,
  extractGeometries: () => [],
});
console.log(`[ingest] disaster_events: ${eventsSkipped ? "up to date" : "ingested"}`);

console.log(`[ingest] manifest written to ${MANIFEST_PATH}`);
