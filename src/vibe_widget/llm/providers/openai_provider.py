"""OpenAI GPT provider implementation."""

import os
from typing import Any, Callable

from openai import OpenAI

from vibe_widget.llm.providers.base import LLMProvider


class OpenAIProvider(LLMProvider):
    """OpenAI GPT provider using the official SDK."""
    
    def __init__(self, model: str, api_key: str | None = None):
        """
        Initialize OpenAI provider.
        
        Args:
            model: Model name or shortcut ("openai", "gpt")
            api_key: Optional API key (otherwise uses environment)
        """
        # Model should already be resolved by Config
        self.model = model
        
        # Set up API key
        api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OpenAI API key required. Set OPENAI_API_KEY environment variable or pass api_key parameter.")
        
        self.client = OpenAI(api_key=api_key)
    
    def generate_widget_code(
        self,
        description: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str], None] | None = None,
    ) -> str:
        """Generate widget code using GPT."""
        prompt = self._build_prompt(description, data_info)
        
        # Use max_completion_tokens for newer models (gpt-5, o3-pro, etc)
        # Use max_tokens for older models
        completion_params = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
        }
        
        # Newer models use max_completion_tokens and don't support custom temperature
        if self.model in ["gpt-5.1-2025-11-13", "gpt-5", "o3-pro", "o1", "o1-pro"]:
            completion_params["max_completion_tokens"] = 8192
            # These models don't support custom temperature
        else:
            completion_params["max_tokens"] = 8192
            completion_params["temperature"] = 0.7
        
        try:
            if progress_callback:
                # Stream the response
                completion_params["stream"] = True
                stream = self.client.chat.completions.create(**completion_params)
                return self._handle_stream(stream, progress_callback)
            else:
                # Get complete response
                response = self.client.chat.completions.create(**completion_params)
                return self.clean_code(response.choices[0].message.content)
                
        except Exception as e:
            # Check for context length issues
            if "context" in str(e).lower() or "token" in str(e).lower():
                return self._retry_with_shorter_prompt(description, data_info, progress_callback)
            else:
                raise
    
    def revise_widget_code(
        self,
        current_code: str,
        revision_description: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str], None] | None = None,
    ) -> str:
        """Revise existing widget code."""
        prompt = self._build_revision_prompt(current_code, revision_description, data_info)
        
        completion_params = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
        }
        
        # Newer models use max_completion_tokens and don't support custom temperature
        if self.model in ["gpt-5.1-2025-11-13", "gpt-5", "o3-pro", "o1", "o1-pro"]:
            completion_params["max_completion_tokens"] = 8192
        else:
            completion_params["max_tokens"] = 8192
            completion_params["temperature"] = 0.7
        
        if progress_callback:
            completion_params["stream"] = True
            stream = self.client.chat.completions.create(**completion_params)
            return self._handle_stream(stream, progress_callback)
        else:
            response = self.client.chat.completions.create(**completion_params)
            return self.clean_code(response.choices[0].message.content)
    
    def fix_code_error(
        self,
        broken_code: str,
        error_message: str,
        data_info: dict[str, Any],
    ) -> str:
        """Fix errors in widget code."""
        prompt = self._build_fix_prompt(broken_code, error_message, data_info)
        
        completion_params = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
        }
        
        # Newer models use max_completion_tokens and don't support custom temperature
        if self.model in ["gpt-5.1-2025-11-13", "gpt-5", "o3-pro", "o1", "o1-pro"]:
            completion_params["max_completion_tokens"] = 8192
        else:
            completion_params["max_tokens"] = 8192
            completion_params["temperature"] = 0.3  # Lower temperature for fixing
        
        response = self.client.chat.completions.create(**completion_params)
        
        return self.clean_code(response.choices[0].message.content)
    
    def _handle_stream(self, stream, progress_callback: Callable[[str], None]) -> str:
        """Handle streaming response."""
        code_chunks = []
        for chunk in stream:
            if chunk.choices[0].delta.content:
                text = chunk.choices[0].delta.content
                code_chunks.append(text)
                progress_callback(text)
        
        return self.clean_code("".join(code_chunks))
    
    def _retry_with_shorter_prompt(
        self,
        description: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str], None] | None = None,
    ) -> str:
        """Retry with a shorter prompt if context length exceeded."""
        # Reduce sample data size
        reduced_info = data_info.copy()
        if "sample" in reduced_info:
            # Keep only first row of sample data
            sample = reduced_info["sample"]
            if isinstance(sample, list) and len(sample) > 1:
                reduced_info["sample"] = sample[:1]
        
        prompt = self._build_prompt(description, reduced_info)
        
        completion_params = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
        }
        
        # Newer models use max_completion_tokens and don't support custom temperature
        if self.model in ["gpt-5.1-2025-11-13", "gpt-5", "o3-pro", "o1", "o1-pro"]:
            completion_params["max_completion_tokens"] = 8192
        else:
            completion_params["max_tokens"] = 8192
            completion_params["temperature"] = 0.7
        
        if progress_callback:
            completion_params["stream"] = True
            stream = self.client.chat.completions.create(**completion_params)
            return self._handle_stream(stream, progress_callback)
        else:
            response = self.client.chat.completions.create(**completion_params)
            return self.clean_code(response.choices[0].message.content)
    
    # Methods _build_prompt, _build_revision_prompt, _build_fix_prompt,
    # _build_exports_imports_section, and clean_code are inherited from base class