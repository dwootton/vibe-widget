"""Context object passed to agent tools."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class AgentHarnessContext:
    """Runtime context for agent tool execution."""

    widget: Any | None = None
    state_manager: Any | None = None
    permission_tier: int = 0
    safety_mode: str = "sandboxed"
    allowed_roots: list[Path] = field(default_factory=list)
    sandbox_dir: Path = Path(".vibewidget") / "sandbox"
    allow_net_fetch: bool = False
    allow_search: bool = False
    net_allowlist: list[str] = field(default_factory=list)
    net_mime_allowlist: list[str] = field(default_factory=list)
    data_registry: dict[str, Any] = field(default_factory=dict)
    artifacts: dict[str, Any] = field(default_factory=dict)
    cancelled: bool = False
