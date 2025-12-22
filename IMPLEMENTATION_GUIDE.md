# Vibe Widgets - Comprehensive Implementation Guide

## Executive Summary

This document provides a detailed implementation roadmap for enhancing vibe-widgets with security features, React-grab component selection, extended API methods, persistence, and export capabilities. The architecture leverages the existing anywidget/traitlets infrastructure for bidirectional Python-JavaScript communication while introducing new patterns for component introspection and state management.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Security Features Implementation](#security-features-implementation)
3. [React-Grab Integration](#react-grab-integration)
4. [Extended vw API Methods](#extended-vw-api-methods)
5. [Persistence System](#persistence-system)
6. [Electron Export Pipeline](#electron-export-pipeline)
7. [Widget Revision System](#widget-revision-system)
8. [Implementation Timeline](#implementation-timeline)

---

## Architecture Overview

### Current State
- **Core Technology**: anywidget + traitlets for Python-JS communication
- **Widget Generation**: Claude API generates React components with htm syntax
- **State Management**: Model-based with bidirectional sync via traitlets
- **Code Storage**: Widgets saved as JS files with MD5 hash naming

### Proposed Architecture Enhancements

```
┌──────────────────────────────────────────────────┐
│                  Python Layer                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │VibeWidget  │  │StateManager│  │ Persistence│ │
│  │   Core     │◄─┤  (New)     │◄─┤   (New)    │ │
│  └────────────┘  └────────────┘  └────────────┘ │
│         ▲               ▲               ▲        │
│         │               │               │        │
│    traitlets      State Bridge    IPython Store  │
│         │               │               │        │
│         ▼               ▼               ▼        │
├──────────────────────────────────────────────────┤
│                JavaScript Layer                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │   Widget   │  │React-Grab  │  │  Security  │ │
│  │  Runtime   │◄─┤  Inspector │◄─┤  Sandbox   │ │
│  └────────────┘  └────────────┘  └────────────┘ │
└──────────────────────────────────────────────────┘
```

---

## Security Features Implementation

### 1. Content Security Policy (CSP) Integration

Create `src/vibe_widget/security.py`:

```python
class SecurityManager:
    """Manages security policies for generated widgets"""
    
    def __init__(self):
        self.csp_policies = {
            'default': "default-src 'self' https://esm.sh; script-src 'self' 'unsafe-inline' https://esm.sh; style-src 'self' 'unsafe-inline';",
            'strict': "default-src 'none'; script-src https://esm.sh; style-src 'unsafe-inline';",
            'development': "default-src *; script-src * 'unsafe-inline' 'unsafe-eval';"
        }
    
    def wrap_widget_code(self, code: str, policy: str = 'default') -> str:
        """Wrap widget code with security constraints"""
        return f"""
        // Security Policy: {policy}
        (function() {{
            'use strict';
            const securityContext = {{
                allowedAPIs: ['fetch', 'console', 'setTimeout'],
                blockedGlobals: ['eval', 'Function'],
                dataAccess: 'readonly'
            }};
            
            // Original widget code
            {code}
        }})();
        """
    
    def generate_sandbox_html(self, widget_code: str) -> str:
        """Generate sandboxed HTML for widget execution"""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta http-equiv="Content-Security-Policy" content="{self.csp_policies['default']}">
            <title>Vibe Widget (Sandboxed)</title>
        </head>
        <body>
            <div id="widget-root"></div>
            <script type="module">{widget_code}</script>
        </body>
        </html>
        """
```

### 2. Widget Permissions System

Add to `src/vibe_widget/core.py`:

```python
class WidgetPermissions:
    """Define widget access permissions"""
    
    READ_DATA = "read_data"
    WRITE_DATA = "write_data"
    NETWORK_ACCESS = "network_access"
    LOCAL_STORAGE = "local_storage"
    CLIPBOARD = "clipboard"
    
    @classmethod
    def get_default(cls):
        return [cls.READ_DATA]
    
    @classmethod
    def get_interactive(cls):
        return [cls.READ_DATA, cls.WRITE_DATA, cls.LOCAL_STORAGE]

# Add to VibeWidget.__init__
permissions = traitlets.List(WidgetPermissions.get_default()).tag(sync=True)
```

### 3. Secure Communication Channel

Implement message validation for Python-JS communication:

```python
import hmac
import hashlib
import json

class SecureChannel:
    """Secure communication between Python and JavaScript"""
    
    def __init__(self, secret_key: str = None):
        self.secret_key = secret_key or os.urandom(32).hex()
    
    def sign_message(self, message: dict) -> str:
        """Sign a message with HMAC"""
        msg_json = json.dumps(message, sort_keys=True)
        signature = hmac.new(
            self.secret_key.encode(),
            msg_json.encode(),
            hashlib.sha256
        ).hexdigest()
        return signature
    
    def verify_message(self, message: dict, signature: str) -> bool:
        """Verify message signature"""
        expected_sig = self.sign_message(message)
        return hmac.compare_digest(expected_sig, signature)
```

---

## React-Grab Integration

### 1. Component Inspector Implementation

Create `src/vibe_widget/inspector.js`:

```javascript
class ComponentInspector {
    constructor(rootElement) {
        this.root = rootElement;
        this.overlay = null;
        this.selectedElement = null;
        this.inspecting = false;
        this.componentMap = new WeakMap();
    }
    
    startInspecting() {
        this.inspecting = true;
        this.createOverlay();
        this.attachEventListeners();
    }
    
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.style.cssText = `
            position: fixed;
            pointer-events: none;
            border: 2px solid #F37726;
            background: rgba(243, 119, 38, 0.1);
            z-index: 10000;
            transition: all 0.2s ease;
        `;
        document.body.appendChild(this.overlay);
    }
    
    attachEventListeners() {
        this.root.addEventListener('mousemove', this.handleMouseMove);
        this.root.addEventListener('click', this.handleClick);
        document.addEventListener('keydown', this.handleKeyDown);
    }
    
    handleMouseMove = (e) => {
        if (!this.inspecting) return;
        
        const element = e.target;
        const rect = element.getBoundingClientRect();
        
        this.overlay.style.left = rect.left + 'px';
        this.overlay.style.top = rect.top + 'px';
        this.overlay.style.width = rect.width + 'px';
        this.overlay.style.height = rect.height + 'px';
        
        // Show component info tooltip
        this.showComponentInfo(element);
    }
    
    handleClick = (e) => {
        if (!this.inspecting) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        this.selectedElement = e.target;
        const componentData = this.extractComponentData(this.selectedElement);
        
        // Copy to clipboard
        this.copyToClipboard(componentData);
        
        // Send to Python
        this.sendToPython(componentData);
        
        this.stopInspecting();
    }
    
    extractComponentData(element) {
        // Find React Fiber
        const reactFiber = this.findReactFiber(element);
        
        if (reactFiber) {
            return {
                type: 'react_component',
                name: reactFiber.elementType?.name || 'Unknown',
                props: this.sanitizeProps(reactFiber.memoizedProps),
                state: reactFiber.memoizedState,
                hooks: this.extractHooks(reactFiber),
                domPath: this.getDOMPath(element)
            };
        }
        
        // Fallback to DOM inspection
        return {
            type: 'dom_element',
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            attributes: this.getAttributes(element),
            domPath: this.getDOMPath(element)
        };
    }
    
    findReactFiber(element) {
        const key = Object.keys(element).find(key => 
            key.startsWith('__reactFiber') || 
            key.startsWith('__reactInternalInstance')
        );
        return element[key];
    }
    
    extractHooks(fiber) {
        const hooks = [];
        let hook = fiber.memoizedState;
        
        while (hook) {
            hooks.push({
                value: hook.memoizedState,
                deps: hook.deps
            });
            hook = hook.next;
        }
        
        return hooks;
    }
    
    getDOMPath(element) {
        const path = [];
        let current = element;
        
        while (current && current !== document.body) {
            const selector = current.tagName.toLowerCase();
            if (current.id) {
                path.unshift(`#${current.id}`);
                break;
            } else if (current.className) {
                path.unshift(`${selector}.${current.className.split(' ')[0]}`);
            } else {
                path.unshift(selector);
            }
            current = current.parentElement;
        }
        
        return path.join(' > ');
    }
    
    copyToClipboard(data) {
        const widgetRef = `vw.component("${this.getWidgetId()}:${data.domPath}")`;
        navigator.clipboard.writeText(widgetRef);
        
        this.showNotification(`Copied: ${widgetRef}`);
    }
    
    sendToPython(data) {
        // Send via model
        if (window.model) {
            window.model.set('grabbed_component', data);
            window.model.save_changes();
        }
    }
}

// Export for use in widgets
export default ComponentInspector;
```

### 2. Integration with FloatingMenu

Update `src/vibe_widget/app_wrapper.js`:

```javascript
import ComponentInspector from './inspector.js';

function FloatingMenu({ isOpen, onToggle, containerRef }) {
  const [inspector] = React.useState(() => new ComponentInspector(containerRef.current));
  
  const handleGrab = () => {
    inspector.startInspecting();
    onToggle(); // Close menu
  };
  
  return html`
    <div class="floating-menu-container">
      <!-- ... existing menu code ... -->
      
      ${isOpen && html`
        <div class="menu-options">
          <div class="menu-option" onClick=${handleGrab}>
            Grab Component
          </div>
          <div class="menu-option disabled">Edit</div>
          <div class="menu-option disabled">Export</div>
          <div class="menu-option disabled">View Source</div>
        </div>
      `}
    </div>
  `;
}
```

### 3. Python-side Component Reference

Add to `src/vibe_widget/core.py`:

```python
class ComponentReference:
    """Reference to a grabbed component"""
    
    def __init__(self, widget_id: str, dom_path: str, data: dict):
        self.widget_id = widget_id
        self.dom_path = dom_path
        self.data = data
        self._cached_state = None
    `
    def __repr__(self):
        return f'vw.component("{self.widget_id}:{self.dom_path}")'
    
    def get_state(self):
        """Get current component state"""
        return self.data.get('state', {})
    
    def get_props(self):
        """Get component props"""
        return self.data.get('props', {})
    
    def to_filter(self, description: str = None):
        """Convert component state to data filter"""
        # Use LLM to interpret component state
        if description:
            # Send to Claude to interpret
            pass
        return self._cached_state

# Add to VibeWidget
grabbed_component = traitlets.Dict({}).tag(sync=True)

@traitlets.observe('grabbed_component')
def _on_component_grabbed(self, change):
    """Handle component grab from frontend"""
    data = change['new']
    if data:
        ref = ComponentReference(
            widget_id=self.widget_id,
            dom_path=data['domPath'],
            data=data
        )
        # Store in global registry
        ComponentRegistry.register(ref)
```

---

## Extended vw API Methods

### 1. vw.component() - Component Reference System

```python
def component(reference: str) -> ComponentReference:
    """Get a component reference by ID"""
    widget_id, dom_path = reference.split(':')
    return ComponentRegistry.get(widget_id, dom_path)
```

### 2. vw.get() - Intelligent Data Extraction

```python
def get(description: str, from_component: ComponentReference = None, **kwargs):
    """
    Extract data or state using natural language
    
    Examples:
        vw.get("selected data points", from=brush_component)
        vw.get("current filter as SQL WHERE clause", from=filter_component)
        vw.get("x and y coordinates", from=clicked_point)
    """
    if from_component:
        context = {
            'component_type': from_component.data['type'],
            'component_state': from_component.get_state(),
            'component_props': from_component.get_props()
        }
    else:
        context = kwargs
    
    # Use LLM to interpret request
    llm = ClaudeProvider()
    prompt = f"""
    Extract the following information: {description}
    
    From this component context:
    {json.dumps(context, indent=2)}
    
    Return the extracted data as JSON or Python code.
    """
    
    result = llm.extract_data(prompt)
    return eval(result)  # Safe eval with restricted context
```

### 3. vw.change() - Modify Widget State

```python
def change(widget: VibeWidget, description: str, **kwargs):
    """
    Modify a widget using natural language
    
    Examples:
        vw.change(chart, "add a trend line")
        vw.change(dashboard, "switch to dark mode")
        vw.change(plot, "change colors to colorblind-friendly palette")
    """
    current_code = widget.code
    
    # Use existing revision system
    revised_code = widget.llm_provider.revise_widget_code(
        current_code=current_code,
        revision_description=description,
        data_info=widget.data_info
    )
    
    # Hot-reload the widget
    widget.code = revised_code
    widget.status = "updating"
    widget.status = "ready"
    
    return widget
```

### 4. vw.export() - Multi-format Export

```python
class ExportManager:
    """Handle widget exports to various formats"""
    
    @staticmethod
    def to_html(widget: VibeWidget, standalone: bool = True) -> str:
        """Export as standalone HTML"""
        if standalone:
            return f"""
            <!DOCTYPE html>
            <html>
            <head>
                <script type="module">
                {widget.code}
                
                // Initialize with embedded data
                const data = {json.dumps(widget.data)};
                const model = {{ get: (key) => key === 'data' ? data : null }};
                const container = document.getElementById('root');
                
                // Render widget
                const Widget = window.Widget || (() => null);
                const root = ReactDOM.createRoot(container);
                root.render(React.createElement(Widget, {{ model }}));
                </script>
            </head>
            <body>
                <div id="root"></div>
            </body>
            </html>
            """
    
    @staticmethod
    def to_react_component(widget: VibeWidget) -> str:
        """Export as React component file"""
        return f"""
        import React from 'react';
        {widget.code}
        export {{ Widget as default }};
        """
    
    @staticmethod
    def to_electron(widget: VibeWidget, output_dir: str):
        """Export as Electron app - see Electron section"""
        pass

def export(widget: VibeWidget, format: str = 'html', **kwargs):
    """Export widget to various formats"""
    exporter = ExportManager()
    
    if format == 'html':
        return exporter.to_html(widget, **kwargs)
    elif format == 'react':
        return exporter.to_react_component(widget)
    elif format == 'electron':
        return exporter.to_electron(widget, **kwargs)
    else:
        raise ValueError(f"Unsupported format: {format}")
```

### 5. vw.save() and vw.load() - Persistence

```python
def save(widget: VibeWidget, name: str = None):
    """
    Save widget state to IPython store
    
    Example:
        vw.save(my_chart, "sales_dashboard")
    """
    if not name:
        name = f"widget_{widget.widget_id}"
    
    # Get IPython instance
    from IPython import get_ipython
    ip = get_ipython()
    
    if ip:
        # Store widget state
        widget_state = {
            'code': widget.code,
            'data': widget.data,
            'description': widget.description,
            'permissions': widget.permissions,
            'grabbed_components': widget.grabbed_component
        }
        
        # Use IPython's store magic
        ip.user_ns[f'_vw_saved_{name}'] = widget_state
        ip.magic(f'store _vw_saved_{name}')
        
        print(f"Widget saved as '{name}'")
    else:
        # Fallback to pickle
        import pickle
        with open(f'.vibe_widgets/{name}.pkl', 'wb') as f:
            pickle.dump(widget_state, f)

def load(name: str) -> VibeWidget:
    """
    Load a saved widget
    
    Example:
        dashboard = vw.load("sales_dashboard")
    """
    from IPython import get_ipython
    ip = get_ipython()
    
    if ip:
        # Try to restore from IPython store
        ip.magic(f'store -r _vw_saved_{name}')
        widget_state = ip.user_ns.get(f'_vw_saved_{name}')
        
        if widget_state:
            # Recreate widget
            widget = VibeWidget.__new__(VibeWidget)
            widget.code = widget_state['code']
            widget.data = widget_state['data']
            # ... restore other attributes
            return widget
    
    # Fallback to pickle
    import pickle
    with open(f'.vibe_widgets/{name}.pkl', 'rb') as f:
        widget_state = pickle.load(f)
        # Recreate widget...
```

---

## Persistence System

### 1. Notebook Metadata Storage

Store widget state in notebook metadata for persistence across sessions:

```python
class NotebookPersistence:
    """Handle widget persistence in notebook metadata"""
    
    @staticmethod
    def inject_persistence_js():
        """Inject JavaScript to handle notebook saves"""
        return """
        if (window.Jupyter) {
            // Hook into notebook save event
            Jupyter.notebook.events.on('before_save.Notebook', function() {
                // Collect all widget states
                const widgets = document.querySelectorAll('.vibe-widget');
                const states = {};
                
                widgets.forEach(widget => {
                    const id = widget.dataset.widgetId;
                    const model = widget._vibeModel;
                    if (model) {
                        states[id] = {
                            code: model.get('code'),
                            data: model.get('data'),
                            grabbed_components: model.get('grabbed_component')
                        };
                    }
                });
                
                // Store in notebook metadata
                Jupyter.notebook.metadata.vibe_widgets = states;
            });
            
            // Restore on load
            if (Jupyter.notebook.metadata.vibe_widgets) {
                window._vibeWidgetStates = Jupyter.notebook.metadata.vibe_widgets;
            }
        }
        """
    
    @staticmethod
    def restore_widgets():
        """Restore widgets from notebook metadata"""
        from IPython.display import Javascript, display
        
        # Inject restoration script
        display(Javascript("""
        if (window._vibeWidgetStates) {
            Object.entries(window._vibeWidgetStates).forEach(([id, state]) => {
                // Trigger Python-side restoration
                IPython.notebook.kernel.execute(
                    `_restore_vibe_widget('${id}', ${JSON.stringify(state)})`
                );
            });
        }
        """))
```

### 2. State Serialization

```python
class StateSerializer:
    """Serialize/deserialize widget state"""
    
    @staticmethod
    def serialize(widget: VibeWidget) -> dict:
        """Serialize widget to JSON-safe format"""
        return {
            'version': '1.0',
            'widget_id': widget.widget_id,
            'code': widget.code,
            'data': widget.data,
            'description': widget.description,
            'permissions': widget.permissions,
            'grabbed_components': widget.grabbed_component,
            'created_at': datetime.now().isoformat(),
            'model': widget.model
        }
    
    @staticmethod
    def deserialize(state: dict) -> VibeWidget:
        """Recreate widget from serialized state"""
        # Version compatibility check
        if state['version'] != '1.0':
            raise ValueError(f"Unsupported state version: {state['version']}")
        
        # Recreate widget without triggering LLM
        widget = VibeWidget.__new__(VibeWidget)
        widget.widget_id = state['widget_id']
        widget.code = state['code']
        widget.data = state['data']
        # ... restore other properties
        
        return widget
```

---

## Electron Export Pipeline

### 1. Electron App Template

Create `src/vibe_widget/electron_template/`:

```javascript
// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');

class VibeWidgetApp {
    constructor() {
        this.window = null;
        this.server = null;
        this.port = 3000;
    }
    
    async createWindow() {
        this.window = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            }
        });
        
        // Load the widget
        this.window.loadFile('index.html');
    }
    
    startBackend() {
        const app = express();
        
        // Data API endpoint
        app.get('/api/data', (req, res) => {
            res.json(this.widgetData);
        });
        
        // Widget update endpoint
        app.post('/api/update', express.json(), (req, res) => {
            this.handleUpdate(req.body);
            res.json({ success: true });
        });
        
        this.server = app.listen(this.port);
    }
    
    handleUpdate(update) {
        // Send to renderer
        this.window.webContents.send('widget-update', update);
    }
}

// Initialize app
const widgetApp = new VibeWidgetApp();

app.whenReady().then(() => {
    widgetApp.startBackend();
    widgetApp.createWindow();
});
```

### 2. Export Implementation

```python
def export_electron(widget: VibeWidget, output_dir: str, app_name: str = None):
    """Export widget as Electron app"""
    
    if not app_name:
        app_name = f"VibeWidget_{widget.widget_id}"
    
    output_path = Path(output_dir) / app_name
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Copy template files
    template_dir = Path(__file__).parent / 'electron_template'
    shutil.copytree(template_dir, output_path, dirs_exist_ok=True)
    
    # Generate package.json
    package_json = {
        "name": app_name.lower().replace(' ', '-'),
        "version": "1.0.0",
        "main": "main.js",
        "scripts": {
            "start": "electron .",
            "build": "electron-builder"
        },
        "dependencies": {
            "electron": "^27.0.0",
            "express": "^4.18.0"
        },
        "devDependencies": {
            "electron-builder": "^24.0.0"
        },
        "build": {
            "appId": f"com.vibewidgets.{app_name.lower()}",
            "productName": app_name,
            "directories": {
                "output": "dist"
            },
            "mac": {
                "category": "public.app-category.developer-tools"
            },
            "win": {
                "target": "nsis"
            },
            "linux": {
                "target": "AppImage"
            }
        }
    }
    
    # Write package.json
    with open(output_path / 'package.json', 'w') as f:
        json.dump(package_json, f, indent=2)
    
    # Generate index.html with widget
    index_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>{app_name}</title>
        <script type="module">
        // Widget code
        {widget.code}
        
        // Initialize with data from backend
        fetch('/api/data')
            .then(res => res.json())
            .then(data => {{
                const model = {{
                    get: (key) => key === 'data' ? data : null,
                    set: (key, value) => {{
                        fetch('/api/update', {{
                            method: 'POST',
                            headers: {{ 'Content-Type': 'application/json' }},
                            body: JSON.stringify({{ key, value }})
                        }});
                    }}
                }};
                
                // Render widget
                const Widget = window.Widget;
                const container = document.getElementById('root');
                const root = ReactDOM.createRoot(container);
                root.render(React.createElement(Widget, {{ model }}));
            }});
        </script>
    </head>
    <body>
        <div id="root"></div>
    </body>
    </html>
    """
    
    with open(output_path / 'index.html', 'w') as f:
        f.write(index_html)
    
    # Create data file
    with open(output_path / 'data.json', 'w') as f:
        json.dump(widget.data, f)
    
    # Generate build script
    build_script = f"""
    #!/bin/bash
    cd {output_path}
    npm install
    npm run build
    """
    
    with open(output_path / 'build.sh', 'w') as f:
        f.write(build_script)
    
    os.chmod(output_path / 'build.sh', 0o755)
    
    print(f"Electron app exported to: {output_path}")
    print(f"To build: cd {output_path} && ./build.sh")
```

---

## Widget Revision System

### 1. Enhanced Revision with Component Context

```python
def revise_with_context(widget: VibeWidget, description: str, 
                        components: list[ComponentReference] = None):
    """
    Revise widget with grabbed component context
    
    Example:
        vw.revise_with_context(
            chart,
            "add tooltip to show values on hover",
            components=[grabbed_bar_component]
        )
    """
    context = {
        'current_code': widget.code,
        'data_info': widget.data_info,
        'grabbed_components': []
    }
    
    if components:
        for comp in components:
            context['grabbed_components'].append({
                'path': comp.dom_path,
                'state': comp.get_state(),
                'props': comp.get_props()
            })
    
    prompt = f"""
    Revise this widget: {description}
    
    Current widget code:
    {widget.code}
    
    Component context:
    {json.dumps(context['grabbed_components'], indent=2)}
    
    Make sure to:
    1. Preserve existing functionality
    2. Integrate with grabbed components if relevant
    3. Maintain the same data structure
    """
    
    revised_code = widget.llm_provider.generate_from_prompt(prompt)
    widget.code = revised_code
    
    return widget
```

### 2. Version Control for Widgets

```python
class WidgetVersionControl:
    """Track widget code versions"""
    
    def __init__(self, widget: VibeWidget):
        self.widget = widget
        self.versions = []
        self.current_version = 0
        
        # Save initial version
        self.commit("Initial version")
    
    def commit(self, message: str):
        """Save current state as new version"""
        version = {
            'version': len(self.versions),
            'timestamp': datetime.now().isoformat(),
            'message': message,
            'code': self.widget.code,
            'data': self.widget.data.copy()
        }
        self.versions.append(version)
        self.current_version = len(self.versions) - 1
    
    def checkout(self, version: int):
        """Restore to specific version"""
        if 0 <= version < len(self.versions):
            v = self.versions[version]
            self.widget.code = v['code']
            self.widget.data = v['data']
            self.current_version = version
    
    def diff(self, v1: int, v2: int) -> str:
        """Show differences between versions"""
        import difflib
        
        code1 = self.versions[v1]['code'].splitlines()
        code2 = self.versions[v2]['code'].splitlines()
        
        diff = difflib.unified_diff(
            code1, code2,
            fromfile=f"Version {v1}",
            tofile=f"Version {v2}",
            lineterm=''
        )
        
        return '\n'.join(diff)
```

---

## Implementation Timeline

### Phase 1: Foundation (Day 1 Morning)
1. **Security Infrastructure** (2 hours)
   - Implement SecurityManager
   - Add CSP policies
   - Create sandboxed execution environment

2. **State Management** (2 hours)
   - Enhance traitlets communication
   - Implement grabbed_component trait
   - Create ComponentRegistry

### Phase 2: React-Grab (Day 1 Afternoon)
3. **Component Inspector** (3 hours)
   - Implement inspector.js
   - React Fiber extraction
   - DOM path generation
   - Clipboard integration

4. **FloatingMenu Integration** (1 hour)
   - Add "Grab Component" option
   - Wire up inspector
   - Test component selection

### Phase 3: API Methods (Day 1 Late Afternoon)
5. **Core vw Methods** (2 hours)
   - Implement vw.component()
   - Create vw.get() with LLM integration
   - Build vw.change() using revision system

### Phase 4: Persistence (Day 2 Morning)
6. **Save/Load System** (2 hours)
   - IPython store integration
   - Notebook metadata persistence
   - State serialization

7. **Widget Versioning** (1 hour)
   - Version control system
   - Diff functionality
   - Commit/checkout operations

### Phase 5: Export (Day 2 Afternoon)
8. **Export Pipeline** (3 hours)
   - HTML export
   - React component export
   - Electron app generation
   - Backend server template

### Phase 6: Testing & Polish (Day 2 Late Afternoon)
9. **Integration Testing** (2 hours)
   - End-to-end tests
   - Security validation
   - Cross-widget communication
   - Performance optimization

---

## Key Implementation Considerations

### 1. Backwards Compatibility
- Maintain existing API surface
- Use feature flags for new functionality
- Graceful degradation for missing features

### 2. Security Best Practices
- Never execute untrusted code without sandboxing
- Validate all cross-boundary communication
- Implement rate limiting for LLM calls
- Use CSP headers consistently

### 3. Performance Optimization
- Lazy load component inspector
- Cache grabbed component states
- Debounce state synchronization
- Use virtual scrolling for large datasets

### 4. Error Handling
- Comprehensive try-catch blocks
- User-friendly error messages
- Fallback mechanisms for all features
- Logging and debugging utilities

### 5. Developer Experience
- Clear API documentation
- Inline code comments
- Example notebooks
- Migration guides

---

## Code Snippets for Quick Start

### Quick Test: Security Wrapper
```python
from vibe_widget.security import SecurityManager

sm = SecurityManager()
secure_code = sm.wrap_widget_code(widget.code, policy='strict')
```

### Quick Test: Component Grab
```javascript
// In browser console
const inspector = new ComponentInspector(document.body);
inspector.startInspecting();
// Click any element
```

### Quick Test: Persistence
```python
# Save widget
vw.save(my_widget, "test_widget")

# In new session
restored = vw.load("test_widget")
```

### Quick Test: Export
```python
# Export as Electron app
vw.export(my_widget, format='electron', output_dir='./my_app')
```

---

## Debugging Tools

### 1. Component Inspector Debugger
```python
def debug_grabbed_component(widget: VibeWidget):
    """Print detailed component information"""
    comp = widget.grabbed_component
    if comp:
        print(f"Component Type: {comp.get('type')}")
        print(f"DOM Path: {comp.get('domPath')}")
        print(f"Props: {json.dumps(comp.get('props', {}), indent=2)}")
        print(f"State: {json.dumps(comp.get('state', {}), indent=2)}")
        print(f"Hooks: {len(comp.get('hooks', []))} hooks found")
```

### 2. State Synchronization Monitor
```javascript
// Add to widget for debugging
window.monitorStateSync = (model) => {
    model.on('change', (changes) => {
        console.log('State sync:', changes);
    });
};
```

### 3. Security Policy Validator
```python
def validate_security_policy(widget: VibeWidget):
    """Check if widget complies with security policy"""
    issues = []
    
    # Check for eval usage
    if 'eval(' in widget.code:
        issues.append("Uses eval() - security risk")
    
    # Check for external fetches
    if 'fetch(' in widget.code and 'https://esm.sh' not in widget.code:
        issues.append("Fetches from non-whitelisted domains")
    
    return issues
```

---

## Conclusion

This implementation guide provides a comprehensive roadmap for enhancing vibe-widgets with advanced features. The architecture maintains backward compatibility while introducing powerful new capabilities for component inspection, state management, persistence, and export.

Key innovations:
- **React-grab integration** enables visual component selection and state extraction
- **Security sandboxing** protects user systems from malicious code
- **Persistence system** maintains widget state across sessions
- **Electron export** creates standalone desktop applications
- **Extended API** provides intuitive methods for widget manipulation

The modular design ensures each feature can be implemented independently, allowing for iterative development and testing. The timeline provides a realistic two-day implementation schedule with clear milestones and deliverables.

Next steps:
1. Review and refine security policies
2. Set up development environment
3. Implement Phase 1 (Foundation)
4. Test each component thoroughly
5. Create comprehensive documentation
6. Build example notebooks demonstrating features

This architecture positions vibe-widgets as a powerful, secure, and user-friendly platform for creating interactive visualizations with natural language.