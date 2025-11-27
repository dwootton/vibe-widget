"""
Simplified configuration management for Vibe Widget.
"""

import os
from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from pathlib import Path
import json


# Load models manifest
def _load_models_manifest() -> Dict[str, Any]:
    """Load the models manifest from JSON file."""
    manifest_path = Path(__file__).parent / "models_manifest.json"
    with open(manifest_path, "r") as f:
        return json.load(f)

MODELS_MANIFEST = _load_models_manifest()

# Build model mappings from manifest
def _build_model_maps() -> tuple[dict, dict]:
    """Build premium and standard model mappings from manifest."""
    premium = {}
    standard = {}
    
    for provider, tiers in MODELS_MANIFEST.items():
        # Get first model from each tier as default
        if tiers.get("premium"):
            model_id = tiers["premium"][0]["id"]
            if provider == "openai":
                premium["openai"] = model_id
                premium["gpt"] = model_id
            elif provider == "anthropic":
                premium["anthropic"] = model_id
                premium["claude"] = model_id
            elif provider == "google_gemini":
                premium["google"] = model_id
                premium["gemini"] = model_id
        
        if tiers.get("standard"):
            model_id = tiers["standard"][0]["id"]
            if provider == "openai":
                standard["openai"] = model_id
                standard["gpt"] = model_id
            elif provider == "anthropic":
                standard["anthropic"] = model_id
                standard["claude"] = model_id
            elif provider == "google_gemini":
                standard["google"] = model_id
                standard["gemini"] = model_id
    
    return premium, standard

PREMIUM_MODELS, STANDARD_MODELS = _build_model_maps()

# Keep LATEST_MODELS for backward compatibility (points to premium)
LATEST_MODELS = PREMIUM_MODELS


@dataclass
class Config:
    """Configuration for Vibe Widget LLM models."""
    
    model: str = "anthropic"  # Default to latest Claude
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
        # Check which model we're using and get the right key
        if "claude" in self.model or "anthropic" in self.model:
            return os.getenv("ANTHROPIC_API_KEY")
        elif "gpt" in self.model or "openai" in self.model:
            return os.getenv("OPENAI_API_KEY")
        elif "gemini" in self.model or "google" in self.model:
            return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        
        # Fallback: check all common API keys
        return (
            os.getenv("ANTHROPIC_API_KEY") or
            os.getenv("OPENAI_API_KEY") or
            os.getenv("GEMINI_API_KEY") or
            os.getenv("GOOGLE_API_KEY")
        )
    
    def validate(self):
        """Validate that the configuration has required fields."""
        # Validate mode
        if self.mode not in ["standard", "premium"]:
            raise ValueError(f"Invalid mode: {self.mode}. Must be 'standard' or 'premium'")
        
        if not self.model:
            raise ValueError("No model specified")
        
        # Both modes just need the appropriate API key for the selected model
        if not self.api_key:
            # Provide helpful error message based on model
            if "claude" in self.model:
                key_name = "ANTHROPIC_API_KEY"
            elif "gpt" in self.model:
                key_name = "OPENAI_API_KEY"
            elif "gemini" in self.model:
                key_name = "GEMINI_API_KEY or GOOGLE_API_KEY"
            else:
                key_name = "API_KEY"
            
            raise ValueError(
                f"No API key found for {self.model}. "
                f"Set {key_name} environment variable or pass api_key parameter."
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
        model: Model name or shortcut ("anthropic", "openai", "google")
        api_key: API key for the model provider
        temperature: Temperature setting for generation
        mode: "standard" (fast/cheap models) or "premium" (powerful/expensive models)
        **kwargs: Additional configuration options
    
    Returns:
        Configuration instance
    
    Examples:
        >>> import vibe_widget as vw
        >>> 
        >>> # Standard mode (default) - uses fast/cheap models
        >>> vw.config(model="gemini")   # Uses gemini-1.5-flash
        >>> vw.config(model="claude")   # Uses claude-3-haiku
        >>> vw.config(model="openai")   # Uses gpt-3.5-turbo
        >>> 
        >>> # Premium mode - uses powerful/expensive models
        >>> vw.config(mode="premium", model="gemini")  # Uses gemini-1.5-pro
        >>> vw.config(mode="premium", model="claude")  # Uses claude-3-5-sonnet
        >>> vw.config(mode="premium", model="openai")  # Uses gpt-4-turbo
        >>> 
        >>> # Use specific model versions
        >>> vw.config(model="gpt-4-turbo")
        >>> vw.config(model="claude-3-haiku")
    """
    global _global_config
    
    # Create new config or update existing
    if _global_config is None:
        _global_config = Config(
            model=model or "anthropic",
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
        
        if api_key is not None:
            _global_config.api_key = api_key
        
        if temperature is not None:
            _global_config.temperature = temperature
        
        if mode is not None:
            _global_config.mode = mode
            # If mode changed and we have a shortcut model, re-resolve it
            model_map = PREMIUM_MODELS if mode == "premium" else STANDARD_MODELS
            # Check if the current model is a shortcut (exists in either dict keys)
            for shortcut in ["anthropic", "claude", "openai", "google", "gemini"]:
                if _global_config.model == PREMIUM_MODELS.get(shortcut) or \
                   _global_config.model == STANDARD_MODELS.get(shortcut):
                    # Re-resolve based on new mode
                    _global_config.model = model_map.get(shortcut, _global_config.model)
                    break
        
        # Update any additional kwargs
        for key, value in kwargs.items():
            if hasattr(_global_config, key):
                setattr(_global_config, key, value)
        
        # Re-load API key if needed
        if not _global_config.api_key:
            _global_config.api_key = _global_config._get_api_key_from_env()
    
    return _global_config


def models(provider: Optional[str] = None, mode: Optional[str] = None) -> Dict[str, List[str]]:
    """
    Get available models for providers.
    
    Args:
        provider: Optional provider filter ("openai", "anthropic", "gemini", "google")
        mode: Optional mode filter ("standard" or "premium")
    
    Returns:
        Dictionary of available models by provider and tier
    
    Examples:
        >>> import vibe_widget as vw
        >>> 
        >>> # Get all models
        >>> vw.models()
        
        >>> # Get models for a specific provider
        >>> vw.models("gemini")
        >>> vw.models("openai")
        
        >>> # Get only premium models
        >>> vw.models(mode="premium")
        
        >>> # Get gemini premium models
        >>> vw.models("gemini", mode="premium")
    """
    result = {}
    
    # Map provider aliases
    provider_map = {
        "gemini": "google_gemini",
        "google": "google_gemini",
        "claude": "anthropic",
        "gpt": "openai"
    }
    
    if provider:
        provider = provider.lower()
        provider_key = provider_map.get(provider, provider)
        
        # Filter to specific provider
        if provider_key in MODELS_MANIFEST:
            provider_models = MODELS_MANIFEST[provider_key]
            if mode:
                # Filter to specific mode
                if mode in provider_models:
                    result[provider_key] = {
                        mode: [m["id"] for m in provider_models[mode]]
                    }
            else:
                # All modes for this provider
                result[provider_key] = {
                    tier: [m["id"] for m in models]
                    for tier, models in provider_models.items()
                }
    else:
        # All providers
        for prov, tiers in MODELS_MANIFEST.items():
            if mode:
                # Filter to specific mode
                if mode in tiers:
                    result[prov] = {
                        mode: [m["id"] for m in tiers[mode]]
                    }
            else:
                # All modes
                result[prov] = {
                    tier: [m["id"] for m in models]
                    for tier, models in tiers.items()
                }
    
    return result