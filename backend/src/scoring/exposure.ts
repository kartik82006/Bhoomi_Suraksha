import type { HazardType } from "../types.js";

export interface VulnerabilityInputs {
  kutchaHousingShare: number; // 0-1, share of housing that is kutcha (non-permanent)
  elderlyChildShare: number; // 0-1, share of population elderly or child
  connectivityScore: number; // 0-100, higher = better connected (less vulnerable)
}

const HAZARD_WEIGHT = 0.7;
const VULNERABILITY_WEIGHT = 0.3;

/**
 * Vulnerability sub-score (0-100, higher = more vulnerable) from housing
 * quality, demographic composition, and connectivity (README Phase 3).
 */
export function computeVulnerabilityScore(inputs: VulnerabilityInputs): number {
  const housingRisk = inputs.kutchaHousingShare * 100;
  const demographicRisk = inputs.elderlyChildShare * 100;
  const connectivityRisk = 100 - inputs.connectivityScore;
  return Math.round((housingRisk * 0.4 + demographicRisk * 0.35 + connectivityRisk * 0.25) * 100) / 100;
}

/**
 * Combines per-hazard severity scores (zonal max/mean within the habitation's
 * buffer, per README Phase 3) with the vulnerability sub-score into a single
 * 0-100 exposure score.
 */
export function computeExposureScore(
  hazardScores: Record<HazardType, number>,
  vulnerabilityScore: number,
): number {
  const values = Object.values(hazardScores);
  const maxHazard = Math.max(...values);
  const meanHazard = values.reduce((a, b) => a + b, 0) / values.length;
  const hazardComponent = maxHazard * 0.6 + meanHazard * 0.4;

  const exposure = hazardComponent * HAZARD_WEIGHT + vulnerabilityScore * VULNERABILITY_WEIGHT;
  return Math.round(exposure * 100) / 100;
}
