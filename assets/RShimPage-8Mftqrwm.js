import{j as e}from"./index-Bjb9_FNN.js";import{D as r}from"./DocMdxPage-CYzpg4A9.js";import"./DocContent-Cquz_hLD.js";const o={title:"R (Positron / RStudio / Quarto)",description:"Use Vibe Widget from R - Positron, RStudio, Quarto, and R Markdown, no Jupyter kernel required."};function i(t){const n={a:"a",code:"code",em:"em",h2:"h2",li:"li",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...t.components},{InstallCommand:s}=n;return s||l("InstallCommand"),e.jsxs(e.Fragment,{children:[e.jsxs(n.p,{children:[`Vibe Widget is a Python library, but you don't have to write Python to use it from R. The
`,e.jsx(n.code,{children:"vibewidget"}),` R package is a thin client of the same engine that generates the widget: it runs
Python in-process via `,e.jsx(n.a,{href:"https://rstudio.github.io/reticulate/",children:"reticulate"}),`, with no Jupyter kernel
anywhere in the stack, and renders inline in `,e.jsx(n.strong,{children:"Positron"}),", ",e.jsx(n.strong,{children:"RStudio"}),", ",e.jsx(n.strong,{children:"Quarto"}),`, and
`,e.jsx(n.strong,{children:"R Markdown"})," through ",e.jsx(n.a,{href:"https://www.htmlwidgets.org/",children:"htmlwidgets"}),"."]}),`
`,e.jsx(s,{command:`Rscript -e "remotes::install_github('dwootton/vibe-widget', subdir='r/vibewidget')"`}),`
`,e.jsxs(n.p,{children:[`The R package isn't on CRAN yet, so install it straight from GitHub. The first time you actually
generate a widget, `,e.jsx(n.code,{children:"reticulate"}),` provisions a small Python environment for you automatically (via
`,e.jsx(n.a,{href:"https://docs.astral.sh/uv/",children:"uv"}),`) - you do not install Python, or any Python package, yourself.
That first run downloads a handful of packages and can take under a minute; every run after that
is instant.`]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-bash",children:`export OPENROUTER_API_KEY='your-key'
`})}),`
`,e.jsxs(n.p,{children:[`Set that the same way you would for the Python package - as a shell environment variable (add it
to `,e.jsx(n.code,{children:"~/.Renviron"}),` so every R session picks it up automatically), not inside a notebook cell, since
a notebook's cells get saved along with the file.`]}),`
`,e.jsx(n.h2,{children:"Quick start"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-r",children:`library(vibewidget)

df <- data.frame(
  group = rep(c("A", "B", "C"), each = 10),
  value = c(rnorm(10, 5), rnorm(10, 8), rnorm(10, 6))
)

w2 <- vw_create(
  "a bar chart of avg values by group",
  df,
  outputs = list(selection = "selected rows")
)
w2
`})}),`
`,e.jsx(n.p,{children:"Two things that trip people up the first time:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[e.jsxs(n.strong,{children:[e.jsx(n.code,{children:"w2"})," has to be on its own line to render."]})," ",e.jsx(n.code,{children:"vw_create(...)"}),` returns a widget object; like any
other R value, assigning it to `,e.jsx(n.code,{children:"w2"}),` does not print it. This is completely ordinary R behavior
(the same reason `,e.jsx(n.code,{children:"x <- 5"})," prints nothing but a bare ",e.jsx(n.code,{children:"x"}),` does), it's just easy to forget when
you're used to Python/Jupyter auto-displaying the last expression of a cell too. Either put the
variable on its own line right after, or wrap the call: `,e.jsx(n.code,{children:"print(vw_create(...))"}),"."]}),`
`,e.jsxs(n.li,{children:[e.jsxs(n.strong,{children:["Set ",e.jsx(n.code,{children:"OPENROUTER_API_KEY"})," before calling ",e.jsx(n.code,{children:"vw_create()"}),", not inside the same cell as the call."]}),`
If you're testing without a key or without network access, set
`,e.jsx(n.code,{children:'Sys.setenv(VIBE_PROVIDER = "fake")'}),` first - every layer of the engine has a deterministic,
offline fake-generation mode built for exactly this.`]}),`
`]}),`
`,e.jsx(n.h2,{children:"Reading state back into R"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-r",children:`w2$status()             # "generating" | "ready" | "error" | "blocked"
w2$wait()                # block until a terminal status, if you need to
w2$outputs$selection()   # current value - NULL until something is selected
`})}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"vw_observe()"}),` reacts to changes as they happen. R is single-threaded, so this can't be a live push
from a background thread the way it works in JavaScript - it polls (via the
`,e.jsx(n.a,{href:"https://later.r-lib.org/",children:"later"}),` package) only when R is otherwise idle, so it never blocks or
interrupts whatever you're doing:`]}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-r",children:`vw_observe(w2, "selection", function(v) message(nrow(v), " rows selected"))
`})}),`
`,e.jsx(n.h2,{children:"Pushing state in, and calling actions"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-r",children:`w2$inputs$threshold <- 25
w2$actions$reset()
`})}),`
`,e.jsx(n.h2,{children:"Revising a widget in English"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-r",children:`vw_edit(w2, "sort the bars descending by value")
`})}),`
`,e.jsx(n.h2,{children:"Saving and exporting"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-r",children:`vw_save(w2, "chart.vw")
w3 <- vw_load("chart.vw", data = df)

vw_html(w2, "chart.html")   # a fully static, self-contained export
`})}),`
`,e.jsx(n.h2,{children:"Where this behaves differently than Python/Jupyter"}),`
`,e.jsxs(n.table,{children:[e.jsx(n.thead,{children:e.jsxs(n.tr,{children:[e.jsx(n.th,{}),e.jsx(n.th,{children:"Positron / RStudio console, or a notebook cell"}),e.jsx(n.th,{children:"Rendered Quarto / R Markdown"})]})}),e.jsxs(n.tbody,{children:[e.jsxs(n.tr,{children:[e.jsx(n.td,{children:"Rendering"}),e.jsx(n.td,{children:"Live - a page opens a WebSocket back to a Python session running in your R process"}),e.jsx(n.td,{children:"Static, self-contained (there's no R process behind a rendered document)"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:"Outputs / inputs / actions"}),e.jsx(n.td,{children:"Fully live, same as Python"}),e.jsx(n.td,{children:"Frozen at whatever they were when the document was rendered"})]}),e.jsxs(n.tr,{children:[e.jsxs(n.td,{children:["Grab-edit / ",e.jsx(n.code,{children:"vw_edit()"})]}),e.jsx(n.td,{children:"Live"}),e.jsx(n.td,{children:"Not available - there's nothing to revise"})]})]})]}),`
`,e.jsxs(n.p,{children:[e.jsx(n.code,{children:"vw_create()"}),` detects which of these applies automatically; force one or the other with
`,e.jsx(n.code,{children:'options(vibewidget.mode = "live")'})," or ",e.jsx(n.code,{children:'"static"'})," if it ever guesses wrong."]}),`
`,e.jsx(n.h2,{children:"Known limitations right now"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[`Only tested by hand inside Positron's Console and R Markdown notebook preview so far - a
Positron `,e.jsx(n.em,{children:"notebook"}),` cell's isolated webview reaching a local WebSocket is the one thing not yet
independently confirmed. If a widget in a notebook cell doesn't render or doesn't respond to
clicks the way the console version does, that's the thing to report.`]}),`
`,e.jsxs(n.li,{children:[`Generated widgets that import npm packages won't bundle in an R-hosted install (no local
`,e.jsx(n.code,{children:"node_modules"})," to resolve against) and fall back to plain, unbundled source."]}),`
`,e.jsxs(n.li,{children:["No Shiny integration, no ",e.jsx(n.code,{children:".vw"})," bundle browser UI, and no themes UI yet."]}),`
`]}),`
`,e.jsxs(n.p,{children:["See the ",e.jsx(n.a,{href:"https://github.com/dwootton/vibe-widget/pull/60",children:"pull request"}),` for the full architecture
writeup and the package's own `,e.jsx(n.code,{children:"POSITRON_SMOKE.md"})," for the manual verification checklist."]})]})}function a(t={}){const{wrapper:n}=t.components||{};return n?e.jsx(n,{...t,children:e.jsx(i,{...t})}):i(t)}function l(t,n){throw new Error("Expected component `"+t+"` to be defined: you likely forgot to import, pass, or provide it.")}const u=()=>e.jsx(r,{Content:a,meta:o});export{u as default};
