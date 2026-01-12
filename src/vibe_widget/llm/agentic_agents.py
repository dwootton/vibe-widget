"""Agent SDK-style orchestrator with tool support."""

from __future__ import annotations

import json
from typing import Any, Callable

from vibe_widget.llm.agents.config import AgentRunConfig, resolve_agent_run_config
from vibe_widget.llm.agents.context import AgentHarnessContext
from vibe_widget.llm.providers.agent_provider_adapter import AgentProviderAdapter
from vibe_widget.llm.providers.base import LLMProvider
from vibe_widget.llm.tools.agents_tools import default_agent_tools
from vibe_widget.llm.tools.code_tools import CodeValidateTool
from vibe_widget.llm.tools.execution_tools import RuntimeTestTool, ErrorDiagnoseTool
from vibe_widget.utils.serialization import clean_for_json


class AgentSdkOrchestrator:
    """Orchestrator that runs a tool-capable agent loop."""

    def __init__(
        self,
        provider: LLMProvider,
        run_config: AgentRunConfig | None = None,
    ):
        self.provider = provider
        self.adapter = AgentProviderAdapter(provider)
        self.run_config = run_config or resolve_agent_run_config(preset="project", overrides=None)
        self.tool_registry = default_agent_tools()
        self.validate_tool = CodeValidateTool()
        self.runtime_tool = RuntimeTestTool()
        self.diagnose_tool = ErrorDiagnoseTool()

    def _emit(self, progress_callback: Callable[[str, str], None] | None, event_type: str, message: str) -> None:
        if progress_callback:
            progress_callback(event_type, message)

    def _serialize_tool_result(self, result: Any, max_bytes: int) -> str:
        payload = {
            "success": result.success,
            "output": clean_for_json(result.output),
            "error": result.error,
            "metadata": result.metadata,
        }
        text = json.dumps(payload, ensure_ascii=True)
        if len(text.encode("utf-8")) <= max_bytes:
            return text
        truncated = text.encode("utf-8")[:max_bytes].decode("utf-8", errors="ignore")
        return f"{truncated}\n...[truncated]"

    def _parse_tool_args(self, raw_args: str | None) -> dict[str, Any]:
        if not raw_args:
            return {}
        try:
            return json.loads(raw_args)
        except json.JSONDecodeError:
            return {}

    def _run_agent_loop(
        self,
        *,
        prompt: str,
        progress_callback: Callable[[str, str], None] | None,
        run_config: AgentRunConfig,
        context: AgentHarnessContext,
    ) -> str:
        tools = self.tool_registry.to_openai_tools()
        messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]
        tool_calls_count = 0

        for turn in range(run_config.budgets.max_turns):
            self._emit(progress_callback, "step", f"Agent step {turn + 1}/{run_config.budgets.max_turns}")
            response = self.adapter.chat_complete(
                messages=messages,
                tools=tools,
                tool_choice="auto",
                max_tokens=8192,
                temperature=0.7,
            )
            message = response.choices[0].message
            tool_calls = getattr(message, "tool_calls", None) or []

            assistant_message = {
                "role": message.role,
                "content": message.content or "",
            }
            if tool_calls:
                assistant_message["tool_calls"] = [
                    {
                        "id": call.id,
                        "type": call.type,
                        "function": {
                            "name": call.function.name,
                            "arguments": call.function.arguments,
                        },
                    }
                    for call in tool_calls
                ]
            messages.append(assistant_message)

            if not tool_calls:
                return self.provider.clean_code(message.content or "")

            for call in tool_calls:
                tool_calls_count += 1
                if tool_calls_count > run_config.budgets.max_tool_calls:
                    self._emit(progress_callback, "step", "Tool budget exceeded")
                    return ""
                tool = self.tool_registry.get(call.function.name)
                if tool is None:
                    tool_result = {
                        "success": False,
                        "output": {},
                        "error": f"tool_not_found: {call.function.name}",
                        "metadata": {},
                    }
                    content = json.dumps(tool_result, ensure_ascii=True)
                else:
                    args = self._parse_tool_args(call.function.arguments)
                    result = tool.execute(context=context, **args)
                    content = self._serialize_tool_result(result, run_config.budgets.max_tool_output_bytes)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.id,
                        "content": content,
                    }
                )

        return ""

    def _build_context(self, run_config: AgentRunConfig) -> AgentHarnessContext:
        return AgentHarnessContext(
            widget=None,
            state_manager=None,
            permission_tier=run_config.permission_tier,
            safety_mode=run_config.safety_mode,
            allowed_roots=run_config.allowed_roots,
            sandbox_dir=run_config.sandbox_dir,
            allow_net_fetch=run_config.allow_net_fetch,
            allow_search=run_config.allow_search,
            net_allowlist=run_config.net_allowlist,
            net_mime_allowlist=run_config.net_mime_allowlist,
        )

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
        agent_run_config: AgentRunConfig | None = None,
    ) -> tuple[str, None]:
        outputs = outputs or {}
        inputs = inputs or {}
        input_summaries = input_summaries or inputs or {}
        actions = actions or {}
        action_params = action_params or {}
        base_components = base_components or []

        run_config = agent_run_config or self.run_config
        context = self._build_context(run_config)

        self._emit(progress_callback, "step", "Analyzing data")
        data_info = LLMProvider.build_data_info(
            outputs=outputs,
            inputs=input_summaries,
            actions=actions,
            action_params=action_params,
            theme_description=theme_description,
        )

        if input_summaries:
            self._emit(progress_callback, "step", f"Inputs: {len(input_summaries)}")

        prompt = self.provider._build_prompt(
            description,
            data_info,
            base_code=base_code,
            base_components=base_components,
        )

        self._emit(progress_callback, "step", "Generating widget code...")
        code = self._run_agent_loop(
            prompt=prompt,
            progress_callback=progress_callback,
            run_config=run_config,
            context=context,
        )

        self._emit(progress_callback, "step", "Validating code")
        validation = self.validate_tool.execute(
            code=code,
            expected_exports=list(outputs.keys()),
            expected_imports=list(inputs.keys()),
        )

        self._emit(progress_callback, "step", "Testing runtime")
        runtime = self.runtime_tool.execute(code=code)

        issues = []
        if not validation.success:
            issues.extend(validation.output.get("issues", []))
        if not runtime.success:
            issues.extend(runtime.output.get("issues", []))

        if issues:
            self._emit(progress_callback, "step", f"Issues found: {issues[:2]}")
        self._emit(progress_callback, "complete", "Widget generation complete")
        return code, None

    def revise_code(
        self,
        *,
        code: str,
        revision_request: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str, str], None] | None = None,
        agent_run_config: AgentRunConfig | None = None,
    ) -> str:
        run_config = agent_run_config or self.run_config
        context = self._build_context(run_config)
        prompt = self.provider._build_revision_prompt(code, revision_request, data_info)
        self._emit(progress_callback, "step", "Revising widget code...")
        revised = self._run_agent_loop(
            prompt=prompt,
            progress_callback=progress_callback,
            run_config=run_config,
            context=context,
        )
        self._emit(progress_callback, "complete", "Revision complete")
        return revised

    def fix_runtime_error(
        self,
        *,
        code: str,
        error_message: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str, str], None] | None = None,
        agent_run_config: AgentRunConfig | None = None,
    ) -> str:
        run_config = agent_run_config or self.run_config
        context = self._build_context(run_config)
        prompt = self.provider._build_fix_prompt(code, error_message, data_info)
        self._emit(progress_callback, "step", "Repairing code...")
        fixed = self._run_agent_loop(
            prompt=prompt,
            progress_callback=progress_callback,
            run_config=run_config,
            context=context,
        )
        return fixed
