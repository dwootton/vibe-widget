import{j as e}from"./index-CkRJxMr7.js";import{D as r}from"./DocMdxPage-BHZwN-Z3.js";import"./DocContent-DGIgVrr-.js";const t={title:"Configuration",description:"Set the model, the endpoint, and the safety limits."};function s(o){const n={code:"code",h2:"h2",h3:"h3",li:"li",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...o.components};return e.jsxs(e.Fragment,{children:[e.jsxs(n.p,{children:[e.jsx(n.code,{children:"vw.config()"}),` reads and changes the settings every widget uses. Called with no arguments it reports
what is currently in effect, and called with keyword arguments it changes those settings for the
rest of the session.`]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`import vibe_widget as vw

vw.config(model="claude-sonnet-5")
vw.config(mode="premium")
vw.config(execution="approve")
`})}),`
`,e.jsx(n.h2,{children:"API key setup"}),`
`,e.jsxs(n.p,{children:["Put one key in a ",e.jsx(n.code,{children:".env"})," file next to your notebook:"]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-bash",children:`ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
`})}),`
`,e.jsxs(n.p,{children:[`The file is looked for in the working directory and each parent directory, stopping at the
repository root or your home directory. A variable already present in the environment is never
overwritten, so an exported value wins over the file. No extra package is needed, and you should not
call `,e.jsx(n.code,{children:"dotenv.load_dotenv()"})," yourself."]}),`
`,e.jsx(n.p,{children:"Exporting the variable works the same way:"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-bash",children:`export ANTHROPIC_API_KEY='your-key'
`})}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-powershell",children:`$env:ANTHROPIC_API_KEY="your-key"
`})}),`
`,e.jsx(n.p,{children:`Keep keys out of the notebook itself, because a hardcoded key is easy to commit or share by
accident.`}),`
`,e.jsx(n.h2,{children:"Provider inference"}),`
`,e.jsxs(n.p,{children:["When you do not set ",e.jsx(n.code,{children:"base_url"}),`, the key you supplied decides both the endpoint and the default
model.`]}),`
`,e.jsxs(n.table,{children:[e.jsx(n.thead,{children:e.jsxs(n.tr,{children:[e.jsx(n.th,{children:"Variable"}),e.jsx(n.th,{children:"Endpoint"}),e.jsx(n.th,{children:"Default model"})]})}),e.jsxs(n.tbody,{children:[e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:"VIBE_API_KEY"})}),e.jsxs(n.td,{children:[e.jsx(n.code,{children:"VIBE_BASE_URL"}),", or OpenRouter"]}),e.jsx(n.td,{children:"depends on the endpoint"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:"ANTHROPIC_API_KEY"})}),e.jsx(n.td,{children:e.jsx(n.code,{children:"https://api.anthropic.com/v1/"})}),e.jsx(n.td,{children:e.jsx(n.code,{children:"claude-opus-5"})})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:"OPENAI_API_KEY"})}),e.jsx(n.td,{children:e.jsx(n.code,{children:"https://api.openai.com/v1"})}),e.jsx(n.td,{children:e.jsx(n.code,{children:"gpt-5.5"})})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:"OPENROUTER_API_KEY"})}),e.jsx(n.td,{children:e.jsx(n.code,{children:"https://openrouter.ai/api/v1"})}),e.jsx(n.td,{children:e.jsx(n.code,{children:"google/gemini-3-flash-preview"})})]})]})]}),`
`,e.jsxs(n.p,{children:["The variables are checked in that order, so ",e.jsx(n.code,{children:"VIBE_API_KEY"}),` overrides everything and
`,e.jsx(n.code,{children:"OPENROUTER_API_KEY"})," is the last one tried. An explicit ",e.jsx(n.code,{children:"vw.config(api_key=...)"}),` beats all of them.
When a key carries a prefix belonging to a different vendor, such as an `,e.jsx(n.code,{children:"sk-ant-"}),` value stored in
`,e.jsx(n.code,{children:"OPENAI_API_KEY"}),", the variable name decides the provider and a warning is printed once."]}),`
`,e.jsxs(n.p,{children:["Calling ",e.jsx(n.code,{children:"vw.config()"})," with no arguments reports what was inferred, without printing the key:"]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config()
# Config(provider='openai', host='api.openai.com', model='gpt-5.5',
#        key_source='OPENAI_API_KEY (/work/analysis/.env)', environment='quarto', ...)
`})}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"provider"})," is derived from the endpoint and reads ",e.jsx(n.code,{children:"anthropic"}),", ",e.jsx(n.code,{children:"openai"}),", ",e.jsx(n.code,{children:"openrouter"})," or ",e.jsx(n.code,{children:"custom"}),`.
`,e.jsx(n.code,{children:"environment"})," lists the notebook hosts detected for the running kernel, such as ",e.jsx(n.code,{children:"vscode-like"}),` for
VS Code and Positron, `,e.jsx(n.code,{children:"quarto"}),", ",e.jsx(n.code,{children:"colab"})," or ",e.jsx(n.code,{children:"pyodide"}),"."]}),`
`,e.jsx(n.p,{children:"Changing only the model keeps the provider your key selected:"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(model="claude-sonnet-5")   # still Anthropic
`})}),`
`,e.jsxs(n.p,{children:["A model id written in OpenRouter's ",e.jsx(n.code,{children:"vendor/name"}),` form is routed to OpenRouter when
`,e.jsx(n.code,{children:"OPENROUTER_API_KEY"}),` is set, even if an Anthropic or OpenAI key is also present, because that form
of id exists only on OpenRouter. Going back to a plain model name returns you to the provider your
other key selects.`]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(model="anthropic/claude-opus-4.5")   # OpenRouter, when its key is set
vw.config(model="claude-sonnet-5")             # back to Anthropic
`})}),`
`,e.jsxs(n.p,{children:["Without an OpenRouter key the same id raises a ",e.jsx(n.code,{children:"ValueError"}),` explaining that Anthropic's own API does
not know the name, and telling you to use the plain name or point `,e.jsx(n.code,{children:"base_url"})," at OpenRouter."]}),`
`,e.jsx(n.h2,{children:"Endpoint"}),`
`,e.jsxs(n.p,{children:["Set ",e.jsx(n.code,{children:"base_url"})," to reach any other OpenAI-compatible server, including one running on your machine."]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(base_url="http://localhost:11434/v1", model="qwen2.5-coder")   # Ollama
vw.config(base_url="http://localhost:8000/v1", model="Qwen/Qwen2.5-Coder-32B")  # vLLM
`})}),`
`,e.jsxs(n.p,{children:["An endpoint on ",e.jsx(n.code,{children:"localhost"}),", ",e.jsx(n.code,{children:"127.0.0.1"})," or ",e.jsx(n.code,{children:"::1"}),` needs no API key, because local servers ignore it.
Set `,e.jsx(n.code,{children:"VIBE_API_KEY"})," anyway when yours sits behind an auth proxy."]}),`
`,e.jsxs(n.p,{children:["For an endpoint with no dedicated variable, such as Azure OpenAI, set both ",e.jsx(n.code,{children:"VIBE_API_KEY"}),` and
`,e.jsx(n.code,{children:"VIBE_BASE_URL"}),":"]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-bash",children:`VIBE_API_KEY=your-key
VIBE_BASE_URL=https://my-resource.openai.azure.com/openai/v1
`})}),`
`,e.jsxs(n.p,{children:["Requests adapt to what the endpoint accepts. Newer OpenAI models want ",e.jsx(n.code,{children:"max_completion_tokens"}),`
instead of `,e.jsx(n.code,{children:"max_tokens"}),", and some models reject ",e.jsx(n.code,{children:"temperature"}),` outright. The rejected parameter is
renamed or dropped and the correction is remembered, so only the first call to a given endpoint pays
for it.`]}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"timeout"}),` is the HTTP timeout in seconds for one model call, and it defaults to 120. Raise it for
slow local models.`]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(timeout=300.0)
`})}),`
`,e.jsx(n.h2,{children:"Models and modes"}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"vw.models"})," prints the catalog, and ",e.jsx(n.code,{children:"vw.models.standard"})," and ",e.jsx(n.code,{children:"vw.models.premium"}),` return the default
id for each tier.`]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.models
vw.models.standard   # "google/gemini-3-flash-preview"
vw.models.premium    # "google/gemini-3-pro-preview"
`})}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"mode"}),` picks between two OpenRouter defaults, a faster and cheaper one and a slower and stronger
one.`]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(mode="standard")   # google/gemini-3-flash-preview, the default
vw.config(mode="premium")    # google/gemini-3-pro-preview
`})}),`
`,e.jsxs(n.p,{children:["Setting ",e.jsx(n.code,{children:"mode"}),` swaps the model only while you are on one of those two defaults. Once you name a
model yourself, your choice stays, and `,e.jsx(n.code,{children:"mode"})," no longer changes it. The word ",e.jsx(n.code,{children:'"openrouter"'}),` can be
passed as the model name to mean whichever id the current mode points to.`]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(mode="premium", model="openrouter")   # google/gemini-3-pro-preview
`})}),`
`,e.jsx(n.h2,{children:"Common options"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(
    execution="auto",       # "auto" or "approve"
    retry=2,                # automatic repair attempts per generation
    agent_preset="project",
    agent_run={"permission_tier": 1, "allowed_roots": ["."]},
    bypass_row_guard=False,
    base_url=None,          # None means infer from whichever API key is set
    timeout=120.0,          # HTTP timeout, seconds
    data_privacy="sample",  # "sample" or "schema"
    sample_rows=3,          # rows sent per input in "sample" mode
)
`})}),`
`,e.jsxs(n.p,{children:[`The three settings that take fixed strings also have namespaces, so you can let autocomplete fill
them in: `,e.jsx(n.code,{children:"vw.execution.auto"}),", ",e.jsx(n.code,{children:"vw.execution.approve"}),", ",e.jsx(n.code,{children:"vw.mode.standard"}),", ",e.jsx(n.code,{children:"vw.mode.premium"}),`,
`,e.jsx(n.code,{children:"vw.presets.safe"}),", ",e.jsx(n.code,{children:"vw.presets.project"})," and ",e.jsx(n.code,{children:"vw.presets.connected"}),"."]}),`
`,e.jsx(n.h2,{children:"Automatic repair"}),`
`,e.jsxs(n.p,{children:[`When generated code throws an error in the browser, the error is sent back to the model and the
model is asked to fix it. `,e.jsx(n.code,{children:"retry"})," is how many of those attempts one generation is allowed."]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(retry=2)   # the default
vw.config(retry=0)   # never repair automatically
`})}),`
`,e.jsxs(n.p,{children:[`The budget covers a single generation. A repair that succeeds does not refill it, so a widget that
keeps failing cannot loop indefinitely, and a new generation starts with a full budget again. Once
the attempts are used up the widget's status becomes `,e.jsx(n.code,{children:"blocked"}),`, and a log line tells you to describe
the fix in the prompt box or to raise the budget with `,e.jsx(n.code,{children:"vw.config(retry=N)"}),`. Typing a fix into the
prompt box still works at `,e.jsx(n.code,{children:"retry=0"}),", because the budget only governs the automatic attempts."]}),`
`,e.jsx(n.h2,{children:"Cost"}),`
`,e.jsx(n.p,{children:"Each widget counts the tokens it spent:"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`widget.usage
# {'prompt_tokens': 18432, 'completion_tokens': 5120, 'requests': 2}
`})}),`
`,e.jsxs(n.p,{children:[`Loading a cached widget makes no request, so the counts stay at zero until something calls the
model. With no API key set there is no provider at all, and `,e.jsx(n.code,{children:"widget.usage"})," is an empty dict."]}),`
`,e.jsx(n.h2,{children:"Safety and permissions"}),`
`,e.jsxs(n.p,{children:[`Generated code runs in the notebook page with the same privileges as the page. It can reach the DOM,
cookies and `,e.jsx(n.code,{children:"localStorage"}),` for the notebook origin, and any network endpoint the browser is allowed
to call. There is no browser-level sandbox around it.`]}),`
`,e.jsx(n.h3,{children:"Execution mode"}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"execution"})," decides whether generated code runs as soon as it arrives or waits for you."]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(execution="approve")   # review the code before it runs
vw.config(execution="auto")      # run immediately, the default
`})}),`
`,e.jsxs(n.p,{children:["In ",e.jsx(n.code,{children:'"approve"'}),` mode the code does not execute until you approve it. Approval is decided in Python
rather than in the browser, so a widget cannot approve itself. The widget stores a hash of the
code you approved, and if the code changes through an edit or a repair the approval resets and you
are asked again.`]}),`
`,e.jsx(n.h3,{children:"Agent presets"}),`
`,e.jsx(n.p,{children:"An agent preset decides which tools the model is allowed to call while it works."}),`
`,e.jsxs(n.table,{children:[e.jsx(n.thead,{children:e.jsxs(n.tr,{children:[e.jsx(n.th,{children:"Preset"}),e.jsx(n.th,{children:"Permission tier"}),e.jsx(n.th,{children:"File access"}),e.jsx(n.th,{children:"Network"}),e.jsx(n.th,{children:"Use case"})]})}),e.jsxs(n.tbody,{children:[e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:'"safe"'})}),e.jsx(n.td,{children:"0 (read-only)"}),e.jsx(n.td,{children:"Sandbox only"}),e.jsx(n.td,{children:"No"}),e.jsx(n.td,{children:"Sensitive data, minimal risk"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:'"project"'})}),e.jsx(n.td,{children:"1 (read-write)"}),e.jsx(n.td,{children:"Working dir + sandbox"}),e.jsx(n.td,{children:"No"}),e.jsx(n.td,{children:"General use (default)"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:'"connected"'})}),e.jsx(n.td,{children:"2 (full)"}),e.jsx(n.td,{children:"Working dir + sandbox"}),e.jsx(n.td,{children:"HTTPS only"}),e.jsx(n.td,{children:"Fetching remote data"})]})]})]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(agent_preset="safe")        # read-only tools, sandboxed
vw.config(agent_preset="project")     # read-write in your project directory, the default
vw.config(agent_preset="connected")   # also allowed to fetch HTTPS URLs
`})}),`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"Tier 0 tools"})," are ",e.jsx(n.code,{children:"data.profile"}),", ",e.jsx(n.code,{children:"fs.list"}),", ",e.jsx(n.code,{children:"fs.read"}),", ",e.jsx(n.code,{children:"fs.exists"}),", ",e.jsx(n.code,{children:"fs.glob"}),", ",e.jsx(n.code,{children:"state.get"}),", ",e.jsx(n.code,{children:"state.put"})," and ",e.jsx(n.code,{children:"pls.describe"}),"."]}),`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"Tier 1 adds"})," ",e.jsx(n.code,{children:"data.load"}),", ",e.jsx(n.code,{children:"fs.write"}),", ",e.jsx(n.code,{children:"fs.mkdir"})," and ",e.jsx(n.code,{children:"fs.read_base64"}),"."]}),`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"Tier 2 adds"})," ",e.jsx(n.code,{children:"net.fetch"}),", restricted to HTTPS with an allowlist for hosts and MIME types, and it requires ",e.jsx(n.code,{children:"allow_net_fetch"}),"."]}),`
`,e.jsx(n.h3,{children:"Row guard"}),`
`,e.jsxs(n.p,{children:["An input of more than 100,000 rows raises a ",e.jsx(n.code,{children:"ValueError"}),` naming the row count, so that a large
frame cannot exhaust memory while it is being prepared for the widget.`]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(bypass_row_guard=False)   # keep the guard, the default
vw.config(bypass_row_guard=True)    # allow larger datasets
`})}),`
`,e.jsx(n.h3,{children:"A locked-down configuration"}),`
`,e.jsx(n.p,{children:"For sensitive data or a shared machine, the settings below turn off everything that acts on its own:"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(
    execution="approve",          # require manual approval
    agent_preset="safe",          # read-only tools, sandboxed
    bypass_row_guard=False,       # enforce the row limit
    retry=0,                      # no automatic code repairs
)
`})}),`
`,e.jsx(n.h2,{children:"What is sent to the model provider"}),`
`,e.jsx(n.p,{children:"Vibe Widget sends the following:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"your prompt and theme prompt"}),`
`,e.jsx(n.li,{children:"a schema summary of each input, covering shape, column names, dtypes, null counts, cardinality, and numeric min, max and mean"}),`
`,e.jsxs(n.li,{children:["the first ",e.jsx(n.code,{children:"sample_rows"})," rows of each input, 3 by default, when ",e.jsx(n.code,{children:"data_privacy"})," is ",e.jsx(n.code,{children:'"sample"'})]}),`
`,e.jsx(n.li,{children:"the declared inputs, outputs and actions"}),`
`,e.jsx(n.li,{children:"the full widget code for edits, audits, and runtime repairs"}),`
`,e.jsx(n.li,{children:"runtime error messages, when a repair is running"}),`
`]}),`
`,e.jsx(n.h3,{children:"Controlling what leaves the notebook"}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"data_privacy"})," chooses between the two summary modes."]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.config(data_privacy="schema")   # schema only, no cell values
vw.config(data_privacy="sample")   # schema plus head rows, the default
vw.config(sample_rows=1)           # fewer rows in "sample" mode
`})}),`
`,e.jsxs(n.p,{children:["In ",e.jsx(n.code,{children:'"schema"'}),` mode the summary carries no cell values at all, so there are no head rows, no category
examples and no sampled values. Only the shape and the per-column description are sent. Inputs that
are not tables are summarized by type and length, and their truncated `,e.jsx(n.code,{children:"repr"}),` is included in
`,e.jsx(n.code,{children:'"sample"'})," mode only."]}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"data_privacy"})," governs the summary built from the values you pass to ",e.jsx(n.code,{children:"vw.create"}),`. It does not
restrict the agent's `,e.jsx(n.code,{children:"data.profile"}),` tool, which reads sample values from any file it is allowed to
open. Combine `,e.jsx(n.code,{children:'data_privacy="schema"'})," with ",e.jsx(n.code,{children:'agent_preset="safe"'}),` to keep the agent out of your
project directory as well.`]}),`
`,e.jsxs(n.p,{children:[`No API keys are written to disk. Generated widgets and audit reports are stored locally under
`,e.jsx(n.code,{children:".vibewidget/"}),"."]}),`
`,e.jsx(n.h2,{children:"When a request fails"}),`
`,e.jsxs(n.p,{children:["A failed model call raises a ",e.jsx(n.code,{children:"ProviderError"}),` carrying a short explanation instead of the raw SDK
exception. Each error names its kind, which is one of `,e.jsx(n.code,{children:"auth"}),", ",e.jsx(n.code,{children:"quota"}),", ",e.jsx(n.code,{children:"not_found"}),", ",e.jsx(n.code,{children:"rate_limit"}),`,
`,e.jsx(n.code,{children:"connection"}),", ",e.jsx(n.code,{children:"timeout"}),", ",e.jsx(n.code,{children:"context_length"})," or ",e.jsx(n.code,{children:"other"}),". A ",e.jsx(n.code,{children:"quota"}),` error means the key itself is valid
but its spending limit is used up, which is worth separating from `,e.jsx(n.code,{children:"auth"}),`, because rotating a working
key does not help. For `,e.jsx(n.code,{children:"quota"})," and ",e.jsx(n.code,{children:"not_found"}),` the provider's own sentence is passed through, since
it usually names the exact limit or model, and the raw response body is never included.`]})]})}function d(o={}){const{wrapper:n}=o.components||{};return n?e.jsx(n,{...o,children:e.jsx(s,{...o})}):s(o)}const l=()=>e.jsx(r,{Content:d,meta:t});export{l as default};
