import { describe, expect, it } from "vitest";
import { computeDisasterHistoryScore, computePriorityScore, deriveTier, suggestSites } from "./prioritization.js";

describe("computeDisasterHistoryScore", () => {
  it("returns 0 with no history", () => {
    expect(computeDisasterHistoryScore([])).toBe(0);
  });

  it("weighs recent events more than old ones of the same severity", () => {
    const recent = computeDisasterHistoryScore([{ severity: 50, yearsAgo: 1 }]);
    const old = computeDisasterHistoryScore([{ severity: 50, yearsAgo: 20 }]);
    expect(recent).toBeGreaterThan(old);
  });

  it("hand-computed: severity 80 two years ago + severity 50 ten years ago", () => {
    // 80*e^(-2/8) + 50*e^(-10/8) ≈ 62.30 + 14.33 ≈ 76.63
    const score = computeDisasterHistoryScore([
      { severity: 80, yearsAgo: 2 },
      { severity: 50, yearsAgo: 10 },
    ]);
    expect(score).toBeCloseTo(76.63, 1);
  });

  it("caps at 100 even with many severe recent events", () => {
    const events = Array.from({ length: 10 }, () => ({ severity: 100, yearsAgo: 0 }));
    expect(computeDisasterHistoryScore(events)).toBe(100);
  });
});

describe("computePriorityScore", () => {
  it("hand-computed weighted combination", () => {
    // 66*.35 + 61.8*.4 + 76.63*.25 = 23.1 + 24.72 + 19.1575 = 66.9775
    const score = computePriorityScore(66, 61.8, 76.63);
    expect(score).toBeCloseTo(66.98, 1);
  });
});

describe("deriveTier", () => {
  it("applies the documented threshold rules", () => {
    expect(deriveTier(75)).toBe("immediate");
    expect(deriveTier(90)).toBe("immediate");
    expect(deriveTier(74.9)).toBe("short_term");
    expect(deriveTier(50)).toBe("short_term");
    expect(deriveTier(49.9)).toBe("medium_term");
    expect(deriveTier(0)).toBe("medium_term");
  });
});

describe("suggestSites", () => {
  it("excludes sites beyond the max distance and ranks the rest by suitability", () => {
    const result = suggestSites([
      { id: "a", suitabilityScore: 82.75, distanceKm: 5 },
      { id: "b", suitabilityScore: 64, distanceKm: 20 },
      { id: "c", suitabilityScore: 70, distanceKm: 10 },
    ]);
    expect(result).toEqual(["a", "c"]);
  });

  it("returns at most 2 suggestions", () => {
    const result = suggestSites([
      { id: "a", suitabilityScore: 90, distanceKm: 1 },
      { id: "b", suitabilityScore: 80, distanceKm: 1 },
      { id: "c", suitabilityScore: 70, distanceKm: 1 },
    ]);
    expect(result).toHaveLength(2);
    expect(result).toEqual(["a", "b"]);
  });

  it("returns an empty list when nothing is within range", () => {
    expect(suggestSites([{ id: "a", suitabilityScore: 90, distanceKm: 50 }])).toEqual([]);
  });
});
