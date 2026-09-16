"""Agent tool implementations with permission gating."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, TYPE_CHECKING
import re
from urllib.parse import urlparse
import base64
import mimetypes

import requests

from vibe_widget.llm.agents.context import AgentHarnessContext
from vibe_widget.llm.tools.base import Tool, ToolResult
from vibe_widget.llm.tools.data_tools import DataLoadTool, DataProfileTool
from vibe_widget.utils.serialization import clean_for_json
from vibe_widget.utils.util import summarize_for_prompt

if TYPE_CHECKING:
    import pandas as pd


def _get_pandas():
    """Lazy import pandas."""
    import pandas as pd
    return pd


def _is_dataframe(obj: Any) -> bool:
    """Check if obj is a pandas DataFrame without importing pandas."""
    return type(obj).__module__.startswith("pandas") and type(obj).__name__ == "DataFrame"


DEFAULT_MAX_READ_BYTES = 2_000_000
DEFAULT_MAX_WRITE_BYTES = 2_000_000


@dataclass
class ToolErrorDetail:
    """Structured tool error information."""

    error: str
    required_tier: int | None = None
    current_tier: int | None = None
    path: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload = {"error": self.error}
        if self.required_tier is not None:
            payload["required_tier"] = self.required_tier
        if self.current_tier is not None:
            payload["current_tier"] = self.current_tier
        if self.path is not None:
            payload["path"] = self.path
        return payload


def _permission_error(
    context: AgentHarnessContext,
    *,
    required_tier: int,
    path: str | None = None,
) -> ToolResult:
    detail = ToolErrorDetail(
        error="permission_denied",
        required_tier=required_tier,
        current_tier=context.permission_tier,
        path=path,
    )
    return ToolResult(success=False, output={}, error="permission_denied", metadata=detail.to_dict())


def _check_cancelled(context: AgentHarnessContext) -> ToolResult | None:
    if context.cancelled:
        return ToolResult(success=False, output={}, error="cancelled")
    return None


def _expand_brace_pattern(pattern: str) -> list[str]:
    """Expand brace patterns like {jpg,png} into multiple patterns.

    Python's glob doesn't support brace expansion, so we expand them manually.
    Example: "**/*.{jpg,png}" -> ["**/*.jpg", "**/*.png"]
    """
    # Find brace groups like {a,b,c}
    brace_match = re.search(r'\{([^{}]+)\}', pattern)
    if not brace_match:
        return [pattern]

    prefix = pattern[:brace_match.start()]
    suffix = pattern[brace_match.end():]
    alternatives = brace_match.group(1).split(',')

    # Recursively expand in case there are multiple brace groups
    expanded = []
    for alt in alternatives:
        expanded.extend(_expand_brace_pattern(prefix + alt.strip() + suffix))
    return expanded


def _resolve_path(context: AgentHarnessContext, path: str) -> Path | None:
    candidate = Path(path).expanduser()
    if not candidate.is_absolute():
        candidate = context.sandbox_dir / candidate
    resolved = candidate.resolve()
    for root in context.allowed_roots:
        root_path = Path(root).resolve()
        if resolved == root_path or root_path in resolved.parents:
            return resolved
    return None


def _truncate_text(text: str, max_bytes: int) -> str:
    encoded = text.encode("utf-8")
    if len(encoded) <= max_bytes:
        return text
    truncated = encoded[:max_bytes].decode("utf-8", errors="ignore")
    return f"{truncated}\n...[truncated]"


class AgentToolRegistry:
    """Registry for agent tool definitions."""

    def __init__(self, tools: list[Tool]):
        self._tools = {tool.name: tool for tool in tools}

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def list(self) -> list[Tool]:
        return list(self._tools.values())

    def list_for_tier(self, tier: int) -> list[Tool]:
        """Return tools available at the given permission tier."""
        return [tool for tool in self._tools.values() if tool.required_tier <= tier]

    def to_openai_tools(self, tier: int | None = None) -> list[dict[str, Any]]:
        """Convert tools to OpenAI format, optionally filtered by tier."""
        tools = self.list_for_tier(tier) if tier is not None else self.list()
        return [tool.to_openai_tool() for tool in tools]


class DataProfileAgentTool(Tool):
    """Profile data using the existing data profile tool."""

    def __init__(self):
        super().__init__(
            name="data.profile",
            description="Profile a dataframe or JSON-like table and return stats and schema.",
        )
        self._tool = DataProfileTool()

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "data_key": {
                "type": "string",
                "description": "Key in the data registry (optional).",
                "required": False,
            },
            "data": {
                "type": "object",
                "description": "Inline data to profile (list of records or dict).",
                "required": False,
            },
        }

    def execute(self, context: AgentHarnessContext, data_key: str | None = None, data: Any = None) -> ToolResult:
        if cancelled := _check_cancelled(context):
            return cancelled
        if context.permission_tier < 0:
            return _permission_error(context, required_tier=0)

        target = None
        if data_key:
            target = context.data_registry.get(data_key)
        elif data is not None:
            target = data

        if target is None:
            return ToolResult(success=False, output={}, error="no_data")

        try:
            if _is_dataframe(target):
                df = target
            else:
                df = _get_pandas().DataFrame(target)
            return self._tool.execute(dataframe=df)
        except Exception as exc:  # noqa: BLE001
            return ToolResult(success=False, output={}, error=str(exc))


class DataLoadAgentTool(Tool):
    """Load data with path gating."""

    def __init__(self):
        super().__init__(
            name="data.load",
            required_tier=1,
            description="Load data from an allowed file path or URL into the data registry.",
        )
        self._tool = DataLoadTool()

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "source": {
                "type": "string",
                "description": "File path or URL to load.",
                "required": True,
            },
            "registry_key": {
                "type": "string",
                "description": "Optional registry key to store the dataframe.",
                "required": False,
            },
            "sample_size": {
                "type": "integer",
                "description": "Ignored (sampling disabled).",
                "required": False,
            },
        }

    def execute(
        self,
        context: AgentHarnessContext,
        source: str,
        registry_key: str | None = None,
        sample_size: int = -1,
    ) -> ToolResult:
        if cancelled := _check_cancelled(context):
            return cancelled
        if context.permission_tier < 1:
            return _permission_error(context, required_tier=1, path=source)

        if source.startswith(("http://", "https://")):
            if not context.allow_net_fetch:
                return ToolResult(success=False, output={}, error="network_disabled")
        else:
            resolved = _resolve_path(context, source)
            if resolved is None:
                return ToolResult(success=False, output={}, error="path_not_allowed")
            source = str(resolved)

        result = self._tool.execute(source=source, sample_size=sample_size)
        if not result.success:
            return result

        df = result.output.get("dataframe")
        if registry_key and df is not None:
            context.data_registry[registry_key] = df
        return result


class StateGetTool(Tool):
    """Get a value from agent state."""

    def __init__(self):
        super().__init__(name="state.get", description="Get a value from agent state.")

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "name": {"type": "string", "description": "Key to retrieve.", "required": True},
        }

    def execute(self, context: AgentHarnessContext, name: str) -> ToolResult:
        if cancelled := _check_cancelled(context):
            return cancelled
        value = context.artifacts.get(name)
        return ToolResult(success=True, output=clean_for_json(value))


class StatePutTool(Tool):
    """Set a value in agent state."""

    def __init__(self):
        super().__init__(name="state.put", description="Store a value in agent state.")

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "name": {"type": "string", "description": "Key to store.", "required": True},
            "value": {"type": "object", "description": "Value to store.", "required": True},
        }

    def execute(self, context: AgentHarnessContext, name: str, value: Any) -> ToolResult:
        if cancelled := _check_cancelled(context):
            return cancelled
        context.artifacts[name] = value
        return ToolResult(success=True, output={"stored": name})


class WidgetSetInputTool(Tool):
    """Set a widget input trait."""

    def __init__(self):
        super().__init__(name="widget.set_input", description="Set a widget input trait value.", required_tier=1)

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "name": {"type": "string", "description": "Input trait name.", "required": True},
            "value": {"type": "object", "description": "Value to set.", "required": True},
        }

    def execute(self, context: AgentHarnessContext, name: str, value: Any) -> ToolResult:
        if cancelled := _check_cancelled(context):
            return cancelled
        if context.permission_tier < 1:
            return _permission_error(context, required_tier=1)
        widget = context.widget
        if widget is None or not hasattr(widget, name):
            return ToolResult(success=False, output={}, error="input_not_found")
        setattr(widget, name, clean_for_json(value))
        if hasattr(widget, "save_changes"):
            widget.save_changes()
        return ToolResult(success=True, output={"input": name})


class WidgetSetOutputTool(Tool):
    """Set a widget output trait."""

    def __init__(self):
        super().__init__(name="widget.set_output", description="Set a widget output trait value.", required_tier=1)

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "name": {"type": "string", "description": "Output trait name.", "required": True},
            "value": {"type": "object", "description": "Value to set.", "required": True},
        }

    def execute(self, context: AgentHarnessContext, name: str, value: Any) -> ToolResult:
        if cancelled := _check_cancelled(context):
            return cancelled
        if context.permission_tier < 1:
            return _permission_error(context, required_tier=1)
        widget = context.widget
        if widget is None or not hasattr(widget, name):
            return ToolResult(success=False, output={}, error="output_not_found")
        setattr(widget, name, clean_for_json(value))
        if hasattr(widget, "save_changes"):
            widget.save_changes()
        return ToolResult(success=True, output={"output": name})


class DescribeTool(Tool):
    """Describe a python object."""

    def __init__(self):
        super().__init__(
            name="pls.describe",
            description="Summarize a Python object with size caps.",
        )

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "data_key": {
                "type": "string",
                "description": "Key in the data registry (optional).",
                "required": False,
            },
            "data": {
                "type": "object",
                "description": "Inline data to describe.",
                "required": False,
            },
        }

    def execute(self, context: AgentHarnessContext, data_key: str | None = None, data: Any = None) -> ToolResult:
        if cancelled := _check_cancelled(context):
            return cancelled
        target = context.data_registry.get(data_key) if data_key else data
        if target is None:
            return ToolResult(success=False, output={}, error="no_data")
        summary = summarize_for_prompt(target)
        return ToolResult(success=True, output=_truncate_text(summary, 8_000))


class FsListTool(Tool):
    """List directory contents."""

    def __init__(self):
        super().__init__(name="fs.list", description="List directory contents.")

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "path": {"type": "string", "description": "Directory path.", "required": True},
        }

    def execute(self, context: AgentHarnessContext, path: str) -> ToolResult:
        if cancelled := _check_cancelled(context):
            return cancelled
        if context.permission_tier < 0:
            return _permission_error(context, required_tier=0, path=path)
        resolved = _resolve_path(context, path)
        if resolved is None:
            return ToolResult(success=False, output={}, error="path_not_allowed")
        if not resolved.exists() or not resolved.is_dir():
            return ToolResult(success=False, output={}, error="not_a_directory")
        entries = sorted([p.name for p in resolved.iterdir()])
        return ToolResult(success=True, output=entries)


class FsReadTool(Tool):
    """Read a text file."""

    def __init__(self):
        super().__init__(name="fs.read", description="Read a text file.")

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "path": {"type": "string", "description": "File path.", "required": True},
            "max_bytes": {"type": "integer", "description": "Read limit in bytes.", "required": False},
        }

    def execute(self, context: AgentHarnessContext, path: str, max_bytes: int | None = None) -> ToolResult:
        if cancelled := _check_cancelled(context):
            return cancelled
        if context.permission_tier < 0:
            return _permission_error(context, required_tier=0, path=path)
        resolved = _resolve_path(context, path)
        if resolved is None:
            return ToolResult(success=False, output={}, error="path_not_allowed")
        if not resolved.exists() or not resolved.is_file():
            return ToolResult(success=False, output={}, error="not_a_file")
        max_bytes = max_bytes or DEFAULT_MAX_READ_BYTES
        text = resolved.read_text(encoding="utf-8", errors="ignore")
        return ToolResult(success=True, output=_truncate_text(text, max_bytes))


class FsReadBase64Tool(Tool):
    """Read a file and return a base64 data URL."""

    def __init__(self):
        super().__init__(name="fs.read_base64", description="Read a file and return a base64 data URL.", required_tier=1)

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "path": {"type": "string", "description": "File path.", "required": True},
            "max_bytes": {"type": "integer", "description": "Max bytes to read.", "required": False},
        }

    def execute(self, context: AgentHarnessContext, path: str, max_bytes: int | None = None) -> ToolResult:
        if cancelled := _check_cancelled(context):
            return cancelled
        if context.permission_tier < 1:
            return _permission_error(context, required_tier=1, path=path)
        resolved = _resolve_path(context, path)
        if resolved is None:
            return ToolResult(success=False, output={}, error="path_not_allowed")
        if not resolved.exists() or not resolved.is_file():
            return ToolResult(success=False, output={}, error="not_a_file")
        max_bytes = max_bytes or DEFAULT_MAX_READ_BYTES
        data = resolved.read_bytes()
        if len(data) > max_bytes:
            data = data[:max_bytes]
        mime_type, _ = mimetypes.guess_type(str(resolved))
        if not mime_type:
            mime_type = "application/octet-stream"
        encoded = base64.b64encode(data).decode("ascii")
        data_url = f"data:{mime_type};base64,{encoded}"
        return ToolResult(
            success=True,
            output={"path": str(resolved), "data_url": data_url, "bytes": len(data)},
        )


class FsWriteTool(Tool):
    """Write a text file."""

    def __init__(self):
        super().__init__(name="fs.write", description="Write a text file.", required_tier=1)

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "path": {"type": "string", "description": "File path.", "required": True},
            "content": {"type": "string", "description": "Content to write.", "required": True},
            "overwrite": {
                "type": "boolean",
                "description": "Set true to overwrite existing file.",
                "required": False,
            },
        }

    def execute(
        self, context: AgentHarnessContext, path: str, content: str, overwrite: bool | None = False
    ) -> ToolResult:
        if cancelled := _check_cancelled(context):
            return cancelled
        if context.permission_tier < 1:
            return _permission_error(context, required_tier=1, path=path)
        resolved = _resolve_path(context, path)
        if resolved is None:
            return ToolResult(success=False, output={}, error="path_not_allowed")
        if resolved.exists() and not overwrite:
            return ToolResult(success=False, output={}, error="overwrite_required")
        resolved.parent.mkdir(parents=True, exist_ok=True)
        truncated = _truncate_text(content, DEFAULT_MAX_WRITE_BYTES)
        resolved.write_text(truncated, encoding="utf-8")
        return ToolResult(success=True, output={"path": str(resolved)})


class FsMkdirTool(Tool):
    """Create a directory."""

    def __init__(self):
        super().__init__(name="fs.mkdir", description="Create a directory.", required_tier=1)

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "path": {"type": "string", "description": "Directory path.", "required": True},
        }

    def execute(self, context: AgentHarnessContext, path: str) -> ToolResult:
        if cancelled := _check_cancelled(context):
            return cancelled
        if context.permission_tier < 1:
            return _permission_error(context, required_tier=1, path=path)
        resolved = _resolve_path(context, path)
        if resolved is None:
            return ToolResult(success=False, output={}, error="path_not_allowed")
        resolved.mkdir(parents=True, exist_ok=True)
        return ToolResult(success=True, output={"path": str(resolved)})


class FsExistsTool(Tool):
    """Check if a path exists."""

    def __init__(self):
        super().__init__(name="fs.exists", description="Check if a path exists.")

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {"path": {"type": "string", "description": "Path to check.", "required": True}}

    def execute(self, context: AgentHarnessContext, path: str) -> ToolResult:
        if cancelled := _check_cancelled(context):
            return cancelled
        resolved = _resolve_path(context, path)
        if resolved is None:
            return ToolResult(success=False, output={}, error="path_not_allowed")
        return ToolResult(success=True, output={"exists": resolved.exists()})


class FsGlobTool(Tool):
    """Glob files under a directory."""

    def __init__(self):
        super().__init__(name="fs.glob", description="Glob files under a directory.")

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "path": {"type": "string", "description": "Root path.", "required": True},
            "pattern": {"type": "string", "description": "Glob pattern.", "required": True},
        }

    def execute(self, context: AgentHarnessContext, path: str, pattern: str) -> ToolResult:
        if cancelled := _check_cancelled(context):
            return cancelled
        resolved = _resolve_path(context, path)
        if resolved is None:
            return ToolResult(success=False, output={}, error="path_not_allowed")
        # Expand brace patterns like {jpg,png} since Python glob doesn't support them
        patterns = _expand_brace_pattern(pattern)
        all_matches: set[str] = set()
        for p in patterns:
            all_matches.update(str(m) for m in resolved.glob(p))
        matches = sorted(all_matches)
        return ToolResult(success=True, output=matches)


class NetFetchTool(Tool):
    """Fetch a URL with allowlists and caps."""

    def __init__(self):
        super().__init__(name="net.fetch", description="Fetch a URL with allowlist and MIME caps.", required_tier=2)

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "url": {"type": "string", "description": "HTTPS URL to fetch.", "required": True},
            "max_bytes": {"type": "integer", "description": "Max bytes to read.", "required": False},
            "timeout": {"type": "integer", "description": "Timeout in seconds.", "required": False},
            "mime_allowlist": {"type": "array", "items": {"type": "string"}, "required": False},
        }

    def execute(
        self,
        context: AgentHarnessContext,
        url: str,
        max_bytes: int | None = None,
        timeout: int | None = None,
        mime_allowlist: list[str] | None = None,
    ) -> ToolResult:
        if cancelled := _check_cancelled(context):
            return cancelled
        if context.permission_tier < 2:
            return _permission_error(context, required_tier=2, path=url)
        if not context.allow_net_fetch:
            return ToolResult(success=False, output={}, error="network_disabled")

        parsed = urlparse(url)
        if parsed.scheme != "https":
            return ToolResult(success=False, output={}, error="https_required")
        if context.net_allowlist and parsed.hostname not in context.net_allowlist:
            return ToolResult(success=False, output={}, error="host_not_allowed")

        max_bytes = max_bytes or DEFAULT_MAX_READ_BYTES
        timeout = timeout or 8
        allowlist = mime_allowlist or context.net_mime_allowlist

        try:
            resp = requests.get(url, timeout=timeout, stream=True)
            resp.raise_for_status()
            content_type = resp.headers.get("Content-Type", "").split(";")[0].strip()
            if allowlist and content_type not in allowlist:
                return ToolResult(success=False, output={}, error="mime_not_allowed")
            data = resp.content[:max_bytes]
            preview = data.decode("utf-8", errors="ignore")
            preview = _truncate_text(preview, 4096)
            sandbox_dir = context.sandbox_dir / "downloads"
            sandbox_dir.mkdir(parents=True, exist_ok=True)
            safe_name = re.sub(r"[^a-zA-Z0-9_.-]+", "_", Path(parsed.path).name or "download")
            out_path = sandbox_dir / safe_name
            out_path.write_bytes(data)
            return ToolResult(
                success=True,
                output={
                    "path": str(out_path),
                    "content_type": content_type,
                    "preview": preview,
                    "status": resp.status_code,
                },
            )
        except Exception as exc:  # noqa: BLE001
            return ToolResult(success=False, output={}, error=str(exc))


class PythonWriteModuleTool(Tool):
    """Write a python module into the sandbox."""

    def __init__(self):
        super().__init__(name="python.write_module", description="Write a python module in the sandbox.", required_tier=2)

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "name": {"type": "string", "description": "Module name.", "required": True},
            "code": {"type": "string", "description": "Python source code.", "required": True},
        }

    def execute(self, context: AgentHarnessContext, name: str, code: str) -> ToolResult:
        if cancelled := _check_cancelled(context):
            return cancelled
        if context.permission_tier < 2:
            return _permission_error(context, required_tier=2, path=name)
        safe_name = re.sub(r"[^a-zA-Z0-9_]", "_", name)
        module_dir = context.sandbox_dir / "modules"
        module_dir.mkdir(parents=True, exist_ok=True)
        module_path = module_dir / f"{safe_name}.py"
        module_path.write_text(code, encoding="utf-8")
        return ToolResult(success=True, output={"path": str(module_path)})


def _ast_guard(code: str) -> str | None:
    import ast

    deny_imports = {"subprocess", "os", "sys", "shutil", "socket", "http", "urllib", "requests"}
    deny_calls = {"system", "popen", "remove", "rmdir", "rmtree"}

    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return f"syntax_error: {exc}"

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            for alias in node.names:
                if alias.name.split(".")[0] in deny_imports:
                    return f"import_not_allowed: {alias.name}"
        if isinstance(node, ast.Call):
            func = node.func
            if isinstance(func, ast.Attribute) and func.attr in deny_calls:
                return f"call_not_allowed: {func.attr}"
            if isinstance(func, ast.Name) and func.id in deny_calls:
                return f"call_not_allowed: {func.id}"
    return None


class PythonRunModuleTool(Tool):
    """Execute a sandboxed python module run(context)."""

    def __init__(self):
        super().__init__(name="python.run_module", description="Run a sandboxed python module.", required_tier=2)

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "name": {"type": "string", "description": "Module name.", "required": True},
            "entrypoint": {
                "type": "string",
                "description": "Entrypoint function name.",
                "required": False,
            },
        }

    def execute(self, context: AgentHarnessContext, name: str, entrypoint: str | None = "run") -> ToolResult:
        if cancelled := _check_cancelled(context):
            return cancelled
        if context.permission_tier < 2:
            return _permission_error(context, required_tier=2, path=name)
        safe_name = re.sub(r"[^a-zA-Z0-9_]", "_", name)
        module_path = context.sandbox_dir / "modules" / f"{safe_name}.py"
        if not module_path.exists():
            return ToolResult(success=False, output={}, error="module_not_found")
        code = module_path.read_text(encoding="utf-8")
        guard_error = _ast_guard(code)
        if guard_error:
            return ToolResult(success=False, output={}, error=guard_error)

        try:
            import importlib.util

            spec = importlib.util.spec_from_file_location(safe_name, module_path)
            if spec is None or spec.loader is None:
                return ToolResult(success=False, output={}, error="module_load_failed")
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            runner = getattr(module, entrypoint or "run", None)
            if runner is None:
                return ToolResult(success=False, output={}, error="entrypoint_not_found")
            result = runner(context)
            return ToolResult(success=True, output=clean_for_json(result))
        except Exception as exc:  # noqa: BLE001
            return ToolResult(success=False, output={}, error=str(exc))


def default_agent_tools() -> AgentToolRegistry:
    """Build the default tool registry."""
    return AgentToolRegistry(
        [
            DataProfileAgentTool(),
            DataLoadAgentTool(),
            StateGetTool(),
            StatePutTool(),
            WidgetSetInputTool(),
            WidgetSetOutputTool(),
            DescribeTool(),
            FsListTool(),
            FsReadTool(),
            FsReadBase64Tool(),
            FsWriteTool(),
            FsMkdirTool(),
            FsExistsTool(),
            FsGlobTool(),
            NetFetchTool(),
            PythonWriteModuleTool(),
            PythonRunModuleTool(),
        ]
    )
