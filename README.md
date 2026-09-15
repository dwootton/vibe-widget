<div align="center">
  <img src="logo.svg" alt="Vibe Widget" width="400">
</div>

# Vibe Widget

**Make analysis interactive.**

![Python Version](https://img.shields.io/badge/python-3.9%2B-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Provider](https://img.shields.io/badge/LLM-OpenRouter-blueviolet)
![PyPI - Version](https://img.shields.io/pypi/v/vibe-widget)
![PyPI - Downloads](https://img.shields.io/pypi/dm/vibe-widget)


Vibe Widget generates *interactive notebook interfaces* from plain English. Explore data with sliders, linked views, filters, and custom controls without building a front end.

[Checkout the docs!](https://vibewidget.dev)

## What you can do

- **Create widgets from a prompt**  
  Describe the interface you want and get a working widget immediately.

- **Iterate safely**  
  Revise in plain language, use built-in audits, and (optionally) require approval before any generated code runs.

- **Share reusable widgets**  
  Commit generated widgets to git, or save them as `.vw` bundles and load them elsewhere. Loading requires approval by default.

- **Run where your data lives**  
  Works in Jupyter/JupyterLab, Colab, VS Code notebooks, marimo, and more (via AnyWidget + React).

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

That is the whole setup. Vibe Widget finds the `.env` file, picks the provider that matches the key you supplied, and chooses a default model for it. Exporting the variable in your shell works the same way and takes precedence over the file.

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

A teammate who clones the repo gets the widget without spending a model call:

```python
widget = vw.load(".vibewidget/widgets/sales_chart__a1b2c3d4e5.js")
```

For sharing outside a repo, `widget.save("sales_chart.vw")` writes a single portable bundle, and `widget.save(path, include_inputs=True)` embeds the current input values with it.

## Acknowledgements
This repo was originally created at the [Sundai](https://www.sundai.club/) Weird Data Hack. We thank [Angela](https://github.com/ang101) for her feedback and suggestions on early versions!

Special thanks to [Trevor Manz](https://github.com/manzt) and the Anywidget project for providing the specification and foundation that made this project possible. 
 Be sure to check out and star [AnyWidget](https://github.com/manzt/anywidget)!
