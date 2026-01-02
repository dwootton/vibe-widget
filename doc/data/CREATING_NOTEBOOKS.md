# Creating Pyodide Notebook Examples

This guide explains how to create new interactive notebook examples for the documentation site.

## Overview

The Pyodide-powered notebooks allow users to run Python code directly in the browser. Each notebook consists of:
- **Cells**: Markdown or Python code cells
- **Data Files**: CSV/JSON files loaded into Python namespace
- **Widgets**: Pre-generated JavaScript widget files for visualization

## Notebook JSON Schema

Each notebook is defined in a JSON file in `doc/data/notebooks/`. Here's the schema:

```json
{
  "id": "unique-notebook-id",
  "title": "Human-Readable Title",
  "description": "Short description of what this notebook demonstrates.",
  "widgets": {
    "widget_name": {
      "url": "/widgets/widget_file_name.js",
      "match": ["keyword1", "keyword2", "keyword3"]
    }
  },
  "dataFiles": [
    {
      "url": "/testdata/data_file.csv",
      "varName": "df"
    }
  ],
  "cells": [
    {
      "type": "markdown",
      "content": "<h2>Title</h2><p>Description</p>"
    },
    {
      "type": "code",
      "content": "import vibe_widget as vw\nimport pandas as pd\n\nvw.config(model=\"google/gemini-3-flash-preview\", api_key=\"demo\")",
      "defaultCollapsed": true,
      "label": "Setup"
    }
  ]
}
```

### Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (used in URL routes) |
| `title` | string | Yes | Human-readable title |
| `description` | string | Yes | Short description |
| `widgets` | object | Yes | Widget configurations (can be empty `{}`) |
| `dataFiles` | array | Yes | Data files to load (can be empty `[]`) |
| `cells` | array | Yes | Notebook cells |

### Widget Configuration

Each widget in the `widgets` object has:

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Path to the pre-generated widget JS file |
| `match` | string[] | Keywords for matching `vw.create()` descriptions |

The `match` array is used by the Python `_match_widget()` function to find the right widget when `vw.create()` is called with a description. The function counts how many keywords appear in the description and selects the widget with the highest match count.

### Cell Types

**Markdown Cell:**
```json
{
  "type": "markdown",
  "content": "<h2>Title</h2><p>HTML content here</p>",
  "defaultCollapsed": false  // Optional
}
```

**Code Cell:**
```json
{
  "type": "code",
  "content": "# Python code here\nimport pandas as pd",
  "defaultCollapsed": true,   // Optional: start collapsed
  "label": "Setup",           // Optional: label shown when collapsed
  "readOnly": false           // Optional: prevent editing
}
```

## Step-by-Step Guide

### 1. Generate Widget(s)

First, use the vibe_widget library to generate your widgets. Run in a Jupyter notebook:

```python
import vibe_widget as vw

# Configure with your model
vw.config(model="google/gemini-3-flash-preview", api_key="YOUR_API_KEY")

# Create your widget
widget = vw.create(
    "Create a scatter plot showing temperature vs date for Seattle weather",
    data=df,
    outputs=vw.outputs(selected_date="date user clicks on")
)

# Save the widget
vw.save(widget, "my_scatter_widget")
```

The saved widget file will be in `~/.vibe_widget/exports/` or similar.

### 2. Copy Widget Files

Copy the generated `.js` widget file(s) to `doc/public/widgets/`:

```bash
cp my_scatter_widget.js /path/to/doc/public/widgets/
```

### 3. Copy Data Files (if needed)

If your notebook uses data files, copy them to `testdata/`:

```bash
cp my_data.csv /path/to/testdata/
```

### 4. Create Notebook JSON

Create a new file in `doc/data/notebooks/`:

```bash
touch doc/data/notebooks/my_notebook.json
```

Fill in the JSON structure:

```json
{
  "id": "my-example",
  "title": "My Example Notebook",
  "description": "Demonstrates a cool visualization",
  "widgets": {
    "my_scatter": {
      "url": "/widgets/my_scatter_widget.js",
      "match": ["scatter", "temperature", "seattle", "weather"]
    }
  },
  "dataFiles": [
    {
      "url": "/testdata/my_data.csv",
      "varName": "df"
    }
  ],
  "cells": [
    {
      "type": "markdown",
      "content": "<h2>My Example</h2><p>This example shows...</p>"
    },
    {
      "type": "code",
      "content": "import vibe_widget as vw\nimport pandas as pd\n\nvw.config(model=\"google/gemini-3-flash-preview\", api_key=\"demo\")",
      "defaultCollapsed": true,
      "label": "Setup"
    },
    {
      "type": "code",
      "content": "# Data is already loaded as 'df'\nprint(f\"Loaded {len(df)} rows\")\ndf.head()"
    },
    {
      "type": "code",
      "content": "# Create the visualization widget\nscatter = vw.create(\n    \"Create a scatter plot showing temperature vs date for Seattle weather\",\n    data=df\n)\nscatter",
      "label": "Create Widget"
    }
  ]
}
```

### 5. Register the Notebook

Add the import in `doc/data/pyodideNotebooks.ts`:

```typescript
import myNotebookData from './notebooks/my_notebook.json';
```

Add it to the notebooks array:

```typescript
const notebooks = [
  // ... existing notebooks
  myNotebookData,
] as unknown as NotebookData[];
```

The notebook will be automatically registered in `NOTEBOOK_REGISTRY` with its `id` as the key.

### 6. Add to Gallery (Optional)

To show your notebook in the gallery:

**Step 1:** Add an entry in `doc/data/examples.ts`:

```typescript
// Import your notebook for widget URL access
import myNotebook from './notebooks/my_notebook.json';

// In EXAMPLES array:
{
  id: 'my-example',
  label: 'My Example',
  description: 'A cool visualization',
  categories: ['Data Visualization'] as Category[],
  size: 'medium' as const,
  dataUrl: '/testdata/my_data.csv',
  dataType: 'csv' as const,
  moduleUrl: myNotebook.widgets.my_scatter.url,  // Get URL from notebook
}
```

**Step 2:** Add the mapping in `EXAMPLE_TO_NOTEBOOK` in `doc/pages/GalleryPage.tsx`:

```typescript
const EXAMPLE_TO_NOTEBOOK: Record<string, string> = {
    // ... existing mappings
    'my-example': 'my-example',  // maps example ID to notebook ID
};
```

## Widget Matching Tips

The `match` array should contain keywords that will appear in the `vw.create()` description. Tips:

1. **Use distinctive keywords**: Include unique words from the widget description
2. **Include multiple variations**: Add synonyms or related terms
3. **Order doesn't matter**: The matching counts all keywords equally
4. **Case-insensitive**: Keywords are matched case-insensitively

Example for a line chart with hover interaction:

```json
"widgets": {
  "line_chart": {
    "url": "/widgets/line_chart.js",
    "match": ["line", "chart", "trend", "time", "series"]
  },
  "line_chart_hover": {
    "url": "/widgets/line_chart_hover.js",
    "match": ["line", "chart", "hover", "dashed", "vertical", "tooltip"]
  }
}
```

## Reactivity and Cross-Widget Communication

For widgets that communicate with each other:

1. **Outputs**: Define what data the widget exports
2. **Inputs**: Define what data the widget consumes
3. **Observers**: Use `widget.observe()` for Python callbacks

Example:

```python
# Widget with outputs
scatter = vw.create(
    "Scatter plot",
    data=df,
    outputs=vw.outputs(selected_point="clicked data point")
)

# Widget consuming inputs
details = vw.create(
    "Show point details",
    vw.inputs(point=scatter.outputs.selected_point)
)

# Python observer for reactive updates
def on_selection(change):
    point = scatter.outputs.selected_point.value
    print(f"Selected: {point}")

scatter.observe(on_selection, names=['selected_point'])
```

## Testing Your Notebook

1. Start the dev server: `cd doc && npm run dev`
2. Navigate to your notebook page
3. Run each cell and verify:
   - Data loads correctly
   - Widgets render properly
   - Reactivity works (if applicable)
4. Check browser console for errors

## File Locations Summary

| File Type | Location |
|-----------|----------|
| Widget JS files | `doc/public/widgets/` |
| Data files | `testdata/` (copied to `doc/public/testdata/`) |
| Notebook JSON | `doc/data/notebooks/` |
| Gallery examples | `doc/data/examples.ts` |
| Notebook registry | `doc/data/pyodideNotebooks.ts` |
