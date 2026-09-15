import{j as e}from"./index-Ag879TfP.js";import{D as r}from"./DocMdxPage-C1Xb4fjc.js";import"./DocContent-ClmzcaAj.js";const a={title:"Reactivity",description:"Send values into a widget, read values back out, and link widgets together."};function i(n){const t={code:"code",h2:"h2",p:"p",pre:"pre",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",...n.components},{WidgetPreview:s}=t;return s||o("WidgetPreview"),e.jsxs(e.Fragment,{children:[e.jsx(t.p,{children:`Values move between Python and a widget in three ways. An input carries a value from Python into the
widget and stays set. An output carries a value from the widget back to Python and also stays set. An
action sends a one-time command from Python to the widget and leaves nothing behind.`}),`
`,e.jsxs(t.table,{children:[e.jsx(t.thead,{children:e.jsxs(t.tr,{children:[e.jsx(t.th,{children:"Primitive"}),e.jsx(t.th,{children:"Direction"}),e.jsx(t.th,{children:"Persistence"}),e.jsx(t.th,{children:"Use for"})]})}),e.jsxs(t.tbody,{children:[e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"Input"}),e.jsx(t.td,{children:"Python to JS"}),e.jsx(t.td,{children:"State, sticky"}),e.jsx(t.td,{children:"Data, configuration, selections from other widgets"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"Output"}),e.jsx(t.td,{children:"JS to Python"}),e.jsx(t.td,{children:"State, sticky"}),e.jsx(t.td,{children:"User selections, computed values, filters"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"Action"}),e.jsx(t.td,{children:"Python to JS"}),e.jsx(t.td,{children:"Event, fires once"}),e.jsx(t.td,{children:"Commands such as reset, focus, export"})]})]})]}),`
`,e.jsx(t.h2,{children:"Inputs"}),`
`,e.jsxs(t.p,{children:["You declare inputs when you create the widget, either with ",e.jsx(t.code,{children:"vw.inputs(...)"}),` or with a plain dict. An
input keeps its value until you change it.`]}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`chart = vw.create(
    "scatter plot that dims points below the threshold",
    df,
    inputs=vw.inputs(df, threshold=0.5),
)
`})}),`
`,e.jsxs(t.p,{children:[e.jsx(t.code,{children:"vw.inputs()"}),` takes keyword arguments and bare positional values. A positional value is named after
the variable you passed, so `,e.jsx(t.code,{children:"vw.inputs(df, threshold=0.5)"})," declares inputs called ",e.jsx(t.code,{children:"df"}),` and
`,e.jsx(t.code,{children:"threshold"}),"."]}),`
`,e.jsx(t.p,{children:`Every declared input becomes a synced trait on the widget, so assigning a new value updates the
widget without regenerating any code:`}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`chart.threshold = 0.8
`})}),`
`,e.jsx(t.p,{children:`Direct assignment sends the value as it is, so it expects something JSON-friendly, meaning numbers,
strings, booleans, lists and dicts. NumPy arrays, NumPy scalars and timestamps are converted for you
when the widget is created but not on later assignment, so run them through the same helper:`}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`from vibe_widget.utils.serialization import clean_for_json

chart.frame = clean_for_json(numpy_array)
`})}),`
`,e.jsx(t.p,{children:"To swap the underlying dataset, rerun the widget instead of assigning to an input."}),`
`,e.jsx(t.h2,{children:"Rerunning with new data"}),`
`,e.jsxs(t.p,{children:[e.jsx(t.code,{children:"vw.create"}),` returns a handle, and calling that handle runs the same generated code against different
data or inputs, with no second model call:`]}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`chart = vw.create("scatter plot with brush selection", df)

chart(new_df)                          # same widget, different data
chart(vw.inputs(threshold=0.7))        # merges with the inputs already declared
chart(inputs={"threshold": 0.7})       # replaces the declared inputs
`})}),`
`,e.jsxs(t.p,{children:["A positional ",e.jsx(t.code,{children:"vw.inputs(...)"}),` bundle merges into the inputs the widget was created with, while the
`,e.jsx(t.code,{children:"inputs="}),` keyword replaces them. When the new dataset is missing a column the widget was built
against, the rerun raises a `,e.jsx(t.code,{children:"ValueError"}),` naming the missing columns rather than drawing a broken
chart.`]}),`
`,e.jsx(t.h2,{children:"Outputs"}),`
`,e.jsx(t.p,{children:"An output carries a value the widget produced back to Python, and like an input it keeps its value."}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`# Read the current selection
print(widget.outputs.selected_indices.value)

# React to changes
def on_selection(change):
    print(f"Selection changed: {change.new}")

widget.outputs.selected_indices.observe(on_selection)

# Stop listening
widget.outputs.selected_indices.unobserve(on_selection)
`})}),`
`,e.jsxs(t.p,{children:["The handler receives the traitlets change object, which carries ",e.jsx(t.code,{children:"new"}),", ",e.jsx(t.code,{children:"old"}),", ",e.jsx(t.code,{children:"name"})," and ",e.jsx(t.code,{children:"owner"}),"."]}),`
`,e.jsx(t.h2,{children:"Actions"}),`
`,e.jsx(t.p,{children:`An action is a one-time command from Python to the widget, for behavior that should happen once
rather than persist as state.`}),`
`,e.jsx(s,{src:"/widgets/scatter_actions.js",height:380}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`widget = vw.create(
    "interactive scatter plot",
    df,
    actions=vw.actions(reset_view="Reset zoom and pan")
)

widget.actions.reset_view()
`})}),`
`,e.jsx(t.p,{children:"Once an action fires it is finished, and the widget holds no record that it was reset."}),`
`,e.jsx(t.h2,{children:"Choosing between them"}),`
`,e.jsx(t.p,{children:`Ask whether the value should stick around. When it should, use an input if the value comes from
Python and an output if it comes from the widget. When it should not, use an action.`}),`
`,e.jsx(t.p,{children:"Modelling a one-time command as an input makes it sticky, which is usually wrong:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`# Avoid this
widget.should_reset = True
`})}),`
`,e.jsx(t.p,{children:`The widget would reset and then keep resetting, because the input is still true. An action fires
once and leaves nothing set, which avoids the problem.`}),`
`,e.jsx(t.h2,{children:"Linking widgets together"}),`
`,e.jsx(t.p,{children:"To connect two widgets, pass one widget's output as another widget's input."}),`
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
`,e.jsx(t.p,{children:`Selecting points in the scatter plot updates the histogram through trait syncing. Nothing reruns and
no model call happens, because the link is a Python observer on the source output that writes
straight into the target input.`}),`
`,e.jsx(t.p,{children:`A link runs one way, from the named output to the named input. To link in both directions, declare
an output on each widget and an input on the other.`})]})}function d(n={}){const{wrapper:t}=n.components||{};return t?e.jsx(t,{...n,children:e.jsx(i,{...n})}):i(n)}function o(n,t){throw new Error("Expected component `"+n+"` to be defined: you likely forgot to import, pass, or provide it.")}const u=()=>e.jsx(r,{Content:d,meta:a});export{u as default};
