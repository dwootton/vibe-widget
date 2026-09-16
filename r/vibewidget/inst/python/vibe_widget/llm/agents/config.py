"""Agent run configuration and presets."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal


SafetyMode = Literal["sandboxed", "workspace", "open_trusted", "open_trusted_net"]


@dataclass
class AgentBudgets:
    """Budgets for agent runs."""

    max_turns: int = 4
    max_tool_calls: int = 6
    max_tool_output_bytes: int = 20_000


@dataclass
class AgentRunConfig:
    """Resolved agent run config."""

    safety_mode: SafetyMode = "workspace"
    permission_tier: int = 1
    allowed_roots: list[Path] = field(default_factory=list)
    sandbox_dir: Path = field(default_factory=lambda: Path(".vibewidget") / "sandbox")
    budgets: AgentBudgets = field(default_factory=AgentBudgets)
    allow_net_fetch: bool = False
    allow_search: bool = False
    net_allowlist: list[str] = field(default_factory=list)
    net_mime_allowlist: list[str] = field(
        default_factory=lambda: ["text/plain", "text/csv", "application/json"]
    )

    def with_overrides(self, overrides: dict[str, Any] | None) -> "AgentRunConfig":
        """Apply overrides from a dict."""
        if not overrides:
            return self
        data = dict(overrides)
        budgets = data.pop("budgets", None)
        for key, value in data.items():
            if hasattr(self, key):
                setattr(self, key, value)
        if isinstance(budgets, dict):
            for key, value in budgets.items():
                if hasattr(self.budgets, key):
                    setattr(self.budgets, key, value)
        return self


def _default_sandbox_dir() -> Path:
    return Path(".vibewidget") / "sandbox"


def preset_config(name: str) -> AgentRunConfig:
    """Return a baseline config for a preset name."""
    preset = (name or "project").lower()
    sandbox_dir = _default_sandbox_dir()
    cwd = Path.cwd()
    if preset == "safe":
        return AgentRunConfig(
            safety_mode="sandboxed",
            permission_tier=0,
            allowed_roots=[sandbox_dir],
            sandbox_dir=sandbox_dir,
            allow_net_fetch=False,
            allow_search=False,
            budgets=AgentBudgets(max_turns=3, max_tool_calls=4, max_tool_output_bytes=10_000),
        )
    if preset == "connected":
        return AgentRunConfig(
            safety_mode="open_trusted_net",
            permission_tier=2,
            allowed_roots=[cwd, sandbox_dir],
            sandbox_dir=sandbox_dir,
            allow_net_fetch=True,
            allow_search=False,
            budgets=AgentBudgets(max_turns=5, max_tool_calls=10, max_tool_output_bytes=40_000),
        )
    return AgentRunConfig(
        safety_mode="workspace",
        permission_tier=1,
        allowed_roots=[cwd, sandbox_dir],
        sandbox_dir=sandbox_dir,
        allow_net_fetch=False,
        allow_search=False,
        budgets=AgentBudgets(max_turns=4, max_tool_calls=6, max_tool_output_bytes=20_000),
    )


def resolve_agent_run_config(
    *,
    preset: str | None,
    overrides: dict[str, Any] | None,
) -> AgentRunConfig:
    """Resolve a full AgentRunConfig from preset + overrides."""
    config = preset_config(preset or "project")
    config.with_overrides(overrides)
    config.allowed_roots = [Path(p).resolve() for p in config.allowed_roots]
    config.sandbox_dir = Path(config.sandbox_dir).resolve()
    return config
