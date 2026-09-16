import{j as e}from"./index-CkRJxMr7.js";import{D as i}from"./DocMdxPage-BHZwN-Z3.js";import"./DocContent-DGIgVrr-.js";const r={title:"Audit",description:"Ask a second model call to review a generated widget and report what it finds."};function s(n){const t={code:"code",h2:"h2",li:"li",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...n.components};return e.jsxs(e.Fragment,{children:[e.jsxs(t.p,{children:[`An audit is a second model call that reads the generated code and writes up what it notices. The
findings are that model's opinion. No static analysis runs behind them, and the package never
consults an audit before code executes, so an audit reads like a colleague's comments on a pull
request. To gate execution on your own reading of the code, use `,e.jsx(t.code,{children:'vw.config(execution="approve")'}),"."]}),`
`,e.jsx(t.h2,{children:"Running an audit"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`report = widget.audit(level="fast", display=False)
full_report = widget.audit(level="full", reuse=True, display=False)
`})}),`
`,e.jsxs(t.p,{children:["A ",e.jsx(t.code,{children:"fast"})," audit is a quick scan meant for early iteration, and a ",e.jsx(t.code,{children:"full"}),` audit covers more ground and
suggests alternatives for the choices it flags. `,e.jsx(t.code,{children:"reuse=True"}),` returns the stored report when the code
has not changed since the last audit, instead of paying for another call.`]}),`
`,e.jsxs(t.p,{children:["Audits never run on their own. Nothing is sent to the model until you call ",e.jsx(t.code,{children:"widget.audit(...)"}),` or
press the audit button in the widget's editor.`]}),`
`,e.jsx(t.h2,{children:"What the report covers"}),`
`,e.jsx(t.p,{children:"Each finding is filed under one of four areas of the widget."}),`
`,e.jsxs(t.table,{children:[e.jsx(t.thead,{children:e.jsxs(t.tr,{children:[e.jsx(t.th,{children:"Area"}),e.jsx(t.th,{children:"What it covers"})]})}),e.jsxs(t.tbody,{children:[e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"Data"}),e.jsx(t.td,{children:"Selection, transformation, format, provenance"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"Computation"}),e.jsx(t.td,{children:"Method, parameters, assumptions, execution"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"Presentation"}),e.jsx(t.td,{children:"Encoding, scale, compression, framing"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"Interaction"}),e.jsx(t.td,{children:"Triggers, state, propagation, feedback"})]})]})]}),`
`,e.jsxs(t.p,{children:["A finding is scoped with an id such as ",e.jsx(t.code,{children:"data.transformation.date_parsing"}),`, and it carries the line
numbers in the generated code that it refers to, so you can go straight to the place it describes.`]}),`
`,e.jsx(t.h2,{children:"The seven lenses"}),`
`,e.jsxs(t.p,{children:["In a ",e.jsx(t.code,{children:"full"}),` audit every finding is also rated along seven fixed lenses, which is what makes one
finding comparable to another. A `,e.jsx(t.code,{children:"fast"})," audit reports findings without them."]}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Impact"}),", rated high, medium or low, answers whether a different choice would change the conclusions a reader draws."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Uncertainty"})," covers confidence, sample size and stability."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Reproducibility"})," asks whether the result can be recreated exactly."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Edge behavior"})," covers empty, extreme and boundary inputs."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Default vs explicit"})," separates a choice you made from an assumption the model made for you."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Appropriateness"})," asks whether the method suits the question."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Safety"})," covers network calls, dynamic code execution, writes to storage, cross-origin fetches, and injected scripts or iframes."]}),`
`]}),`
`,e.jsx(t.p,{children:`The model is told to keep high impact rare and to default to low unless there is clear evidence, so
most reports come back full of low-impact findings.`}),`
`,e.jsx(t.h2,{children:"Where reports are stored"}),`
`,e.jsxs(t.p,{children:["Reports are written to ",e.jsx(t.code,{children:".vibewidget/audits/"}),` as JSON and YAML. The directory is listed in
`,e.jsx(t.code,{children:".vibewidget/.gitignore"}),`, so reports stay on the machine that ran them rather than going into your
repository.`]}),`
`,e.jsx(t.h2,{children:"Working from an audit"}),`
`,e.jsx(t.p,{children:`In the widget's editor, findings are shown as a checklist next to the code. You can turn any one of
them into an edit request, which sends the finding back to the model as the instruction for a fix,
or leave it on the list as a note for later.`})]})}function o(n={}){const{wrapper:t}=n.components||{};return t?e.jsx(t,{...n,children:e.jsx(s,{...n})}):s(n)}const h=()=>e.jsx(i,{Content:o,meta:r});export{h as default};
