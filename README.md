# Vibe Widget

Create interactive visualizations using natural language and LLMs.

## Installation

```bash
pip install vibe-widget
```

Or with `uv`:

```bash
uv pip install vibe-widget
```

## Quick Start

```python
import pandas as pd
import vibe_widget as vw

df = pd.DataFrame({
    'height': [150, 160, 170, 180, 190],
    'weight': [50, 60, 70, 80, 90]
})

vw.create("an interactive scatterplot of height and weight", df)
```

This will:
1. Analyze your data structure
2. Generate a React component via Claude API
3. Return an HTML file with the interactive visualization

## API Key Setup

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY='your-api-key-here'
```

Or pass it directly:

```python
vw.create(
    "a bar chart of sales by region", 
    df, 
    api_key="your-api-key-here"
)
```

## Saving to File

```python
vw.create(
    "an interactive line chart showing trends over time",
    df,
    output_path="output/visualization.html"
)
```

## Development

Install with dev dependencies:

```bash
pip install -e ".[dev]"
```

Run tests:

```bash
pytest
```

Lint and format:

```bash
ruff check .
ruff format .
```

Type checking:

```bash
mypy src/
```

## Features

- 🚀 Modern Python packaging (pyproject.toml, src layout)
- 🤖 LLM-powered visualization generation
- ⚛️ React-based interactive widgets
- 📊 Pandas DataFrame integration
- 🔧 Extensible LLM provider system
- 🔗 **NEW:** Cross-widget interactions with exports/imports (see [CROSS_WIDGET_GUIDE.md](CROSS_WIDGET_GUIDE.md))

## Cross-Widget Interactions

Create connected visualizations where interactions in one widget update another:

```python
# Create scatter plot with brush selection
scatter = vw.create(
    "scatter plot with brush selection",
    data=df,
    exports={"selected_indices": "list of selected point indices"}
)

# Create histogram that responds to selection
histogram = vw.create(
    "histogram filtered by selection",
    data=df,
    imports={"selected_indices": scatter.selected_indices}
)

# Now brushing in the scatter plot automatically updates the histogram!
```

See [CROSS_WIDGET_GUIDE.md](CROSS_WIDGET_GUIDE.md) for complete documentation and examples.

## License

MIT
