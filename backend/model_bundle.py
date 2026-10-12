"""Load and validate a model bundle before the backend accepts traffic.

The JSON schemas in this module are deliberately strict: a bundle must carry
the exact feature order, scaler values, label mapping, metrics metadata, and
FFT method/K used to build it. In particular, no feature-vector FFT setting is
defaulted here, because silently inventing K or a transform would make model
inputs irreproducible.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from xgboost import XGBClassifier


REQUIRED_BUNDLE_FILES_MODEL_A = (
    "model_a.json",
    "feature_order.json",
    "label_map.json",
)

REQUIRED_BUNDLE_FILES_MODEL_B = (
    "model_b.json",
    "feature_order.json",
    "scaler.json",
    "config.json",
    "label_map.json",
)


@dataclass(frozen=True)
class ModelBundle:
    model_name: str
    estimator: XGBClassifier
    feature_order: tuple[str, ...]
    scaler_mean: tuple[float, ...] | None
    scaler_scale: tuple[float, ...] | None
    class_labels: tuple[str, ...]
    metrics: dict[str, Any]
    fft_method: str | None
    fft_k: int
    model_feature_order: tuple[str, ...] = ()
    fft_feature_names: tuple[str, ...] = ()


def _read_json(path: Path) -> Any:
    try:
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path.name}: {exc.msg}") from exc
    except OSError as exc:
        raise ValueError(f"Could not read {path.name}: {exc}") from exc


def _finite_number_list(value: Any, field_name: str, expected_length: int | None = None) -> tuple[float, ...]:
    if not isinstance(value, list) or not value:
        raise ValueError(f"scaler.json field {field_name!r} must be a non-empty number list")
    try:
        numbers = tuple(float(item) for item in value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"scaler.json field {field_name!r} must contain only numbers") from exc
    if not all(math.isfinite(number) for number in numbers):
        raise ValueError(f"scaler.json field {field_name!r} must contain only finite values")
    if expected_length is not None and len(numbers) != expected_length:
        raise ValueError(
            f"scaler.json field {field_name!r} has {len(numbers)} values; "
            f"feature_order.json has {expected_length} features"
        )
    return numbers


def load_model_bundle(model_dir: Path, model_name: str) -> ModelBundle:
    """Load the selected model after validating every required bundle file."""
    if model_name not in {"model_a", "model_b"}:
        raise ValueError(f"A real bundle requires model_a or model_b; got {model_name!r}")

    directory = Path(model_dir).expanduser().resolve()
    if not directory.is_dir():
        raise ValueError(f"MODEL_DIR does not exist or is not a directory: {directory}")

    # Check if files reside directly in directory or in a deduplicated/model subfolder
    if not (directory / f"{model_name}.json").is_file():
        for sub in (f"{model_name}_deduplicated", model_name):
            sub_dir = directory / sub
            if sub_dir.is_dir() and (sub_dir / f"{model_name}.json").is_file():
                directory = sub_dir
                break

    if model_name == "model_a":
        required_files = REQUIRED_BUNDLE_FILES_MODEL_A
    else:
        required_files = REQUIRED_BUNDLE_FILES_MODEL_B

    missing_files = [name for name in required_files if not (directory / name).is_file()]
    if missing_files:
        raise ValueError(
            f"Model bundle at {directory} is missing required file(s): "
            f"{', '.join(missing_files)}"
        )

    feature_order_data = _read_json(directory / "feature_order.json")
    fft_feature_names: tuple[str, ...] = ()
    model_feature_order: tuple[str, ...] = ()

    if isinstance(feature_order_data, dict):
        orig_data = feature_order_data.get("original_features")
        if (
            not isinstance(orig_data, list)
            or not orig_data
            or not all(isinstance(name, str) and name.strip() for name in orig_data)
        ):
            raise ValueError("feature_order.json must contain a non-empty list of original_features")
        feature_order = tuple(orig_data)
        fft_names_data = feature_order_data.get("fft_features", [])
        if isinstance(fft_names_data, list):
            fft_feature_names = tuple(fft_names_data)
        model_order_data = feature_order_data.get("model_feature_order")
        if isinstance(model_order_data, list):
            model_feature_order = tuple(model_order_data)
    elif isinstance(feature_order_data, list):
        if (
            not feature_order_data
            or not all(isinstance(name, str) and name.strip() for name in feature_order_data)
        ):
            raise ValueError("feature_order.json must be a non-empty list of feature-name strings")
        feature_order = tuple(feature_order_data)
    else:
        raise ValueError("feature_order.json must be a non-empty list or object with feature names")

    if len(set(feature_order)) != len(feature_order):
        raise ValueError("feature_order.json contains duplicate feature names")

    display_only_names = {
        "label",
        "row_id",
        "flow id",
        "source",
        "source ip",
        "src ip",
        "destination",
        "destination ip",
        "dest ip",
        "dst ip",
        "timestamp",
    }
    display_only_features = [
        name for name in feature_order if name.strip().casefold() in display_only_names
    ]
    if display_only_features:
        raise ValueError(
            "feature_order.json contains target, identifier, or display-only fields: "
            f"{display_only_features}"
        )

    scaler_mean: tuple[float, ...] | None = None
    scaler_scale: tuple[float, ...] | None = None
    scaler_path = directory / "scaler.json"
    if scaler_path.is_file():
        scaler_data = _read_json(scaler_path)
        if not isinstance(scaler_data, dict):
            raise ValueError("scaler.json must contain a JSON object with mean and scale arrays")
        scaler_mean = _finite_number_list(scaler_data.get("mean"), "mean", len(feature_order))
        scaler_scale = _finite_number_list(scaler_data.get("scale"), "scale", len(feature_order))
        if any(scale <= 0 for scale in scaler_scale):
            raise ValueError("scaler.json field 'scale' must contain only values greater than zero")
    elif model_name == "model_b":
        raise ValueError(f"Model bundle at {directory} is missing required file(s): scaler.json")

    label_map_data = _read_json(directory / "label_map.json")
    if not isinstance(label_map_data, dict) or not label_map_data:
        raise ValueError("label_map.json must be a non-empty object mapping class indexes to labels")

    if "id_to_label" in label_map_data and isinstance(label_map_data["id_to_label"], dict):
        mapping = label_map_data["id_to_label"]
    else:
        mapping = label_map_data

    try:
        indexed_labels = sorted((int(index), str(label)) for index, label in mapping.items())
    except (TypeError, ValueError) as exc:
        raise ValueError("label_map.json keys must be integer class indexes") from exc
    if [index for index, _ in indexed_labels] != list(range(len(indexed_labels))):
        raise ValueError("label_map.json class indexes must be contiguous starting at zero")
    class_labels = tuple(label for _, label in indexed_labels)
    if any(not label.strip() for label in class_labels) or len(set(class_labels)) != len(class_labels):
        raise ValueError("label_map.json labels must be non-empty and unique")

    metrics_path = directory / "metrics.json"
    if metrics_path.is_file():
        metrics = _read_json(metrics_path)
        if not isinstance(metrics, dict):
            raise ValueError("metrics.json must contain a JSON object")
    else:
        metrics = {}

    fft_method: str | None = None
    fft_k: int = 0
    config_path = directory / "config.json"
    if config_path.is_file():
        config_data = _read_json(config_path)
        if not isinstance(config_data, dict):
            raise ValueError("config.json must contain a JSON object")

        if "selected_K" in config_data:
            fft_k_candidate = config_data["selected_K"]
        elif "fft" in config_data and isinstance(config_data["fft"], dict) and "k" in config_data["fft"]:
            fft_k_candidate = config_data["fft"]["k"]
        elif model_name == "model_b":
            raise ValueError("config.json must contain an 'fft' object with 'k' or 'selected_K'")
        else:
            fft_k_candidate = 0

        if "fft_method" in config_data:
            fft_method_candidate = config_data["fft_method"]
        elif "fft" in config_data and isinstance(config_data["fft"], dict) and "method" in config_data["fft"]:
            fft_method_candidate = config_data["fft"]["method"]
        elif model_name == "model_b":
            raise ValueError("config.json must contain an 'fft' object with 'method' or 'fft_method'")
        else:
            fft_method_candidate = None

        if model_name == "model_b":
            if fft_method_candidate not in {"scipy.fft.rfft", "rfft_magnitude", "rfft"}:
                raise ValueError(
                    "config.json fft.method must be 'scipy.fft.rfft' or 'rfft_magnitude'; "
                    f"got {fft_method_candidate!r}"
                )
            if (
                isinstance(fft_k_candidate, bool)
                or not isinstance(fft_k_candidate, int)
                or fft_k_candidate <= 0
            ):
                raise ValueError("config.json fft.k must be a positive integer")
            # When excluding DC coefficient, maximum bins from rfft is len(feature_order) // 2
            max_bins = len(feature_order) // 2
            if fft_k_candidate > max_bins:
                raise ValueError(
                    "config.json fft.k exceeds the rfft output length for the configured feature vector: "
                    f"k={fft_k_candidate}, maximum={max_bins}"
                )
            fft_method = fft_method_candidate
            fft_k = fft_k_candidate
    elif model_name == "model_b":
        raise ValueError(f"Model bundle at {directory} is missing required file(s): config.json")

    if not fft_feature_names and fft_k > 0:
        fft_feature_names = tuple(f"FFT_MAG_BIN_{i+1}" for i in range(fft_k))
    if not model_feature_order:
        model_feature_order = tuple(list(feature_order) + list(fft_feature_names))

    model_path = directory / f"{model_name}.json"
    estimator = XGBClassifier()
    try:
        estimator.load_model(model_path)
    except Exception as exc:
        raise ValueError(f"Could not load {model_path.name} as an XGBoost model: {exc}") from exc

    expected_features = len(feature_order) + (fft_k if model_name == "model_b" else 0)
    actual_features = estimator.get_booster().num_features()
    if actual_features != expected_features:
        raise ValueError(
            f"{model_path.name} expects {actual_features} features; bundle configuration requires "
            f"{expected_features} for {model_name}"
        )

    return ModelBundle(
        model_name=model_name,
        estimator=estimator,
        feature_order=feature_order,
        scaler_mean=scaler_mean,
        scaler_scale=scaler_scale,
        class_labels=class_labels,
        metrics=metrics,
        fft_method=fft_method,
        fft_k=fft_k,
        model_feature_order=model_feature_order,
        fft_feature_names=fft_feature_names,
    )