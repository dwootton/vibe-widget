# Developer Setup Guide

## Install (JS deps)

```bash
npm install
```

Installs **esbuild** (bundler) and **CodeMirror** (+ extensions).

## Install the Python package (local)

From the repo root (with `pyproject.toml`):

```bash
python -m pip install -e .
```

Now imports resolve to your working tree:

```python
import vibe_widget
```

## Build the widget bundle

anywidget loads a single JS bundle embedded in the Python package.

**Build once:**

```bash
npm run build-app-wrapper
```

**Watch mode (recommended):**

```bash
npm run watch-app-wrapper
```

Build output:

* `src/vibe_widget/AppWrapper/AppWrapper.js` → `AppWrapper.bundle.js`

## Run in Jupyter

```python
import vibe_widget as vw
w = vw.create("test widget", df)
w
```

## Tests

Run the full test suite:

```bash
pytest
```

Run the example-flow integration tests:

```bash
pytest -k "example_flows or tic_tac_toe_actions"
```

Optional suites:

```bash
RUN_PERF=1 pytest -m performance
RUN_E2E=1 pytest -m e2e
```

Notes:
* Most tests use a mocked LLM provider and do not hit the network.
* E2E tests require `OPENROUTER_API_KEY` (loaded from `.env` if present).

### After JS changes

1. Rebuild (`build-app-wrapper` or watch)
2. **Restart the Jupyter kernel** (the bundle is cached)

## How anywidget loads the bundle

`VibeWidget` embeds the bundle and anywidget calls the bundle’s exported `render`:

```python
class VibeWidget(anywidget.AnyWidget):
    _esm = Path("AppWrapper.bundle.js").read_text()
```

## Troubleshooting

* **Import not found:** you didn’t run `pip install -e .` from repo root, or you’re in a different env.
* **Wrong env:** verify `python -m pip -V` points to the same Python you use in Jupyter.
* **Bundle not updating:** rebuild succeeded but you didn’t restart the kernel.
