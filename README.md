<div align="center">
  <img src="logo.svg" alt="Vibe Widget" width="400">
</div>

# Vibe Widget

**Notebook widgets generated from a prompt and your data.**

![Python Version](https://img.shields.io/badge/python-3.9%2B-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Provider](https://img.shields.io/badge/LLM-OpenRouter-blueviolet)
![PyPI - Version](https://img.shields.io/pypi/v/vibe-widget)
![PyPI - Downloads](https://img.shields.io/pypi/dm/vibe-widget)


You describe the interface you want in plain English, and a model writes the JavaScript that draws it in your notebook. You get sliders, linked views, filters and custom controls without writing front end code yourself.

[Checkout the docs!](https://vibewidget.dev)

## What it does

- **Generates a widget from a prompt.**  
  Describe the interface and the data, and the generated widget renders in the next cell.

- **Revises what already exists.**  
  Ask for a change in plain language, run an audit to have the code reviewed, and turn on approve mode when you want to read the code before it runs.

- **Stores widgets so they can be shared.**  
  Generated code is written into your project and can be committed to git, or saved as a single `.vw` file. Loading a file asks for approval by default.

- **Runs in the common notebook hosts.**  
  Jupyter and JupyterLab, VS Code notebooks, Positron, Google Colab, Quarto, and JupyterLite, built on AnyWidget and React.

## Quickstart

```bash
pip install vibe-widget
```

Put **any one** of these in a `.env` file next to your notebook:

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
```

```python
import pandas as pd
import vibe_widget as vw

df = pd.read_csv("sales.csv")

widget = vw.create("scatter plot with brush selection and a linked histogram", df)
widget()
```

Nothing else needs to be set. Vibe Widget reads the `.env` file, picks the provider matching the variable name, and uses that provider's default model. Exporting the variable in your shell works the same way, and an exported value wins over the file.

## Any OpenAI-compatible endpoint

The key you set decides the endpoint. Point `base_url` somewhere else to override it, including at a local server.

```python
vw.config(base_url="http://localhost:11434/v1", model="qwen2.5-coder")
vw.config(model="claude-sonnet-5")   # keeps the provider your key selected
```

`VIBE_API_KEY` with `VIBE_BASE_URL` covers any endpoint that has no dedicated variable, such as vLLM or Azure OpenAI. `vw.config()` prints the provider, host, model and where the key came from, never the key itself.

## Data privacy

Prompts include a summary of the data you pass in: shape, column names, dtypes, null counts, cardinality, and numeric ranges. By default the summary also carries the first 3 rows so the model can see the shape of real values.

```python
vw.config(data_privacy="schema")   # send no cell values at all
vw.config(sample_rows=1)           # or send fewer rows
```

## Share widgets with git

Generated widgets are written to `.vibewidget/widgets/` as one `.js` file plus a `.json` sidecar holding the prompt, model, and input signature. Filenames are deterministic, so regenerating the same widget rewrites the same file instead of piling up copies. Both files are meant to be committed. A `.vibewidget/.gitignore` is created for you and excludes the derived caches (`bundles/`, `packages/`, `sandbox/`, `audits/`).

A teammate who clones the repo gets the widget without spending a model call, and without needing an API key at all, because loading stored code calls no model:

```python
widget = vw.load(".vibewidget/widgets/sales_chart__a1b2c3d4e5.js")
```

For sharing outside a repo, `widget.save("sales_chart.vw")` writes a single portable bundle, and `widget.save(path, include_inputs=True)` embeds the current input values with it.

## Examples

`examples/` holds four notebooks that run from a clone with no API key, because the generated code
is committed with them in `examples/.vibewidget/`.

| Notebook | What is in it |
| --- | --- |
| `analysis_spaces.ipynb` | One sea-ice table read three ways: a brush that states a `WHERE` clause, a threshold line shared across fourteen facets, and a residual band over a fit computed in numpy. |
| `instruments.ipynb` | Twelve widgets shaped like the question a domain expert asks, four of them pairs where the second widget takes its inputs from the first. |
| `donut_hunt.ipynb` | One routing question carried through a chain of `edit` calls, ending with a second widget that listens to the first. |
| `terrain_erosion.ipynb` | A painted heightmap that Python erodes and a 3D view that follows it. |

The notebooks pass `theme="minimal"`, which resolves to `examples/.vibewidget/themes/minimal.json`,
so regenerating a widget uses the same description it was written under.

## Acknowledgements
The repository was originally created at the [Sundai](https://www.sundai.club/) Weird Data Hack. We thank [Angela](https://github.com/ang101) for her feedback and suggestions on early versions!

Special thanks to [Trevor Manz](https://github.com/manzt) and the Anywidget project for providing the specification and foundation that made this project possible. 
 Be sure to check out and star [AnyWidget](https://github.com/manzt/anywidget)!
