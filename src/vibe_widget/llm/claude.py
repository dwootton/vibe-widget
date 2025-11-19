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
        data_info: dict[str, Any], 
        progress_callback: Callable[[str], None] | None = None
    ) -> str:
        prompt = self._build_prompt(description, data_info)

        if progress_callback:
            code_chunks = []
            with self.client.messages.stream(
                model=self.model,
                max_tokens=8192,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                for text in stream.text_stream:
                    code_chunks.append(text)
                    progress_callback(text)
            
            code = "".join(code_chunks)
        else:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=8192,
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
        data_info: dict[str, Any],
        progress_callback: Callable[[str], None] | None = None
    ) -> str:
        prompt = self._build_revision_prompt(current_code, revision_description, data_info)

        if progress_callback:
            code_chunks = []
            with self.client.messages.stream(
                model=self.model,
                max_tokens=8192,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                for text in stream.text_stream:
                    code_chunks.append(text)
                    progress_callback(text)
            
            code = "".join(code_chunks)
        else:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=8192,
                messages=[{"role": "user", "content": prompt}],
            )
            code = message.content[0].text
        
        return self._clean_code(code)

    def _build_revision_prompt(self, current_code: str, revision_description: str, data_info: dict[str, Any]) -> str:
        columns = data_info.get("columns", [])
        dtypes = data_info.get("dtypes", {})
        sample_data = data_info.get("sample", {})

        return f"""Revise this React application based on the following request:

REVISION REQUEST: {revision_description}

CURRENT CODE:
```javascript
{current_code}
```

Data schema:
- Columns: {', '.join(columns)}
- Types: {dtypes}
- Sample data: {sample_data}

Requirements:
1. Use React and modern JavaScript
2. Import libraries from CDN as needed (d3, plotly, etc)
3. Make it interactive and visually appealing
4. Do NOT wrap in markdown code fences

Return ONLY the complete revised React application code. No markdown fences, no explanations."""

    def _build_prompt(self, description: str, data_info: dict[str, Any]) -> str:
        columns = data_info.get("columns", [])
        dtypes = data_info.get("dtypes", {})
        sample_data = data_info.get("sample", {})

        return f"""Create a visualization based on this request: {description}

Data schema:
- Columns: {', '.join(columns)}
- Types: {dtypes}
- Sample data: {sample_data}

CRITICAL Requirements - Dependency Injection Pattern:
1. Export a DEFAULT FUNCTION (not an object) that accepts {{ model, html, React }} as parameters
2. The function signature MUST be: export default function Widget({{ model, html, React }}) {{ ... }}
3. Access data via: model.get("data")
4. Use `html` (htm library) for rendering - DO NOT use JSX syntax
5. Use `React` for hooks (React.useState, React.useEffect, React.useRef)
6. Import external libraries from ESM CDN (https://esm.sh/) - D3, Plotly, Three.js, etc.
7. DO NOT import React or ReactDOM (they are injected via props)
8. DO NOT use JSX syntax (use html tagged templates instead)
9. DO NOT wrap in markdown code fences
10. DO NOT use 100vh for height - use fixed heights (e.g., 500px) or 100%

Example structure:
```javascript
import * as d3 from "https://esm.sh/d3@7";

export default function VisualizationWidget({{ model, html, React }}) {{
  const data = model.get("data");
  const [selectedItem, setSelectedItem] = React.useState(null);
  const containerRef = React.useRef(null);
  
  React.useEffect(() => {{
    if (!containerRef.current) return;
    
    // Create D3 visualization
    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr("width", 600)
      .attr("height", 400);
    
    // ... D3 code ...
    
    return () => {{
      // Cleanup
      svg.remove();
    }};
  }}, [data]);
  
  // Use html tagged templates (NOT JSX)
  return html\`
    <div style=${{{{ padding: '20px' }}}}>
      <h2>My Visualization</h2>
      <div ref=${{containerRef}}></div>
      ${{selectedItem && html\`<p>Selected: ${{selectedItem}}</p>\`}}
    </div>
  \`;
}}
```

Key Syntax Rules:
- Use html`<div>...</div>` NOT <div>...</div>
- Use class= NOT className=
- Props: onClick=${{handler}} NOT onClick={{handler}}
- Style objects: style=${{{{ padding: '20px' }}}}
- Conditionals: ${{condition && html`...`}}
- Components: <${{ComponentName}} prop=${{value}} />
- Children: html`<div>${{children}}</div>`


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
