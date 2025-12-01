"""Factory for selecting the appropriate LLM provider based on model name."""

from typing import Optional

from vibe_widget.llm.providers.base import LLMProvider
from vibe_widget.llm.providers.gemini_provider import GeminiProvider
from vibe_widget.llm.providers.anthropic_provider import AnthropicProvider
from vibe_widget.llm.providers.openai_provider import OpenAIProvider


def get_provider(model: str, api_key: Optional[str] = None, mode: str = "standard") -> LLMProvider:
    """
    Get the appropriate LLM provider based on the model name.
    
    Args:
        model: Model name (already resolved by Config based on mode)
        api_key: Optional API key (otherwise uses environment)
        mode: Not used here - model selection happens in Config
    
    Returns:
        LLMProvider instance for the specified model
    
    Raises:
        ValueError: If the model is not recognized
    """
    # Model has already been resolved to specific version by Config based on mode
    model_lower = model.lower()
    
    # Check for Gemini/Google models
    if model_lower in ["gemini", "google"] or "gemini" in model_lower:
        return GeminiProvider(model, api_key)
    
    # Check for Anthropic/Claude models
    elif model_lower in ["claude", "anthropic"] or "claude" in model_lower:
        return AnthropicProvider(model, api_key)
    
    # Check for OpenAI/GPT models
    elif model_lower in ["openai", "gpt"] or "gpt" in model_lower or "openai" in model_lower:
        return OpenAIProvider(model, api_key)
    
    # Default to trying each provider in order
    else:
        # Try to guess based on common model prefixes
        if model.startswith("gemini"):
            return GeminiProvider(model, api_key)
        elif model.startswith("claude"):
            return AnthropicProvider(model, api_key)
        elif model.startswith("gpt"):
            return OpenAIProvider(model, api_key)
        else:
            raise ValueError(
                f"Unknown model: {model}. "
                f"Use 'gemini', 'claude', 'openai' shortcuts or provide a full model name "
                f"(e.g., 'gemini-1.5-pro', 'claude-3-5-sonnet-20241022', 'gpt-4-turbo-preview')"
            )