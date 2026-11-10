# Positron / RStudio manual smoke test

Everything in this repository's automated suite verifies the mechanism -
the Python engine, the WebSocket protocol, the JS host adapter, and R
calling into it via reticulate - using a real browser (Playwright/Chromium)
and a real local server. **None of it has run inside Positron's or
RStudio's own Console/Viewer/notebook UI**, because there is no automation
tool available for driving those GUIs the way Playwright drives a browser
tab. Positron's Viewer pane is itself a Chromium webview, and RStudio's is
too, so the underlying mechanics are almost certainly the same - but
"almost certainly" is exactly what this checklist exists to close out
before telling people to rely on it. Run this by hand once per release, or
whenever `inst/htmlwidgets/*` or `hosts/server.py` changes.

Two things are specifically *unverified* and worth extra attention:

1. **Ark's dependency handling.** Research done while designing this
   package found that Positron's R kernel (`ark`) inlines every *file*
   `htmlDependency` into each separate Viewer/notebook-cell render, rather
   than deduplicating across renders the way one knitr/Quarto document
   build does. `vw_create()`'s live-mode widget (`vibewidget_live`)
   was built specifically to avoid this - it carries no bundle
   `htmlDependency` at all and instead fetches the ~3.8MB host bundle from
   the local server's own `/assets/vibewidget-host.js` at render time (see
   `inst/htmlwidgets/vibewidget_live.js`). This has been verified against a
   plain browser tab pointed at an `htmlwidgets::saveWidget()`-rendered
   page (confirmed: the saved HTML is ~1KB, not ~3.8MB, and the page loads
   the bundle from the server and renders correctly) - but not against
   ark's actual `.ps.view_html_widget` inlining path itself.
2. **Webview network access.** A Positron *notebook* cell's output is an
   isolated webview, which may have different network/CSP restrictions than
   the Viewer pane or a plain browser tab. Whether it can open
   `ws://127.0.0.1:<port>` and load a `<script src="http://127.0.0.1:...">`
   is the single biggest open question this checklist is meant to answer.

## Setup

```r
install.packages("r/vibewidget", repos = NULL, type = "source")
library(vibewidget)
Sys.setenv(OPENROUTER_API_KEY = "...")   # or vw_config(api_key = "...")
# For a quick pass with no API key/network/cost, use the fake provider
# instead - every check below still exercises the real transport:
#   Sys.setenv(VIBE_PROVIDER = "fake")
df <- data.frame(x = 1:20, y = (1:20)^1.3, g = rep(c("a","b"), 10))
```

## Checklist

### 1. Positron console → Viewer pane

- [ ] `w <- vw_create("scatter of x vs y colored by g", df, outputs = list(selection = "selected rows"))` at the console.
- [ ] Widget streams generation logs live, then renders in the Viewer pane.
- [ ] Click a point/row in the widget; `w$outputs$selection()` returns it.
- [ ] `w$inputs$...` (if declared) pushes a change visible in the widget.
- [ ] Bundle is **not** re-embedded on repeated `print(w)` - open the
      Viewer's page source (or DevTools, if reachable) and confirm no
      3.8MB inline `<script>` block; only a `<script src=".../assets/...">`.
- [ ] `vw_edit(w, "make the legend a dropdown")` streams and updates in place.
- [ ] `w$close()` does not error; the Viewer tab is left in a sane (if now
      disconnected) state.

### 2. Positron R notebook

- [ ] Same `vw_create()` call in a notebook cell; widget renders **inline
      in the cell output**, not just in the Viewer pane.
- [ ] Check the notebook's saved `.ipynb`/`.qmd` output for cell size - it
      should be small (a config blob), not several MB, confirming the
      dependency split is respected in the notebook renderer too.
- [ ] Click interaction round-trips into a later cell's
      `w$outputs$selection()`.
- [ ] Requires Positron ≥ 2026.07 (the release that fixed inline htmlwidgets
      rendering across Jupyter/Positron notebooks and inline Quarto output).

### 3. RStudio

- [ ] Console → Viewer pane: repeat section 1's checks.
- [ ] R Markdown notebook (interactive "Run Current Chunk"): repeat
      section 2's checks against RStudio's own notebook preview.

### 4. Rendered Quarto (no live process)

- [ ] `vw_html(w, "demo.html")` and open the file directly - it must be
      fully self-contained (works offline, no server, everything inlined).
- [ ] A `.qmd` with a `vw_create()` chunk, `quarto render`ed: the output
      renders the widget with no live interaction (annotate/revise
      affordances should not be present, since there is no process to
      revise anything).
- [ ] `quarto preview` while editing: each save re-renders as a fresh,
      static R process (no persistent state expected between saves).

### 5. Failure modes worth trying on purpose

- [ ] Kill the R session while a widget's page is still open in a browser
      tab/Viewer: the page should show a disconnected state, not hang or
      throw an uncaught error.
- [ ] No `OPENROUTER_API_KEY` set and `VIBE_PROVIDER` unset: `vw_create()`
      should fail with a clear message, not a stack trace pointing into
      `reticulate` internals.
- [ ] Two widgets open at once: confirm neither's clicks/inputs leak into
      the other.

Record the Positron/RStudio version, OS, and R version tested against, and
file an issue for anything in this list that fails - especially item 1 or 2
above, since a failure there is architectural, not cosmetic.
