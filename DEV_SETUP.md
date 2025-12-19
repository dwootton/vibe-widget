# Developer Setup Guide

## Install

```bash
npm install
```

Installs build tooling (**esbuild**) and editor deps (**CodeMirror** + extensions).

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

Notes:

* After JS changes, **restart the kernel** (the bundle is cached).
* In watch mode, refresh/re-run the cell to pick up the rebuilt bundle.

## How anywidget loads the bundle

`VibeWidget` embeds the bundle and anywidget calls the bundle’s exported `render`:

```python
class VibeWidget(anywidget.AnyWidget):
    _esm = Path("AppWrapper.bundle.js").read_text()
```

## Troubleshooting

* **Bundle not updating:** restart kernel; verify `AppWrapper.bundle.js` is being rebuilt.
* **Import errors:** ensure deps are installed and esbuild output has no unresolved imports.
