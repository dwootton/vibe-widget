"""Base class for LLM providers."""

from abc import ABC, abstractmethod
from typing import Any, Callable
import re


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""
    
    @abstractmethod
    def generate_widget_code(
        self,
        description: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str], None] | None = None,
    ) -> str:
        """Generate widget code from description and data info.
        
        Args:
            description: Natural language description of the widget
            data_info: Dictionary containing data profile information
            progress_callback: Optional callback for streaming progress updates
            
        Returns:
            Generated widget code as a string
        """
        pass
    
    @abstractmethod
    def revise_widget_code(
        self,
        current_code: str,
        revision_description: str,
        data_info: dict[str, Any],
        base_code: str | None = None,
        base_components: list[str] | None = None,
        progress_callback: Callable[[str], None] | None = None,
    ) -> str:
        """Revise existing widget code based on a revision description.
        
        Args:
            current_code: The current widget code
            revision_description: Description of what to change
            data_info: Dictionary containing data profile information
            base_code: Optional additional base widget code for composition
            base_components: Optional list of component names from base widget
            progress_callback: Optional callback for streaming progress updates
            
        Returns:
            Revised widget code as a string
        """
        pass
    
    @abstractmethod
    def fix_code_error(
        self,
        broken_code: str,
        error_message: str,
        data_info: dict[str, Any],
    ) -> str:
        """Fix errors in widget code.
        
        Args:
            broken_code: The code with errors
            error_message: Description of the error
            data_info: Dictionary containing data profile information
            
        Returns:
            Fixed widget code as a string
        """
        pass

    @abstractmethod
    def generate_audit_report(
        self,
        code: str,
        description: str,
        data_info: dict[str, Any],
        level: str,
        changed_lines: list[int] | None = None,
    ) -> str:
        """Generate an audit report for widget code."""
        pass
    
    def _build_prompt(
        self,
        description: str,
        data_info: dict[str, Any],
        base_code: str | None = None,
        base_components: list[str] | None = None,
    ) -> str:
        """Build the prompt for code generation.
        
        Args:
            description: Widget description
            data_info: Data information dictionary
            base_code: Optional base widget code for composition
            base_components: Optional list of component names available from base
        """
        columns = data_info.get("columns", [])
        dtypes = data_info.get("dtypes", {})
        sample_data = data_info.get("sample", {})
        exports = data_info.get("exports", {})
        imports = data_info.get("imports", {})
        
        exports_imports_section = self._build_exports_imports_section(exports, imports)
        
        # Build composition section if base code provided
        composition_section = ""
        if base_code:
            composition_section = self._build_composition_section(base_code, base_components or [])
        
        # Convert columns to strings to handle integer or other non-string column names
        columns_str = ', '.join(str(col) for col in columns) if columns else 'No data (widget uses imports only)'
        
        return f"""You are an expert JavaScript + React developer building a high-quality interactive visualization that runs inside an AnyWidget React bundle.

TASK: {description}

Data schema:
- Columns: {columns_str}
- Types: {dtypes}
- Sample data: {sample_data}

{composition_section}{exports_imports_section}

CRITICAL REACT + HTM SPECIFICATION:

MUST FOLLOW EXACTLY:
1. Export a default function: export default function Widget({{ model, html, React }}) {{ ... }}
2. Use html tagged templates (htm) for markup—no JSX or ReactDOM.render
3. Access data with model.get("data") and treat it as immutable
4. Append DOM nodes via refs rendered inside html templates (never touch document.body)
5. Import libraries from ESM CDN with locked versions (d3@7, three@0.160, regl@3, etc.)
6. Initialize exports immediately, update them as interactions occur, and call model.save_changes() each time
7. Subscribe to imported traits with model.on("change:trait", handler) and unsubscribe in cleanup
8. Every React.useEffect MUST return a cleanup that tears down listeners, observers, intervals, animation frames, WebGL resources, etc.
9. Avoid 100vh/100vw—use fixed heights (360–640px) or flex layouts that respect notebook constraints
10. Never wrap the output in markdown code fences

CORRECT Template:
```javascript
import * as d3 from "https://esm.sh/d3@7";

export default function VisualizationWidget({{ model, html, React }}) {{
  const data = model.get("data") || [];
  const [selectedItem, setSelectedItem] = React.useState(null);
  const containerRef = React.useRef(null);

  React.useEffect(() => {{
    if (!containerRef.current) return;
    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr("width", 640)
      .attr("height", 420);

    // ... build chart ...

    return () => svg.remove();
  }}, [data]);

  return html`
    <section class="viz-shell" style=${{{{ padding: '24px', height: '480px' }}}}>
      <h2 class="viz-title">Experience</h2>
      <div ref=${{containerRef}} class="viz-canvas"></div>
      ${{selectedItem && html`<p class="viz-meta">Selected: ${{selectedItem}}</p>`}}
    </section>
  `;
}}
```

Key Syntax Rules:
- Use html`<div>...</div>` NOT <div>...</div>
- Use class= NOT className=
- Event props: onClick=${{handler}} NOT onClick={{handler}}
- Style objects: style=${{{{ padding: '20px' }}}}
- Conditionals: ${{condition && html`...`}}

MODULARITY & COMPOSITION:

For reusable UI components (sliders, legends, tooltips, controls), export them as named exports:
```javascript
export const Slider = ({{ value, onChange, min, max }}) => {{
  return html`<input type="range" value=${{value}} onInput=${{onChange}} min=${{min}} max=${{max}} />`;
}};

export const ColorLegend = ({{ colors, labels }}) => {{
  return html`<div class="legend">${{labels.map((label, i) => html`<span>...</span>`)}}</div>`;
}};

export default function Widget({{ model, html, React }}) {{
  // Use: html`<${{Slider}} value=${{v}} ... />`
}}
```

BENEFITS:
- Components can be imported and reused in other widgets
- Cleaner code structure and separation of concerns
- Easier testing and maintenance

OUTPUT REQUIREMENTS:

Generate ONLY the working JavaScript code (imports → export default function Widget...).
- NO explanations before or after
- NO markdown fences
- NO console logs unless essential

Begin the response with code immediately."""
    
    def _build_revision_prompt(
        self,
        current_code: str,
        revision_description: str,
        data_info: dict[str, Any],
        base_code: str | None = None,
        base_components: list[str] | None = None,
    ) -> str:
        """Build the prompt for code revision.
        
        Args:
            current_code: Current widget code
            revision_description: Description of changes to make
            data_info: Data information dictionary
            base_code: Optional additional base widget code for composition
            base_components: Optional list of components from base widget
        """
        columns = data_info.get("columns", [])
        dtypes = data_info.get("dtypes", {})
        sample_data = data_info.get("sample", {})
        exports = data_info.get("exports", {})
        imports = data_info.get("imports", {})
        
        exports_imports_section = self._build_exports_imports_section(exports, imports)
        
        # Build composition section if additional base code provided
        composition_section = ""
        if base_code:
            composition_section = self._build_composition_section(base_code, base_components or [])
        
        return f"""Revise the following AnyWidget React bundle code according to the request.

REVISION REQUEST: {revision_description}

CURRENT CODE:
```javascript
{current_code}
```

{composition_section}Data schema:
- Columns: {', '.join(columns) if columns else 'No data (widget uses imports only)'}
- Types: {dtypes}
- Sample data: {sample_data}

{exports_imports_section}

Follow the SAME constraints as generation:
- export default function Widget({{ model, html, React }})
- html tagged templates only (no JSX)
- ESM CDN imports with locked versions
- Thorough cleanup in every React.useEffect
- Export reusable components as named exports when appropriate

Focus on making ONLY the requested changes. Reuse existing code structure where possible.

Return only the full revised JavaScript code. No markdown fences or explanations."""
    
    def _build_fix_prompt(
        self,
        broken_code: str,
        error_message: str,
        data_info: dict[str, Any],
    ) -> str:
        """Build the prompt for fixing code errors."""
        columns = data_info.get("columns", [])
        dtypes = data_info.get("dtypes", {})
        sample_data = data_info.get("sample", {})
        exports = data_info.get("exports", {})
        imports = data_info.get("imports", {})
        
        exports_imports_section = self._build_exports_imports_section(exports, imports)
        
        return f"""Fix the AnyWidget React bundle code below. Keep the interaction model identical while eliminating the runtime error.
Preserve all user-intended changes and visual styling; make the smallest possible fix.
Do NOT remove, rename, or rewrite unrelated parts of the code.

ERROR MESSAGE:
{error_message}

BROKEN CODE:
```javascript
{broken_code}
```

Data schema:
- Columns: {', '.join(columns) if columns else 'No data (widget uses imports only)'}
- Types: {dtypes}
- Sample data: {sample_data}

{exports_imports_section}

MANDATORY FIX RULES:
1. Export default function Widget({{ model, html, React }})
2. Use html tagged templates (htm) instead of JSX
3. Guard every model.get payload before iterating
4. Keep CDN imports version-pinned
5. Restore all cleanup handlers
6. Initialize exports and call model.save_changes()

Return ONLY the corrected JavaScript code."""

    def _build_audit_prompt(
        self,
        *,
        code: str,
        description: str,
        data_info: dict[str, Any],
        level: str,
        changed_lines: list[int] | None = None,
    ) -> str:
        """Build prompt for audit generation."""
        columns = data_info.get("columns", [])
        dtypes = data_info.get("dtypes", {})
        sample_data = data_info.get("sample", {})
        exports = data_info.get("exports", {})
        imports = data_info.get("imports", {})
        changed_lines_section = ""
        if changed_lines:
            changed_lines_section = f"""
CHANGED LINES (only report concerns tied to these lines, or global concerns if truly code-wide):
{changed_lines}
"""

        if level == "fast":
            schema = """Return JSON with root key "fast_audit":
{
  "fast_audit": {
    "version": "1.0",
    "widget_description": "...",
    "concerns": [
      {
        "id": "data.selection.null_handling",
        "location": "global" | [1,2,3],
        "summary": "...",
        "details": "...",
        "technical_summary": "...",
        "impact": "high" | "medium" | "low",
        "default": true,
        "alternatives": ["..."]
      }
    ],
    "open_questions": ["..."]
  }
}"""
        else:
            schema = """Return JSON with root key "full_audit":
{
  "full_audit": {
    "version": "1.0",
    "widget_description": "...",
    "concerns": [
      {
        "id": "computation.parameters.seed",
        "location": "global" | [1,2,3],
        "summary": "...",
        "impact": "high" | "medium" | "low",
        "default": true,
        "rationale": "...",
        "alternatives": [
          {
            "option": "...",
            "when_better": "...",
            "when_worse": "..."
          }
        ],
        "lenses": {
          "impact": "high" | "medium" | "low",
          "uncertainty": "...",
          "reproducibility": "...",
          "edge_behavior": "...",
          "default_vs_explicit": "...",
          "appropriateness": "...",
          "safety": "..."
        }
      }
    ],
    "open_questions": ["..."]
  }
}"""

        return f"""You are an auditing assistant for VibeWidget code.

Audit taxonomy:
- DATA: selection, transformation, format, provenance
- COMPUTATION: method, parameters, assumptions, execution
- PRESENTATION: encoding, scale, compression, framing
- INTERACTION: triggers, state, propagation, feedback

Lenses:
- Impact (high/medium/low): would a different choice change conclusions?
- Uncertainty: confidence, sample size, stability
- Reproducibility: can it be recreated exactly?
- Edge Behavior: empty/extreme/boundary inputs
- Default vs Explicit: user choice vs assumption
- Appropriateness: method suitability
- Safety: resource usage, side effects, failure modes

Constraints:
- Use line numbers from the provided code.
- Location must be "global" or a list of integers.
- IDs should be stable, descriptive, and scoped like "domain.type.short_name".
- Be conservative: default to low impact unless there is clear evidence of medium/high.
- High impact should be rare and reserved for likely conclusion-changing choices.
- Summaries must be understandable to non-coders.
- "details" should expand in plain language (1-2 sentences).
- "technical_summary" should be brief and technical, and only included when helpful.
- Return ONLY JSON, no markdown or commentary.

Widget description: {description}
Data schema:
- Columns: {', '.join(columns) if columns else 'No data (widget uses imports only)'}
- Types: {dtypes}
- Sample data: {sample_data}
- Exports: {exports}
- Imports: {imports}

{changed_lines_section}
CODE WITH LINE NUMBERS:
{code}

{schema}"""
    
    def _build_exports_imports_section(self, exports: dict, imports: dict) -> str:
        """Build the exports/imports section of the prompt."""
        if not exports and not imports:
            return ""
        
        sections: list[str] = []
        
        if exports:
            export_list = "\n".join([f"- {name}: {desc}" for name, desc in exports.items()])
            sections.append(f"""
EXPORTS (State shared with other widgets):
{export_list}

CRITICAL: Initialize exports when widget mounts, update continuously, call model.save_changes()""")
        
        if imports:
            import_list = "\n".join([f"- {name}: {desc}" for name, desc in imports.items()])
            sections.append(f"""
IMPORTS (State from other widgets):
{import_list}

CRITICAL: Subscribe with model.on("change:trait", handler), unsubscribe in cleanup""")
        
        return "\n".join(sections)
    
    def _build_composition_section(self, base_code: str, base_components: list[str]) -> str:
        """
        Build composition section showing available base widget code and components.
        
        Args:
            base_code: The base widget JavaScript code
            base_components: List of component names exported from base
        
        Returns:
            Formatted composition section for prompt
        """
        section = f"""
BASE WIDGET CODE (for reference and reuse):
```javascript
{base_code}
```
"""
        
        if base_components:
            components_list = ", ".join(base_components)
            section += f"""
AVAILABLE COMPONENTS from base widget: {components_list}

You can reuse these components in your widget. Extract and adapt them as needed.
Focus on modifying only what's necessary for the requested changes.
"""
        
        return section + "\n"
    
    def clean_code(self, code: str) -> str:
        """Clean the generated code by removing markdown fences."""
        if not code:
            return ""
        
        # Remove markdown code fences
        code = re.sub(r"```(?:javascript|jsx?|typescript|tsx?)?\s*\n?", "", code)
        code = re.sub(r"\n?```\s*", "", code)
        
        return code.strip()
    
    @staticmethod
    def build_data_info(
        df,
        exports: dict[str, str] | None = None,
        imports: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Build data info dictionary from DataFrame."""
        import pandas as pd
        
        exports = exports or {}
        imports = imports or {}
        
        sample = df.head(3).to_dict(orient="records") if not df.empty else []
        
        # Detect potential data characteristics
        is_geospatial = any(
            str(col).lower() in ['lat', 'latitude', 'lon', 'longitude', 'lng', 'geometry']
            for col in df.columns
        )
        
        temporal_cols = [
            col for col in df.columns
            if pd.api.types.is_datetime64_any_dtype(df[col])
            or str(col).lower() in ['date', 'time', 'datetime', 'timestamp']
        ]
        
        return {
            "columns": [str(col) for col in df.columns.tolist()],
            "dtypes": {str(col): str(dtype) for col, dtype in df.dtypes.items()},
            "shape": df.shape,
            "sample": sample,
            "exports": exports,
            "imports": imports,
            "is_geospatial": is_geospatial,
            "temporal_columns": [str(col) for col in temporal_cols],
        }
