"""
Replay engine: reads a flow CSV and "replays" it at a configurable
rows/sec pace, running the (currently dummy) pipeline on each row and
broadcasting the result to all connected WebSocket clients.

Fixed-rate pacing (not timestamp-based) — see chat notes: CICFlowMeter
output here has no per-flow start-timestamp column to replay against,
so rows/sec is both the only real option and the simplest for demoing.

If the CSV has fewer rows than you want for a demo, this loops back to
the start of the file automatically (cycle=True by default) so you can
run it for as long as you like on a small sample.
"""

import asyncio
import time
from pathlib import Path
from typing import Awaitable, Callable, Optional

import pandas as pd

from dummy_pipeline import get_dummy_prediction
from latency_logger import log_latency

BASE_DIR = Path(__file__).parent


class ReplayEngine:
    def __init__(self, broadcast_fn: Callable[[dict], Awaitable[None]]):
        # broadcast_fn: async function that sends a dict to all connected WS clients
        self._broadcast_fn = broadcast_fn
        self._task: Optional[asyncio.Task] = None
        self._running: bool = False
        self._file: Optional[str] = None
        self._pace: Optional[float] = None
        self._flow_index: int = 0

    @property
    def status(self) -> dict:
        return {
            "running": self._running,
            "file": self._file,
            "pace_rows_per_sec": self._pace,
            "flows_emitted": self._flow_index,
        }

    async def start(self, file: str, pace: float, cycle: bool = True):
        if self._running:
            raise RuntimeError("Replay already running — call /replay/stop first")

        csv_path = (BASE_DIR / file).resolve()
        if not csv_path.exists():
            raise FileNotFoundError(f"CSV not found at {csv_path}")

        df = pd.read_csv(csv_path, skipinitialspace=True)  # handles the leading-space column names
        if df.empty:
            raise ValueError("CSV has no rows")

        self._file = file
        self._pace = pace
        self._flow_index = 0
        self._running = True
        self._task = asyncio.create_task(self._run_loop(df, pace, cycle))

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None

    async def _run_loop(self, df: pd.DataFrame, pace: float, cycle: bool):
        delay = 1.0 / pace if pace > 0 else 0
        try:
            while self._running:
                for _, row in df.iterrows():
                    if not self._running:
                        break

                    row_dict = row.to_dict()
                    start = time.perf_counter()

                    result = get_dummy_prediction(row_dict)

                    log_latency(self._flow_index, result["latency_ms"], result["predicted_label"])

                    message = {
                        "flow_index": self._flow_index,
                        "predicted_label": result["predicted_label"],
                        "confidence": result["confidence"],
                        "raw_shap": result["raw_shap"],
                        "zone_shap": result["zone_shap"],
                        "latency_ms": result["latency_ms"],
                    }
                    await self._broadcast_fn(message)

                    self._flow_index += 1

                    elapsed = time.perf_counter() - start
                    sleep_for = max(0.0, delay - elapsed)
                    await asyncio.sleep(sleep_for)

                if not cycle:
                    break
        except asyncio.CancelledError:
            pass
        finally:
            self._running = False
