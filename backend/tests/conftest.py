"""Shared test fixtures for backend model-bundle tests."""

import json
import sys
from pathlib import Path

import numpy as np
import pytest
from xgboost import XGBClassifier

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture
def synthetic_model_bundle(tmp_path):
    """Create a tiny, temporary XGBoost bundle for tests only.

    This fixture is not a trained project model and its predictions or metrics
    must never be reported as experimental results. Small deterministic arrays
    keep loader and adapter tests fast without involving any real dataset.
    """
    fixture_features = np.asarray(
        [
            [0.0, 0.0, 0.0, 0.0],
            [0.1, 0.2, 0.1, 0.2],
            [0.2, 0.1, 0.2, 0.1],
            [0.8, 0.9, 0.8, 0.9],
            [0.9, 0.8, 0.9, 0.8],
            [1.0, 1.0, 1.0, 1.0],
        ],
        dtype=np.float32,
    )
    fixture_labels = np.asarray([0, 0, 0, 1, 1, 1], dtype=np.int32)

    model_a = XGBClassifier(
        n_estimators=2,
        max_depth=1,
        learning_rate=0.2,
        objective="binary:logistic",
        eval_metric="logloss",
        n_jobs=1,
        random_state=13,
    )
    model_a.fit(fixture_features, fixture_labels)
    model_a.save_model(tmp_path / "model_a.json")

    # Feature-vector FFT: drop DC coefficient (index 0), take first K=2 magnitudes
    fft_mags = np.abs(np.fft.rfft(fixture_features, axis=1))[:, 1:3]
    fixture_model_b_features = np.column_stack([fixture_features, fft_mags]).astype(np.float32)
    model_b = XGBClassifier(
        n_estimators=2,
        max_depth=1,
        learning_rate=0.2,
        objective="binary:logistic",
        eval_metric="logloss",
        n_jobs=1,
        random_state=13,
    )
    model_b.fit(fixture_model_b_features, fixture_labels)
    model_b.save_model(tmp_path / "model_b.json")

    bundle_files = {
        "feature_order.json": ["feature_a", "feature_b", "feature_c", "feature_d"],
        "scaler.json": {"mean": [0.0, 0.0, 0.0, 0.0], "scale": [1.0, 1.0, 1.0, 1.0]},
        "label_map.json": {"0": "BENIGN", "1": "TEST_ATTACK"},
        "metrics.json": {"fixture_only": True},
        "config.json": {"fft": {"method": "rfft_magnitude", "k": 2}},
    }
    for filename, content in bundle_files.items():
        (tmp_path / filename).write_text(json.dumps(content), encoding="utf-8")

    return tmp_path