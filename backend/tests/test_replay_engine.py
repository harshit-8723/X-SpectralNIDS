import asyncio
import time

import pandas as pd
import pytest

from config import BackendConfig
from replay_engine import ReplayEngine


class FixedBatchAdapter:
    model_name = "dummy"
    is_dummy = True
    class_labels = ("BENIGN", "TEST_ATTACK")

    def __init__(self, delay=0.0):
        self.delay = delay
        self.received_columns = []

    def predict_batch(self, features_df):
        self.received_columns = list(features_df.columns)
        if self.delay:
            time.sleep(self.delay)
        labels = ["BENIGN", "TEST_ATTACK"][: len(features_df)]
        probabilities = [[0.9, 0.1] if label == "BENIGN" else [0.2, 0.8] for label in labels]
        return labels, probabilities


def _config(csv_path, rows_per_tick=2, tick_seconds=0.1):
    return BackendConfig.from_env(
        {
            "MODEL_NAME": "dummy",
            "REPLAY_CSV": str(csv_path),
            "ROWS_PER_TICK": str(rows_per_tick),
            "TICK_SECONDS": str(tick_seconds),
            "FRONTEND_ORIGINS": "http://localhost:5173",
        }
    )


def _run_one_tick(engine):
    async def run():
        received = []
        event = asyncio.Event()

        async def broadcast(message):
            received.append(message)
            event.set()

        engine._broadcast_fn = broadcast
        await engine.start(cycle=False)
        await asyncio.wait_for(event.wait(), timeout=2)
        await engine.stop()
        return received

    return asyncio.run(run())


def test_emits_one_bounded_batch_and_joins_metadata_only_for_display(
    tmp_path, monkeypatch
):
    csv_path = tmp_path / "flows.csv"
    pd.DataFrame(
        {
            "row_id": ["r1", "r2", "r3"],
            "Flow Duration": [1000, 2000, 3000],
            "Total Fwd Packets": [2, 3, 4],
            "Total Backward Packets": [1, 2, 3],
            "Flow IAT Mean": [100, 200, 300],
            "Flow IAT Std": [10, 20, 30],
            "Flow Bytes/s": [1_000_000, 3_000_000, 5_000_000],
            "Destination Port": [80, 443, 22],
            "Label": ["BENIGN", "ATTACK", "BENIGN"],
        }
    ).to_csv(csv_path, index=False)
    pd.DataFrame(
        {
            "row_id": ["r1", "r2", "r3"],
            "source": ["10.0.0.1", "10.0.0.2", "10.0.0.3"],
            "destination": ["192.0.2.1", "192.0.2.2", "192.0.2.3"],
            "private_note": ["not a feature"] * 3,
        }
    ).to_csv(tmp_path / "flows_metadata.csv", index=False)
    monkeypatch.setattr("replay_engine.log_latency", lambda *args: None)

    adapter = FixedBatchAdapter()
    engine = ReplayEngine(
        broadcast_fn=lambda message: None,
        config=_config(csv_path, rows_per_tick=2),
        adapter=adapter,
    )
    messages = _run_one_tick(engine)
    message = messages[0]

    assert len(message["predictions"]) == 2
    assert [item["row_index"] for item in message["predictions"]] == [0, 1]
    assert "row_id" not in adapter.received_columns
    assert "private_note" not in adapter.received_columns
    assert message["traffic"]["normal"] == 1
    assert message["traffic"]["suspicious"] == 1
    assert message["traffic"]["throughputMbps"] == pytest.approx(2.0)
    assert message["window"]["source"] == "10.0.0.2"
    assert message["window"]["destination"] == "192.0.2.2"
    assert message["window"]["packets"] == 5
    assert message["window"]["durationMs"] == pytest.approx(2.0)
    assert len(message["explanations"]) == 1
    assert message["explanations"][0]["raw"]["is_stub"] is True
    assert message["explanations"][0]["zone"]["is_stub"] is True
    assert message["detection"]["id"] == "r2"


def test_missing_csv_fields_are_reported_as_null_or_unavailable(tmp_path, monkeypatch):
    csv_path = tmp_path / "minimal.csv"
    pd.DataFrame({"Flow Duration": [4], "Label": ["BENIGN"]}).to_csv(
        csv_path, index=False
    )
    monkeypatch.setattr("replay_engine.log_latency", lambda *args: None)
    engine = ReplayEngine(
        broadcast_fn=lambda message: None,
        config=_config(csv_path, rows_per_tick=1),
        adapter=FixedBatchAdapter(),
    )

    message = _run_one_tick(engine)[0]

    assert message["window"]["source"] == "unavailable"
    assert message["window"]["destination"] == "unavailable"
    assert message["window"]["protocol"] == "unavailable"
    assert message["window"]["packets"] is None
    assert message["window"]["durationMs"] == pytest.approx(0.004)
    assert message["window"]["interArrivalMeanMs"] is None
    assert message["traffic"]["throughputMbps"] is None
    assert "detection" not in message


def test_overrun_marks_tick_lagging_without_backlog(tmp_path, monkeypatch):
    csv_path = tmp_path / "slow.csv"
    pd.DataFrame({"feature": [1, 2, 3], "Label": ["BENIGN"] * 3}).to_csv(
        csv_path, index=False
    )
    monkeypatch.setattr("replay_engine.log_latency", lambda *args: None)
    adapter = FixedBatchAdapter(delay=0.02)
    engine = ReplayEngine(
        broadcast_fn=lambda message: None,
        config=_config(csv_path, rows_per_tick=1, tick_seconds=0.005),
        adapter=adapter,
    )

    message = _run_one_tick(engine)[0]

    assert message["lagging"] is True
    assert len(message["predictions"]) == 1
    assert message["latency"]["total_ms"] >= 5.0