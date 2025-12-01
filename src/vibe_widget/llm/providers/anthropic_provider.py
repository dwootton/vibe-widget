"""Anthropic Claude provider implementation."""

import os
from typing import Any, Callable

from anthropic import Anthropic

from vibe_widget.llm.providers.base import LLMProvider


class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider using the official SDK."""
    
    def __init__(self, model: str, api_key: str | None = None):
        """
        Initialize Anthropic provider.
        
        Args:
            model: Model name or shortcut ("claude", "anthropic")
            api_key: Optional API key (otherwise uses environment)
        """
        # Model should already be resolved by Config
        self.model = model
        
        # Set up API key
        api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("Anthropic API key required. Set ANTHROPIC_API_KEY environment variable or pass api_key parameter.")
        
        self.client = Anthropic(api_key=api_key)
    
    def generate_widget_code(
        self,
        description: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str], None] | None = None,
    ) -> str:
        """Generate widget code using Claude."""
        prompt = self._build_prompt(description, data_info)
        
        try:
            if progress_callback:
                # Stream the response
                with self.client.messages.stream(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=8192,
                    temperature=0.7,
                ) as stream:
                    return self._handle_stream(stream, progress_callback)
            else:
                # Get complete response
                response = self.client.messages.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=8192,
                    temperature=0.7,
                )
                return self.clean_code(response.content[0].text)
                
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
        
        if progress_callback:
            with self.client.messages.stream(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=8192,
                temperature=0.7,
            ) as stream:
                return self._handle_stream(stream, progress_callback)
        else:
            response = self.client.messages.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=8192,
                temperature=0.7,
            )
            return self.clean_code(response.content[0].text)
    
    def fix_code_error(
        self,
        broken_code: str,
        error_message: str,
        data_info: dict[str, Any],
    ) -> str:
        """Fix errors in widget code."""
        prompt = self._build_fix_prompt(broken_code, error_message, data_info)
        
        # Use lower temperature for fixing
        response = self.client.messages.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=8192,
            temperature=0.3,
        )
        
        return self.clean_code(response.content[0].text)
    
    def _handle_stream(self, stream, progress_callback: Callable[[str], None]) -> str:
        """Handle streaming response."""
        code_chunks = []
        for text in stream.text_stream:
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
        
        if progress_callback:
            with self.client.messages.stream(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=8192,
                temperature=0.7,
            ) as stream:
                return self._handle_stream(stream, progress_callback)
        else:
            response = self.client.messages.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=8192,
                temperature=0.7,
            )
            return self.clean_code(response.content[0].text)
    
    # Methods _build_prompt, _build_revision_prompt, _build_fix_prompt,
    # _build_exports_imports_section, and clean_code are inherited from base class
