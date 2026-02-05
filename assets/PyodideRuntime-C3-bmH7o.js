const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-CHIWwMwg.js","assets/index-BMT_jPrw.css"])))=>i.map(i=>d[i]);
import{_ as p}from"./index-CHIWwMwg.js";class f{constructor(){this.pyodide=null,this.loadPromise=null,this.state={ready:!1,loading:!1,error:null,loadProgress:0},this.stateListeners=new Set,this.widgetModels=new Map,this.widgetHandler=null}onStateChange(e){return this.stateListeners.add(e),e(this.state),()=>this.stateListeners.delete(e)}updateState(e){this.state={...this.state,...e},this.stateListeners.forEach(t=>t(this.state))}setWidgetHandler(e){this.widgetHandler=e}getWidgetModel(e){return this.widgetModels.has(e)||this.widgetModels.set(e,new w(e,this)),this.widgetModels.get(e)}notifyTraitChange(e,t,i){if(this.widgetModels.forEach((s,a)=>{a!==e&&s.notifyChange(t,i)}),this.pyodide)try{const s=JSON.stringify(i).replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/\n/g,"\\n");this.pyodide.runPythonAsync(`
import json
import vibe_widget as vw
_source_id = "${e}"
_trait_name = "${t}"
try:
    _trait_value = json.loads('${s}')
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
`).catch(a=>console.error("Python trait notification error:",a))}catch(s){console.error("Failed to notify Python of trait change:",s)}}displayWidget(e,t,i){this.widgetHandler&&this.widgetHandler(e,t,i)}async load(){return this.pyodide?this.pyodide:this.loadPromise?this.loadPromise:(this.loadPromise=this._doLoad(),this.loadPromise)}async _doLoad(){this.updateState({loading:!0,error:null,loadProgress:0});try{return window.loadPyodide||await this.loadScript("https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js"),this.updateState({loadProgress:20}),this.pyodide=await window.loadPyodide({indexURL:"https://cdn.jsdelivr.net/pyodide/v0.25.1/full/"}),this.updateState({loadProgress:50}),await this.pyodide.loadPackage(["pandas","numpy"]),this.updateState({loadProgress:80}),await this.pyodide.loadPackage("scikit-learn"),this.updateState({loadProgress:95}),await this.setupVibeWidgetMock(),this.updateState({ready:!0,loading:!1,loadProgress:100}),this.pyodide}catch(e){throw this.updateState({loading:!1,error:e.message||"Failed to load Pyodide",loadProgress:0}),e}}loadScript(e){return new Promise((t,i)=>{const s=document.createElement("script");s.src=e,s.onload=()=>t(),s.onerror=()=>i(new Error(`Failed to load ${e}`)),document.head.appendChild(s)})}async setupVibeWidgetMock(){const e=this;await this.pyodide.runPythonAsync(`
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

# Widget URL mapping (pre-generated widgets)
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
`),window._pyodideNotifyTrait=(t,i,s)=>{try{const a=JSON.parse(s);e.notifyTraitChange(t,i,a)}catch(a){console.error("Failed to notify trait:",a)}},window._pyodideDisplayWidget=(t,i,s)=>{try{const a=JSON.parse(s),r=e.getWidgetModel(t);Object.entries(a).forEach(([d,o])=>{r.set(d,o)}),e.displayWidget(t,i,r)}catch(a){console.error("Failed to display widget:",a)}},window._pyodideLinkWidgets=(t,i,s)=>{e.getWidgetModel(i).registerInput(s,t)}}async enablePlaygroundMode(){if(!this.pyodide)throw new Error("Pyodide not loaded");const e=this;window._pyodideRegisterGeneratedWidget=async(i,s,a)=>{try{const{transformWidgetModule:r}=await p(async()=>{const{transformWidgetModule:n}=await import("./index-CHIWwMwg.js").then(_=>_.q);return{transformWidgetModule:n}},__vite__mapDeps([0,1])),d=await r(s),o=new Blob([d],{type:"application/javascript"}),u=URL.createObjectURL(o),g=JSON.parse(a),l=e.getWidgetModel(i);Object.entries(g).forEach(([n,_])=>{l.set(n,_)}),e.displayWidget(i,u,l)}catch(r){console.error("Failed to register generated widget:",r)}};const t=["import sys, json","","# patch the existing vibe_widget mock in-place","import vibe_widget as vw","","_api_key = None","_model = None","","def _playground_config(model=None, api_key=None, **kwargs):","    global _api_key, _model","    _api_key = api_key","    _model = model","    if api_key and model:",'        print(f"Configured \\u2014 model: {model}")',"    elif model:",'        print(f"Configured \\u2014 model: {model}  (no API key, will use pre-generated widgets)")',"    else:",'        print("No model or API key set. Call vw.config(model=..., api_key=...) to enable live generation.")',"","vw.config = _playground_config","","# prompt template stored as a variable to avoid quoting issues",'_PROMPT_SPEC = """',"CRITICAL RENDERING SPECIFICATION (JSX + PREACT-COMPAT):","","MUST FOLLOW EXACTLY:","1. Export a default function: export default function Widget({ model, React }) { ... }","2. Return JSX (no html tagged templates, no ReactDOM.render/createRoot)","3. Do not import React, react-dom, preact, or react/jsx-runtime",'4. Access inputs with model.get("<input_name>") using names from INPUTS; treat them as immutable',"5. Initialize outputs immediately via model.set(...) and model.save_changes(); update + save_changes() on every change",'6. Subscribe to input traits with model.on("change:trait", handler) and unsubscribe in cleanup',"7. Every React.useEffect MUST return a cleanup tearing down listeners, timers, raf, observers, etc.","8. Import libraries from ESM CDN with locked versions (d3@7, three@0.160, regl@3, etc.)","9. Avoid document.body manipulation","10. Avoid 100vh/100vw; use fixed heights (360-640px)","11. Use style objects (style={{ ... }}) and className in JSX","12. Never wrap the output in markdown code fences","13. Ensure strong contrast between all text/labels and background colors.","","OUTPUT REQUIREMENTS:","Generate ONLY the working JavaScript code (imports then export default function Widget...).","- NO explanations before or after","- NO markdown fences","- NO console logs unless essential","","Begin the response with code immediately.",'"""',"","def _build_prompt(description, data_summary=None, outputs=None, inputs_info=None):","    parts = []","    parts.append(",'        "You are an expert JavaScript + React developer building a high-quality "','        "interactive visualization that runs inside an AnyWidget React bundle.\\n"',"    )",'    parts.append(f"TASK: {description}\\n")',"","    if data_summary:",'        parts.append(f"Input summaries:\\n- data: {data_summary}\\n")',"","    if outputs:",'        parts.append("OUTPUTS (model.set + model.save_changes):\\n")',"        for k, v in outputs.items():",'            parts.append(f"  - {k}: {v}\\n")',"","    parts.append(_PROMPT_SPEC)",'    return "\\n".join(parts)',"","","# LLM call via synchronous XMLHttpRequest","def _call_llm(prompt):","    import js","    xhr = js.XMLHttpRequest.new()",'    url = "https://openrouter.ai/api/v1/chat/completions"','    xhr.open("POST", url, False)','    xhr.setRequestHeader("Content-Type", "application/json")','    xhr.setRequestHeader("Authorization", f"Bearer {_api_key}")','    xhr.setRequestHeader("HTTP-Referer", "https://vibewidget.dev")',"    body = json.dumps({",'        "model": _model,','        "messages": [{"role": "user", "content": prompt}],','        "max_tokens": 16000,','        "temperature": 0.7,',"    })","    xhr.send(body)","    if xhr.status != 200:",'        raise RuntimeError(f"LLM API error ({xhr.status}): {str(xhr.responseText)[:300]}")',"    resp = json.loads(str(xhr.responseText))",'    code = resp["choices"][0]["message"]["content"]',"    # Strip markdown fences if present","    fence = chr(96) * 3","    if code.startswith(fence):",'        lines = code.split("\\n")',"        lines = lines[1:]","        if lines and lines[-1].strip().startswith(fence):","            lines = lines[:-1]",'        code = "\\n".join(lines)',"    return code","","","# patched create()","def _playground_create(description, data=None, outputs=None, inputs=None, actions=None):","    global _widget_counter","    _widget_counter += 1","",'    if isinstance(data, dict) and "_data" in data:','        actual_data = data.get("_data")','        inputs = data.get("_inputs", {})',"        data = actual_data","","    data_summary = None","    data_records = None","    if data is not None:",'        if hasattr(data, "to_dict"):','            data_records = data.to_dict("records")',"            cols = list(data.columns)",`            data_summary = f"DataFrame with {len(data)} rows, columns: {cols}. First 3 rows: {data.head(3).to_dict('records')}"`,'        elif hasattr(data, "tolist"):',"            data_records = data.tolist()",'            data_summary = f"Array with {len(data)} elements"',"        else:","            data_records = data","            data_summary = str(data)[:500]","","    resolved_outputs = None","    if outputs:","        resolved_outputs = {}","        for k, v in outputs.items():",'            resolved_outputs[k] = v.description if hasattr(v, "description") else str(v)',"","    if _api_key and _model:",'        print("Generating widget...")',"        prompt = _build_prompt(description, data_summary, resolved_outputs)","        try:","            code = _call_llm(prompt)","        except Exception as e:",'            print(f"LLM call failed: {e}")',"            return _fallback_create(description, data, data_records, outputs, inputs, actions)","",'        widget_id = f"live_{_widget_counter}"','        widget = WidgetProxy(widget_id, "", resolved_outputs, inputs, actions)',"","        if data_records is not None:",'            widget._traits["data"] = data_records',"        if resolved_outputs:","            for key in resolved_outputs:","                if key not in widget._traits:","                    widget._traits[key] = None","","        widget._generated_code = code",'        print("Widget generated successfully.")',"        return widget","    else:","        return _fallback_create(description, data, data_records, outputs, inputs, actions)","","","def _fallback_create(description, data, data_records, outputs, inputs, actions):","    widget_type, module_url = _match_widget(description)","    if module_url is None:",'        widget_type = f"widget_{_widget_counter}"','        module_url = _WIDGET_URLS.get("scatter")','    widget_id = f"{widget_type}_{_widget_counter}"',"    widget = WidgetProxy(widget_id, module_url, outputs, inputs, actions)","    if data_records is not None:",'        widget._traits["data"] = data_records',"    elif data is not None:",'        if hasattr(data, "to_dict"):','            widget._traits["data"] = data.to_dict("records")','        elif hasattr(data, "tolist"):','            widget._traits["data"] = data.tolist()',"        else:",'            widget._traits["data"] = data',"    if outputs:","        for key in outputs:","            if key not in widget._traits:","                widget._traits[key] = None","    if inputs:","        for trait_name, source_ref in inputs.items():","            if isinstance(source_ref, OutputHandle):","                source_widget_id = source_ref._widget_id","                source_trait_name = source_ref._trait_name","            else:","                source_widget_id = source_ref","                source_trait_name = trait_name","            if source_widget_id in _widgets:","                source_widget = _widgets[source_widget_id]","                if source_trait_name in source_widget._traits:","                    widget._traits[trait_name] = source_widget._traits[source_trait_name]","                else:","                    widget._traits[trait_name] = None","                widget._inputs[trait_name] = source_widget_id","                import js","                js.window._pyodideLinkWidgets(source_widget_id, widget_id, trait_name)","    return widget","","vw.create = _playground_create","","","# patched __repr__ to handle generated code via JS bridge","# Use object.__repr__ as the safe fallback to avoid recursion","","def _live_repr(self):","    # Check __dict__ directly to avoid triggering __getattr__",'    gen_code = self.__dict__.get("_generated_code")',"    if gen_code:","        import js","        js.window._pyodideRegisterGeneratedWidget(","            self._widget_id,","            gen_code,","            json.dumps(self._traits)","        )",'        return f"Widget:{self._widget_id}"',"    # Fall back to the original display-via-module-url path","    if self._module_url:","        import js","        js.window._pyodideDisplayWidget(","            self._widget_id,","            self._module_url,","            json.dumps(self._traits)","        )",'        return f"Widget:{self._widget_id}"',"    return object.__repr__(self)","","WidgetProxy.__repr__ = _live_repr","","def _live_repr_mimebundle(self, **kwargs):",'    gen_code = self.__dict__.get("_generated_code")',"    if gen_code:","        import js","        js.window._pyodideRegisterGeneratedWidget(","            self._widget_id,","            gen_code,","            json.dumps(self._traits)","        )",'        return {"text/plain": f"Widget:{self._widget_id}"}',"    if self._module_url:","        import js","        js.window._pyodideDisplayWidget(","            self._widget_id,","            self._module_url,","            json.dumps(self._traits)","        )",'        return {"text/plain": f"Widget:{self._widget_id}"}','    return {"text/plain": object.__repr__(self)}',"","WidgetProxy._repr_mimebundle_ = _live_repr_mimebundle","",'print("Playground mode enabled. Use vw.config(model=..., api_key=...) to enable live widget generation.")'].join(`
`);await this.pyodide.runPythonAsync(t)}async runPython(e,t){if(!this.pyodide)throw new Error("Pyodide not loaded");this.pyodide.setStdout({batched:i=>{t==null||t(i,"stdout")}}),this.pyodide.setStderr({batched:i=>{t==null||t(i,"stderr")}});try{const i=await this.pyodide.runPythonAsync(e);return i&&i.toJs?i.toJs():i}catch(i){throw t==null||t(i.message,"stderr"),i}}async loadCSV(e,t){const s=await(await fetch(e)).text();await this.pyodide.runPythonAsync(`
import pandas as pd
from io import StringIO
_csv_data = """${s.replace(/"/g,'\\"').replace(/\n/g,"\\n")}"""
${t} = pd.read_csv(StringIO(_csv_data))
del _csv_data
`)}async loadJSON(e,t){const s=await(await fetch(e)).json(),a=JSON.stringify(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'");await this.pyodide.runPythonAsync(`
import pandas as pd
import json
_json_data = json.loads('${a}')
${t} = pd.DataFrame(_json_data)
del _json_data
`)}async loadDataFile(e,t,i){return(i||(e.endsWith(".json")?"json":"csv"))==="json"?this.loadJSON(e,t):this.loadCSV(e,t)}reset(){this.widgetModels.clear()}getState(){return this.state}}class w{constructor(e,t){this.id=e,this.runtime=t,this.traits=new Map,this.listeners=new Map,this.inputs=new Set}get(e){return this.traits.get(e)}set(e,t){const i=this.traits.get(e);this.traits.set(e,t);const s=this.listeners.get(e);if(s){const a={name:e,old:i,new:t};s.forEach(r=>{try{r(a)}catch(d){console.error(d)}})}}save_changes(){this.traits.forEach((e,t)=>{this.runtime.notifyTraitChange(this.id,t,e)})}notifyChange(e,t){this.traits.set(e,t);const i=this.listeners.get(e);if(i){const s={name:e,old:void 0,new:t};i.forEach(a=>{try{a(s)}catch(r){console.error(r)}})}}on(e,t){const i=e.startsWith("change:")?e.slice(7):e,s=this.listeners.get(i)||new Set;s.add(t),this.listeners.set(i,s)}off(e,t){const i=e.startsWith("change:")?e.slice(7):e,s=this.listeners.get(i);s&&s.delete(t)}observe(e,t){(Array.isArray(t)?t:t?[t]:[]).forEach(s=>{this.inputs.add(s),this.on(`change:${s}`,e)})}isInputting(e){return this.inputs.has(e)}registerInput(e,t){this.inputs.add(e)}receiveTraitUpdate(e,t){this.set(e,t)}getId(){return this.id}setInitialData(e){this.traits.set("data",e)}}const h=new f;export{h as p};
