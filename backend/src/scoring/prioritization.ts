import type { Tier } from "../types.js";

export interface DisasterEventInput {
  severity: number; // 0-100
  yearsAgo: number; // fractional years since the event
}

const RECENCY_DECAY_YEARS = 8; // half-life-ish constant: an event this many years old counts ~37%

/**
 * Disaster history score (0-100): more recent and more severe events weigh
 * more (README Phase 5: "weighted by recency and severity"). Exponential
 * decay so a severe event from decades ago doesn't dominate a habitation
 * with no recent history.
 */
export function computeDisasterHistoryScore(events: DisasterEventInput[]): number {
  if (events.length === 0) return 0;

  const weighted = events.reduce((sum, e) => sum + e.severity * Math.exp(-e.yearsAgo / RECENCY_DECAY_YEARS), 0);
  // Normalize against a single maximally-severe, maximally-recent event so the
  // score stays in 0-100 regardless of how many historical events exist.
  return Math.min(100, Math.round(weighted * 100) / 100);
}

export const PRIORITY_WEIGHTS = { hazardSeverity: 0.35, exposure: 0.4, disasterHistory: 0.25 };

export function computePriorityScore(hazardSeverity: number, exposureScore: number, disasterHistoryScore: number): number {
  const score =
    hazardSeverity * PRIORITY_WEIGHTS.hazardSeverity +
    exposureScore * PRIORITY_WEIGHTS.exposure +
    disasterHistoryScore * PRIORITY_WEIGHTS.disasterHistory;
  return Math.round(score * 100) / 100;
}

export function deriveTier(priorityScore: number): Tier {
  if (priorityScore >= 75) return "immediate";
  if (priorityScore >= 50) return "short_term";
  return "medium_term";
}

export interface SiteCandidate {
  id: string;
  suitabilityScore: number;
  distanceKm: number;
}

const MAX_SUGGESTION_DISTANCE_KM = 15;
const MAX_SUGGESTIONS = 2;

/**
 * Best-matching relocation sites for a habitation: within a reasonable
 * distance, ranked by suitability (README Phase 5: "attach the best-matching
 * relocation site(s)").
 */
export function suggestSites(candidates: SiteCandidate[]): string[] {
  return candidates
    .filter((c) => c.distanceKm <= MAX_SUGGESTION_DISTANCE_KM)
    .sort((a, b) => b.suitabilityScore - a.suitabilityScore)
    .slice(0, MAX_SUGGESTIONS)
    .map((c) => c.id);
}
