"""
Quick local test:

    Terminal 1:  uvicorn main:app --reload --port 8000
    Terminal 2:  python test_client.py

This connects to the monitoring WebSocket, starts the configured replay,
and prints each tick envelope received.
Press Ctrl+C to stop.
"""

import asyncio
import json
import os

import requests
import websockets

BASE_URL = "http://localhost:8000"
WS_URL = os.environ.get("NIDS_WS_URL", "ws://localhost:8000/ws/monitoring")


def start_replay():
    response = requests.post(f"{BASE_URL}/replay/start", json={"cycle": True})
    result = response.json()
    print("start_replay ->", result)
    if result.get("status") != "started":
        raise RuntimeError(result.get("detail", "Replay failed to start"))


def stop_replay():
    resp = requests.post(f"{BASE_URL}/replay/stop")
    print("stop_replay ->", resp.json())


async def listen(max_messages=20):
    async with websockets.connect(WS_URL) as ws:
        print(f"Connected to {WS_URL}, waiting for messages...\n")
        start_replay()
        count = 0
        try:
            while count < max_messages:
                msg = json.loads(await ws.recv())
                print(
                    f"tick {msg['predictions'][0]['row_index']} "
                    f"model={msg['meta']['model_name']} "
                    f"rows={len(msg['predictions'])} "
                    f"lagging={msg['lagging']} "
                    f"total={msg['latency']['total_ms']}ms"
                )
                count += 1
        finally:
            stop_replay()


if __name__ == "__main__":
    try:
        asyncio.run(listen(max_messages=20))
    except KeyboardInterrupt:
        pass
