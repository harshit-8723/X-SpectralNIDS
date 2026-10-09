"""Validated runtime configuration for the replay backend.

Environment values are parsed once at application startup so invalid settings
fail with a direct message rather than surfacing later inside a replay task.
Paths supplied by the caller are resolved relative to the current working
directory; the default sample path is anchored to this backend directory.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Mapping


BackendModelName = Literal["dummy", "model_a", "model_b"]
BACKEND_DIR = Path(__file__).resolve().parent


def _positive_int(name: str, value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as exc:
        raise ValueError(f"{name} must be a positive integer; got {value!r}") from exc
    if parsed <= 0:
        raise ValueError(f"{name} must be greater than zero; got {parsed}")
    return parsed


def _positive_float(name: str, value: str) -> float:
    try:
        parsed = float(value)
    except ValueError as exc:
        raise ValueError(f"{name} must be a positive number; got {value!r}") from exc
    if parsed <= 0:
        raise ValueError(f"{name} must be greater than zero; got {parsed}")
    return parsed


def _configured_path(name: str, value: str, default: Path) -> Path:
    configured = Path(value).expanduser() if value else default
    if not configured.is_absolute():
        configured = Path.cwd() / configured
    return configured.resolve()


@dataclass(frozen=True)
class BackendConfig:
    model_name: BackendModelName
    model_dir: Path
    replay_csv: Path
    rows_per_tick: int
    tick_seconds: float
    frontend_origins: tuple[str, ...]

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> "BackendConfig":
        """Read and validate supported environment values.

        `environ` is injectable so tests can verify parsing without modifying
        process-wide environment variables or depending on developer settings.
        """
        values = os.environ if environ is None else environ
        model_name = values.get("MODEL_NAME", "dummy").strip().lower()
        if model_name not in {"dummy", "model_a", "model_b"}:
            raise ValueError(
                "MODEL_NAME must be one of 'dummy', 'model_a', or 'model_b'; "
                f"got {model_name!r}"
            )

        origins = tuple(
            origin.strip()
            for origin in values.get("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
            if origin.strip()
        )
        if not origins:
            raise ValueError("FRONTEND_ORIGINS must contain at least one origin")

        return cls(
            model_name=model_name,  # type: ignore[arg-type]
            model_dir=_configured_path(
                "MODEL_DIR", values.get("MODEL_DIR", ""), BACKEND_DIR / "models"
            ),
            replay_csv=_configured_path(
                "REPLAY_CSV", values.get("REPLAY_CSV", ""), BACKEND_DIR / "sample.csv"
            ),
            rows_per_tick=_positive_int(
                "ROWS_PER_TICK", values.get("ROWS_PER_TICK", "10")
            ),
            tick_seconds=_positive_float(
                "TICK_SECONDS", values.get("TICK_SECONDS", "1.0")
            ),
            frontend_origins=origins,
        )