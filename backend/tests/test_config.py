import pytest

from config import BackendConfig


def test_config_reads_supported_model_and_runtime_settings(tmp_path):
    config = BackendConfig.from_env(
        {
            "MODEL_NAME": "model_b",
            "MODEL_DIR": str(tmp_path / "bundle"),
            "REPLAY_CSV": str(tmp_path / "rows.csv"),
            "ROWS_PER_TICK": "7",
            "TICK_SECONDS": "0.25",
            "FRONTEND_ORIGINS": "http://localhost:5173, https://dashboard.example",
        }
    )

    assert config.model_name == "model_b"
    assert config.model_dir == (tmp_path / "bundle").resolve()
    assert config.replay_csv == (tmp_path / "rows.csv").resolve()
    assert config.rows_per_tick == 7
    assert config.tick_seconds == 0.25
    assert config.frontend_origins == (
        "http://localhost:5173",
        "https://dashboard.example",
    )
    assert config.auto_start_replay is False


@pytest.mark.parametrize("model_name", ["", "other", "MODEL_C"])
def test_config_rejects_unsupported_model_name(model_name):
    with pytest.raises(ValueError, match="MODEL_NAME must be one of"):
        BackendConfig.from_env({"MODEL_NAME": model_name})


@pytest.mark.parametrize(
    ("setting", "value", "message"),
    [
        ("ROWS_PER_TICK", "0", "ROWS_PER_TICK must be greater than zero"),
        ("ROWS_PER_TICK", "many", "ROWS_PER_TICK must be a positive integer"),
        ("TICK_SECONDS", "-1", "TICK_SECONDS must be greater than zero"),
        ("TICK_SECONDS", "soon", "TICK_SECONDS must be a positive number"),
    ],
)
def test_config_rejects_invalid_tick_settings(setting, value, message):
    with pytest.raises(ValueError, match=message):
        BackendConfig.from_env({setting: value})


def test_config_requires_at_least_one_frontend_origin():
    with pytest.raises(ValueError, match="FRONTEND_ORIGINS must contain"):
        BackendConfig.from_env({"FRONTEND_ORIGINS": " , "})