import{j as e}from"./index-CryjOFqx.js";import{D as r}from"./DocMdxPage-PotaL-Qx.js";import"./DocContent-3chbFH74.js";const a={title:"Theming",description:"Style widgets with natural-language design specs."};function i(t){const n={code:"code",h2:"h2",p:"p",pre:"pre",...t.components},{WidgetPreview:s}=n;return s||c("WidgetPreview"),e.jsxs(e.Fragment,{children:[e.jsx(n.p,{children:"Themes are natural-language design specs that guide code generation."}),`
`,e.jsx(n.h2,{children:"List available themes"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`import vibe_widget as vw

themes = vw.themes()
themes
`})}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"vw.themes()"})," pretty-prints a concise list in notebooks. To get the full dict, use ",e.jsx(n.code,{children:"dict(themes)"}),"."]}),`
`,e.jsx(n.h2,{children:"Create a custom theme"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`theme = vw.theme("like national geographic but greener")

# Inspect or reuse the generated description
print(theme.description)

vw.create("...", df, theme=theme.description)
`})}),`
`,e.jsx(n.h2,{children:"Use a theme in create"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.create("...", df, theme="financial_times")
`})}),`
`,e.jsx(n.h2,{children:"Iterate with themes"}),`
`,e.jsx(n.p,{children:`Edits reuse the existing theme by default, so your visual language stays consistent as you refine
behavior or layout.`}),`
`,e.jsx(s,{src:"/widgets/scatter_themed_ft.js",height:380}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`v1 = vw.create("basic scatter", df, theme="financial_times")
`})}),`
`,e.jsx(s,{src:"/widgets/scatter_tooltips_legend.js",height:420}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`v2 = v1.edit("add hover tooltips and a right-side legend")
`})}),`
`,e.jsx(n.p,{children:"You can override the theme on an edit when you want a new look:"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`v3 = v2.edit("soften the palette and reduce gridlines", theme="paper_white")
`})})]})}function o(t={}){const{wrapper:n}=t.components||{};return n?e.jsx(n,{...t,children:e.jsx(i,{...t})}):i(t)}function c(t,n){throw new Error("Expected component `"+t+"` to be defined: you likely forgot to import, pass, or provide it.")}const m=()=>e.jsx(r,{Content:o,meta:a});export{m as default};
