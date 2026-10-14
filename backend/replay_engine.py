"""Bounded batch replay and prediction for the X-SpectralNIDS backend.

The engine consumes at most ROWS_PER_TICK rows at a time. It has no producer
queue: if inference or explanation work takes longer than TICK_SECONDS, that
tick is emitted with lagging=true and the next tick starts only after the
current one completes. This deliberately favors bounded memory and explicit
latency over pretending the replay kept up with its requested cadence.
"""

from __future__ import annotations

import asyncio
import math
import time
import uuid
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Awaitable, Callable

import pandas as pd

from config import BACKEND_DIR, BackendConfig
from dummy_pipeline import generate_explanations_stub
from feature_pipeline import transform_features
from latency_logger import log_latency
from model_adapter import ModelAdapter, create_model_adapter
from model_bundle import ModelBundle


DISPLAY_ONLY_COLUMNS = {
    "label", "row_id", "flow id", "source", "source ip", "src ip",
    "destination", "destination ip", "dest ip", "dst ip", "timestamp",
}
METADATA_FIELD_NAMES = {
    "source": ("source", "source ip", "src ip", "src_ip"),
    "destination": ("destination", "destination ip", "dest ip", "dst_ip"),
    "protocol": ("protocol",),
}


def _finite_number(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _find_value(row: pd.Series, candidates: tuple[str, ...]) -> object | None:
    by_normalized_name = {str(name).strip().casefold(): name for name in row.index}
    for candidate in candidates:
        column = by_normalized_name.get(candidate.casefold())
        if column is not None:
            value = row[column]
            if not pd.isna(value):
                return value
    return None


def _display_text(value: object | None) -> str:
    if value is None:
        return "unavailable"
    text = str(value).strip()
    return text if text else "unavailable"


class ReplayEngine:
    """Read bounded CSV batches, predict, explain alerts, and broadcast ticks."""

    def __init__(
        self,
        broadcast_fn: Callable[[dict], Awaitable[None]],
        config: BackendConfig | None = None,
        adapter: ModelAdapter | None = None,
        bundle: ModelBundle | None = None,
    ):
        self.config = config or BackendConfig.from_env()
        self.bundle = bundle
        self.adapter = adapter or create_model_adapter(self.config, bundle)
        self._broadcast_fn = broadcast_fn
        self._task: asyncio.Task | None = None
        self._running = False
        self._file: Path | None = None
        self._cycle = True
        self._reader = None
        self._metadata: dict[str, dict] = {}
        self._row_index = 0
        self._tick_index = 0
        self._last_error: str | None = None
        self._run_id: str | None = None
        self._tick_seconds = self.config.tick_seconds

    @property
    def status(self) -> dict:
        return {
            "running": self._running,
            "file": str(self._file) if self._file else str(self.config.replay_csv),
            "model_name": self.config.model_name,
            "rows_per_tick": self.config.rows_per_tick,
            "tick_seconds": self._tick_seconds,
            "ticks_emitted": self._tick_index,
            "rows_emitted": self._row_index,
            "last_error": self._last_error,
        }

    async def start(
        self,
        file: str | Path | None = None,
        pace: float | None = None,
        cycle: bool = True,
    ) -> None:
        """Start configured replay; legacy file/pace args remain temporarily accepted."""
        if self._running:
            return

        path = Path(file).expanduser() if file is not None else self.config.replay_csv
        if not path.is_absolute():
            path = BACKEND_DIR / path
        path = path.resolve()
        if not path.is_file():
            raise FileNotFoundError(f"Replay CSV does not exist: {path}")
        if pd.read_csv(path, nrows=1, skipinitialspace=True).empty:
            raise ValueError(f"Replay CSV contains no rows: {path}")

        # `pace` is retained only while the old REST endpoint is present; the
        # configured endpoint will use TICK_SECONDS directly.
        if pace is not None:
            if pace <= 0:
                raise ValueError("Replay pace must be greater than zero")
            self._tick_seconds = self.config.rows_per_tick / pace
        else:
            self._tick_seconds = self.config.tick_seconds

        self._file = path
        self._cycle = cycle
        self._row_index = 0
        self._tick_index = 0
        self._run_id = uuid.uuid4().hex
        self._last_error = None
        self._metadata = self._load_metadata(path)
        self._reader = self._open_reader(path)
        self._running = True
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        self._running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    def _open_reader(self, path: Path):
        return pd.read_csv(
            path,
            chunksize=self.config.rows_per_tick,
            low_memory=False,
            skipinitialspace=True,
        )

    def _load_metadata(self, replay_path: Path) -> dict[str, dict]:
        candidates = [replay_path.with_name(f"{replay_path.stem}_metadata.csv")]
        shared_metadata = replay_path.with_name("metadata.csv")
        if shared_metadata != replay_path:
            candidates.append(shared_metadata)
        existing = list(dict.fromkeys(path for path in candidates if path.is_file()))
        if len(existing) > 1:
            raise ValueError(
                "More than one replay metadata sidecar exists; keep only one of: "
                f"{existing[0].name}, {existing[1].name}"
            )
        if not existing:
            return {}

        metadata_path = existing[0]
        metadata_frame = pd.read_csv(metadata_path, low_memory=False)
        if "row_id" not in metadata_frame.columns:
            warnings.warn(
                f"Ignoring {metadata_path.name}: metadata sidecar has no row_id column",
                RuntimeWarning,
            )
            return {}
        if metadata_frame["row_id"].duplicated().any():
            raise ValueError(f"Metadata sidecar {metadata_path.name} has duplicate row_id values")

        # Retain only display metadata. Never concatenate it into model features.
        display_columns = [
            name
            for name in metadata_frame.columns
            if str(name).strip().casefold()
            in {
                "row_id", "source", "source ip", "src ip", "src_ip",
                "destination", "destination ip", "dest ip", "dst_ip", "protocol",
            }
        ]
        display_frame = metadata_frame[display_columns]
        return {str(row["row_id"]): row.to_dict() for _, row in display_frame.iterrows()}

    def _next_batch(self) -> pd.DataFrame | None:
        while True:
            try:
                batch = next(self._reader)
            except StopIteration:
                if not self._cycle:
                    return None
                self._reader.close()
                self._reader = self._open_reader(self._file)
                try:
                    batch = next(self._reader)
                except StopIteration as exc:
                    raise ValueError(f"Replay CSV contains no rows: {self._file}") from exc
            batch.columns = batch.columns.map(lambda name: str(name).strip())
            if not batch.empty:
                return batch

    def _feature_frame(self, batch: pd.DataFrame) -> pd.DataFrame:
        if self.config.model_name == "dummy":
            ignored = [
                name for name in batch.columns
                if str(name).strip().casefold() in DISPLAY_ONLY_COLUMNS
            ]
            numeric = batch.drop(columns=ignored, errors="ignore").select_dtypes(include="number")
            if numeric.empty:
                raise ValueError("Replay CSV has no numeric model features for dummy inference")
            return numeric
        if self.bundle is None:
            raise ValueError(f"MODEL_NAME={self.config.model_name!r} has no loaded model bundle")
        return transform_features(batch, self.bundle)

    def _metadata_for(self, row: pd.Series) -> dict:
        row_id = _find_value(row, ("row_id",))
        return {} if row_id is None else self._metadata.get(str(row_id), {})

    def _frequency_for(self, row: pd.Series) -> list[dict]:
        frequency = []
        for column, value in row.items():
            col_name = str(column)
            if col_name.startswith("FFT_MAG_BIN_"):
                prefix = "FFT_MAG_BIN_"
            elif col_name.startswith("fft_magnitude_"):
                prefix = "fft_magnitude_"
            else:
                continue
            magnitude = _finite_number(value)
            if magnitude is None:
                continue
            try:
                bin_index = int(col_name.removeprefix(prefix))
            except ValueError:
                continue
            frequency.append(
                {
                    "bin": bin_index,
                    # Dimensionless feature-vector FFT bin index, not Hz.
                    "frequency": float(bin_index),
                    "magnitude": magnitude,
                }
            )
        return frequency

    def _build_message(
        self,
        batch: pd.DataFrame,
        transformed: pd.DataFrame,
        labels: list[str],
        probabilities: list[list[float]],
        latency: dict[str, float],
        emitted_at: str,
    ) -> dict:
        prediction_rows = []
        benign_count = 0
        benign_label = next(
            (l for l in self.adapter.class_labels if l.strip().casefold() == "benign"),
            "BENIGN",
        )
        alert_rows = []
        for offset, (label, probability_row) in enumerate(zip(labels, probabilities)):
            # INTEGRATION POINT: An alert is any predicted label != benign label from label_map
            is_benign = (label == benign_label) or (label.strip().casefold() == "benign")
            confidence = max(probability_row) if probability_row else 0.0
            row_index = self._row_index + offset
            prediction_rows.append(
                {
                    "row_index": row_index,
                    "label": label,
                    "prediction": "normal" if is_benign else "attack",
                    "confidence": float(confidence),
                    "probabilities": {
                        class_label: float(value)
                        for class_label, value in zip(self.adapter.class_labels, probability_row)
                    },
                }
            )
            if is_benign:
                benign_count += 1
            else:
                alert_rows.append((offset, row_index, label, confidence))

        explanations = []
        for offset, row_index, label, confidence in alert_rows:
            stub = generate_explanations_stub(
                transformed.iloc[offset].to_dict(),
                {"predicted_label": label, "confidence": float(confidence)},
            )
            explanations.append(
                {
                    "row_index": row_index,
                    "label": label,
                    "raw": {"values": stub["raw_shap"], "is_stub": True},
                    "zone": {"values": stub["zone_shap"], "is_stub": True},
                }
            )

        last_input = batch.iloc[-1]
        last_metadata = self._metadata_for(last_input)
        last_label = labels[-1]
        last_probabilities = probabilities[-1]
        last_confidence = max(last_probabilities) if last_probabilities else 0.0
        last_output = transformed.iloc[-1]

        def input_value(candidates: tuple[str, ...], divisor: float = 1.0):
            value = _finite_number(_find_value(last_input, candidates))
            return None if value is None else value / divisor

        fwd_packets = input_value(("Total Fwd Packets", "total_fwd_packets"))
        bwd_packets = input_value(("Total Backward Packets", "total_backward_packets"))
        packet_count = (
            None if fwd_packets is None or bwd_packets is None
            else int(fwd_packets + bwd_packets)
        )
        duration_ms = input_value(("Flow Duration", "flow_duration"), divisor=1000.0)
        iat_mean_ms = input_value(("Flow IAT Mean", "flow_iat_mean"), divisor=1000.0)
        iat_std_ms = input_value(("Flow IAT Std", "flow_iat_std"), divisor=1000.0)

        byte_rate_column = next(
            (name for name in batch.columns if name.strip().casefold() == "flow bytes/s"), None
        )
        byte_rates = [] if byte_rate_column is None else [
            number for number in (_finite_number(value) for value in batch[byte_rate_column])
            if number is not None
        ]
        throughput_mbps = (
            sum(byte_rates) / len(byte_rates) / 1_000_000.0 if byte_rates else None
        )
        traffic = {
            "timestamp": emitted_at,
            "normal": benign_count,
            "suspicious": len(labels) - benign_count,
            "throughputMbps": throughput_mbps,
        }

        protocol = _find_value(last_input, ("Protocol", "protocol"))
        if protocol is None:
            protocol = _find_value(pd.Series(last_metadata), METADATA_FIELD_NAMES["protocol"])
        source = _find_value(pd.Series(last_metadata), METADATA_FIELD_NAMES["source"])
        destination = _find_value(pd.Series(last_metadata), METADATA_FIELD_NAMES["destination"])
        window = {
            "source": _display_text(source),
            "destination": _display_text(destination),
            "protocol": _display_text(protocol),
            "packets": packet_count,
            "durationMs": duration_ms,
            "interArrivalMeanMs": iat_mean_ms,
            "interArrivalStdMs": iat_std_ms,
            "prediction": "normal" if ((last_label == benign_label) or (last_label.strip().casefold() == "benign")) else "attack",
            "confidence": float(last_confidence),
        }

        detection = None
        if alert_rows:
            offset, row_index, label, confidence = alert_rows[-1]
            alert_input = batch.iloc[offset]
            alert_metadata = self._metadata_for(alert_input)
            alert_protocol = _find_value(alert_input, ("Protocol", "protocol"))
            if alert_protocol is None:
                alert_protocol = _find_value(
                    pd.Series(alert_metadata), METADATA_FIELD_NAMES["protocol"]
                )
            port = _finite_number(
                _find_value(alert_input, ("Destination Port", "destination_port", "port"))
            )
            row_id = _find_value(alert_input, ("row_id",))
            detection = {
                "id": f"{self._run_id}:{row_id if row_id is not None else f'row-{row_index}'}",
                "timestamp": emitted_at,
                "source": _display_text(
                    _find_value(pd.Series(alert_metadata), METADATA_FIELD_NAMES["source"])
                ),
                "destination": _display_text(
                    _find_value(pd.Series(alert_metadata), METADATA_FIELD_NAMES["destination"])
                ),
                "protocol": _display_text(alert_protocol),
                "port": None if port is None else int(port),
                "attackType": label,
                "prediction": "attack",
                "confidence": float(confidence),
                "severity": None,
                "explanationAvailable": True,
            }

        message = {
            "type": "traffic_update",
            "timestamp": emitted_at,
            "traffic": traffic,
            "window": window,
            "frequency": self._frequency_for(last_output),
            "meta": {"model_name": self.config.model_name, "is_dummy": self.adapter.is_dummy},
            "predictions": prediction_rows,
            "explanations": explanations,
            "latency": latency,
            "lagging": False,
        }
        if detection is not None:
            message["detection"] = detection
        return message

    async def _run_loop(self) -> None:
        try:
            while self._running:
                tick_started = time.perf_counter()
                batch = self._next_batch()
                if batch is None:
                    break

                feature_started = time.perf_counter()
                transformed = self._feature_frame(batch)
                feature_elapsed = time.perf_counter() - feature_started

                inference_started = time.perf_counter()
                labels, probabilities = self.adapter.predict_batch(transformed)
                inference_elapsed = time.perf_counter() - inference_started
                if len(labels) != len(batch) or len(probabilities) != len(batch):
                    raise ValueError("Model adapter did not return one prediction per input row")

                emitted_at = datetime.now(timezone.utc).isoformat()
                latency = {
                    "feature_extraction_ms": round(feature_elapsed * 1000.0, 3),
                    "inference_ms": round(inference_elapsed * 1000.0, 3),
                    "explanation_ms": 0.0,
                    "total_ms": 0.0,
                }
                explanation_started = time.perf_counter()
                message = self._build_message(
                    batch, transformed, labels, probabilities, latency, emitted_at
                )
                explanation_elapsed = time.perf_counter() - explanation_started
                total_elapsed = time.perf_counter() - tick_started
                lagging = total_elapsed > self._tick_seconds
                latency["explanation_ms"] = round(explanation_elapsed * 1000.0, 3)
                latency["total_ms"] = round(total_elapsed * 1000.0, 3)
                message["latency"] = latency
                message["lagging"] = lagging

                await self._broadcast_fn(message)
                log_latency(self._tick_index, latency, self.config.model_name, lagging)
                self._tick_index += 1
                self._row_index += len(batch)

                if not lagging:
                    remaining = self._tick_seconds - (time.perf_counter() - tick_started)
                    if remaining > 0:
                        await asyncio.sleep(remaining)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            self._last_error = str(exc)
        finally:
            self._running = False
            if self._reader is not None:
                self._reader.close()
                self._reader = None
