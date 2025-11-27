# Vibe Widget ✨

![Python Version](https://img.shields.io/badge/python-3.9%2B-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Multi-Provider](https://img.shields.io/badge/LLM-Multi%20Provider-blueviolet)
![Jupyter](https://img.shields.io/badge/jupyter-widgets-orange)

**Transform natural language into beautiful, interactive visualizations — powered by AI (Claude, GPT, Gemini).**

Vibe Widget is an agentic visualization library that generates custom interactive widgets from plain English descriptions. Just describe what you want to visualize, provide your data, and let the AI create a tailored React component that brings your data to life.

## What Makes Vibe Widget Special?

### 🤖 **AI-Powered Widget Generation**
No more fighting with plotting APIs or wrestling with configuration options. Simply describe your visualization in natural language, and AI (Claude, GPT, or Gemini) generates production-ready React code customized to your exact needs.

### 🔗 **Cross-Widget Interactions**
Create **linked visualizations** where interactions in one widget dynamically update others. Brush-select points in a scatter plot to filter a histogram. Click a planet in 3D space to highlight it in a chart. Paint terrain on a canvas and watch it render in 3D — all with automatic state synchronization.

### 📂 **Universal Data Support**
Load data from anywhere:
- **DataFrames**: Pandas DataFrames
- **Files**: CSV, JSON, NetCDF, XML, ISF (seismic data)
- **Documents**: PDF tables extracted automatically
- **Web**: Scrape and visualize data from any URL
- **Live**: Real-time data streams

### 🎨 **Truly Custom Visualizations**
Unlike traditional plotting libraries with fixed chart types, Vibe Widget generates **completely custom** React components. Want a 3D solar system? A terrain painter? An interactive game board? Just describe it.

### 💾 **Smart Caching**
Generated widgets are automatically cached with intelligent versioning. Recreating the same visualization is instant, and you can track all your widget variations.

---

## 🚀 Installation

```bash
pip install vibe-widget
```

Or with `uv`:

```bash
uv pip install vibe-widget
```

Set your API key(s) for the provider(s) you want to use:

```bash
# For Claude models (Anthropic)
export ANTHROPIC_API_KEY='your-api-key-here'

# For GPT models (OpenAI) 
export OPENAI_API_KEY='your-api-key-here'

# For Gemini models (Google)
export GEMINI_API_KEY='your-api-key-here'
```

---

## ⚡ Quick Start

```python
import pandas as pd
import vibe_widget as vw

# Optional: Configure your preferred model (defaults to Claude)
vw.config(model="gemini")  # Use Google Gemini
# or
vw.config(model="openai", mode="premium")  # Use GPT-5 or o3-pro
# or 
vw.config(model="anthropic", mode="standard")  # Use Claude Sonnet

# See all available models
print(vw.models())

# Load your data
df = pd.read_csv('sales_data.csv')

# Create a visualization with natural language
widget = vw.create(
    "interactive bar chart showing sales by region, sorted by revenue, with hover tooltips",
    df
)
```

That's it! The AI will:
1. ✅ Analyze your data structure
2. ✅ Generate a custom React component
3. ✅ Validate and test the code
4. ✅ Display the interactive widget in your notebook

---

## 📚 Usage Examples

### 📊 **Basic Visualization**

```python
import vibe_widget as vw
import pandas as pd

# Create a simple chart
df = pd.DataFrame({
    'planet': ['Mercury', 'Venus', 'Earth', 'Mars'],
    'distance': [0.39, 0.72, 1.0, 1.52],
    'mass': [0.055, 0.815, 1.0, 0.107]
})

widget = vw.create(
    "3D scatter plot showing planet distance from sun vs orbital period, with size based on mass",
    df
)
```

### 🌐 **Web Scraping**

```python
# Automatically scrape and visualize web data
widget = vw.create(
    "Show Hacker News stories as interactive cards with sorting by score and filtering",
    "https://news.ycombinator.com"
)
```

### 📄 **PDF Extraction**

```python
# Extract and visualize tables from PDFs
widget = vw.create(
    "interactive table from the PDF with sorting and filtering capabilities",
    "report.pdf"
)
```

### 🌍 **Scientific Data (NetCDF)**

```python
# Visualize climate/ocean data
widget = vw.create(
    "interactive heatmap showing sea surface temperature patterns, zoomable and pannable",
    "sea_surface_temp.nc"
)
```

### 🔗 **Cross-Widget Interactions**

Create **linked visualizations** that communicate with each other:

```python
# Widget 1: Scatter plot with brush selection
scatter = vw.create(
    "scatter plot of temperature vs humidity with brush selection",
    df,
    exports={"selected_indices": "indices of selected points"}
)

# Widget 2: Histogram that responds to selection
histogram = vw.create(
    "histogram of temperature, highlighting selected points from scatter plot",
    df,
    imports={"selected_indices": scatter}
)

# Now selecting points in the scatter plot automatically updates the histogram! 🎉
```

**More Cross-Widget Examples:**

- 🎮 **Interactive Terrain Editor**: Paint terrain on a 2D canvas → Watch it render in 3D
- 🪐 **Solar System Explorer**: Click planets in 3D → Highlight data in charts
- 🎯 **Data Filtering**: Brush points in one chart → Filter multiple other visualizations
- 🎲 **Game States**: Game board → AI decision tree visualization

See [`examples/cross_widget_interactions.ipynb`](examples/cross_widget_interactions.ipynb) for complete examples!

---

## 🎯 Key Features

### 🧠 **Intelligent Data Processing**
- Automatic data type detection and conversion
- Smart sampling for large datasets (>100k rows)
- Multi-format support (CSV, JSON, NetCDF, XML, ISF, PDF)
- Web scraping with automatic content extraction

### 🛠️ **Agentic Code Generation**
- LLM-powered React component generation
- Automatic validation and error repair
- Self-healing code with diagnostic feedback
- Iterative refinement until production-ready

### 🔄 **State Management**
- Automatic trait linking between widgets
- Bidirectional data synchronization
- Export/import system for cross-widget communication
- Built on Jupyter widgets (ipywidgets) for robust state handling

### 💾 **Smart Caching System**
- Automatic widget versioning
- Content-based cache keys
- Instant recreation of previously generated widgets
- Organized storage in `.vibewidget/` directory

### 📦 **Production Ready**
- Full TypeScript/JSX support in generated components
- Modern React patterns (hooks, effects)
- Clean, maintainable generated code
- Comprehensive error handling

---

## 🎨 API Reference

### `vw.create()`

The main function for creating visualizations:

```python
widget = vw.create(
    description: str,              # Natural language description
    data: DataFrame | str | Path,  # Data source
    api_key: str | None = None,    # API key for selected provider (or use env vars)
    model: str | None = None,      # Model to use (see vw.models() for options)
    show_progress: bool = True,    # Show generation progress
    exports: dict | None = None,   # Traits to export for other widgets
    imports: dict | None = None,   # Traits to import from other widgets
    config: Config | None = None,  # Optional Config object with model settings
)
```

**Parameters:**

- **`description`**: Natural language description of your visualization
  - Be specific about chart types, interactions, styling, etc.
  - Examples: "3D scatter plot with rotation controls", "bar chart with hover tooltips sorted by value"

- **`data`**: Your data source, can be:
  - Pandas DataFrame
  - File path (CSV, JSON, NetCDF, XML, ISF, PDF)
  - URL (for web scraping)
  - `None` (for widgets driven purely by imports)

- **`model`**: LLM model to use (optional)
  - Shortcuts: `"anthropic"`, `"openai"`, `"gemini"`
  - Specific models: `"claude-3-5-sonnet"`, `"gpt-4-turbo"`, `"gemini-1.5-pro"`
  - Use `vw.models()` to see all available options
  
- **`config`**: Config object for model settings
  - Can be created with `vw.Config(model="gemini", mode="premium")`
  - Overrides the `model` and `api_key` parameters if provided

- **`exports`**: Dictionary of traits this widget exposes
  - Keys: trait names
  - Values: descriptions of what the trait contains
  - Example: `{"selected_indices": "list of selected point indices"}`

- **`imports`**: Dictionary of traits this widget imports
  - Keys: trait names
  - Values: source widget or trait reference
  - Example: `{"selected_indices": scatter_widget}`

**Returns:** `VibeWidget` instance (Jupyter widget) that displays immediately

---

### Model Configuration

Vibe Widget supports multiple AI providers. You can configure models in several ways:

```python
import vibe_widget as vw

# Method 1: Global configuration
vw.config(model="gemini", mode="standard")  # Use Gemini Flash (fast/cheap)
vw.config(model="openai", mode="premium")   # Use GPT-5 (powerful/expensive)

# Method 2: Per-widget configuration
config = vw.Config(model="anthropic", mode="premium")
widget = vw.create("your visualization", df, config=config)

# Method 3: Direct model specification
widget = vw.create("your visualization", df, model="claude-3-5-sonnet")

# See available models
all_models = vw.models()                    # All providers and models
gemini_models = vw.models("gemini")         # Just Gemini models
premium_models = vw.models(mode="premium")  # All premium tier models
```

**Modes:**
- `"standard"`: Fast, cost-effective models (default)
- `"premium"`: Most capable, higher-cost models

---

## 🧪 Examples & Tutorials

Check out these notebooks to see Vibe Widget in action:

1. **[`examples/pdf_and_web_extraction.ipynb`](examples/pdf_and_web_extraction.ipynb)**
   - Extract and visualize PDF tables
   - Scrape and display web content
   - Multi-format data handling

2. **[`examples/cross_widget_interactions.ipynb`](examples/cross_widget_interactions.ipynb)**
   - Linked scatter plot and histogram
   - 3D terrain painter with live rendering
   - Interactive solar system with data highlighting
   - AI game with decision tree visualization

3. **[`tests/test_agentic_demo.ipynb`](tests/test_agentic_demo.ipynb)**
   - Comprehensive test suite
   - All data formats
   - Edge cases and error handling

---

## 🏗️ Architecture

```
User Input (natural language + data)
          ↓
    DataProcessor (detects format, extracts data)
          ↓
    AgenticOrchestrator (LLM-based code generation)
          ↓
    Tools: CodeValidator, RuntimeTester, ErrorDiagnose
          ↓
    WidgetStore (caching & versioning)
          ↓
    VibeWidget (rendered in Jupyter)
```

**Key Components:**

- **`DataProcessor`**: Universal data loader supporting 10+ formats
- **`AgenticOrchestrator`**: Claude-powered code generation with validation
- **`WidgetStore`**: Intelligent caching with version control
- **`VibeWidget`**: Jupyter widget wrapper with state management

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

```bash
# Clone the repo
git clone https://github.com/yourusername/vibe-widget.git
cd vibe-widget

# Install with dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Lint and format
ruff check .
ruff format .
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- Powered by [Claude](https://www.anthropic.com/claude) (Anthropic)
- Built on [anywidget](https://github.com/manzt/anywidget) and [ipywidgets](https://ipywidgets.readthedocs.io/)
- Inspired by the vision of natural language programming

---

## 🔗 Links

- **Documentation**: [GitHub README](https://github.com/yourusername/vibe-widget#readme)
- **Issues**: [GitHub Issues](https://github.com/yourusername/vibe-widget/issues)
- **Examples**: [Jupyter Notebooks](examples/)

---

<div align="center">

**Made with ❤️ and Claude AI**

[⭐ Star on GitHub](https://github.com/yourusername/vibe-widget) | [📖 Documentation](https://www.dylanwootton.com/vibe-widgets/index.html) | [🐛 Report Bug](https://github.com/yourusername/vibe-widget/issues)

</div>
