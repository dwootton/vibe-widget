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
    api_key="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"  # paste your OpenRouter key here
)`,
  },
  {
    id: nextCellId(),
    type: "code",
    content: `scatter = vw.create(
  "interactive scatter plot of x and y", 
  data=pd.DataFrame({"x": range(20), "y": [v**2 for v in range(20)]}),
  outputs=vw.outputs(
    x="x values selected",
    y="y values selected"
  )
)
scatter`,
  },
  {
    id: nextCellId(),
    type: "code",
    content: `scatter.outputs.x.value
scatter.outputs.y.value`,
  },
  {
    id: nextCellId(),
    type: "code",
    content: `barchart = vw.create(
  "horizontal bar chart of y values",
  data=pd.DataFrame({"y": [v**2 for v in range(20)]}),
  inputs=vw.inputs(
    x=scatter.outputs.x.value
  )
)
barchart`,
  },
];
