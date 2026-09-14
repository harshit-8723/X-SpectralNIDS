"""
X-SpectralNIDS backend — replay + dummy pipeline + WebSocket streaming.

Run:
    uvicorn main:app --reload --port 8000

Endpoints:
    POST /replay/start   {"file": "data/sample.csv", "pace": 100}
    POST /replay/stop
    GET  /replay/status
    WS   /ws              (connect to receive streamed predictions)
"""

from typing import List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from replay_engine import ReplayEngine

app = FastAPI(title="X-SpectralNIDS Backend")


class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()
engine = ReplayEngine(broadcast_fn=manager.broadcast)


class StartReplayRequest(BaseModel):
    file: str = "data/sample.csv"
    pace: float = 100.0  # rows/sec
    cycle: bool = True   # loop back to start of file when it runs out


@app.post("/replay/start")
async def start_replay(req: StartReplayRequest):
    try:
        await engine.start(file=req.file, pace=req.pace, cycle=req.cycle)
        return {"status": "started", **engine.status}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@app.post("/replay/stop")
async def stop_replay():
    await engine.stop()
    return {"status": "stopped", **engine.status}


@app.get("/replay/status")
async def replay_status():
    return engine.status


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            # We don't expect clients to send anything, but keep the
            # receive loop alive so we detect disconnects promptly.
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
