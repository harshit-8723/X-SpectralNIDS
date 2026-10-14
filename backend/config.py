"""Validated runtime configuration for the replay backend.

Environment values are parsed once at application startup so invalid settings
fail with a direct message rather than surfacing later inside a replay task.
Paths supplied by the caller are resolved relative to the current working
directory; the default sample path is anchored to this backend directory.
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Mapping
from urllib.parse import urlparse


BackendModelName = Literal["dummy", "model_a", "model_b"]
BACKEND_DIR = Path(__file__).resolve().parent
LOCAL_ORIGIN_HOSTS = {"localhost", "127.0.0.1"}
DEFAULT_FRONTEND_ORIGINS = (
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:8080,http://127.0.0.1:8080,"
    "http://localhost:4173,http://127.0.0.1:4173"
)


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
    if not value:
        return default.resolve()
    configured = Path(value).expanduser()
    if configured.is_absolute():
        return configured.resolve()
    cwd_path = (Path.cwd() / configured).resolve()
    backend_path = (BACKEND_DIR / configured).resolve()
    if cwd_path.exists() or not backend_path.exists():
        return cwd_path
    return backend_path


def _as_bool(name: str, value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off", ""}:
        return False
    raise ValueError(f"{name} must be a boolean; got {value!r}")


def _default_replay_csv() -> Path:
    sample = BACKEND_DIR / "data" / "replay_sample.csv"
    return sample if sample.is_file() else BACKEND_DIR / "sample.csv"


def _load_dotenv() -> None:
    """Load backend/.env without overriding variables already set in the process.

    Skipped under pytest so unit tests keep using the dummy adapter unless they
    pass an explicit environment mapping.
    """
    if "pytest" in sys.modules:
        return
    env_path = BACKEND_DIR / ".env"
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = value


def is_allowed_origin(origin: str | None, configured: tuple[str, ...]) -> bool:
    """Allow configured dashboard origins and any local Vite/dev-server port."""
    if not origin:
        return True
    if origin in configured:
        return True
    parsed = urlparse(origin)
    return parsed.scheme in {"http", "https"} and parsed.hostname in LOCAL_ORIGIN_HOSTS


@dataclass(frozen=True)
class BackendConfig:
    model_name: BackendModelName
    model_dir: Path
    replay_csv: Path
    rows_per_tick: int
    tick_seconds: float
    frontend_origins: tuple[str, ...]
    auto_start_replay: bool

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> "BackendConfig":
        """Read and validate supported environment values.

        `environ` is injectable so tests can verify parsing without modifying
        process-wide environment variables or depending on developer settings.
        """
        if environ is None:
            _load_dotenv()
            values = os.environ
        else:
            values = environ
        model_name = values.get("MODEL_NAME", "dummy").strip().lower()
        if model_name not in {"dummy", "model_a", "model_b"}:
            raise ValueError(
                "MODEL_NAME must be one of 'dummy', 'model_a', or 'model_b'; "
                f"got {model_name!r}"
            )

        origins = tuple(
            origin.strip()
            for origin in values.get("FRONTEND_ORIGINS", DEFAULT_FRONTEND_ORIGINS).split(",")
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
                "REPLAY_CSV", values.get("REPLAY_CSV", ""), _default_replay_csv()
            ),
            rows_per_tick=_positive_int(
                "ROWS_PER_TICK", values.get("ROWS_PER_TICK", "10")
            ),
            tick_seconds=_positive_float(
                "TICK_SECONDS", values.get("TICK_SECONDS", "1.0")
            ),
            frontend_origins=origins,
            auto_start_replay=_as_bool(
                "AUTO_START_REPLAY", values.get("AUTO_START_REPLAY", "false")
            ),
        )
