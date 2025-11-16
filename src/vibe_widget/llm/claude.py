import os
import re
from typing import Any

from anthropic import Anthropic

from vibe_widget.llm.base import LLMProvider


class ClaudeProvider(LLMProvider):
    def __init__(self, api_key: str | None = None, model: str = "claude-sonnet-4-5-20250929"):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError(
                "API key required. Pass api_key or set ANTHROPIC_API_KEY env variable."
            )
        self.model = model
        self.client = Anthropic(api_key=self.api_key)

    def generate_widget_code(self, description: str, data_info: dict[str, Any]) -> str:
        prompt = self._build_prompt(description, data_info)

        message = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )

        code = message.content[0].text
        return self._clean_code(code)

    def _clean_code(self, code: str) -> str:
        code = re.sub(r'^```(?:javascript|jsx?|typescript|tsx?)\s*\n', '', code, flags=re.MULTILINE)
        code = re.sub(r'\n```\s*$', '', code)
        return code.strip()

    def _build_prompt(self, description: str, data_info: dict[str, Any]) -> str:
        columns = data_info.get("columns", [])
        dtypes = data_info.get("dtypes", {})
        sample_data = data_info.get("sample", {})

        return f"""Create a React component for: {description}

Data schema:
- Columns: {', '.join(columns)}
- Types: {dtypes}
- Sample data: {sample_data}

Requirements:
1. Use React 18 with hooks
2. Create a complete, self-contained component
3. Use modern visualization libraries (recharts, plotly.js, or d3)
4. The component should be ready to render with the provided data
5. Include proper error handling and loading states
6. Make it interactive and visually appealing

Return ONLY the React component code that will be inserted into a template. Do not wrap in markdown code fences.
The data will be available as a prop called 'data'.
Start with: const VibeComponent = ({{ data }}) => {{
End with: ReactDOM.render(<VibeComponent data={{data}} />, document.getElementById('root'));

Include all necessary imports from CDN if needed (recharts, etc).
"""
