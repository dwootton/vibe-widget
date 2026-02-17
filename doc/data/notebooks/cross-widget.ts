import type { NotebookCell, NotebookSpec } from "./types";

const cells: NotebookCell[] = [
  {
    type: "markdown",
    content: `
      <h2>Cross-Widget Interactions</h2>
      <p class="text-lg text-slate/70">
        This demo shows how widgets can communicate with each other. 
        Select points in the scatter plot and watch the bar chart update automatically!
      </p>
    `,
  },
  {
    type: "code",
    content: `import vibe_widget as vw
import pandas as pd

vw.models()`,
    defaultCollapsed: true,
    label: "Setup",
  },
  {
    type: "code",
    content: `# Configure (demo mode - no actual LLM calls)
vw.config(
    model="google/gemini-3-flash-preview",
    api_key="demo-key"
)`,
    defaultCollapsed: true,
    label: "Config",
  },
  {
    type: "code",
    content: `# Load Seattle weather data
# (data is pre-loaded from /testdata/seattle-weather.csv)
print(f"Weather data loaded: {len(data)} rows")
print(f"Columns: {list(data.columns)}")
data.head(3)`,
    defaultCollapsed: true,
    label: "Load Data",
  },
  {
    type: "markdown",
    content: `
      <h3>Widget 1: Scatter Plot with Brush Selection</h3>
      <p>
        This widget <strong>outputs</strong> <code>selected_indices</code> - 
        when you brush-select points, it updates the shared variable.
      </p>
    `,
    defaultCollapsed: true,
  },
  {
    type: "code",
    content: `# Create scatter plot that outputs selected indices
scatter = vw.create(
    description="temperature across days in Seattle, colored by weather condition",
    data=data,
    outputs=vw.outputs(
        selected_indices="List of selected point indices"
    ),
)

scatter`,
    label: "Scatter Plot",
  },
  {
    type: "markdown",
    content: `
      <h3>Widget 2: Bar Chart (Linked)</h3>
      <p>
        This widget <strong>inputs</strong> <code>selected_indices</code> from the scatter plot.
        When the selection changes, it automatically updates to show filtered counts.
      </p>
    `,
    defaultCollapsed: true,
  },
  {
    type: "code",
    content: `# Create bar chart that inputs selected_indices
bars = vw.create(
    "horizontal bar chart of weather conditions' count for selected points",
    vw.inputs(
        data,
        selected_indices=scatter.outputs.selected_indices
    ),
)

bars`,
    label: "Bar Chart",
  },
  {
    type: "markdown",
    content: `
      <h3>How It Works</h3>
      <pre class="bg-material-dark/5 p-4 rounded-lg overflow-x-auto"><code class="text-sm"># Widget A outputs a trait
scatter = vw.create(
    ...,
    outputs=vw.outputs(
        selected_indices="description"
    )
)

# Widget B inputs that trait
bars = vw.create(
    ...,
    vw.inputs(
        df,
        selected_indices=scatter.outputs.selected_indices
    )
)
    </code></pre>
      <p class="mt-4">
        Vibe Widget automatically creates bidirectional links using traitlets,
        so changes flow between widgets in real-time!
      </p>
    `,
    defaultCollapsed: true,
  },
];

export const crossWidget: NotebookSpec = {
  cells,
  dataFiles: [{ url: "/testdata/seattle-weather.csv", varName: "data", type: "csv" }],
};
