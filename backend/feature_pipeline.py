"""Order, standardize, and optionally transform a flow-feature batch.

Model B's transform is a feature-vector FFT: each standardized row is treated
as an ordered vector of feature values, and the magnitude of the first K
`rfft` bins is appended. This is not a packet-time or flow-time spectrum; no
periodicity claims follow from this transform. Feature ordering comes only from
feature_order.json and K/method come only from config.json in the validated
bundle.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.fft import rfft

from model_bundle import ModelBundle


def transform_features(features_df: pd.DataFrame, bundle: ModelBundle) -> pd.DataFrame:
    """Select ordered model features, standardize them, and apply Model B FFT."""
    if not isinstance(features_df, pd.DataFrame):
        raise TypeError("features_df must be a pandas DataFrame")
    missing = [name for name in bundle.feature_order if name not in features_df.columns]
    if missing:
        raise ValueError(f"Input feature batch is missing required columns: {missing}")
    if features_df.empty:
        output_columns = list(bundle.feature_order)
        if bundle.model_name == "model_b":
            output_columns.extend(f"fft_magnitude_{index}" for index in range(bundle.fft_k))
        return pd.DataFrame(columns=output_columns, index=features_df.index, dtype=float)

    try:
        ordered = features_df.loc[:, bundle.feature_order].to_numpy(dtype=np.float64, copy=True)
    except (TypeError, ValueError) as exc:
        raise ValueError("Model input features must be numeric") from exc
    if not np.isfinite(ordered).all():
        raise ValueError("Model input features contain missing or non-finite values")

    standardized = (ordered - np.asarray(bundle.scaler_mean)) / np.asarray(bundle.scaler_scale)
    if not np.isfinite(standardized).all():
        raise ValueError("Standardized model features contain non-finite values")
    output = pd.DataFrame(standardized, columns=bundle.feature_order, index=features_df.index)

    if bundle.model_name == "model_b":
        if bundle.fft_method != "rfft_magnitude":
            raise ValueError(f"Unsupported feature-vector FFT method: {bundle.fft_method!r}")
        # INTEGRATION POINT: This exact, configured transform is part of Model B's
        # trained feature contract. It operates across feature columns, not time samples.
        magnitudes = np.abs(rfft(standardized, axis=1))[:, : bundle.fft_k]
        for index in range(bundle.fft_k):
            output[f"fft_magnitude_{index}"] = magnitudes[:, index]

    return output