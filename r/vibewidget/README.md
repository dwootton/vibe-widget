# vibewidget

Generate interactive, LLM-authored notebook widgets from a plain-English
description and a `data.frame`, and render them inline in **Positron**,
**RStudio**, **Quarto**, and **R Markdown** - no JavaScript written by you.

```r
library(vibewidget)

w <- vw_create(
  "temperature trends by region with a year slider",
  weather_df,
  outputs = list(selection = "selected rows")
)
w                        # streams live in the Viewer / a notebook cell
w$outputs$selection()    # read the current selection back into R
```

## How this works

`vibewidget` is a thin R client of the `vibe_widget` Python engine (vendored
into this package, run in-process via `reticulate`). There is **no Jupyter
kernel** anywhere in the stack: generation, revision ("grab-edit"), and
runtime repair all run on Python background threads behind a small local
WebSocket bridge, so the R session is never blocked pumping an event loop.
Printing a widget renders it via `htmlwidgets`:

- In the **Positron/RStudio console or a notebook cell**: a live page opens
  a WebSocket back to that Python bridge - full round trip. Outputs, inputs,
  actions, and revision ("grab-edit") all work.
- In **rendered Quarto/R Markdown output** (which has no R process behind
  it): a fully self-contained static snapshot, generated once at render
  time.

See `vignette("getting-started")` for a full walkthrough, and
`design/r-host-plan.md` in the main repository for the underlying
architecture.

## Installation

```r
# from a local checkout of this repository:
install.packages("r/vibewidget", repos = NULL, type = "source")
```

The first time any `vw_*` function actually touches Python, `reticulate`
provisions a small Python environment (via `uv`) with the engine's
dependencies (`pandas`, `openai`, `websockets`, ...) - this is a one-time,
cached cost per machine; you do not install Python or any Python package
yourself. Set `OPENROUTER_API_KEY` (or pass `api_key` to `vw_config()`)
before generating anything for real - offline development and this
package's own test suite instead use a deterministic fake provider
(`VIBE_PROVIDER=fake`, see `vw_config()`'s documentation and
`vibe_widget.llm.fake` in the vendored engine).

## Package layout

```
R/            the public API (vw_create, vw_edit, vw_load, vw_save, vw_html,
               vw_config, vw_options, vw_observe/vw_unobserve, vw_open,
               vw_detect_mode, vw_prepare_data, vw_py) plus internal helpers
inst/python/  a vendored copy of the vibe_widget Python engine
              (refresh with data-raw/sync-python.sh after changing
              ../../src/vibe_widget or rebuilding the JS bundles)
inst/htmlwidgets/  the htmlwidgets binding (vibewidget.js/.yaml) and the
                   standalone host JS bundle (lib/vibewidget-host/)
vignettes/    getting-started.Rmd
tests/testthat/  a pure-R lane (always runs) and a Python-backed lane
                 (VIBEWIDGET_TEST_PYTHON=true, the default) against the
                 fake provider
```

## Known limitations (v0.1.0)

- **Documentation was hand-written, not roxygen2-generated.** `roxygen2`
  (via its `xml2` dependency) failed to build in the environment this
  package was authored in - a Homebrew R build's `xml2` linked against the
  wrong `libxml2` via a Conda-provided `pkg-config`. `man/*.Rd` and
  `NAMESPACE` were written by hand to exactly match the roxygen comments in
  `R/*.R`; if you have a working `roxygen2`, run `devtools::document()` and
  diff the result before trusting it over what is committed.
- **Generated widgets that import npm packages will not bundle.** The
  vendored engine's esbuild-based bundler resolves `node_modules` up from
  its own source location; a vendored, non-repository install has no
  `node_modules` there at all, so `bundling_available()` is `FALSE` and
  such widgets fall back to raw (Babel-transformed) source. A CDN
  import-map fallback is planned (see `design/r-host-plan.md` Phase 5) but
  not implemented yet.
- **One live server per R process**, shared by every widget in that
  session (see `vw_open()`/`.vw_as_htmlwidget()`). Not yet exposed as
  something you can configure (host/port/TLS) - it always binds
  `127.0.0.1` on a random port.
- **No Shiny integration, no `.vw` bundle browser UI, no themes UI, no
  audit UI beyond the pass-through acknowledgement dialog** - all
  deliberately out of scope for this stage; see `design/r-host-plan.md`.
- Tested on macOS (R 4.6.1) with Positron 2026.09 and RStudio's Viewer
  model; Windows and Linux should work (the transport is plain loopback
  WebSocket/HTTP with no OS-specific code) but have not been exercised here.
