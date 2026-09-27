import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/db.js";
import { loadAhpWeights, computeHazardSeverity, computeBlendedSeverity } from "../src/scoring/ahp.js";
import { predictSusceptibility } from "../src/scoring/mlSusceptibility.js";
import type { RawZone } from "../src/ingest/types.js";

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROCESSED_DIR = process.env.PROCESSED_DATA_PATH
  ? path.resolve(BACKEND_ROOT, "..", process.env.PROCESSED_DATA_PATH)
  : path.resolve(BACKEND_ROOT, "../data/processed");
const AHP_WEIGHTS_FILE = process.env.AHP_WEIGHTS_FILE
  ? path.resolve(BACKEND_ROOT, "..", process.env.AHP_WEIGHTS_FILE)
  : path.resolve(BACKEND_ROOT, "../config/ahp_weights.yaml");

const enableMl = process.env.ENABLE_ML_SUSCEPTIBILITY === "true";
const mlWeight = parseFloat(process.env.ML_BLEND_WEIGHT || "0.6");

async function main() {
  const zonesFile = path.join(PROCESSED_DIR, "hazard_factors.json");
  if (!fs.existsSync(zonesFile)) {
    throw new Error(`${zonesFile} not found — run "npm run ingest" first`);
  }

  const { zones } = JSON.parse(fs.readFileSync(zonesFile, "utf-8")) as { zones: RawZone[] };
  const ahpConfig = loadAhpWeights(AHP_WEIGHTS_FILE);

  console.log(
    `[score] Scoring ${zones.length} hazard zones. ML layer: ${
      enableMl ? `ENABLED (weight=${mlWeight})` : "DISABLED (AHP only)"
    }`
  );

  for (const zone of zones) {
    const ahpScore = computeHazardSeverity(zone.hazardType, zone.factors, ahpConfig);
    let severityScore = ahpScore;
    let scoreSource = "AHP only";

    if (enableMl) {
      const mlScore = await predictSusceptibility(zone.factors, zone.hazardType);
      if (mlScore !== null) {
        severityScore = computeBlendedSeverity(ahpScore, mlScore, mlWeight);
        scoreSource = `AHP+ML blend (AHP: ${ahpScore}, ML: ${mlScore})`;
      } else {
        scoreSource = `AHP fallback (ML unavailable)`;
      }
    }

    await prisma.$executeRaw`
      INSERT INTO hazard_zones (id, "hazardType", "severityScore", "stateCode", "districtCode", geom)
      VALUES (
        ${zone.id},
        ${zone.hazardType}::"HazardType",
        ${severityScore},
        ${zone.stateCode},
        ${zone.districtCode},
        ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(zone.geometry)}), 4326)
      )
      ON CONFLICT (id) DO UPDATE SET
        "severityScore" = EXCLUDED."severityScore",
        "stateCode" = EXCLUDED."stateCode",
        "districtCode" = EXCLUDED."districtCode",
        geom = EXCLUDED.geom
    `;

    console.log(`[score] ${zone.id} (${zone.hazardType}): severity ${severityScore} [${scoreSource}]`);
  }
}


main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
