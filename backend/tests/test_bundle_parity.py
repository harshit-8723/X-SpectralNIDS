import json
from pathlib import Path

import pandas as pd
import pytest

from feature_pipeline import transform_features
from model_adapter import create_model_adapter
from model_bundle import load_model_bundle


MODEL_DIR = Path(__file__).resolve().parents[1] / "models"
SAMPLE_ROWS_PATH = MODEL_DIR / "sample_rows.csv"
EXPECTED_OUTPUTS_PATH = MODEL_DIR / "expected_outputs.json"


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