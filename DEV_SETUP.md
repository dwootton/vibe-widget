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

### React: ESM vs npm (Current Debate)

**Current approach:** React is imported via ESM CDN and marked as external:

```javascript
import * as React from "https://esm.sh/react@18";
// esbuild flag: --external:https://esm.sh/react@18
```

**Why ESM was chosen:**
- ✅ Smaller bundle size (~130KB saved)
- ✅ Browser caching across widgets
- ✅ Common pattern in anywidget examples

**Why this might be wrong:**
- ❌ Requires internet connection
- ❌ Version unpredictability (esm.sh could change)
- ❌ Inconsistent with CodeMirror (which IS bundled)
- ❌ We already have a build process!

**Recommended fix:**

```bash
# Install React as npm dependencies
npm install react react-dom htm

# Update package.json build script to remove externals:
"build-app-wrapper": "esbuild src/vibe_widget/AppWrapper/AppWrapper.js --bundle --format=esm --platform=browser --target=es2020 --outfile=src/vibe_widget/AppWrapper.bundle.js"

# Update imports in AppWrapper.js:
import * as React from "react";
import { createRoot } from "react-dom/client";
import htm from "htm";
```

This makes the widget fully self-contained with no external runtime dependencies.

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

| Dependency | Current | Recommended | Reason |
|------------|---------|-------------|--------|
| React/ReactDOM | ESM CDN | npm bundled | Consistency, reliability |
| htm | ESM CDN | npm bundled | Small size, bundle it |
| CodeMirror | npm bundled | npm bundled | ✅ Correct |
| esbuild | dev dependency | dev dependency | ✅ Correct |

## Build Troubleshooting

**Bundle not updating?**
- Restart Jupyter kernel (bundles are cached in memory)
- Check file permissions on `AppWrapper.bundle.js`

**Import errors?**
- Verify all imports have matching npm packages OR are marked external
- Check esbuild output for warnings

**Size concerns?**
- Bundling React adds ~130KB
- This is negligible for most use cases
- If size matters, consider splitting into multiple widgets

## Future Improvements

1. **Bundle React locally** - Remove ESM.sh dependency
2. **Add TypeScript** - Type safety for complex components
3. **Hot reload** - Faster development cycle
4. **Source maps** - Better debugging experience
