"""Batch prediction interface and the existing dummy implementation adapter.

The replay engine will depend on this small contract instead of knowing how a
particular model is loaded or called. Predictions remain string labels plus
class probabilities; the bundle loader will later provide the class order for
real models. The dummy adapter is explicitly marked so its output cannot be
mistaken for research evidence.
"""

from __future__ import annotations

from typing import Protocol, Sequence

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