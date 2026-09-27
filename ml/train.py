#!/usr/bin/env python3
"""
Bhoomi Suraksha — Machine Learning Susceptibility Calibration Engine

Trains, evaluates, compares, and selects between Random Forest and XGBoost classifiers
on real Uttarakhand hazard zones using Stratified 5-Fold Cross-Validation.
The winning model is retrained on all samples and exported to ONNX format for
seamless runtime inference in the Node.js backend.

Usage:
    python3 ml/train.py
    python3 ml/train.py --output-dir models --cv-folds 5
"""

import os
import sys
import json
import math
import argparse
from datetime import datetime, timezone
from pathlib import Path

# Third-party scientific libraries
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    cohen_kappa_score,
    confusion_matrix,
    roc_curve,
    auc,
)
from xgboost import XGBClassifier

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


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Calculate the great-circle distance in kilometers between two points."""
    r = 6371.0  # Earth's radius in kilometers
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def compute_polygon_centroid(coordinates) -> tuple[float, float]:
    """
    Compute rough centroid [lon, lat] of a GeoJSON Polygon ring.
    Coordinates structure: [[[lon, lat], [lon, lat], ...]]
    """
    ring = coordinates[0] if isinstance(coordinates[0][0], list) else coordinates
    lons = [pt[0] for pt in ring]
    lats = [pt[1] for pt in ring]
    return float(np.mean(lons)), float(np.mean(lats))


def load_dataset(repo_root: Path, radius_km: float = 5.0):
    """
    Load real Uttarakhand zones, events, and habitations.
    Labels zones via spatial join against disaster events within radius_km.
    """
    uk_fixtures = repo_root / "backend" / "fixtures" / "raw" / "uttarakhand"
    zones_path = uk_fixtures / "factors" / "uttarakhand_zones.json"
    events_path = uk_fixtures / "disaster_events" / "uttarakhand_events.json"
    habitations_path = uk_fixtures / "habitations" / "uttarakhand_habitations.json"

    if not zones_path.exists():
        raise FileNotFoundError(f"Zones file not found at: {zones_path}")
    if not events_path.exists():
        raise FileNotFoundError(f"Events file not found at: {events_path}")
    if not habitations_path.exists():
        raise FileNotFoundError(f"Habitations file not found at: {habitations_path}")

    with open(zones_path, "r", encoding="utf-8") as f:
        zones_data = json.load(f).get("zones", [])
    with open(events_path, "r", encoding="utf-8") as f:
        events_data = json.load(f).get("events", [])
    with open(habitations_path, "r", encoding="utf-8") as f:
        habitations_data = json.load(f).get("habitations", [])

    # Map habitation id -> coordinate
    hab_coords = {}
    for hab in habitations_data:
        coords = hab.get("geometry", {}).get("coordinates", [])
        if len(coords) >= 2:
            hab_coords[hab["id"]] = (coords[0], coords[1])  # (lon, lat)

    # Attach coordinates to events
    located_events = []
    for evt in events_data:
        hab_id = evt.get("habitationId")
        if hab_id in hab_coords:
            evt_coords = hab_coords[hab_id]
            located_events.append({
                "id": evt["id"],
                "hazardType": evt["hazardType"],
                "lon": evt_coords[0],
                "lat": evt_coords[1],
                "severity": evt.get("severity", 50),
            })

    # Build feature rows and labels
    records = []
    labels = []
    zone_ids = []
    zone_types = []

    for zone in zones_data:
        zid = zone["id"]
        htype = zone["hazardType"]
        factors = zone.get("factors", {})
        coords = zone.get("geometry", {}).get("coordinates", [])

        if not coords:
            continue

        cent_lon, cent_lat = compute_polygon_centroid(coords)

        # Label via proximity to matching hazard event
        label = 0
        min_dist = float("inf")
        for evt in located_events:
            if evt["hazardType"] == htype:
                d = haversine_km(cent_lon, cent_lat, evt["lon"], evt["lat"])
                if d < min_dist:
                    min_dist = d
                if d <= radius_km:
                    label = 1

        # Construct 14-column feature row
        row = {}
        for factor in GEO_FACTORS:
            row[factor] = float(factors.get(factor, 0.0))
        for ht in HAZARD_TYPES:
            row[f"is_{ht}"] = 1.0 if htype == ht else 0.0

        records.append(row)
        labels.append(label)
        zone_ids.append(zid)
        zone_types.append(htype)

    df_x = pd.DataFrame(records, columns=FEATURE_NAMES)
    y = np.array(labels, dtype=np.int64)

    return df_x, y, zone_ids, zone_types


def evaluate_cv(model_fn, X: np.ndarray, y: np.ndarray, cv: StratifiedKFold):
    """
    Run Stratified K-Fold CV, collecting all evaluation metrics and ROC curves.
    """
    fold_metrics = []
    tprs = []
    aucs = []
    mean_fpr = np.linspace(0, 1, 100)
    all_y_true = []
    all_y_pred = []
    all_y_prob = []

    for train_idx, val_idx in cv.split(X, y):
        X_train, X_val = X[train_idx], X[val_idx]
        y_train, y_val = y[train_idx], y[val_idx]

        clf = model_fn()
        clf.fit(X_train, y_train)

        y_prob = clf.predict_proba(X_val)[:, 1]
        y_pred = clf.predict(X_val)

        all_y_true.extend(y_val)
        all_y_pred.extend(y_pred)
        all_y_prob.extend(y_prob)

        acc = accuracy_score(y_val, y_pred)
        prec = precision_score(y_val, y_pred, zero_division=0)
        rec = recall_score(y_val, y_pred, zero_division=0)
        f1_bin = f1_score(y_val, y_pred, zero_division=0)
        f1_mac = f1_score(y_val, y_pred, average="macro", zero_division=0)
        roc = roc_auc_score(y_val, y_prob)
        kappa = cohen_kappa_score(y_val, y_pred)

        fold_metrics.append({
            "accuracy": float(acc),
            "precision": float(prec),
            "recall": float(rec),
            "f1_binary": float(f1_bin),
            "f1_macro": float(f1_mac),
            "auc_roc": float(roc),
            "cohen_kappa": float(kappa),
        })

        fpr, tpr, _ = roc_curve(y_val, y_prob)
        interp_tpr = np.interp(mean_fpr, fpr, tpr)
        interp_tpr[0] = 0.0
        tprs.append(interp_tpr)
        aucs.append(auc(fpr, tpr))

    mean_tpr = np.mean(tprs, axis=0)
    mean_tpr[-1] = 1.0
    mean_auc = auc(mean_fpr, mean_tpr)
    std_auc = np.std(aucs)

    summary = {}
    for k in fold_metrics[0].keys():
        vals = [fm[k] for fm in fold_metrics]
        summary[k] = {
            "mean": float(np.mean(vals)),
            "std": float(np.std(vals)),
            "min": float(np.min(vals)),
            "max": float(np.max(vals)),
        }

    conf_mat = confusion_matrix(all_y_true, all_y_pred).tolist()

    return {
        "folds": fold_metrics,
        "summary": summary,
        "confusion_matrix": conf_mat,
        "roc_curve": {
            "mean_fpr": mean_fpr.tolist(),
            "mean_tpr": mean_tpr.tolist(),
            "mean_auc": float(mean_auc),
            "std_auc": float(std_auc),
        },
    }


def export_to_onnx(model, model_type: str, num_features: int, output_path: Path):
    """
    Export scikit-learn or XGBoost classifier to ONNX format.
    """
    try:
        if model_type in ("RandomForest", "LogisticRegression"):
            from skl2onnx import convert_sklearn
            from skl2onnx.common.data_types import FloatTensorType

            initial_type = [("float_input", FloatTensorType([None, num_features]))]
            onx = convert_sklearn(
                model,
                initial_types=initial_type,
                options={id(model): {"zipmap": False}},
                target_opset=15,
            )
            with open(output_path, "wb") as f:
                f.write(onx.SerializeToString())
            return True

        elif model_type == "XGBoost":
            import onnxmltools
            from onnxmltools.convert.common.data_types import FloatTensorType

            initial_type = [("float_input", FloatTensorType([None, num_features]))]
            onx = onnxmltools.convert_xgboost(
                model,
                initial_types=initial_type,
                target_opset=15,
            )
            with open(output_path, "wb") as f:
                f.write(onx.SerializeToString())
            return True

    except Exception as e:
        print(f"[export] Warning: Could not export to ONNX directly: {e}")
        print("[export] To enable ONNX export, ensure skl2onnx, onnxmltools, and onnx are installed:")
        print("         pip install onnx onnxmltools skl2onnx")
        return False


def generate_plots(lr_res, rf_res, xgb_res, rf_model, xgb_model, feature_names, output_dir: Path):
    """
    Save evaluation plots: ROC curves, confusion matrices, and feature importances.
    """
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        output_dir.mkdir(parents=True, exist_ok=True)

        # 1. ROC Curves
        plt.figure(figsize=(8, 6))
        lr_roc = lr_res["roc_curve"]
        rf_roc = rf_res["roc_curve"]
        xgb_roc = xgb_res["roc_curve"]

        plt.plot(
            lr_roc["mean_fpr"],
            lr_roc["mean_tpr"],
            label=f"Logistic Regression (AUC = {lr_roc['mean_auc']:.2f} ± {lr_roc['std_auc']:.2f})",
            color="#718096",
            linestyle="--",
            lw=1.8,
        )
        plt.plot(
            rf_roc["mean_fpr"],
            rf_roc["mean_tpr"],
            label=f"Random Forest (AUC = {rf_roc['mean_auc']:.2f} ± {rf_roc['std_auc']:.2f})",
            color="#2b6cb0",
            lw=2.2,
        )
        plt.plot(
            xgb_roc["mean_fpr"],
            xgb_roc["mean_tpr"],
            label=f"XGBoost (AUC = {xgb_roc['mean_auc']:.2f} ± {xgb_roc['std_auc']:.2f})",
            color="#d69e2e",
            lw=2.2,
        )
        plt.plot([0, 1], [0, 1], "k:", lw=1.2, alpha=0.5, label="Chance (AUC = 0.50)")
        plt.xlim([0.0, 1.0])
        plt.ylim([0.0, 1.05])
        plt.xlabel("False Positive Rate", fontsize=11)
        plt.ylabel("True Positive Rate", fontsize=11)
        plt.title("Stratified 5-Fold ROC: Logistic Reg vs. Random Forest vs. XGBoost", fontsize=13, fontweight="bold")
        plt.legend(loc="lower right", frameon=True)
        plt.grid(True, linestyle=":", alpha=0.6)
        plt.tight_layout()
        plt.savefig(output_dir / "roc_curves.png", dpi=300)
        plt.close()

        # 2. Confusion Matrices
        fig, axes = plt.subplots(1, 3, figsize=(14, 4.5))
        for ax, res, title in [(axes[0], lr_res, "Logistic Regression"), (axes[1], rf_res, "Random Forest"), (axes[2], xgb_res, "XGBoost")]:
            cm = np.array(res["confusion_matrix"])
            im = ax.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
            ax.set_title(f"{title} (5-Fold Aggregated)", fontsize=11, fontweight="bold")
            tick_marks = np.arange(2)
            ax.set_xticks(tick_marks)
            ax.set_yticks(tick_marks)
            ax.set_xticklabels(["Neg (0)", "Pos (1)"])
            ax.set_yticklabels(["Neg (0)", "Pos (1)"])
            ax.set_ylabel("True Label")
            ax.set_xlabel("Predicted Label")
            for i in range(2):
                for j in range(2):
                    ax.text(
                        j, i, format(cm[i, j], "d"),
                        ha="center", va="center",
                        color="white" if cm[i, j] > cm.max() / 2.0 else "black",
                        fontsize=12,
                    )
        plt.tight_layout()
        plt.savefig(output_dir / "confusion_matrices.png", dpi=300)
        plt.close()

        # 3. Feature Importance
        plt.figure(figsize=(10, 6))
        rf_imp = rf_model.feature_importances_
        xgb_imp = xgb_model.feature_importances_

        indices = np.argsort(rf_imp)
        y_pos = np.arange(len(feature_names))
        height = 0.35

        plt.barh(y_pos - height / 2, rf_imp[indices], height, label="Random Forest", color="#3182ce")
        plt.barh(y_pos + height / 2, xgb_imp[indices], height, label="XGBoost", color="#dd6b20")

        plt.yticks(y_pos, [feature_names[i] for i in indices])
        plt.xlabel("Relative Importance")
        plt.title("Feature Importance: Random Forest vs. XGBoost", fontsize=13, fontweight="bold")
        plt.legend(loc="lower right")
        plt.grid(True, axis="x", linestyle=":", alpha=0.6)
        plt.tight_layout()
        plt.savefig(output_dir / "feature_importance.png", dpi=300)
        plt.close()

        print(f"[train] Saved diagnostic plots to {output_dir}/")
    except Exception as e:
        print(f"[train] Note: Skipping plot generation ({e})")


def print_comparison_table(lr_summary: dict, rf_summary: dict, xgb_summary: dict):
    """
    Print an ASCII table comparing all evaluation metrics across all 3 models.
    """
    metrics = [
        ("AUC-ROC", "auc_roc"),
        ("F1-Score (Macro)", "f1_macro"),
        ("Cohen's Kappa", "cohen_kappa"),
        ("Accuracy", "accuracy"),
        ("Precision", "precision"),
        ("Recall", "recall"),
    ]

    print("\n" + "=" * 94)
    print(" MODEL PERFORMANCE COMPARISON (Stratified 5-Fold Cross-Validation)")
    print("=" * 94)
    print(f"{'Metric':<20} | {'Logistic Reg (LR)':<22} | {'Random Forest (RF)':<22} | {'XGBoost (XGB)':<22}")
    print("-" * 94)

    for label, key in metrics:
        lr_m = lr_summary[key]
        rf_m = rf_summary[key]
        xgb_m = xgb_summary[key]
        lr_str = f"{lr_m['mean']:.4f} ± {lr_m['std']:.4f}"
        rf_str = f"{rf_m['mean']:.4f} ± {rf_m['std']:.4f}"
        xgb_str = f"{xgb_m['mean']:.4f} ± {xgb_m['std']:.4f}"
        print(f"{label:<20} | {lr_str:<22} | {rf_str:<22} | {xgb_str:<22}")
    print("=" * 94 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Train and compare ML susceptibility models.")
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--output-dir", type=Path, default=None)
    parser.add_argument("--cv-folds", type=int, default=5)
    parser.add_argument("--random-state", type=int, default=42)
    parser.add_argument("--radius-km", type=float, default=10.0, help="Spatial join radius in km for event matching")
    args = parser.parse_args()

    repo_root = args.repo_root
    output_dir = args.output_dir if args.output_dir else repo_root / "models"
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"[train] Bhoomi Suraksha ML Susceptibility Pipeline")
    print(f"[train] Loading Uttarakhand real data from {repo_root / 'backend/fixtures/raw/uttarakhand'}")

    # 1. Load data and label
    df_x, y, zone_ids, zone_types = load_dataset(repo_root, radius_km=args.radius_km)
    num_samples = len(y)
    num_pos = int(np.sum(y == 1))
    num_neg = int(np.sum(y == 0))

    print(f"[train] Loaded {num_samples} zones:")
    print(f"        Positive labels (within {args.radius_km}km of event): {num_pos} ({num_pos / num_samples * 100:.1f}%)")
    print(f"        Negative labels (unconfirmed):          {num_neg} ({num_neg / num_samples * 100:.1f}%)")
    print(f"[train] Feature matrix: {num_samples} rows × {len(FEATURE_NAMES)} columns")

    X = df_x.values.astype(np.float32)

    # 2. Setup 5-fold CV
    cv = StratifiedKFold(n_splits=args.cv_folds, shuffle=True, random_state=args.random_state)

    # 3. Model configs
    lr_kwargs = {
        "class_weight": "balanced",
        "max_iter": 1000,
        "random_state": args.random_state,
    }
    lr_factory = lambda: Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(**lr_kwargs)),
    ])

    rf_kwargs = {
        "n_estimators": 150,
        "max_depth": 3,
        "min_samples_leaf": 2,
        "class_weight": "balanced",
        "random_state": args.random_state,
        "n_jobs": -1,
    }
    rf_factory = lambda: RandomForestClassifier(**rf_kwargs)

    scale_pos = float(num_neg) / max(float(num_pos), 1.0)
    xgb_kwargs = {
        "n_estimators": 100,
        "max_depth": 3,
        "learning_rate": 0.08,
        "scale_pos_weight": scale_pos,
        "eval_metric": "logloss",
        "random_state": args.random_state,
        "n_jobs": -1,
    }
    xgb_factory = lambda: XGBClassifier(**xgb_kwargs)

    print(f"\n[train] Running Stratified {args.cv_folds}-Fold Cross-Validation across 3 models...")

    # 4. Evaluate all 3 models
    lr_results = evaluate_cv(lr_factory, X, y, cv)
    rf_results = evaluate_cv(rf_factory, X, y, cv)
    xgb_results = evaluate_cv(xgb_factory, X, y, cv)

    # 5. Display 3-model comparison
    print_comparison_table(lr_results["summary"], rf_results["summary"], xgb_results["summary"])

    # 6. Select winner
    candidates = [
        ("XGBoost", xgb_results["summary"], xgb_factory),
        ("RandomForest", rf_results["summary"], rf_factory),
        ("LogisticRegression", lr_results["summary"], lr_factory),
    ]
    candidates.sort(key=lambda c: (c[1]["auc_roc"]["mean"], c[1]["f1_macro"]["mean"]), reverse=True)
    winner_name, winning_metrics, winner_factory = candidates[0]

    print(f"[train] -> Selected winner: {winner_name} (Mean AUC-ROC: {winning_metrics['auc_roc']['mean']:.4f})")

    # 7. Retrain winner on full dataset
    print(f"[train] Retraining {winner_name} on all {num_samples} samples...")
    final_winner = winner_factory()
    final_winner.fit(X, y)

    # Fit RF & XGB models for feature importance comparison
    full_rf = rf_factory().fit(X, y)
    full_xgb = xgb_factory().fit(X, y)

    # 8. Export to ONNX
    onnx_path = output_dir / "susceptibility.onnx"
    print(f"[train] Exporting {winner_name} to ONNX: {onnx_path}")
    onnx_exported = export_to_onnx(final_winner, winner_name, len(FEATURE_NAMES), onnx_path)
    if onnx_exported:
        print(f"[train] Successfully generated {onnx_path} ({os.path.getsize(onnx_path)} bytes)")

    # 9. Save plots
    generate_plots(lr_results, rf_results, xgb_results, full_rf, full_xgb, FEATURE_NAMES, output_dir)

    # 10. Write model_meta.json
    meta = {
        "version": "1.0.0",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "winning_model": winner_name,
        "features": FEATURE_NAMES,
        "num_features": len(FEATURE_NAMES),
        "hazard_types": HAZARD_TYPES,
        "sample_counts": {
            "total": num_samples,
            "positive": num_pos,
            "negative": num_neg,
        },
        "cv_folds": args.cv_folds,
        "winning_metrics": {
            "auc_roc_mean": winning_metrics["auc_roc"]["mean"],
            "auc_roc_std": winning_metrics["auc_roc"]["std"],
            "f1_macro_mean": winning_metrics["f1_macro"]["mean"],
            "accuracy_mean": winning_metrics["accuracy"]["mean"],
            "kappa_mean": winning_metrics["cohen_kappa"]["mean"],
        },
        "onnx_file": "susceptibility.onnx",
    }

    meta_path = output_dir / "model_meta.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"[train] Saved metadata to {meta_path}")

    # 11. Write comparison_report.json
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset": {
            "source": "backend/fixtures/raw/uttarakhand",
            "total_zones": num_samples,
            "positives": num_pos,
            "negatives": num_neg,
            "imbalance_ratio": f"1:{num_neg / max(num_pos, 1):.1f}",
        },
        "winner": {
            "name": winner_name,
            "reason": "Highest mean Stratified 5-Fold AUC-ROC score",
        },
        "models": {
            "LogisticRegression": {
                "summary": lr_results["summary"],
                "folds": lr_results["folds"],
                "confusion_matrix": lr_results["confusion_matrix"],
            },
            "RandomForest": {
                "summary": rf_results["summary"],
                "folds": rf_results["folds"],
                "confusion_matrix": rf_results["confusion_matrix"],
            },
            "XGBoost": {
                "summary": xgb_results["summary"],
                "folds": xgb_results["folds"],
                "confusion_matrix": xgb_results["confusion_matrix"],
            },
        },
    }

    report_path = output_dir / "comparison_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"[train] Saved detailed comparison report to {report_path}")

    print("\n[train] Training and evaluation complete!")
    print(f"        To test predictions: python3 ml/predict.py")
    print(f"        To enable in backend: set ENABLE_ML_SUSCEPTIBILITY=true in .env and run 'npm run score'")


if __name__ == "__main__":
    main()
