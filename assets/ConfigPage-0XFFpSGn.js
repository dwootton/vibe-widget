import{j as e}from"./index-B4z5kDSy.js";import{D as d}from"./DocMdxPage-DDr1xgCs.js";import"./DocContent-CBrQcdvq.js";const o={title:"Configuration",description:"Configure model settings and API keys."};function r(s){const n={code:"code",h2:"h2",h3:"h3",li:"li",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...s.components};return e.jsxs(e.Fragment,{children:[e.jsx(n.p,{children:"Configure model settings and API keys."}),`
`,e.jsx(n.h2,{children:"Set defaults"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`import vibe_widget as vw

vw.config(model="openai/gpt-5.1-codex")
vw.config(mode="premium", model="openrouter")
vw.config(execution="approve")
`})}),`
`,e.jsx(n.h2,{children:"API key setup"}),`
`,e.jsxs(n.p,{children:["Put one key in a ",e.jsx(n.code,{children:".env"})," file next to your notebook and you are done:"]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-bash",children:`ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
`})}),`
`,e.jsxs(n.p,{children:[`The file is searched for in the working directory and its parents, stopping at the repository root
or your home directory. A variable already present in the environment is never overwritten, so an
exported value always wins over the file. No extra dependency is needed; do not call
`,e.jsx(n.code,{children:"dotenv.load_dotenv()"})," yourself."]}),`
`,e.jsx(n.p,{children:"Exporting the variable works identically:"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-bash",children:`export ANTHROPIC_API_KEY='your-key'
`})}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-powershell",children:`$env:ANTHROPIC_API_KEY="your-key"
`})}),`
`,e.jsx(n.p,{children:"We recommend avoiding hardcoded keys in notebooks to prevent accidental leaks."}),`
`,e.jsx(n.h2,{children:"Provider inference"}),`
`,e.jsxs(n.p,{children:["When you do not set ",e.jsx(n.code,{children:"base_url"}),", the key you supplied decides the endpoint and the default model."]}),`
`,e.jsxs(n.table,{children:[e.jsx(n.thead,{children:e.jsxs(n.tr,{children:[e.jsx(n.th,{children:"Variable"}),e.jsx(n.th,{children:"Endpoint"}),e.jsx(n.th,{children:"Default model"})]})}),e.jsxs(n.tbody,{children:[e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:"VIBE_API_KEY"})}),e.jsxs(n.td,{children:[e.jsx(n.code,{children:"VIBE_BASE_URL"}),", or OpenRouter"]}),e.jsx(n.td,{children:"depends on the endpoint"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:"ANTHROPIC_API_KEY"})}),e.jsx(n.td,{children:e.jsx(n.code,{children:"https://api.anthropic.com/v1/"})}),e.jsx(n.td,{children:e.jsx(n.code,{children:"claude-opus-5"})})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:"OPENAI_API_KEY"})}),e.jsx(n.td,{children:e.jsx(n.code,{children:"https://api.openai.com/v1"})}),e.jsx(n.td,{children:e.jsx(n.code,{children:"gpt-5.5"})})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:"OPENROUTER_API_KEY"})}),e.jsx(n.td,{children:e.jsx(n.code,{children:"https://openrouter.ai/api/v1"})}),e.jsx(n.td,{children:e.jsx(n.code,{children:"google/gemini-3-flash-preview"})})]})]})]}),`
`,e.jsxs(n.p,{children:["They are checked in that order, so ",e.jsx(n.code,{children:"VIBE_API_KEY"})," overrides everything and ",e.jsx(n.code,{children:"OPENROUTER_API_KEY"}),` is
the last resort. An explicit `,e.jsx(n.code,{children:"vw.config(api_key=...)"}),` beats all of them. If a key looks like it was
issued by a different vendor, for example an `,e.jsx(n.code,{children:"sk-ant-"})," value stored in ",e.jsx(n.code,{children:"OPENAI_API_KEY"}),`, the
variable name decides and a warning is printed once.`]}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"vw.config()"})," reports what was inferred, without ever showing the key:"]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config()
# Config(provider='openai', host='api.openai.com', model='gpt-5.5',
#        key_source='OPENAI_API_KEY (/work/analysis/.env)', environment='quarto', ...)
`})}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"provider"})," is derived from the endpoint and reads ",e.jsx(n.code,{children:"anthropic"}),", ",e.jsx(n.code,{children:"openai"}),", ",e.jsx(n.code,{children:"openrouter"})," or ",e.jsx(n.code,{children:"custom"}),`.
`,e.jsx(n.code,{children:"environment"})," lists the notebook hosts detected for this kernel, such as ",e.jsx(n.code,{children:"vscode-like"}),` for VS Code
and Positron, `,e.jsx(n.code,{children:"quarto"}),", ",e.jsx(n.code,{children:"colab"})," or ",e.jsx(n.code,{children:"pyodide"}),"."]}),`
`,e.jsx(n.p,{children:"Changing the model alone keeps the provider your key selected:"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(model="claude-sonnet-5")   # still Anthropic
`})}),`
`,e.jsxs(n.p,{children:["Model IDs carrying an OpenRouter-style ",e.jsx(n.code,{children:"vendor/"}),` prefix are rejected on a direct provider, because
`,e.jsx(n.code,{children:"anthropic/claude-opus-4.5"}),` is not a name Anthropic's own API knows. Use the plain name, or set
`,e.jsx(n.code,{children:"base_url"})," to OpenRouter."]}),`
`,e.jsx(n.h2,{children:"Endpoint"}),`
`,e.jsxs(n.p,{children:["Set ",e.jsx(n.code,{children:"base_url"})," to reach any other OpenAI-compatible server, including a local one."]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(base_url="http://localhost:11434/v1", model="qwen2.5-coder")   # Ollama
vw.config(base_url="http://localhost:8000/v1", model="Qwen/Qwen2.5-Coder-32B")  # vLLM
`})}),`
`,e.jsxs(n.p,{children:["A loopback endpoint (",e.jsx(n.code,{children:"localhost"}),", ",e.jsx(n.code,{children:"127.0.0.1"}),", ",e.jsx(n.code,{children:"::1"}),`) needs no API key at all, since local servers
ignore it. Set `,e.jsx(n.code,{children:"VIBE_API_KEY"})," anyway if yours sits behind an auth proxy."]}),`
`,e.jsxs(n.p,{children:[`For an endpoint with no dedicated variable, such as vLLM behind an auth proxy or Azure OpenAI, set
both `,e.jsx(n.code,{children:"VIBE_API_KEY"})," and ",e.jsx(n.code,{children:"VIBE_BASE_URL"}),":"]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-bash",children:`VIBE_API_KEY=your-key
VIBE_BASE_URL=https://my-resource.openai.azure.com/openai/v1
`})}),`
`,e.jsxs(n.p,{children:["Requests adapt to what the endpoint accepts. Newer OpenAI models want ",e.jsx(n.code,{children:"max_completion_tokens"}),`
instead of `,e.jsx(n.code,{children:"max_tokens"}),", and some models reject ",e.jsx(n.code,{children:"temperature"}),` outright; the rejected parameter is
renamed or dropped and remembered, so only the first call to a given endpoint pays for the
correction.`]}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"timeout"}),` is the HTTP timeout in seconds for a single model call, 120 by default. Raise it for slow
local models.`]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(timeout=300.0)
`})}),`
`,e.jsx(n.h2,{children:"Models"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.models()
vw.models(show="all")
vw.models(verbose=False)
`})}),`
`,e.jsx(n.h2,{children:"Common configuration options"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(
    execution="auto",   # "auto" or "approve"
    retry=2,            # Runtime repair attempts
    agent_preset="project",
    agent_run={"permission_tier": 1, "allowed_roots": ["."]},
    bypass_row_guard=False,
    base_url=None,      # None means infer from whichever API key is set
    timeout=120.0,      # HTTP timeout, seconds
    data_privacy="sample",  # "sample" or "schema"
    sample_rows=3,      # rows sent per input in "sample" mode
)
`})}),`
`,e.jsx(n.h2,{children:"Safety and permissions"}),`
`,e.jsxs(n.p,{children:[`Generated code runs in the notebook page with the same privileges as the page itself. It can reach
the DOM, cookies and `,e.jsx(n.code,{children:"localStorage"}),` for the notebook origin, and any network endpoint the browser
is allowed to call. There is no browser-level sandbox around it. Treat a generated widget the way
you would treat a script someone sent you.`]}),`
`,e.jsx(n.h3,{children:"Execution mode"}),`
`,e.jsx(n.p,{children:"Control whether code runs immediately or requires manual approval first."}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(execution="approve")   # review code before it runs
vw.config(execution="auto")      # run immediately (default)
`})}),`
`,e.jsxs(n.p,{children:["In ",e.jsx(n.code,{children:'"approve"'}),` mode the generated code is not executed until you approve it. Approval is decided in
Python, not in the browser, so a widget cannot approve itself. The widget tracks a SHA-256 hash of
the approved code; if the code changes after an edit or a retry, approval resets and you approve
again.`]}),`
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
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"Tier 0 tools"})," – ",e.jsx(n.code,{children:"data.profile"}),", ",e.jsx(n.code,{children:"fs.list"}),", ",e.jsx(n.code,{children:"fs.read"}),", ",e.jsx(n.code,{children:"fs.exists"}),", ",e.jsx(n.code,{children:"fs.glob"}),", ",e.jsx(n.code,{children:"state.get"}),", ",e.jsx(n.code,{children:"state.put"}),", ",e.jsx(n.code,{children:"pls.describe"})]}),`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"Tier 1 adds"})," – ",e.jsx(n.code,{children:"data.load"}),", ",e.jsx(n.code,{children:"fs.write"}),", ",e.jsx(n.code,{children:"fs.mkdir"}),", ",e.jsx(n.code,{children:"fs.read_base64"})]}),`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"Tier 2 adds"})," – ",e.jsx(n.code,{children:"net.fetch"})," (HTTPS only, host and MIME allowlisted, requires ",e.jsx(n.code,{children:"allow_net_fetch"}),")"]}),`
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
`,e.jsx(n.li,{children:"a schema summary of each input: shape, column names, dtypes, null counts, cardinality, and numeric min/max/mean"}),`
`,e.jsxs(n.li,{children:["the first ",e.jsx(n.code,{children:"sample_rows"})," rows of each input, 3 by default, when ",e.jsx(n.code,{children:"data_privacy"})," is ",e.jsx(n.code,{children:'"sample"'})]}),`
`,e.jsx(n.li,{children:"outputs/inputs descriptors"}),`
`,e.jsx(n.li,{children:"full widget code for edits, audits, and runtime fixes"}),`
`,e.jsx(n.li,{children:"runtime error messages (when auto-fixing)"}),`
`]}),`
`,e.jsx(n.h3,{children:"Controlling what leaves the notebook"}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"data_privacy"})," chooses between the two summary modes."]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(data_privacy="schema")   # schema only, no cell values
vw.config(data_privacy="sample")   # schema plus head rows (default)
vw.config(sample_rows=1)           # fewer rows in "sample" mode
`})}),`
`,e.jsxs(n.p,{children:["In ",e.jsx(n.code,{children:'"schema"'}),` mode the summary carries no cell values: no head rows, no category examples, no
sampled values. Only the shape and the per-column description go out. Non-tabular inputs are
summarized by type and length, and their truncated `,e.jsx(n.code,{children:"repr"})," is included in ",e.jsx(n.code,{children:'"sample"'})," mode only."]}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"data_privacy"})," governs the data summary built from the values you pass to ",e.jsx(n.code,{children:"vw.create"}),`. It does not
restrict the agent's `,e.jsx(n.code,{children:"data.profile"}),` tool, which reads sample values from any file it is allowed to
open. Combine `,e.jsx(n.code,{children:'data_privacy="schema"'})," with ",e.jsx(n.code,{children:'agent_preset="safe"'}),` to keep the agent out of your
project directory as well.`]}),`
`,e.jsxs(n.p,{children:["No API keys are written to disk. Generated widgets and audit reports are stored locally in ",e.jsx(n.code,{children:".vibewidget/"}),"."]})]})}function i(s={}){const{wrapper:n}=s.components||{};return n?e.jsx(n,{...s,children:e.jsx(r,{...s})}):r(s)}const a=()=>e.jsx(d,{Content:i,meta:o});export{a as default};
