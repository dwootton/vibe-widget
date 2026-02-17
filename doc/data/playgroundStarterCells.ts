export interface PlaygroundCell {
  id: string;
  type: "code" | "markdown";
  content: string;
}

let cellIdCounter = 0;

export function nextCellId(): string {
  return `cell-${++cellIdCounter}-${Date.now()}`;
}

export const STARTER_CELLS: PlaygroundCell[] = [
  {
    id: nextCellId(),
    type: "markdown",
    content:
      '<h2>Vibe Widget Playground</h2>\n<p>Write Python below and press <strong>Shift + Enter</strong> to run a cell. <code>vibe_widget</code>, <code>pandas</code>, and <code>numpy</code> are pre-installed.</p>\n<p>Add your <a href="https://openrouter.ai/keys" target="_blank">OpenRouter API key</a> to generate widgets live, or leave it blank to use pre-generated examples.</p>',
  },
  {
    id: nextCellId(),
    type: "code",
    content: `import vibe_widget as vw
import pandas as pd
import numpy as np

# Add your OpenRouter API key to enable live widget generation
vw.config(
    model="google/gemini-2.5-flash",
    api_key="",  # paste your OpenRouter key here or set OPENROUTER_API_KEY env
)`,
  },
  {
    id: nextCellId(),
    type: "code",
    content: `scatter = vw.create(
  "interactive scatter plot of x and y", 
  data=pd.DataFrame({"x": range(1000), "y": [v**2 for v in range(1000)], "category": ["A"] * 200 + ["B"] * 200 + ["C"] * 200 + ["D"] * 200 + ["E"] * 200}),
  outputs=vw.outputs(
    selected_indices="indices of selected points"
  )
)
scatter`,
  },
  {
    id: nextCellId(),
    type: "code",
    content: `histogram = vw.create(
  "histogram of y values",
  data=pd.DataFrame({"y": [v**2 for v in range(1000)]}),
  inputs=vw.inputs(
    selected_indices=scatter.outputs.selected_indices
  )
)
histogram`,
  },
];
