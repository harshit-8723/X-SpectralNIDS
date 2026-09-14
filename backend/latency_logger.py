"""
Simple append-only JSONL latency logger.
Each line is one flow's timing record — easy to load into pandas later
for your benchmarking section (df = pd.read_json(path, lines=True)).
"""

import json
import os
import time
from pathlib import Path

LOG_DIR = Path(__file__).parent / "logs"
LOG_FILE = LOG_DIR / "latency_log.jsonl"

LOG_DIR.mkdir(exist_ok=True)


def log_latency(flow_index: int, latency_ms: dict, predicted_label: str) -> None:
    record = {
        "flow_index": flow_index,
        "timestamp": time.time(),
        "predicted_label": predicted_label,
        **latency_ms,
    }
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(record) + "\n")
