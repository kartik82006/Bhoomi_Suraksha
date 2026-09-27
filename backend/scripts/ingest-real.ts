import path from "node:path";
import { fileURLToPath } from "node:url";
import { ingestSource } from "../src/ingest/run.js";
import type { RawDisasterEvent, RawHabitation, RawSite, RawZone } from "../src/ingest/types.js";

// Real Uttarakhand ingestion: consumes the credentialed-source-derived fixtures
// (CWC flood-forecast network + Census 2011), built by scripts/build_real_data.py,
// and writes the SAME canonical processed files the score/prioritize steps read —
// so the rest of the pipeline runs unchanged. The synthetic `npm run ingest` path
// (Demo District) is left intact as a fallback.

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = path.join(BACKEND_ROOT, "fixtures/raw/uttarakhand");
const PROCESSED_DIR = process.env.PROCESSED_DATA_PATH
  ? path.resolve(BACKEND_ROOT, "..", process.env.PROCESSED_DATA_PATH)
  : path.resolve(BACKEND_ROOT, "../data/processed");
const MANIFEST_PATH = path.join(PROCESSED_DIR, "manifest.json");

const { skipped: zonesSkipped } = ingestSource<{ zones: RawZone[] }>({
  source: "cwc_flood_and_hazard_zones",
  rawFilePath: path.join(RAW_DIR, "factors/uttarakhand_zones.json"),
  processedFilePath: path.join(PROCESSED_DIR, "hazard_factors.json"),
  manifestPath: MANIFEST_PATH,
  extractGeometries: (d) => d.zones.map((z) => z.geometry),
});
console.log(`[ingest:real] hazard zones (CWC flood + Atlas hotspots): ${zonesSkipped ? "up to date" : "ingested"}`);

const { skipped: habitationsSkipped } = ingestSource<{ habitations: RawHabitation[] }>({
  source: "census2011_habitations",
  rawFilePath: path.join(RAW_DIR, "habitations/uttarakhand_habitations.json"),
  processedFilePath: path.join(PROCESSED_DIR, "habitations.json"),
  manifestPath: MANIFEST_PATH,
  extractGeometries: (d) => d.habitations.map((h) => h.geometry),
});
console.log(`[ingest:real] habitations (Census 2011 population/vulnerability): ${habitationsSkipped ? "up to date" : "ingested"}`);

const { skipped: sitesSkipped } = ingestSource<{ sites: RawSite[] }>({
  source: "relocation_sites",
  rawFilePath: path.join(RAW_DIR, "sites/uttarakhand_sites.json"),
  processedFilePath: path.join(PROCESSED_DIR, "relocation_sites.json"),
  manifestPath: MANIFEST_PATH,
  extractGeometries: (d) => d.sites.map((s) => s.geometry),
});
console.log(`[ingest:real] relocation sites: ${sitesSkipped ? "up to date" : "ingested"}`);

const { skipped: eventsSkipped } = ingestSource<{ events: RawDisasterEvent[] }>({
  source: "disaster_events",
  rawFilePath: path.join(RAW_DIR, "disaster_events/uttarakhand_events.json"),
  processedFilePath: path.join(PROCESSED_DIR, "disaster_events.json"),
  manifestPath: MANIFEST_PATH,
  extractGeometries: () => [],
});
console.log(`[ingest:real] disaster events (2013 Kedarnath, 2021 Chamoli, 2023 Joshimath): ${eventsSkipped ? "up to date" : "ingested"}`);

console.log(`[ingest:real] manifest written to ${MANIFEST_PATH}`);
