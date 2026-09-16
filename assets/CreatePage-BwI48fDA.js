import{j as e}from"./index-CkRJxMr7.js";import{D as r}from"./DocMdxPage-BHZwN-Z3.js";import"./DocContent-DGIgVrr-.js";const s={title:"Create",description:"Generate a widget from a prompt and a dataset."};function o(n){const t={a:"a",code:"code",h2:"h2",p:"p",pre:"pre",...n.components},{WidgetPreview:a}=t;return a||i("WidgetPreview"),e.jsxs(e.Fragment,{children:[e.jsxs(t.p,{children:[e.jsx(t.code,{children:"vw.create"}),` sends your prompt and a summary of your data to a model, and the model writes the
JavaScript that draws the widget. The generated code is stored in `,e.jsx(t.code,{children:".vibewidget/"}),` in your project,
so the next call with the same prompt and the same data reuses it instead of paying for a second
model call.`]}),`
`,e.jsx(a,{src:"/widgets/bar_chart_revenue.js",height:380}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`import vibe_widget as vw

widget = vw.create(
    "bar chart of revenue by region",
    df
)

widget
`})}),`
`,e.jsxs(t.p,{children:["The second argument accepts a ",e.jsx(t.code,{children:"pandas"}),` DataFrame, a path to a data file, a URL, or a directory to
search. Recognized file types include CSV, TSV, JSON, GeoJSON, Parquet, NetCDF, XML, Excel, PDF, and
plain text. You can leave the argument out when the widget does not read a dataset.`]}),`
`,e.jsx(t.h2,{children:"When the cache is reused"}),`
`,e.jsxs(t.p,{children:[`The stored code is found again by a key built from your prompt, the column names and dtypes of the
data, the declared inputs and outputs, and the theme description. Changing any one of them produces
a different key, so the model is called again and the earlier widget stays on disk. Row counts are
deliberately left out of the key, so appending rows to a DataFrame reuses the widget you already
have.
Pass `,e.jsx(t.code,{children:"cache=False"})," to force a fresh generation, and use ",e.jsx(t.code,{children:"vw.clear()"})," to delete stored widgets."]}),`
`,e.jsx(t.h2,{children:"Themes"}),`
`,e.jsx(t.p,{children:`A theme is a description of how the widget should look, written in plain language, and the model
follows it while generating the code.`}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`vw.create("...", df, theme="financial_times")
`})}),`
`,e.jsxs(t.p,{children:[e.jsx(t.code,{children:"vw.themes()"})," lists the built-in names. To write your own, see ",e.jsx(t.a,{href:"/docs/theming",children:"Theming"}),"."]}),`
`,e.jsx(t.h2,{children:"Inputs, outputs, and actions"}),`
`,e.jsxs(t.p,{children:[`Values can flow into a widget from Python, out of a widget back to Python, and from Python as
one-time commands. For the full model and worked examples, see `,e.jsx(t.a,{href:"/docs/reactivity",children:"Reactivity"}),"."]}),`
`,e.jsx(t.h2,{children:"What the generated code can do"}),`
`,e.jsxs(t.p,{children:[`Generated JavaScript runs in the notebook page with the same privileges the page has, so it can
reach the DOM, storage for the notebook origin, and any network address the browser allows. There is
no browser sandbox around it. Read a generated widget the way you would read a script a stranger
sent you, and use `,e.jsx(t.code,{children:'vw.config(execution="approve")'})," when you want to see the code before it runs."]})]})}function d(n={}){const{wrapper:t}=n.components||{};return t?e.jsx(t,{...n,children:e.jsx(o,{...n})}):o(n)}function i(n,t){throw new Error("Expected component `"+n+"` to be defined: you likely forgot to import, pass, or provide it.")}const p=()=>e.jsx(r,{Content:d,meta:s});export{p as default};
