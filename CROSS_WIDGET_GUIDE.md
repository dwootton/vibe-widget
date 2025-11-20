# Cross-Widget Interactions with Vibe-Widget

## Overview

Vibe-Widget now supports **cross-widget interactions** using traitlets synchronization. This allows you to create connected visualizations where user interactions in one widget automatically update another widget in real-time.

## Key Concepts

### Exports
When a widget **exports** a trait, it makes that state available for other widgets to consume. Think of exports as the widget's "output" that other widgets can listen to.

```python
scatter = vw.create(
    "scatter plot with brush selection",
    data=flights_df,
    exports={
        "selected_indices": "list of indices selected by brush"
    }
)
```

### Imports  
When a widget **imports** a trait, it consumes state from another widget and reacts to changes. Think of imports as the widget's "input" from other widgets.

```python
histogram = vw.create(
    "histogram filtered by selection",
    data=flights_df,
    imports={
        "selected_indices": scatter.selected_indices
    }
)
```

### Automatic Linking
Vibe-Widget automatically creates **bidirectional links** between widgets using `traitlets.link()`. When you specify an import, the widgets are linked so changes propagate automatically.

## Usage Patterns

### Pattern 1: Filter Flow (Scatter → Histogram)

Create a scatter plot with brush selection that filters a histogram:

```python
# Step 1: Create scatter plot that exports selected_indices
scatter = vw.create(
    "scatter plot showing flight delays vs distance, with brush selection",
    data=df,
    exports={
        "selected_indices": "list of indices selected by brush"
    }
)

# Step 2: Create histogram that imports selected_indices
histogram = vw.create(
    "histogram of flight delays, filtered by selection from scatter plot",
    data=df,
    imports={
        "selected_indices": scatter.selected_indices
    }
)

# Now when you brush in the scatter plot, the histogram automatically updates!
```

### Pattern 2: Painter/Viewer (2D Canvas → 3D Scene)

Paint terrain on a 2D canvas and visualize it in 3D:

```python
# Step 1: Create 2D painter that exports heightmap
painter = vw.create(
    "2D canvas for painting terrain height with mouse brush, stores 64x64 grid",
    data=None,
    exports={
        "heightmap": "64x64 grid of float values 0-1 representing terrain height"
    }
)

# Step 2: Create 3D viewer that imports heightmap
landscape = vw.create(
    "3D landscape viewer with Three.js showing terrain mesh and water plane",
    data=None,
    imports={
        "heightmap": painter.heightmap
    }
)

# Drawing on the 2D canvas updates the 3D landscape in real-time!
```

### Pattern 3: Click-to-Highlight (3D Scene → Chart)

Click planets in a 3D solar system to highlight them in a chart:

```python
# Step 1: Create 3D solar system that exports selected planet
solar_system = vw.create(
    "3D solar system with clickable planets",
    data=planets_df,
    exports={
        "selected_planet": "name of the clicked planet"
    }
)

# Step 2: Create chart that imports selected planet
planet_chart = vw.create(
    "bar chart showing planet properties, highlight selected planet",
    data=planets_df,
    imports={
        "selected_planet": solar_system.selected_planet
    }
)

# Clicking a planet in 3D highlights its bar in the chart!
```

### Pattern 4: Multiple Imports

A widget can import from multiple sources:

```python
# Create two independent filter widgets
scatter = vw.create(
    "scatter with brush selection",
    data=flights_df,
    exports={"selected_indices": "brush selection"}
)

airline_filter = vw.create(
    "dropdown to select airlines",
    data=flights_df,
    exports={"selected_airlines": "array of airline codes"}
)

# Create a combined view that uses both filters
combined_view = vw.create(
    "table filtered by both brush selection AND selected airlines",
    data=flights_df,
    imports={
        "selected_indices": scatter.selected_indices,
        "selected_airlines": airline_filter.selected_airlines
    }
)
```

## Programmatic Access

You can also read and write exported traits from Python:

```python
# Read current selection
print(f"Selected: {scatter.selected_indices}")

# Set selection programmatically
scatter.selected_indices = [0, 1, 2, 5, 10]

# This will trigger updates in all linked widgets!
```

## How It Works

### Under the Hood

1. **Dynamic Traitlet Creation**: When you specify `exports`, Vibe-Widget dynamically creates traitlets on the widget class with `sync=True`, enabling Python ↔ JavaScript synchronization.

2. **Enhanced Prompts**: The LLM prompt is augmented with:
   - Export specifications (what state to expose)
   - Import specifications (what state to consume)
   - Code examples showing how to use `model.set()`, `model.save_changes()`, and `model.on("change:...")`

3. **Automatic Linking**: When you specify `imports`, Vibe-Widget uses `traitlets.link()` to create bidirectional connections between widgets.

### JavaScript Side

The generated widget code uses anywidget's traitlet API:

```javascript
// Exporting state
function render({ model, el }) {
  // Initialize export
  model.set("selected_indices", []);
  model.save_changes();
  
  // Update on interaction
  brush.on("end", (event) => {
    const selected = [...]; // Calculate selection
    model.set("selected_indices", selected);
    model.save_changes();
  });
}
```

```javascript
// Importing state
function render({ model, el }) {
  function update() {
    const selectedIndices = model.get("selected_indices") || [];
    // Update visualization based on imported state
  }
  
  // Initial render
  update();
  
  // Listen for changes
  model.on("change:selected_indices", update);
}
```