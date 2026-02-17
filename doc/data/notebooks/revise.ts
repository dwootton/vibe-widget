import type { NotebookCell, NotebookSpec } from "./types";

const cells: NotebookCell[] = [
  {
    type: "markdown",
    content: `
      <h2>Widget Editing Demo</h2>
      <p class="text-lg text-slate/70">
        Start with a basic chart, then refine it iteratively using <code>vw.edit()</code>.
        Watch how we add interactive features step by step!
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
    content: `# Configure (demo mode)
vw.config(
    model="google/gemini-3-flash-preview",
    api_key="demo-key"
)`,
    defaultCollapsed: true,
    label: "Config",
  },
  {
    type: "code",
    content: `# Load COVID-19 data
print(f"COVID-19 data loaded: {len(covid_df)} days")
print(f"Columns: {list(covid_df.columns)}")
covid_df.head(3)`,
    defaultCollapsed: true,
    label: "Load Data",
  },
  {
    type: "markdown",
    content: `
      <h3>Step 1: Basic Line Chart</h3>
      <p>Create a simple line chart showing COVID-19 trends over time.</p>
    `,
  },
  {
    type: "code",
    content: `# Create basic line chart
timeline = vw.create(
    "line chart showing confirmed, deaths, recovered over time",
    data=covid_df
)

timeline`,
    label: "Basic Chart",
  },
  {
    type: "markdown",
    content: `
      <h3>Step 2: Add Interactive Hover</h3>
      <p>Use <code>vw.edit()</code> to add a vertical dashed line when hovering.</p>
    `,
  },
  {
    type: "code",
    content: `# Edit to add interactive hover crosshair
timeline_v2 = vw.edit(
    "add vertical dashed line when user hovering, highlight crossed data points",
    timeline,
    data=covid_df
)

timeline_v2`,
    label: "Enhanced Chart",
  },
  {
    type: "markdown",
    content: `
      <h3>How Editing Works</h3>
      <pre class="bg-slate/5 p-4 rounded-lg overflow-x-auto text-sm"><code># Create initial widget
chart = vw.create("scatter plot of data", df)

# Refine it with edit()
chart_v2 = vw.edit(
    "add hover tooltips and color by category",
    chart,  # Pass the original widget
    data=df  # Optionally pass updated data
)

# Keep refining!
chart_v3 = vw.edit(
    "add zoom and pan controls",
    chart_v2
)
      </code></pre>
      <p class="mt-4">
        Each edit builds on the previous version, maintaining context
        while adding new features. This allows for rapid iterative development!
      </p>
    `,
    defaultCollapsed: true,
  },
];

export const revise: NotebookSpec = {
  cells,
  dataFiles: [{ url: "/testdata/day_wise.csv", varName: "covid_df", type: "csv" }],
};
