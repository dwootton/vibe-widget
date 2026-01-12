import{j as e}from"./index-DW6fP7wU.js";import{D as n}from"./DocMdxPage-DHLXPrOC.js";import"./DocContent-BrPZLS5s.js";const r={title:"Audit",description:"Review widget code and behavior for risks, usability issues, and design gaps."};function i(s){const t={code:"code",h2:"h2",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",...s.components};return e.jsxs(e.Fragment,{children:[e.jsx(t.p,{children:"Audits review widget code and behavior through a set of lenses to surface risks, usability issues, and design gaps before you ship."}),`
`,e.jsx(t.h2,{children:"Audit framework"}),`
`,e.jsx(t.p,{children:"Each audit runs across domains and lenses so you get feedback that is both technical and experiential."}),`
`,e.jsxs(t.table,{children:[e.jsx(t.thead,{children:e.jsxs(t.tr,{children:[e.jsx(t.th,{children:"Domain"}),e.jsx(t.th,{children:"What It Covers"}),e.jsx(t.th,{children:"Key Questions"})]})}),e.jsxs(t.tbody,{children:[e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"DATA"}),e.jsxs(t.td,{children:["Input, filtering, transformations, formatting. Subdomains: ",e.jsx(t.code,{children:"data.input"}),", ",e.jsx(t.code,{children:"data.filtering"}),", ",e.jsx(t.code,{children:"data.transformations"}),", ",e.jsx(t.code,{children:"data.formatting"}),"."]}),e.jsx(t.td,{children:"What goes in? What gets dropped? How is it changed?"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"COMPUTATION"}),e.jsxs(t.td,{children:["Algorithms, parameters, assumptions. Subdomains: ",e.jsx(t.code,{children:"computation.algorithm"}),", ",e.jsx(t.code,{children:"computation.parameters"}),", ",e.jsx(t.code,{children:"computation.assumptions"}),"."]}),e.jsx(t.td,{children:"What runs? With what settings? What does it assume?"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"PRESENTATION"}),e.jsxs(t.td,{children:["Visual encoding, scales, projection. Subdomains: ",e.jsx(t.code,{children:"presentation.encoding"}),", ",e.jsx(t.code,{children:"presentation.scales"}),", ",e.jsx(t.code,{children:"presentation.projection"}),"."]}),e.jsx(t.td,{children:"How are results shown? What is hidden or over-emphasized?"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"INTERACTION"}),e.jsxs(t.td,{children:["Triggers, state, propagation. Subdomains: ",e.jsx(t.code,{children:"interaction.triggers"}),", ",e.jsx(t.code,{children:"interaction.state"}),", ",e.jsx(t.code,{children:"interaction.propagation"}),"."]}),e.jsx(t.td,{children:"What changes on input? What persists? What updates downstream?"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"SYSTEM"}),e.jsxs(t.td,{children:["Accessibility, performance, reliability. Subdomains: ",e.jsx(t.code,{children:"system.accessibility"}),", ",e.jsx(t.code,{children:"system.performance"}),", ",e.jsx(t.code,{children:"system.reliability"}),"."]}),e.jsx(t.td,{children:"Is it usable for everyone? Is it fast and stable?"})]})]})]}),`
`,e.jsxs(t.p,{children:["Each domain is reviewed at a second level to pinpoint the issue scope, such as ",e.jsx(t.code,{children:"data.transformations"})," or ",e.jsx(t.code,{children:"computation.parameters.bin_size"}),", so fixes stay targeted and explainable."]}),`
`,e.jsx(t.h2,{children:"Audit lenses"}),`
`,e.jsx(t.p,{children:"Lenses are the perspectives applied during auditing. You can think of them as different expert reviews running together, such as accessibility, data integrity, or interaction design."}),`
`,e.jsx(t.h2,{children:"Fast vs full audits"}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"Fast"})," audits provide quick issue scans for early iteration. ",e.jsx(t.strong,{children:"Full"})," audits dig deeper with alternatives and higher coverage for pre-share polish."]}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`# Fast audit for quick checks
report = widget.audit(level="fast", display=False)

# Full audit for deeper review
full_report = widget.audit(level="full", reuse=True, display=False)
`})}),`
`,e.jsxs(t.p,{children:["Audit outputs are stored in ",e.jsx(t.code,{children:".vibewidget/audits"})," as JSON and YAML."]}),`
`,e.jsx(t.h2,{children:"How to use auditing"}),`
`,e.jsx(t.p,{children:"You can run audits from Python to get a structured report without needing to run the widget UI."}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`# Run a fast audit and return a report
report = widget.audit(level="fast", display=False)

# Deep audit for detailed alternatives
full_report = widget.audit(level="full", reuse=True, display=False)
`})}),`
`,e.jsxs(t.p,{children:["In the UI, audit recommendations can be surfaced as a checklist inside the ",e.jsx(t.code,{children:"Edit Code"})," view. You can then turn a specific concern into an edit request or keep it as a TODO for later."]}),`
`,`
`,`
`,`
`,`
`,`
`,`
`]})}function d(s={}){const{wrapper:t}=s.components||{};return t?e.jsx(t,{...s,children:e.jsx(i,{...s})}):i(s)}const l=()=>e.jsx(n,{Content:d,meta:r});export{l as default};
