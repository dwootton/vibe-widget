import{j as e}from"./index-CHIWwMwg.js";import{D as o}from"./DocMdxPage-D_ZhWgKN.js";import"./DocContent-7XeB-9Bn.js";const r={title:"Reactivity",description:"Connect widgets with reactive inputs and outputs."};function i(n){const t={code:"code",h2:"h2",h3:"h3",li:"li",p:"p",pre:"pre",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...n.components},{WidgetPreview:s}=t;return s||c("WidgetPreview"),e.jsxs(e.Fragment,{children:[e.jsx(t.p,{children:`Vibe Widgets stay synchronized with Python through a simple reactivity model. This page explains how
data flows between your notebook and your widgets and how to wire widgets together.`}),`
`,e.jsx(t.h2,{children:"The three primitives"}),`
`,e.jsxs(t.table,{children:[e.jsx(t.thead,{children:e.jsxs(t.tr,{children:[e.jsx(t.th,{children:"Primitive"}),e.jsx(t.th,{children:"Direction"}),e.jsx(t.th,{children:"Persistence"}),e.jsx(t.th,{children:"Use for"})]})}),e.jsxs(t.tbody,{children:[e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"Input"}),e.jsx(t.td,{children:"Python → JS"}),e.jsx(t.td,{children:"State (sticky)"}),e.jsx(t.td,{children:"Data, configuration, selections from other widgets"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"Output"}),e.jsx(t.td,{children:"JS → Python"}),e.jsx(t.td,{children:"State (sticky)"}),e.jsx(t.td,{children:"User selections, computed values, filters"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"Action"}),e.jsx(t.td,{children:"Python → JS"}),e.jsx(t.td,{children:"Event (fire-once)"}),e.jsx(t.td,{children:"Commands like reset, focus, export"})]})]})]}),`
`,e.jsx(t.h3,{children:"Inputs"}),`
`,e.jsx(t.p,{children:`Inputs are values that flow into your widget from Python. Use them for anything the widget needs to
display or respond to. Inputs are persistent: the widget holds onto the value until you change it.`}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`# Set an input from Python
widget.inputs.threshold = 0.5
widget.inputs.data = new_df # resets the data in the widget
`})}),`
`,e.jsx(t.p,{children:"You can also wire one widget's output to another widget's input:"}),`
`,e.jsx(s,{src:"/widgets/scatter_brush_linked.js",height:340}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`# Slider selection flows into chart's highlight
chart = vw.create(
    "scatter plot with brush selection",
    df,
    outputs=vw.outputs(selected_indices="indices of selected points")
)

histogram = vw.create(
    "histogram with highlighted bars for selected data",
    vw.inputs(df, selected_indices=chart.outputs.selected_indices)
)
`})}),`
`,e.jsx(t.h3,{children:"Outputs"}),`
`,e.jsx(t.p,{children:`Outputs are values that flow out of your widget to Python. Use them for anything the widget
produces that Python might care about. Like inputs, outputs are persistent state.`}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`# Read the current selection
print(widget.outputs.selected_indices.value)

# React to changes
def on_selection(change):
    print(f"Selection changed: {change.new}")

widget.outputs.selected_indices.observe(on_selection)
`})}),`
`,e.jsx(t.h3,{children:"Actions"}),`
`,e.jsx(t.p,{children:`Actions are one-time commands from Python to the widget. Use them for behavior that should happen
once, not persist as state.`}),`
`,e.jsx(s,{src:"/widgets/scatter_actions.js",height:380}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`widget = vw.create(
    "interactive scatter plot",
    df,
    actions=vw.actions(reset_view="Reset zoom and pan")
)

widget.actions.reset_view()
`})}),`
`,e.jsx(t.p,{children:`After an action fires, it's done. The widget doesn't "remember" that it was reset.`}),`
`,e.jsx(t.h2,{children:"Choosing the right primitive"}),`
`,e.jsx(t.p,{children:"Ask yourself: should this value stick around?"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsx(t.li,{children:"Yes → Input or Output. Use input if the value comes from Python; use output if it comes from the widget."}),`
`,e.jsx(t.li,{children:"No → Action. Use an action if it's a one-time command."}),`
`]}),`
`,e.jsx(t.p,{children:"If you try to model a one-time command as an input, it becomes sticky:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`# Avoid this
widget.inputs.should_reset = True
`})}),`
`,e.jsx(t.p,{children:`The widget would reset and keep resetting because the input is still true. Actions avoid that
behavior by firing once and not lingering.`}),`
`,e.jsx(t.h2,{children:"Wiring widgets together"}),`
`,e.jsx(t.p,{children:"The real power of this model shows up when you connect widgets:"}),`
`,e.jsx(s,{src:"/widgets/scatter_brush_linked.js",height:340}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`scatter = vw.create(
    "scatter plot with brush selection tool",
    df,
    outputs=vw.outputs(selected_indices="indices of selected points")
)

histogram = vw.create(
    "histogram with highlighted bars for selected data",
    vw.inputs(df, selected_indices=scatter.outputs.selected_indices)
)
`})}),`
`,e.jsxs(t.p,{children:[`When you select points in the scatter plot, the histogram updates via trait syncing without requiring any additional runs. Outputs are
exposed under `,e.jsx(t.code,{children:"widget.outputs.<name>"}),"."]})]})}function d(n={}){const{wrapper:t}=n.components||{};return t?e.jsx(t,{...n,children:e.jsx(i,{...n})}):i(n)}function c(n,t){throw new Error("Expected component `"+n+"` to be defined: you likely forgot to import, pass, or provide it.")}const u=()=>e.jsx(o,{Content:d,meta:r});export{u as default};
