import{j as e}from"./index-DW6fP7wU.js";import{D as s}from"./DocMdxPage-DHLXPrOC.js";import"./DocContent-BrPZLS5s.js";const o={title:"Edit",description:"Iterate on generated widgets using code or the UI."};function i(n){const t={a:"a",code:"code",h2:"h2",h3:"h3",p:"p",pre:"pre",...n.components};return e.jsxs(e.Fragment,{children:[e.jsx(t.p,{children:"While developing interactive widgets, we often do not know what to fully specify until after the first version exists. Vibe Widget makes iteration a first-class workflow by letting you edit generated widgets through code or the UI."}),`
`,e.jsx(t.p,{children:"Edits reuse existing code and optionally the theme, then apply requested changes. Each edit produces a new widget instance and persists a new version in the widget store."}),`
`,e.jsx(t.h2,{children:"Python edits"}),`
`,e.jsx(t.p,{children:"Use Python edits when you want structural changes, broader logic refactors, or to preserve edits as code in notebooks and scripts. Python edits are ideal for larger, explicit changes you want to keep versioned and reproducible."}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`v1 = vw.create("basic scatter", df)

# Large or structural changes
v2 = v1.edit("add hover tooltips and a right-side legend")
`})}),`
`,e.jsx(t.p,{children:"Component-level edits are ideal when the widget exposes named subcomponents and you want precise changes without rewriting the full widget."}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`# Example: targeted edits via components
v3 = v1.component.colo_legend.edit("style the legend with a muted palette", inputs=df)
`})}),`
`,e.jsx(t.h2,{children:"UI edits"}),`
`,e.jsx(t.p,{children:"Use UI edits for fast, interactive iteration inside the widget runtime. These are best for targeted adjustments, quick fixes, and diagnostics without switching to code."}),`
`,e.jsx(t.h3,{children:"Source code editing"}),`
`,e.jsx(t.p,{children:"Make precise changes in the generated JS/HTML/CSS when you need direct control over logic or styling."}),`
`,`
`,e.jsx(t.h3,{children:"Visual editing (Edit Element)"}),`
`,e.jsx(t.p,{children:"Select a specific element by its bounding box and issue an edit scoped to that element, using full context from the widget."}),`
`,`
`,e.jsx(t.h3,{children:"Auditing"}),`
`,e.jsxs(t.p,{children:["Detect issues, get recommendations, and optionally turn a concern into a fix request. See ",e.jsx(t.a,{href:"/docs/audit",children:"the Audit docs"})," for more information."]}),`
`]})}function r(n={}){const{wrapper:t}=n.components||{};return t?e.jsx(t,{...n,children:e.jsx(i,{...n})}):i(n)}const h=()=>e.jsx(s,{Content:r,meta:o});export{h as default};
