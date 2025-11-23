# Agentic Widget Generation System

A sophisticated multi-agent orchestration system for generating React widgets in Jupyter notebooks with tool use, validation, and automatic error recovery.

## Architecture

### Core Components

#### 1. Agent Orchestrator (`agentic.py`)
- Manages conversation with Claude using Anthropic's tool use API
- Iterates until widget code passes validation or max iterations reached
- Streams progress updates for transparency
- Surfaces all pipeline artifacts (plans, wrangling code, validation results)

#### 2. Tool System (`tools/`)

**Base Framework** (`base.py`)
- `Tool`: Abstract base class for all tools
- `ToolResult`: Standardized result format
- `ToolRegistry`: Central registry for tool discovery

**Data Tools** (`data_tools.py`)
- `DataLoadTool`: Load data from files or DataFrames with automatic sampling
- `DataProfileTool`: Generate comprehensive data profiles
- `DataWrangleTool`: Generate Python code for data transformation

**Code Tools** (`code_tools.py`)
- `CodePlanTool`: Create structured implementation plans
- `CodeGenerateTool`: Generate widget code following specifications
- `CodeValidateTool`: Validate code structure, exports, imports, cleanup

**Execution Tools** (`execution_tools.py`)
- `CLIExecuteTool`: Execute shell commands for validation
- `RuntimeTestTool`: Test widget code for syntax and structural errors
- `ErrorDiagnoseTool`: Analyze runtime errors and categorize
- `CodeRepairTool`: Repair code based on error diagnosis

### Workflow

```
User Request
    ↓
Agent Orchestrator
    ↓
┌─────────────────────┐
│ 1. Data Analysis    │ → DataLoadTool, DataProfileTool
├─────────────────────┤
│ 2. Planning         │ → CodePlanTool
├─────────────────────┤
│ 3. Generation       │ → CodeGenerateTool
├─────────────────────┤
│ 4. Validation       │ → CodeValidateTool, RuntimeTestTool
├─────────────────────┤
│ 5. Error Recovery   │ → ErrorDiagnoseTool, CodeRepairTool
└─────────────────────┘
    ↓
Final Widget Code + Artifacts
```

## Key Features

### 1. Streaming Progress
All steps emit progress events that are surfaced to the user:
- Iteration count
- Tool invocations
- Thinking/reasoning steps
- Tool results

### 2. Automatic Data Handling
- Detects large datasets and automatically samples
- Generates data wrangling code when transformations are needed
- Handles missing values and type conversions
- Surfaces pipeline code for reuse

### 3. Robust Validation
- Syntax checking (using Node.js if available)
- Export/import lifecycle validation
- Cleanup handler verification
- CDN import version checking
- Common pitfall detection

### 4. Error Recovery
- Categorizes errors (syntax, reference, type, import, etc.)
- Provides actionable diagnostics
- Automatically generates repairs
- Iterates until resolution

### 5. Artifact Surfacing
All intermediate artifacts are preserved and accessible:
- Implementation plans
- Data wrangling code
- Validation results
- Error diagnoses

## Usage

### Basic Agentic Mode

```python
import vibe_widget as vw

widget = vw.create(
    "scatter plot with brush selection",
    df,
    api_key="your-key",
    agentic=True
)
```

### Accessing Artifacts

```python
# Get all artifacts
artifacts = widget.get_pipeline_artifacts()

# Get specific artifacts
plan = widget.get_implementation_plan()
wrangle_code = widget.get_data_wrangle_code()
```

### With Progress Monitoring

```python
# Progress is automatically displayed in notebook
# Shows: iterations, tool calls, reasoning, results
widget = vw.create(
    "complex visualization",
    large_df,
    agentic=True,
    show_progress=True  # Default
)
```

## Tool Details

### DataLoadTool
```python
{
  "source": "path/to/file.csv",
  "sample_size": 10000  # Max rows to load
}
```
Returns: metadata + sample + dataframe reference

### DataProfileTool
```python
{
  "data": data_load_output
}
```
Returns: comprehensive profile with stats, nulls, types

### DataWrangleTool
```python
{
  "profile": data_profile_output,
  "requirements": "filter outliers and normalize"
}
```
Returns: executable Python code

### CodePlanTool
```python
{
  "description": "user request",
  "data_profile": profile_output,
  "exports": {"trait": "description"},
  "imports": {"trait": "description"}
}
```
Returns: structured implementation plan (JSON)

### CodeGenerateTool
```python
{
  "plan": code_plan_output,
  "description": "user request",
  "data_info": {columns, types, sample, exports, imports}
}
```
Returns: complete widget JavaScript code

### CodeValidateTool
```python
{
  "code": "widget code",
  "expected_exports": ["trait1", "trait2"],
  "expected_imports": ["import1"]
}
```
Returns: validation results with issues and warnings

### RuntimeTestTool
```python
{
  "code": "widget code"
}
```
Returns: test results (syntax check, import validation)

### ErrorDiagnoseTool
```python
{
  "error_message": "ReferenceError: x is not defined",
  "code": "broken widget code"
}
```
Returns: categorized diagnosis with suggested fix

### CodeRepairTool
```python
{
  "code": "broken code",
  "diagnosis": error_diagnose_output,
  "data_info": {columns, types, exports, imports}
}
```
Returns: repaired widget code

### CLIExecuteTool
```python
{
  "command": "npm --version",
  "purpose": "check npm availability"
}
```
Returns: stdout, stderr, return code

## Configuration

### Max Iterations
```python
from vibe_widget.llm.agentic import AgentOrchestrator

orchestrator = AgentOrchestrator(
    llm_provider,
    max_iterations=20,  # Default: 15
    max_repair_attempts=5  # Default: 3
)
```

### Tool Selection
Tools are automatically registered. To customize:
```python
# Remove a tool
orchestrator.registry._tools.pop("tool_name")

# Add custom tool
from vibe_widget.llm.tools.base import Tool

class CustomTool(Tool):
    def __init__(self):
        super().__init__("custom", "description")
    
    @property
    def parameters_schema(self):
        return {"param": {"type": "string", "required": True}}
    
    def execute(self, param):
        return ToolResult(success=True, output="result")

orchestrator.registry.register(CustomTool())
```

## Best Practices

### 1. Use Agentic Mode For
- Complex visualizations requiring planning
- Large datasets needing transformation
- Scenarios prone to errors (Three.js, WebGL)
- Cross-widget interactions with exports/imports
- When you need pipeline transparency

### 2. Use Simple Mode For
- Quick prototypes
- Well-defined simple visualizations
- Small clean datasets
- When speed is priority over robustness

### 3. Data Handling
- For datasets > 10k rows, agentic mode auto-samples
- Review generated wrangling code before production use
- Use data profiling to understand patterns first

### 4. Error Handling
- Let the agent iterate through errors
- Max 3 repair attempts by default (configurable)
- Manual intervention available via widget.get_pipeline_artifacts()

## Troubleshooting

### Agent Hits Max Iterations
- Check progress logs for stuck loops
- Simplify description or split into smaller tasks
- Increase max_iterations if legitimately complex

### Tool Execution Fails
- Verify dependencies (Node.js for RuntimeTestTool)
- Check data format compatibility
- Review tool result error messages

### No Progress Updates
- Ensure show_progress=True
- Check IPython display availability
- Review streaming callback setup

## Future Enhancements

- [ ] Multi-file code generation (separate CSS, utils)
- [ ] Test harness generation for validation
- [ ] Parallel tool execution where applicable
- [ ] User intervention points (approve/reject steps)
- [ ] Persistent artifact storage
- [ ] Tool execution sandboxing
- [ ] Custom tool plugins via entry points
