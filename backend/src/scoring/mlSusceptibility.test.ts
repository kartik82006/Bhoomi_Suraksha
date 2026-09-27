import { describe, expect, it } from "vitest";
import {
  getModelMetadata,
  buildFeatureVector,
  predictSusceptibility,
} from "./mlSusceptibility.js";

describe("mlSusceptibility", () => {
  describe("getModelMetadata", () => {
    it("loads model metadata with 14 features", () => {
      const meta = getModelMetadata();
      expect(meta).not.toBeNull();
      expect(meta?.num_features).toBe(14);
      expect(meta?.features).toHaveLength(14);
      expect(meta?.features).toContain("catchment_area");
      expect(meta?.features).toContain("is_flood");
      expect(meta?.features).toContain("is_landslide");
    });
  });

  describe("buildFeatureVector", () => {
    it("constructs a 14-element Float32Array with correct one-hot encoding", () => {
      const factors = {
        rainfall_intensity: 85,
        distance_to_drainage: 95,
        elevation: 55,
      };

      const vec = buildFeatureVector(factors, "flood");
      expect(vec).toBeInstanceOf(Float32Array);
      expect(vec.length).toBe(14);

      const meta = getModelMetadata();
      const features = meta?.features || [];

      // Check specific factor indices
      const rainIdx = features.indexOf("rainfall_intensity");
      const drainageIdx = features.indexOf("distance_to_drainage");
      const floodIdx = features.indexOf("is_flood");
      const landslideIdx = features.indexOf("is_landslide");
      const missingSlopeIdx = features.indexOf("slope");

      expect(vec[rainIdx]).toBe(85);
      expect(vec[drainageIdx]).toBe(95);
      expect(vec[floodIdx]).toBe(1.0);
      expect(vec[landslideIdx]).toBe(0.0);
      expect(vec[missingSlopeIdx]).toBe(0.0); // missing factor zero-filled
    });

    it("correctly encodes landslide hazard type", () => {
      const vec = buildFeatureVector({ slope: 75 }, "landslide");
      const meta = getModelMetadata();
      const features = meta?.features || [];

      const floodIdx = features.indexOf("is_flood");
      const landslideIdx = features.indexOf("is_landslide");
      const slopeIdx = features.indexOf("slope");

      expect(vec[floodIdx]).toBe(0.0);
      expect(vec[landslideIdx]).toBe(1.0);
      expect(vec[slopeIdx]).toBe(75);
    });
  });

  describe("predictSusceptibility", () => {
    it("gracefully returns null if ONNX model is not present", async () => {
      // Points to non-existent model path
      process.env.ML_MODEL_PATH = "./models/non_existent_test_model.onnx";
      const score = await predictSusceptibility({ slope: 80 }, "landslide");
      expect(score).toBeNull();
    });
  });
});
