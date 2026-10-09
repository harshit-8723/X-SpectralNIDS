import math

import pandas as pd
import pytest

from model_adapter import DummyModelAdapter


def test_dummy_adapter_returns_one_label_and_probability_row_per_input():
    adapter = DummyModelAdapter()
    features = pd.DataFrame({"feature_a": [1.0, 2.0, 3.0], "feature_b": [0.0, 1.0, 2.0]})

    labels, probabilities = adapter.predict_batch(features)

    assert adapter.model_name == "dummy"
    assert adapter.is_dummy is True
    assert len(labels) == len(features)
    assert len(probabilities) == len(features)
    assert all(label in adapter.class_labels for label in labels)
    assert all(len(row) == len(adapter.class_labels) for row in probabilities)
    assert all(math.isclose(sum(row), 1.0, rel_tol=1e-9) for row in probabilities)
    assert all(0.0 <= value <= 1.0 for row in probabilities for value in row)


def test_dummy_adapter_rejects_duplicate_class_labels():
    with pytest.raises(ValueError, match="must be unique"):
        DummyModelAdapter(["BENIGN", "BENIGN"])


def test_dummy_adapter_requires_dataframe():
    with pytest.raises(TypeError, match="pandas DataFrame"):
        DummyModelAdapter().predict_batch([{"feature": 1.0}])