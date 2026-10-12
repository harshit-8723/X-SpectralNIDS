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

Keep the exported model bundle on the local machine; never commit model
weights, dataset rows, logs, `.env` files, or virtual environments. Copy the
bundle contents into `backend/models/` and check that the directory contains
`model_a.json`, `model_b.json`, `feature_order.json`, `scaler.json`,
`label_map.json`, `metrics.json`, and `config.json`. Model B's `config.json`
must include the training-time `fft.method` and `fft.k`; do not substitute
guessed values.

From the repository root, configure and restart the backend with the model that
was actually trained:

```bash
cd backend
source venv/bin/activate
export MODEL_NAME=model_b
export MODEL_DIR="$PWD/models"
export REPLAY_CSV="$PWD/sample.csv"
export ROWS_PER_TICK=10
export TICK_SECONDS=1.0
export FRONTEND_ORIGINS=http://localhost:5173
uvicorn main:app --reload --port 8000
```

For Model A, set `MODEL_NAME=model_a`. To check that startup loaded the chosen
bundle, request:

```bash
curl http://localhost:8000/api/health
```

The returned `modelVersion` must match the selected model name. Then check the
dashboard's monitoring page and confirm that the WebSocket remains connected.
For Model B, the plotted values are feature-vector FFT bins, not temporal
frequencies; this integration makes no periodicity claim.

To verify a bundle's predictions against reference data, place
`sample_rows.csv` and `expected_outputs.json` beside the bundle files in
`backend/models/`. The JSON must include `model_name`, `labels`, and
`probabilities` produced and verified from that exact trained bundle. Run the
parity test from the repository root:

```bash
backend/venv/bin/python -m pytest -q backend/tests/test_bundle_parity.py
```

The test is skipped until both reference files exist. Do not use the tiny
synthetic fixture created for the plug-in dry run as a model result, baseline,
or paper evidence; it only checks loading and dashboard compatibility.

## Frontend changes needed

The frontend was inspected but not edited. Its current `MonitoringMessage` type
does not include the required `meta`, `predictions`, `explanations`, `latency`,
or `lagging` fields. Before rendering these fields, update the frontend types
and monitoring view to accept them.

Also update the frontend contract to:

- Allow `null` for unavailable traffic/window numeric values and detection `severity`.
- Update `SeverityBadge` to handle a null/unavailable severity; the current component assumes one of four known severities and throws at runtime when given `null`.
- Treat source/destination `unavailable` as a valid display string; do not infer IPs from a feature row.
- Display Model B coordinates as feature-vector FFT bin indexes, not Hz. Model A and dummy messages may contain an empty `frequency` array.
- Distinguish `is_stub: true` explanations and dummy predictions from real model output.
- Keep `VITE_WS_BASE_URL=ws://localhost:8000/ws/monitoring` (or the deployment equivalent).
- Set `VITE_API_BASE_URL=http://localhost:8000/api` when the health endpoint should be fetched from this backend; the frontend's default `/api` is same-origin and the current Vite config has no backend proxy.
- The current `VITE_USE_REAL_API` switch applies to all REST services. Enabling it globally will call routes this backend does not yet implement; the frontend needs per-service real/mock selection or a health-only integration mode.
- Do not enable `VITE_USE_REAL_API=true` for every frontend page until the additional REST endpoints used by analytics, detections, alerts, and reports are implemented. This backend currently implements the health and replay endpoints plus the monitoring WebSocket.
- Treat the frontend's REST mock snapshots as mock data. In the current branch they can remain visible even while the WebSocket is connected, and must not be presented as backend model results.
- Use a stable tick/detection key that remains unique across replay restarts; backend detection IDs now include a replay-run identifier.

## Local checks

From the repository root, run the backend with its project venv:

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

In another terminal, run `python test_client.py`. The server logs a connection
when a WebSocket client connects. The automated API and WebSocket tests are in
`backend/tests/`.