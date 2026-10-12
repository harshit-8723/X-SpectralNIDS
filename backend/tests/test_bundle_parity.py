import json
from pathlib import Path

import pandas as pd
import pytest

from feature_pipeline import transform_features
from model_adapter import create_model_adapter
from model_bundle import load_model_bundle


MODEL_DIR = Path(__file__).resolve().parents[1] / "models"
MODEL_B_DIR = MODEL_DIR / "model_b_deduplicated"
SAMPLE_TEST_PRED_PATH = MODEL_B_DIR / "sample_test_predictions.csv"
SAMPLE_ROWS_PATH = MODEL_DIR / "sample_rows.csv"
EXPECTED_OUTPUTS_PATH = MODEL_DIR / "expected_outputs.json"
REPLAY_SAMPLE_PATH = Path(__file__).resolve().parents[1] / "data" / "replay_sample.csv"


def test_model_b_sample_test_predictions_reference_parity():
    """Verify backend Model B pipeline against teammate's reference predictions."""
    if not SAMPLE_TEST_PRED_PATH.is_file():
        pytest.skip("sample_test_predictions.csv is not present")

    bundle = load_model_bundle(MODEL_DIR, "model_b")
    adapter = create_model_adapter(
        type("Config", (), {"model_name": "model_b"})(), bundle
    )
    df = pd.read_csv(SAMPLE_TEST_PRED_PATH)
    features = transform_features(df, bundle)
    labels, _ = adapter.predict_batch(features)

    assert labels == df["predicted_label"].tolist()


def test_replay_sample_sanity_accuracy():
    """Sanity check: both models achieve expected high accuracy on un-split replay data."""
    if not REPLAY_SAMPLE_PATH.is_file():
        pytest.skip("replay_sample.csv is not present")

    df = pd.read_csv(REPLAY_SAMPLE_PATH)
    y_true = df["Label"].tolist()

    for model_name in ("model_a", "model_b"):
        bundle = load_model_bundle(MODEL_DIR, model_name)
        adapter = create_model_adapter(
            type("Config", (), {"model_name": model_name})(), bundle
        )
        features = transform_features(df, bundle)
        labels, _ = adapter.predict_batch(features)
        accuracy = sum(1 for y, p in zip(y_true, labels) if y == p) / len(y_true)
        # Sanity check: expected >= 0.95 on raw replay sample (contains training rows)
        assert accuracy >= 0.95, f"{model_name} sanity accuracy too low: {accuracy}"


@pytest.mark.skipif(
    not SAMPLE_ROWS_PATH.is_file() or not EXPECTED_OUTPUTS_PATH.is_file(),
    reason="parity bundle files sample_rows.csv and expected_outputs.json are not present",
)
def test_bundle_prediction_parity():
    expected = json.loads(EXPECTED_OUTPUTS_PATH.read_text(encoding="utf-8"))
    model_name = expected["model_name"]
    bundle = load_model_bundle(MODEL_DIR, model_name)
    adapter = create_model_adapter(
        type("Config", (), {"model_name": model_name})(), bundle
    )
    sample_rows = pd.read_csv(SAMPLE_ROWS_PATH)
    features = transform_features(sample_rows, bundle)
    labels, probabilities = adapter.predict_batch(features)

    assert labels == expected["labels"]
    assert len(probabilities) == len(expected["probabilities"])
    for actual_row, expected_row in zip(probabilities, expected["probabilities"]):
        assert actual_row == pytest.approx(expected_row, abs=1e-6)