import asyncio
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from config import BackendConfig
from main import create_app


ALLOWED_ORIGIN = "http://localhost:5173"


def _config(replay_csv: Path) -> BackendConfig:
    return BackendConfig.from_env(
        {
            "MODEL_NAME": "dummy",
            "REPLAY_CSV": str(replay_csv),
            "ROWS_PER_TICK": "1",
            "TICK_SECONDS": "0.01",
            "FRONTEND_ORIGINS": ALLOWED_ORIGIN,
        }
    )


def _sample_csv(path: Path) -> None:
    pd.DataFrame(
        {
            "Flow Duration": [1000],
            "Total Fwd Packets": [2],
            "Total Backward Packets": [1],
            "Flow IAT Mean": [100],
            "Flow IAT Std": [10],
            "Flow Bytes/s": [1_000_000],
            "Label": ["BENIGN"],
        }
    ).to_csv(path, index=False)


def test_health_paths_match_frontend_system_status(tmp_path):
    csv_path = tmp_path / "sample.csv"
    _sample_csv(csv_path)
    client = TestClient(create_app(_config(csv_path)))

    for path in ("/health", "/api/health"):
        response = client.get(path)
        assert response.status_code == 200
        body = response.json()
        assert body["backendConnected"] is True
        assert body["websocketConnected"] is False
        assert body["streaming"] is False
        assert body["modelVersion"] == "dummy"
        assert body["apiUrl"].endswith("/api")
        assert body["wsUrl"].endswith("/ws/monitoring")


def test_health_allows_configured_frontend_origin(tmp_path):
    csv_path = tmp_path / "sample.csv"
    _sample_csv(csv_path)
    client = TestClient(create_app(_config(csv_path)))

    response = client.get("/api/health", headers={"Origin": ALLOWED_ORIGIN})

    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN


def test_monitoring_websocket_streams_frontend_and_backend_fields(tmp_path):
    csv_path = tmp_path / "sample.csv"
    _sample_csv(csv_path)
    client = TestClient(create_app(_config(csv_path)))

    with client.websocket_connect(
        "/ws/monitoring", headers={"origin": ALLOWED_ORIGIN}
    ) as websocket:
        start = client.post("/replay/start", json={"cycle": False})
        assert start.json()["status"] == "started"
        message = websocket.receive_json()

    assert message["type"] == "traffic_update"
    assert set(message["traffic"]) == {"timestamp", "normal", "suspicious", "throughputMbps"}
    assert set(message["window"]) == {
        "source", "destination", "protocol", "packets", "durationMs",
        "interArrivalMeanMs", "interArrivalStdMs", "prediction", "confidence",
    }
    assert isinstance(message["frequency"], list)
    assert message["meta"]["model_name"] == "dummy"
    assert message["meta"]["is_dummy"] is True
    assert len(message["predictions"]) == 1
    assert isinstance(message["explanations"], list)
    assert isinstance(message["latency"]["total_ms"], float)
    assert isinstance(message["lagging"], bool)
    assert message["window"]["source"] == "unavailable"


def test_legacy_websocket_route_remains_available(tmp_path):
    csv_path = tmp_path / "sample.csv"
    _sample_csv(csv_path)
    application = create_app(_config(csv_path))
    client = TestClient(application)

    with client.websocket_connect("/ws", headers={"origin": ALLOWED_ORIGIN}):
        assert len(application.state.manager.active) == 1

    assert application.state.manager.active == []


def test_replay_start_alias_under_api_prefix(tmp_path):
    csv_path = tmp_path / "sample.csv"
    _sample_csv(csv_path)
    client = TestClient(create_app(_config(csv_path)))

    start = client.post("/api/replay/start", json={"cycle": False})
    assert start.status_code == 200
    assert start.json()["status"] == "started"
    assert start.json()["running"] is True


def test_replay_start_is_idempotent(tmp_path):
    csv_path = tmp_path / "sample.csv"
    _sample_csv(csv_path)
    client = TestClient(create_app(_config(csv_path)))

    first = client.post("/replay/start", json={"cycle": True})
    second = client.post("/replay/start", json={"cycle": True})
    assert first.json()["status"] == "started"
    assert second.json()["status"] == "started"
    assert second.json()["running"] is True


def test_monitoring_websocket_allows_local_dev_port(tmp_path):
    csv_path = tmp_path / "sample.csv"
    _sample_csv(csv_path)
    client = TestClient(create_app(_config(csv_path)))

    with client.websocket_connect(
        "/ws/monitoring", headers={"origin": "http://localhost:5999"}
    ) as websocket:
        assert websocket is not None


def test_websocket_rejects_unconfigured_origin(tmp_path):
    csv_path = tmp_path / "sample.csv"
    _sample_csv(csv_path)
    client = TestClient(create_app(_config(csv_path)))

    with pytest.raises(WebSocketDisconnect) as disconnected:
        with client.websocket_connect(
            "/ws/monitoring", headers={"origin": "https://unapproved.example"}
        ):
            pass

    assert disconnected.value.code == 1008