import os
import re
from pathlib import Path
from typing import Any, Callable

from anthropic import Anthropic
from dotenv import load_dotenv

from vibe_widget.llm.base import LLMProvider

load_dotenv()


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
        data_info: dict[str, Any] | None, 
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

    def revise_widget_code(
        self,
        current_code: str,
        revision_description: str,
        data_info: dict[str, Any] | None,
        progress_callback: Callable[[str], None] | None = None
    ) -> str:
        prompt = self._build_revision_prompt(current_code, revision_description, data_info)

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

    def _build_revision_prompt(self, current_code: str, revision_description: str, data_info: dict[str, Any] | None) -> str:
        if data_info is None:
            data_section = """This is a standalone widget without data.
The widget does NOT receive any data via model.get("data")."""
        else:
            columns = data_info.get("columns", [])
            dtypes = data_info.get("dtypes", {})
            sample_data = data_info.get("sample", {})
            data_section = f"""Data schema:
- Columns: {', '.join(columns)}
- Types: {dtypes}
- Sample data: {sample_data}"""

        return f"""Revise this React application based on the following request:

REVISION REQUEST: {revision_description}

CURRENT CODE:
```javascript
{current_code}
```

{data_section}

Requirements:
1. Use React and modern JavaScript
2. Import libraries from CDN as needed (d3, plotly, etc)
3. Make it interactive and visually appealing
4. Do NOT wrap in markdown code fences

Return ONLY the complete revised React application code. No markdown fences, no explanations."""

    def _build_prompt(self, description: str, data_info: dict[str, Any] | None) -> str:
        if data_info is None:
            data_section = """This is a standalone widget without data.
The widget will NOT receive any data via model.get("data").
Create an interactive widget based purely on the description."""
        else:
            columns = data_info.get("columns", [])
            dtypes = data_info.get("dtypes", {})
            sample_data = data_info.get("sample", {})
            data_section = f"""Data schema:
- Columns: {', '.join(columns)}
- Types: {dtypes}
- Sample data: {sample_data}"""

        return f"""Create a visualization based on this request: {description}

{data_section}

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
10. DO NOT use 100vh for height - use a fixed height or 100%

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


## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.

Return ONLY the JavaScript code. No markdown fences, no explanations."""
