import{j as e}from"./index-BJAQU8i5.js";import{D as i}from"./DocMdxPage-2ZJ1a4cL.js";import"./DocContent-geJ24Wp2.js";const a={title:"Theming",description:"Style widgets with natural-language design specs."};function s(t){const n={code:"code",h2:"h2",p:"p",pre:"pre",...t.components};return e.jsxs(e.Fragment,{children:[e.jsx(n.p,{children:"Themes are natural-language design specs that guide code generation."}),`
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
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`v1 = vw.create("basic scatter", df, theme="financial_times")
v2 = v1.edit("add hover tooltips and a right-side legend")
`})}),`
`,e.jsx(n.p,{children:"You can override the theme on an edit when you want a new look:"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`v3 = v2.edit("soften the palette and reduce gridlines", theme="paper_white")
`})})]})}function r(t={}){const{wrapper:n}=t.components||{};return n?e.jsx(n,{...t,children:e.jsx(s,{...t})}):s(t)}const d=()=>e.jsx(i,{Content:r,meta:a});export{d as default};
