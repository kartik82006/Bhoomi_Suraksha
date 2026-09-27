#!/usr/bin/env python3
"""
Bhoomi Suraksha — ML Susceptibility CLI Predictor

Runs inference for a given set of hazard factors and hazard type using the
trained ONNX susceptibility model.

Usage:
    python3 ml/predict.py --hazard-type flood --factors '{"rainfall_intensity": 85, "distance_to_drainage": 95, "elevation": 55, "land_cover": 60, "soil_permeability": 65}'
    python3 ml/predict.py --demo
"""

import sys
import json
import argparse
from pathlib import Path
import numpy as np

# Canonical feature ordering (10 factors + 4 hazard-type one-hot)
GEO_FACTORS = [
    "catchment_area",
    "distance_to_drainage",
    "elevation",
    "land_cover",
    "lithology",
    "rainfall_intensity",
    "shoreline_change_rate",
    "slope",
    "soil_permeability",
    "wave_energy",
]

HAZARD_TYPES = [
    "flood",
    "landslide",
    "cloudburst",
    "coastal_erosion",
]

FEATURE_NAMES = GEO_FACTORS + [f"is_{ht}" for ht in HAZARD_TYPES]


def build_feature_vector(factors: dict, hazard_type: str) -> np.ndarray:
    """Build the 14-element feature vector in canonical order."""
    row = []
    for factor in GEO_FACTORS:
        row.append(float(factors.get(factor, 0.0)))
    for ht in HAZARD_TYPES:
        row.append(1.0 if hazard_type == ht else 0.0)
    return np.array([row], dtype=np.float32)


def predict(onnx_path: Path, factors: dict, hazard_type: str):
    """Run ONNX model inference."""
    try:
        import onnxruntime as ort
    except ImportError:
        print("[predict] Error: onnxruntime not installed. Run: pip install onnxruntime")
        sys.exit(1)

    if not onnx_path.exists():
        print(f"[predict] Error: Model file not found at {onnx_path}")
        print("          Run 'python3 ml/train.py' first to generate the model.")
        sys.exit(1)

    session = ort.InferenceSession(str(onnx_path))
    input_name = session.get_inputs()[0].name
    x = build_feature_vector(factors, hazard_type)

    outputs = session.run(None, {input_name: x})
    # ONNX classifier outputs typically: [labels, probabilities]
    # For skl2onnx/onnxmltools:
    # probabilities is a list of maps or array shape (1, 2)
    prob_pos = 0.5
    if len(outputs) > 1:
        probs = outputs[1]
        if isinstance(probs, list) and len(probs) > 0 and isinstance(probs[0], dict):
            prob_pos = probs[0].get(1, 0.5)
        elif isinstance(probs, np.ndarray):
            if probs.ndim == 2 and probs.shape[1] >= 2:
                prob_pos = float(probs[0, 1])
            elif probs.ndim == 1 and len(probs) >= 2:
                prob_pos = float(probs[1])
            else:
                prob_pos = float(probs.flat[0])
    elif len(outputs) == 1 and isinstance(outputs[0], np.ndarray):
        # Regression or single probability output
        prob_pos = float(outputs[0].flat[0])

    score = round(prob_pos * 100.0, 2)
    return score, prob_pos


def main():
    parser = argparse.ArgumentParser(description="Run ML susceptibility inference.")
    parser.add_argument("--model-path", type=Path, default=None)
    parser.add_argument("--hazard-type", type=str, choices=HAZARD_TYPES, default="flood")
    parser.add_argument("--factors", type=str, default="{}")
    parser.add_argument("--demo", action="store_true", help="Run with demo flood factors")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    model_path = args.model_path or (repo_root / "models" / "susceptibility.onnx")

    if args.demo:
        demo_factors = {
            "rainfall_intensity": 85,
            "distance_to_drainage": 95,
            "elevation": 55,
            "land_cover": 60,
            "soil_permeability": 65,
        }
        print(f"[predict] Running DEMO inference (hazard: flood):")
        print(f"          Factors: {json.dumps(demo_factors)}")
        score, prob = predict(model_path, demo_factors, "flood")
        print(f"\n[Result] ML Susceptibility Score: {score}/100 (Probability: {prob:.4f})")
        return

    try:
        factors = json.loads(args.factors)
    except json.JSONDecodeError as e:
        print(f"[predict] Error: Invalid JSON in --factors: {e}")
        sys.exit(1)

    score, prob = predict(model_path, factors, args.hazard_type)
    result = {
        "hazard_type": args.hazard_type,
        "susceptibility_score": score,
        "probability": round(prob, 4),
        "factors": factors,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
