import type { HazardType } from "../types.js";

export interface RawZone {
  id: string;
  hazardType: HazardType;
  stateCode: string;
  districtCode: string;
  geometry: GeoJSON.Polygon;
  factors: Record<string, number>;
}

export interface RawHabitation {
  id: string;
  name: string;
  stateCode: string;
  districtCode: string;
  population: number;
  kutchaHousingShare: number;
  elderlyChildShare: number;
  connectivityScore: number;
  geometry: GeoJSON.Point;
}

export interface RawSite {
  id: string;
  name: string;
  stateCode: string;
  districtCode: string;
  subScores: {
    slope: number;
    landUse: number;
    waterAccess: number;
    infrastructureDistance: number;
    ownHazardExposure: number;
  };
  geometry: GeoJSON.Polygon;
}

export interface RawDisasterEvent {
  id: string;
  habitationId: string;
  hazardType: HazardType;
  eventDate: string;
  severity: number;
  source: string;
}
