import{j as e}from"./index-CkRJxMr7.js";import{D as r}from"./DocMdxPage-BHZwN-Z3.js";import"./DocContent-DGIgVrr-.js";const a={title:"Theming",description:"Describe how a widget should look, and reuse that description across widgets."};function i(t){const n={code:"code",h2:"h2",p:"p",pre:"pre",...t.components},{WidgetPreview:s}=n;return s||h("WidgetPreview"),e.jsxs(e.Fragment,{children:[e.jsx(n.p,{children:`A theme is a description of how a widget should look, written in plain language. The description
goes into the prompt, so the colours, type and spacing end up written into the generated JavaScript
itself. There is no stylesheet layered on afterwards, and changing a theme means generating again.`}),`
`,e.jsx(n.h2,{children:"Listing the built-in themes"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`import vibe_widget as vw

vw.themes()
`})}),`
`,e.jsxs(n.p,{children:["In a notebook ",e.jsx(n.code,{children:"vw.themes()"})," prints a short list. To get the underlying dict, use ",e.jsx(n.code,{children:"dict(vw.themes())"}),"."]}),`
`,e.jsx(n.h2,{children:"Using a theme"}),`
`,e.jsx(n.p,{children:"Pass the name of a built-in theme:"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.create("...", df, theme="financial_times")
`})}),`
`,e.jsxs(n.p,{children:[`A string that is not a registered theme name is treated as a description and sent to the model,
which writes a fresh theme for it. Doing so costs an extra model call and the result varies between
runs, so use a registered name when you want the same look every time. `,e.jsx(n.code,{children:"vw.themes()"}),` lists the names
that resolve without a model call, and a built-in name works even with no API key set.`]}),`
`,e.jsx(n.h2,{children:"Writing your own theme"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`theme = vw.theme("like national geographic but greener")

print(theme.description)

vw.create("...", df, theme=theme)
`})}),`
`,e.jsxs(n.p,{children:["Pass the ",e.jsx(n.code,{children:"Theme"})," object itself rather than ",e.jsx(n.code,{children:"theme.description"}),`. A description string is not a
registered name, so passing it sends you back through generation and produces a different theme.`]}),`
`,e.jsx(n.p,{children:"To reuse a theme in later sessions, give it a name:"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`theme.save("nat_geo_green")

vw.create("...", df, theme="nat_geo_green")
`})}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"Theme.save"})," writes a JSON file named after the theme into ",e.jsx(n.code,{children:".vibewidget/themes/"}),` in your project and
registers the name for the rest of the session. Because the file sits in the project, it can be
committed and shared with the repository. Themes saved by older versions under
`,e.jsx(n.code,{children:"~/.vibewidgets/themes/"})," are still read."]}),`
`,e.jsx(n.h2,{children:"Keeping a look across edits"}),`
`,e.jsx(n.p,{children:`An edit reuses the theme of the widget it came from, so the visual language stays the same while you
change behavior or layout.`}),`
`,e.jsx(s,{src:"/widgets/scatter_themed_ft.js",height:380}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`v1 = vw.create("basic scatter", df, theme="financial_times")
`})}),`
`,e.jsx(s,{src:"/widgets/scatter_tooltips_legend.js",height:420}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`v2 = v1.edit("add hover tooltips and a right-side legend")
`})}),`
`,e.jsx(n.p,{children:"To change the look on an edit, name a different theme:"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`v3 = v2.edit("soften the palette and reduce gridlines", theme="minimal")
`})})]})}function o(t={}){const{wrapper:n}=t.components||{};return n?e.jsx(n,{...t,children:e.jsx(i,{...t})}):i(t)}function h(t,n){throw new Error("Expected component `"+t+"` to be defined: you likely forgot to import, pass, or provide it.")}const m=()=>e.jsx(r,{Content:o,meta:a});export{m as default};
