import json

import pytest

from model_bundle import load_model_bundle


@pytest.mark.parametrize(
    ("model_name", "expected_features"),
    [("model_a", 4), ("model_b", 6)],
)
def test_loads_temporary_synthetic_xgboost_bundle(
    synthetic_model_bundle, model_name, expected_features
):
    bundle = load_model_bundle(synthetic_model_bundle, model_name)

    assert bundle.model_name == model_name
    assert bundle.estimator.get_booster().num_features() == expected_features
    assert bundle.class_labels == ("BENIGN", "TEST_ATTACK")
    if model_name == "model_b":
        assert bundle.fft_method == "rfft_magnitude"
        assert bundle.fft_k == 2
    else:
        assert bundle.fft_method is None
        assert bundle.fft_k == 0
    assert bundle.metrics == {"fixture_only": True}


def test_missing_bundle_file_names_the_file(tmp_path):
    with pytest.raises(ValueError, match="missing required file.*model_a.json"):
        load_model_bundle(tmp_path, "model_a")


def test_feature_count_mismatch_names_selected_model(
    synthetic_model_bundle,
):
    (synthetic_model_bundle / "model_b.json").write_bytes(
        (synthetic_model_bundle / "model_a.json").read_bytes()
    )

    with pytest.raises(ValueError, match="model_b.json expects 4 features"):
        load_model_bundle(synthetic_model_bundle, "model_b")


@pytest.mark.parametrize(
    ("config_data", "message"),
    [
        ({}, "config.json must contain an 'fft' object"),
        ({"fft": {"method": "fft_guess", "k": 1}}, "fft.method must be"),
        ({"fft": {"method": "rfft_magnitude", "k": 0}}, "fft.k must be a positive integer"),
        ({"fft": {"method": "rfft_magnitude", "k": 2.5}}, "fft.k must be a positive integer"),
        ({"fft": {"method": "rfft_magnitude", "k": 3}}, "fft.k exceeds the rfft output length"),
    ],
)
def test_rejects_missing_or_invalid_fft_configuration(
    synthetic_model_bundle, config_data, message
):
    (synthetic_model_bundle / "config.json").write_text(
        json.dumps(config_data), encoding="utf-8"
    )

    with pytest.raises(ValueError, match=message):
        load_model_bundle(synthetic_model_bundle, "model_b")


def test_rejects_scaler_length_mismatch(synthetic_model_bundle):
    (synthetic_model_bundle / "scaler.json").write_text(
        json.dumps({"mean": [0.0], "scale": [1.0, 1.0, 1.0, 1.0]}), encoding="utf-8"
    )

    with pytest.raises(ValueError, match="scaler.json field 'mean'.*feature_order.json"):
        load_model_bundle(synthetic_model_bundle, "model_b")


def test_rejects_non_contiguous_label_indexes(synthetic_model_bundle):
    (synthetic_model_bundle / "label_map.json").write_text(
        json.dumps({"0": "BENIGN", "2": "TEST_ATTACK"}), encoding="utf-8"
    )

    with pytest.raises(ValueError, match="contiguous starting at zero"):
        load_model_bundle(synthetic_model_bundle, "model_a")


def test_rejects_display_only_or_target_feature_names(synthetic_model_bundle):
    (synthetic_model_bundle / "feature_order.json").write_text(
        json.dumps(["row_id", "feature_b", "feature_c", "feature_d"]), encoding="utf-8"
    )

    with pytest.raises(ValueError, match="target, identifier, or display-only"):
        load_model_bundle(synthetic_model_bundle, "model_a")