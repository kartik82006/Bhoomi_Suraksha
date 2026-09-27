import { describe, expect, it } from "vitest";
import { computeExposureScore, computeVulnerabilityScore } from "./exposure.js";

describe("computeVulnerabilityScore", () => {
  it("hand-computed: 0.5 kutcha, 0.4 elderly/child, 70 connectivity", () => {
    // housingRisk=50*.4=20, demographicRisk=40*.35=14, connectivityRisk=30*.25=7.5 -> 41.5
    const score = computeVulnerabilityScore({
      kutchaHousingShare: 0.5,
      elderlyChildShare: 0.4,
      connectivityScore: 70,
    });
    expect(score).toBe(41.5);
  });

  it("is 0 for a fully non-kutcha, non-elderly/child, fully-connected habitation", () => {
    const score = computeVulnerabilityScore({
      kutchaHousingShare: 0,
      elderlyChildShare: 0,
      connectivityScore: 100,
    });
    expect(score).toBe(0);
  });
});

describe("computeExposureScore", () => {
  it("hand-computed from hazard scores + vulnerability", () => {
    // max=90, mean=41.25, hazardComponent=90*.6+41.25*.4=70.5
    // exposure = 70.5*.7 + 41.5*.3 = 61.8
    const score = computeExposureScore(
      { landslide: 90, flood: 20, coastal_erosion: 0, cloudburst: 55 },
      41.5,
    );
    expect(score).toBe(61.8);
  });
});
