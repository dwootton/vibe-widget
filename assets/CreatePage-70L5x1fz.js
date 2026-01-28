import{j as e}from"./index-BJAQU8i5.js";import{D as r}from"./DocMdxPage-2ZJ1a4cL.js";import"./DocContent-geJ24Wp2.js";const s={title:"Create",description:"Create widgets from natural language prompts and data sources."};function a(t){const n={a:"a",code:"code",h2:"h2",p:"p",pre:"pre",...t.components};return e.jsxs(e.Fragment,{children:[e.jsx(n.p,{children:"Create widgets from natural language prompts and data sources."}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`import vibe_widget as vw

widget = vw.create(
    "bar chart of revenue by region",
    df
)

widget
`})}),`
`,e.jsx(n.h2,{children:"Themes"}),`
`,e.jsx(n.p,{children:"Themes are natural-language design specs that guide code generation."}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.create("...", df, theme="financial_times")
`})}),`
`,e.jsxs(n.p,{children:["Use ",e.jsx(n.code,{children:"vw.theme(...)"})," to generate a custom theme description and pass it in."]}),`
`,e.jsx(n.h2,{children:"Inputs, outputs, and actions"}),`
`,e.jsxs(n.p,{children:[`You can also add inputs, outputs, and actions to wire widgets together or trigger behavior from
Python. For the full model and examples, see `,e.jsx(n.a,{href:"/docs/reactivity",children:"Reactivity"}),"."]}),`
`,e.jsx(n.h2,{children:"Safety warning"}),`
`,e.jsx(n.p,{children:"Widgets execute LLM-generated JavaScript in the notebook frontend. Treat generated code as untrusted. Use audits and your own verification when the output informs decisions."})]})}function o(t={}){const{wrapper:n}=t.components||{};return n?e.jsx(n,{...t,children:e.jsx(a,{...t})}):a(t)}const h=()=>e.jsx(r,{Content:o,meta:s});export{h as default};
