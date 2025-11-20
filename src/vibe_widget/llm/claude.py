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
    
    def _build_exports_imports_section(self, exports: dict, imports: dict) -> str:
        """Build the exports/imports section of the prompt"""
        if not exports and not imports:
            return ""
        
        sections = []
        
        if exports:
            export_list = "\n".join([f"- {name}: {desc}" for name, desc in exports.items()])
            sections.append(f"""
EXPORTS (State to share with other widgets):
{export_list}

You MUST:
- Update these exported traits using model.set("{list(exports.keys())[0]}", value) followed by model.save_changes()
- Initialize them with appropriate default values (empty arrays, null, etc.)
- Update them whenever the user interacts with the visualization

Example for exporting selected_indices:
```
function render({{ model, el }}) {{
  // Initialize the export
  model.set("selected_indices", []);
  model.save_changes();
  
  // Update on user interaction
  someElement.addEventListener('click', () => {{
    const selected = [1, 2, 3]; // Calculate selection
    model.set("selected_indices", selected);
    model.save_changes();
  }});
}}
```""")
        
        if imports:
            import_list = "\n".join([f"- {name}: {desc}" for name, desc in imports.items()])
            sections.append(f"""
IMPORTS (State from other widgets):
{import_list}

You MUST:
- Read these imported values using model.get("{list(imports.keys())[0]}")
- Listen for changes using model.on("change:{list(imports.keys())[0]}", callback)
- Update your visualization when imported values change

Example for importing selected_indices:
```
function render({{ model, el }}) {{
  function updateVisualization() {{
    const selectedIndices = model.get("selected_indices") || [];
    const allData = model.get("data");
    
    // Filter or highlight based on selection
    const filteredData = selectedIndices.length > 0
      ? selectedIndices.map(i => allData[i])
      : allData;
    
    // Re-render with filtered data
    // ...
  }}
  
  // Initial render
  updateVisualization();
  
  // Listen for changes
  model.on("change:selected_indices", updateVisualization);
  model.on("change:data", updateVisualization);
}}
```""")
        
        return "\n".join(sections)

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
        exports = data_info.get("exports", {})
        imports = data_info.get("imports", {})

        return f"""Create a visualization based on this request: {description}

Data schema:
- Columns: {', '.join(columns)}
- Types: {dtypes}
- Sample data: {sample_data}

{self._build_exports_imports_section(exports, imports)}

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
  // Optional: listen to model changes
  model.on("change:data", () => {{
    // Update visualization
  }});
}}

export default {{ render }};
```

CROSS-WIDGET PATTERNS (when exports/imports specified):

Scatter with brush EXPORTS selected_indices:
```
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
function render({{ model, el }}) {{
  const data = model.get("data");
  model.set("selected_indices", []);
  model.save_changes();
  
  const brush = d3.brush().on("end", (event) => {{
    if (!event.selection) {{
      model.set("selected_indices", []);
    }} else {{
      const selected = []; // Calculate indices in brush
      model.set("selected_indices", selected);
    }}
    model.save_changes();
  }});
}}
```

Histogram IMPORTS selected_indices:
```
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
function render({{ model, el }}) {{
  function update() {{
    const data = model.get("data");
    const selectedIndices = model.get("selected_indices") || [];
    const filtered = selectedIndices.length > 0 ? selectedIndices.map(i => data[i]) : data;
    // Re-render with filtered
  }}
  update();
  model.on("change:selected_indices", update);
}}
```

Initialize exports, update with model.set()+model.save_changes(), listen to imports with model.on("change:name", fn).


"""
