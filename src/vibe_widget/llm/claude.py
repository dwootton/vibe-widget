import os
import re
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
        progress_callback: Callable[[str], None] | None = None,
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

    def revise_widget_code(
        self,
        current_code: str,
        revision_description: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str], None] | None = None,
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

    def fix_code_error(
        self,
        broken_code: str,
        error_message: str,
        data_info: dict[str, Any],
    ) -> str:
        prompt = self._build_fix_prompt(broken_code, error_message, data_info)

        message = self.client.messages.create(
            model=self.model,
            max_tokens=8192,
            messages=[{"role": "user", "content": prompt}],
        )

        return self._clean_code(message.content[0].text)

    def _build_prompt(self, description: str, data_info: dict[str, Any]) -> str:
        columns = data_info.get("columns", [])
        dtypes = data_info.get("dtypes", {})
        sample_data = data_info.get("sample", {})
        exports = data_info.get("exports", {})
        imports = data_info.get("imports", {})

        exports_imports_section = self._build_exports_imports_section(exports, imports)

        return f"""You are an expert JavaScript + React developer building a high-quality interactive visualization that runs inside an AnyWidget React bundle.

═══════════════════════════════════════════════════════════════
TASK: {description}
═══════════════════════════════════════════════════════════════

Data schema:
- Columns: {', '.join(columns) if columns else 'No data (widget uses imports only)'}
- Types: {dtypes}
- Sample data: {sample_data}

{exports_imports_section}

═══════════════════════════════════════════════════════════════
🔴 CRITICAL REACT + HTM SPECIFICATION
═══════════════════════════════════════════════════════════════

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

✅ CORRECT Template:
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
- Components: <${{Component}} prop=${{value}} />
- Children: html`<div>${{children}}</div>`

═══════════════════════════════════════════════════════════════
🚫 COMMON PITFALLS TO AVOID
═══════════════════════════════════════════════════════════════

❌ Incorrect Three.js imports → use https://esm.sh/three@0.160 + matching submodules
❌ Typos in constants (THREE.PCFShadowShadowMap) → spell EXACTLY (THREE.PCFSoftShadowMap)
❌ Touching geometry attributes without checking they exist → guard geometry.attributes.position
❌ Mutating data without null checks → verify model.get() payloads before iterating
❌ Appending to document.body or using window globals instead of html refs
❌ Forgetting cleanup → every effect must remove listeners, observers, raf handles, timers
❌ Exporting state only once or forgetting model.save_changes()

═══════════════════════════════════════════════════════════════
🎨 FRONTEND AESTHETICS
═══════════════════════════════════════════════════════════════

- Typography: pick distinctive pairings—avoid generic system fonts
- Color & Theme: commit to a palette, use CSS variables, sharp accents > timid gradients
- Motion: purposeful animations (staggered entrances, hover reveals) with cleanup
- Spatial Composition: embrace asymmetry, layering, depth (glassmorphism, grain, shadows)
- Background Details: gradient meshes, subtle noise, geometric motifs, custom cursors; never default plain white unless justified
- Never use emojis

═══════════════════════════════════════════════════════════════
🎯 QUALITY CHECKLIST
═══════════════════════════════════════════════════════════════

✓ CDN imports pinned to explicit versions
✓ Exports initialized + updated continuously with model.set/model.save_changes
✓ Imports read via model.get and kept in sync with model.on/model.off
✓ Geometry attributes + data arrays null-checked before use
✓ Canvas/WebGL sized via container, not 100vh
✓ Effects have thorough cleanup (listeners, RAF, observers, intervals)
✓ No markdown fences, emojis, or JSX
✓ Styling leverages CSS variables + purposeful layout polish

═══════════════════════════════════════════════════════════════
📝 OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════

Generate ONLY the working JavaScript code (imports → export default function Widget...).
- NO explanations before or after
- NO markdown fences
- NO stray console logs unless essential for debugging

Begin the response with code immediately.
"""

    def _build_revision_prompt(
        self,
        current_code: str,
        revision_description: str,
        data_info: dict[str, Any],
    ) -> str:
        columns = data_info.get("columns", [])
        dtypes = data_info.get("dtypes", {})
        sample_data = data_info.get("sample", {})
        exports = data_info.get("exports", {})
        imports = data_info.get("imports", {})

        exports_imports_section = self._build_exports_imports_section(exports, imports)

        return f"""Revise the following AnyWidget React bundle code according to the request.

REVISION REQUEST: {revision_description}

CURRENT CODE:
```javascript
{current_code}
```

Data schema:
- Columns: {', '.join(columns) if columns else 'No data (widget uses imports only)'}
- Types: {dtypes}
- Sample data: {sample_data}

{exports_imports_section}

Follow the SAME constraints as generation:
- export default function Widget({{ model, html, React }})
- html tagged templates only (no JSX)
- ESM CDN imports with locked versions
- Initialize/stream exports, subscribe to imports with model.on/model.off
- Thorough cleanup in every React.useEffect
- Respect notebook sizing (no 100vh) and keep styling bold + intentional

Return only the full revised JavaScript code with imports through export default. No markdown fences or explanations.
"""

    def _build_fix_prompt(
        self,
        broken_code: str,
        error_message: str,
        data_info: dict[str, Any],
    ) -> str:
        columns = data_info.get("columns", [])
        dtypes = data_info.get("dtypes", {})
        sample_data = data_info.get("sample", {})
        exports = data_info.get("exports", {})
        imports = data_info.get("imports", {})

        exports_imports_section = self._build_exports_imports_section(exports, imports)

        return f"""Fix the AnyWidget React bundle code below. Keep the interaction model identical while eliminating the runtime error.

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
3. Guard every model.get payload before iterating or accessing properties
4. Keep CDN imports version-pinned
5. Restore all cleanup handlers (listeners, observers, RAF, timers, WebGL resources)
6. Initialize exports immediately and call model.save_changes() after every model.set
7. Subscribe to imported traits with model.on/model.off
8. Do not wrap output in markdown fences or add commentary

Return ONLY the corrected JavaScript code.
"""

    def _build_exports_imports_section(self, exports: dict, imports: dict) -> str:
        if not exports and not imports:
            return ""

        sections: list[str] = []

        if exports:
            export_list = "\n".join([f"- {name}: {desc}" for name, desc in exports.items()])
            sections.append(f"""
═══════════════════════════════════════════════════════════════
EXPORTS (State shared with other widgets)
═══════════════════════════════════════════════════════════════
{export_list}

🔴 CRITICAL EXPORT LIFECYCLE:
1. Initialize every export when the widget mounts
2. Update exports continuously (dragging, painting, playback, etc.)
3. Call model.set + model.save_changes() together every time the value changes
4. Remove listeners in React.useEffect cleanup blocks

✅ Example – Canvas selection
```javascript
React.useEffect(() => {{
  const canvas = canvasRef.current;
  if (!canvas) return;
  model.set("selected_indices", []);
  model.save_changes();

  const handlePointerMove = (evt) => {{
    if (!evt.buttons) return;
    const selection = computeSelection(evt, canvas);
    model.set("selected_indices", selection);
    model.save_changes();
  }};

  canvas.addEventListener("pointermove", handlePointerMove);
  return () => canvas.removeEventListener("pointermove", handlePointerMove);
}}, []);
```
""")

        if imports:
            import_list = "\n".join([f"- {name}: {desc}" for name, desc in imports.items()])
            sections.append(f"""
═══════════════════════════════════════════════════════════════
IMPORTS (State provided by other widgets)
═══════════════════════════════════════════════════════════════
{import_list}

🔴 CRITICAL IMPORT RULES:
1. Read imports via model.get inside effects or memoized callbacks
2. Subscribe with model.on("change:trait", handler) and unsubscribe on cleanup
3. Guard against null/empty payloads before mutating DOM/WebGL state
4. Trigger rerenders or recalculations immediately after each import change

✅ Example – React + heightmap import
```javascript
React.useEffect(() => {{
  if (!meshRef.current) return;

  const updateMesh = () => {{
    const heightmap = model.get("heightmap");
    if (!heightmap) return;
    const positions = meshRef.current.geometry?.attributes?.position;
    if (!positions) return;
    for (let i = 0; i < positions.count; i++) {{
      positions.setZ(i, (heightmap[i] || 0) * 25);
    }}
    positions.needsUpdate = true;
    meshRef.current.geometry?.computeVertexNormals?.();
  }};

  updateMesh();
  model.on("change:heightmap", updateMesh);
  return () => model.off?.("change:heightmap", updateMesh);
}}, []);
```
""")

        return "\n".join(sections)

    def _clean_code(self, code: str) -> str:
        code = re.sub(r"```(?:javascript|jsx?|typescript|tsx?)?\s*\n?", "", code)
        code = re.sub(r"\n?```\s*", "", code)
        return code.strip()
