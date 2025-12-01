"""Google Gemini provider implementation."""

import os
from typing import Any, Callable

import google.generativeai as genai

from vibe_widget.llm.providers.base import LLMProvider


class GeminiProvider(LLMProvider):
    """Google Gemini provider using the Google AI Studio API."""
    
    def __init__(self, model: str, api_key: str | None = None):
        """
        Initialize Gemini provider.
        
        Args:
            model: Model name or shortcut ("gemini", "google")
            api_key: Optional API key (otherwise uses environment)
        """
        # Model should already be resolved by Config, but handle direct usage too
        # Remove any prefixes for direct API use
        self.model = model.replace("gemini/", "")
        
        # Set up API key
        api_key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("Gemini API key required. Set GEMINI_API_KEY environment variable or pass api_key parameter.")
        
        genai.configure(api_key=api_key)
        
        # Initialize the model
        generation_config = genai.GenerationConfig(
            temperature=0.7,
            top_p=0.95,
            max_output_tokens=8192,
        )
        self.client = genai.GenerativeModel(
            model_name=self.model,
            generation_config=generation_config,
        )
    
    def generate_widget_code(
        self,
        description: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str], None] | None = None,
    ) -> str:
        """Generate widget code using Gemini."""
        prompt = self._build_prompt(description, data_info)
        
        try:
            if progress_callback:
                # Stream the response
                response = self.client.generate_content(
                    prompt,
                    stream=True,
                )
                return self._handle_stream(response, progress_callback)
            else:
                # Get complete response
                response = self.client.generate_content(prompt)
                return self.clean_code(response.text)
                
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
            response = self.client.generate_content(
                prompt,
                stream=True,
            )
            return self._handle_stream(response, progress_callback)
        else:
            response = self.client.generate_content(prompt)
            return self.clean_code(response.text)
    
    def fix_code_error(
        self,
        broken_code: str,
        error_message: str,
        data_info: dict[str, Any],
    ) -> str:
        """Fix errors in widget code."""
        prompt = self._build_fix_prompt(broken_code, error_message, data_info)
        
        # Use lower temperature for fixing
        fix_config = genai.GenerationConfig(
            temperature=0.3,
            top_p=0.95,
            max_output_tokens=8192,
        )
        fix_model = genai.GenerativeModel(
            model_name=self.model,
            generation_config=fix_config,
        )
        
        response = fix_model.generate_content(prompt)
        return self.clean_code(response.text)
    
    def _handle_stream(self, response, progress_callback: Callable[[str], None]) -> str:
        """Handle streaming response."""
        code_chunks = []
        for chunk in response:
            if chunk.text:
                code_chunks.append(chunk.text)
                progress_callback(chunk.text)
        
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
            response = self.client.generate_content(
                prompt,
                stream=True,
            )
            return self._handle_stream(response, progress_callback)
        else:
            response = self.client.generate_content(prompt)
            return self.clean_code(response.text)
    
    # Methods _build_prompt, _build_revision_prompt, _build_fix_prompt,
    # _build_exports_imports_section, and clean_code are inherited from base class