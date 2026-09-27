export interface RelocationSiteFactor {
  key: string;
  label: string;
  value: number;
  maxValue: number;
}

export interface RelocationSite {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: "Suitable" | "Conditional — needs investment" | "Not suitable";
  suitabilityScore: number;
  factors: RelocationSiteFactor[];
  matchedHabitationIds: string[];
}

export const RELOCATION_SITES: RelocationSite[] = [
  {
    id: "rs-1",
    name: "Pipalkoti Bench",
    latitude: 30.4206,
    longitude: 79.4174,
    status: "Suitable",
    suitabilityScore: 87,
    factors: [
      { key: "water", label: "Water Availability", value: 85, maxValue: 100 },
      { key: "land", label: "Land Availability", value: 90, maxValue: 100 },
      { key: "road", label: "Road / Access", value: 80, maxValue: 100 },
      { key: "distance", label: "Distance from Hazard Zone", value: 88, maxValue: 100 },
      { key: "capacity", label: "Carrying Capacity (persons)", value: 5000, maxValue: 10000 },
    ],
    matchedHabitationIds: ["uk-hab-01", "uk-hab-02"],
  },
  {
    id: "rs-2",
    name: "Dhak Relocation Site",
    latitude: 30.53,
    longitude: 79.513,
    status: "Conditional — needs investment",
    suitabilityScore: 72,
    factors: [
      { key: "water", label: "Water Availability", value: 65, maxValue: 100 },
      { key: "land", label: "Land Availability", value: 75, maxValue: 100 },
      { key: "road", label: "Road / Access", value: 70, maxValue: 100 },
      { key: "distance", label: "Distance from Hazard Zone", value: 80, maxValue: 100 },
      { key: "capacity", label: "Carrying Capacity (persons)", value: 3000, maxValue: 10000 },
    ],
    matchedHabitationIds: ["uk-hab-03"],
  },
  {
    id: "rs-3",
    name: "Gauchar Plateau",
    latitude: 30.27,
    longitude: 79.153,
    status: "Suitable",
    suitabilityScore: 91,
    factors: [
      { key: "water", label: "Water Availability", value: 88, maxValue: 100 },
      { key: "land", label: "Land Availability", value: 92, maxValue: 100 },
      { key: "road", label: "Road / Access", value: 85, maxValue: 100 },
      { key: "distance", label: "Distance from Hazard Zone", value: 95, maxValue: 100 },
      { key: "capacity", label: "Carrying Capacity (persons)", value: 8000, maxValue: 10000 },
    ],
    matchedHabitationIds: ["uk-hab-04", "uk-hab-06"],
  },
  {
    id: "rs-4",
    name: "Bagapatia Resettlement Colony",
    latitude: 20.56,
    longitude: 86.833,
    status: "Suitable",
    suitabilityScore: 84,
    factors: [
      { key: "water", label: "Water Availability", value: 78, maxValue: 100 },
      { key: "land", label: "Land Availability", value: 85, maxValue: 100 },
      { key: "road", label: "Road / Access", value: 80, maxValue: 100 },
      { key: "distance", label: "Distance from Hazard Zone", value: 90, maxValue: 100 },
      { key: "capacity", label: "Carrying Capacity (persons)", value: 12000, maxValue: 10000 },
    ],
    matchedHabitationIds: ["od-hab-01", "od-hab-02"],
  },
  {
    id: "rs-5",
    name: "Paradip Safe Zone",
    latitude: 20.26,
    longitude: 86.61,
    status: "Conditional — needs investment",
    suitabilityScore: 68,
    factors: [
      { key: "water", label: "Water Availability", value: 60, maxValue: 100 },
      { key: "land", label: "Land Availability", value: 70, maxValue: 100 },
      { key: "road", label: "Road / Access", value: 75, maxValue: 100 },
      { key: "distance", label: "Distance from Hazard Zone", value: 70, maxValue: 100 },
      { key: "capacity", label: "Carrying Capacity (persons)", value: 4000, maxValue: 10000 },
    ],
    matchedHabitationIds: ["od-hab-03"],
  },
  {
    id: "rs-6",
    name: "Puri Inland Relocation",
    latitude: 19.805,
    longitude: 85.83,
    status: "Not suitable",
    suitabilityScore: 45,
    factors: [
      { key: "water", label: "Water Availability", value: 40, maxValue: 100 },
      { key: "land", label: "Land Availability", value: 50, maxValue: 100 },
      { key: "road", label: "Road / Access", value: 60, maxValue: 100 },
      { key: "distance", label: "Distance from Hazard Zone", value: 55, maxValue: 100 },
      { key: "capacity", label: "Carrying Capacity (persons)", value: 2000, maxValue: 10000 },
    ],
    matchedHabitationIds: ["od-hab-04"],
  },
];

export function getRelocationSiteById(id: string): RelocationSite | undefined {
  return RELOCATION_SITES.find((s) => s.id === id);
}

export function getSitesForHabitation(habitationId: string): RelocationSite[] {
  return RELOCATION_SITES.filter((s) => s.matchedHabitationIds.includes(habitationId));
}

export function getHabitationSiteLinks(): { from: string; to: string; fromCoords: [number, number]; toCoords: [number, number] }[] {
  const links: { from: string; to: string; fromCoords: [number, number]; toCoords: [number, number] }[] = [];
  
  const habitationCoords: Record<string, [number, number]> = {
    "uk-hab-01": [79.5533, 30.5669],
    "uk-hab-02": [78.7867, 30.2289],
    "uk-hab-03": [78.9792, 30.2886],
    "uk-hab-04": [78.5969, 30.1406],
    "uk-hab-05": [78.4469, 30.7292],
    "uk-hab-06": [79.2144, 30.265],
    "uk-hab-07": [79.3091, 30.3311],
    "uk-hab-08": [79.0281, 30.6544],
    "od-hab-01": [86.935, 20.655],
    "od-hab-02": [86.775, 20.725],
    "od-hab-03": [86.61, 20.26],
    "od-hab-04": [85.83, 19.805],
  };

  for (const site of RELOCATION_SITES) {
    for (const habId of site.matchedHabitationIds) {
      if (habitationCoords[habId]) {
        links.push({
          from: habId,
          to: site.id,
          fromCoords: habitationCoords[habId],
          toCoords: [site.longitude, site.latitude],
        });
      }
    }
  }

  return links;
}
