"""
Quick local test:

    Terminal 1:  uvicorn main:app --reload --port 8000
    Terminal 2:  python test_client.py

This starts a replay (100 rows/sec by default) via the REST endpoint,
then connects to the WebSocket and prints every message received.
Press Ctrl+C to stop.
"""

import asyncio
import json

import requests
import websockets

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws"


def start_replay(file="data/sample.csv", pace=100):
    resp = requests.post(f"{BASE_URL}/replay/start", json={"file": file, "pace": pace})
    print("start_replay ->", resp.json())


def stop_replay():
    resp = requests.post(f"{BASE_URL}/replay/stop")
    print("stop_replay ->", resp.json())


async def listen(max_messages=20):
    async with websockets.connect(WS_URL) as ws:
        print(f"Connected to {WS_URL}, waiting for messages...\n")
        count = 0
        while count < max_messages:
            raw = await ws.recv()
            msg = json.loads(raw)
            print(
                f"[flow {msg['flow_index']}] "
                f"{msg['predicted_label']} (conf={msg['confidence']}) "
                f"| latency total={msg['latency_ms']['total_ms']}ms"
            )
            count += 1


if __name__ == "__main__":
    start_replay(pace=100)
    try:
        asyncio.run(listen(max_messages=20))
    except KeyboardInterrupt:
        pass
    finally:
        stop_replay()
