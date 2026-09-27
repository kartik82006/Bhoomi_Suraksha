export type HazardType = "landslide" | "flood" | "coastal_erosion" | "cloudburst";

export type Tier = "immediate" | "short_term" | "medium_term";

export interface HazardZone {
  id: string;
  hazardType: HazardType;
  severityScore: number;
  state: string;
  district: string;
  geometry: GeoJSON.Polygon;
}

export interface Habitation {
  id: string;
  name: string;
  state: string;
  district: string;
  population: number;
  hazardScores: Record<HazardType, number>;
  exposureScore: number;
  disasterHistoryScore: number;
  priorityScore: number;
  tier: Tier;
  suggestedSiteIds: string[];
  geometry: GeoJSON.Point;
}

export interface RelocationSite {
  id: string;
  name: string;
  state: string;
  district: string;
  suitabilityScore: number;
  capacityPersons: number;
  subScores: {
    slope: number;
    landUse: number;
    waterAccess: number;
    infrastructureDistance: number;
    ownHazardExposure: number;
  };
  geometry: GeoJSON.Polygon;
}
