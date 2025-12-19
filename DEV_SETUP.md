# Developer Setup Guide

## Installation

```bash
npm install
```

This installs:
- `esbuild` - Fast JavaScript bundler
- `codemirror` + extensions - Code editor for the Source Viewer

## Build System

### Current Architecture

The project uses **esbuild** to bundle the React widget wrapper:

```bash
npm run build-app-wrapper
```

This bundles `src/vibe_widget/AppWrapper/AppWrapper.js` → `AppWrapper.bundle.js`

### Why Bundle?

**anywidget** requires JavaScript to be embedded in the Python package. We bundle for:
1. **Dependency resolution** - Imports are resolved at build time
2. **Code transformation** - Modern JS → browser-compatible JS
3. **Size optimization** - Minification and tree-shaking
4. **Self-contained widgets** - No runtime dependency resolution needed

### React: Bundled with npm

**Current approach:** React is bundled from npm packages:

```javascript
import * as React from "react";
import { createRoot } from "react-dom/client";
import htm from "htm";
```

**Why we bundle React:**
- ✅ Self-contained widgets (no internet required)
- ✅ Version pinning and predictability
- ✅ Consistent with CodeMirror bundling
- ✅ ~2MB bundle size is acceptable for modern use

The bundle includes React 19, ReactDOM, and htm. Other libraries (if needed) can still use ESM.sh, but core dependencies are bundled for reliability.

## Why anywidget?

[anywidget](https://anywidget.dev/) lets you create Jupyter widgets with just JavaScript (no Python-JS glue code). Key benefits:

1. **Simple architecture** - Define `render({ model, el })` function
2. **Traitlets sync** - Python ↔ JavaScript state sync automatic
3. **Works everywhere** - JupyterLab, VS Code, Google Colab, etc.
4. **No webpack config** - Just bundle your JS and pass to widget

Our widget code lives in `core.py`:

```python
class VibeWidget(anywidget.AnyWidget):
    _esm = Path("AppWrapper.bundle.js").read_text()
```

The bundle must export `{ render }` - anywidget calls this when displaying the widget.

## Development Workflow

### 1. Watch Mode (Recommended)

```bash
npm run watch-app-wrapper
```

Auto-rebuilds on file changes. Open a notebook and refresh the cell to see updates.

### 2. Manual Build

```bash
npm run build-app-wrapper
```

Run this before committing changes.

### 3. Test in Jupyter

```python
import vibe_widget as vw
widget = vw.create("test widget", df)
```

If you modify the JavaScript, restart the kernel to reload the bundle.

## CodeMirror Dependencies

CodeMirror is bundled (not external) because:
1. **Source viewer needs it** - Used in the audit UI
2. **Specific version pinning** - We need exact versions of extensions
3. **Bundle size acceptable** - Tree-shaking removes unused code

## Architecture Decision Summary

| Dependency | Approach | Reason |
|------------|----------|--------|
| React/ReactDOM | npm bundled | Self-contained, version pinned, reliable |
| htm | npm bundled | Small size, bundled with React |
| CodeMirror | npm bundled | Specific extensions needed |
| esbuild | dev dependency | Build tool only |

**Bundle size:** ~2.0MB (includes React 19, ReactDOM, htm, CodeMirror)

## Build Troubleshooting

**Bundle not updating?**
- Restart Jupyter kernel (bundles are cached in memory)
- Check file permissions on `AppWrapper.bundle.js`

**Import errors?**
- Verify all imports have matching npm packages OR are marked external
- Check esbuild output for warnings

**Size concerns?**
- Current bundle is ~2MB (includes React, CodeMirror)
- For production, add `--minify` flag to reduce size
- This is acceptable for most Jupyter notebook use cases

## Future Improvements

1. **Add TypeScript** - Type safety for complex components
2. **Hot reload** - Faster development cycle
3. **Source maps** - Better debugging experience
4. **Minification** - Add `--minify` flag for production builds
