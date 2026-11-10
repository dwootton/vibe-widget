import{j as e}from"./index-1BxOBNOs.js";import{D as c}from"./DocMdxPage-DvHcXfPW.js";import"./DocContent-DPOqeaKz.js";const l={title:"Research Studies",description:"Record intent artifact traces from Vibe Widget so vis researchers can study how domain experts build visualizations with AI."};function a(t){const n={a:"a",blockquote:"blockquote",code:"code",em:"em",h2:"h2",li:"li",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...t.components},{InstallCommand:r,StudyLoopDiagram:i,TraceLineage:d,Warning:o}=n;return r||s("InstallCommand"),i||s("StudyLoopDiagram"),d||s("TraceLineage"),o||s("Warning"),e.jsxs(e.Fragment,{children:[e.jsx(o,{title:"Planning a study? Please reach out first.",children:e.jsxs(n.p,{children:[`The study tools are an early research preview and still changing. Before you run a study with
Vibe Widget, email us at `,e.jsx(n.a,{href:"mailto:dwootton@mit.edu",children:"dwootton@mit.edu"}),`. We'll help you set it up
and let you know about changes that could affect your data.`]})}),`
`,e.jsxs(n.p,{children:[`Vis researchers want to know how people actually author visualizations with AI: what they ask
for, what the model gives back, which edits they make, and where things break. Vibe Widget sits
right at that moment, inside a domain expert's own notebook, so it can record an `,e.jsx(n.strong,{children:`intent
artifact trace`})," for every widget: each request paired with the code it produced."]}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"vibe-widget-study"}),` is a separate, opt-in package for running those studies. A vis researcher
sets up a study, sends a domain collaborator a join code, and the collaborator keeps working in
their notebook as usual.`]}),`
`,e.jsx(i,{}),`
`,e.jsxs(n.blockquote,{children:[`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"Preview."}),` Local recording works today. Study manifests, consent cards and upload to a
researcher's store are in progress; those parts are marked `,e.jsx(n.em,{children:"planned"})," below."]}),`
`]}),`
`,e.jsx(n.h2,{children:"What a trace looks like"}),`
`,e.jsxs(n.p,{children:["A trace is one widget's ",e.jsx(n.strong,{children:"lineage"}),`: every revision of it, from the first prompt onward.
Intents (what the person asked for) alternate with artifacts (the code version each one
produced), and errors land where they happened.`]}),`
`,e.jsx(d,{}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:["Every event in a lineage shares a ",e.jsx(n.code,{children:"lineage_id"}),`. It is saved with the widget, so the chain
survives `,e.jsx(n.code,{children:"widget.edit(...)"}),", ",e.jsx(n.code,{children:"vw.load(...)"}),", and restarting the kernel."]}),`
`,e.jsxs(n.li,{children:["Every code version has a ",e.jsx(n.code,{children:"version_id"})," and a ",e.jsx(n.code,{children:"parent_version_id"}),`, so a lineage is a tree you can
walk: which request led to which code, which fix followed which error.`]}),`
`,e.jsxs(n.li,{children:["Each version records its ",e.jsx(n.code,{children:"origin"}),": ",e.jsx(n.code,{children:"generated"}),", ",e.jsx(n.code,{children:"cache"}),", ",e.jsx(n.code,{children:"grab_edit"}),", ",e.jsx(n.code,{children:"autofix"}),`,
`,e.jsx(n.code,{children:"manual_edit"})," (someone typed in the code editor), and so on."]}),`
`]}),`
`,e.jsx(n.h2,{children:"Try it"}),`
`,e.jsx(n.p,{children:`The study package is installed separately from Vibe Widget, so research code never ships to
people who didn't ask for it.`}),`
`,e.jsx(r,{command:'pip install "git+https://github.com/dwootton/vibe-widget#subdirectory=study"'}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`import vibe_widget as vw
import vibe_widget_study as study   # also available as vw.study once installed

study.start()                       # writes .vibewidget/traces/<session>.jsonl
w = vw.create("scatter of dose vs response", df)
w.edit("color the points by cohort")

trace = study.events()              # one row per event
trace.groupby("lineage_id")["kind"].apply(list)
study.stop()
`})}),`
`,e.jsx(n.h2,{children:"What is recorded"}),`
`,e.jsxs(n.table,{children:[e.jsx(n.thead,{children:e.jsxs(n.tr,{children:[e.jsx(n.th,{children:"Stream"}),e.jsx(n.th,{children:"Events"}),e.jsx(n.th,{children:"Contains"})]})}),e.jsxs(n.tbody,{children:[e.jsxs(n.tr,{children:[e.jsxs(n.td,{children:[e.jsx(n.code,{children:"intents"})," (required)"]}),e.jsxs(n.td,{children:[e.jsx(n.code,{children:"intent.create"}),", ",e.jsx(n.code,{children:"intent.edit"}),", ",e.jsx(n.code,{children:"intent.grab_edit"}),", ",e.jsx(n.code,{children:"intent.state_prompt"}),", ",e.jsx(n.code,{children:"intent.approve"}),", ",e.jsx(n.code,{children:"intent.cancel"}),", ",e.jsx(n.code,{children:"artifact.version"}),", ",e.jsx(n.code,{children:"context.contract"})]}),e.jsx(n.td,{children:"prompts, the element a grab-edit pointed at, version origin and size, declared outputs"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:"code"})}),e.jsx(n.td,{children:e.jsx(n.code,{children:"artifact.code"})}),e.jsx(n.td,{children:"the full code of each version"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:"errors"})}),e.jsxs(n.td,{children:[e.jsx(n.code,{children:"error.generation"}),", ",e.jsx(n.code,{children:"error.runtime"}),", ",e.jsx(n.code,{children:"error.edit"})]}),e.jsx(n.td,{children:"error messages"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:"schema"})}),e.jsx(n.td,{children:e.jsx(n.code,{children:"context.schema"})}),e.jsx(n.td,{children:"column names and dtypes"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.code,{children:"usage"})}),e.jsx(n.td,{children:e.jsx(n.code,{children:"usage.request"})}),e.jsx(n.td,{children:"model, tokens and dollar cost of each LLM request"})]}),e.jsxs(n.tr,{children:[e.jsxs(n.td,{children:[e.jsx(n.code,{children:"interactions"})," ",e.jsx(n.em,{children:"(planned)"})]}),e.jsx(n.td,{children:e.jsx(n.code,{children:"interaction.*"})}),e.jsx(n.td,{children:"output changes, links between widgets"})]}),e.jsxs(n.tr,{children:[e.jsxs(n.td,{children:[e.jsx(n.code,{children:"replay"})," ",e.jsx(n.em,{children:"(planned)"})]}),e.jsx(n.td,{children:e.jsx(n.code,{children:"replay.*"})}),e.jsx(n.td,{children:"an rrweb recording of the widget only"})]})]})]}),`
`,e.jsxs(n.p,{children:["Pick streams with ",e.jsx(n.code,{children:'study.start(streams=["intents", "errors"])'}),`. Anything outside them is dropped
before it is written.`]}),`
`,e.jsx(n.h2,{children:"Privacy by design"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Off unless asked."})," Core Vibe Widget only ",e.jsx(n.em,{children:"announces"}),` events through an empty hook. Nothing is
recorded unless `,e.jsx(n.code,{children:"vibe-widget-study"})," is installed and ",e.jsx(n.code,{children:"start()"})," is called."]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Local first."}),` Events are written to the collaborator's own disk, in plain JSON lines they can
read. The traces folder carries its own `,e.jsx(n.code,{children:".gitignore"}),`, so prompts and code don't get committed
by accident.`]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"No data values."}),` The schema stream holds column names and types, never rows. Prompts can
still mention values, which is why upload will support a review-before-send mode.`]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Consent per stream"})," ",e.jsx(n.em,{children:"(planned)"}),`. Collaborators see exactly which streams a study asks for,
can turn optional ones off, and can leave and delete their data at any time.`]}),`
`]}),`
`,e.jsx(n.h2,{children:"Spend caps"}),`
`,e.jsx(n.p,{children:`A study pays for its participants' LLM use, so it needs a ceiling. There are two layers, and a
study should use both.`}),`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"A budget in the study."})," ",e.jsx(n.code,{children:"study.start(budget_usd=5)"}),` stops sending requests once $5 has been spent
across `,e.jsx(n.em,{children:"every"})," session in that trace folder. The spend is kept in a small ",e.jsx(n.code,{children:"spend.json"}),` next to the
traces, so restarting the kernel doesn't reset it, and a later `,e.jsx(n.code,{children:"start()"}),` keeps the same budget.
Participants get a warning at 80% and a clear message when it runs out. `,e.jsx(n.code,{children:"study.budget()"}),` shows
where they stand. The ledger is kept even if the participant turns the `,e.jsx(n.code,{children:"usage"})," stream off."]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`study.start(budget_usd=5)
study.budget()
# {'budget_usd': 5, 'spent_usd': 0.0123, 'remaining_usd': 4.9877, 'this_session_usd': 0.0041, ...}
`})}),`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"A key with a credit limit."}),` The budget runs in the participant's notebook, so it is a guard,
not a wall. For a hard cap, give each participant their own OpenRouter key with a credit limit.
OpenRouter enforces it on its side and refuses requests once it is spent; Vibe Widget then tells the
participant to ask the researcher. Creating keys needs an OpenRouter `,e.jsx(n.em,{children:"management"}),` key, which can
manage keys but cannot make requests itself.`]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`from vibe_widget_study import keys

k = keys.create_participant_key(MANAGEMENT_KEY, "P07 - cohort study", limit_usd=5)
k["key"]                                   # send to the participant, once
keys.get_key(MANAGEMENT_KEY, k["hash"])    # usage, limit, limit_remaining
keys.set_key_limit(MANAGEMENT_KEY, k["hash"], 10)
keys.disable_key(MANAGEMENT_KEY, k["hash"])  # revoke
`})}),`
`,e.jsx(n.p,{children:`With the default model (GPT-6 Luna), a widget costs roughly a fifth of a cent to generate, so $5
covers a few thousand generations.`}),`
`,e.jsxs(n.h2,{children:["For vis researchers ",e.jsx(n.em,{children:"(planned)"})]}),`
`,e.jsx(n.p,{children:`A study is defined by a short manifest. The consent card collaborators see is generated from it,
and the server only accepts the streams each participant agreed to.`}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-yaml",children:`study: Clinical cohort exploration
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
`,e.jsx(n.p,{children:`The study store is the researcher's own Supabase project, set up from a template: tables,
row-level security, and one ingest function. Collaborators then join from a notebook cell:`}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`import vibe_widget_study as study
study.join("vws_7f3k-...")   # shows the consent card; nothing is sent before "Agree"
`})}),`
`,e.jsx(n.p,{children:`Replay will record only the widget itself, by mounting it in its own frame. Recording the whole
notebook page would also capture other cells' data, which our prototype confirmed.`}),`
`,e.jsxs(n.p,{children:["See the ",e.jsx(n.a,{href:"https://github.com/dwootton/vibe-widget/tree/main/design/study-traces",children:"design notes"}),` for
the event schema and the replay prototype. If you'd like to run a study with it, email
`,e.jsx(n.a,{href:"mailto:dwootton@mit.edu",children:"dwootton@mit.edu"}),"."]})]})}function h(t={}){const{wrapper:n}=t.components||{};return n?e.jsx(n,{...t,children:e.jsx(a,{...t})}):a(t)}function s(t,n){throw new Error("Expected component `"+t+"` to be defined: you likely forgot to import, pass, or provide it.")}const j=()=>e.jsx(c,{Content:h,meta:l});export{j as default};
