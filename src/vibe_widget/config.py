"""
Simplified configuration management for Vibe Widget.
"""

import json
import os
import re
import time
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Optional
from urllib.parse import urlparse

import requests


# Load models manifest
def _load_models_manifest() -> dict[str, Any]:
    """Load the models manifest from JSON file."""
    manifest_path = Path(__file__).parent / "models_manifest.json"
    with open(manifest_path) as f:
        return json.load(f)

MODELS_MANIFEST = _load_models_manifest()

PROVIDER_DEFAULTS = MODELS_MANIFEST["defaults"]
OPENROUTER_BASE_URL = PROVIDER_DEFAULTS["openrouter"]["base_url"]
DEFAULT_MODEL = PROVIDER_DEFAULTS["openrouter"]["model"]
DATA_PRIVACY_MODES = ("sample", "schema")

# Checked in this order when no base_url is given; VIBE_API_KEY wins over all of them.
PROVIDER_ENV_VARS = (
    ("anthropic", "ANTHROPIC_API_KEY"),
    ("openai", "OPENAI_API_KEY"),
    ("openrouter", "OPENROUTER_API_KEY"),
)
LOOPBACK_HOSTS = ("localhost", "127.0.0.1", "::1")
_HOST_PROVIDERS = (
    ("openrouter.ai", "openrouter"),
    ("api.anthropic.com", "anthropic"),
    ("api.openai.com", "openai"),
)
# Prefixes that identify a key's issuer. OpenAI keys are plain "sk-", so they
# cannot be told apart from a generic key and are absent here on purpose.
_KEY_PREFIXES = (("sk-ant-", "anthropic"), ("sk-or-", "openrouter"))

NO_API_KEY_MESSAGE = (
    "No API key found. Put one of these in a .env file next to your notebook, "
    "or export it in your environment:\n"
    "  ANTHROPIC_API_KEY=sk-ant-...\n"
    "  OPENAI_API_KEY=sk-...\n"
    "  OPENROUTER_API_KEY=sk-or-...\n"
    "For any other OpenAI-compatible endpoint set VIBE_API_KEY and VIBE_BASE_URL, "
    "or pass vw.config(api_key=..., base_url=...)."
)

_dotenv_source: Optional[str] = None
_dotenv_names: set = set()
_dotenv_checked = False
_warned_key_prefix = False


def _find_dotenv() -> Optional[Path]:
    """Find the nearest .env at or above the working directory."""
    try:
        current = Path.cwd().resolve()
    except OSError:
        return None
    home = Path.home().resolve()
    for directory in (current,) + tuple(current.parents):
        candidate = directory / ".env"
        if candidate.is_file():
            return candidate
        if (directory / ".git").exists() or directory == home:
            return None
    return None


def _parse_dotenv(text: str) -> dict:
    """Parse KEY=VALUE lines, skipping comments and stripping `export` and quotes."""
    values: dict = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export "):].lstrip()
        name, separator, value = line.partition("=")
        name = name.strip()
        if not separator or not name.isidentifier():
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        else:
            value = re.split(r"\s#", value, maxsplit=1)[0].rstrip()
        values[name] = value
    return values


def _dotenv_allowed() -> bool:
    """False when VIBE_NO_DOTENV is set, so test runs never read a real .env."""
    return not os.environ.get("VIBE_NO_DOTENV")


def load_dotenv() -> Optional[str]:
    """Load the nearest .env once, never overriding variables already set."""
    global _dotenv_checked, _dotenv_source
    if _dotenv_checked or not _dotenv_allowed():
        return _dotenv_source
    _dotenv_checked = True
    path = _find_dotenv()
    if path is None:
        return None
    try:
        text = path.read_text(encoding="utf-8-sig")
    except OSError:
        return None
    for name, value in _parse_dotenv(text).items():
        if name not in os.environ:
            os.environ[name] = value
            _dotenv_names.add(name)
    _dotenv_source = str(path)
    return _dotenv_source


def provider_for_base_url(base_url: Optional[str]) -> str:
    """Name the provider that serves a base_url: anthropic, openai, openrouter or custom."""
    host = urlparse(base_url or OPENROUTER_BASE_URL).hostname or ""
    for needle, name in _HOST_PROVIDERS:
        if host == needle or host.endswith("." + needle):
            return name
    return "custom"


def _warn_on_key_prefix(env_var: str, key: str, provider: str) -> None:
    """Warn once when a key looks like it was issued by a different provider."""
    global _warned_key_prefix
    if _warned_key_prefix:
        return
    for prefix, issuer in _KEY_PREFIXES:
        if key.startswith(prefix) and issuer != provider:
            _warned_key_prefix = True
            warnings.warn(
                f"{env_var} holds what looks like a {issuer} key. Using {provider} "
                f"because of the variable name; set VIBE_API_KEY with VIBE_BASE_URL "
                "to choose the endpoint explicitly.",
                stacklevel=3,
            )
            return


def _key_source(env_var: str) -> str:
    """Describe where a key came from, naming the .env file when one supplied it."""
    if env_var in _dotenv_names and _dotenv_source:
        return f"{env_var} ({_dotenv_source})"
    return env_var


def resolve_endpoint_from_env(base_url: Optional[str], model: Optional[str] = None) -> tuple:
    """Infer (api_key, base_url, model, key_source) from the environment and model id."""
    load_dotenv()
    endpoint = base_url or os.environ.get("VIBE_BASE_URL") or None
    vibe_key = os.environ.get("VIBE_API_KEY")

    if endpoint:
        provider = provider_for_base_url(endpoint)
        # A custom endpoint has no default of its own, so the OpenRouter default
        # stands in and the host answers with a clear "no such model" if it is wrong.
        model = PROVIDER_DEFAULTS.get(provider, {}).get("model", DEFAULT_MODEL)
        if vibe_key:
            return vibe_key, endpoint, model, _key_source("VIBE_API_KEY")
        env_var = dict(PROVIDER_ENV_VARS).get(provider)
        key = os.environ.get(env_var) if env_var else None
        if not key and (urlparse(endpoint).hostname or "") in LOOPBACK_HOSTS:
            # Ollama and vLLM ignore the key, but the OpenAI client demands one.
            return "local", endpoint, model, "loopback default"
        return key, endpoint, model, _key_source(env_var) if key else None

    if vibe_key:
        return vibe_key, OPENROUTER_BASE_URL, DEFAULT_MODEL, _key_source("VIBE_API_KEY")

    # A vendor/model id only exists on OpenRouter, so its key wins for one when
    # the endpoint was not pinned. Without that key the normal order applies and
    # Config.check_model() explains why the id cannot work.
    order = PROVIDER_ENV_VARS
    if model and "/" in model and os.environ.get("OPENROUTER_API_KEY"):
        order = (("openrouter", "OPENROUTER_API_KEY"),)

    for provider, env_var in order:
        key = os.environ.get(env_var)
        if key:
            _warn_on_key_prefix(env_var, key, provider)
            defaults = PROVIDER_DEFAULTS[provider]
            return key, defaults["base_url"], defaults["model"], _key_source(env_var)

    return None, OPENROUTER_BASE_URL, DEFAULT_MODEL, None


def _validate_settings(data_privacy: str, sample_rows: int, timeout: float) -> None:
    """Raise ValueError if any data-disclosure or timeout setting is out of range."""
    if data_privacy not in DATA_PRIVACY_MODES:
        raise ValueError(f"Invalid data_privacy: {data_privacy}. Must be 'sample' or 'schema'")

    if not isinstance(sample_rows, int) or isinstance(sample_rows, bool) or sample_rows < 0:
        raise ValueError("sample_rows must be a non-negative integer")

    if not isinstance(timeout, (int, float)) or isinstance(timeout, bool) or timeout <= 0:
        raise ValueError("timeout must be a positive number of seconds")


def _api_key_from_env(base_url: Optional[str]) -> Optional[str]:
    """Resolve an API key from the environment for the configured endpoint."""
    return resolve_endpoint_from_env(base_url)[0]

_OPENROUTER_MODELS_CACHE: Optional[dict[str, Any]] = None
_OPENROUTER_MODELS_CACHE_TS: Optional[float] = None


class ModelsCatalog(dict):
    """Dict-like return type with a concise notebook-friendly repr."""

    def __repr__(self) -> str:  # pragma: no cover
        keys = list(self.keys())
        if not keys:
            return "ModelsCatalog({})"

        openrouter = self.get("openrouter", {})
        standard = openrouter.get("standard", [])
        premium = openrouter.get("premium", [])
        latest = openrouter.get("latest", [])
        return (
            "ModelsCatalog("
            f"standard={len(standard)}, premium={len(premium)}, latest={len(latest)}"
            ")  # Use dict(vw.models(...)) to see full data"
        )

    def __str__(self) -> str:  # pragma: no cover
        return self.__repr__()

    def _repr_pretty_(self, p, cycle) -> None:  # pragma: no cover
        p.text(self.__repr__())


def _fetch_openrouter_models(
    refresh: bool = True,
    cache_ttl_seconds: int = 3600,
    timeout_seconds: int = 10,
) -> Optional[list[str]]:
    """Fetch the latest OpenRouter model IDs (best-effort)."""
    global _OPENROUTER_MODELS_CACHE, _OPENROUTER_MODELS_CACHE_TS

    now = time.time()
    if (
        not refresh
        and _OPENROUTER_MODELS_CACHE is not None
        and _OPENROUTER_MODELS_CACHE_TS is not None
        and (now - _OPENROUTER_MODELS_CACHE_TS) < cache_ttl_seconds
    ):
        return _OPENROUTER_MODELS_CACHE.get("ids")

    try:
        headers = {}
        api_key = os.getenv("OPENROUTER_API_KEY")
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        resp = requests.get(
            "https://openrouter.ai/api/v1/models",
            headers=headers or None,
            timeout=timeout_seconds,
        )
        resp.raise_for_status()
        data = resp.json()
        model_items = data.get("data", [])
        ids = sorted(
            {
                item.get("id")
                for item in model_items
                if isinstance(item, dict) and item.get("id")
            }
        )

        _OPENROUTER_MODELS_CACHE = {"ids": ids}
        _OPENROUTER_MODELS_CACHE_TS = now
        return ids
    except Exception:
        return None

# Build model mappings from manifest
def _build_model_maps() -> tuple[dict, dict]:
    """Build premium and standard model mappings from manifest."""
    premium: dict[str, str] = {}
    standard: dict[str, str] = {}

    # OpenRouter is the single gateway; use the first item in each tier as default.
    openrouter_manifest = MODELS_MANIFEST.get("openrouter", {})

    if openrouter_manifest.get("premium"):
        premium_model = openrouter_manifest["premium"][0]["id"]
        premium["openrouter"] = premium_model

    if openrouter_manifest.get("standard"):
        standard_model = openrouter_manifest["standard"][0]["id"]
        standard["openrouter"] = standard_model

    return premium, standard


PREMIUM_MODELS, STANDARD_MODELS = _build_model_maps()



@dataclass
class Config:
    """Configuration for Vibe Widget LLM models."""

    model: Optional[str] = None  # None means the inferred provider's default model
    api_key: Optional[str] = None
    base_url: Optional[str] = None  # None means infer from whichever API key is set
    temperature: float = 0.7
    timeout: float = 120.0
    streaming: bool = True
    data_privacy: str = "sample"  # "sample" | "schema"
    sample_rows: int = 3
    mode: str = "standard"  # "standard" (fast/cheap models) or "premium" (powerful/expensive models)
    theme: Any = None
    execution: str = "auto"  # "auto" or "approve"
    retry: int = 2  # Runtime repair attempts before blocking
    agent_preset: str = "project"
    agent_run: Optional[dict[str, Any]] = None
    bypass_row_guard: bool = False

    def __repr__(self) -> str:
        return (
            "Config("
            f"provider={self.provider!r}, "
            f"host={urlparse(self.base_url or OPENROUTER_BASE_URL).hostname!r}, "
            f"model={self.model!r}, "
            f"key_source={self.key_source!r}, "
            f"environment={self.environment!r}, "
            f"temperature={self.temperature!r}, "
            f"timeout={self.timeout!r}, "
            f"streaming={self.streaming!r}, "
            f"data_privacy={self.data_privacy!r}, "
            f"sample_rows={self.sample_rows!r}, "
            f"mode={self.mode!r}, "
            f"theme={self.theme!r}, "
            f"execution={self.execution!r}, "
            f"retry={self.retry!r}, "
            f"agent_preset={self.agent_preset!r}, "
            f"agent_run={self.agent_run!r}, "
            f"bypass_row_guard={self.bypass_row_guard!r}"
            ")"
        )

    def __str__(self) -> str:  # pragma: no cover
        return self.__repr__()

    def __post_init__(self):
        """Resolve model name, endpoint and API key from environment."""
        self.key_source: Optional[str] = None
        # An inferred endpoint must be re-inferred when the model changes; one the
        # caller pinned must not be.
        self._explicit_base_url: bool = self.base_url is not None
        self._resolve_endpoint()

        model_map = PREMIUM_MODELS if self.mode == "premium" else STANDARD_MODELS
        self.model = model_map.get(self.model, self.model)
        self.check_model()

    @property
    def provider(self) -> str:
        """Provider serving the endpoint: anthropic, openai, openrouter or custom."""
        return provider_for_base_url(self.base_url)

    @property
    def environment(self) -> str:
        """Notebook hosts detected for this kernel, comma separated."""
        from vibe_widget.utils.platform import describe_environment

        return describe_environment()

    def check_model(self) -> None:
        """Reject an OpenRouter-style vendor/model id on a direct provider endpoint."""
        provider = self.provider
        if provider in ("anthropic", "openai") and self.model and "/" in self.model:
            raise ValueError(
                f"Model {self.model!r} is an OpenRouter id, but the endpoint is "
                f"{provider}. Use a plain {provider} model name such as "
                f"{PROVIDER_DEFAULTS[provider]['model']!r}, or route through OpenRouter "
                f"with vw.config(base_url={OPENROUTER_BASE_URL!r})."
            )

    def _resolve_endpoint(self) -> None:
        """Fill in endpoint, model and API key from the environment where unset."""
        explicit_key = self.api_key
        pinned = self.base_url if getattr(self, "_explicit_base_url", True) else None
        key, base_url, model, source = resolve_endpoint_from_env(pinned, self.model)
        self.base_url = base_url
        if not self.model:
            self.model = model
        if explicit_key:
            self.api_key, self.key_source = explicit_key, "api_key argument"
        else:
            self.api_key, self.key_source = key, source

    def _get_api_key_from_env(self) -> Optional[str]:
        """Re-read the API key from the environment for the configured endpoint."""
        self.api_key = None
        self._resolve_endpoint()
        return self.api_key

    def validate_settings(self) -> None:
        """Validate the settings that do not depend on an API key being present."""
        _validate_settings(self.data_privacy, self.sample_rows, self.timeout)

    def validate(self):
        """Validate that the configuration has required fields."""
        # Validate mode
        if self.mode not in ["standard", "premium"]:
            raise ValueError(f"Invalid mode: {self.mode}. Must be 'standard' or 'premium'")

        if self.execution not in ["auto", "approve"]:
            raise ValueError("Invalid execution mode. Must be 'auto' or 'approve'")

        if not isinstance(self.retry, int) or self.retry < 0:
            raise ValueError("retry must be a non-negative integer")

        self.validate_settings()

        if not self.model:
            raise ValueError("No model specified")

        self.check_model()

        # Both modes just need the appropriate API key for the selected model
        if not self.api_key:
            raise ValueError(NO_API_KEY_MESSAGE)

    def to_dict(self) -> dict:
        """Convert configuration to dictionary."""
        theme_value = self.theme
        if theme_value is not None and not isinstance(theme_value, (str, int, float, bool)):
            if hasattr(theme_value, "name") and theme_value.name:
                theme_value = theme_value.name
            elif hasattr(theme_value, "description") and theme_value.description:
                theme_value = theme_value.description
            else:
                theme_value = str(theme_value)
        return {
            "model": self.model,
            "api_key": self.api_key,
            "base_url": self.base_url,
            "temperature": self.temperature,
            "timeout": self.timeout,
            "streaming": self.streaming,
            "data_privacy": self.data_privacy,
            "sample_rows": self.sample_rows,
            "mode": self.mode,
            "theme": theme_value,
            "execution": self.execution,
            "retry": self.retry,
            "agent_preset": self.agent_preset,
            "agent_run": self.agent_run,
            "bypass_row_guard": self.bypass_row_guard,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Config":
        """Create configuration from dictionary, ignoring keys this version dropped."""
        known = {k: v for k, v in data.items() if k in cls.__dataclass_fields__}
        return cls(**known)


# Global configuration instance
_global_config: Optional[Config] = None


def get_global_config() -> Config:
    """Get the global configuration instance."""
    global _global_config
    if _global_config is None:
        _global_config = Config()
    return _global_config


def set_global_config(config: Config):
    """Set the global configuration instance."""
    global _global_config
    _global_config = config


def config(
    model: str = None,
    api_key: str = None,
    temperature: float = None,
    mode: str = None,
    theme: Any = None,
    execution: str = None,
    retry: int = None,
    agent_preset: str = None,
    agent_run: Optional[dict[str, Any]] = None,
    bypass_row_guard: Optional[bool] = None,
    base_url: Optional[str] = None,
    timeout: Optional[float] = None,
    data_privacy: Optional[str] = None,
    sample_rows: Optional[int] = None,
    **kwargs
) -> Config:
    """
    Configure Vibe Widget with model settings.

    Args:
        model: Model name or ID (OpenRouter-supported)
        api_key: API key for the model provider
        temperature: Temperature setting for generation
        mode: "standard" (fast/cheap models) or "premium" (powerful/expensive models)
        theme: Theme name/prompt or Theme object to use by default
        execution: "auto" (runs immediately) or "approve" (review before run)
        retry: Runtime repair attempts before blocking
        base_url: OpenAI-compatible endpoint; None infers it from whichever key is set
        timeout: HTTP timeout in seconds
        data_privacy: "sample" sends a few rows, "schema" sends no cell values
        sample_rows: Rows included per input when data_privacy is "sample"
        **kwargs: Any other Config field; unknown names raise TypeError

    Returns:
        Configuration instance

    Examples:
        >>> # No arguments: provider, endpoint and model come from whichever of
        >>> # ANTHROPIC_API_KEY, OPENAI_API_KEY or OPENROUTER_API_KEY is set.
        >>> vw.config()
        >>>
        >>> # A plain name stays on the inferred provider.
        >>> vw.config(model="claude-sonnet-5")      # with ANTHROPIC_API_KEY
        >>> vw.config(model="gpt-5.5")              # with OPENAI_API_KEY
        >>>
        >>> # A vendor/model id needs the OpenRouter endpoint.
        >>> vw.config(model="openai/gpt-5.1-codex")  # with OPENROUTER_API_KEY
        >>> vw.config(mode="premium", model="openrouter")
        >>> vw.config(theme="financial times")
        >>> vw.config(execution="approve")
        >>> vw.config(retry=3)
        >>> vw.config(bypass_row_guard=True)
        >>> vw.config(base_url="http://localhost:11434/v1", model="qwen2.5-coder")
        >>> vw.config(data_privacy="schema")
    """
    global _global_config

    # The first call passes kwargs to Config(**kwargs) and later calls setattr them,
    # so reject unknown names up front to keep both paths identical.
    unknown = [key for key in kwargs if key not in Config.__dataclass_fields__]
    if unknown:
        raise TypeError(f"config() got an unexpected keyword argument {unknown[0]!r}")

    # Reject out-of-range values before anything is mutated.
    _validate_settings(
        data_privacy if data_privacy is not None else getattr(_global_config, "data_privacy", "sample"),
        sample_rows if sample_rows is not None else getattr(_global_config, "sample_rows", 3),
        timeout if timeout is not None else getattr(_global_config, "timeout", 120.0),
    )

    # Create new config or update existing
    if _global_config is None:
        _global_config = Config(
            model=model,
            api_key=api_key,
            base_url=base_url,
            temperature=temperature if temperature is not None else 0.7,
            timeout=timeout if timeout is not None else 120.0,
            data_privacy=data_privacy or "sample",
            sample_rows=sample_rows if sample_rows is not None else 3,
            mode=mode or "standard",
            theme=theme,
            execution=execution or "auto",
            retry=retry if retry is not None else 2,
            agent_preset=agent_preset or "project",
            agent_run=agent_run,
            bypass_row_guard=bool(bypass_row_guard) if bypass_row_guard is not None else False,
            **kwargs
        )
    else:
        # Fields are assigned in place and several checks raise part way
        # through, so keep the whole update all-or-nothing.
        snapshot = dict(_global_config.__dict__)
        try:
            if base_url is not None:
                _global_config.base_url = base_url or None
                _global_config._explicit_base_url = bool(base_url)

            if model is not None:
                model_map = PREMIUM_MODELS if _global_config.mode == "premium" else STANDARD_MODELS
                _global_config.model = model_map.get(model, model)
                if api_key is None:
                    _global_config.api_key = _global_config._get_api_key_from_env()

            # Handle API key: if provided, use it; otherwise reload from env
            if api_key is not None:
                _global_config.api_key = api_key
                _global_config.key_source = "api_key argument"
            else:
                # When api_key is None (not provided), always reload from environment
                _global_config.api_key = _global_config._get_api_key_from_env()

            if temperature is not None:
                _global_config.temperature = temperature

            if timeout is not None:
                _global_config.timeout = timeout

            if data_privacy is not None:
                _global_config.data_privacy = data_privacy

            if sample_rows is not None:
                _global_config.sample_rows = sample_rows

            if mode is not None:
                _global_config.mode = mode
                model_map = PREMIUM_MODELS if mode == "premium" else STANDARD_MODELS
                if _global_config.model == PREMIUM_MODELS.get("openrouter") or _global_config.model == STANDARD_MODELS.get("openrouter"):
                    _global_config.model = model_map.get("openrouter", _global_config.model)

            if theme is not None:
                _global_config.theme = theme

            if execution is not None:
                if execution not in ["auto", "approve"]:
                    raise ValueError("execution must be 'auto' or 'approve'")
                _global_config.execution = execution

            if retry is not None:
                if not isinstance(retry, int) or retry < 0:
                    raise ValueError("retry must be a non-negative integer")
                _global_config.retry = retry

            if agent_preset is not None:
                _global_config.agent_preset = agent_preset

            if agent_run is not None:
                _global_config.agent_run = agent_run

            if bypass_row_guard is not None:
                _global_config.bypass_row_guard = bool(bypass_row_guard)

            for key, value in kwargs.items():
                setattr(_global_config, key, value)

            if not _global_config.api_key:
                _global_config.api_key = _global_config._get_api_key_from_env()

            _global_config.check_model()
        except Exception:
            _global_config.__dict__.clear()
            _global_config.__dict__.update(snapshot)
            raise

    return _global_config


def models(
    provider: Optional[str] = None,
    mode: Optional[str] = None,
    *,
    refresh: bool = True,
    verbose: bool = True,
    show: Literal["summary", "all", "none"] = "summary",
    limit: int = 30,
) -> dict[str, dict[str, list[str]]]:
    """
    Get available model IDs (OpenRouter), optionally fetching the latest list.

    Args:
        provider: Optional provider filter ("openrouter")
        mode: Optional mode filter ("standard" or "premium")
        refresh: When True, tries to fetch latest models from OpenRouter
        verbose: When True, prints helpful config instructions
        show: "summary" prints defaults + pinned options; "all" also prints a live list; "none" prints nothing
        limit: Max models to print per provider group

    Returns:
        Dictionary of available models by provider and tier

    Examples:
        >>> # Get all models
        >>> vw.models()

        >>> # Get models for a specific provider
        >>> vw.models("openrouter")

        >>> # Get premium defaults
        >>> vw.models("openrouter", mode="premium")
    """
    result: dict[str, dict[str, list[str]]] = {}

    provider_key = (provider or "openrouter").lower()
    if provider_key != "openrouter":
        provider_key = "openrouter"

    provider_manifest = MODELS_MANIFEST.get("openrouter", {})
    manifest_standard = [m["id"] for m in provider_manifest.get("standard", [])]
    manifest_premium = [m["id"] for m in provider_manifest.get("premium", [])]

    latest_ids = _fetch_openrouter_models(refresh=refresh)
    latest_ids = latest_ids or []

    def _filter_prefix(prefix: str) -> list[str]:
        return [m for m in latest_ids if m.startswith(prefix)]

    data: dict[str, list[str]] = {
        "defaults": [
            f"standard={STANDARD_MODELS.get('openrouter')}",
            f"premium={PREMIUM_MODELS.get('openrouter')}",
        ],
        "standard": manifest_standard,
        "premium": manifest_premium,
        "latest": latest_ids,
        "google": _filter_prefix("google/"),
        "anthropic": _filter_prefix("anthropic/"),
        "openai": _filter_prefix("openai/"),
    }

    if mode in {"standard", "premium"}:
        data = {
            "defaults": data["defaults"],
            mode: data[mode],
            "latest": data["latest"],
            "google": data["google"],
            "anthropic": data["anthropic"],
            "openai": data["openai"],
        }

    result[provider_key] = data

    if verbose and show != "none":
        standard_default = STANDARD_MODELS.get("openrouter")
        premium_default = PREMIUM_MODELS.get("openrouter")

        active = get_global_config()
        print("Model selection (OpenRouter catalog)")
        print(f"Active: provider={active.provider}, model={active.model}")
        print("Defaults:")
        print(f"  default: {DEFAULT_MODEL}")
        print(f'  vw.config(model="openrouter")  # -> {standard_default}')
        print(f'  vw.config(model="openrouter", mode="premium")  # -> {premium_default}')
        print("Explicit examples:")
        print(f'  vw.config(model="{standard_default}")')
        print(f'  vw.config(model="{premium_default}", mode="premium")')
        print("Pinned options:")
        print(f"  standard: {manifest_standard}")
        print(f"  premium:  {manifest_premium}")
        print('More: `vw.models(show="all")` or `vw.models(verbose=False)`.\n')
        print(
            "Tip: these ids need OPENROUTER_API_KEY. With ANTHROPIC_API_KEY or "
            "OPENAI_API_KEY, use that provider's own model names.\n"
        )

        if show == "all":
            if latest_ids:
                def _print_group(name: str, ids: list[str]) -> None:
                    if not ids:
                        return
                    shown = ids[: max(0, limit)]
                    suffix = "" if len(ids) <= len(shown) else f" (+{len(ids) - len(shown)} more)"
                    print(f"{name} models ({len(ids)}):{suffix}")
                    for mid in shown:
                        print(f"  - {mid}")
                    print()

                _print_group("google", data.get("google", []))
                _print_group("anthropic", data.get("anthropic", []))
                _print_group("openai", data.get("openai", []))
            else:
                print(
                    "Could not fetch the latest OpenRouter model list right now; "
                    "returning the pinned manifest models.\n"
                )

    return ModelsCatalog(result)
