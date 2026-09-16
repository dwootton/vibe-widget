"""Tests for vibe_widget.config."""

import sys

import pytest

import vibe_widget.config  # noqa: F401  (registers the submodule in sys.modules)
from vibe_widget.config import Config, config

# vibe_widget/__init__.py re-exports the `config` function under the package
# attribute of the same name, so the module has to come from sys.modules.
config_mod = sys.modules["vibe_widget.config"]


def _fresh(monkeypatch):
    """Reset the global config and every key/endpoint environment variable."""
    monkeypatch.setattr(config_mod, "_global_config", None)
    # Marking the .env as already checked keeps these tests off the developer's
    # own .env, which would otherwise be discovered once every key is unset.
    monkeypatch.setattr(config_mod, "_dotenv_checked", True)
    for name in (
        "VIBE_API_KEY",
        "OPENROUTER_API_KEY",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "VIBE_BASE_URL",
    ):
        monkeypatch.delenv(name, raising=False)


def test_api_key_env_resolution_order(monkeypatch):
    _fresh(monkeypatch)

    monkeypatch.setenv("OPENROUTER_API_KEY", "router-key")
    assert Config().api_key == "router-key"

    monkeypatch.setenv("VIBE_API_KEY", "vibe-key")
    assert Config().api_key == "vibe-key"


def test_openai_key_is_only_used_where_the_endpoint_matches(monkeypatch):
    _fresh(monkeypatch)
    monkeypatch.setenv("OPENAI_API_KEY", "openai-key")

    # With no base_url the key itself decides the endpoint.
    assert Config().api_key == "openai-key"
    assert Config(base_url="https://api.openai.com/v1").api_key == "openai-key"
    # A different endpoint must not be handed the OpenAI key.
    assert Config(base_url="https://openrouter.ai/api/v1").api_key is None


def test_vibe_base_url_seeds_base_url(monkeypatch):
    _fresh(monkeypatch)
    monkeypatch.setenv("VIBE_BASE_URL", "http://localhost:11434/v1")

    assert Config().base_url == "http://localhost:11434/v1"
    assert Config(base_url="https://example.test/v1").base_url == "https://example.test/v1"


def test_validate_rejects_bad_privacy_rows_and_timeout(monkeypatch):
    _fresh(monkeypatch)
    monkeypatch.setenv("VIBE_API_KEY", "k")

    with pytest.raises(ValueError, match="data_privacy"):
        Config(data_privacy="everything").validate()
    with pytest.raises(ValueError, match="sample_rows"):
        Config(sample_rows=-1).validate()
    with pytest.raises(ValueError, match="timeout"):
        Config(timeout=0).validate()

    Config(data_privacy="schema", sample_rows=0, timeout=1.5).validate()


def test_unknown_kwarg_raises_on_first_and_later_calls(monkeypatch):
    _fresh(monkeypatch)

    with pytest.raises(TypeError, match="not_a_field"):
        config(not_a_field=1)

    config(model="x")
    with pytest.raises(TypeError, match="not_a_field"):
        config(not_a_field=1)


def test_config_updates_new_fields_and_keeps_zero_temperature(monkeypatch):
    _fresh(monkeypatch)

    cfg = config(temperature=0.0)
    assert cfg.temperature == 0.0

    cfg = config(base_url="https://example.test/v1", timeout=30.0, data_privacy="schema", sample_rows=1)
    assert cfg.base_url == "https://example.test/v1"
    assert cfg.timeout == 30.0
    assert cfg.data_privacy == "schema"
    assert cfg.sample_rows == 1
    assert cfg.temperature == 0.0


@pytest.mark.parametrize(
    "kwargs, match",
    [
        ({"data_privacy": "all-of-it"}, "data_privacy"),
        ({"sample_rows": -2}, "sample_rows"),
        ({"timeout": -5}, "timeout"),
    ],
)
def test_config_rejects_bad_settings_without_mutating_the_global(monkeypatch, kwargs, match):
    _fresh(monkeypatch)

    with pytest.raises(ValueError, match=match):
        config(**kwargs)
    assert config_mod._global_config is None

    config(data_privacy="schema", sample_rows=4, timeout=30.0)
    with pytest.raises(ValueError, match=match):
        config(**kwargs)

    cfg = config()
    assert (cfg.data_privacy, cfg.sample_rows, cfg.timeout) == ("schema", 4, 30.0)


def test_round_trip_through_dict_ignores_dropped_keys(monkeypatch):
    _fresh(monkeypatch)
    monkeypatch.setenv("VIBE_API_KEY", "k")

    data = Config(data_privacy="schema", sample_rows=7, timeout=42.0).to_dict()
    data["removed_in_a_later_version"] = True

    restored = Config.from_dict(data)
    assert restored.data_privacy == "schema"
    assert restored.sample_rows == 7
    assert restored.timeout == 42.0
