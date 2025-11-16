import os
import re
from typing import Any, Callable

from anthropic import Anthropic

from vibe_widget.llm.base import LLMProvider


class ClaudeProvider(LLMProvider):
    def __init__(self, api_key: str | None = None, model: str = "claude-haiku-4-5-20251001"):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError(
                "API key required. Pass api_key or set ANTHROPIC_API_KEY env variable."
            )
        self.model = model
        self.client = Anthropic(api_key=self.api_key)

    def generate_widget_code(
        self, 
        description: str, 
        data_info: dict[str, Any], 
        progress_callback: Callable[[str], None] | None = None
    ) -> str:
        prompt = self._build_prompt(description, data_info)

        if progress_callback:
            code_chunks = []
            with self.client.messages.stream(
                model=self.model,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                for text in stream.text_stream:
                    code_chunks.append(text)
                    progress_callback(text)
            
            code = "".join(code_chunks)
        else:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )
            code = message.content[0].text
        
        return self._clean_code(code)

    def _clean_code(self, code: str) -> str:
        code = re.sub(r'```(?:javascript|jsx?|typescript|tsx?)?\s*\n?', '', code)
        code = re.sub(r'\n?```\s*', '', code)
        return code.strip()

    def _build_prompt(self, description: str, data_info: dict[str, Any]) -> str:
        columns = data_info.get("columns", [])
        dtypes = data_info.get("dtypes", {})
        sample_data = data_info.get("sample", {})

        return f"""Create an Anywidget Front-End Module (AFM) for: {description}

Data schema:
- Columns: {', '.join(columns)}
- Types: {dtypes}
- Sample data: {sample_data}

CRITICAL AFM Requirements:
1. Must follow the anywidget specification exactly
2. Export a default object with a render function: export default {{ render }}
3. The render function signature MUST be: function render({{ model, el }}) {{ ... }}
4. Access data via: model.get("data")
5. Use modern vanilla JavaScript or import libraries from CDN (d3, plotly, etc)
6. Create DOM elements and append to 'el' HTMLElement
7. Make it interactive and visually appealing
8. Do NOT use React/ReactDOM - use vanilla JS or imported libraries only
9. Do NOT wrap in markdown code fences

Example structure:
```
import * as d3 from "https://esm.sh/d3@7";

function render({{ model, el }}) {{
  const data = model.get("data");
  
  // Create visualization using d3, plotly, or vanilla JS
  // Append elements to el
  
  // Optional: listen to model changes
  model.on("change:data", () => {{
    // Update visualization
  }});
}}

export default {{ render }};
```

Return ONLY the JavaScript code. No markdown fences, no explanations."""
