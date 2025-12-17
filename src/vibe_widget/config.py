"""
Simplified configuration management for Vibe Widget.
"""

import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Literal
from pathlib import Path
import json
import time

import requests

# Load models manifest
def _load_models_manifest() -> Dict[str, Any]:
    """Load the models manifest from JSON file."""
    manifest_path = Path(__file__).parent / "models_manifest.json"
    with open(manifest_path, "r") as f:
        return json.load(f)

MODELS_MANIFEST = _load_models_manifest()

_OPENROUTER_MODELS_CACHE: dict[str, Any] | None = None
_OPENROUTER_MODELS_CACHE_TS: float | None = None


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
) -> list[str] | None:
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

# Keep LATEST_MODELS for backward compatibility (tracks the default standard choice)
LATEST_MODELS = {"openrouter": STANDARD_MODELS.get("openrouter") or PREMIUM_MODELS.get("openrouter")}


@dataclass
class Config:
    """Configuration for Vibe Widget LLM models."""
    
    model: str = "openrouter"  # Default to OpenRouter standard tier
    api_key: Optional[str] = None
    temperature: float = 0.7
    streaming: bool = True
    mode: str = "standard"  # "standard" (fast/cheap models) or "premium" (powerful/expensive models)
    
    def __post_init__(self):
        """Resolve model name and load API key from environment."""
        # Handle simple provider names based on mode
        model_map = PREMIUM_MODELS if self.mode == "premium" else STANDARD_MODELS
        
        if self.model in model_map:
            self.model = model_map[self.model]
        
        # Load API key from environment if not provided
        if not self.api_key:
            self.api_key = self._get_api_key_from_env()
    
    def _get_api_key_from_env(self) -> Optional[str]:
        """Get the appropriate API key from environment based on model."""
        return os.getenv("OPENROUTER_API_KEY")
    
    def validate(self):
        """Validate that the configuration has required fields."""
        # Validate mode
        if self.mode not in ["standard", "premium"]:
            raise ValueError(f"Invalid mode: {self.mode}. Must be 'standard' or 'premium'")
        
        if not self.model:
            raise ValueError("No model specified")
        
        # Both modes just need the appropriate API key for the selected model
        if not self.api_key:
            raise ValueError(
                f"No API key found for {self.model}. "
                "Set OPENROUTER_API_KEY (or pass api_key parameter)."
            )
    
    def to_dict(self) -> dict:
        """Convert configuration to dictionary."""
        return {
            "model": self.model,
            "api_key": self.api_key,
            "temperature": self.temperature,
            "streaming": self.streaming,
            "mode": self.mode,
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "Config":
        """Create configuration from dictionary."""
        return cls(**data)
    
    def save(self, path: Optional[Path] = None):
        """Save configuration to file (without API key for security)."""
        if path is None:
            path = Path.home() / ".vibe_widget" / "config.json"
        
        path.parent.mkdir(parents=True, exist_ok=True)
        
        # Don't save API keys to file
        data = self.to_dict()
        data["api_key"] = None
        
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
    
    @classmethod
    def load(cls, path: Optional[Path] = None) -> "Config":
        """Load configuration from file."""
        if path is None:
            path = Path.home() / ".vibe_widget" / "config.json"
        
        if not path.exists():
            return cls()
        
        with open(path, "r") as f:
            data = json.load(f)
        
        return cls.from_dict(data)


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
    **kwargs
) -> Config:
    """
    Configure Vibe Widget with model settings.
    
    Args:
        model: Model name or ID (OpenRouter-supported)
        api_key: API key for the model provider
        temperature: Temperature setting for generation
        mode: "standard" (fast/cheap models) or "premium" (powerful/expensive models)
        **kwargs: Additional configuration options
    
    Returns:
        Configuration instance
    
    Examples:
        >>> import vibe_widget as vw
        >>> 
        >>> # Standard mode (default) - fast/affordable
        >>> vw.config(model="openrouter")   # Uses google/gemini-2.5-flash
        >>>
        >>> # Premium mode - stronger models
        >>> vw.config(mode="premium", model="openrouter")  # Uses google/gemini-3-pro-preview
        >>>
        >>> # Use specific model IDs
        >>> vw.config(model="openai/gpt-5.1-codex")
        >>> vw.config(model="anthropic/claude-opus-4.5")
    """
    global _global_config
    
    # Create new config or update existing
    if _global_config is None:
        _global_config = Config(
            model=model or "openrouter",
            api_key=api_key,
            temperature=temperature or 0.7,
            mode=mode or "standard",
            **kwargs
        )
    else:
        # Update existing config
        if model is not None:
            _global_config.model = model
            # Re-resolve if it's a shortcut based on current mode
            model_map = PREMIUM_MODELS if _global_config.mode == "premium" else STANDARD_MODELS
            if model in model_map:
                _global_config.model = model_map[model]
            # When model changes, reload the appropriate API key
            if api_key is None:
                _global_config.api_key = _global_config._get_api_key_from_env()
        
        # Handle API key: if provided, use it; otherwise reload from env
        if api_key is not None:
            _global_config.api_key = api_key
        else:
            # When api_key is None (not provided), always reload from environment
            # This ensures we pick up the right key for the current model
            _global_config.api_key = _global_config._get_api_key_from_env()
        
        if temperature is not None:
            _global_config.temperature = temperature
        
        if mode is not None:
            _global_config.mode = mode
            # If mode changed and we have a shortcut model, re-resolve it
            model_map = PREMIUM_MODELS if mode == "premium" else STANDARD_MODELS
            if _global_config.model == PREMIUM_MODELS.get("openrouter") or _global_config.model == STANDARD_MODELS.get("openrouter"):
                _global_config.model = model_map.get("openrouter", _global_config.model)
        
        # Update any additional kwargs
        for key, value in kwargs.items():
            if hasattr(_global_config, key):
                setattr(_global_config, key, value)
        
        # Re-load API key if needed
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
) -> Dict[str, Dict[str, List[str]]]:
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
        >>> import vibe_widget as vw
        >>> 
        >>> # Get all models
        >>> vw.models()
        
        >>> # Get models for a specific provider
        >>> vw.models("openrouter")
        
        >>> # Get only premium models
        >>> vw.models(mode="premium")
        
        >>> # Get premium defaults
        >>> vw.models("openrouter", mode="premium")
    """
    result: Dict[str, Dict[str, List[str]]] = {}

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

    data: Dict[str, List[str]] = {
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
