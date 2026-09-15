import{j as e}from"./index-B4z5kDSy.js";import{D as d}from"./DocMdxPage-DDr1xgCs.js";import"./DocContent-CBrQcdvq.js";const a={title:"Installation",description:"Get up and running with Vibe Widget in seconds."};function i(t){const n={a:"a",code:"code",h2:"h2",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...t.components},{InstallCommand:r,WidgetPreview:s}=n;return r||o("InstallCommand"),s||o("WidgetPreview"),e.jsxs(e.Fragment,{children:[e.jsx(n.p,{children:"Get up and running with Vibe Widget in seconds."}),`
`,e.jsx(r,{command:"pip install vibe-widget"}),`
`,e.jsx(n.p,{children:"Vibe Widget requires Python 3.9 or newer and one API key."}),`
`,e.jsx(n.h2,{children:"1. Add a key"}),`
`,e.jsxs(n.p,{children:["Create a ",e.jsx(n.code,{children:".env"})," file next to your notebook with ",e.jsx(n.strong,{children:"any one"})," of these lines:"]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-bash",children:`ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
`})}),`
`,e.jsxs(n.p,{children:["Vibe Widget finds the ",e.jsx(n.code,{children:".env"}),` file, picks the matching provider, and chooses a default model for it.
There is nothing else to configure. Exporting the same variable in your shell works too, and an
exported value always wins over the file.`]}),`
`,e.jsxs(n.p,{children:["Get a key from ",e.jsx(n.a,{href:"https://console.anthropic.com/",children:"Anthropic"}),`,
`,e.jsx(n.a,{href:"https://platform.openai.com/",children:"OpenAI"})," or ",e.jsx(n.a,{href:"https://openrouter.ai/",children:"OpenRouter"}),`. OpenRouter reaches
models from every vendor through one key.`]}),`
`,e.jsx(n.h2,{children:"2. Create a widget"}),`
`,e.jsx(s,{src:"/widgets/bar_chart_revenue.js",height:380}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`import pandas as pd
import vibe_widget as vw

df = pd.read_csv("sales.csv")
widget = vw.create("bar chart of revenue by region", df)
widget
`})}),`
`,e.jsx(n.p,{children:"Check what was picked up at any time:"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config()
# Config(provider='anthropic', host='api.anthropic.com', model='claude-opus-5',
#        key_source='ANTHROPIC_API_KEY (/work/analysis/.env)', environment='vscode-like', ...)
`})}),`
`,e.jsx(n.p,{children:"The repr never shows the key itself, only where it came from."}),`
`,e.jsx(n.h2,{children:"Where it runs"}),`
`,e.jsx(n.p,{children:"The same two steps work in every supported host."}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"JupyterLab and Jupyter Notebook"})," — nothing extra."]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"VS Code notebooks"})," — React is bundled into each widget, because VS Code has no import maps."]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Positron"})," — treated exactly like VS Code, and detected through ",e.jsx(n.code,{children:"POSITRON"})," rather than ",e.jsx(n.code,{children:"VSCODE_PID"}),"."]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Google Colab"})," — generation runs synchronously, since background threads break widget updates there."]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Quarto"})," — works in ",e.jsx(n.code,{children:".qmd"})," documents rendered with the Jupyter engine; put the ",e.jsx(n.code,{children:".env"})," in the project directory."]}),`
`]}),`
`,e.jsx(n.h2,{children:"Brush selection example"}),`
`,e.jsx(s,{src:"/widgets/scatter_brush_linked.js",height:340}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`import pandas as pd
import vibe_widget as vw

df = pd.read_csv("sales.csv")

widget = vw.create(
    "scatter plot with brush selection, and a linked histogram",
    df,
    outputs=vw.outputs(selected_indices="indices of selected points")
)

widget
`})}),`
`,e.jsxs(n.p,{children:[`Need help setting API keys in Jupyter? See
`,e.jsx(n.a,{href:"https://docs.google.com/document/d/e/2PACX-1vST8sEHdo90NsTdTFNjLi27YFT-81u2WQa7--qr0u4yk2aByE6Q5WIj-p8JYueEING5-fNdFNu2Aa3t/pub",children:"this guide"}),"."]})]})}function c(t={}){const{wrapper:n}=t.components||{};return n?e.jsx(n,{...t,children:e.jsx(i,{...t})}):i(t)}function o(t,n){throw new Error("Expected component `"+t+"` to be defined: you likely forgot to import, pass, or provide it.")}const u=()=>e.jsx(d,{Content:c,meta:a});export{u as default};
