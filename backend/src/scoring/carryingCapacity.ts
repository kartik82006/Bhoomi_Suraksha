export interface CarryingCapacitySubScores {
  slope: number; // 0-100, higher = gentler/more buildable
  landUse: number; // 0-100, higher = more suitable land cover
  waterAccess: number; // 0-100, higher = closer to perennial water
  infrastructureDistance: number; // 0-100, higher = closer to roads/health/schools/power
  ownHazardExposure: number; // 0-100, higher = safer (outside Red Zones)
}

const SUITABILITY_WEIGHTS: Record<keyof CarryingCapacitySubScores, number> = {
  slope: 0.25,
  landUse: 0.2,
  waterAccess: 0.15,
  infrastructureDistance: 0.15,
  ownHazardExposure: 0.25,
};

export function computeSuitabilityScore(subScores: CarryingCapacitySubScores): number {
  let score = 0;
  for (const key of Object.keys(SUITABILITY_WEIGHTS) as (keyof CarryingCapacitySubScores)[]) {
    score += subScores[key] * SUITABILITY_WEIGHTS[key];
  }
  return Math.round(score * 100) / 100;
}

/**
 * Capacity estimate from real polygon area (README Phase 4: "available area
 * vs. required area"). `areaHectares` should come from PostGIS
 * ST_Area(geography) on the site polygon, not an assumed constant.
 * `buildableFraction` accounts for the share of the site that is actually
 * buildable after roads/setbacks/terrain (a placeholder until land-use
 * fraction is derived from real raster data in Phase 1/4).
 */
export function computeCapacityPersons(
  areaHectares: number,
  targetDensityPersonsPerHectare: number,
  buildableFraction = 0.6,
): number {
  return Math.round(areaHectares * buildableFraction * targetDensityPersonsPerHectare);
}
