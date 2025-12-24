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
  Save widgets as `.vw` bundles and load them elsewhere—with review + audit on load by default.

- **Run where your data lives**  
  Works in Jupyter/JupyterLab, Colab, VS Code notebooks, marimo, and more (via AnyWidget + React).

## Quickstart

```bash
pip install vibe-widget
export OPENROUTER_API_KEY="your-key"
```

```python
import pandas as pd
import vibe_widget as vw

df = pd.read_csv("sales.csv")

widget = vw.create("scatter plot with brush selection and a linked histogram", df)
widget()
```
## Acknowledgements
This repo was originally created at the [Sundai](https://www.sundai.club/) Weird Data Hack. We thank [Angela](https://github.com/ang101) for her feedback and suggestions on early versions!

Special thanks to [Trevor Manz](https://github.com/manzt) and the Anywidget project for providing the specification and foundation that made this project possible. 
 Be sure to check out and star [AnyWidget](https://github.com/manzt/anywidget)!
