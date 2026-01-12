import{j as e}from"./index-DW6fP7wU.js";import{D as a}from"./DocMdxPage-DHLXPrOC.js";import"./DocContent-BrPZLS5s.js";const r={title:"Create",description:"Create widgets from natural language prompts and data sources."};function s(t){const n={code:"code",h2:"h2",li:"li",p:"p",pre:"pre",ul:"ul",...t.components};return e.jsxs(e.Fragment,{children:[e.jsx(n.p,{children:"Create widgets from natural language prompts and data sources."}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`import vibe_widget as vw

widget = vw.create(
    "bar chart of revenue by region",
    df
)

widget
`})}),`
`,e.jsx(n.h2,{children:"Inputs and outputs"}),`
`,e.jsxs(n.p,{children:["Use ",e.jsx(n.code,{children:"vw.inputs"})," to pass multiple inputs, and ",e.jsx(n.code,{children:"vw.outputs"})," to define reactive state your widget exposes."]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.create(
    "...",
    vw.inputs(df, selected_indices=other_widget.outputs.selected_indices)
)
`})}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`scatter = vw.create(
    "scatter with brush selection",
    df,
    outputs=vw.outputs(selected_indices="indices of selected points")
)

scatter.outputs.selected_indices.value
`})}),`
`,e.jsx(n.h2,{children:"Dataflow and I/O contract"}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"vw.create"})," converts data to a list of record dicts and cleans non-JSON values (NaN/NaT/inf to ",e.jsx(n.code,{children:"None"}),"). Inputs and outputs are synced traitlets. When providing another widget output, Vibe Widget reads the current value once, then keeps it in sync via trait updates. Outputs start as ",e.jsx(n.code,{children:"None"})," and are updated by generated JS code."]}),`
`,e.jsx(n.h2,{children:"Supported data sources"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:e.jsx(n.code,{children:"pandas.DataFrame"})}),`
`,e.jsx(n.li,{children:"local file paths (CSV/TSV, JSON/GeoJSON, Parquet, NetCDF, XML, ISF, Excel, PDF, TXT)"}),`
`,e.jsxs(n.li,{children:["URLs (via ",e.jsx(n.code,{children:"crawl4ai"}),", best-effort)"]}),`
`]}),`
`,e.jsxs(n.p,{children:["Some loaders require optional dependencies (for example, ",e.jsx(n.code,{children:"xarray"})," for NetCDF or ",e.jsx(n.code,{children:"camelot"})," for PDF)."]}),`
`,e.jsx(n.h2,{children:"Theming"}),`
`,e.jsx(n.p,{children:"Themes are natural-language design specs that guide code generation."}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-python",children:`vw.create("...", df, theme="financial_times")

vw.create("...", df, theme="like national geographic but greener")
`})}),`
`,e.jsxs(n.p,{children:["Built-in themes are listed via ",e.jsx(n.code,{children:"vw.themes()"}),". Theme prompts are cached for the session and can be saved locally."]}),`
`,e.jsx(n.h2,{children:"Safety warning"}),`
`,e.jsx(n.p,{children:"Widgets execute LLM-generated JavaScript in the notebook frontend. Treat generated code as untrusted. Use audits and your own verification when the output informs decisions."})]})}function d(t={}){const{wrapper:n}=t.components||{};return n?e.jsx(n,{...t,children:e.jsx(s,{...t})}):s(t)}const l=()=>e.jsx(a,{Content:d,meta:r});export{l as default};
