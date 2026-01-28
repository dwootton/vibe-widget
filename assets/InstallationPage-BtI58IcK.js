import{j as e}from"./index-BJAQU8i5.js";import{D as o}from"./DocMdxPage-2ZJ1a4cL.js";import"./DocContent-geJ24Wp2.js";const i={title:"Installation",description:"Get up and running with Vibe Widget in seconds."};function r(s){const n={a:"a",code:"code",h2:"h2",p:"p",pre:"pre",...s.components},{InstallCommand:t}=n;return t||a("InstallCommand"),e.jsxs(e.Fragment,{children:[e.jsx(n.p,{children:"Get up and running with Vibe Widget in seconds."}),`
`,e.jsx(t,{command:"pip install vibe-widget"}),`
`,e.jsx(n.p,{children:"Vibe Widget requires Python 3.9+ and an OpenRouter API key."}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-bash",children:`export OPENROUTER_API_KEY='your-key'
`})}),`
`,e.jsxs(n.p,{children:[`Need help setting API keys in Jupyter? See this guide:
`,e.jsx(n.a,{href:"https://docs.google.com/document/d/e/2PACX-1vST8sEHdo90NsTdTFNjLi27YFT-81u2WQa7--qr0u4yk2aByE6Q5WIj-p8JYueEING5-fNdFNu2Aa3t/pub",children:"https://docs.google.com/document/d/e/2PACX-1vST8sEHdo90NsTdTFNjLi27YFT-81u2WQa7--qr0u4yk2aByE6Q5WIj-p8JYueEING5-fNdFNu2Aa3t/pub"})]}),`
`,e.jsxs(n.p,{children:[`Get an OpenRouter API key:
`,e.jsx(n.a,{href:"https://openrouter.ai/",children:"https://openrouter.ai/"})]}),`
`,e.jsx(n.h2,{children:"Quick start (3 minutes)"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-bash",children:`pip install vibe-widget
`})}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-bash",children:`# macOS/Linux (temporary for current shell)
export OPENROUTER_API_KEY="your-key"
`})}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-powershell",children:`# Windows PowerShell (temporary for current session)
$env:OPENROUTER_API_KEY="your-key"
`})}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`import pandas as pd
import vibe_widget as vw

df = pd.read_csv("sales.csv")
widget = vw.create("bar chart of revenue by region", df)
widget
`})}),`
`,e.jsxs(n.p,{children:["If you want the key to persist across sessions, add the ",e.jsx(n.code,{children:"export"}),` line to your shell profile
(for example `,e.jsx(n.code,{children:"~/.zshrc"})," or ",e.jsx(n.code,{children:"~/.bashrc"}),")."]}),`
`,e.jsx(n.h2,{children:"Quick start"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`import pandas as pd
import vibe_widget as vw

df = pd.read_csv("sales.csv")

widget = vw.create(
    "scatter plot with brush selection, and a linked histogram",
    df,
    outputs=vw.outputs(selected_indices="indices of selected points")
)

widget
`})})]})}function d(s={}){const{wrapper:n}=s.components||{};return n?e.jsx(n,{...s,children:e.jsx(r,{...s})}):r(s)}function a(s,n){throw new Error("Expected component `"+s+"` to be defined: you likely forgot to import, pass, or provide it.")}const h=()=>e.jsx(o,{Content:d,meta:i});export{h as default};
