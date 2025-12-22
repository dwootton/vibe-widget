"""
Simplified configuration management for Vibe Widget.
"""

import os
from dataclasses import dataclass
from typing import Any, Dict, Optional
from pathlib import Path
import json

# Load models manifest
def _load_models_manifest() -> Dict[str, Any]:
    """Load the models manifest from JSON file."""
    manifest_path = Path(__file__).parent / "models_manifest.json"
    with open(manifest_path, "r") as f:
        return json.load(f)

MODELS_MANIFEST = _load_models_manifest()

DEFAULT_MODEL = "google/gemini-3-flash-preview"

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
    
    model: str = DEFAULT_MODEL  # Default to Gemini Flash preview via OpenRouter
    api_key: Optional[str] = None
    temperature: float = 0.7
    streaming: bool = True
    mode: str = "standard"  # "standard" (fast/cheap models) or "premium" (powerful/expensive models)
    theme: Any = None
    
    def __post_init__(self):
        """Resolve model name and load API key from environment."""
        model_map = PREMIUM_MODELS if self.mode == "premium" else STANDARD_MODELS
        self.model = model_map.get(self.model, self.model)
        
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
        theme_value = self.theme
        if theme_value is not None and not isinstance(theme_value, (str, int, float, bool)):
            if hasattr(theme_value, "name") and getattr(theme_value, "name"):
                theme_value = getattr(theme_value, "name")
            elif hasattr(theme_value, "description") and getattr(theme_value, "description"):
                theme_value = getattr(theme_value, "description")
            else:
                theme_value = str(theme_value)
        return {
            "model": self.model,
            "api_key": self.api_key,
            "temperature": self.temperature,
            "streaming": self.streaming,
            "mode": self.mode,
            "theme": theme_value,
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
    theme: Any = None,
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
        **kwargs: Additional configuration options
    
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
    """
    global _global_config
    
    # Create new config or update existing
    if _global_config is None:
        _global_config = Config(
            model=model or DEFAULT_MODEL,
            api_key=api_key,
            temperature=temperature or 0.7,
            mode=mode or "standard",
            theme=theme,
            **kwargs
        )
    else:
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
        
        if mode is not None:
            _global_config.mode = mode
            model_map = PREMIUM_MODELS if mode == "premium" else STANDARD_MODELS
            if _global_config.model == PREMIUM_MODELS.get("openrouter") or _global_config.model == STANDARD_MODELS.get("openrouter"):
                _global_config.model = model_map.get("openrouter", _global_config.model)

        if theme is not None:
            _global_config.theme = theme
        
        for key, value in kwargs.items():
            if hasattr(_global_config, key):
                setattr(_global_config, key, value)
        
        if not _global_config.api_key:
            _global_config.api_key = _global_config._get_api_key_from_env()
    
    return _global_config

