"""Agent SDK-style orchestrator with tool support."""

from __future__ import annotations

import json
from typing import Any, Callable

from vibe_widget.llm.agents.config import AgentRunConfig, resolve_agent_run_config

DEFAULT_MAX_TOKENS = 16384


class MaxTokensExceeded(Exception):
    """Raised when LLM response was truncated due to hitting max_tokens limit."""

    def __init__(self, message: str, max_tokens_used: int):
        super().__init__(message)
        self.max_tokens_used = max_tokens_used
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
        stream: bool = True,
    ):
        self.provider = provider
        self.adapter = AgentProviderAdapter(provider)
        self.run_config = run_config or resolve_agent_run_config(preset="project", overrides=None)
        self.tool_registry = default_agent_tools()
        self.validate_tool = CodeValidateTool()
        self.runtime_tool = RuntimeTestTool()
        self.diagnose_tool = ErrorDiagnoseTool()
        self.stream = bool(stream)

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
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ) -> str:
        # Filter tools by permission tier so LLM only sees tools it can use
        tools = self.tool_registry.to_openai_tools(tier=run_config.permission_tier)
        messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]
        tool_calls_count = 0

        self._emit(progress_callback, "step", "Agent call to generate code")
        for turn in range(run_config.budgets.max_turns):
            if turn > 0:
                self._emit(progress_callback, "step", "Agent continuation")
            streamed = False
            finish_reason: str | None = None
            if self.stream:
                try:
                    stream = self.adapter.chat_complete_stream(
                        messages=messages,
                        tools=tools,
                        tool_choice="auto",
                        max_tokens=max_tokens,
                        temperature=0.7,
                    )
                    message = self._consume_stream(stream, progress_callback)
                    finish_reason = getattr(message, "finish_reason", None)
                    streamed = True
                except Exception:
                    message = None
            if message is None:
                response = self.adapter.chat_complete(
                    messages=messages,
                    tools=tools,
                    tool_choice="auto",
                    max_tokens=max_tokens,
                    temperature=0.7,
                )
                message = response.choices[0].message
                finish_reason = response.choices[0].finish_reason

            raw_tool_calls = getattr(message, "tool_calls", None) or []
            tool_calls = []
            for call in raw_tool_calls:
                if isinstance(call, dict):
                    tool_calls.append(call)
                    continue
                func = getattr(call, "function", None)
                tool_calls.append(
                    {
                        "id": getattr(call, "id", None),
                        "type": getattr(call, "type", "function"),
                        "function": {
                            "name": getattr(func, "name", ""),
                            "arguments": getattr(func, "arguments", ""),
                        },
                    }
                )
            if message.content and not streamed:
                content = (message.content or "").strip()
                if content:
                    self._emit(progress_callback, "agent_message", content)

            assistant_message = {
                "role": message.role,
                "content": message.content or "",
            }
            if tool_calls:
                assistant_message["tool_calls"] = tool_calls
            messages.append(assistant_message)

            if not tool_calls:
                # Check if response was truncated due to max_tokens
                if finish_reason == "length":
                    raise MaxTokensExceeded(
                        f"Response truncated at {max_tokens} tokens",
                        max_tokens_used=max_tokens,
                    )
                return self.provider.clean_code(message.content or "")

            for call in tool_calls:
                tool_calls_count += 1
                if tool_calls_count > run_config.budgets.max_tool_calls:
                    self._emit(progress_callback, "step", "Tool budget exceeded")
                    return ""
                func = call.get("function", {})
                tool = self.tool_registry.get(func.get("name", ""))
                args = self._parse_tool_args(func.get("arguments", ""))
                arg_summary = ", ".join(sorted(args.keys()))
                if arg_summary:
                    self._emit(
                        progress_callback,
                        "tool_call",
                        f"Tool call: {func.get('name', '')} ({arg_summary})",
                    )
                else:
                    self._emit(progress_callback, "tool_call", f"Tool call: {func.get('name', '')}")
                if tool is None:
                    tool_result = {
                        "success": False,
                        "output": {},
                        "error": f"tool_not_found: {func.get('name', '')}",
                        "metadata": {},
                    }
                    content = json.dumps(tool_result, ensure_ascii=True)
                    self._emit(
                        progress_callback,
                        "tool_result",
                        f"Tool result: {func.get('name', '')} failed (tool_not_found)",
                    )
                else:
                    result = tool.execute(context=context, **args)
                    content = self._serialize_tool_result(result, run_config.budgets.max_tool_output_bytes)
                    status = "ok" if result.success else "error"
                    message = f"Tool result: {func.get('name', '')} {status}"
                    if not result.success and result.error:
                        message = f"{message} ({result.error})"
                    self._emit(progress_callback, "tool_result", message)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.get("id"),
                        "content": content,
                    }
                )

        return ""

    def _consume_stream(self, stream, progress_callback: Callable[[str, str], None] | None):
        content_chunks: list[str] = []
        tool_calls: dict[int, dict[str, Any]] = {}
        role = "assistant"
        finish_reason: str | None = None

        for chunk in stream:
            if not chunk or not chunk.choices:
                continue
            choice = chunk.choices[0]
            if getattr(choice, "finish_reason", None):
                finish_reason = choice.finish_reason
            delta = getattr(choice, "delta", None)
            if delta is None:
                continue
            if getattr(delta, "role", None):
                role = delta.role
            if getattr(delta, "content", None):
                text = delta.content
                if text:
                    content_chunks.append(text)
                    self._emit(progress_callback, "chunk", text)
            for call in getattr(delta, "tool_calls", None) or []:
                index = getattr(call, "index", None)
                if index is None:
                    index = len(tool_calls)
                entry = tool_calls.get(index)
                if entry is None:
                    entry = {
                        "id": getattr(call, "id", None),
                        "type": getattr(call, "type", "function"),
                        "function": {"name": "", "arguments": ""},
                    }
                    tool_calls[index] = entry
                if getattr(call, "id", None):
                    entry["id"] = call.id
                if getattr(call, "type", None):
                    entry["type"] = call.type
                func = getattr(call, "function", None)
                if func is not None:
                    if getattr(func, "name", None):
                        entry["function"]["name"] = func.name
                    if getattr(func, "arguments", None):
                        entry["function"]["arguments"] += func.arguments

        tool_call_list = [tool_calls[idx] for idx in sorted(tool_calls.keys())]

        class _Message:
            def __init__(self, role_value: str, content_value: str, calls: list[dict[str, Any]], finish: str | None):
                self.role = role_value
                self.content = content_value
                self.tool_calls = calls
                self.finish_reason = finish

        return _Message(role, "".join(content_chunks), tool_call_list, finish_reason)

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
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ) -> str:
        run_config = agent_run_config or self.run_config
        context = self._build_context(run_config)
        prompt = self.provider._build_fix_prompt(code, error_message, data_info)
        self._emit(progress_callback, "step", "Repairing code...")
        fixed = self._run_agent_loop(
            prompt=prompt,
            progress_callback=progress_callback,
            run_config=run_config,
            max_tokens=max_tokens,
            context=context,
        )
        return fixed
