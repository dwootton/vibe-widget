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
  private notifyingTraits: Set<string> = new Set(); // Prevent re-entrancy

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
    // Prevent re-entrancy: if we're already processing this trait for this widget, skip
    const notifyKey = `${sourceId}:${traitName}`;
    if (this.notifyingTraits.has(notifyKey)) {
      return;
    }
    this.notifyingTraits.add(notifyKey);

    try {
      // Update the source widget model (for Python-to-widget updates)
      // This allows the browser widget to react when Python sets a trait
      const sourceModel = this.widgetModels.get(sourceId);
      if (sourceModel) {
        // Use setFromPython to avoid triggering save_changes cycle
        sourceModel.setFromPython(traitName, value);
      }

      // Notify all other JS widget models about the change
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
    } finally {
      this.notifyingTraits.delete(notifyKey);
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

class OutputsNamespace:
    def __init__(self, widget):
        self._widget = widget

    def __getattr__(self, name):
        if name in self._widget._outputs:
            return OutputHandle(self._widget, name)
        raise AttributeError(f"outputs has no attribute '{name}'")

class WidgetProxy:
    """Proxy for a vibe widget that interfaces with pre-generated JS modules"""
    
    def __init__(self, widget_id, module_url, outputs=None, inputs=None):
        self._widget_id = widget_id
        self._module_url = module_url
        self._outputs = outputs or {}
        self._inputs = inputs or {}
        self._traits = {}
        self._observers = {}
        self._outputs_ns = None
        _widgets[widget_id] = self
    
    def __getattr__(self, name):
        if name.startswith('_'):
            return object.__getattribute__(self, name)
        if name == 'outputs':
            if self._outputs_ns is None:
                self._outputs_ns = OutputsNamespace(self)
            return self._outputs_ns
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

def outputs(**kwargs):
    resolved = {}
    for key, value in kwargs.items():
        if isinstance(value, OutputDefinition):
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

# Widget URL mapping (pre-generated widgets)
_WIDGET_URLS = {
    'scatter': '/widgets/temperature_across_days_seattle_colored__1e5a77bc87__v1.js',
    'bars': '/widgets/horizontal_bar_chart_weather_conditions__b7796577c1__v2.js',
    'tictactoe': '/widgets/interactive_tic_tac_toe_game_board_follo__ef3388891e__v1.js',
    'solar_system': '/widgets/3d_solar_system_using_three_js_showing_p__0ef429f27d__v1.js',
    'hacker_news': '/widgets/create_interactive_hacker_news_clone_wid__d763f3d4a1__v2.js',
    'line_chart': '/widgets/line_chart_showing_confirmed_deaths_reco__be99ed8976__v1.js',
    'line_chart_hover': '/widgets/add_vertical_dashed_line_user_hovering_d__9899268ecc__v1.js',
    'mnist': '/widgets/combined_widget_mnist_digit_20260101_134827_059414e7a5.js',
    'chi_papers_explorer': '/widgets/papers_explorer_interactive_chi_20260101_134322_ccc97fc18c.js',
    'chi_papers_cards': '/widgets/paper_cards_horizontal_list_20260101_134456_fcab3175e1.js',
}

def _match_widget(description):
    """Match description to pre-generated widget"""
    desc_lower = description.lower()
    
    # MNIST digit recognition
    if ('mnist' in desc_lower or 'digit' in desc_lower) and ('recogni' in desc_lower or 'canvas' in desc_lower or 'drawing' in desc_lower):
        return 'mnist', _WIDGET_URLS['mnist']
    
    # CHI Papers Explorer
    if 'chi' in desc_lower and 'paper' in desc_lower:
        return 'chi_papers_explorer', _WIDGET_URLS['chi_papers_explorer']
    if 'card' in desc_lower or 'horizontal' in desc_lower and 'list' in desc_lower:
        return 'chi_papers_cards', _WIDGET_URLS['chi_papers_cards']
    
    # Weather scatter plot
    if 'scatter' in desc_lower or ('temperature' in desc_lower and 'seattle' in desc_lower):
        return 'scatter', _WIDGET_URLS['scatter']
    
    # Bar chart
    elif 'bar' in desc_lower or 'histogram' in desc_lower:
        return 'bars', _WIDGET_URLS['bars']
    
    # Tic-tac-toe
    elif 'tic' in desc_lower or 'tac' in desc_lower:
        return 'tictactoe', _WIDGET_URLS['tictactoe']
    
    # Solar system
    elif 'solar' in desc_lower or ('3d' in desc_lower and 'planet' in desc_lower):
        return 'solar_system', _WIDGET_URLS['solar_system']
    
    # Hacker News
    elif 'hacker' in desc_lower or ('news' in desc_lower and 'clone' in desc_lower):
        return 'hacker_news', _WIDGET_URLS['hacker_news']
    
    # Line chart
    elif 'line' in desc_lower and 'chart' in desc_lower:
        # Check if it's the hover version
        if 'hover' in desc_lower or 'dashed' in desc_lower or 'vertical' in desc_lower:
            return 'line_chart_hover', _WIDGET_URLS['line_chart_hover']
        return 'line_chart', _WIDGET_URLS['line_chart']
    
    return None, None

def create(description, data=None, outputs=None, inputs=None):
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
    widget = WidgetProxy(widget_id, module_url, outputs, inputs)
    
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

  /**
   * Set a trait value from Python without triggering save_changes cycle.
   * This is used when Python sets a trait and we need to update the JS model
   * so the widget can react, but we don't want to propagate back to Python.
   */
  setFromPython(key: string, value: any): void {
    const oldValue = this.traits.get(key);
    this.traits.set(key, value);

    // Notify local listeners (widget handlers like handleSimilarityUpdate)
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
