import{j as e}from"./index-CryjOFqx.js";import{D as o}from"./DocMdxPage-PotaL-Qx.js";import"./DocContent-3chbFH74.js";const r={title:"Load & Save",description:"Persist widgets to disk and reload them later."};function i(t){const n={code:"code",h2:"h2",p:"p",pre:"pre",...t.components},{WidgetPreview:d}=n;return d||a("WidgetPreview"),e.jsxs(e.Fragment,{children:[e.jsx(n.p,{children:`Widgets can be saved to disk as portable bundles and reloaded later. This is useful for sharing,
versioning, and avoiding re-generation.`}),`
`,e.jsx(n.h2,{children:"Save a widget"}),`
`,e.jsx(d,{src:"/widgets/scatter_brush.js",height:380}),`
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
files and review code before running.`]})]})}function s(t={}){const{wrapper:n}=t.components||{};return n?e.jsx(n,{...t,children:e.jsx(i,{...t})}):i(t)}function a(t,n){throw new Error("Expected component `"+t+"` to be defined: you likely forgot to import, pass, or provide it.")}const p=()=>e.jsx(o,{Content:s,meta:r});export{p as default};
