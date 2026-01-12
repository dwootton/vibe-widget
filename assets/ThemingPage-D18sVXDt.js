import{j as e}from"./index-DW6fP7wU.js";import{D as r}from"./DocMdxPage-DHLXPrOC.js";import"./DocContent-BrPZLS5s.js";const s={title:"Theming",description:"Style widgets with natural-language design specs."};function a(t){const n={code:"code",h2:"h2",p:"p",pre:"pre",...t.components};return e.jsxs(e.Fragment,{children:[e.jsx(n.p,{children:"Themes are natural-language design specs that guide code generation."}),`
`,e.jsx(n.h2,{children:"List available themes"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`import vibe_widget as vw

vw.themes()
`})}),`
`,e.jsx(n.h2,{children:"Create a custom theme"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`theme = vw.theme("like national geographic but greener")

# Inspect or reuse the generated description
print(theme.description)

vw.create("...", df, theme=theme.description)
`})}),`
`,e.jsx(n.h2,{children:"Use a theme in create"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.create("...", df, theme="financial_times")
`})})]})}function i(t={}){const{wrapper:n}=t.components||{};return n?e.jsx(n,{...t,children:e.jsx(a,{...t})}):a(t)}const d=()=>e.jsx(r,{Content:i,meta:s});export{d as default};
