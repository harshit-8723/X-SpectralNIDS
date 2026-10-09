"""Batch prediction interface and the existing dummy implementation adapter.

The replay engine will depend on this small contract instead of knowing how a
particular model is loaded or called. Predictions remain string labels plus
class probabilities; the bundle loader will later provide the class order for
real models. The dummy adapter is explicitly marked so its output cannot be
mistaken for research evidence.
"""

from __future__ import annotations

from typing import Protocol, Sequence

import numpy as np
import pandas as pd

from dummy_pipeline import ATTACK_LABELS, run_inference_stub


class ModelAdapter(Protocol):
    """Minimal inference contract shared by dummy and bundled models."""

    model_name: str
    is_dummy: bool
    class_labels: tuple[str, ...]

    # INTEGRATION POINT: The replay engine calls this for each bounded tick batch;
    # concrete adapters must preserve row order and return one probability row per input.
    def predict_batch(
        self, features_df: pd.DataFrame
    ) -> tuple[list[str], list[list[float]]]: ...


class DummyModelAdapter:
    """Wrap the repository's current randomized pipeline as a batch adapter."""

    model_name = "dummy"
    is_dummy = True

    def __init__(self, class_labels: Sequence[str] = ATTACK_LABELS):
        labels = tuple(str(label) for label in class_labels)
        if not labels:
            raise ValueError("DummyModelAdapter requires at least one class label")
        if len(set(labels)) != len(labels):
            raise ValueError("DummyModelAdapter class labels must be unique")
        self.class_labels = labels

    def predict_batch(
        self, features_df: pd.DataFrame
    ) -> tuple[list[str], list[list[float]]]:
        if not isinstance(features_df, pd.DataFrame):
            raise TypeError("features_df must be a pandas DataFrame")

        predictions: list[str] = []
        probabilities: list[list[float]] = []
        for _, row in features_df.iterrows():
            result = run_inference_stub(row.to_dict())
            predicted_label = str(result["predicted_label"])
            confidence = float(result["confidence"])
            if predicted_label not in self.class_labels:
                raise ValueError(
                    "Dummy inference returned a label outside the configured class order: "
                    f"{predicted_label!r}"
                )

            if len(self.class_labels) == 1:
                probability_row = [1.0]
            else:
                remainder = (1.0 - confidence) / (len(self.class_labels) - 1)
                probability_row = [
                    confidence if label == predicted_label else remainder
                    for label in self.class_labels
                ]
            predictions.append(predicted_label)
            probabilities.append(probability_row)

        return predictions, probabilities


class XGBoostModelAdapter:
    """Adapt an already-validated XGBoost classifier to the batch contract."""

    is_dummy = False

    def __init__(
        self,
        estimator,
        model_name: str,
        class_labels: Sequence[str],
    ):
        if model_name not in {"model_a", "model_b"}:
            raise ValueError(f"XGBoost adapter cannot serve model {model_name!r}")
        labels = tuple(str(label) for label in class_labels)
        if not labels or len(set(labels)) != len(labels):
            raise ValueError("XGBoost adapter requires unique, non-empty class labels")
        self.estimator = estimator
        self.model_name = model_name
        self.class_labels = labels

    def predict_batch(
        self, features_df: pd.DataFrame
    ) -> tuple[list[str], list[list[float]]]:
        if not isinstance(features_df, pd.DataFrame):
            raise TypeError("features_df must be a pandas DataFrame")
        if features_df.empty:
            return [], []

        probability_array = np.asarray(self.estimator.predict_proba(features_df), dtype=float)
        if probability_array.ndim != 2 or probability_array.shape[0] != len(features_df):
            raise ValueError("XGBoost predict_proba returned an invalid batch shape")
        if probability_array.shape[1] != len(self.class_labels):
            raise ValueError(
                "XGBoost probability columns do not match label_map.json: "
                f"got {probability_array.shape[1]}, expected {len(self.class_labels)}"
            )
        if not np.isfinite(probability_array).all():
            raise ValueError("XGBoost predict_proba returned non-finite values")
        if (probability_array < 0).any() or (probability_array > 1).any():
            raise ValueError("XGBoost predict_proba returned values outside [0, 1]")
        if not np.allclose(probability_array.sum(axis=1), 1.0, atol=1e-5):
            raise ValueError("XGBoost probability rows do not sum to one")

        class_indices = probability_array.argmax(axis=1)
        predictions = [self.class_labels[int(index)] for index in class_indices]
        probabilities = probability_array.tolist()
        return predictions, probabilities


def create_model_adapter(config, bundle=None) -> ModelAdapter:
    """Select the configured implementation after bundle validation.

    # INTEGRATION POINT: The application startup path supplies a validated bundle
    # for model_a/model_b; dummy remains available without any artifact directory.
    """
    if config.model_name == "dummy":
        return DummyModelAdapter()
    if bundle is None:
        raise ValueError(
            f"MODEL_NAME={config.model_name!r} requires a validated model bundle"
        )
    if bundle.model_name != config.model_name:
        raise ValueError(
            "Loaded bundle model does not match MODEL_NAME: "
            f"{bundle.model_name!r} != {config.model_name!r}"
        )
    return XGBoostModelAdapter(
        estimator=bundle.estimator,
        model_name=bundle.model_name,
        class_labels=bundle.class_labels,
    )