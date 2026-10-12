# Backend API

This document describes the current replay backend contract. A tick is one
bounded group of `ROWS_PER_TICK` rows, not one live packet. Predictions from the
dummy adapter are randomized placeholders and are not research results. Raw and
zone explanations are stubs and are marked as such in every alert explanation.

## Configuration

The backend reads these environment variables at startup:

| Variable | Default | Meaning |
| --- | --- | --- |
| `MODEL_NAME` | `dummy` | Select `dummy`, `model_a`, or `model_b`. |
| `MODEL_DIR` | `backend/models/` | Directory containing the model bundle. |
| `REPLAY_CSV` | `backend/sample.csv` | CSV read by the bounded replay engine. |
| `ROWS_PER_TICK` | `10` | Maximum input rows in one tick. |
| `TICK_SECONDS` | `1.0` | Minimum cadence between ticks when the previous tick finishes on time. |
| `FRONTEND_ORIGINS` | `http://localhost:5173` | Comma-separated browser origins allowed by HTTP CORS and the WebSocket origin check. |

For a real model, `MODEL_DIR` must contain all of the following files. The model
weights are local artifacts and must not be committed:

- `model_a.json` and `model_b.json`: XGBoost model JSON files.
- `feature_order.json`: a non-empty JSON list of feature column names in the exact training order.
- `scaler.json`: `{"mean": [number, ...], "scale": [positive number, ...]}` with one value per feature.
- `label_map.json`: an object mapping contiguous class indexes to labels, for example `{"0": "BENIGN", "1": "..."}`. The actual attack labels must come from the trained model's data, not this example.
- `metrics.json`: a JSON object retained as bundle metadata; the server does not infer or invent metrics from it.
- `config.json`: must include the selected feature-vector FFT transform as shown below. There is no fallback K or method.

```json
{
  "fft": {
    "method": "rfft_magnitude",
    "k": 8
  }
}
```

`k` must be a positive integer no larger than the `rfft` output length for the
feature vector. Model A uses standardized ordered features. Model B appends the
first `k` magnitudes computed with the configured method.

**Feature-vector FFT, not a packet/flow-time spectrum; no periodicity claims.**
The transform runs across each standardized row's ordered feature columns. It
does not operate on packet arrival times or flow start times, and its bin
coordinate is dimensionless rather than a physical frequency in Hz.

## HTTP endpoints

| Method and path | Behavior |
| --- | --- |
| `GET /health` | Returns backend/system status. |
| `GET /api/health` | Alias matching the frontend's default `API_BASE_URL` plus `/health`. |
| `POST /replay/start` | Starts configured replay. Optional `cycle` controls replay looping. Optional legacy `file`/`pace` fields are retained for old local callers. |
| `POST /replay/stop` | Stops replay. |
| `GET /replay/status` | Returns current replay status. |

Both health paths return the frontend `SystemStatus` shape:

```json
{
  "backendConnected": true,
  "websocketConnected": false,
  "streaming": false,
  "modelVersion": "dummy",
  "apiUrl": "http://localhost:8000/api",
  "wsUrl": "ws://localhost:8000/ws/monitoring"
}
```

Status values describe the running service. `modelVersion` is the selected model
name, not a version or quality claim.

## WebSocket

The current frontend URL is `ws://localhost:8000/ws/monitoring`. `/ws` remains
available as a compatibility alias. The backend sends one JSON object per tick.
WebSocket origins are checked against `FRONTEND_ORIGINS`; clients without an
`Origin` header, such as the command-line test client, are accepted.

### Message fields

| Field | Type | Meaning |
| --- | --- | --- |
| `type` | string | Always `traffic_update`, matching `MonitoringMessage`. |
| `timestamp` | string | UTC time when this tick message was created; it is not a timestamp read from the CSV. |
| `traffic` | object | `timestamp`, `normal`, `suspicious`, and `throughputMbps`. Counts are numbers of predicted rows in this tick; throughput is the mean `Flow Bytes/s` divided by 1,000,000, or `null` if that column has no usable values. |
| `window` | object | Summary from the last CSV row in the tick plus its prediction. Missing numeric source fields are `null`; missing text fields are `unavailable`. |
| `frequency` | array | Model B's configured feature-vector FFT bins (`bin`, dimensionless `frequency` bin index, `magnitude`). Empty for Model A and the dummy adapter. These are not Hz. |
| `detection` | object, optional | The last non-BENIGN prediction in the tick. Omitted when the tick has no alert. `id` is unique per replay run. `severity` is `null` because this backend does not derive severity. |
| `meta` | object | `model_name` and `is_dummy`. |
| `predictions` | array | One prediction per row, including `row_index`, mapped `label`, `prediction` (`normal` or `attack`), `confidence`, and class-name-to-probability mapping. |
| `explanations` | array | One item for each alert only. Each item contains a raw and zone explanation; both include `is_stub: true`. |
| `latency` | object | `feature_extraction_ms`, `inference_ms`, `explanation_ms`, and `total_ms`, all milliseconds. |
| `lagging` | boolean | `true` when processing the tick took longer than `TICK_SECONDS`. No tick queue is created. |

Traffic/window values are derived from actual CSV values only:

- `normal` counts predictions whose label from `label_map.json` is `BENIGN` (case-insensitive); `suspicious` counts all other predictions.
- `window.packets` is `Total Fwd Packets + Total Backward Packets` only when both columns are present.
- For CICFlowMeter exports, `Flow Duration`, `Flow IAT Mean`, and `Flow IAT Std` are interpreted as microseconds and converted to milliseconds. The input must use those CICFlowMeter units for these conversions to be valid.
- `window.protocol` uses a real `Protocol` column, then metadata if available; otherwise it is `unavailable`. `detection.port` uses a real destination-port column or is `null`.
- `window.source`, `window.destination`, and the corresponding detection fields come only from a metadata sidecar. Without a matching sidecar row, they are the string `unavailable`.

### JSON example

This is an illustrative dummy-message example showing structure only. Its values
are not measured model output, model quality, or research results.

```json
{
  "type": "traffic_update",
  "timestamp": "2026-10-09T12:00:00+00:00",
  "traffic": {
    "timestamp": "2026-10-09T12:00:00+00:00",
    "normal": 1,
    "suspicious": 1,
    "throughputMbps": 1.0
  },
  "window": {
    "source": "unavailable",
    "destination": "unavailable",
    "protocol": "unavailable",
    "packets": 3,
    "durationMs": 1.0,
    "interArrivalMeanMs": 0.1,
    "interArrivalStdMs": 0.01,
    "prediction": "attack",
    "confidence": 0.8
  },
  "frequency": [],
  "meta": {
    "model_name": "dummy",
    "is_dummy": true
  },
  "predictions": [
    {
      "row_index": 0,
      "label": "Benign",
      "prediction": "normal",
      "confidence": 0.9,
      "probabilities": {"Benign": 0.9, "DDoS": 0.1}
    },
    {
      "row_index": 1,
      "label": "DDoS",
      "prediction": "attack",
      "confidence": 0.8,
      "probabilities": {"Benign": 0.2, "DDoS": 0.8}
    }
  ],
  "explanations": [
    {
      "row_index": 1,
      "label": "DDoS",
      "raw": {"values": {"bin_0": 0.1}, "is_stub": true},
      "zone": {"values": {"30-60s_heartbeat": 0.1}, "is_stub": true}
    }
  ],
  "detection": {
                "id": "run-id:row-1",
    "timestamp": "2026-10-09T12:00:00+00:00",
    "source": "unavailable",
    "destination": "unavailable",
    "protocol": "unavailable",
    "port": null,
    "attackType": "DDoS",
    "prediction": "attack",
    "confidence": 0.8,
    "severity": null,
    "explanationAvailable": true
  },
  "latency": {
    "feature_extraction_ms": 0.0,
    "inference_ms": 0.0,
    "explanation_ms": 0.0,
    "total_ms": 0.0
  },
  "lagging": false
}
```

### Metadata sidecar

When display identifiers are needed, place either `<replay-file-stem>_metadata.csv`
or `metadata.csv` beside `REPLAY_CSV` (not both). It must have a unique `row_id`
column, and the replay CSV must have matching `row_id` values. The join is only
for display; metadata and `row_id` are not passed as model features. Supported
display columns include `source`/`Source IP`, `destination`/`Destination IP`,
and `protocol`. If a matching row or field is absent, the backend sends
`unavailable`.

## Plugging in the real model

Real trained artifacts are located in local directories:
- `backend/models/model_a_deduplicated/`:
  - `model_a.json`: XGBoost model JSON (79 features).
  - `feature_order.json`: JSON list of 79 feature names.
  - `label_map.json`: JSON object mapping class indices to labels (15 classes, `0: "BENIGN"`).
  - `metrics.json`: training and evaluation metrics metadata.
- `backend/models/model_b_deduplicated/`:
  - `model_b.json`: XGBoost model JSON (111 features = 79 unscaled + 32 FFT magnitudes).
  - `feature_order.json`: JSON object containing `original_features` (79), `fft_features` (32: `FFT_MAG_BIN_1`..`FFT_MAG_BIN_32`), and `model_feature_order` (111).
  - `scaler.json`: StandardScaler mean and scale arrays (79 elements, fit on training split only).
  - `config.json`: specifies `selected_K: 32`, `fft_method: "scipy.fft.rfft"`, `fft_dc_coefficient_excluded: true`, and `original_features_kept_unscaled_in_model: true`.
  - `label_map.json`: 15 classes identical to Model A.
  - `sample_test_predictions.csv`: 10 reference rows with 79 raw features + expected and predicted labels.
  - `metrics.json` and `validation_k_scores.json`: metadata.

Never commit model weights, dataset files, `.env` files, or virtual environments to Git.

### Real File Formats and Schemas

1. **`feature_order.json`**:
   - Model A format: A JSON list of 79 feature column names: `["Source Port", "Destination Port", "Protocol", ...]`.
   - Model B format: A JSON dictionary with keys:
     - `original_features`: list of 79 original feature names.
     - `fft_features`: list of 32 names `["FFT_MAG_BIN_1", ..., "FFT_MAG_BIN_32"]`.
     - `model_feature_order`: list of 111 names (original + FFT).
   - Note on Ports and Protocol: `Source Port`, `Destination Port`, and `Protocol` are explicitly included at indices 0, 1, and 2 in the trained feature order.

2. **`scaler.json`**:
   - Dictionary containing `mean` (79 floats), `scale` (79 positive floats), and `input_feature_order` (79 strings).
   - Used **only** to compute row-wise feature-vector FFT magnitudes for Model B. It is never applied to the original features entering the model.

3. **`label_map.json`**:
   - Contains `id_to_label` mapping string integer indices `"0"` through `"14"` to class names, and `label_to_id`.
   - 15 classes total:
     - 0: `BENIGN`
     - 1: `Bot`
     - 2: `DDoS`
     - 3: `DoS GoldenEye`
     - 4: `DoS Hulk`
     - 5: `DoS Slowhttptest`
     - 6: `DoS slowloris`
     - 7: `FTP-Patator`
     - 8: `Heartbleed`
     - 9: `Infiltration`
     - 10: `PortScan`
     - 11: `SSH-Patator`
     - 12: `Web Attack Brute Force`
     - 13: `Web Attack Sql Injection`
     - 14: `Web Attack XSS`
   - Benign label string: exactly `"BENIGN"`. Alerts are triggered whenever predicted label != `"BENIGN"`.

4. **`config.json`**:
   - Defines Model B hyperparameters: `selected_K = 32`, `fft_method = "scipy.fft.rfft"`, `fft_dc_coefficient_excluded = true`.

### Assumptions and Behavioral Contracts

- **Model Inputs are Unscaled**: Both Model A and Model B take raw unscaled features in `feature_order`. Model A never uses a scaler or FFT. Model B standardizes the ordered 79 features exclusively to compute the feature-vector FFT.
- **Feature-Vector FFT (Not Time Spectrum)**: Model B computes `scipy.fft.rfft` across the 79 standardized feature columns per row. The DC coefficient (bin 0) is excluded, and the first K=32 magnitudes (bins 1 to 32) are appended. This is an exploratory feature-vector transformation, **not** a packet arrival or flow-time spectrum; no claims of periodicity or heartbeat detection are made.
- **Model B is Exploratory**: On the teammate's deduplicated test split, Model A achieved higher macro-F1 (0.9449 vs 0.9355). On the replay sample, Model A achieved 0.9925 macro-F1 vs Model B's 0.9875. Model B is explicitly labeled as "exploratory" and is never claimed to be superior to baseline Model A.
- **Replay Sample (`backend/data/replay_sample.csv`)**: 5,018 rows extracted from `data/raw/` across all 8 days, stratified to include all 15 classes (including rare classes Heartbleed: 11, Sql Injection: 21, Infiltration: 36). Labeled: *"sample from raw data, not the teammate's test split"*. Both models achieve >=0.99 accuracy on this sample as expected for un-split evaluation.
- **Explanations**: Raw SHAP and Zone-Grouped SHAP values in the replay stream remain stubs with `is_stub: true`.

### Starting the Backend

From the repository root:

```bash
cd backend
source venv/bin/activate
export MODEL_NAME=model_b
export MODEL_DIR="$PWD/models"
export REPLAY_CSV="$PWD/data/replay_sample.csv"
export ROWS_PER_TICK=10
export TICK_SECONDS=1.0
export FRONTEND_ORIGINS=http://localhost:5173
uvicorn main:app --reload --port 8000
```

Verify backend health:

```bash
curl http://localhost:8000/api/health
```

Run parity and sanity tests:

```bash
backend/venv/bin/python -m pytest -v backend/tests/test_bundle_parity.py
```

## Frontend changes needed

The frontend source code in `frontend/` was inspected but not modified. The following changes/accommodations are noted for frontend integration:

1. **REST API Isolation / Mock Fallback**:
   - `VITE_USE_REAL_API=true` activates real HTTP calls across all frontend services. The backend currently implements `/api/health`, `/health`, `/replay/*`, and `/ws/monitoring`.
   - Pages requiring additional endpoints (`/alerts`, `/analytics`, `/detections`, `/reports`) will encounter 404s if real API mode is enabled globally.
   - **Recommended change**: Implement per-service feature flags or keep mock data active for analytics/alerts while pointing monitoring and health checks to the real backend.
2. **Frequency Coordinate Display**:
   - `SpectrumChart.tsx` currently falls back to displaying `${v} Hz` when `dominantBin` is not explicitly provided.
   - **Recommended change**: Update the tooltip label fallback from `"Hz"` to `"Feature FFT bin index"` or `"Bin ${v}"` to reflect dimensionless feature-vector bins rather than physical frequency.
3. **Network Port Binding**:
   - In sandboxed or restricted developer environments, Vite's dev server should be invoked with `--host 127.0.0.1 --port 5173` to prevent port conflict loops.
4. **WebSocket URL Configuration**:
   - Maintain `VITE_WS_BASE_URL=ws://localhost:8000/ws/monitoring` in `frontend/.env`.

## Local checks

From the repository root, run the test suite:

```bash
backend/venv/bin/python -m pytest -v
```

To run test client against a live server:

```bash
backend/venv/bin/python backend/test_client.py
```