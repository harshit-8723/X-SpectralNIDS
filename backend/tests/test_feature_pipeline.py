import numpy as np
import pandas as pd
import pytest

from feature_pipeline import transform_features
from model_bundle import load_model_bundle


def test_orders_features_and_appends_configured_fft(synthetic_model_bundle):
    (synthetic_model_bundle / "scaler.json").write_text(
        '{"mean": [1.0, 2.0, 0.0, 0.0], "scale": [2.0, 4.0, 1.0, 1.0]}', encoding="utf-8"
    )
    bundle = load_model_bundle(synthetic_model_bundle, "model_b")
    input_rows = pd.DataFrame(
        {
            "feature_b": [6.0],
            "unused_metadata": [999.0],
            "feature_a": [5.0],
            "feature_c": [1.0],
            "feature_d": [2.0],
        }
    )

    transformed = transform_features(input_rows, bundle)

    assert list(transformed.columns) == [
        "feature_a",
        "feature_b",
        "feature_c",
        "feature_d",
        "FFT_MAG_BIN_1",
        "FFT_MAG_BIN_2",
    ]
    # Raw unscaled features: [5.0, 6.0, 1.0, 2.0]
    # Standardized: [2.0, 1.0, 1.0, 2.0] -> rfft magnitudes without DC: [sqrt(2), 0.0]
    expected_mags = [np.sqrt(2), 0.0]
    assert transformed.iloc[0].to_list() == pytest.approx([5.0, 6.0, 1.0, 2.0] + expected_mags)


def test_model_a_returns_raw_unscaled_features(synthetic_model_bundle):
    bundle = load_model_bundle(synthetic_model_bundle, "model_a")
    transformed = transform_features(
        pd.DataFrame(
            {
                "feature_b": [2.0],
                "feature_a": [1.0],
                "feature_c": [3.0],
                "feature_d": [4.0],
            }
        ),
        bundle,
    )

    assert list(transformed.columns) == [
        "feature_a",
        "feature_b",
        "feature_c",
        "feature_d",
    ]
    assert transformed.iloc[0].to_list() == pytest.approx([1.0, 2.0, 3.0, 4.0])
    assert np.isfinite(transformed.to_numpy()).all()


def test_rejects_missing_required_feature(synthetic_model_bundle):
    bundle = load_model_bundle(synthetic_model_bundle, "model_a")

    with pytest.raises(ValueError, match=r"missing required columns: \['feature_b'\]"):
        transform_features(
            pd.DataFrame({"feature_a": [1.0], "feature_c": [1.0], "feature_d": [1.0]}),
            bundle,
        )


def test_rejects_non_finite_feature_value(synthetic_model_bundle):
    bundle = load_model_bundle(synthetic_model_bundle, "model_a")

    with pytest.raises(ValueError, match="missing or non-finite"):
        transform_features(
            pd.DataFrame(
                {
                    "feature_a": [np.nan],
                    "feature_b": [0.0],
                    "feature_c": [0.0],
                    "feature_d": [0.0],
                }
            ),
            bundle,
        )