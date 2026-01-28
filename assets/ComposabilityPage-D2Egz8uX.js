import{j as e}from"./index-BJAQU8i5.js";import{D as a}from"./DocMdxPage-2ZJ1a4cL.js";import"./DocContent-geJ24Wp2.js";const s={title:"Load & Save",description:"Persist widgets to disk and reload them later."};function t(d){const n={code:"code",h2:"h2",p:"p",pre:"pre",...d.components};return e.jsxs(e.Fragment,{children:[e.jsx(n.p,{children:`Widgets can be saved to disk as portable bundles and reloaded later. This is useful for sharing,
versioning, and avoiding re-generation.`}),`
`,e.jsx(n.h2,{children:"Save a widget"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`widget = vw.create("scatter plot with brush selection", df)
widget.save("my_widget.vw")
`})}),`
`,e.jsx(n.p,{children:"Save inputs alongside the widget:"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`widget.save("my_widget_with_inputs.vw", include_inputs=True)
`})}),`
`,e.jsx(n.h2,{children:"Load a widget"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`loaded = vw.load("my_widget.vw")
loaded
`})}),`
`,e.jsx(n.p,{children:"By default, loading uses approval mode so you can review before running:"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`loaded = vw.load("my_widget.vw", approval=True)
`})}),`
`,e.jsx(n.p,{children:"To auto-run a trusted widget:"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`loaded = vw.load("my_widget.vw", approval=False)
`})}),`
`,e.jsx(n.h2,{children:"What gets stored"}),`
`,e.jsxs(n.p,{children:[`Bundles include the widget code, metadata, and output/input signatures. When you save with
`,e.jsx(n.code,{children:"include_inputs=True"}),", input values are embedded in the bundle for reproducible reloads."]}),`
`,e.jsx(n.h2,{children:"Security notes"}),`
`,e.jsxs(n.p,{children:["Loaded widgets can execute JavaScript in the notebook frontend. Keep ",e.jsx(n.code,{children:"approval=True"}),` for untrusted
files and review code before running.`]})]})}function i(d={}){const{wrapper:n}=d.components||{};return n?e.jsx(n,{...d,children:e.jsx(t,{...d})}):t(d)}const c=()=>e.jsx(a,{Content:i,meta:s});export{c as default};
