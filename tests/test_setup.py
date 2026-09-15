"""Tests for zero-setup key discovery, provider inference and notebook host detection."""

import os
import sys
import warnings
from types import SimpleNamespace

try:
    import httpx
except ModuleNotFoundError:  # openai >= 3 depends on httpx2
    import httpx2 as httpx
import openai
import pytest

import vibe_widget.config  # noqa: F401  (registers the submodule in sys.modules)
from vibe_widget.config import Config, config
from vibe_widget.llm.providers import openai_compat
from vibe_widget.utils import platform as platform_mod

config_mod = sys.modules["vibe_widget.config"]

KEY_VARS = (
    "VIBE_API_KEY",
    "VIBE_BASE_URL",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY",
)
VSCODE_VARS = ("VSCODE_PID", "POSITRON", "POSITRON_VERSION")
QUARTO_VARS = ("QUARTO_PYTHON", "QUARTO_PROJECT_DIR", "QUARTO_RENDER_TOKEN")


@pytest.fixture
def clean_env(monkeypatch, tmp_path):
    """No API keys, no cached .env state, and a working directory with no .env above it."""
    monkeypatch.setattr(config_mod, "_global_config", None)
    monkeypatch.setattr(config_mod, "_dotenv_checked", False)
    monkeypatch.setattr(config_mod, "_dotenv_source", None)
    monkeypatch.setattr(config_mod, "_dotenv_names", set())
    monkeypatch.setattr(config_mod, "_warned_key_prefix", False)
    for name in KEY_VARS:
        monkeypatch.delenv(name, raising=False)
    # conftest sets VIBE_NO_DOTENV so no test reads a real .env; these tests
    # exercise discovery itself against a temporary tree, so the guard is lifted.
    monkeypatch.delenv("VIBE_NO_DOTENV", raising=False)
    monkeypatch.chdir(tmp_path)
    return tmp_path


# --- .env discovery ------------------------------------------------------


def test_dotenv_is_found_in_a_parent_and_never_overrides_the_environment(
    clean_env, monkeypatch
):
    (clean_env / ".env").write_text("OPENROUTER_API_KEY=from-dotenv\nOTHER=from-dotenv\n")
    nested = clean_env / "notebooks" / "chapter-one"
    nested.mkdir(parents=True)
    monkeypatch.chdir(nested)
    monkeypatch.setenv("OTHER", "already-set")

    cfg = config()

    assert cfg.api_key == "from-dotenv"
    assert os.environ["OTHER"] == "already-set"
    assert str((clean_env / ".env").resolve()) in cfg.key_source


def test_dotenv_search_stops_at_a_git_directory(clean_env, monkeypatch):
    (clean_env / ".env").write_text("OPENROUTER_API_KEY=outside-the-repo\n")
    project = clean_env / "project"
    (project / ".git").mkdir(parents=True)
    monkeypatch.chdir(project)

    assert config_mod.load_dotenv() is None
    assert Config().api_key is None


def test_dotenv_is_still_read_when_a_key_is_already_exported(clean_env, monkeypatch):
    """An exported key must not hide the rest of the file, such as VIBE_BASE_URL."""
    (clean_env / ".env").write_text(
        "ANTHROPIC_API_KEY=from-dotenv\nVIBE_BASE_URL=https://vllm.example.test/v1\n"
    )
    monkeypatch.setenv("ANTHROPIC_API_KEY", "already-set")

    cfg = Config()
    assert os.environ["ANTHROPIC_API_KEY"] == "already-set"
    assert cfg.base_url == "https://vllm.example.test/v1"


def test_dotenv_with_a_byte_order_mark_keeps_its_first_variable(clean_env):
    (clean_env / ".env").write_bytes("﻿OPENROUTER_API_KEY=first\n".encode())

    assert Config().api_key == "first"


def test_a_loopback_endpoint_needs_no_key(clean_env):
    cfg = Config(base_url="http://localhost:11434/v1", model="qwen2.5-coder")

    assert (cfg.api_key, cfg.provider) == ("local", "custom")
    cfg.validate()  # must not raise
    assert Config(base_url="https://example.test/v1").api_key is None


@pytest.mark.parametrize(
    "line, expected",
    [
        ("OPENAI_API_KEY=plain", "plain"),
        ("export OPENAI_API_KEY=exported", "exported"),
        ('OPENAI_API_KEY="double quoted"', "double quoted"),
        ("OPENAI_API_KEY='single quoted'", "single quoted"),
        ("  OPENAI_API_KEY = spaced ", "spaced"),
        ('OPENAI_API_KEY="unbalanced', '"unbalanced'),
        ("OPENAI_API_KEY=value # trailing note", "value"),
        ("OPENAI_API_KEY=pa#ss", "pa#ss"),
        ('OPENAI_API_KEY="a # b"', "a # b"),
    ],
)
def test_dotenv_parser_handles_export_and_quoting(line, expected):
    assert config_mod._parse_dotenv(line)["OPENAI_API_KEY"] == expected


def test_dotenv_parser_ignores_comments_blank_lines_and_non_pairs():
    text = "# a comment\n\n   \nA=1\nnot a pair\n2BAD=x\n"
    assert config_mod._parse_dotenv(text) == {"A": "1"}


# --- provider inference --------------------------------------------------


@pytest.mark.parametrize(
    "env_var, provider, host",
    [
        ("ANTHROPIC_API_KEY", "anthropic", "api.anthropic.com"),
        ("OPENAI_API_KEY", "openai", "api.openai.com"),
        ("OPENROUTER_API_KEY", "openrouter", "openrouter.ai"),
    ],
)
def test_each_key_infers_its_own_endpoint_and_default_model(
    clean_env, monkeypatch, env_var, provider, host
):
    monkeypatch.setenv(env_var, "a-key")
    cfg = Config()

    assert cfg.provider == provider
    assert host in cfg.base_url
    assert cfg.model == config_mod.PROVIDER_DEFAULTS[provider]["model"]
    assert cfg.key_source == env_var


def test_inference_precedence_runs_vibe_anthropic_openai_openrouter(clean_env, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "router")
    assert Config().provider == "openrouter"

    monkeypatch.setenv("OPENAI_API_KEY", "openai")
    assert Config().provider == "openai"

    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic")
    assert Config().provider == "anthropic"

    monkeypatch.setenv("VIBE_API_KEY", "vibe")
    cfg = Config()
    assert (cfg.provider, cfg.api_key) == ("openrouter", "vibe")


def test_vibe_base_url_makes_the_endpoint_custom(clean_env, monkeypatch):
    monkeypatch.setenv("VIBE_API_KEY", "a-key")
    monkeypatch.setenv("VIBE_BASE_URL", "http://localhost:11434/v1")

    cfg = Config()
    assert (cfg.provider, cfg.base_url) == ("custom", "http://localhost:11434/v1")


def test_explicit_api_key_beats_every_environment_variable(clean_env, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "from-env")

    cfg = Config(api_key="passed-in")
    assert (cfg.api_key, cfg.key_source) == ("passed-in", "api_key argument")


def test_changing_the_model_keeps_the_inferred_provider(clean_env, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "a-key")
    config()

    cfg = config(model="claude-sonnet-5")
    assert (cfg.provider, cfg.model) == ("anthropic", "claude-sonnet-5")


def test_openrouter_style_model_id_is_rejected_on_a_direct_provider(clean_env, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "a-key")

    with pytest.raises(ValueError, match="OpenRouter id"):
        Config(model="anthropic/claude-opus-4.5")
    with pytest.raises(ValueError, match="OpenRouter id"):
        config(model="anthropic/claude-opus-4.5")

    # The same id is fine once the endpoint really is OpenRouter.
    assert config(model="anthropic/claude-opus-4.5", base_url=config_mod.OPENROUTER_BASE_URL)


def test_a_rejected_model_leaves_the_global_config_untouched(clean_env, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "a-key")
    before = config().model

    with pytest.raises(ValueError, match="OpenRouter id"):
        config(model="anthropic/claude-opus-4.5")

    assert config().model == before == "claude-opus-5"


def test_contradicting_key_prefix_warns_once_and_trusts_the_variable_name(
    clean_env, monkeypatch
):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-ant-looks-like-anthropic")

    with pytest.warns(UserWarning, match="anthropic key"):
        cfg = Config()
    assert cfg.provider == "openai"

    with warnings.catch_warnings():
        warnings.simplefilter("error")
        assert Config().provider == "openai"


# --- first-run messages --------------------------------------------------


def test_missing_key_error_names_every_option_and_a_dotenv_example(clean_env):
    with pytest.raises(ValueError) as excinfo:
        Config().validate()

    message = str(excinfo.value)
    for fragment in (
        ".env",
        "ANTHROPIC_API_KEY=sk-ant-",
        "OPENAI_API_KEY=sk-",
        "OPENROUTER_API_KEY=sk-or-",
        "VIBE_API_KEY",
        "VIBE_BASE_URL",
    ):
        assert fragment in message


def test_repr_shows_provenance_but_never_the_key(clean_env, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-super-secret-value")

    text = repr(Config())

    assert "sk-ant-super-secret-value" not in text
    assert "provider='anthropic'" in text
    assert "host='api.anthropic.com'" in text
    assert "key_source='ANTHROPIC_API_KEY'" in text
    assert "environment=" in text


# --- notebook host detection ---------------------------------------------


@pytest.fixture
def no_host_vars(monkeypatch):
    """Clear every host marker so detection starts from a known state."""
    monkeypatch.setattr(platform_mod, "_colab_cache", False)
    for name in VSCODE_VARS + QUARTO_VARS + ("VSCODE_CWD",):
        monkeypatch.delenv(name, raising=False)


def test_vscode_cwd_alone_is_not_a_vscode_notebook(no_host_vars, monkeypatch):
    """A Jupyter server started from a VS Code terminal inherits VSCODE_CWD."""
    monkeypatch.setenv("VSCODE_CWD", "/Applications/Visual Studio Code.app")

    assert not platform_mod.is_vscode_like()


@pytest.mark.parametrize("name", VSCODE_VARS)
def test_is_vscode_like_covers_vscode_and_positron(no_host_vars, monkeypatch, name):
    assert not platform_mod.is_vscode_like()
    monkeypatch.setenv(name, "1")
    assert platform_mod.is_vscode_like()


@pytest.mark.parametrize("name", QUARTO_VARS)
def test_is_quarto_covers_every_quarto_marker(no_host_vars, monkeypatch, name):
    assert not platform_mod.is_quarto()
    monkeypatch.setenv(name, "1")
    assert platform_mod.is_quarto()


def test_describe_environment_lists_every_detected_host(no_host_vars, monkeypatch):
    assert platform_mod.describe_environment() == "generic"

    monkeypatch.setenv("POSITRON", "1")
    monkeypatch.setenv("QUARTO_PROJECT_DIR", "/tmp/report")
    assert platform_mod.describe_environment() == "vscode-like, quarto"


# --- request parameter adaptation ----------------------------------------


def _bad_request(message, param=None):
    """Build a 400 the way an OpenAI-compatible host reports a rejected parameter."""
    request = httpx.Request("POST", "https://example.test/v1/chat/completions")
    return openai.BadRequestError(
        message,
        response=httpx.Response(400, request=request),
        body={"error": {"message": message, "param": param}},
    )


@pytest.mark.parametrize(
    "param, expected",
    [
        ("temperature", "temperature"),
        ("max_tokens", "max_tokens"),
        ("messages", None),
        ("model", None),
        ("tools", None),
    ],
)
def test_only_allowlisted_parameters_are_ever_adjusted(param, expected):
    exc = _bad_request(f"Unsupported parameter: '{param}' is not supported", param)
    params = {"model": "m", "messages": [], "temperature": 0.7, "max_tokens": 8, "tools": []}

    assert openai_compat._rejected_param(exc, params) == expected


def test_dropping_a_parameter_warns_with_the_host_model_and_name(monkeypatch):
    sent = []

    def create(**params):
        sent.append(params)
        if len(sent) == 1:
            raise _bad_request("`temperature` is deprecated for this model.")
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="ok"))], usage=None
        )

    monkeypatch.setattr(openai_compat, "_PARAM_FIXES", {})
    monkeypatch.setattr(
        openai_compat,
        "OpenAI",
        lambda **_kw: SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create))),
    )
    provider = openai_compat.OpenAICompatProvider(
        "a-model", "a-key", base_url="https://example.test/v1"
    )

    with pytest.warns(UserWarning, match="rejected 'temperature' for a-model"):
        provider.chat_completion(messages=[{"role": "user", "content": "hi"}])

    assert "temperature" in sent[0]
    assert "temperature" not in sent[1]
