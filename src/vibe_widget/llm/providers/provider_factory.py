"""Factory for selecting the OpenRouter-backed LLM provider."""

from typing import Optional

from vibe_widget.config import PREMIUM_MODELS, STANDARD_MODELS
from vibe_widget.llm.providers.base import LLMProvider
from vibe_widget.llm.providers.openrouter_provider import OpenRouterProvider


def get_provider(model: str, api_key: Optional[str] = None, mode: str = "standard") -> LLMProvider:
    """
    Get an OpenRouter-based LLM provider for the given model.
    
    Args:
        model: Model name (already resolved by Config based on mode)
        api_key: Optional API key (otherwise uses environment)
        mode: Unused; kept for backward compatibility with previous signature
    
    Returns:
        LLMProvider instance for the specified model
    """
    if not model:
        raise ValueError("Model name is required")
    
    model_map = PREMIUM_MODELS if mode == "premium" else STANDARD_MODELS
    resolved_model = model_map.get(model, model)
    
    return OpenRouterProvider(resolved_model, api_key)
