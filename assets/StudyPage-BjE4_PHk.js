import{j as e}from"./index-Bjb9_FNN.js";import{D as h}from"./DocMdxPage-CYzpg4A9.js";import"./DocContent-Cquz_hLD.js";const l={title:"Research Studies",description:"Record intent artifact traces from Vibe Widget so vis researchers can study how domain experts build visualizations with AI."};function c(n){const t={a:"a",code:"code",em:"em",h2:"h2",li:"li",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...n.components},{InstallCommand:i,Note:r,StudyLoopDiagram:d,TraceLineage:a,Warning:o}=t;return i||s("InstallCommand"),r||s("Note"),d||s("StudyLoopDiagram"),a||s("TraceLineage"),o||s("Warning"),e.jsxs(e.Fragment,{children:[e.jsx(o,{title:"Planning a study? Please reach out first.",children:e.jsxs(t.p,{children:[`The study tools are an early research preview and still changing. Before you run a study with
Vibe Widget, email us at `,e.jsx(t.a,{href:"mailto:dwootton@mit.edu",children:"dwootton@mit.edu"}),`. We'll help you set it up
and let you know about changes that could affect your data.`]})}),`
`,e.jsxs(t.p,{children:[`Vis researchers want to know how people actually author visualizations with AI: what they ask
for, what the model gives back, which edits they make, and where things break. Vibe Widget sits
right at that moment, inside a domain expert's own notebook, so it can record an `,e.jsx(t.strong,{children:`intent
artifact trace`})," for every widget: each request paired with the code it produced."]}),`
`,e.jsxs(t.p,{children:[e.jsx(t.code,{children:"vibe-widget-study"}),` is a separate, opt-in package for running those studies. A vis researcher
sets up a study, sends a domain collaborator a join code, and the collaborator keeps working in
their notebook as usual.`]}),`
`,e.jsx(d,{}),`
`,e.jsx(t.h2,{children:"What a trace looks like"}),`
`,e.jsxs(t.p,{children:["A trace is one widget's ",e.jsx(t.strong,{children:"lineage"}),`: every revision of it, from the first prompt onward. Each
code version (an artifact) is a node, and the request that produced it (an intent) is the arrow
into it. When code breaks and the system repairs it, the error is the arrow instead.`]}),`
`,e.jsx(a,{}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsxs(t.li,{children:["Every event in a lineage shares a ",e.jsx(t.code,{children:"lineage_id"}),`. It is saved with the widget, so the chain
survives `,e.jsx(t.code,{children:"widget.edit(...)"}),", ",e.jsx(t.code,{children:"vw.load(...)"}),", and restarting the kernel."]}),`
`,e.jsxs(t.li,{children:["Every code version has a ",e.jsx(t.code,{children:"version_id"})," and a ",e.jsx(t.code,{children:"parent_version_id"}),`, so a lineage is a tree you can
walk: which request led to which code, which fix followed which error.`]}),`
`,e.jsxs(t.li,{children:["Each version records its ",e.jsx(t.code,{children:"origin"}),": ",e.jsx(t.code,{children:"generated"}),", ",e.jsx(t.code,{children:"cache"}),", ",e.jsx(t.code,{children:"grab_edit"}),", ",e.jsx(t.code,{children:"autofix"}),`,
`,e.jsx(t.code,{children:"manual_edit"})," (someone typed in the code editor), and so on."]}),`
`]}),`
`,e.jsx(t.h2,{children:"Try it"}),`
`,e.jsx(t.p,{children:`The study package is installed separately from Vibe Widget, so research code never ships to
people who didn't ask for it.`}),`
`,e.jsx(i,{command:'pip install "git+https://github.com/dwootton/vibe-widget#subdirectory=study"'}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`import vibe_widget as vw
import vibe_widget_study as study   # also available as vw.study once installed

study.start()                       # writes .vibewidget/traces/<session>.jsonl
w = vw.create("scatter of dose vs response", df)
w.edit("color the points by cohort")

trace = study.events()              # one row per event
trace.groupby("lineage_id")["kind"].apply(list)
study.stop()
`})}),`
`,e.jsx(t.h2,{children:"What is recorded"}),`
`,e.jsxs(t.table,{children:[e.jsx(t.thead,{children:e.jsxs(t.tr,{children:[e.jsx(t.th,{children:"Stream"}),e.jsx(t.th,{children:"Events"}),e.jsx(t.th,{children:"Contains"})]})}),e.jsxs(t.tbody,{children:[e.jsxs(t.tr,{children:[e.jsxs(t.td,{children:[e.jsx(t.code,{children:"intents"})," (required)"]}),e.jsxs(t.td,{children:[e.jsx(t.code,{children:"intent.create"}),", ",e.jsx(t.code,{children:"intent.edit"}),", ",e.jsx(t.code,{children:"intent.grab_edit"}),", ",e.jsx(t.code,{children:"intent.state_prompt"}),", ",e.jsx(t.code,{children:"intent.approve"}),", ",e.jsx(t.code,{children:"intent.cancel"}),", ",e.jsx(t.code,{children:"artifact.version"}),", ",e.jsx(t.code,{children:"context.contract"})]}),e.jsx(t.td,{children:"prompts, the element a grab-edit pointed at, version origin and size, declared outputs"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:e.jsx(t.code,{children:"code"})}),e.jsx(t.td,{children:e.jsx(t.code,{children:"artifact.code"})}),e.jsx(t.td,{children:"the full code of each version"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:e.jsx(t.code,{children:"errors"})}),e.jsxs(t.td,{children:[e.jsx(t.code,{children:"error.generation"}),", ",e.jsx(t.code,{children:"error.runtime"}),", ",e.jsx(t.code,{children:"error.edit"})]}),e.jsx(t.td,{children:"error messages"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:e.jsx(t.code,{children:"schema"})}),e.jsx(t.td,{children:e.jsx(t.code,{children:"context.schema"})}),e.jsx(t.td,{children:"column names and dtypes"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:e.jsx(t.code,{children:"usage"})}),e.jsx(t.td,{children:e.jsx(t.code,{children:"usage.request"})}),e.jsx(t.td,{children:"model, tokens and dollar cost of each LLM request"})]}),e.jsxs(t.tr,{children:[e.jsxs(t.td,{children:[e.jsx(t.code,{children:"interactions"})," ",e.jsx(t.em,{children:"(planned)"})]}),e.jsx(t.td,{children:e.jsx(t.code,{children:"interaction.*"})}),e.jsx(t.td,{children:"output changes, links between widgets"})]}),e.jsxs(t.tr,{children:[e.jsxs(t.td,{children:[e.jsx(t.code,{children:"replay"})," ",e.jsx(t.em,{children:"(planned)"})]}),e.jsx(t.td,{children:e.jsx(t.code,{children:"replay.*"})}),e.jsx(t.td,{children:"an rrweb recording of the widget only"})]})]})]}),`
`,e.jsxs(t.p,{children:["Pick streams with ",e.jsx(t.code,{children:'study.start(streams=["intents", "errors"])'}),`. Anything outside them is dropped
before it is written.`]}),`
`,e.jsx(r,{title:"Privacy by design",children:e.jsxs(t.p,{children:["Nothing is recorded unless a collaborator installs ",e.jsx(t.code,{children:"vibe-widget-study"})," and calls ",e.jsx(t.code,{children:"study.start()"}),`.
Traces stay on their own machine as plain JSON lines they can read and delete, in a folder that is
git-ignored, and the schema stream keeps column names and types, never data values.`]})}),`
`,e.jsx(t.h2,{children:"Spend caps"}),`
`,e.jsx(t.p,{children:`A study pays for its participants' LLM use, so it needs a ceiling. There are two layers, and a
study should use both.`}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"A budget in the study."})," ",e.jsx(t.code,{children:"study.start(budget_usd=5)"}),` stops sending requests once $5 has been spent
across `,e.jsx(t.em,{children:"every"})," session in that trace folder. The spend is kept in a small ",e.jsx(t.code,{children:"spend.json"}),` next to the
traces, so restarting the kernel doesn't reset it, and a later `,e.jsx(t.code,{children:"start()"}),` keeps the same budget.
Participants get a warning at 80% and a clear message when it runs out. `,e.jsx(t.code,{children:"study.budget()"}),` shows
where they stand. The ledger is kept even if the participant turns the `,e.jsx(t.code,{children:"usage"})," stream off."]}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`study.start(budget_usd=5)
study.budget()
# {'budget_usd': 5, 'spent_usd': 0.0123, 'remaining_usd': 4.9877, 'this_session_usd': 0.0041, ...}
`})}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"A key with a credit limit."}),` The budget runs in the participant's notebook, so it is a guard,
not a wall. For a hard cap, give each participant their own OpenRouter key with a credit limit.
OpenRouter enforces it on its side and refuses requests once it is spent; Vibe Widget then tells the
participant to ask the researcher. Creating keys needs an OpenRouter `,e.jsx(t.em,{children:"management"}),` key, which can
manage keys but cannot make requests itself.`]}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`from vibe_widget_study import keys

k = keys.create_participant_key(MANAGEMENT_KEY, "P07 - cohort study", limit_usd=5)
k["key"]                                   # send to the participant, once
keys.get_key(MANAGEMENT_KEY, k["hash"])    # usage, limit, limit_remaining
keys.set_key_limit(MANAGEMENT_KEY, k["hash"], 10)
keys.disable_key(MANAGEMENT_KEY, k["hash"])  # revoke
`})}),`
`,e.jsx(t.p,{children:`With the default model (GPT-6 Luna), a widget costs roughly a fifth of a cent to generate, so $5
covers a few thousand generations.`}),`
`,e.jsxs(t.h2,{children:["For vis researchers ",e.jsx(t.em,{children:"(planned)"})]}),`
`,e.jsx(t.p,{children:`A study is defined by a short manifest. The consent card collaborators see is generated from it,
and the server only accepts the streams each participant agreed to.`}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-yaml",children:`study: Clinical cohort exploration
contact: researcher@lab.edu
irb: "2026-0412"
retention_days: 365
upload: batch            # or "review": participant approves each batch
budget_usd: 5            # per participant; join() can also issue a capped key

streams:
  intents:      { required: true }
  code:         { default: on }
  schema:       { default: on }
  interactions: { default: off }
  replay:       { default: off, mask_inputs: true, canvas_fps: 2 }
`})}),`
`,e.jsx(t.p,{children:`The study store is the researcher's own Supabase project, set up from a template: tables,
row-level security, and one ingest function. Collaborators then join from a notebook cell:`}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-python",children:`import vibe_widget_study as study
study.join("vws_7f3k-...")   # shows the consent card; nothing is sent before "Agree"
`})}),`
`,e.jsx(t.p,{children:`Replay will record only the widget itself, by mounting it in its own frame. Recording the whole
notebook page would also capture other cells' data, which our prototype confirmed.`}),`
`,e.jsxs(t.p,{children:["If you'd like to run a study with it, email ",e.jsx(t.a,{href:"mailto:dwootton@mit.edu",children:"dwootton@mit.edu"}),"."]})]})}function u(n={}){const{wrapper:t}=n.components||{};return t?e.jsx(t,{...n,children:e.jsx(c,{...n})}):c(n)}function s(n,t){throw new Error("Expected component `"+n+"` to be defined: you likely forgot to import, pass, or provide it.")}const g=()=>e.jsx(h,{Content:u,meta:l});export{g as default};
