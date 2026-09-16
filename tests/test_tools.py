"""Permission gating and registry contents for the agent tool set."""

from __future__ import annotations

from pathlib import Path

import pytest

from vibe_widget.llm.agents.config import preset_config
from vibe_widget.llm.agents.context import AgentHarnessContext
from vibe_widget.llm.tools.agents_tools import default_agent_tools

REMOVED_TOOLS = (
    "widget.set_input",
    "widget.set_output",
    "python.write_module",
    "python.run_module",
    "cli_execute",
    "code_repair",
)


def _context(tmp_path: Path, **overrides: object) -> AgentHarnessContext:
    defaults = {
        "permission_tier": 2,
        "allowed_roots": [tmp_path / "allowed"],
        "sandbox_dir": tmp_path / "sandbox",
    }
    defaults.update(overrides)
    return AgentHarnessContext(**defaults)  # type: ignore[arg-type]


def test_removed_tools_are_absent_from_registry() -> None:
    names = {tool.name for tool in default_agent_tools().list()}
    assert names.isdisjoint(REMOVED_TOOLS)


def test_safe_preset_exposes_tier_zero_only() -> None:
    preset = preset_config("safe")
    assert preset.permission_tier == 0
    assert preset.allow_net_fetch is False
    tools = default_agent_tools().list_for_tier(preset.permission_tier)
    assert tools
    assert all(tool.required_tier == 0 for tool in tools)


def test_fs_read_denies_paths_outside_allowed_roots(tmp_path: Path) -> None:
    outside = tmp_path / "outside.txt"
    outside.write_text("secret", encoding="utf-8")
    (tmp_path / "allowed").mkdir()

    result = default_agent_tools().get("fs.read").execute(_context(tmp_path), path=str(outside))

    assert result.success is False
    assert result.error == "path_not_allowed"


def test_fs_read_allows_paths_inside_allowed_roots(tmp_path: Path) -> None:
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    target = allowed / "notes.txt"
    target.write_text("hello", encoding="utf-8")

    result = default_agent_tools().get("fs.read").execute(_context(tmp_path), path=str(target))

    assert result.success is True
    assert result.output == "hello"


def test_net_fetch_denied_when_allow_net_fetch_is_false(tmp_path: Path) -> None:
    context = _context(tmp_path, allow_net_fetch=False)

    result = default_agent_tools().get("net.fetch").execute(
        context, url="https://example.com/data.csv"
    )

    assert result.success is False
    assert result.error == "network_disabled"


@pytest.mark.parametrize("preset", ["safe", "project"])
def test_net_fetch_is_out_of_reach_for_non_connected_presets(preset: str) -> None:
    config = preset_config(preset)
    names = {tool.name for tool in default_agent_tools().list_for_tier(config.permission_tier)}
    assert "net.fetch" not in names


def test_tool_wire_names_have_no_dots_and_resolve():
    registry = default_agent_tools()
    for tool in registry.list():
        wire = tool.to_openai_tool()["function"]["name"]
        assert "." not in wire
        assert registry.get(wire) is tool


def test_clean_code_drops_leading_prose():
    from vibe_widget.llm.providers.base import LLMProvider
    text = "Here is the fixed file.\n\nimport * as d3 from 'x';\nexport default function W() {}"
    assert LLMProvider.clean_code(LLMProvider, text).startswith("import * as d3")
