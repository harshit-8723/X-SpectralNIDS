"""FastAPI entrypoint for bounded CSV replay and monitoring WebSockets."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import BackendConfig
from model_adapter import create_model_adapter
from model_bundle import load_model_bundle
from replay_engine import ReplayEngine


LOGGER = logging.getLogger("x_spectral_nids.websocket")


class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active.append(websocket)
        LOGGER.info(
            "WebSocket client connected",
            extra={"path": websocket.url.path, "origin": websocket.headers.get("origin")},
        )

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active:
            self.active.remove(websocket)
            LOGGER.info("WebSocket client disconnected", extra={"path": websocket.url.path})

    async def broadcast(self, message: dict) -> None:
        disconnected = []
        for websocket in self.active:
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(websocket)
        for websocket in disconnected:
            self.disconnect(websocket)


class StartReplayRequest(BaseModel):
    file: Optional[str] = None
    pace: Optional[float] = None
    cycle: bool = True


class SystemStatus(BaseModel):
    backendConnected: bool
    websocketConnected: bool
    streaming: bool
    modelVersion: str
    apiUrl: str
    wsUrl: str


def create_app(config: BackendConfig | None = None) -> FastAPI:
    """Build an app with its own engine, allowing isolated API tests.

    # INTEGRATION POINT: Real model selection is performed once at startup. A
    # malformed/missing bundle therefore prevents serving misleading predictions.
    """
    settings = config or BackendConfig.from_env()
    bundle = None
    if settings.model_name != "dummy":
        bundle = load_model_bundle(settings.model_dir, settings.model_name)
    adapter = create_model_adapter(settings, bundle)
    manager = ConnectionManager()
    engine = ReplayEngine(
        broadcast_fn=manager.broadcast,
        config=settings,
        adapter=adapter,
        bundle=bundle,
    )

    application = FastAPI(title="X-SpectralNIDS Backend")
    application.state.config = settings
    application.state.manager = manager
    application.state.engine = engine
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.frontend_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.get("/health", response_model=SystemStatus)
    @application.get("/api/health", response_model=SystemStatus)
    async def health(request: Request) -> SystemStatus:
        base_url = str(request.base_url).rstrip("/")
        host = request.url.netloc
        websocket_scheme = "wss" if request.url.scheme == "https" else "ws"
        return SystemStatus(
            backendConnected=True,
            websocketConnected=bool(manager.active),
            streaming=engine.status["running"],
            modelVersion=settings.model_name,
            apiUrl=f"{base_url}/api",
            wsUrl=f"{websocket_scheme}://{host}/ws/monitoring",
        )

    @application.post("/replay/start")
    async def start_replay(request: StartReplayRequest):
        try:
            await engine.start(file=request.file, pace=request.pace, cycle=request.cycle)
            return {"status": "started", **engine.status}
        except (FileNotFoundError, RuntimeError, ValueError) as exc:
            return {"status": "error", "detail": str(exc)}

    @application.post("/replay/stop")
    async def stop_replay():
        await engine.stop()
        return {"status": "stopped", **engine.status}

    @application.get("/replay/status")
    async def replay_status():
        return engine.status

    async def monitoring_websocket(websocket: WebSocket) -> None:
        origin = websocket.headers.get("origin")
        if origin and origin not in settings.frontend_origins:
            LOGGER.warning(
                "Rejected WebSocket origin",
                extra={"path": websocket.url.path, "origin": origin},
            )
            await websocket.close(code=1008, reason="Origin is not allowed")
            return
        await manager.connect(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            manager.disconnect(websocket)

    # INTEGRATION POINT: /ws stays available to older local clients; the current
    # frontend connects to /ws/monitoring and consumes MonitoringMessage fields.
    application.websocket("/ws/monitoring")(monitoring_websocket)
    application.websocket("/ws")(monitoring_websocket)
    return application


app = create_app()