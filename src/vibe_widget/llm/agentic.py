from typing import Any, Callable, Optional, Tuple
import re


from vibe_widget.llm.providers.base import LLMProvider
# Tool imports
from vibe_widget.llm.tools.data_tools import DataLoadTool, DataProfileTool, DataWrangleTool
from vibe_widget.llm.tools.code_tools import CodeValidateTool
from vibe_widget.llm.tools.execution_tools import RuntimeTestTool, ErrorDiagnoseTool


class AgenticOrchestrator:
    """
    Main orchestrator for widget generation.
    
    Flow:
    1. Receive DataFrame (already processed by DataProcessor)
    2. Generate code with LLM provider
    3. Validate code (Python-based)
    4. If errors: repair with LLM
    5. Return final code
    """
    
    def __init__(
        self,
        provider: LLMProvider,
        max_repair_attempts: int = 3,
    ):
        self.provider = provider
        self.max_repair_attempts = max_repair_attempts

        # Tool instances
        self.data_load_tool = DataLoadTool()
        self.data_profile_tool = DataProfileTool()
        self.data_wrangle_tool = DataWrangleTool(llm_provider=provider)
        self.validate_tool = CodeValidateTool()
        self.runtime_tool = RuntimeTestTool()
        self.diagnose_tool = ErrorDiagnoseTool()

        # For storing artifacts if needed
        self.artifacts = {}

    def _sanitize_code(self, code: str) -> str:
        """
        Normalize inline style strings into object literals to satisfy HTM rules.
        Example: style="color: red; height: 420px" -> style=${{ color: "red", height: "420px" }}
        """

        def css_to_object(css: str) -> Optional[str]:
            entries = []
            for part in css.split(";"):
                part = part.strip()
                if not part or ":" not in part:
                    continue
                key, value = part.split(":", 1)
                key = key.strip()
                value = value.strip()
                if not key or not value:
                    continue
                key_camel = re.sub(r"-([a-zA-Z])", lambda m: m.group(1).upper(), key)
                entries.append(f'{key_camel}: "{value}"')
            if not entries:
                return None
            return f"${{{{ {', '.join(entries)} }}}}"

        # Only convert inline style attributes that are plain CSS strings (no templates/objects).
        # Allow inner quotes (e.g., font-family: 'Geograph', sans-serif) by separating outer quotes.
        # Apply only on lines that look like markup to avoid mangling arbitrary JS strings.
        literal_style_double = re.compile(
            r'style\s*=\s*"([^"{}$]*)"',
            re.IGNORECASE,
        )
        literal_style_single = re.compile(
            r"style\s*=\s*'([^'{}$]*)'",
            re.IGNORECASE,
        )
        templated_style_double = re.compile(
            r'style\s*=\s*\$\s*\{\s*"([^"{}$]*)"\s*\}',
            re.IGNORECASE,
        )
        templated_style_single = re.compile(
            r"style\s*=\s*\$\s*\{\s*'([^'{}$]*)'\s*\}",
            re.IGNORECASE,
        )
        markup_hint = re.compile(r"<[a-zA-Z]", re.IGNORECASE)

        def literal_replacer(match: re.Match[str]) -> str:
            css = match.group(1)
            converted = css_to_object(css)
            return f"style={converted}" if converted else match.group(0)

        def templated_replacer(match: re.Match[str]) -> str:
            css = match.group(1)
            converted = css_to_object(css)
            return f"style={converted}" if converted else match.group(0)

        try:
            # Process line by line to avoid touching non-markup contexts
            lines = code.splitlines()
            for i, line in enumerate(lines):
                if not markup_hint.search(line):
                    continue
                line = literal_style_double.sub(literal_replacer, line)
                line = literal_style_single.sub(literal_replacer, line)
                line = templated_style_double.sub(templated_replacer, line)
                line = templated_style_single.sub(templated_replacer, line)
                lines[i] = line
            return "\n".join(lines)
        except Exception:
            return code

    def _try_inline_style_fix(
        self,
        code: str,
        validation_fn: Callable[[str], Any],
        runtime_fn: Callable[[str], Any],
    ) -> tuple[str, Any, Any]:
        """
        If validation flags inline style string issues, attempt to sanitize and re-validate
        before invoking LLM repairs.
        """
        validation = validation_fn(code)
        runtime = runtime_fn(code)
        issues = []
        if validation and hasattr(validation, "output"):
            issues.extend(validation.output.get("issues", []))
        inline_issue = any(
            "inline style must be an object literal" in str(item).lower()
            for item in issues
        )
        if inline_issue:
            sanitized = self._sanitize_code(code)
            if sanitized != code:
                code = sanitized
                validation = validation_fn(code)
                runtime = runtime_fn(code)
        return code, validation, runtime
    
    def generate(
        self,
        description: str,
        outputs: dict[str, str] | None = None,
        inputs: dict[str, str] | None = None,
        input_summaries: dict[str, str] | None = None,
        actions: dict[str, str] | None = None,
        action_params: dict[str, dict[str, str] | None] | None = None,
        base_code: str | None = None,
        base_components: list[str] | None = None,
        theme_description: str | None = None,
        progress_callback: Callable[[str, str], None] | None = None,
    ) -> Tuple[str, None]:
        """
        Generate widget code from description and summarized inputs.
        
        Args:
            description: Natural language widget description
            outputs: Dict of output trait names -> descriptions
            inputs: Dict of input trait names -> descriptions
            input_summaries: Dict of input summaries for prompt context
            base_code: Optional base widget code for composition/revision
            base_components: Optional list of component names from base widget
            progress_callback: Optional callback for progress updates
        
        Returns:
            Tuple of (widget_code, None)
        """
        outputs = outputs or {}
        inputs = inputs or {}
        input_summaries = input_summaries or inputs or {}
        actions = actions or {}
        action_params = action_params or {}
        base_components = base_components or []
        
        self._emit(progress_callback, "step", "Analyzing data")
        
        # Build data context for LLM using base class method
        data_info = LLMProvider.build_data_info(
            outputs=outputs,
            inputs=input_summaries,
            actions=actions,
            action_params=action_params,
            theme_description=theme_description,
        )
        
        if input_summaries:
            self._emit(progress_callback, "step", f"Inputs: {len(input_summaries)}")
        
        # Determine if this is a revision or fresh generation
        if base_code:
            self._emit(progress_callback, "step", "Revising widget based on base code...")
            code = self.provider.revise_widget_code(
                current_code=base_code,
                revision_description=description,
                data_info=data_info,
                base_code=None,  # Already in current_code
                base_components=base_components,
                progress_callback=lambda msg: self._emit(progress_callback, "chunk", msg),
            )
        else:
            # Generate code with LLM provider
            self._emit(progress_callback, "step", "Generating widget code...")
            code = self.provider.generate_widget_code(
                description=description,
                data_info=data_info,
                progress_callback=lambda msg: self._emit(progress_callback, "chunk", msg),
            )

        code = self._sanitize_code(code)

        def _validate(c: str):
            return self.validate_tool.execute(
                code=c,
                expected_exports=list(outputs.keys()),
                expected_imports=list(inputs.keys()),
            )

        def _runtime(c: str):
            return self.runtime_tool.execute(code=c)

        # Validate code (with a pass to auto-fix inline style strings)
        self._emit(progress_callback, "step", "Validating code")
        code, validation, runtime = self._try_inline_style_fix(code, _validate, _runtime)
        
        # Runtime test (already run in try_inline_style_fix)
        self._emit(progress_callback, "step", "Testing runtime")
        
        # Repair loop if needed
        repair_attempts = 0
        while repair_attempts < self.max_repair_attempts:
            issues = []
            
            if not validation.success:
                issues.extend(validation.output.get("issues", []))
            if not runtime.success:
                issues.extend(runtime.output.get("issues", []))
            
            if not issues:
                break

            inline_issue = any(
                "inline style must be an object literal" in str(item).lower()
                for item in issues
            )
            if inline_issue:
                sanitized = self._sanitize_code(code)
                if sanitized != code:
                    code = sanitized
                    validation = self.validate_tool.execute(
                        code=code,
                        expected_exports=list(outputs.keys()),
                        expected_imports=list(inputs.keys()),
                    )
                    runtime = self.runtime_tool.execute(code=code)
                    continue
            
            repair_attempts += 1
            if issues:
                preview = "; ".join(issues[:2])
                self._emit(progress_callback, "step", f"Issues found: {preview[:200]}")
            self._emit(progress_callback, "step", f"Repairing code (attempt {repair_attempts})...")
            # print out all issues
            for issue in issues:
                self._emit(progress_callback, "chunk", f"Issue: {issue}")
                print(f"Issue: {issue}")
            
            # Use provider's fix_code_error for first issue if it's a clear error
            if len(issues) == 1 and ("error" in issues[0].lower() or "exception" in issues[0].lower()):
                code = self.provider.fix_code_error(
                    broken_code=code,
                    error_message=issues[0],
                    data_info=data_info,
                )
            else:
                # For validation issues, build a repair prompt manually
                code = self._repair_with_issues(code, issues, data_info)

            code = self._sanitize_code(code)
            
            # Re-validate
            validation = self.validate_tool.execute(
                code=code,
                expected_exports=list(outputs.keys()),
                expected_imports=list(inputs.keys()),
            )
            runtime = self.runtime_tool.execute(code=code)
        
        self._emit(progress_callback, "complete", "Widget generation complete")
        
        # Store artifacts
        self.artifacts["generated_code"] = code
        self.artifacts["validation"] = validation.output
        
        return code, None
    
    def fix_runtime_error(
        self,
        code: str,
        error_message: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str, str], None] | None = None,
    ) -> str:
        """
        Fix a runtime error in widget code.
        
        Args:
            code: Current widget code with error
            error_message: Error message from runtime
            data_info: Data context information
            progress_callback: Optional progress callback
        
        Returns:
            Fixed widget code
        """
        self._emit(progress_callback, "step", "Diagnosing error...")
        
        diagnosis = self.diagnose_tool.execute(
            error_message=error_message,
            code=code,
        )
        full_error = diagnosis.output.get("full_error", error_message)
        affected_lines = diagnosis.output.get("affected_lines") or []
        if affected_lines:
            code_lines = code.splitlines()
            snippet_lines = []
            for line_num in sorted(set(affected_lines)):
                start = max(1, line_num - 2)
                end = min(len(code_lines), line_num + 2)
                for idx in range(start, end + 1):
                    snippet_lines.append(f"{idx}: {code_lines[idx - 1]}")
            snippet = "\n".join(snippet_lines)
            full_error = f"{full_error}\n\nCode context:\n{snippet}"
        
        self._emit(progress_callback, "step", "Repairing code")
        
        fixed_code = self.provider.fix_code_error(
            broken_code=code,
            error_message=full_error,
            data_info=data_info,
        )
        
        return fixed_code
    
    def revise_code(
        self,
        code: str,
        revision_request: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str, str], None] | None = None,
    ) -> str:
        """
        Revise widget code based on user request.
        
        Args:
            code: Current widget code
            revision_request: User's revision request
            data_info: Data context information
            progress_callback: Optional progress callback
        
        Returns:
            Revised widget code
        """
        self._emit(progress_callback, "step", "Revising widget code...")
        
        revised_code = self.provider.revise_widget_code(
            current_code=code,
            revision_description=revision_request,
            data_info=data_info,
            progress_callback=lambda msg: self._emit(progress_callback, "chunk", msg),
        )
        
        # Validate
        self._emit(progress_callback, "step", "Validating revision...")
        validation = self.validate_tool.execute(code=revised_code)
        
        if not validation.success:
            self._emit(progress_callback, "step", "Fixing validation issues...")
            issues = validation.output.get("issues", [])
            revised_code = self._repair_with_issues(revised_code, issues, data_info)
        
        self._emit(progress_callback, "complete", "Revision complete")
        return revised_code
    
    def _repair_with_issues(
        self,
        code: str,
        issues: list[str],
        data_info: dict[str, Any],
    ) -> str:
        """Repair code using provider with list of issues."""
        error_message = "Validation issues:\n" + "\n".join(f"- {issue}" for issue in issues)

        # Add local code context for any issues that include line numbers
        lines = code.splitlines()
        context_blocks: list[str] = []
        for issue in issues:
            match = re.search(r"line\s+(\d+)", issue, re.IGNORECASE)
            if not match:
                continue
            try:
                line_no = int(match.group(1))
            except ValueError:
                continue
            if 1 <= line_no <= len(lines):
                snippet = lines[line_no - 1].strip()
                context_blocks.append(f"Line {line_no}: {snippet}")
        if context_blocks:
            error_message += "\nRelevant code context:\n" + "\n".join(context_blocks)
        
        return self.provider.fix_code_error(
            broken_code=code,
            error_message=error_message,
            data_info=data_info,
        )
    
    def _emit(
        self,
        callback: Callable[[str, str], None] | None,
        event_type: str,
        message: str,
    ):
        """Emit progress event."""
        if callback:
            callback(event_type, message)
