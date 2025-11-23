#!/usr/bin/env python3
"""Quick test to verify tool schema format matches Anthropic API requirements."""

import sys
sys.path.insert(0, 'src')

from vibe_widget.llm.tools.data_tools import DataLoadTool, DataProfileTool, DataWrangleTool
from vibe_widget.llm.tools.code_tools import CodePlanTool, CodeGenerateTool, CodeValidateTool
import json

def test_tool_schemas():
    """Test that all tool schemas match Anthropic API format."""
    
    # Test DataLoadTool
    tool = DataLoadTool()
    schema = tool.to_anthropic_tool()
    
    print("=" * 60)
    print("DataLoadTool Schema:")
    print(json.dumps(schema, indent=2))
    print()
    
    # Verify structure
    assert "name" in schema
    assert "description" in schema
    assert "input_schema" in schema
    assert schema["input_schema"]["type"] == "object"
    assert "properties" in schema["input_schema"]
    
    # Verify properties don't have 'required' field
    for prop_name, prop_schema in schema["input_schema"]["properties"].items():
        assert "required" not in prop_schema, f"Property '{prop_name}' should not have 'required' field"
    
    # Verify required array exists at input_schema level
    if "required" in schema["input_schema"]:
        assert isinstance(schema["input_schema"]["required"], list)
        assert "source" in schema["input_schema"]["required"]
    
    print("✅ DataLoadTool schema is valid!")
    print()
    
    # Test a few more tools
    tools = [
        DataProfileTool(),
        CodePlanTool(llm_provider=None),
        CodeGenerateTool(llm_provider=None),
        CodeValidateTool(),
    ]
    
    for tool in tools:
        schema = tool.to_anthropic_tool()
        print(f"{tool.name} schema:")
        print(json.dumps(schema, indent=2))
        print()
        
        # Verify no 'required' in properties
        for prop_name, prop_schema in schema["input_schema"]["properties"].items():
            assert "required" not in prop_schema, f"Property '{prop_name}' in {tool.name} has 'required' field"
        
        print(f"✅ {tool.name} schema is valid!")
        print()
    
    print("=" * 60)
    print("🎉 All tool schemas are valid!")
    print()

if __name__ == "__main__":
    test_tool_schemas()
