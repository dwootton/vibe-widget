import{j as e}from"./index-CkRJxMr7.js";import{D as a}from"./DocMdxPage-BHZwN-Z3.js";import"./DocContent-DGIgVrr-.js";const o={title:"Edit",description:"Change a generated widget with a follow-up prompt, in Python or in the widget itself."};function i(t){const n={a:"a",code:"code",h2:"h2",p:"p",pre:"pre",...t.components};return e.jsxs(e.Fragment,{children:[e.jsxs(n.p,{children:[e.jsx(n.code,{children:"widget.edit(...)"}),` describes a change in plain language and returns a new widget with that change
applied. The existing code goes to the model along with your instruction, so the model revises what
is there rather than starting over, and the parts you did not mention stay as they were.`]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`chart = vw.create("scatter plot of price against mileage", df)

v2 = chart.edit("add hover tooltips and a right-side legend")
`})}),`
`,e.jsx(n.p,{children:`An edit keeps the theme of the widget it came from, along with its prompt history, so the look stays
consistent while you change behavior. Inputs, outputs and actions are not carried over, so declare
again any that the new version still needs. To change the look at the same time, pass a different
theme:`}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`v3 = v2.edit("soften the palette and reduce gridlines", theme="minimal")
`})}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"vw.edit(description, source)"}),` does the same thing when you would rather name the source
explicitly, and the source can be a widget, a handle, or a path to a saved `,e.jsx(n.code,{children:".vw"})," file."]}),`
`,e.jsx(n.h2,{children:"Editing one component"}),`
`,e.jsx(n.p,{children:"A generated widget is often made of several pieces, and you can list them and work on one at a time."}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`widget.components
# ['scatter_chart', 'color_legend', 'slider']

widget.component.color_legend                                  # renders on its own
widget.component.color_legend.edit("use a horizontal layout")
`})}),`
`,e.jsxs(n.p,{children:["Each entry in ",e.jsx(n.code,{children:"widget.component"})," is a widget in its own right, so it has the same ",e.jsx(n.code,{children:"edit"})," and ",e.jsx(n.code,{children:"save"}),`
methods as the whole thing, and it renders when it is the last expression in a cell.`]}),`
`,e.jsx(n.h2,{children:"Editing inside the widget"}),`
`,e.jsxs(n.p,{children:[`Every rendered widget has an editor. Opening it shows the generated code, a prompt box for the next
change, and the audit findings when an audit has been run. An edit made in the editor updates the
same widget in place, and the new code is stored in `,e.jsx(n.code,{children:".vibewidget/"})," the way a generated widget is."]}),`
`,e.jsx(n.p,{children:`In approve mode the editor is also where you read the code and approve it, so nothing runs until you
have seen it.`}),`
`,e.jsx(n.h2,{children:"Reading the history"}),`
`,e.jsx(n.p,{children:`Every prompt that shaped a widget is kept in order, which is useful when a widget has been through
several rounds and you want to know how it got there.`}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`widget.prompt_history
`})}),`
`,e.jsx(n.h2,{children:"Cost"}),`
`,e.jsxs(n.p,{children:[`An edit is a model call, so it is billed like a generation. Reruns with new data are not, because
they reuse the code that already exists. See `,e.jsx(n.a,{href:"/docs/reactivity",children:"Reactivity"}),` for reruns, and
`,e.jsx(n.a,{href:"/docs/theming",children:"Theming"})," for keeping a consistent look across edits."]})]})}function s(t={}){const{wrapper:n}=t.components||{};return n?e.jsx(n,{...t,children:e.jsx(i,{...t})}):i(t)}const c=()=>e.jsx(a,{Content:s,meta:o});export{c as default};
