/**
 * PyodideRuntime - Full Python execution in the browser
 * 
 * Uses Pyodide to run actual Python code, enabling:
 * - Real pandas/numpy operations
 * - scikit-learn model training
 * - Full cross-widget reactivity via traitlets simulation
 * - AI move computation
 */

declare global {
  interface Window {
    loadPyodide: any;
    pyodide: any;
  }
}

export interface PyodideState {
  ready: boolean;
  loading: boolean;
  error: string | null;
  loadProgress: number;
}

export type OutputHandler = (output: string, type: 'stdout' | 'stderr' | 'result') => void;
export type WidgetHandler = (widgetId: string, moduleUrl: string, model: any) => void;

class PyodideRuntimeManager {
  private pyodide: any = null;
  private loadPromise: Promise<any> | null = null;
  private state: PyodideState = {
    ready: false,
    loading: false,
    error: null,
    loadProgress: 0,
  };
  private stateListeners: Set<(state: PyodideState) => void> = new Set();
  private widgetModels: Map<string, WidgetModel> = new Map();
  private widgetHandler: WidgetHandler | null = null;

  /**
   * Subscribe to state changes
   */
  onStateChange(listener: (state: PyodideState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  private updateState(updates: Partial<PyodideState>) {
    this.state = { ...this.state, ...updates };
    this.stateListeners.forEach(l => l(this.state));
  }

  /**
   * Set the widget display handler
   */
  setWidgetHandler(handler: WidgetHandler) {
    this.widgetHandler = handler;
  }

  /**
   * Get or create a widget model
   */
  getWidgetModel(widgetId: string): WidgetModel {
    if (!this.widgetModels.has(widgetId)) {
      this.widgetModels.set(widgetId, new WidgetModel(widgetId, this));
    }
    return this.widgetModels.get(widgetId)!;
  }

  /**
   * Notify all widgets when a shared trait changes
   */
  notifyTraitChange(sourceId: string, traitName: string, value: any) {
    // Notify all other JS widget models
    this.widgetModels.forEach((model, id) => {
      if (id !== sourceId) {
        model.notifyChange(traitName, value);
      }
    });

    // Notify Python side if pyodide is ready
    if (this.pyodide) {
      try {
        const valueJson = JSON.stringify(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
        this.pyodide.runPythonAsync(`
import json
import vibe_widget as vw
_source_id = "${sourceId}"
_trait_name = "${traitName}"
try:
    _trait_value = json.loads('${valueJson}')
except:
    _trait_value = None
    
# Update trait in source widget
if _source_id in vw._widgets:
    vw._widgets[_source_id]._traits[_trait_name] = _trait_value
    # Trigger observers on the source widget
    _widget = vw._widgets[_source_id]
    if _trait_name in _widget._observers:
        for _cb in _widget._observers[_trait_name]:
            try:
                _cb({'name': _trait_name, 'old': None, 'new': _trait_value})
            except Exception as _e:
                print(f"Observer error: {_e}")

# Also notify other widgets that might be importing this trait
for _wid, _widget in vw._widgets.items():
    if _wid != _source_id and _trait_name in _widget._inputs:
        _widget._traits[_trait_name] = _trait_value
        if _trait_name in _widget._observers:
            for _cb in _widget._observers[_trait_name]:
                try:
                    _cb({'name': _trait_name, 'old': None, 'new': _trait_value})
                except Exception as _e:
                    print(f"Observer error: {_e}")
`).catch((e: any) => console.error('Python trait notification error:', e));
      } catch (e) {
        console.error('Failed to notify Python of trait change:', e);
      }
    }
  }

  /**
   * Display a widget
   */
  displayWidget(widgetId: string, moduleUrl: string, model: WidgetModel) {
    if (this.widgetHandler) {
      this.widgetHandler(widgetId, moduleUrl, model);
    }
  }

  /**
   * Load Pyodide and required packages
   */
  async load(): Promise<any> {
    if (this.pyodide) return this.pyodide;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this._doLoad();
    return this.loadPromise;
  }

  private async _doLoad(): Promise<any> {
    this.updateState({ loading: true, error: null, loadProgress: 0 });

    try {
      // Load Pyodide script if not already loaded
      if (!window.loadPyodide) {
        await this.loadScript('https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js');
      }

      this.updateState({ loadProgress: 20 });

      // Initialize Pyodide
      this.pyodide = await window.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/',
      });

      this.updateState({ loadProgress: 50 });

      // Load micropip for package installation
      // await this.pyodide.loadPackage('micropip');

      // Load required packages
      await this.pyodide.loadPackage(['pandas', 'numpy']);
      this.updateState({ loadProgress: 80 });

      await this.pyodide.loadPackage('scikit-learn');
      this.updateState({ loadProgress: 95 });

      // Set up the vibe_widget mock module
      await this.setupVibeWidgetMock();

      this.updateState({ ready: true, loading: false, loadProgress: 100 });
      return this.pyodide;
    } catch (error: any) {
      this.updateState({
        loading: false,
        error: error.message || 'Failed to load Pyodide',
        loadProgress: 0
      });
      throw error;
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Set up mock vibe_widget module that works with our pre-generated widgets
   */
  private async setupVibeWidgetMock() {
    const manager = this;

    // Create the mock module in Python
    await this.pyodide.runPythonAsync(`
import sys
import json
from types import ModuleType

# Create vibe_widget mock module
vw = ModuleType('vibe_widget')
sys.modules['vibe_widget'] = vw

# Widget registry
_widgets = {}
_widget_counter = 0

class OutputDefinition:
    def __init__(self, description):
        self.description = description

class OutputHandle:
    def __init__(self, widget, name):
        self._widget = widget
        self._widget_id = widget._widget_id
        self._trait_name = name

    def __call__(self):
        return self._widget._traits.get(self._trait_name)

    @property
    def value(self):
        return self()

    def observe(self, callback):
        self._widget.observe(callback, names=self._trait_name)

    def unobserve(self, callback):
        self._widget.unobserve(callback, names=self._trait_name)

class ActionDefinition:
    def __init__(self, description, params=None):
        self.description = description
        self.params = params or {}

class ActionsNamespace:
    def __init__(self, widget):
        self._widget = widget

    def __getattr__(self, name):
        if name in self._widget._actions:
            def action_caller(**kwargs):
                event = {"action": name, "params": kwargs}
                self._widget.action_event = event
            action_caller.__doc__ = self._widget._actions.get(name, "")
            return action_caller
        raise AttributeError(f"actions has no attribute '{name}'")

class OutputsNamespace:
    def __init__(self, widget):
        self._widget = widget

    def __getattr__(self, name):
        if name in self._widget._outputs:
            return OutputHandle(self._widget, name)
        raise AttributeError(f"outputs has no attribute '{name}'")

class WidgetProxy:
    """Proxy for a vibe widget that interfaces with pre-generated JS modules"""
    
    def __init__(self, widget_id, module_url, outputs=None, inputs=None, actions=None):
        self._widget_id = widget_id
        self._module_url = module_url
        self._outputs = outputs or {}
        self._inputs = inputs or {}
        self._actions = actions or {}
        self._traits = {}
        self._observers = {}
        self._outputs_ns = None
        self._actions_ns = None
        _widgets[widget_id] = self
    
    def __getattr__(self, name):
        if name.startswith('_'):
            return object.__getattribute__(self, name)
        if name == 'outputs':
            if self._outputs_ns is None:
                self._outputs_ns = OutputsNamespace(self)
            return self._outputs_ns
        if name == 'actions':
            if self._actions_ns is None:
                self._actions_ns = ActionsNamespace(self)
            return self._actions_ns
        # Return trait value
        return self._traits.get(name)
    
    def __setattr__(self, name, value):
        if name.startswith('_'):
            object.__setattr__(self, name, value)
        else:
            old_value = self._traits.get(name)
            self._traits[name] = value
            # Notify observers
            if name in self._observers:
                for callback in self._observers[name]:
                    try:
                        callback({'name': name, 'old': old_value, 'new': value})
                    except Exception as e:
                        print(f"Observer error: {e}")
            # Notify other widgets via JS bridge
            import js
            js.window._pyodideNotifyTrait(self._widget_id, name, json.dumps(value) if value is not None else 'null')
    
    def observe(self, callback, names=None):
        if names is None:
            names = list(self._traits.keys())
        if isinstance(names, str):
            names = [names]
        for name in names:
            if name not in self._observers:
                self._observers[name] = []
            self._observers[name].append(callback)

    def unobserve(self, callback, names=None):
        if names is None:
            names = list(self._observers.keys())
        if isinstance(names, str):
            names = [names]
        for name in names:
            if name in self._observers and callback in self._observers[name]:
                self._observers[name].remove(callback)
    
    def __repr__(self):
        # Trigger widget display via JS bridge
        import js
        js.window._pyodideDisplayWidget(
            self._widget_id, 
            self._module_url, 
            json.dumps(self._traits)
        )
        return f'Widget:{self._widget_id}'
    
    def _repr_mimebundle_(self, **kwargs):
        # Trigger widget display
        import js
        js.window._pyodideDisplayWidget(self._widget_id, self._module_url, json.dumps(self._traits))
        return {'text/plain': f'Widget:{self._widget_id}'}

def output(description):
    return OutputDefinition(description)

def action(description, params=None):
    return ActionDefinition(description, params=params)

def outputs(**kwargs):
    resolved = {}
    for key, value in kwargs.items():
        if isinstance(value, OutputDefinition):
            resolved[key] = value.description
        else:
            resolved[key] = value
    return resolved

def actions(**kwargs):
    resolved = {}
    for key, value in kwargs.items():
        if isinstance(value, ActionDefinition):
            resolved[key] = value.description
        else:
            resolved[key] = value
    return resolved

def inputs(*args, **kwargs):
    result = {'_data': None, '_inputs': {}}
    for arg in args:
        if hasattr(arg, 'to_dict'):  # DataFrame
            result['_data'] = arg
        elif hasattr(arg, 'tolist'):  # numpy array
            result['_data'] = arg.tolist()
        else:
            result['_data'] = arg
    for k, v in kwargs.items():
        if isinstance(v, OutputHandle):
            result['_inputs'][k] = v
        else:
            result['_inputs'][k] = v
    return result

def models():
    print("Available models: google/gemini-3-flash-preview, anthropic/claude-3, openai/gpt-4")
    return ["google/gemini-3-flash-preview", "anthropic/claude-3", "openai/gpt-4"]

def config(model=None, api_key=None):
    print(f"[Demo Mode] Config set - model: {model}")
    print("[Demo Mode] Using pre-generated widgets, no LLM calls needed")

# Widget URL mapping (pre-generated widgets; keep in sync with doc/data/examples.ts)
_WIDGET_URLS = {
    'scatter': '/widgets/temperature_across_days_seattle_colored__1e5a77bc87__v1.js',
    'bars': '/widgets/horizontal_bar_chart_weather_conditions__b7796577c1__v2.js',
    'tictactoe': '/widgets/interactive_tic_tac_toe_game_board_follo__ef3388891e__v1.js',
    'solar_system': '/widgets/3d_solar_system_using_three_js_showing_p__0ef429f27d__v1.js',
    'hacker_news': '/widgets/create_interactive_hacker_news_clone_wid__d763f3d4a1__v2.js',
    'line_chart': '/widgets/line_chart_showing_confirmed_deaths_reco__be99ed8976__v1.js',
    'line_chart_hover': '/widgets/add_vertical_dashed_line_user_hovering_d__9899268ecc__v1.js',
}

def _match_widget(description):
    """Match description to pre-generated widget"""
    desc_lower = description.lower()
    if 'scatter' in desc_lower or 'temperature' in desc_lower:
        return 'scatter', _WIDGET_URLS['scatter']
    elif 'bar' in desc_lower or 'histogram' in desc_lower:
        return 'bars', _WIDGET_URLS['bars']
    elif 'tic' in desc_lower or 'tac' in desc_lower:
        return 'tictactoe', _WIDGET_URLS['tictactoe']
    elif 'solar' in desc_lower or '3d' in desc_lower and 'planet' in desc_lower:
        return 'solar_system', _WIDGET_URLS['solar_system']
    elif 'hacker' in desc_lower or 'news' in desc_lower and 'clone' in desc_lower:
        return 'hacker_news', _WIDGET_URLS['hacker_news']
    elif 'line' in desc_lower and 'chart' in desc_lower:
        # Check if it's the hover version
        if 'hover' in desc_lower or 'dashed' in desc_lower or 'vertical' in desc_lower:
            return 'line_chart_hover', _WIDGET_URLS['line_chart_hover']
        return 'line_chart', _WIDGET_URLS['line_chart']
    return None, None

def create(description, data=None, outputs=None, inputs=None, actions=None):
    global _widget_counter
    _widget_counter += 1
    
    # Handle inputs dict format
    if isinstance(data, dict) and '_data' in data:
        actual_data = data.get('_data')
        inputs = data.get('_inputs', {})
        data = actual_data
    
    # Match to pre-generated widget
    widget_type, module_url = _match_widget(description)
    
    if module_url is None:
        print(f"[Demo] No matching widget for: {description[:50]}...")
        widget_type = f"widget_{_widget_counter}"
        module_url = _WIDGET_URLS.get('scatter')  # Default
    
    widget_id = f"{widget_type}_{_widget_counter}"
    widget = WidgetProxy(widget_id, module_url, outputs, inputs, actions)
    
    # Initialize data if provided
    if data is not None:
        if hasattr(data, 'to_dict'):  # DataFrame
            widget._traits['data'] = data.to_dict('records')
        elif hasattr(data, 'tolist'):  # numpy array
            widget._traits['data'] = data.tolist()
        else:
            widget._traits['data'] = data
    
    # Initialize output traits
    if outputs:
        for key in outputs:
            if key not in widget._traits:
                widget._traits[key] = None
    
    # Initialize input traits from source widgets
    if inputs:
        for trait_name, source_ref in inputs.items():
            if isinstance(source_ref, OutputHandle):
                source_widget_id = source_ref._widget_id
                source_trait_name = source_ref._trait_name
            else:
                source_widget_id = source_ref
                source_trait_name = trait_name
            if source_widget_id in _widgets:
                source_widget = _widgets[source_widget_id]
                # Get current value from source widget
                if source_trait_name in source_widget._traits:
                    widget._traits[trait_name] = source_widget._traits[source_trait_name]
                else:
                    widget._traits[trait_name] = None
                # Register this widget as consuming this input
                widget._inputs[trait_name] = source_widget_id
                # Notify JS bridge about this link
                import js
                js.window._pyodideLinkWidgets(source_widget_id, widget_id, trait_name)
    
    print(f"[Demo] Created widget: {widget_id}")
    return widget

def edit(description, base_widget, data=None, outputs=None, inputs=None):
    """
    Edit an existing widget with new features.
    In demo mode, this returns the edited widget module URL.
    """
    global _widget_counter
    _widget_counter += 1
    
    # Handle inputs dict format
    if isinstance(data, dict) and '_data' in data:
        actual_data = data.get('_data')
        inputs = data.get('_inputs', {})
        data = actual_data
    
    # Match edit description to appropriate widget
    # For demo, check what kind of edit is requested
    desc_lower = description.lower()
    
    # Start with base widget type
    base_type = base_widget._widget_id.split('_')[0]
    widget_type = base_type
    module_url = base_widget._module_url
    
    # Check if this is a specific edit we support
    if 'hover' in desc_lower or 'dashed' in desc_lower or 'vertical' in desc_lower:
        if 'line' in base_type or 'chart' in base_type:
            widget_type = 'line_chart_hover'
            module_url = _WIDGET_URLS.get('line_chart_hover', module_url)
    
    widget_id = f"{widget_type}_v{_widget_counter}"
    widget = WidgetProxy(widget_id, module_url, outputs or base_widget._outputs, inputs)
    
    # Copy data from base widget if not provided
    if data is None and 'data' in base_widget._traits:
        widget._traits['data'] = base_widget._traits['data']
    elif data is not None:
        if hasattr(data, 'to_dict'):  # DataFrame
            widget._traits['data'] = data.to_dict('records')
        elif hasattr(data, 'tolist'):  # numpy array
            widget._traits['data'] = data.tolist()
        else:
            widget._traits['data'] = data
    
    # Initialize output traits
    if outputs:
        for key in outputs:
            if key not in widget._traits:
                widget._traits[key] = None
    
    # Initialize input traits from source widgets
    if inputs:
        for trait_name, source_ref in inputs.items():
            if isinstance(source_ref, OutputHandle):
                source_widget_id = source_ref._widget_id
                source_trait_name = source_ref._trait_name
            else:
                source_widget_id = source_ref
                source_trait_name = trait_name
            if source_widget_id in _widgets:
                source_widget = _widgets[source_widget_id]
                if source_trait_name in source_widget._traits:
                    widget._traits[trait_name] = source_widget._traits[source_trait_name]
                else:
                    widget._traits[trait_name] = None
                widget._inputs[trait_name] = source_widget_id
                import js
                js.window._pyodideLinkWidgets(source_widget_id, widget_id, trait_name)
    
    print(f"[Demo] Edited widget: {widget_id} (from {base_widget._widget_id})")
    return widget

# Attach to module
vw.output = output
vw.outputs = outputs
vw.inputs = inputs
vw.models = models
vw.config = config
vw.create = create
vw.edit = edit
vw.WidgetProxy = WidgetProxy
vw._widgets = _widgets
`);

    // Set up JS bridge functions
    (window as any)._pyodideNotifyTrait = (widgetId: string, traitName: string, valueJson: string) => {
      try {
        const value = JSON.parse(valueJson);
        manager.notifyTraitChange(widgetId, traitName, value);
      } catch (e) {
        console.error('Failed to notify trait:', e);
      }
    };

    (window as any)._pyodideDisplayWidget = (widgetId: string, moduleUrl: string, traitsJson: string) => {
      try {
        const traits = JSON.parse(traitsJson);
        const model = manager.getWidgetModel(widgetId);
        // Initialize model with traits from Python
        Object.entries(traits).forEach(([key, value]) => {
          model.set(key, value);
        });
        manager.displayWidget(widgetId, moduleUrl, model);
      } catch (e) {
        console.error('Failed to display widget:', e);
      }
    };

    // Link widgets for cross-widget reactivity
    (window as any)._pyodideLinkWidgets = (sourceId: string, targetId: string, traitName: string) => {
      const targetModel = manager.getWidgetModel(targetId);
      // Register that this model consumes this input
      targetModel.registerInput(traitName, sourceId);
    };
  }

  /**
   * Enable playground mode — replaces demo-only stubs with versions that
   * make real LLM calls when an API key is configured via vw.config().
   * Generated widget code is rendered through the existing JS bridge.
   */
  async enablePlaygroundMode(): Promise<void> {
    if (!this.pyodide) throw new Error('Pyodide not loaded');

    // JS-side helper: compile generated code (JSX → JS via Babel), create a
    // blob URL, and register it for the widget id.
    const manager = this;
    (window as any)._pyodideRegisterGeneratedWidget = async (
      widgetId: string,
      code: string,
      traitsJson: string
    ) => {
      try {
        const { transformWidgetModule } = await import('./transformWidgetModule');

        const compiled = await transformWidgetModule(code);
        const blob = new Blob([compiled], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);

        const traits = JSON.parse(traitsJson);
        const model = manager.getWidgetModel(widgetId);
        Object.entries(traits).forEach(([key, value]) => {
          model.set(key, value);
        });
        manager.displayWidget(widgetId, blobUrl, model);
      } catch (e: any) {
        console.error('Failed to register generated widget:', e);
      }
    };

    // Build the Python code as a regular string to avoid template literal escaping issues
    const pythonCode = [
      'import sys, json',
      '',
      '# patch the existing vibe_widget mock in-place',
      'import vibe_widget as vw',
      '',
      '_api_key = None',
      '_model = None',
      '',
      'def _playground_config(model=None, api_key=None, **kwargs):',
      '    global _api_key, _model',
      '    _api_key = api_key',
      '    _model = model',
      '    if api_key and model:',
      '        print(f"Configured \\u2014 model: {model}")',
      '    elif model:',
      '        print(f"Configured \\u2014 model: {model}  (no API key, will use pre-generated widgets)")',
      '    else:',
      '        print("No model or API key set. Call vw.config(model=..., api_key=...) to enable live generation.")',
      '',
      'vw.config = _playground_config',
      '',
      '# prompt template stored as a variable to avoid quoting issues',
      '_PROMPT_SPEC = """',
      'CRITICAL RENDERING SPECIFICATION (JSX + PREACT-COMPAT):',
      '',
      'MUST FOLLOW EXACTLY:',
      '1. Export a default function: export default function Widget({ model, React }) { ... }',
      '2. Return JSX (no html tagged templates, no ReactDOM.render/createRoot)',
      '3. Do not import React, react-dom, preact, or react/jsx-runtime',
      '4. Access inputs with model.get("<input_name>") using names from INPUTS; treat them as immutable',
      '5. Initialize outputs immediately via model.set(...) and model.save_changes(); update + save_changes() on every change',
      '6. Subscribe to input traits with model.on("change:trait", handler) and unsubscribe in cleanup',
      '7. Every React.useEffect MUST return a cleanup tearing down listeners, timers, raf, observers, etc.',
      '8. Import libraries from ESM CDN with locked versions (d3@7, three@0.160, regl@3, etc.)',
      '9. Avoid document.body manipulation',
      '10. Avoid 100vh/100vw; use fixed heights (360-640px)',
      '11. Use style objects (style={{ ... }}) and className in JSX',
      '12. Never wrap the output in markdown code fences',
      '13. Ensure strong contrast between all text/labels and background colors.',
      '',
      'OUTPUT REQUIREMENTS:',
      'Generate ONLY the working JavaScript code (imports then export default function Widget...).',
      '- NO explanations before or after',
      '- NO markdown fences',
      '- NO console logs unless essential',
      '',
      'Begin the response with code immediately.',
      '"""',
      '',
      'def _build_prompt(description, data_summary=None, outputs=None, inputs_info=None):',
      '    parts = []',
      '    parts.append(',
      '        "You are an expert JavaScript + React developer building a high-quality "',
      '        "interactive visualization that runs inside an AnyWidget React bundle.\\n"',
      '    )',
      '    parts.append(f"TASK: {description}\\n")',
      '',
      '    if data_summary:',
      '        parts.append(f"Input summaries:\\n- data: {data_summary}\\n")',
      '',
      '    if outputs:',
      '        parts.append("OUTPUTS (model.set + model.save_changes):\\n")',
      '        for k, v in outputs.items():',
      '            parts.append(f"  - {k}: {v}\\n")',
      '',
      '    parts.append(_PROMPT_SPEC)',
      '    return "\\n".join(parts)',
      '',
      '',
      '# LLM call via synchronous XMLHttpRequest',
      'def _call_llm(prompt):',
      '    import js',
      '    xhr = js.XMLHttpRequest.new()',
      '    url = "https://openrouter.ai/api/v1/chat/completions"',
      '    xhr.open("POST", url, False)',
      '    xhr.setRequestHeader("Content-Type", "application/json")',
      '    xhr.setRequestHeader("Authorization", f"Bearer {_api_key}")',
      '    xhr.setRequestHeader("HTTP-Referer", "https://vibewidget.dev")',
      '    body = json.dumps({',
      '        "model": _model,',
      '        "messages": [{"role": "user", "content": prompt}],',
      '        "max_tokens": 16000,',
      '        "temperature": 0.7,',
      '    })',
      '    xhr.send(body)',
      '    if xhr.status != 200:',
      '        raise RuntimeError(f"LLM API error ({xhr.status}): {str(xhr.responseText)[:300]}")',
      '    resp = json.loads(str(xhr.responseText))',
      '    code = resp["choices"][0]["message"]["content"]',
      '    if isinstance(code, str) and code.strip().lower().startswith("<"):',
      '        raise RuntimeError("LLM returned HTML instead of code. The API may have returned an error page. Check your API key and model.")',
      '    # Strip markdown fences if present',
      '    fence = chr(96) * 3',
      '    if code.startswith(fence):',
      '        lines = code.split("\\n")',
      '        lines = lines[1:]',
      '        if lines and lines[-1].strip().startswith(fence):',
      '            lines = lines[:-1]',
      '        code = "\\n".join(lines)',
      '    return code',
      '',
      '',
      '# patched create()',
      'def _playground_create(description, data=None, outputs=None, inputs=None, actions=None):',
      '    global _widget_counter',
      '    _widget_counter += 1',
      '',
      '    if isinstance(data, dict) and "_data" in data:',
      '        actual_data = data.get("_data")',
      '        inputs = data.get("_inputs", {})',
      '        data = actual_data',
      '',
      '    data_summary = None',
      '    data_records = None',
      '    if data is not None:',
      '        if hasattr(data, "to_dict"):',
      '            data_records = data.to_dict("records")',
      '            cols = list(data.columns)',
      '            data_summary = f"DataFrame with {len(data)} rows, columns: {cols}. First 3 rows: {data.head(3).to_dict(\'records\')}"',
      '        elif hasattr(data, "tolist"):',
      '            data_records = data.tolist()',
      '            data_summary = f"Array with {len(data)} elements"',
      '        else:',
      '            data_records = data',
      '            data_summary = str(data)[:500]',
      '',
      '    resolved_outputs = None',
      '    if outputs:',
      '        resolved_outputs = {}',
      '        for k, v in outputs.items():',
      '            resolved_outputs[k] = v.description if hasattr(v, "description") else str(v)',
      '',
      '    if _api_key and _model:',
      '        print("Generating widget...")',
      '        prompt = _build_prompt(description, data_summary, resolved_outputs)',
      '        try:',
      '            code = _call_llm(prompt)',
      '        except Exception as e:',
      '            print(f"LLM call failed: {e}")',
      '            return _fallback_create(description, data, data_records, outputs, inputs, actions)',
      '',
      '        widget_id = f"live_{_widget_counter}"',
      '        widget = WidgetProxy(widget_id, "", resolved_outputs, inputs, actions)',
      '',
      '        if data_records is not None:',
      '            widget._traits["data"] = data_records',
      '        if resolved_outputs:',
      '            for key in resolved_outputs:',
      '                if key not in widget._traits:',
      '                    widget._traits[key] = None',
      '',
      '        widget._generated_code = code',
      '        print("Widget generated successfully.")',
      '        return widget',
      '    else:',
      '        return _fallback_create(description, data, data_records, outputs, inputs, actions)',
      '',
      '',
      'def _fallback_create(description, data, data_records, outputs, inputs, actions):',
      '    widget_type, module_url = _match_widget(description)',
      '    if module_url is None:',
      '        widget_type = f"widget_{_widget_counter}"',
      '        module_url = _WIDGET_URLS.get("scatter")',
      '    widget_id = f"{widget_type}_{_widget_counter}"',
      '    widget = WidgetProxy(widget_id, module_url, outputs, inputs, actions)',
      '    if data_records is not None:',
      '        widget._traits["data"] = data_records',
      '    elif data is not None:',
      '        if hasattr(data, "to_dict"):',
      '            widget._traits["data"] = data.to_dict("records")',
      '        elif hasattr(data, "tolist"):',
      '            widget._traits["data"] = data.tolist()',
      '        else:',
      '            widget._traits["data"] = data',
      '    if outputs:',
      '        for key in outputs:',
      '            if key not in widget._traits:',
      '                widget._traits[key] = None',
      '    if inputs:',
      '        for trait_name, source_ref in inputs.items():',
      '            if isinstance(source_ref, OutputHandle):',
      '                source_widget_id = source_ref._widget_id',
      '                source_trait_name = source_ref._trait_name',
      '            else:',
      '                source_widget_id = source_ref',
      '                source_trait_name = trait_name',
      '            if source_widget_id in _widgets:',
      '                source_widget = _widgets[source_widget_id]',
      '                if source_trait_name in source_widget._traits:',
      '                    widget._traits[trait_name] = source_widget._traits[source_trait_name]',
      '                else:',
      '                    widget._traits[trait_name] = None',
      '                widget._inputs[trait_name] = source_widget_id',
      '                import js',
      '                js.window._pyodideLinkWidgets(source_widget_id, widget_id, trait_name)',
      '    return widget',
      '',
      'vw.create = _playground_create',
      '',
      '',
      '# patched __repr__ to handle generated code via JS bridge',
      '# Use object.__repr__ as the safe fallback to avoid recursion',
      '',
      'def _live_repr(self):',
      '    # Check __dict__ directly to avoid triggering __getattr__',
      '    gen_code = self.__dict__.get("_generated_code")',
      '    if gen_code:',
      '        import js',
      '        js.window._pyodideRegisterGeneratedWidget(',
      '            self._widget_id,',
      '            gen_code,',
      '            json.dumps(self._traits)',
      '        )',
      '        return f"Widget:{self._widget_id}"',
      '    # Fall back to the original display-via-module-url path',
      '    if self._module_url:',
      '        import js',
      '        js.window._pyodideDisplayWidget(',
      '            self._widget_id,',
      '            self._module_url,',
      '            json.dumps(self._traits)',
      '        )',
      '        return f"Widget:{self._widget_id}"',
      '    return object.__repr__(self)',
      '',
      'WidgetProxy.__repr__ = _live_repr',
      '',
      'def _live_repr_mimebundle(self, **kwargs):',
      '    gen_code = self.__dict__.get("_generated_code")',
      '    if gen_code:',
      '        import js',
      '        js.window._pyodideRegisterGeneratedWidget(',
      '            self._widget_id,',
      '            gen_code,',
      '            json.dumps(self._traits)',
      '        )',
      '        return {"text/plain": f"Widget:{self._widget_id}"}',
      '    if self._module_url:',
      '        import js',
      '        js.window._pyodideDisplayWidget(',
      '            self._widget_id,',
      '            self._module_url,',
      '            json.dumps(self._traits)',
      '        )',
      '        return {"text/plain": f"Widget:{self._widget_id}"}',
      '    return {"text/plain": object.__repr__(self)}',
      '',
      'WidgetProxy._repr_mimebundle_ = _live_repr_mimebundle',
      '',
      'print("Playground mode enabled. Use vw.config(model=..., api_key=...) to enable live widget generation.")',
    ].join('\n');

    await this.pyodide.runPythonAsync(pythonCode);
  }

  /**
   * Run Python code and return result
   */
  async runPython(code: string, outputHandler?: OutputHandler): Promise<any> {
    if (!this.pyodide) {
      throw new Error('Pyodide not loaded');
    }

    // Capture stdout/stderr
    let stdoutBuffer = '';
    let stderrBuffer = '';

    this.pyodide.setStdout({
      batched: (text: string) => {
        stdoutBuffer += text;
        outputHandler?.(text, 'stdout');
      }
    });

    this.pyodide.setStderr({
      batched: (text: string) => {
        stderrBuffer += text;
        outputHandler?.(text, 'stderr');
      }
    });

    try {
      const result = await this.pyodide.runPythonAsync(code);

      // Convert result to JS
      if (result && result.toJs) {
        return result.toJs();
      }
      return result;
    } catch (error: any) {
      outputHandler?.(error.message, 'stderr');
      throw error;
    }
  }

  /**
   * Load CSV data and return as Python DataFrame
   */
  async loadCSV(url: string, varName: string): Promise<void> {
    const response = await fetch(url);
    const csvText = await response.text();

    // Set CSV content in Python
    await this.pyodide.runPythonAsync(`
import pandas as pd
from io import StringIO
_csv_data = """${csvText.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"""
${varName} = pd.read_csv(StringIO(_csv_data))
del _csv_data
`);
  }

  /**
   * Load JSON data and return as Python DataFrame
   */
  async loadJSON(url: string, varName: string): Promise<void> {
    const response = await fetch(url);
    const jsonData = await response.json();
    // console.log(`Loading JSON from ${url} into variable ${varName}`);

    // Set JSON content in Python
    const jsonStr = JSON.stringify(jsonData).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    await this.pyodide.runPythonAsync(`
import pandas as pd
import json
_json_data = json.loads('${jsonStr}')
${varName} = pd.DataFrame(_json_data)
del _json_data
`);
  }

  /**
   * Load data file (auto-detects type from extension)
   */
  async loadDataFile(url: string, varName: string, type?: string): Promise<void> {
    const fileType = type || (url.endsWith('.json') ? 'json' : 'csv');
    if (fileType === 'json') {
      return this.loadJSON(url, varName);
    }
    return this.loadCSV(url, varName);
  }

  /**
   * Reset the runtime
   */
  reset() {
    this.widgetModels.clear();
  }

  getState(): PyodideState {
    return this.state;
  }
}

/**
 * WidgetModel - Represents a widget's state for JS-Python bridge
 */
export class WidgetModel {
  private traits: Map<string, any> = new Map();
  private listeners: Map<string, Set<(change: any) => void>> = new Map();
  private inputs: Set<string> = new Set();

  constructor(
    private id: string,
    private runtime: PyodideRuntimeManager
  ) { }

  get(key: string): any {
    return this.traits.get(key);
  }

  set(key: string, value: any): void {
    const oldValue = this.traits.get(key);
    this.traits.set(key, value);

    // Notify local listeners
    const listeners = this.listeners.get(key);
    if (listeners) {
      const change = { name: key, old: oldValue, new: value };
      listeners.forEach(fn => {
        try { fn(change); } catch (e) { console.error(e); }
      });
    }
  }

  save_changes(): void {
    // Propagate all traits to other widgets
    this.traits.forEach((value, key) => {
      this.runtime.notifyTraitChange(this.id, key, value);
    });
  }

  /**
   * Notify a specific trait change (called externally for cross-widget updates)
   */
  notifyChange(key: string, value: any): void {
    this.traits.set(key, value);
    // Notify local listeners
    const listeners = this.listeners.get(key);
    if (listeners) {
      const change = { name: key, old: undefined, new: value };
      listeners.forEach(fn => {
        try { fn(change); } catch (e) { console.error(e); }
      });
    }
  }

  on(eventName: string, handler: (change: any) => void): void {
    const key = eventName.startsWith('change:') ? eventName.slice(7) : eventName;
    const listeners = this.listeners.get(key) || new Set();
    listeners.add(handler);
    this.listeners.set(key, listeners);
  }

  off(eventName: string, handler: (change: any) => void): void {
    const key = eventName.startsWith('change:') ? eventName.slice(7) : eventName;
    const listeners = this.listeners.get(key);
    if (listeners) listeners.delete(handler);
  }

  observe(handler: (change: any) => void, names?: string | string[]): void {
    const keys = Array.isArray(names) ? names : names ? [names] : [];
    keys.forEach(key => {
      this.inputs.add(key);
      this.on(`change:${key}`, handler);
    });
  }

  isInputting(traitName: string): boolean {
    return this.inputs.has(traitName);
  }

  registerInput(traitName: string, sourceId: string): void {
    this.inputs.add(traitName);
  }

  receiveTraitUpdate(traitName: string, value: any): void {
    this.set(traitName, value);
  }

  getId(): string {
    return this.id;
  }

  // Initialize with data
  setInitialData(data: any): void {
    this.traits.set('data', data);
  }
}

// Singleton instance
export const pyodideRuntime = new PyodideRuntimeManager();
