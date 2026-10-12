import pandas as pd

from model_adapter import XGBoostModelAdapter, create_model_adapter
from model_bundle import load_model_bundle


def test_xgboost_adapter_predicts_using_bundle_label_order(synthetic_model_bundle):
    bundle = load_model_bundle(synthetic_model_bundle, "model_a")
    adapter = create_model_adapter(
        type("Config", (), {"model_name": "model_a"})(), bundle
    )
    labels, probabilities = adapter.predict_batch(
        pd.DataFrame(
            [[0.0, 0.0, 0.0, 0.0], [1.0, 1.0, 1.0, 1.0]],
            columns=bundle.feature_order,
        )
    )

    assert isinstance(adapter, XGBoostModelAdapter)
    assert adapter.is_dummy is False
    assert len(probabilities) == 2
    expected_labels = [
        bundle.class_labels[max(range(len(row)), key=row.__getitem__)]
        for row in probabilities
    ]
    assert labels == expected_labels
    assert all(abs(sum(row) - 1.0) < 1e-5 for row in probabilities)