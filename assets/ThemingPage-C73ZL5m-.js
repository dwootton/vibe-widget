import{j as e}from"./index-B4z5kDSy.js";import{D as r}from"./DocMdxPage-DDr1xgCs.js";import"./DocContent-CBrQcdvq.js";const a={title:"Theming",description:"Style widgets with natural-language design specs."};function i(n){const t={code:"code",h2:"h2",p:"p",pre:"pre",...n.components},{WidgetPreview:s}=t;return s||h("WidgetPreview"),e.jsxs(e.Fragment,{children:[e.jsx(t.p,{children:"Themes are natural-language design specs that guide code generation."}),`
`,e.jsx(t.h2,{children:"List available themes"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`import vibe_widget as vw

themes = vw.themes()
themes
`})}),`
`,e.jsxs(t.p,{children:[e.jsx(t.code,{children:"vw.themes()"})," pretty-prints a concise list in notebooks. To get the full dict, use ",e.jsx(t.code,{children:"dict(themes)"}),"."]}),`
`,e.jsx(t.h2,{children:"Use a theme in create"}),`
`,e.jsx(t.p,{children:"Pass the name of a built-in theme:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`vw.create("...", df, theme="financial_times")
`})}),`
`,e.jsxs(t.p,{children:[`A string that is not a registered theme name is treated as a theme prompt and sent to the model,
which generates a fresh theme for it. That costs an extra model call and the result varies between
runs, so use a registered name when you want the same look every time. `,e.jsx(t.code,{children:"vw.themes()"}),` lists the
names that resolve without a model call.`]}),`
`,e.jsx(t.h2,{children:"Create a custom theme"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`theme = vw.theme("like national geographic but greener")

# Inspect or reuse the generated description
print(theme.description)

vw.create("...", df, theme=theme)
`})}),`
`,e.jsxs(t.p,{children:["Pass the ",e.jsx(t.code,{children:"Theme"})," object itself, not ",e.jsx(t.code,{children:"theme.description"}),`. A description string is not a registered
name, so it goes back through generation and produces a different theme.`]}),`
`,e.jsx(t.p,{children:"To reuse a generated theme across sessions, give it a name:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`theme.save("nat_geo_green")

vw.create("...", df, theme="nat_geo_green")
`})}),`
`,e.jsxs(t.p,{children:[e.jsx(t.code,{children:"Theme.save"})," writes a JSON file named after the theme into ",e.jsx(t.code,{children:".vibewidget/themes/"}),` in your project and
registers the name for the rest of the session. Because the file lives in the project, it can be
committed and shared with the repo. Themes saved by older versions under `,e.jsx(t.code,{children:"~/.vibewidgets/themes/"}),`
are still read.`]}),`
`,e.jsx(t.h2,{children:"Iterate with themes"}),`
`,e.jsx(t.p,{children:`Edits reuse the existing theme by default, so your visual language stays consistent as you refine
behavior or layout.`}),`
`,e.jsx(s,{src:"/widgets/scatter_themed_ft.js",height:380}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`v1 = vw.create("basic scatter", df, theme="financial_times")
`})}),`
`,e.jsx(s,{src:"/widgets/scatter_tooltips_legend.js",height:420}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`v2 = v1.edit("add hover tooltips and a right-side legend")
`})}),`
`,e.jsx(t.p,{children:"You can override the theme on an edit when you want a new look:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`v3 = v2.edit("soften the palette and reduce gridlines", theme="minimal")
`})})]})}function o(n={}){const{wrapper:t}=n.components||{};return t?e.jsx(t,{...n,children:e.jsx(i,{...n})}):i(n)}function h(n,t){throw new Error("Expected component `"+n+"` to be defined: you likely forgot to import, pass, or provide it.")}const m=()=>e.jsx(r,{Content:o,meta:a});export{m as default};
