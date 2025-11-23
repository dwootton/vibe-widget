"""Base classes for agentic tool system."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable


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

    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description

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

    def to_anthropic_tool(self) -> dict[str, Any]:
        """Convert tool to Anthropic tool format for API calls."""
        # Extract properties and required fields separately
        properties = {}
        required = []
        
        for key, schema in self.parameters_schema.items():
            # Copy schema without 'required' field
            prop_schema = {k: v for k, v in schema.items() if k != "required"}
            properties[key] = prop_schema
            
            # Track required fields
            if schema.get("required", False):
                required.append(key)
        
        tool_def = {
            "name": self.name,
            "description": self.description,
            "input_schema": {
                "type": "object",
                "properties": properties,
            },
        }
        
        # Only add required field if there are required parameters
        if required:
            tool_def["input_schema"]["required"] = required
        
        return tool_def


class ToolRegistry:
    """Registry for managing available tools."""

    def __init__(self):
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        """Register a tool."""
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        """Get a tool by name."""
        return self._tools.get(name)

    def list_tools(self) -> list[Tool]:
        """List all registered tools."""
        return list(self._tools.values())

    def to_anthropic_tools(self) -> list[dict[str, Any]]:
        """Convert all tools to Anthropic format."""
        return [tool.to_anthropic_tool() for tool in self._tools.values()]
