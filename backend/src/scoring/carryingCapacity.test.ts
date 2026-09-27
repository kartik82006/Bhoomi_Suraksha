import { describe, expect, it } from "vitest";
import { computeCapacityPersons, computeSuitabilityScore } from "./carryingCapacity.js";

describe("computeSuitabilityScore", () => {
  it("hand-computed weighted sum of sub-scores", () => {
    // 85*.25 + 80*.2 + 75*.15 + 70*.15 + 95*.25 = 82.75
    const score = computeSuitabilityScore({
      slope: 85,
      landUse: 80,
      waterAccess: 75,
      infrastructureDistance: 70,
      ownHazardExposure: 95,
    });
    expect(score).toBe(82.75);
  });
});

describe("computeCapacityPersons", () => {
  it("hand-computed from real polygon area", () => {
    // 10 ha * 0.6 buildable * 250 persons/ha = 1500
    expect(computeCapacityPersons(10, 250)).toBe(1500);
  });

  it("respects a custom buildable fraction", () => {
    // 10 ha * 0.3 * 250 = 750
    expect(computeCapacityPersons(10, 250, 0.3)).toBe(750);
  });

  it("returns 0 capacity for a zero-area site", () => {
    expect(computeCapacityPersons(0, 250)).toBe(0);
  });
});
