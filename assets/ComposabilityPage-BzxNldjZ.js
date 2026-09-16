import{j as e}from"./index-CkRJxMr7.js";import{D as i}from"./DocMdxPage-BHZwN-Z3.js";import"./DocContent-DGIgVrr-.js";const s={title:"Load & Save",description:"Store widgets on disk, share them through git, and reload them later."};function d(n){const t={code:"code",h2:"h2",p:"p",pre:"pre",...n.components},{WidgetPreview:o}=t;return o||a("WidgetPreview"),e.jsxs(e.Fragment,{children:[e.jsx(t.p,{children:`A widget can be written to a single portable file, and generated code is also kept in your project
so that a later call reuses it. Both let you come back to a widget without paying for another model
call.`}),`
`,e.jsx(t.h2,{children:"Save a widget"}),`
`,e.jsx(o,{src:"/widgets/scatter_brush.js",height:380}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`widget = vw.create("scatter plot with brush selection", df)
widget.save("my_widget.vw")
`})}),`
`,e.jsx(t.p,{children:"To store the input values alongside the code, so the widget reloads showing the same state:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`widget.save("my_widget_with_inputs.vw", include_inputs=True)
`})}),`
`,e.jsxs(t.p,{children:["A ",e.jsx(t.code,{children:".vw"}),` bundle holds the widget code, its metadata, and the signatures of its inputs and outputs.
With `,e.jsx(t.code,{children:"include_inputs=True"})," the input values are embedded as well."]}),`
`,e.jsx(t.h2,{children:"Load a widget"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`loaded = vw.load("my_widget.vw")
loaded
`})}),`
`,e.jsx(t.p,{children:"Loading uses approval mode by default, so you can read the code before it runs:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`loaded = vw.load("my_widget.vw", approval=True)
`})}),`
`,e.jsx(t.p,{children:"For a file you trust and want to run straight away:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`loaded = vw.load("my_widget.vw", approval=False)
`})}),`
`,e.jsxs(t.p,{children:["Calling ",e.jsx(t.code,{children:"vw.load()"})," with no path opens a selector listing the widgets cached in your project."]}),`
`,e.jsx(t.h2,{children:"Sharing through git"}),`
`,e.jsxs(t.p,{children:["Generated code is stored under ",e.jsx(t.code,{children:".vibewidget/"})," in your project, as one ",e.jsx(t.code,{children:".js"})," file and one ",e.jsx(t.code,{children:".json"}),`
sidecar per widget. Commit `,e.jsx(t.code,{children:".vibewidget/widgets/"}),` and a collaborator who clones the repository gets
your widgets with it. Opening one of them makes no model call, so a collaborator needs no API key
until they generate, edit, or audit something themselves.`]}),`
`,e.jsxs(t.p,{children:["Audit reports are written to ",e.jsx(t.code,{children:".vibewidget/audits/"}),", which is listed in ",e.jsx(t.code,{children:".vibewidget/.gitignore"}),`, so
reports stay on the machine that produced them.`]}),`
`,e.jsx(t.h2,{children:"Clearing what is stored"}),`
`,e.jsxs(t.p,{children:[e.jsx(t.code,{children:"vw.clear()"}),` deletes cached widgets and audit reports, forgets the themes generated this session,
and returns a count of what it removed.`]}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`vw.clear()            # everything
vw.clear("widgets")   # generated widget code only
vw.clear("audits")    # audit reports only
vw.clear("themes")    # forget themes generated this session
vw.clear(widget)      # just that widget's code and audits
vw.clear("sales_chart")  # the same, by variable name
`})}),`
`,e.jsxs(t.p,{children:["Themes you saved with ",e.jsx(t.code,{children:"Theme.save"})," are files in ",e.jsx(t.code,{children:".vibewidget/themes/"}),` and are not removed by
`,e.jsx(t.code,{children:"vw.clear"}),". Delete the file when you want one gone for good."]}),`
`,e.jsx(t.h2,{children:"Before you run a file someone sent you"}),`
`,e.jsxs(t.p,{children:[`A loaded widget executes JavaScript in your notebook with the privileges of the notebook page. Keep
`,e.jsx(t.code,{children:"approval=True"})," for any file you did not generate yourself, and read the code before approving it."]})]})}function r(n={}){const{wrapper:t}=n.components||{};return t?e.jsx(t,{...n,children:e.jsx(d,{...n})}):d(n)}function a(n,t){throw new Error("Expected component `"+n+"` to be defined: you likely forgot to import, pass, or provide it.")}const g=()=>e.jsx(i,{Content:r,meta:s});export{g as default};
