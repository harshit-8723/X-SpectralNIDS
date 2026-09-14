"""
Dummy pipeline stubs for X-SpectralNIDS.

Each function here fakes one stage of the real pipeline (feature extraction,
XGBoost inference, SHAP explanation). They're kept as SEPARATE, clearly named
functions so that later you can replace each one individually with the real
implementation without touching main.py / replay_engine.py at all — as long
as the return shape stays the same, nothing else needs to change.

Replace these three functions when ready:
  - extract_features_stub   -> real FFT + time-domain feature extraction
  - run_inference_stub      -> real XGBoost model.predict / predict_proba
  - generate_explanations_stub -> real TreeSHAP + Zone-Grouped SHAP
"""

import random
import time

ATTACK_LABELS = ["Benign", "DDoS", "PortScan", "Bot", "DoS Slowloris"]

# Fake frequency bins (stand-in for real FFT bin IDs later)
FAKE_BIN_IDS = [f"bin_{i}" for i in range(10)]

# Fake semantic zones (stand-in for your Zone-Grouped SHAP bands later)
FAKE_ZONES = [
    "0-5s_burst",
    "5-15s_periodic",
    "30-60s_heartbeat",
    "60-120s_idle",
    "120s+_noise",
]


def extract_features_stub(row: dict) -> dict:
    """
    Fakes: reading raw flow stats + running scipy.fft on packet IATs.
    Real version will take a raw flow row and return {time_domain_features, freq_domain_features}.
    """
    time.sleep(random.uniform(0.001, 0.004))  # simulate FFT + feature compute cost
    return {
        "time_domain": {k: v for k, v in row.items() if k != "Label"},
        "freq_domain": {b: round(random.uniform(-1, 1), 4) for b in FAKE_BIN_IDS},
    }


def run_inference_stub(features: dict) -> dict:
    """
    Fakes: XGBoost classifier prediction.
    Real version will call model.predict_proba(feature_vector).
    """
    time.sleep(random.uniform(0.001, 0.003))  # simulate model inference cost
    label = random.choice(ATTACK_LABELS)
    confidence = round(random.uniform(0.55, 0.99), 4)
    return {"predicted_label": label, "confidence": confidence}


def generate_explanations_stub(features: dict, prediction: dict) -> dict:
    """
    Fakes: TreeSHAP per-bin explanation + Zone-Grouped SHAP explanation.
    Real version will call shap.TreeExplainer(model).shap_values(...) and
    your zone-grouping aggregation on top of it.
    """
    time.sleep(random.uniform(0.002, 0.006))  # simulate SHAP compute cost (usually the slowest stage)
    raw_shap = {b: round(random.uniform(-0.5, 0.5), 4) for b in FAKE_BIN_IDS}
    zone_shap = {z: round(random.uniform(-0.5, 0.5), 4) for z in FAKE_ZONES}
    return {"raw_shap": raw_shap, "zone_shap": zone_shap}


def get_dummy_prediction(row: dict) -> dict:
    """
    Convenience wrapper that runs all three stages and returns everything,
    INCLUDING a per-stage latency breakdown (ms). This is what replay_engine
    calls today. When the real pipeline is ready, you can either:
      (a) keep this wrapper and swap the three stub calls for real ones, or
      (b) call the three real functions directly from replay_engine.py.
    Either way nothing about the WebSocket message shape needs to change.
    """
    t0 = time.perf_counter()
    features = extract_features_stub(row)
    t1 = time.perf_counter()

    prediction = run_inference_stub(features)
    t2 = time.perf_counter()

    explanations = generate_explanations_stub(features, prediction)
    t3 = time.perf_counter()

    latency_ms = {
        "feature_extraction_ms": round((t1 - t0) * 1000, 3),
        "inference_ms": round((t2 - t1) * 1000, 3),
        "explanation_ms": round((t3 - t2) * 1000, 3),
        "total_ms": round((t3 - t0) * 1000, 3),
    }

    return {
        "predicted_label": prediction["predicted_label"],
        "confidence": prediction["confidence"],
        "raw_shap": explanations["raw_shap"],
        "zone_shap": explanations["zone_shap"],
        "latency_ms": latency_ms,
    }
