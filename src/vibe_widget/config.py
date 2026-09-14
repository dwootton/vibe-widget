"""
Simplified configuration management for Vibe Widget.
"""

import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Optional

import requests


# Load models manifest
def _load_models_manifest() -> dict[str, Any]:
    """Load the models manifest from JSON file."""
    manifest_path = Path(__file__).parent / "models_manifest.json"
    with open(manifest_path) as f:
        return json.load(f)

MODELS_MANIFEST = _load_models_manifest()

DEFAULT_MODEL = "google/gemini-3-flash-preview"
DATA_PRIVACY_MODES = ("sample", "schema")


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
    key = os.getenv("VIBE_API_KEY") or os.getenv("OPENROUTER_API_KEY")
    if not key and base_url and "openrouter.ai" not in base_url:
        key = os.getenv("OPENAI_API_KEY")
    return key

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

    if (
        _OPENROUTER_MODELS_CACHE is not None
        and _OPENROUTER_MODELS_CACHE_TS is not None
        and (now - _OPENROUTER_MODELS_CACHE_TS) < cache_ttl_seconds
        and not refresh
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

    model: str = DEFAULT_MODEL  # Default to Gemini Flash preview via OpenRouter
    api_key: Optional[str] = None
    base_url: Optional[str] = None  # None means OpenRouter
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

    def __repr__(self) -> str:  # pragma: no cover
        masked_key = "****" if self.api_key else None
        return (
            "Config("
            f"model={self.model!r}, "
            f"api_key={masked_key!r}, "
            f"base_url={self.base_url!r}, "
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
        model_map = PREMIUM_MODELS if self.mode == "premium" else STANDARD_MODELS
        self.model = model_map.get(self.model, self.model)

        if self.base_url is None:
            self.base_url = os.getenv("VIBE_BASE_URL") or None

        if not self.api_key:
            self.api_key = self._get_api_key_from_env()

    def _get_api_key_from_env(self) -> Optional[str]:
        """Get the API key from environment for the configured endpoint."""
        return _api_key_from_env(self.base_url)

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

        # Both modes just need the appropriate API key for the selected model
        if not self.api_key:
            raise ValueError(
                f"No API key found for {self.model}. "
                "Set VIBE_API_KEY or OPENROUTER_API_KEY (or pass api_key parameter)."
            )

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
        base_url: OpenAI-compatible endpoint; None means OpenRouter
        timeout: HTTP timeout in seconds
        data_privacy: "sample" sends a few rows, "schema" sends no cell values
        sample_rows: Rows included per input when data_privacy is "sample"
        **kwargs: Any other Config field; unknown names raise TypeError

    Returns:
        Configuration instance

    Examples:
        >>> # Standard mode (default) - fast/affordable
        >>> vw.config()   # Uses google/gemini-3-flash-preview
        >>>
        >>> # Premium mode - stronger models
        >>> vw.config(mode="premium", model="openrouter")  # Uses google/gemini-3-pro-preview
        >>>
        >>> # Use specific model IDs
        >>> vw.config(model="openai/gpt-5.1-codex")
        >>> vw.config(model="anthropic/claude-opus-4.5")
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
            model=model or DEFAULT_MODEL,
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
        if base_url is not None:
            _global_config.base_url = base_url or None

        if model is not None:
            model_map = PREMIUM_MODELS if _global_config.mode == "premium" else STANDARD_MODELS
            _global_config.model = model_map.get(model, model)
            if api_key is None:
                _global_config.api_key = _global_config._get_api_key_from_env()

        # Handle API key: if provided, use it; otherwise reload from env
        if api_key is not None:
            _global_config.api_key = api_key
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

        print("Model selection (OpenRouter)")
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
        print("Tip: set OPENROUTER_API_KEY in your environment.\n")

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
