import{j as e}from"./index-CkRJxMr7.js";import{D as d}from"./DocMdxPage-BHZwN-Z3.js";import"./DocContent-DGIgVrr-.js";const a={title:"Installation",description:"Install the package, set one API key, and create a first widget."};function r(t){const n={a:"a",code:"code",h2:"h2",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...t.components},{InstallCommand:o,WidgetPreview:s}=n;return o||i("InstallCommand"),s||i("WidgetPreview"),e.jsxs(e.Fragment,{children:[e.jsx(n.p,{children:`Vibe Widget runs on Python 3.9 or newer, and it needs one API key to generate a widget.
Widgets that were generated earlier and cached on disk open without a key.`}),`
`,e.jsx(o,{command:"pip install vibe-widget"}),`
`,e.jsx(n.h2,{children:"1. Add a key"}),`
`,e.jsxs(n.p,{children:["Create a ",e.jsx(n.code,{children:".env"})," file next to your notebook holding any one of these lines:"]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-bash",children:`ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
`})}),`
`,e.jsxs(n.p,{children:["Vibe Widget reads the ",e.jsx(n.code,{children:".env"}),` file, picks the provider that matches the variable name, and uses that
provider's default model. Nothing else needs to be set. Exporting the same variable in your shell
works the same way, and a value already in the environment is never overwritten by the file.`]}),`
`,e.jsxs(n.p,{children:["You can get a key from ",e.jsx(n.a,{href:"https://console.anthropic.com/",children:"Anthropic"}),`,
`,e.jsx(n.a,{href:"https://platform.openai.com/",children:"OpenAI"})," or ",e.jsx(n.a,{href:"https://openrouter.ai/",children:"OpenRouter"}),`. One OpenRouter key
reaches models from every vendor.`]}),`
`,e.jsx(n.h2,{children:"2. Create a widget"}),`
`,e.jsx(s,{src:"/widgets/bar_chart_revenue.js",height:380}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`import pandas as pd
import vibe_widget as vw

df = pd.read_csv("sales.csv")
widget = vw.create("bar chart of revenue by region", df)
widget
`})}),`
`,e.jsxs(n.p,{children:["To see what was picked up, call ",e.jsx(n.code,{children:"vw.config()"})," with no arguments:"]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config()
# Config(provider='anthropic', host='api.anthropic.com', model='claude-opus-5',
#        key_source='ANTHROPIC_API_KEY (/work/analysis/.env)', environment='vscode-like', ...)
`})}),`
`,e.jsx(n.p,{children:"The output names the variable and file the key came from, and never prints the key itself."}),`
`,e.jsx(n.h2,{children:"Where it runs"}),`
`,e.jsx(n.p,{children:"The same two steps work in every supported host."}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"JupyterLab and Jupyter Notebook"})," need nothing extra."]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"VS Code notebooks"})," get React bundled into each widget, because VS Code has no import maps."]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Positron"})," is handled the same way as VS Code, and is detected through ",e.jsx(n.code,{children:"POSITRON"})," rather than ",e.jsx(n.code,{children:"VSCODE_PID"}),"."]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Google Colab"})," generates code synchronously, because background threads break widget updates there."]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Quarto"})," works in ",e.jsx(n.code,{children:".qmd"})," documents rendered with the Jupyter engine. Put the ",e.jsx(n.code,{children:".env"})," file in the project directory."]}),`
`]}),`
`,e.jsx(n.h2,{children:"Opening a widget someone else generated"}),`
`,e.jsxs(n.p,{children:["Generated code is written to ",e.jsx(n.code,{children:".vibewidget/"}),` in your project, and the folder can be committed to git.
A collaborator who clones the repository can open those widgets with no API key at all, because
loading cached code makes no model call. A key is needed again only when someone generates, edits,
audits, or repairs a widget.`]}),`
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
`,e.jsxs(n.p,{children:[`For help setting API keys inside Jupyter, see
`,e.jsx(n.a,{href:"https://docs.google.com/document/d/e/2PACX-1vST8sEHdo90NsTdTFNjLi27YFT-81u2WQa7--qr0u4yk2aByE6Q5WIj-p8JYueEING5-fNdFNu2Aa3t/pub",children:"this guide"}),"."]})]})}function c(t={}){const{wrapper:n}=t.components||{};return n?e.jsx(n,{...t,children:e.jsx(r,{...t})}):r(t)}function i(t,n){throw new Error("Expected component `"+t+"` to be defined: you likely forgot to import, pass, or provide it.")}const g=()=>e.jsx(d,{Content:c,meta:a});export{g as default};
