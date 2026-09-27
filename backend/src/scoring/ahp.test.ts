import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeHazardSeverity, loadAhpWeights, computeBlendedSeverity, type AhpConfig } from "./ahp.js";

const landslideConfig: AhpConfig = {
  landslide: {
    factors: {
      slope: 0.35,
      rainfall_intensity: 0.25,
      lithology: 0.2,
      distance_to_drainage: 0.1,
      land_cover: 0.1,
    },
  },
};

describe("computeHazardSeverity", () => {
  it("computes the weighted sum of normalized factor scores", () => {
    // Hand-computed: 80*.35 + 60*.25 + 70*.20 + 50*.10 + 40*.10 = 66
    const severity = computeHazardSeverity(
      "landslide",
      { slope: 80, rainfall_intensity: 60, lithology: 70, distance_to_drainage: 50, land_cover: 40 },
      landslideConfig,
    );
    expect(severity).toBe(66);
  });

  it("throws if a required factor is missing", () => {
    expect(() =>
      computeHazardSeverity("landslide", { slope: 80 }, landslideConfig),
    ).toThrow(/Missing factor/);
  });

  it("throws if a factor score is outside 0-100", () => {
    expect(() =>
      computeHazardSeverity(
        "landslide",
        { slope: 150, rainfall_intensity: 60, lithology: 70, distance_to_drainage: 50, land_cover: 40 },
        landslideConfig,
      ),
    ).toThrow(/outside the expected 0-100 range/);
  });

  it("throws if no weights are configured for the hazard type", () => {
    expect(() => computeHazardSeverity("flood", {}, landslideConfig)).toThrow(/No AHP weights configured/);
  });
});

describe("loadAhpWeights", () => {
  it("parses a valid YAML config", () => {
    const file = path.join(os.tmpdir(), `ahp-valid-${Date.now()}.yaml`);
    fs.writeFileSync(file, "landslide:\n  factors:\n    slope: 0.6\n    rainfall_intensity: 0.4\n");
    const config = loadAhpWeights(file);
    expect(config.landslide.factors.slope).toBe(0.6);
    fs.unlinkSync(file);
  });

  it("rejects a config whose weights don't sum to 1.0", () => {
    const file = path.join(os.tmpdir(), `ahp-invalid-${Date.now()}.yaml`);
    fs.writeFileSync(file, "landslide:\n  factors:\n    slope: 0.6\n    rainfall_intensity: 0.6\n");
    expect(() => loadAhpWeights(file)).toThrow(/sum to/);
    fs.unlinkSync(file);
  });
});

describe("computeBlendedSeverity", () => {
  it("computes weighted blend with default 0.6 ML weight", () => {
    // 0.6 * 80 + 0.4 * 60 = 48 + 24 = 72
    expect(computeBlendedSeverity(60, 80)).toBe(72);
  });

  it("computes weighted blend with custom weight", () => {
    // 0.8 * 90 + 0.2 * 50 = 72 + 10 = 82
    expect(computeBlendedSeverity(50, 90, 0.8)).toBe(82);
  });

  it("clamps blended score to [0, 100]", () => {
    expect(computeBlendedSeverity(100, 100)).toBe(100);
    expect(computeBlendedSeverity(0, 0)).toBe(0);
  });
});

