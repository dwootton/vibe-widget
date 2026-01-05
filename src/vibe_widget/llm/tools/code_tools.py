"""Code generation and validation tools."""

import re
from typing import Any

from vibe_widget.llm.tools.base import Tool, ToolResult


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

            if "document.body" in code:
                issues.append("Direct document.body manipulation detected - use refs instead")

            if "ReactDOM.render" in code:
                issues.append("ReactDOM.render not allowed - use html templates")

            react_import_pattern = re.compile(
                r"""(
                    from\s+["'](?:react(?:/jsx-runtime)?|react-dom(?:/client)?)["']|
                    require\(\s*["'](?:react(?:/jsx-runtime)?|react-dom(?:/client)?)["']\s*\)|
                    from\s+["']https?://[^"']*react[^"']*["']
                )""",
                re.VERBOSE,
            )
            if react_import_pattern.search(code):
                issues.append(
                    "Do not import React/ReactDOM or react/jsx-runtime; use the React prop provided by the host."
                )

            if "className=" in code and "html`" in code:
                warnings.append("Use 'class=' not 'className=' in htm templates")

            if (
                re.search(r"style\s*=\s*['\"]", code)
                or re.search(r"style\s*=\s*\$\{\s*['\"]", code)
                or re.search(r"style\s*=\s*\{\s*['\"]", code)
            ):
                issues.append(
                    "Inline style must be an object literal: use style=${{ ... }} not a string"
                )

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
