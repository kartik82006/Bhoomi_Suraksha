import fs from "node:fs";
import { parse } from "yaml";
import type { HazardType } from "../types.js";

export interface AhpConfig {
  [hazardType: string]: { factors: Record<string, number> };
}

const WEIGHT_SUM_TOLERANCE = 0.01;

export function loadAhpWeights(filePath: string): AhpConfig {
  const raw = fs.readFileSync(filePath, "utf-8");
  const config = parse(raw) as AhpConfig;

  for (const [hazardType, { factors }] of Object.entries(config)) {
    const sum = Object.values(factors).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
      throw new Error(`AHP weights for "${hazardType}" sum to ${sum}, expected 1.0`);
    }
  }

  return config;
}

/**
 * Core AHP weighted-overlay: each factor score must already be normalized to
 * 0-100 by the ingestion pipeline. Returns a 0-100 hazard severity score.
 */
export function computeHazardSeverity(
  hazardType: HazardType,
  factorScores: Record<string, number>,
  config: AhpConfig,
): number {
  const hazardConfig = config[hazardType];
  if (!hazardConfig) {
    throw new Error(`No AHP weights configured for hazard type "${hazardType}"`);
  }

  let severity = 0;
  for (const [factor, weight] of Object.entries(hazardConfig.factors)) {
    const score = factorScores[factor];
    if (score === undefined) {
      throw new Error(`Missing factor "${factor}" required by AHP config for "${hazardType}"`);
    }
    if (score < 0 || score > 100) {
      throw new Error(`Factor "${factor}" score ${score} is outside the expected 0-100 range`);
    }
    severity += score * weight;
  }

  return Math.round(severity * 100) / 100;
}

/**
 * Blend machine learning susceptibility score with deterministic AHP score.
 * Formula: mlScore * mlWeight + ahpScore * (1 - mlWeight)
 * Result is rounded to 2 decimal places and bounded to [0, 100].
 */
export function computeBlendedSeverity(
  ahpScore: number,
  mlScore: number,
  mlWeight = 0.6,
): number {
  const boundedWeight = Math.max(0, Math.min(1, mlWeight));
  const blended = mlScore * boundedWeight + ahpScore * (1 - boundedWeight);
  return Math.max(0, Math.min(100, Math.round(blended * 100) / 100));
}

