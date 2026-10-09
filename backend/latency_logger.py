"""
Simple append-only JSONL latency logger.
Each line is one flow's timing record — easy to load into pandas later
for your benchmarking section (df = pd.read_json(path, lines=True)).
"""

import json
import time
from pathlib import Path

LOG_DIR = Path(__file__).parent / "logs"
LOG_FILE = LOG_DIR / "latency_log.jsonl"

LOG_DIR.mkdir(exist_ok=True)


def log_latency(tick_index: int, latency: dict, model_name: str, lagging: bool) -> None:
    record = {
        "tick_index": tick_index,
        "timestamp": time.time(),
        "model_name": model_name,
        "lagging": lagging,
        **latency,
    }
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(record) + "\n")
