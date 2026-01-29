import{j as e}from"./index-CryjOFqx.js";import{D as t}from"./DocMdxPage-PotaL-Qx.js";import"./DocContent-3chbFH74.js";const r={title:"Configuration",description:"Configure model settings and API keys."};function s(o){const n={a:"a",code:"code",h2:"h2",li:"li",p:"p",pre:"pre",ul:"ul",...o.components};return e.jsxs(e.Fragment,{children:[e.jsx(n.p,{children:"Configure model settings and API keys."}),`
`,e.jsx(n.h2,{children:"Set defaults"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`import vibe_widget as vw

vw.config(model="openai/gpt-5.1-codex")
vw.config(mode="premium", model="openrouter")
vw.config(execution="approve")
`})}),`
`,e.jsx(n.h2,{children:"API key setup"}),`
`,e.jsxs(n.p,{children:[`Get an OpenRouter API key:
`,e.jsx(n.a,{href:"https://openrouter.ai/",children:"https://openrouter.ai/"})]}),`
`,e.jsxs(n.p,{children:["Need help setting API keys in Jupyter? See ",e.jsx(n.a,{href:"https://docs.google.com/document/d/e/2PACX-1vST8sEHdo90NsTdTFNjLi27YFT-81u2WQa7--qr0u4yk2aByE6Q5WIj-p8JYueEING5-fNdFNu2Aa3t/pub",children:"this guide"}),"."]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-bash",children:`export OPENROUTER_API_KEY='your-key'
`})}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-powershell",children:`$env:OPENROUTER_API_KEY="your-key"
`})}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`import os
from dotenv import load_dotenv
import vibe_widget as vw

load_dotenv()
api_key = os.getenv("MY_SECRET_API_KEY")

vw.config(api_key=api_key)
`})}),`
`,e.jsx(n.p,{children:"We recommend avoiding hardcoded keys in notebooks to prevent accidental leaks."}),`
`,e.jsx(n.h2,{children:"Models"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.models()
vw.models(show="all")
vw.models(verbose=False)
`})}),`
`,e.jsx(n.h2,{children:"Common configuration options"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(
    execution="auto",  # "auto" or "approve"
    retry=2,            # Runtime repair attempts
    agent_preset="project",
    agent_run={"tier": 1},
    bypass_row_guard=False,
)
`})}),`
`,e.jsx(n.h2,{children:"Privacy and telemetry"}),`
`,e.jsx(n.p,{children:"Vibe Widget sends the following to the model provider:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"your prompt and theme prompt"}),`
`,e.jsx(n.li,{children:"data schema (column names, dtypes)"}),`
`,e.jsx(n.li,{children:"a small sample of rows (up to 3)"}),`
`,e.jsx(n.li,{children:"outputs/inputs descriptors"}),`
`,e.jsx(n.li,{children:"full widget code for edits, audits, and runtime fixes"}),`
`,e.jsx(n.li,{children:"runtime error messages (when auto-fixing)"}),`
`]}),`
`,e.jsxs(n.p,{children:["No API keys are written to disk. Generated widgets and audit reports are stored locally in ",e.jsx(n.code,{children:".vibewidget/"}),"."]})]})}function i(o={}){const{wrapper:n}=o.components||{};return n?e.jsx(n,{...o,children:e.jsx(s,{...o})}):s(o)}const c=()=>e.jsx(t,{Content:i,meta:r});export{c as default};
