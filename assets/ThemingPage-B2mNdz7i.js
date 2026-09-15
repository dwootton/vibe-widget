import{j as e}from"./index-Ag879TfP.js";import{D as r}from"./DocMdxPage-C1Xb4fjc.js";import"./DocContent-ClmzcaAj.js";const o={title:"Theming",description:"Describe how a widget should look, and reuse that description across widgets."};function i(n){const t={code:"code",h2:"h2",p:"p",pre:"pre",...n.components},{WidgetPreview:s}=t;return s||h("WidgetPreview"),e.jsxs(e.Fragment,{children:[e.jsx(t.p,{children:`A theme is a description of how a widget should look, written in plain language, and the model
follows it while it generates the code. Themes are not stylesheets, so nothing is applied after the
fact.`}),`
`,e.jsx(t.h2,{children:"Listing the built-in themes"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`import vibe_widget as vw

vw.themes()
`})}),`
`,e.jsxs(t.p,{children:["In a notebook ",e.jsx(t.code,{children:"vw.themes()"})," prints a short list. To get the underlying dict, use ",e.jsx(t.code,{children:"dict(vw.themes())"}),"."]}),`
`,e.jsx(t.h2,{children:"Using a theme"}),`
`,e.jsx(t.p,{children:"Pass the name of a built-in theme:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`vw.create("...", df, theme="financial_times")
`})}),`
`,e.jsxs(t.p,{children:[`A string that is not a registered theme name is treated as a description and sent to the model,
which writes a fresh theme for it. Doing so costs an extra model call and the result varies between
runs, so use a registered name when you want the same look every time. `,e.jsx(t.code,{children:"vw.themes()"}),` lists the names
that resolve without a model call, and a built-in name works even with no API key set.`]}),`
`,e.jsx(t.h2,{children:"Writing your own theme"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`theme = vw.theme("like national geographic but greener")

print(theme.description)

vw.create("...", df, theme=theme)
`})}),`
`,e.jsxs(t.p,{children:["Pass the ",e.jsx(t.code,{children:"Theme"})," object itself rather than ",e.jsx(t.code,{children:"theme.description"}),`. A description string is not a
registered name, so passing it sends you back through generation and produces a different theme.`]}),`
`,e.jsx(t.p,{children:"To reuse a theme in later sessions, give it a name:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`theme.save("nat_geo_green")

vw.create("...", df, theme="nat_geo_green")
`})}),`
`,e.jsxs(t.p,{children:[e.jsx(t.code,{children:"Theme.save"})," writes a JSON file named after the theme into ",e.jsx(t.code,{children:".vibewidget/themes/"}),` in your project and
registers the name for the rest of the session. Because the file sits in the project, it can be
committed and shared with the repository. Themes saved by older versions under
`,e.jsx(t.code,{children:"~/.vibewidgets/themes/"})," are still read."]}),`
`,e.jsx(t.h2,{children:"Keeping a look across edits"}),`
`,e.jsx(t.p,{children:`An edit reuses the theme of the widget it came from, so the visual language stays the same while you
change behavior or layout.`}),`
`,e.jsx(s,{src:"/widgets/scatter_themed_ft.js",height:380}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`v1 = vw.create("basic scatter", df, theme="financial_times")
`})}),`
`,e.jsx(s,{src:"/widgets/scatter_tooltips_legend.js",height:420}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`v2 = v1.edit("add hover tooltips and a right-side legend")
`})}),`
`,e.jsx(t.p,{children:"To change the look on an edit, name a different theme:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`v3 = v2.edit("soften the palette and reduce gridlines", theme="minimal")
`})})]})}function a(n={}){const{wrapper:t}=n.components||{};return t?e.jsx(t,{...n,children:e.jsx(i,{...n})}):i(n)}function h(n,t){throw new Error("Expected component `"+n+"` to be defined: you likely forgot to import, pass, or provide it.")}const m=()=>e.jsx(r,{Content:a,meta:o});export{m as default};
