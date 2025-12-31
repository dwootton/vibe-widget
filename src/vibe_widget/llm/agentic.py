from typing import Any, Callable, Tuple


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
        
        # Validate code
        self._emit(progress_callback, "step", "Validating code")
        validation = self.validate_tool.execute(
            code=code,
            expected_exports=list(outputs.keys()),
            expected_imports=list(inputs.keys()),
        )
        
        # Runtime test
        self._emit(progress_callback, "step", "Testing runtime")
        runtime = self.runtime_tool.execute(code=code)
        
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
            
            repair_attempts += 1
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
