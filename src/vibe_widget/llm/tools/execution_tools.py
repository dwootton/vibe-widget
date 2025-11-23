"""Execution, diagnostics, and repair tools."""

import re
import subprocess
import tempfile
from typing import Any

from vibe_widget.llm.tools.base import Tool, ToolResult


class CLIExecuteTool(Tool):
    """Tool for executing CLI commands for validation and diagnostics."""

    def __init__(self):
        super().__init__(
            name="cli_execute",
            description=(
                "Execute shell commands for validating data pipelines, "
                "checking dependencies, or diagnosing runtime issues. "
                "Use carefully and only for read-only or validation operations."
            ),
        )

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "command": {
                "type": "string",
                "description": "Shell command to execute",
                "required": True,
            },
            "purpose": {
                "type": "string",
                "description": "Why this command is being executed",
                "required": True,
            },
        }

    def execute(self, command: str, purpose: str) -> ToolResult:
        """Execute CLI command safely."""
        try:
            # Safety check: disallow dangerous commands
            dangerous_patterns = [
                r"\brm\b.*-rf",
                r"\bformat\b",
                r"\bmkfs\b",
                r"\bdd\b",
                r">.*passwd",
                r"\bsudo\b",
            ]

            for pattern in dangerous_patterns:
                if re.search(pattern, command, re.IGNORECASE):
                    return ToolResult(
                        success=False,
                        error=f"Dangerous command pattern detected: {pattern}",
                    )

            # Execute with timeout
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30,
            )

            output = {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "returncode": result.returncode,
                "command": command,
                "purpose": purpose,
            }

            success = result.returncode == 0

            return ToolResult(
                success=success,
                output=output,
                error=result.stderr if not success else None,
                metadata={"purpose": purpose},
            )

        except subprocess.TimeoutExpired:
            return ToolResult(success=False, error="Command timed out after 30 seconds")
        except Exception as e:
            return ToolResult(success=False, error=str(e))


class RuntimeTestTool(Tool):
    """Tool for testing widget code before frontend execution."""

    def __init__(self):
        super().__init__(
            name="runtime_test",
            description=(
                "Test widget code by checking for syntax errors, "
                "import resolution, and basic structural validity. "
                "Catches issues before code reaches the frontend."
            ),
        )

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "code": {
                "type": "string",
                "description": "Widget code to test",
                "required": True,
            }
        }

    def execute(self, code: str) -> ToolResult:
        """Test widget code."""
        try:
            issues = []

            # Test 1: Check for syntax errors using Node.js
            with tempfile.NamedTemporaryFile(mode="w", suffix=".js", delete=False) as f:
                f.write(code)
                temp_file = f.name

            try:
                # Try to parse with node --check
                result = subprocess.run(
                    ["node", "--check", temp_file],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )

                if result.returncode != 0:
                    issues.append(f"Syntax error: {result.stderr}")

            except FileNotFoundError:
                # Node not available, skip syntax check
                issues.append("Node.js not available for syntax checking")
            except Exception as e:
                issues.append(f"Syntax check failed: {str(e)}")
            finally:
                import os

                os.unlink(temp_file)

            # Test 2: Check for common runtime issues
            if "undefined" in code and "typeof" not in code:
                issues.append("Warning: Direct 'undefined' usage without typeof check")

            # Test 3: Check imports are accessible
            import_matches = re.findall(r'from\s+["\']([^"\']+)["\']', code)
            for imp in import_matches:
                if imp.startswith("https://"):
                    # Could validate CDN URL is accessible, but skip for speed
                    pass
                elif not imp.startswith(".") and not imp.startswith("/"):
                    issues.append(f"Warning: Non-CDN import '{imp}' may not resolve")

            success = len([i for i in issues if not i.startswith("Warning:")]) == 0

            test_result = {
                "passed": success,
                "issues": issues,
                "summary": f"Runtime test {'passed' if success else 'failed'} with {len(issues)} issue(s)",
            }

            return ToolResult(
                success=success,
                output=test_result,
                error="; ".join(issues) if not success else None,
            )

        except Exception as e:
            return ToolResult(success=False, error=f"Runtime test error: {str(e)}")


class ErrorDiagnoseTool(Tool):
    """Tool for diagnosing runtime errors from widget execution."""

    def __init__(self):
        super().__init__(
            name="error_diagnose",
            description=(
                "Analyze runtime error messages to identify root cause "
                "and categorize by type (syntax, import, logic, data). "
                "Provides actionable diagnosis for repair."
            ),
        )

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "error_message": {
                "type": "string",
                "description": "Runtime error message from widget execution",
                "required": True,
            },
            "code": {
                "type": "string",
                "description": "Widget code that produced the error",
                "required": True,
            },
        }

    def execute(self, error_message: str, code: str) -> ToolResult:
        """Diagnose error and categorize."""
        try:
            diagnosis = {
                "error_type": "unknown",
                "root_cause": "",
                "affected_lines": [],
                "suggested_fix": "",
            }

            error_lower = error_message.lower()

            # Categorize error type
            if "syntaxerror" in error_lower or "unexpected token" in error_lower:
                diagnosis["error_type"] = "syntax"
                diagnosis["root_cause"] = "JavaScript syntax error"
                diagnosis["suggested_fix"] = "Fix syntax - check brackets, quotes, and semicolons"

            elif "referenceerror" in error_lower or "is not defined" in error_lower:
                diagnosis["error_type"] = "reference"
                # Extract variable name
                var_match = re.search(r"(\w+)\s+is not defined", error_message)
                if var_match:
                    var_name = var_match.group(1)
                    diagnosis["root_cause"] = f"Variable '{var_name}' is not defined"
                    diagnosis[
                        "suggested_fix"
                    ] = f"Declare '{var_name}' before use or check for typos"
                else:
                    diagnosis["root_cause"] = "Reference to undefined variable"
                    diagnosis["suggested_fix"] = "Check variable declarations and imports"

            elif "typeerror" in error_lower:
                diagnosis["error_type"] = "type"
                if "null" in error_lower or "undefined" in error_lower:
                    diagnosis["root_cause"] = "Attempting to access property of null/undefined"
                    diagnosis[
                        "suggested_fix"
                    ] = "Add null checks before accessing properties (e.g., obj?.property)"
                elif "is not a function" in error_lower:
                    diagnosis["root_cause"] = "Calling non-function as function"
                    diagnosis["suggested_fix"] = "Check that the value is actually a function"
                else:
                    diagnosis["root_cause"] = "Type mismatch or invalid operation"
                    diagnosis["suggested_fix"] = "Check data types and conversions"

            elif "import" in error_lower or "module" in error_lower:
                diagnosis["error_type"] = "import"
                diagnosis["root_cause"] = "Module import failed"
                diagnosis["suggested_fix"] = "Check CDN URL is correct and version is available"

            elif "cannot read" in error_lower or "cannot set" in error_lower:
                diagnosis["error_type"] = "access"
                diagnosis["root_cause"] = "Invalid property access"
                diagnosis["suggested_fix"] = "Add existence checks before accessing nested properties"

            else:
                diagnosis["error_type"] = "runtime"
                diagnosis["root_cause"] = "Runtime error during execution"
                diagnosis["suggested_fix"] = "Review error message and add defensive checks"

            # Extract line numbers if present
            line_match = re.findall(r":(\d+):\d+", error_message)
            if line_match:
                diagnosis["affected_lines"] = [int(line) for line in line_match]

            diagnosis["full_error"] = error_message

            return ToolResult(success=True, output=diagnosis)

        except Exception as e:
            return ToolResult(success=False, error=f"Diagnosis error: {str(e)}")


class CodeRepairTool(Tool):
    """Tool for repairing widget code based on error diagnosis."""

    def __init__(self, llm_provider):
        super().__init__(
            name="code_repair",
            description=(
                "Repair broken widget code based on error diagnosis. "
                "Generates fixed code that addresses the identified issues "
                "while preserving intended functionality."
            ),
        )
        self.llm_provider = llm_provider

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "code": {
                "type": "string",
                "description": "Broken widget code",
                "required": True,
            },
            "diagnosis": {
                "type": "object",
                "description": "Error diagnosis from error_diagnose tool",
                "required": True,
            },
            "data_info": {
                "type": "object",
                "description": "Original data information",
                "required": True,
            },
        }

    def execute(
        self,
        code: str,
        diagnosis: dict[str, Any],
        data_info: dict[str, Any],
    ) -> ToolResult:
        """Repair widget code."""
        try:
            prompt = f"""Fix the broken AnyWidget React code based on the error diagnosis.

ERROR DIAGNOSIS:
Type: {diagnosis.get('error_type')}
Root Cause: {diagnosis.get('root_cause')}
Suggested Fix: {diagnosis.get('suggested_fix')}
Full Error: {diagnosis.get('full_error')}

BROKEN CODE:
```javascript
{code}
```

DATA INFO:
Columns: {data_info.get('columns', [])}
Types: {data_info.get('dtypes', {})}
Exports: {data_info.get('exports', {})}
Imports: {data_info.get('imports', {})}

FIX REQUIREMENTS:
1. Keep the same interaction model and functionality
2. Address the specific error identified in diagnosis
3. Add defensive checks where needed (null checks, type guards)
4. Maintain proper export/import lifecycle
5. Keep cleanup handlers intact
6. Follow AnyWidget + htm conventions

CRITICAL RULES:
- export default function Widget({{ model, html, React }})
- Use html tagged templates (htm) not JSX
- Guard model.get() payloads before use
- Keep CDN imports version-pinned
- Initialize exports and call model.save_changes()
- Subscribe to imports with model.on/model.off
- Return cleanup in every React.useEffect

Return ONLY the corrected JavaScript code. No markdown fences or explanations.
"""

            from anthropic import Anthropic

            client = Anthropic(api_key=self.llm_provider.api_key)
            message = client.messages.create(
                model=self.llm_provider.model,
                max_tokens=8192,
                messages=[{"role": "user", "content": prompt}],
            )

            fixed_code = message.content[0].text
            # Clean code
            fixed_code = re.sub(r"```(?:javascript|jsx?|typescript|tsx?)?\s*\n?", "", fixed_code)
            fixed_code = re.sub(r"\n?```\s*", "", fixed_code)
            fixed_code = fixed_code.strip()

            return ToolResult(
                success=True,
                output={"code": fixed_code},
                metadata={"diagnosis": diagnosis},
            )

        except Exception as e:
            return ToolResult(success=False, error=f"Repair error: {str(e)}")
