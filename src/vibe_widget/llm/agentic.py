"""Agentic orchestrator for widget generation with streaming support."""

import json
from typing import Any, Callable

from anthropic import Anthropic

from vibe_widget.llm.tools import (
    CLIExecuteTool,
    CodeGenerateTool,
    CodePlanTool,
    CodeRepairTool,
    CodeValidateTool,
    DataLoadTool,
    DataProfileTool,
    DataWrangleTool,
    ErrorDiagnoseTool,
    RuntimeTestTool,
    ToolRegistry,
)


class AgentOrchestrator:
    """Orchestrates agentic widget generation with tool use and iteration."""

    def __init__(
        self,
        llm_provider,
        max_iterations: int = 12,
        max_repair_attempts: int = 3,
    ):
        self.llm_provider = llm_provider
        self.client = Anthropic(api_key=llm_provider.api_key)
        self.model = llm_provider.model
        self.max_iterations = max_iterations
        self.max_repair_attempts = max_repair_attempts

        # Initialize tool registry
        self.registry = ToolRegistry()
        self._register_tools()

        # Track orchestration state
        self.conversation_history = []
        self.artifacts = {}

    def _register_tools(self):
        """Register all available tools."""
        # Data tools
        self.registry.register(DataLoadTool())
        self.registry.register(DataProfileTool())
        self.registry.register(DataWrangleTool(self.llm_provider))

        # Code tools
        self.registry.register(CodePlanTool(self.llm_provider))
        self.registry.register(CodeGenerateTool(self.llm_provider))
        self.registry.register(CodeValidateTool())

        # Execution tools
        self.registry.register(CLIExecuteTool())
        self.registry.register(RuntimeTestTool())
        self.registry.register(ErrorDiagnoseTool())
        self.registry.register(CodeRepairTool(self.llm_provider))

    def generate_widget_code(
        self,
        description: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str, str], None] | None = None,
        df=None,
    ) -> str:
        """Generate widget code using agentic orchestration.

        Args:
            description: User's widget description
            data_info: Data information dict
            progress_callback: Callback for streaming progress updates
            df: Optional DataFrame for data tools

        Returns:
            Final validated widget code
        """
        # Initialize conversation with system prompt
        system_prompt = self._build_system_prompt()

        # Build initial user message
        user_message = self._build_initial_message(description, data_info)

        self.conversation_history = [{"role": "user", "content": user_message}]

        self._emit_progress(progress_callback, "step", "Starting agentic widget generation...")

        iteration = 0
        while iteration < self.max_iterations:
            iteration += 1
            self._emit_progress(progress_callback, "iteration", f"Iteration {iteration}/{self.max_iterations}")
            # print(f"Iteration {iteration}/{self.max_iterations}")

            try:
                # Call LLM with tools
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=8192,
                    system=system_prompt,
                    messages=self.conversation_history,
                    tools=self.registry.to_anthropic_tools(),
                )

                # Process response
                assistant_content = []
                tool_results = []

                for block in response.content:
                    if block.type == "text":
                        assistant_content.append({"type": "text", "text": block.text})
                        self._emit_progress(progress_callback, "thinking", block.text)

                    elif block.type == "tool_use":
                        tool_name = block.name
                        tool_input = block.input
                        tool_id = block.id

                        self._emit_progress(
                            progress_callback,
                            "tool",
                            f"Using tool: {tool_name}",
                        )
                        # print(f"Using tool: {tool_name}")

                        # Execute tool
                        tool = self.registry.get(tool_name)
                        if tool:
                            # Inject df if needed
                            if tool_name in ["data_load", "data_profile"] and df is not None:
                                tool_input["df"] = df

                            result = tool.execute(**tool_input)
                            # print(f"Tool {tool_name} executed.\n{result}")

                            # Store artifacts
                            if tool_name == "data_wrangle" and result.success:
                                self.artifacts["wrangle_code"] = result.output.get("code")
                            elif tool_name == "code_plan" and result.success:
                                self.artifacts["plan"] = result.output
                            elif tool_name == "code_generate" and result.success:
                                self.artifacts["generated_code"] = result.output.get("code")
                            elif tool_name == "code_validate" and result.success:
                                self.artifacts["validation"] = result.output

                            # Emit progress
                            if result.success:
                                self._emit_progress(
                                    progress_callback,
                                    "tool_result",
                                    f"{tool_name}: Success",
                                )
                            else:
                                self._emit_progress(
                                    progress_callback,
                                    "tool_result",
                                    f"{tool_name}: {result.error}",
                                )

                            # Format result for LLM
                            tool_result_content = self._format_tool_result(result)
                        else:
                            tool_result_content = json.dumps(
                                {"error": f"Tool {tool_name} not found"}
                            )

                        assistant_content.append(
                            {"type": "tool_use", "id": tool_id, "name": tool_name, "input": tool_input}
                        )
                        tool_results.append(
                            {"type": "tool_result", "tool_use_id": tool_id, "content": tool_result_content}
                        )

                # Add assistant message to history
                self.conversation_history.append({"role": "assistant", "content": assistant_content})

                # If there are tool results, add them and continue
                if tool_results:
                    self.conversation_history.append({"role": "user", "content": tool_results})
                    continue

                # Check if we have final code
                if response.stop_reason == "end_turn":
                    # Look for final code in artifacts
                    final_code = self.artifacts.get("generated_code")
                    if final_code:
                        self._emit_progress(progress_callback, "complete", "Widget generation complete")
                        return final_code

                    # If no code yet, prompt agent to proceed
                    self.conversation_history.append(
                        {
                            "role": "user",
                            "content": "Please proceed to generate the widget code if not already done.",
                        }
                    )

            except Exception as e:
                self._emit_progress(progress_callback, "error", f"Orchestration error: {str(e)}")
                raise

        # Max iterations reached
        final_code = self.artifacts.get("generated_code")
        if final_code:
            return final_code

        raise RuntimeError(f"Failed to generate widget after {self.max_iterations} iterations")

    def revise_widget_code(
        self,
        current_code: str,
        revision_description: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str, str], None] | None = None,
    ) -> str:
        """Revise widget code using agentic orchestration."""
        system_prompt = self._build_system_prompt()

        user_message = f"""Revise the following widget code according to the user's request.

USER REQUEST:
{revision_description}

CURRENT CODE:
```javascript
{current_code}
```

DATA INFO:
{json.dumps(data_info, indent=2)}

Use available tools to validate, test, and improve the code. Ensure all changes meet requirements.
"""

        self.conversation_history = [{"role": "user", "content": user_message}]
        self.artifacts = {"generated_code": current_code}

        return self._run_orchestration_loop(progress_callback)

    def fix_code_error(
        self,
        broken_code: str,
        error_message: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str, str], None] | None = None,
    ) -> str:
        """Fix code error using diagnostic tools."""
        # Use diagnostic tool first
        diagnose_tool = self.registry.get("error_diagnose")
        diagnosis = diagnose_tool.execute(error_message=error_message, code=broken_code)

        if not diagnosis.success:
            # Fallback to simple repair
            repair_tool = self.registry.get("code_repair")
            result = repair_tool.execute(
                code=broken_code,
                diagnosis={"error_type": "unknown", "full_error": error_message},
                data_info=data_info,
            )
            if result.success:
                return result.output["code"]
            raise RuntimeError(f"Failed to repair code: {result.error}")

        # Use orchestrated repair
        system_prompt = self._build_system_prompt()
        user_message = f"""Fix the following widget code error using available tools.

ERROR MESSAGE:
{error_message}

BROKEN CODE:
```javascript
{broken_code}
```

DATA INFO:
{json.dumps(data_info, indent=2)}

Use error_diagnose to analyze the error, then code_repair to fix it. Validate the fixed code.
"""

        self.conversation_history = [{"role": "user", "content": user_message}]
        self.artifacts = {}

        return self._run_orchestration_loop(progress_callback)

    def _run_orchestration_loop(
        self,
        progress_callback: Callable[[str, str], None] | None = None,
    ) -> str:
        """Run the orchestration loop until completion."""
        system_prompt = self._build_system_prompt()
        iteration = 0

        while iteration < self.max_iterations:
            iteration += 1
            self._emit_progress(progress_callback, "iteration", f"Iteration {iteration}/{self.max_iterations}")

            try:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=8192,
                    system=system_prompt,
                    messages=self.conversation_history,
                    tools=self.registry.to_anthropic_tools(),
                )

                assistant_content = []
                tool_results = []

                for block in response.content:
                    if block.type == "text":
                        assistant_content.append({"type": "text", "text": block.text})
                        self._emit_progress(progress_callback, "thinking", block.text[:200])

                    elif block.type == "tool_use":
                        tool_name = block.name
                        tool_input = block.input
                        tool_id = block.id

                        self._emit_progress(progress_callback, "tool", f"Using: {tool_name}")

                        tool = self.registry.get(tool_name)
                        if tool:
                            result = tool.execute(**tool_input)

                            if tool_name == "code_repair" and result.success:
                                self.artifacts["generated_code"] = result.output.get("code")

                            tool_result_content = self._format_tool_result(result)
                        else:
                            tool_result_content = json.dumps({"error": f"Tool {tool_name} not found"})

                        assistant_content.append(
                            {"type": "tool_use", "id": tool_id, "name": tool_name, "input": tool_input}
                        )
                        tool_results.append(
                            {"type": "tool_result", "tool_use_id": tool_id, "content": tool_result_content}
                        )

                self.conversation_history.append({"role": "assistant", "content": assistant_content})

                if tool_results:
                    self.conversation_history.append({"role": "user", "content": tool_results})
                    continue

                if response.stop_reason == "end_turn":
                    final_code = self.artifacts.get("generated_code")
                    if final_code:
                        return final_code
                    self.conversation_history.append(
                        {"role": "user", "content": "Please provide the final code."}
                    )

            except Exception as e:
                self._emit_progress(progress_callback, "error", str(e))
                raise

        final_code = self.artifacts.get("generated_code")
        if final_code:
            return final_code
        raise RuntimeError("Failed to complete orchestration")

    def _build_system_prompt(self) -> str:
        """Build system prompt for orchestrator."""
        return """You are an expert widget code generation agent with access to specialized tools.

Your goal is to generate high-quality and interactive React widgets for AnyWidget following exact specifications.

WORKFLOW:
1. Understand the user's requirements and data context
2. Use data tools if data analysis/transformation is needed
3. Create an implementation plan with code_plan ONLY IF the data is complex (e.g., large datasets, complex transformations, weird data formats)
4. Generate widget code with code_generate
5. Validate code with code_validate
6. Test runtime safety with runtime_test
7. If errors occur, use error_diagnose then code_repair
8. Iterate until validation passes

TOOL USAGE PRINCIPLES:
- Use tools sequentially, building on previous results
- Always validate generated code before returning
- For data-heavy widgets, profile data first to understand sampling needs
- For large datasets, ensure proper sampling to avoid performance issues
- Add defensive null checks for all data access
- Initialize exports immediately and subscribe to imports with cleanup
- Its okay to start with code_generate, no need to overthink or overcomplicate

QUALITY STANDARDS:
- Code must follow AnyWidget + htm conventions exactly
- Every React.useEffect must have cleanup handler
- CDN imports must be version-pinned
- Export/import lifecycle must be complete
- No JSX, ReactDOM.render, or document.body manipulation
- Proper error handling and null guards

When you have final validated code, indicate completion clearly.
"""

    def _build_initial_message(self, description: str, data_info: dict[str, Any]) -> str:
        """Build initial user message."""
        return f"""Generate a React widget for AnyWidget with the following requirements:

USER DESCRIPTION:
{description}

DATA CONTEXT:
- Columns: {data_info.get('columns', [])}
- Types: {data_info.get('dtypes', {})}
- Sample: {data_info.get('sample', {})}
- Exports: {data_info.get('exports', {})}
- Imports: {data_info.get('imports', {})}

Use available tools to:
1. Analyze data if needed (for visualizations, understand sampling requirements)
2. Create implementation plan ONLY IF data is complex (e.g., large datasets, complex transformations, weird data formats)
3. Generate high-quality and interactive widget code (with traitlets as needed)
4. Validate and test the code
5. Ensure all requirements are met
6. Proceed directly to code generation without planning for most scenarios.

Start by understanding the data context, then use tools systematically.
"""

    def _format_tool_result(self, result) -> str:
        """Format tool result for LLM consumption."""
        if result.success:
            # Truncate very large outputs
            output_str = json.dumps(result.output, default=str)
            if len(output_str) > 10000:
                # For dataframes, only send metadata
                if isinstance(result.output, dict) and "dataframe" in result.output:
                    output_copy = {k: v for k, v in result.output.items() if k != "dataframe"}
                    output_copy["dataframe"] = "<truncated>"
                    output_str = json.dumps(output_copy, default=str)
                else:
                    output_str = output_str[:10000] + "...(truncated)"
            return output_str
        else:
            return json.dumps({"error": result.error, "success": False})

    def _emit_progress(
        self,
        callback: Callable[[str, str], None] | None,
        event_type: str,
        message: str,
    ):
        """Emit progress event with type and message."""
        if callback:
            callback(event_type, message)

    def get_pipeline_artifacts(self) -> dict[str, Any]:
        """Get all artifacts generated during orchestration.

        Returns:
            Dict containing wrangle_code, plan, generated_code, validation, etc.
        """
        return self.artifacts
