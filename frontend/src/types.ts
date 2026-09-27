export type HazardType = "landslide" | "flood" | "coastal_erosion" | "cloudburst";
export type Tier = "immediate" | "short_term" | "medium_term";
export type Role = "admin" | "state_official" | "public_viewer";

export interface Session {
  accessToken: string;
  refreshToken: string;
  role: Role;
  stateCode: string | null;
  email: string;
}

export interface PrioritizationItem {
  habitationId: string;
  name: string;
  state: string;
  district: string;
  population: number;
  tier: Tier;
  priorityScore: number;
  componentScores: {
    exposureScore: number;
    disasterHistoryScore: number;
    hazardScores: Record<HazardType, number>;
  };
  breakdown: {
    hazard_severity: number;
    population_exposure: number;
    disaster_history: number;
    vulnerability_modifier: number;
  };
  weights: { alpha: number; beta: number; gamma: number; delta: number };
  suggestedSites: {
    id: string;
    name: string;
    suitabilityScore: number;
    capacityPersons: number;
  }[];
}

export interface Summary {
  level: string;
  state?: string;
  district?: string;
  districtCount?: number;
  habitationCount: number;
  totalPopulationExposed: number;
  tierCounts: Record<string, number>;
  hazardZoneCount: number;
  hazardTypesPresent: HazardType[];
}
