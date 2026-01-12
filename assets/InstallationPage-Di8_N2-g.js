import{j as n}from"./index-DW6fP7wU.js";import{D as s}from"./DocMdxPage-DHLXPrOC.js";import"./DocContent-BrPZLS5s.js";const r={title:"Installation",description:"Get up and running with Vibe Widget in seconds."};function i(t){const e={code:"code",h2:"h2",p:"p",pre:"pre",...t.components},{InstallCommand:o}=e;return o||a("InstallCommand"),n.jsxs(n.Fragment,{children:[n.jsx(e.p,{children:"Get up and running with Vibe Widget in seconds."}),`
`,n.jsx(o,{command:"pip install vibe-widget"}),`
`,n.jsx(e.p,{children:"Vibe Widget requires Python 3.8+ and an OpenRouter API key."}),`
`,n.jsx(e.pre,{children:n.jsx(e.code,{className:"language-bash",children:`export OPENROUTER_API_KEY='your-key'
`})}),`
`,n.jsx(e.h2,{children:"Quick start"}),`
`,n.jsx(e.pre,{children:n.jsx(e.code,{className:"language-python",children:`import pandas as pd
import vibe_widget as vw

df = pd.read_csv("sales.csv")

widget = vw.create(
    "scatter plot with brush selection, and a linked histogram",
    df,
    outputs=vw.outputs(selected_indices="indices of selected points")
)

widget
`})})]})}function d(t={}){const{wrapper:e}=t.components||{};return e?n.jsx(e,{...t,children:n.jsx(i,{...t})}):i(t)}function a(t,e){throw new Error("Expected component `"+t+"` to be defined: you likely forgot to import, pass, or provide it.")}const m=()=>n.jsx(s,{Content:d,meta:r});export{m as default};
