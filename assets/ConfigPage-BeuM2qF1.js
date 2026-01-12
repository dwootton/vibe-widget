import{j as e}from"./index-DW6fP7wU.js";import{D as i}from"./DocMdxPage-DHLXPrOC.js";import"./DocContent-BrPZLS5s.js";const t={title:"Configuration",description:"Configure model settings and API keys."};function s(o){const n={code:"code",h2:"h2",li:"li",p:"p",pre:"pre",ul:"ul",...o.components};return e.jsxs(e.Fragment,{children:[e.jsx(n.p,{children:"Configure model settings and API keys."}),`
`,e.jsx(n.h2,{children:"Set defaults"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`import vibe_widget as vw

vw.config(model="openai/gpt-5.2-codex")
vw.config(mode="premium", model="openrouter")
vw.config(execution="approve")
`})}),`
`,e.jsx(n.h2,{children:"API key setup"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-bash",children:`export OPENROUTER_API_KEY='your-key'
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
`,e.jsxs(n.p,{children:["No API keys are written to disk. Generated widgets and audit reports are stored locally in ",e.jsx(n.code,{children:".vibewidget/"}),"."]})]})}function r(o={}){const{wrapper:n}=o.components||{};return n?e.jsx(n,{...o,children:e.jsx(s,{...o})}):s(o)}const c=()=>e.jsx(i,{Content:r,meta:t});export{c as default};
