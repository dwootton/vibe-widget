"""Base classes for agentic tool system."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolResult:
    """Result from a tool execution."""

    success: bool
    output: Any
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def __str__(self) -> str:
        if self.success:
            return str(self.output)
        return f"Error: {self.error}"


class Tool(ABC):
    """Base class for all tools in the agentic system."""

    def __init__(self, name: str, description: str, required_tier: int = 0):
        self.name = name
        self.description = description
        self.required_tier = required_tier

    @abstractmethod
    def execute(self, **kwargs) -> ToolResult:
        """Execute the tool with given parameters.

        Args:
            **kwargs: Tool-specific parameters

        Returns:
            ToolResult containing success status, output, and optional error
        """
        pass

    @property
    @abstractmethod
    def parameters_schema(self) -> dict[str, Any]:
        """Return JSON schema for tool parameters.

        Returns:
            Dictionary describing required and optional parameters
        """
        pass

    def to_openai_tool(self) -> dict[str, Any]:
        """Convert tool to OpenAI tool format for API calls."""
        properties = {}
        required = []

        for key, schema in self.parameters_schema.items():
            prop_schema = {k: v for k, v in schema.items() if k != "required"}
            properties[key] = prop_schema
            if schema.get("required", False):
                required.append(key)

        tool_def = {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": properties,
                },
            },
        }
        if required:
            tool_def["function"]["parameters"]["required"] = required
        return tool_def
