import{j as e}from"./index-CryjOFqx.js";import{D as o}from"./DocMdxPage-PotaL-Qx.js";import"./DocContent-3chbFH74.js";const s={title:"Create",description:"Create widgets from natural language prompts and data sources."};function a(t){const n={a:"a",code:"code",h2:"h2",p:"p",pre:"pre",...t.components},{WidgetPreview:r}=n;return r||d("WidgetPreview"),e.jsxs(e.Fragment,{children:[e.jsx(n.p,{children:"Create widgets from natural language prompts and data sources."}),`
`,e.jsx(r,{src:"/widgets/bar_chart_revenue.js",height:380}),`
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
`,e.jsx(n.p,{children:"Widgets execute LLM-generated JavaScript in the notebook frontend. Treat generated code as untrusted. Use audits and your own verification when the output informs decisions."})]})}function i(t={}){const{wrapper:n}=t.components||{};return n?e.jsx(n,{...t,children:e.jsx(a,{...t})}):a(t)}function d(t,n){throw new Error("Expected component `"+t+"` to be defined: you likely forgot to import, pass, or provide it.")}const u=()=>e.jsx(o,{Content:i,meta:s});export{u as default};
