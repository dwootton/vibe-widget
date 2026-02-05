import{j as e}from"./index-CHIWwMwg.js";import{D as s}from"./DocMdxPage-D_ZhWgKN.js";import"./DocContent-7XeB-9Bn.js";const t={title:"Configuration",description:"Configure model settings and API keys."};function d(r){const n={a:"a",code:"code",h2:"h2",h3:"h3",li:"li",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...r.components};return e.jsxs(e.Fragment,{children:[e.jsx(n.p,{children:"Configure model settings and API keys."}),`
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
`,e.jsx(n.h2,{children:"Safety and permissions"}),`
`,e.jsx(n.p,{children:"Widgets execute LLM-generated JavaScript in the notebook frontend. Treat generated code as untrusted and review it before relying on the output."}),`
`,e.jsx(n.h3,{children:"Execution mode"}),`
`,e.jsx(n.p,{children:"Control whether code runs immediately or requires manual approval first."}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(execution="approve")   # review code before it runs
vw.config(execution="auto")      # run immediately (default)
`})}),`
`,e.jsxs(n.p,{children:["In ",e.jsx(n.code,{children:'"approve"'})," mode the widget tracks a SHA-256 hash of the approved code. If the code changes (e.g. after an edit or retry), approval resets and you must re-approve before execution."]}),`
`,e.jsx(n.h3,{children:"Agent presets"}),`
`,e.jsx(n.p,{children:"Agent presets control which tools the LLM agent can call. There are three levels:"}),`
`,e.jsxs(n.table,{children:[e.jsx(n.thead,{children:e.jsxs(n.tr,{children:[e.jsx(n.th,{children:"Preset"}),e.jsx(n.th,{children:"Permission tier"}),e.jsx(n.th,{children:"File access"}),e.jsx(n.th,{children:"Network"}),e.jsx(n.th,{children:"Use case"})]})}),e.jsxs(n.tbody,{children:[e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:'"safe"'})}),e.jsx(n.td,{children:"0 (read-only)"}),e.jsx(n.td,{children:"Sandbox only"}),e.jsx(n.td,{children:"No"}),e.jsx(n.td,{children:"Sensitive data, minimal risk"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:'"project"'})}),e.jsx(n.td,{children:"1 (read-write)"}),e.jsx(n.td,{children:"Working dir + sandbox"}),e.jsx(n.td,{children:"No"}),e.jsx(n.td,{children:"General use (default)"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:'"connected"'})}),e.jsx(n.td,{children:"2 (full)"}),e.jsx(n.td,{children:"Working dir + sandbox"}),e.jsx(n.td,{children:"HTTPS only"}),e.jsx(n.td,{children:"Fetching remote data"})]})]})]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`# Lock down to read-only tools
vw.config(agent_preset="safe")

# Default: read-write in your project directory
vw.config(agent_preset="project")

# Allow the agent to fetch URLs (HTTPS only)
vw.config(agent_preset="connected")
`})}),`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"Tier 0 tools"})," – ",e.jsx(n.code,{children:"data.profile"}),", ",e.jsx(n.code,{children:"fs.list"}),", ",e.jsx(n.code,{children:"fs.read"}),", ",e.jsx(n.code,{children:"fs.exists"}),", ",e.jsx(n.code,{children:"fs.glob"}),", ",e.jsx(n.code,{children:"state.get"}),", ",e.jsx(n.code,{children:"pls.describe"})]}),`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"Tier 1 adds"})," – ",e.jsx(n.code,{children:"data.load"}),", ",e.jsx(n.code,{children:"fs.write"}),", ",e.jsx(n.code,{children:"fs.mkdir"}),", ",e.jsx(n.code,{children:"fs.read_base64"}),", ",e.jsx(n.code,{children:"widget.set_input"}),", ",e.jsx(n.code,{children:"widget.set_output"}),", ",e.jsx(n.code,{children:"state.put"})]}),`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"Tier 2 adds"})," – ",e.jsx(n.code,{children:"net.fetch"})," (HTTPS, mime-type validated), ",e.jsx(n.code,{children:"python.write_module"}),", ",e.jsx(n.code,{children:"python.run_module"})," (AST-guarded to block dangerous imports)"]}),`
`,e.jsx(n.h3,{children:"Row guard"}),`
`,e.jsx(n.p,{children:"By default, datasets over 100,000 rows are blocked to prevent memory exhaustion."}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`# Keep the guard (default)
vw.config(bypass_row_guard=False)

# Disable if you need large datasets
vw.config(bypass_row_guard=True)
`})}),`
`,e.jsx(n.h3,{children:"Model modes"}),`
`,e.jsx(n.p,{children:"Models are grouped into two modes:"}),`
`,e.jsxs(n.table,{children:[e.jsx(n.thead,{children:e.jsxs(n.tr,{children:[e.jsx(n.th,{children:"Mode"}),e.jsx(n.th,{children:"Models"}),e.jsx(n.th,{children:"Trade-off"})]})}),e.jsxs(n.tbody,{children:[e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:'"standard"'})}),e.jsx(n.td,{children:"Gemini 3 Flash, Claude Haiku 4.5, GPT-5.1 Codex Mini"}),e.jsx(n.td,{children:"Fast, lower cost"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:'"premium"'})}),e.jsx(n.td,{children:"Gemini 3 Pro, Claude Opus 4.5, GPT-5.1 Codex"}),e.jsx(n.td,{children:"Higher quality, higher cost"})]})]})]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(mode="standard")   # default
vw.config(mode="premium")
`})}),`
`,e.jsx(n.h3,{children:"Recommended secure configuration"}),`
`,e.jsx(n.p,{children:"For sensitive data or shared environments, lock things down:"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(
    execution="approve",          # require manual approval
    agent_preset="safe",          # read-only tools, sandboxed
    bypass_row_guard=False,       # enforce row limit
    retry=0,                      # no automatic code repairs
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
`,e.jsxs(n.p,{children:["No API keys are written to disk. Generated widgets and audit reports are stored locally in ",e.jsx(n.code,{children:".vibewidget/"}),"."]})]})}function o(r={}){const{wrapper:n}=r.components||{};return n?e.jsx(n,{...r,children:e.jsx(d,{...r})}):d(r)}const a=()=>e.jsx(s,{Content:o,meta:t});export{a as default};
