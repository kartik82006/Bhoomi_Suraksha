import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { HazardType } from "../types.js";

const require = createRequire(import.meta.url);
const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REPO_ROOT = path.resolve(BACKEND_ROOT, "..");

// Canonical feature names and ordering matching ml/train.py
const DEFAULT_GEO_FACTORS = [
  "catchment_area",
  "distance_to_drainage",
  "elevation",
  "land_cover",
  "lithology",
  "rainfall_intensity",
  "shoreline_change_rate",
  "slope",
  "soil_permeability",
  "wave_energy",
];

const HAZARD_TYPES: HazardType[] = [
  "flood",
  "landslide",
  "cloudburst",
  "coastal_erosion",
];

export interface ModelMetadata {
  version: string;
  trained_at: string | null;
  winning_model: string | null;
  features: string[];
  num_features: number;
  hazard_types: string[];
  onnx_file: string;
}

let sessionInstance: any = null;
let sessionFailed = false;
let modelMetadata: ModelMetadata | null = null;
let ortModule: any = null;

/**
 * Load model metadata from models/model_meta.json.
 */
export function getModelMetadata(): ModelMetadata | null {
  if (modelMetadata) return modelMetadata;

  const metaPath = path.resolve(REPO_ROOT, "models", "model_meta.json");
  if (!fs.existsSync(metaPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(metaPath, "utf-8");
    modelMetadata = JSON.parse(raw) as ModelMetadata;
    return modelMetadata;
  } catch (err) {
    console.warn(`[ml] Failed to parse ${metaPath}:`, err);
    return null;
  }
}

/**
 * Lazily initialize ONNX Runtime session.
 * Returns the InferenceSession or null if unavailable.
 */
async function getInferenceSession(): Promise<any> {
  if (sessionInstance) return sessionInstance;
  if (sessionFailed) return null;

  const modelRelativePath = process.env.ML_MODEL_PATH || "./models/susceptibility.onnx";
  const modelPath = path.isAbsolute(modelRelativePath)
    ? modelRelativePath
    : path.resolve(REPO_ROOT, modelRelativePath);

  if (!fs.existsSync(modelPath)) {
    console.warn(
      `[ml] Model file not found at ${modelPath}.\n` +
      `     Run "npm run ml:train" (or python3 ml/train.py) to train and export the model.\n` +
      `     Falling back to deterministic AHP scoring.`
    );
    sessionFailed = true;
    return null;
  }

  try {
    if (!ortModule) {
      // Load onnxruntime-node dynamically
      ortModule = require("onnxruntime-node");
    }
    sessionInstance = await ortModule.InferenceSession.create(modelPath);
    console.log(`[ml] Loaded ONNX susceptibility model from ${modelPath}`);
    return sessionInstance;
  } catch (err: any) {
    console.warn(
      `[ml] Could not load ONNX model via onnxruntime-node: ${err?.message || err}.\n` +
      `     Falling back to deterministic AHP scoring.`
    );
    sessionFailed = true;
    return null;
  }
}

/**
 * Builds the 14-element feature vector in exact order expected by the model.
 */
export function buildFeatureVector(
  factors: Record<string, number>,
  hazardType: HazardType,
  featureOrder?: string[],
): Float32Array {
  const meta = getModelMetadata();
  const features = featureOrder || meta?.features || [
    ...DEFAULT_GEO_FACTORS,
    ...HAZARD_TYPES.map((ht) => `is_${ht}`),
  ];

  const vector = new Float32Array(features.length);

  for (let i = 0; i < features.length; i++) {
    const featName = features[i];
    if (featName.startsWith("is_")) {
      const ht = featName.slice(3) as HazardType;
      vector[i] = hazardType === ht ? 1.0 : 0.0;
    } else {
      vector[i] = typeof factors[featName] === "number" ? factors[featName] : 0.0;
    }
  }

  return vector;
}

/**
 * Predict hazard susceptibility score (0-100) for a zone.
 * Returns null if model is disabled, missing, or fails to execute.
 */
export async function predictSusceptibility(
  factors: Record<string, number>,
  hazardType: HazardType,
): Promise<number | null> {
  const session = await getInferenceSession();
  if (!session || !ortModule) {
    return null;
  }

  try {
    const inputVector = buildFeatureVector(factors, hazardType);
    const inputName = session.inputNames[0] || "float_input";
    const tensor = new ortModule.Tensor("float32", inputVector, [1, inputVector.length]);

    const feeds: Record<string, any> = {};
    feeds[inputName] = tensor;

    const results = await session.run(feeds);

    // Parse ONNX output:
    // Typically outputs contain probabilities as a map, tensor, or second output
    let probPositive = 0.5;

    // Check for "probabilities" or inspect outputs
    const probOutputKey = session.outputNames.find(
      (name: string) => name.toLowerCase().includes("prob") || name.toLowerCase().includes("probability")
    ) || session.outputNames[1] || session.outputNames[0];

    const outputTensor = results[probOutputKey];

    if (outputTensor && outputTensor.data) {
      const data = outputTensor.data;
      if (data.length >= 2) {
        // [prob_0, prob_1]
        probPositive = Number(data[1]);
      } else if (data.length === 1) {
        probPositive = Number(data[0]);
      }
    }

    // Convert probability (0.0 to 1.0) to susceptibility score (0 to 100)
    const score = Math.max(0, Math.min(100, Math.round(probPositive * 10000) / 100));
    return score;
  } catch (err: any) {
    console.warn(`[ml] Inference error for ${hazardType}:`, err?.message || err);
    return null;
  }
}
