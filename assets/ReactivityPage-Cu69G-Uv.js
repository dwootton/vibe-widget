import{j as e}from"./index-B4z5kDSy.js";import{D as r}from"./DocMdxPage-DDr1xgCs.js";import"./DocContent-CBrQcdvq.js";const o={title:"Reactivity",description:"Connect widgets with reactive inputs and outputs."};function i(n){const t={code:"code",h2:"h2",h3:"h3",li:"li",p:"p",pre:"pre",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...n.components},{WidgetPreview:s}=t;return s||a("WidgetPreview"),e.jsxs(e.Fragment,{children:[e.jsx(t.p,{children:`Vibe Widgets stay synchronized with Python through a simple reactivity model. This page explains how
data flows between your notebook and your widgets and how to wire widgets together.`}),`
`,e.jsx(t.h2,{children:"The three primitives"}),`
`,e.jsxs(t.table,{children:[e.jsx(t.thead,{children:e.jsxs(t.tr,{children:[e.jsx(t.th,{children:"Primitive"}),e.jsx(t.th,{children:"Direction"}),e.jsx(t.th,{children:"Persistence"}),e.jsx(t.th,{children:"Use for"})]})}),e.jsxs(t.tbody,{children:[e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"Input"}),e.jsx(t.td,{children:"Python → JS"}),e.jsx(t.td,{children:"State (sticky)"}),e.jsx(t.td,{children:"Data, configuration, selections from other widgets"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"Output"}),e.jsx(t.td,{children:"JS → Python"}),e.jsx(t.td,{children:"State (sticky)"}),e.jsx(t.td,{children:"User selections, computed values, filters"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"Action"}),e.jsx(t.td,{children:"Python → JS"}),e.jsx(t.td,{children:"Event (fire-once)"}),e.jsx(t.td,{children:"Commands like reset, focus, export"})]})]})]}),`
`,e.jsx(t.h3,{children:"Inputs"}),`
`,e.jsxs(t.p,{children:[`Inputs are values that flow into your widget from Python. You declare them when you create the
widget, either with `,e.jsx(t.code,{children:"vw.inputs(...)"}),` or with a plain dict. Inputs are persistent: the widget holds
onto the value until you change it.`]}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`chart = vw.create(
    "scatter plot that dims points below the threshold",
    df,
    inputs=vw.inputs(df, threshold=0.5),
)
`})}),`
`,e.jsxs(t.p,{children:[e.jsx(t.code,{children:"vw.inputs()"}),` takes keyword arguments and also bare positional values. A positional value is named
after the variable you passed, so `,e.jsx(t.code,{children:"vw.inputs(df, threshold=0.5)"})," declares inputs called ",e.jsx(t.code,{children:"df"}),` and
`,e.jsx(t.code,{children:"threshold"}),"."]}),`
`,e.jsx(t.p,{children:`Every declared input becomes a synced trait on the widget, so you can assign a new value directly
and the widget updates without regenerating any code:`}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`chart.threshold = 0.8
`})}),`
`,e.jsx(t.p,{children:`Direct assignment sends the value as-is, so it expects something JSON-friendly: numbers, strings,
booleans, lists, and dicts. NumPy arrays, NumPy scalars and timestamps are converted for you when
the widget is created but not on later assignment, so run them through the same helper:`}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`from vibe_widget.utils.serialization import clean_for_json

chart.frame = clean_for_json(numpy_array)
`})}),`
`,e.jsx(t.p,{children:"To swap the underlying dataset, rerun the widget instead."}),`
`,e.jsx(t.h3,{children:"Rerunning with new data"}),`
`,e.jsxs(t.p,{children:[e.jsx(t.code,{children:"vw.create"}),` returns a handle. Calling that handle reruns the widget with different data or inputs
and reuses the code that was already generated, so there is no second model call:`]}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`chart = vw.create("scatter plot with brush selection", df)

chart(new_df)                          # same widget, different data
chart(vw.inputs(threshold=0.7))        # merges with the inputs already declared
chart(inputs={"threshold": 0.7})       # replaces the declared inputs
`})}),`
`,e.jsxs(t.p,{children:["A positional ",e.jsx(t.code,{children:"vw.inputs(...)"}),` bundle merges into the inputs the widget was created with. The
`,e.jsx(t.code,{children:"inputs="}),` keyword replaces them. If the new dataset is missing a column the widget was built
against, the rerun raises a `,e.jsx(t.code,{children:"ValueError"}),` naming the missing columns rather than rendering a broken
chart.`]}),`
`,e.jsx(t.h3,{children:"Outputs"}),`
`,e.jsx(t.p,{children:`Outputs are values that flow out of your widget to Python. Use them for anything the widget
produces that Python might care about. Like inputs, outputs are persistent state.`}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`# Read the current selection
print(widget.outputs.selected_indices.value)

# React to changes
def on_selection(change):
    print(f"Selection changed: {change.new}")

widget.outputs.selected_indices.observe(on_selection)

# Stop listening
widget.outputs.selected_indices.unobserve(on_selection)
`})}),`
`,e.jsxs(t.p,{children:["The handler receives the traitlets change object, which carries ",e.jsx(t.code,{children:"new"}),", ",e.jsx(t.code,{children:"old"}),", ",e.jsx(t.code,{children:"name"}),", and ",e.jsx(t.code,{children:"owner"}),"."]}),`
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
`,e.jsx(t.p,{children:"If you model a one-time command as an input, it becomes sticky:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`# Avoid this
widget.should_reset = True
`})}),`
`,e.jsx(t.p,{children:`The widget would reset and keep resetting because the input is still true. Actions avoid that
behavior by firing once and not lingering.`}),`
`,e.jsx(t.h2,{children:"Wiring widgets together"}),`
`,e.jsx(t.p,{children:`The real power of this model shows up when you connect widgets. Pass one widget's output as
another widget's input:`}),`
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
`,e.jsx(t.p,{children:`When you select points in the scatter plot, the histogram updates through trait syncing. Nothing
reruns and no model call happens: the link is a Python observer on the source output that writes
straight into the target input.`}),`
`,e.jsx(t.p,{children:`The link is one-way, from the named output to the named input. To link in both directions, declare
an output on each widget and an input on the other.`})]})}function d(n={}){const{wrapper:t}=n.components||{};return t?e.jsx(t,{...n,children:e.jsx(i,{...n})}):i(n)}function a(n,t){throw new Error("Expected component `"+n+"` to be defined: you likely forgot to import, pass, or provide it.")}const u=()=>e.jsx(r,{Content:d,meta:o});export{u as default};
