# Agent Guide for vibe-widget

> Comprehensive guide for AI agents working in this codebase. Last updated: 2026-01-07

## Project Overview

**vibe-widget** is a Python library that generates interactive Jupyter notebook widgets from natural language descriptions using LLMs. It combines Python backend (anywidget + traitlets) with a React-based JavaScript frontend bundled with esbuild.

- **Tech Stack**: Python 3.9+, React 19, anywidget, esbuild, OpenRouter API
- **Purpose**: Create interactive data visualizations in notebooks without writing frontend code
- **Architecture**: Hybrid Python/JavaScript with LLM-powered code generation

## Essential Commands

### Development Setup

```bash
# Install JavaScript dependencies
npm install

# Install Python package in editable mode (from repo root)
python -m pip install -e .

# Install dev dependencies
python -m pip install -e ".[dev]"
```

### Build & Watch

```bash
# Build JavaScript bundle once
npm run build-app-wrapper

# Watch mode (recommended during development)
npm run watch-app-wrapper

# Build output: src/vibe_widget/AppWrapper/AppWrapper.js → AppWrapper.bundle.js
```

**CRITICAL**: After JS changes, you MUST:
1. Rebuild the bundle (or use watch mode)
2. **Restart the Jupyter kernel** (the bundle is cached)

### Testing

```bash
# Run full test suite
pytest



# Optional test suites (disabled by default)
RUN_PERF=1 pytest -m performance
RUN_E2E=1 pytest -m e2e

# JavaScript tests
npm run test:ui
```

### Code Quality

```bash
# Linting (ruff)
ruff check src/ tests/

# Type checking (mypy)
mypy src/

# Formatting (ruff)
ruff format src/ tests/
```

**Ruff config** (pyproject.toml):
- Line length: 100
- Target: Python 3.9
- Auto-imports sorting (isort)
- Quote style: double quotes
- Indent style: spaces

## Project Structure

### Python Source (`src/vibe_widget/`)

```
src/vibe_widget/
├── __init__.py              # Public API exports
├── api.py                   # Output/input/action API helpers (ExportHandle, bundles)
├── config.py                # Config, model catalog, OpenRouter model fetching
├── themes.py                # Theme definitions and generation
├── debug.py                 # Debug utilities
├── models_manifest.json     # Available LLM models catalog
│
├── core/                    # Core widget implementation
│   ├── widget.py           # VibeWidget class (anywidget subclass)
│   ├── state.py            # StateManager for execution/audit state
│   └── __init__.py         # create(), edit(), load(), clear()
│
├── llm/                     # LLM provider abstraction
│   ├── agentic.py          # AgenticOrchestrator (main generation flow)
│   ├── providers/
│   │   ├── base.py         # LLMProvider abstract base
│   │   └── openrouter_provider.py  # OpenRouter implementation
│   └── tools/              # Tools for agentic workflows
│       ├── base.py
│       ├── code_tools.py   # CodeValidateTool
│       ├── data_tools.py   # DataLoadTool, DataProfileTool, DataWrangleTool
│       └── execution_tools.py  # RuntimeTestTool, ErrorDiagnoseTool
│
├── services/                # Service layer
│   ├── generation.py       # GenerationService (orchestrates code generation)
│   ├── audit.py            # AuditService (security audits)
│   └── theme.py            # ThemeService
│
├── utils/                   # Utilities
│   ├── audit_store.py      # AuditStore (persistent audit cache)
│   ├── code_parser.py      # CodeStreamParser, RevisionStreamParser
│   ├── logging.py          # Logger setup
│   ├── serialization.py    # JSON serialization helpers
│   ├── util.py             # Data loading, summarization, cleaning
│   ├── validation.py       # Input name sanitization
│   └── widget_store.py     # WidgetStore (persistent widget cache)
│
└── AppWrapper/              # JavaScript/React frontend
    ├── AppWrapper.js       # Main React component
    ├── components/         # React components
    │   ├── SandboxedRunner.js
    │   ├── FloatingMenu.js
    │   ├── LoadingOverlay.js
    │   ├── SelectionOverlay.js
    │   ├── EditPromptPanel.js
    │   ├── AuditNotice.js
    │   ├── ProgressMap.js
    │   ├── DebuggerPanel.js
    │   └── editor/         # Code editor components
    │       ├── EditorViewer.js
    │       ├── CodeEditor.js
    │       ├── MessageEditor.js
    │       └── AuditPanel.js
    ├── hooks/              # React hooks
    │   ├── useModelSync.js
    │   └── useKeyboardShortcuts.js
    └── utils/              # JS utilities
```

### Tests (`tests/`)

```
tests/
├── conftest.py              # Pytest fixtures (mock LLM provider, sample data)
├── utils.py                 # Test utilities
├── mocks/                   # Mock implementations
├── fixtures/                # Test fixtures
├── unit/                    # Fast unit tests (no network)
├── integration/             # Integration tests (mocked LLM)
└── notebooks/               # Notebook-based tests
```

### Documentation & Examples

```
doc/                         # Documentation website (React + Vite)
examples/                    # Example Jupyter notebooks
├── example-gallery.ipynb
├── cross_widget_interactions.ipynb
├── pdf_and_web_extraction.ipynb
└── ...
```

## Code Conventions & Patterns

### Python Style

1. **Type Hints**: Use type hints everywhere (required by mypy)
   ```python
   def create(description: str, df: pd.DataFrame, **kwargs) -> VibeWidget:
   ```

2. **Imports**: Absolute imports from `vibe_widget.*`
   ```python
   from vibe_widget.core import VibeWidget
   from vibe_widget.utils.logging import get_logger
   ```

3. **Docstrings**: Use Google-style docstrings
   ```python
   def generate(self, description: str) -> str:
       """Generate widget code from description.
       
       Args:
           description: Natural language widget description
           
       Returns:
           Generated widget code as a string
       """
   ```

4. **Error Handling**: Use specific exceptions, log errors
   ```python
   from vibe_widget.utils.logging import get_logger
   
   logger = get_logger(__name__)
   
   try:
       result = operation()
   except SpecificError as exc:
       logger.error("Operation failed: %s", exc)
       raise
   ```

5. **Data Serialization**: Always use `clean_for_json()` before JSON serialization
   ```python
   from vibe_widget.utils.serialization import clean_for_json
   
   data = clean_for_json(df)  # Handles NaN, NaT, numpy types
   ```

### JavaScript/React Style

1. **HTM instead of JSX**: Use `htm` for template literals
   ```javascript
   import htm from "htm";
   const html = htm.bind(React.createElement);
   
   return html`<div>${content}</div>`;
   ```

2. **React Hooks**: Prefer functional components with hooks
   ```javascript
   const [state, setState] = React.useState(initialValue);
   React.useEffect(() => { /* effect */ }, [deps]);
   ```

3. **Model Sync**: Use `useModelSync` hook to sync with Python traitlets
   ```javascript
   import useModelSync from "./hooks/useModelSync";
   
   const { status, code, logs } = useModelSync(model);
   ```

4. **CodeMirror**: Use CodeMirror 6 for code editing
   ```javascript
   import { EditorState } from "@codemirror/state";
   import { EditorView } from "@codemirror/view";
   ```

### Widget Code Generation

1. **Widget Code Format**: Generated code must export a default function
   ```javascript
   export default function Widget({ model, html, React }) {
     // Set outputs
     model.set("outputName", value);
     model.save_changes();
     
     return html`<div>widget content</div>`;
   }
   ```

2. **Optional Named Exports**: For reusable components
   ```javascript
   export const MiniChart = ({ model, html, React }) => {
     return html`<div>mini chart</div>`;
   };
   ```

3. **Data Access**: Via `model.get()`
   ```javascript
   const data = model.get("data");
   const inputValue = model.get("inputName");
   ```

## Critical Patterns & Gotchas

### anywidget Bundle Loading

**GOTCHA**: The JavaScript bundle is embedded in Python at import time:

```python
class VibeWidget(anywidget.AnyWidget):
    _esm = Path("AppWrapper.bundle.js").read_text()
```

**Implication**: After rebuilding JS, you MUST restart the Jupyter kernel. The bundle is cached.

### Dynamic Traitlets

Widgets dynamically generate traitlet classes based on declared exports/imports:

```python
# Class cache for performance
_CLASS_CACHE: dict[frozenset[str], type] = {}

def _get_widget_class(base_cls: type, exports: dict, imports: dict) -> type:
    signature = frozenset(set(exports.keys()) | set(imports.keys()))
    # Returns cached or creates new subclass with dynamic traits
```

**Pattern**: Each unique export/import signature gets its own widget class.

### Test Mocking Strategy

By default, ALL tests use a mocked LLM provider (see `tests/conftest.py`):

```python
@pytest.fixture(autouse=True)
def _mock_openrouter_provider(request, monkeypatch):
    if request.node.get_closest_marker("e2e"):
        return  # Skip mocking for e2e tests
    
    # Mock methods return simple valid code
    monkeypatch.setattr(OpenRouterProvider, "generate_widget_code", _fake_generate)
```

**To use real LLM**: Mark test with `@pytest.mark.e2e` and set `OPENROUTER_API_KEY`.

### Execution Modes

Widgets support three execution modes (configured via `config.execution_mode`):

1. **"auto"** (default): Execute generated code immediately
2. **"review"**: Show code, require user approval before execution
3. **"manual"**: Show code, never auto-execute

**State tracking**: `StateManager` tracks approval hashes to avoid re-prompting.

### Audit System

Security audit system with two levels:

1. **"fast"**: Quick security scan (uses cheaper model)
2. **"full"**: Comprehensive audit with alternatives

**Cache**: `AuditStore` caches audit results by code hash to avoid redundant scans.

**Pattern**: Always run audit before executing untrusted code (especially on load).

### Widget Persistence

Widgets can be saved/loaded as `.vw` bundles:

```python
# Save
widget.save("path/to/widget.vw")  # or .vibewidget

# Load
loaded = vw.load("path/to/widget.vw")
```

**Bundle contents**: JSON file with code, metadata, description, exports/imports.

**Security**: Loaded widgets trigger audit by default unless user opts out.

## API Key & Configuration

### Environment Variables

```bash
# Required for widget generation
export OPENROUTER_API_KEY="your-key-here"

# Optional: Load from .env file (tests use this)
# .env file in repo root
```

### Configuration API

```python
import vibe_widget as vw

# Global config
vw.config.set(model="openrouter", mode="premium")
vw.config.set(execution_mode="review")  # or "auto", "manual"

# Check available models
models = vw.models()  # Fetches from OpenRouter API
```

**Config options**:
- `model`: Model ID or alias ("openrouter", "anthropic", etc.)
- `mode`: "standard" (cheaper) or "premium" (better)
- `api_key`: Defaults to `OPENROUTER_API_KEY` env var
- `execution_mode`: "auto", "review", or "manual"

## Common Development Tasks

### Adding a New Test

1. Choose test category: `unit/`, `integration/`, or mark as `e2e`
2. Use fixtures from `conftest.py`: `sample_df`, `_mock_openrouter_provider`
3. Add pytest marker:
   ```python
   pytestmark = pytest.mark.unit  # or integration, e2e, etc.
   ```

### Adding a New LLM Provider

1. Create subclass of `LLMProvider` in `llm/providers/`
2. Implement abstract methods:
   - `generate_widget_code()`
   - `revise_widget_code()`
   - `fix_code_error()`
   - `generate_audit_report()`
   - `generate_text()`
3. Update `Config` to support new provider
4. Add tests with mocking

### Adding a New React Component

1. Create in `src/vibe_widget/AppWrapper/components/`
2. Use HTM for templates, React hooks for state
3. Import in `AppWrapper.js`
4. Rebuild bundle: `npm run build-app-wrapper`
5. Restart Jupyter kernel to test

### Modifying Widget Generation Logic

1. **Code generation**: Edit `llm/agentic.py` (AgenticOrchestrator)
2. **Prompt construction**: Edit `llm/providers/base.py` (prompts in provider methods)
3. **Code validation**: Edit `utils/code_parser.py` or `llm/tools/code_tools.py`
4. **Add tests**: Mock LLM in `conftest.py`, test in `tests/unit/` or `tests/integration/`

### Debugging Widget Code

1. **Enable debug mode**:
   ```python
   from vibe_widget.debug import enable_debug
   enable_debug()  # Shows DebuggerPanel in widget UI
   ```

2. **Check widget logs**:
   ```python
   widget.widget_logs  # List of log entries from widget runtime
   ```

3. **View generated code**:
   ```python
   print(widget.code)  # Current widget code
   ```

4. **Inspect widget state**:
   ```python
   widget.status        # "idle", "generating", "running", "error"
   widget.error_message # LLM or generation errors
   widget.widget_error  # Runtime errors from widget code
   ```

## CI/CD Pipelines

### GitHub Actions Workflows

1. **`pypi-publish.yml`**: Publishes to PyPI on release
   - Builds JS bundle first: `npm run build-app-wrapper`
   - Builds Python package: `python -m build --wheel --no-isolation`
   - Uses PyPI Trusted Publishing

2. **`build-static-docs.yml`**: Builds documentation site
   - Runs on doc changes
   - Uses Node.js 20, builds with `npm ci`

3. **`deploy-website.yml`**: Deploys docs to hosting

### Release Process

1. Update version in `pyproject.toml`
2. Update `CHANGELOG.md`
3. Commit changes
4. Create GitHub release (triggers PyPI publish workflow)
5. Workflow builds JS bundle + Python package automatically

## Common Pitfalls

### 1. Forgetting to Restart Jupyter Kernel

**Symptom**: JS changes don't appear in widget  
**Cause**: Bundle cached at import time  
**Fix**: Restart kernel after rebuilding

### 2. Missing Type Hints

**Symptom**: mypy errors  
**Cause**: Function missing return type or argument types  
**Fix**: Add type hints to all functions

### 3. Wrong Import Paths

**Symptom**: Import errors  
**Cause**: Relative imports or wrong module path  
**Fix**: Use absolute imports: `from vibe_widget.module import ...`

### 4. Not Using `clean_for_json()`

**Symptom**: JSON serialization errors with DataFrames  
**Cause**: NaN, NaT, or numpy types in data  
**Fix**: Always use `clean_for_json()` before sending data to frontend

### 5. Test Hitting Real API

**Symptom**: Tests slow or fail without API key  
**Cause**: Test not using mock provider  
**Fix**: Ensure test doesn't have `@pytest.mark.e2e`, check `conftest.py` mocking

### 6. Modifying Traitlets Directly

**Symptom**: Widget not syncing with frontend  
**Cause**: Setting trait without calling `save_changes()`  
**Fix**: Always call `model.save_changes()` after setting traits:
```python
model.set("trait_name", value)
model.save_changes()
```

### 7. Bundle Not Included in Package

**Symptom**: Import error after pip install  
**Cause**: Bundle not built before packaging  
**Fix**: Run `npm run build-app-wrapper` before building package

## Architecture Patterns

### Service Layer Pattern

Services encapsulate business logic:

```python
# services/generation.py
class GenerationService:
    def __init__(self, orchestrator, cache, audit_store):
        self.orchestrator = orchestrator
        self.cache = cache
        self.audit_store = audit_store
    
    def generate_widget_code(self, description, data_info, ...):
        # Check cache
        # Generate with orchestrator
        # Cache result
        # Return code
```

### State Management Pattern

`StateManager` centralizes execution and audit state:

```python
from vibe_widget.core.state import StateManager

state = StateManager(widget)
state.reset_approval()  # Clear approval state
state.approval_needed(code)  # Check if approval required
```

### Observer Pattern for Outputs

Export handles support observers for reactive updates:

```python
# Create export handle
handle = widget.export("outputName")

# Observe changes
def on_change(change_event):
    print(f"Changed from {change_event.old} to {change_event.new}")

handle.observe(on_change)
```

### Cache Pattern

Widgets and audits use persistent caches:

```python
from vibe_widget.utils.widget_store import WidgetStore
from vibe_widget.utils.audit_store import AuditStore

widget_store = WidgetStore()
widget_store.save_widget(widget_id, metadata, code)
cached = widget_store.load_widget(widget_id)

audit_store = AuditStore()
report = audit_store.get_report(code_hash, level="fast")
```

## Useful Code References

### Creating a Widget

```python
import vibe_widget as vw
import pandas as pd

df = pd.DataFrame({"x": [1, 2, 3], "y": [4, 5, 6]})

# Basic creation
widget = vw.create("scatter plot with tooltips", df)
widget()

# With exports (outputs)
widget = vw.create(
    "interactive chart",
    df,
    exports=vw.outputs(
        selection="indices of selected points",
        hover="data of hovered point"
    )
)

# Access exports
selection = widget.export("selection")
print(selection())  # Get current value

# With imports (inputs)
widget = vw.create(
    "chart with threshold",
    df,
    imports=vw.inputs(
        threshold=50,  # Initial value
    )
)
```

### Editing a Widget

```python
# Edit existing widget
widget = vw.edit(widget, "add a histogram below the chart")

# Grab mode (select element and edit)
# Triggered from widget UI, not programmatic API
```

### Loading/Saving Widgets

```python
# Save to file
widget.save("my_widget.vw")

# Load from file (triggers audit by default)
loaded = vw.load("my_widget.vw")
```

### Configuration

```python
import vibe_widget as vw

# Set global config
vw.config.set(
    model="openrouter",
    mode="premium",
    execution_mode="review"  # Require approval before execution
)

# Get config
cfg = vw.config.get()
print(cfg.model, cfg.mode)

# List available models
models = vw.models(refresh=True)  # Refresh from OpenRouter API
```

### Theme Customization

```python
import vibe_widget as vw

# Generate theme from description
theme = vw.theme("dark mode with neon accents")

# Use theme
widget = vw.create("chart", df, theme=theme)

# List built-in themes
themes = vw.themes()
```

## Testing Guidelines

### Unit Tests

- **Location**: `tests/unit/`
- **Mark**: `@pytest.mark.unit` or `pytestmark = pytest.mark.unit`
- **Characteristics**: Fast, no network, mocked LLM
- **Example**:
  ```python
  pytestmark = pytest.mark.unit
  
  def test_data_serialization(sample_df):
      from vibe_widget.utils.serialization import clean_for_json
      result = clean_for_json(sample_df)
      assert isinstance(result, list)
  ```

### Integration Tests

- **Location**: `tests/integration/`
- **Mark**: `@pytest.mark.integration`
- **Characteristics**: Multiple components, mocked LLM, no network
- **Example**:
  ```python
  pytestmark = pytest.mark.integration
  
  def test_widget_creation_flow(sample_df):
      import vibe_widget as vw
      widget = vw.create("test", sample_df)
      assert widget.status in ["idle", "generating", "running"]
  ```

### E2E Tests

- **Mark**: `@pytest.mark.e2e`
- **Requirements**: `OPENROUTER_API_KEY` environment variable
- **Characteristics**: Real LLM calls, slow, costly
- **Example**:
  ```python
  @pytest.mark.e2e
  def test_real_widget_generation(sample_df):
      import vibe_widget as vw
      widget = vw.create("scatter plot", sample_df)
      assert widget.code != ""  # Real code generated
  ```

### Component Code Tests

- **Mark**: `@pytest.mark.component_code`
- **Purpose**: Test widgets with named component exports
- **Effect**: Mock LLM returns code with `export const ComponentName = ...`

## Documentation

- **Website**: https://vibewidget.dev
- **Source**: `doc/` directory (React + Vite)
- **Examples**: Jupyter notebooks in `examples/`
- **API docs**: Inline docstrings (Google style)

## Getting Help

- **Issues**: https://github.com/dwootton/vibe-widget/issues
- **Dev Setup**: See `DEV_SETUP.md`
- **Changelog**: See `CHANGELOG.md`
- **Examples**: See `examples/` directory

## Quick Reference

| Task | Command |
|------|---------|
| Install deps | `npm install && python -m pip install -e ".[dev]"` |
| Build JS bundle | `npm run build-app-wrapper` |
| Watch JS | `npm run watch-app-wrapper` |
| Run tests | `pytest` |
| Run specific tests | `pytest -k "test_name"` or `pytest -m unit` |
| Lint Python | `ruff check src/ tests/` |
| Format Python | `ruff format src/ tests/` |
| Type check | `mypy src/` |
| Restart kernel | Required after JS changes |

---

**Remember**: This is a hybrid Python/JavaScript project. Changes to JS require rebuilding the bundle AND restarting the Jupyter kernel. Most tests use mocked LLM to avoid API costs.
