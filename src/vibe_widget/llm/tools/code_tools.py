"""Code generation and validation tools."""

import ast
import re
from typing import Any

from vibe_widget.llm.tools.base import Tool, ToolResult


class CodePlanTool(Tool):
    """Tool for creating a plan for widget code generation."""

    def __init__(self, llm_provider):
        super().__init__(
            name="code_plan",
            description=(
                "Create a detailed plan for widget implementation including: "
                "component structure, libraries needed, interaction patterns, "
                "export/import traits, and styling approach. "
                "This plan guides the code generation process."
            ),
        )
        self.llm_provider = llm_provider

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "description": {
                "type": "string",
                "description": "User's widget description/requirements",
                "required": True,
            },
            "data_profile": {
                "type": "object",
                "description": "Data profile from profiling step (can be None)",
                "required": False,
            },
            "exports": {
                "type": "object",
                "description": "Export traits specification",
                "required": False,
            },
            "imports": {
                "type": "object",
                "description": "Import traits specification",
                "required": False,
            },
        }

    def execute(
        self,
        description: str,
        data_profile: dict[str, Any] | None = None,
        exports: dict[str, str] | None = None,
        imports: dict[str, str] | None = None,
    ) -> ToolResult:
        """Generate implementation plan."""
        try:
            prompt = f"""Create a detailed implementation plan for an AnyWidget React component.

Widget Description:
{description}

Data Profile:
{data_profile if data_profile else "No data - widget uses imports or is standalone"}

Exports (state shared with other widgets):
{exports if exports else "None"}

Imports (state from other widgets):
{imports if imports else "None"}

Generate a structured and concise plan with:
1. Component purpose and interaction model
2. Required libraries (with CDN URLs and versions)
3. State management approach
4. Export/import lifecycle (initialization, updates, subscriptions)
5. Layout and styling strategy
6. Key implementation considerations

Return the plan in JSON format with keys "purpose", "libraries", "state", "interactions", "styling", and "considerations".
ONLY provide the JSON without any extra text, not explanation, no pseudo code, just JSON.
Example output format:
{{
  "purpose": "Brief component purpose",
  "libraries": [
    {{"name": "library-name", "version": "X.Y", "cdn": "https://..."}}
  ],
  "state": {{
    "local": ["state1", "state2"],
    "exports": ["export1"],
    "imports": ["import1"]
  }},
  "interactions": ["interaction1", "interaction2"],
  "styling": {{"approach": "description", "key_elements": ["element1", "element2"]}},
  "considerations": ["consideration1", "consideration2"]
}}
"""

            from anthropic import Anthropic

            client = Anthropic(api_key=self.llm_provider.api_key)
            message = client.messages.create(
                model=self.llm_provider.model,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )

            plan_text = message.content[0].text
            # Extract JSON from response
            import json

            # Try to find JSON block
            json_match = re.search(r"\{.*\}", plan_text, re.DOTALL)
            if json_match:
                plan = json.loads(json_match.group(0))
            else:
                # Fallback: return text as-is
                plan = {"raw": plan_text}

            return ToolResult(success=True, output=plan)

        except Exception as e:
            return ToolResult(success=False, output={}, error=str(e))


class CodeGenerateTool(Tool):
    """Tool for generating widget code based on plan."""

    def __init__(self, llm_provider):
        super().__init__(
            name="code_generate",
            description=(
                "Generate complete React widget code following AnyWidget conventions. "
                "Uses htm for templates, proper export/import lifecycle, cleanup handlers, "
                "and follows all widget specification requirements."
            ),
        )
        self.llm_provider = llm_provider

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "plan": {
                "type": "object",
                "description": "Implementation plan from code_plan tool",
                "required": True,
            },
            "description": {
                "type": "string",
                "description": "Original widget description",
                "required": True,
            },
            "data_info": {
                "type": "object",
                "description": "Data information including columns, types, samples",
                "required": True,
            },
        }

    def execute(
        self,
        plan: dict[str, Any],
        description: str,
        data_info: dict[str, Any],
    ) -> ToolResult:
        """Generate widget code."""
        try:
            # Build detailed prompt using the specification from claude.py
            prompt = self._build_generation_prompt(plan, description, data_info)

            # Generate with streaming support
            from anthropic import Anthropic

            client = Anthropic(api_key=self.llm_provider.api_key)
            message = client.messages.create(
                model=self.llm_provider.model,
                max_tokens=8192,
                messages=[{"role": "user", "content": prompt}],
            )

            code = message.content[0].text
            # Clean code
            code = self._clean_code(code)

            return ToolResult(
                success=True,
                output={"code": code, "plan": plan},
                metadata={"description": description},
            )

        except Exception as e:
            return ToolResult(success=False, output={}, error=str(e))

    def _build_generation_prompt(
        self, plan: dict[str, Any], description: str, data_info: dict[str, Any]
    ) -> str:
        """Build generation prompt with full specification."""
        import json

        columns = data_info.get("columns", [])
        dtypes = data_info.get("dtypes", {})
        sample_data = data_info.get("sample", {})
        exports = data_info.get("exports", {})
        imports = data_info.get("imports", {})

        exports_section = ""
        if exports:
            export_list = "\n".join([f"- {name}: {desc}" for name, desc in exports.items()])
            exports_section = f"""
EXPORTS (State shared with other widgets):
{export_list}

CRITICAL EXPORT LIFECYCLE:
1. Initialize every export when the widget mounts
2. Update exports continuously (dragging, painting, playback, etc.)
3. Call model.set + model.save_changes() together every time the value changes
4. Remove listeners in React.useEffect cleanup blocks
"""

        imports_section = ""
        if imports:
            import_list = "\n".join([f"- {name}: {desc}" for name, desc in imports.items()])
            imports_section = f"""
IMPORTS (State provided by other widgets):
{import_list}

CRITICAL IMPORT RULES:
1. Read imports via model.get inside effects or memoized callbacks
2. Subscribe with model.on("change:trait", handler) and unsubscribe on cleanup
3. Guard against null/empty payloads before mutating DOM/WebGL state
4. Trigger rerenders or recalculations immediately after each import change
"""

        return f"""Generate a high-quality React widget for AnyWidget following this implementation plan.

TASK: {description}

IMPLEMENTATION PLAN:
{json.dumps(plan, indent=2)}

DATA SCHEMA:
- Columns: {', '.join(columns) if columns else 'No data (widget uses imports only)'}
- Types: {dtypes}
- Sample: {sample_data}

{exports_section}

{imports_section}

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
import * as d3
from venv311.bin.pdf2txt import OUTPUT_TYPES from "https://esm.sh/d3@7";

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

COMMON PITFALLS TO AVOID:
- Incorrect Three.js imports → use https://esm.sh/three@0.160 + matching submodules
- Typos in constants (THREE.PCFShadowShadowMap) → spell EXACTLY (THREE.PCFSoftShadowMap)
- Touching geometry attributes without checking they exist → guard geometry.attributes.position
- Mutating data without null checks → verify model.get() payloads before iterating
- Appending to document.body or using window globals instead of html refs
- Forgetting cleanup → every effect must remove listeners, observers, raf handles, timers
- Exporting state only once or forgetting model.save_changes()

FRONTEND AESTHETICS:
- Typography: pick distinctive pairings—avoid generic system fonts
- Color & Theme: commit to a palette, use CSS variables, sharp accents
- Motion: purposeful animations (staggered entrances, hover reveals) with cleanup
- Spatial Composition: embrace asymmetry, layering, depth
- Background Details: gradient meshes, subtle noise, geometric motifs; never default plain white unless justified

OUTPUT REQUIREMENTS:
Generate ONLY the working JavaScript code (imports → export default function Widget...).
- NO explanations before or after
- NO markdown fences
- NO console logs unless essential for debugging

Begin the response with code immediately.
"""

    def _clean_code(self, code: str) -> str:
        """Clean generated code."""
        code = re.sub(r"```(?:javascript|jsx?|typescript|tsx?)?\s*\n?", "", code)
        code = re.sub(r"\n?```\s*", "", code)
        return code.strip()


class CodeValidateTool(Tool):
    """Tool for validating generated widget code."""

    def __init__(self):
        super().__init__(
            name="code_validate",
            description=(
                "Validate widget code for syntax errors, required exports, "
                "proper cleanup handlers, and common pitfalls. "
                "Returns validation results with specific issues found."
            ),
        )

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "code": {
                "type": "string",
                "description": "Generated widget code to validate",
                "required": True,
            },
            "expected_exports": {
                "type": "array",
                "description": "List of expected export trait names",
                "required": False,
            },
            "expected_imports": {
                "type": "array",
                "description": "List of expected import trait names",
                "required": False,
            },
        }

    def execute(
        self,
        code: str,
        expected_exports: list[str] | None = None,
        expected_imports: list[str] | None = None,
    ) -> ToolResult:
        """Validate widget code."""
        issues = []
        warnings = []

        try:
            # Check 1: Default export exists
            if "export default function" not in code:
                issues.append("Missing 'export default function' declaration")

            # Check 2: Widget function signature
            if "export default function" in code:
                match = re.search(r"export default function \w+\s*\(([^)]*)\)", code)
                if match:
                    params = match.group(1)
                    if ("model" not in params or "html" not in params or "React" not in params) and not re.search(r"export default function \w+\s*\(\s*\{[^}]*\bmodel\b[^}]*\}", code, re.DOTALL):
                        issues.append(
                            "Widget function must accept parameters { model, html, React }"
                        )
                else:
                    issues.append("Malformed widget function declaration")


            # Check 3: html template usage
            if "html`" not in code:
                warnings.append("No html template usage found - are you using htm correctly?")


            # Check 4: Export lifecycle (if exports expected)
            print(expected_exports)
            if expected_exports:
                for export_name in expected_exports:
                    #? Error: Export 'Widget' never set with model.set(); Missing model.save_changes() call for exports
                    if export_name[0].isupper():
                        continue
                    # Check for model.set
                    if f'model.set("{export_name}"' not in code and f"model.set('{export_name}'" not in code:
                        issues.append(f"Export '{export_name}' never set with model.set()")
                    # Check for model.save_changes
                    if code.count("model.save_changes()") == 0:
                        issues.append("Missing model.save_changes() call for exports")

            # Check 5: Import subscription (if imports expected)
            if expected_imports:
                for import_name in expected_imports:
                    # Check for model.on
                    if f'model.on("change:{import_name}"' not in code and f"model.on('change:{import_name}'" not in code:
                        warnings.append(f"Import '{import_name}' not subscribed with model.on()")

            # Check 6: Cleanup handlers
            # useeffect_count = code.count("React.useEffect")
            # return_cleanup_count = code.count("return () =>")
            # if useeffect_count > 0 and return_cleanup_count < useeffect_count:
            #     warnings.append(
            #         f"Found {useeffect_count} useEffect but only {return_cleanup_count} cleanup handlers"
            #     )

            # Check 7: Common pitfalls
            if "document.body" in code:
                issues.append("Direct document.body manipulation detected - use refs instead")

            if "ReactDOM.render" in code:
                issues.append("ReactDOM.render not allowed - use html templates")

            if "className=" in code and "html`" in code:
                warnings.append("Use 'class=' not 'className=' in htm templates")

            # Check 8: CDN imports versioning
            cdn_imports = re.findall(r'from\s+["\']https://esm\.sh/([^"\']+)["\']', code)
            for imp in cdn_imports:
                if "@" not in imp:
                    warnings.append(f"CDN import '{imp}' missing version - should pin version (e.g., d3@7)")

            # Determine success
            success = len(issues) == 0

            validation_result = {
                "valid": success,
                "issues": issues,
                "warnings": warnings,
                "summary": f"Found {len(issues)} issues and {len(warnings)} warnings",
            }

            return ToolResult(
                success=success,
                output=validation_result,
                error="; ".join(issues) if issues else None,
            )

        except Exception as e:
            return ToolResult(success=False, output={}, error=f"Validation error: {str(e)}")
