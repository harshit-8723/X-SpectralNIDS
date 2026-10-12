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
    """Select ordered model features: raw unscaled for Model A, raw unscaled + K FFT magnitudes for Model B.

    Model input = RAW unscaled features in feature_order.
    Model A never uses scaler or FFT.
    Model B computes rfft of the standardized vector (scaler.json), drops the DC coefficient,
    and appends the first K magnitudes in the order of Model B's feature_order.
    This is a feature-vector FFT across standardized feature columns, not a time spectrum;
    no periodicity claims follow from this transform.
    """
    if not isinstance(features_df, pd.DataFrame):
        raise TypeError("features_df must be a pandas DataFrame")
    missing = [name for name in bundle.feature_order if name not in features_df.columns]
    if missing:
        raise ValueError(f"Input feature batch is missing required columns: {missing}")
    if features_df.empty:
        output_columns = (
            list(bundle.model_feature_order)
            if bundle.model_feature_order
            else list(bundle.feature_order)
        )
        return pd.DataFrame(columns=output_columns, index=features_df.index, dtype=float)

    try:
        ordered = features_df.loc[:, bundle.feature_order].to_numpy(dtype=np.float64, copy=True)
    except (TypeError, ValueError) as exc:
        raise ValueError("Model input features must be numeric") from exc
    if not np.isfinite(ordered).all():
        raise ValueError("Model input features contain missing or non-finite values")

    if bundle.model_name == "model_a":
        # INTEGRATION POINT: Model A takes raw unscaled features in feature_order directly.
        # It never uses scaler or FFT.
        return pd.DataFrame(ordered, columns=bundle.feature_order, index=features_df.index)

    if bundle.model_name == "model_b":
        if bundle.scaler_mean is None or bundle.scaler_scale is None:
            raise ValueError("Model B requires scaler.json with mean and scale arrays")
        if bundle.fft_method not in {"scipy.fft.rfft", "rfft_magnitude", "rfft"}:
            raise ValueError(f"Unsupported feature-vector FFT method: {bundle.fft_method!r}")

        # Standardize feature vector per row for FFT feature calculation only
        standardized = (ordered - np.asarray(bundle.scaler_mean)) / np.asarray(bundle.scaler_scale)
        if not np.isfinite(standardized).all():
            raise ValueError("Standardized model features contain non-finite values")

        # INTEGRATION POINT: Feature-vector FFT across standardized feature columns per row.
        # DC coefficient (bin 0) is excluded; first K magnitudes (bins 1 to K) are appended
        # to the raw unscaled features.
        fft_coeffs = rfft(standardized, axis=1)
        magnitudes = np.abs(fft_coeffs)
        k_magnitudes = magnitudes[:, 1 : 1 + bundle.fft_k]

        combined = np.hstack([ordered, k_magnitudes])
        output_columns = (
            list(bundle.model_feature_order)
            if bundle.model_feature_order
            else list(bundle.feature_order) + list(bundle.fft_feature_names)
        )
        return pd.DataFrame(combined, columns=output_columns, index=features_df.index)

    raise ValueError(f"Unsupported model name: {bundle.model_name!r}")