# Brief: Bringing Vibe Widget to R (Positron / Quarto / R notebooks)

*A problem statement for design exploration. Assumes no access to the repository.*

---

## 1. What Vibe Widget is today

Vibe Widget is a Python library that **generates interactive notebook interfaces from plain English**. The user writes:

```python
import vibe_widget as vw
w = vw.create("show temperature trends by region with a year slider", df)
```

...and a few seconds later a working, interactive interface renders inline in the notebook — sliders, linked views, filters, custom controls — with no front-end code written by the user. An LLM writes the JavaScript; the library handles generation, validation, bundling, rendering, and state.

It is on PyPI as `vibe-widget` (v0.2.6, MIT). It runs in Jupyter/JupyterLab, Colab, VS Code notebooks, and marimo — anywhere AnyWidget works.

### What makes it more than "LLM writes a chart"

Four things, and they matter for the port because they are what would be lost by a naive reimplementation:

1. **Bidirectional state.** The generated widget is not a picture. `vw.create(..., outputs={"selection": "selected rows"})` exposes widget state as a live Python variable. `inputs=` pipes Python state *into* the widget. `actions=` exposes callable behaviors. Widgets can be wired to each other so that a selection in one drives another.

2. **In-place revision ("grab-edit").** The user can point at a *specific element in the rendered widget* — a legend, an axis, a button — annotate it in natural language ("make this a dropdown", "sort these descending"), and the library re-invokes the LLM with that DOM context to patch the code. Multiple annotations can be batched into one revision. This is the feature users find most compelling and is the hardest to replicate.

3. **Audit + approval.** Generated code is hashed, audited against a taxonomy, and can be gated behind explicit approval before execution. Widgets can be saved as `.vw` bundles and re-loaded elsewhere with review-on-load by default.

4. **Streaming generation.** Code streams back token-by-token into the live widget with visible status, logs, and automatic repair on runtime error.

---

## 2. What we want to create

**A way for R users to do the same thing, in their own tools.** Concretely, the target environments are:

- **Positron** (Posit's IDE) — R notebooks and the R console. This is the primary target.
- **Quarto documents** with the `knitr` (R) engine — both live preview and rendered static HTML output.
- Secondarily: RStudio, and Jupyter with an R kernel.

The aspirational R-side API is a near-mirror of the Python one:

```r
library(vibewidget)
w <- vw_create("show temperature trends by region with a year slider", df)
```

We have **not** decided how much of the feature set must come along. That is part of what we want thought about.

---

## 3. Current architecture, in three layers

This decomposition is the crux of the problem. The layers have wildly different portability.

### Layer 1 — Frontend (JavaScript, ~4.5 MB bundled)

React application. Renders the generated widget, hosts the grab-edit annotation overlay, the audit notice, the save dialog, the state viewer, the code editor.

**It touches its host through a six-method interface only:** `get`, `set`, `save_changes`, `on`, `off`, `send` — over ~15 named state fields (`code`, `status`, `logs`, `error_message`, `grab_edit_request`, `audit_state`, `execution_state`, …). Nothing in it knows about Python.

**Port cost: zero.** This is reusable as-is by any host that can supply those six methods.

### Layer 2 — Engine (Python, ~12k lines)

Prompt construction, agent loop with tools, LLM providers (OpenRouter), streaming code parsers, audit service, repair service, theme generation, widget persistence, and an esbuild-based bundler for generated code that imports npm packages.

Coupling to Python is **narrower than the line count suggests** — only four files touch pandas. The one genuinely Python-specific dependency is a data-summarization library used to describe the user's dataframe to the LLM.

**Port cost: large if reimplemented (months), near-zero if reused.** Reimplementing means maintaining two copies of the prompts, agent loop, audit taxonomy, and repair logic — which will drift.

### Layer 3 — Host transport (the actual problem)

Today this is AnyWidget over Jupyter comms. The flow is: frontend sets a state field → Python observes the change → runs the LLM on a background thread → streams results back into the widget. There are nine observers plus a custom-message handler.

**This is what does not exist in R**, and it is where all the difficulty lives.

---

## 4. Assets that already exist and shorten the path

A second-generation runtime (internal, in-progress) was built specifically to make the runtime portable, and it has already solved several things:

- **The host is abstracted behind a ~58-line "port".** There are two implementations: one for AnyWidget/Jupyter, one for static HTML. They speak a shared JSON-RPC-style packet protocol in a language-neutral package. *An R host is architecturally a third port.*
- **There is a static HTML emitter.** It produces a self-contained document that is literally: the frontend bundle + two JSON blobs + a custom element. Trivially reproducible from any language.
- **The generated-code mount contract is host-neutral**: `mountExperience({ root, rows, ports, theme })`. No AnyWidget model, no comm, no React globals required.
- **Data transport uses Arrow IPC** with a DuckDB-backed bounded relation, so pandas need not be on the data path.
- **Headless generation already works** in the first-generation engine (generate without a notebook, poll for status) — used to batch-build widgets for a conference talk.

Caveat: the second-generation runtime supports a deliberately narrow slice (one input, one output, one action) and a simpler single-shot generation call rather than the full agent loop. The first-generation engine has all the capability but its bundle assumes AnyWidget.

---

## 5. Constraints of the R ecosystem (the honest version)

This is where a Python-shaped intuition misleads. Key facts:

- **There is no AnyWidget for R.** One alternative R Jupyter kernel (RKernel) claims AnyWidget support, but conditionally — it requires the Python package installed anyway, and it is not the kernel most R users run.
- **The standard R Jupyter kernel (IRkernel) does expose a `CommManager`** with `register_target()` / `new_comm()`, so raw Jupyter comms are reachable from R. But you would be reimplementing enough of the ipywidgets model handshake to be painful.
- **Positron's R runtime is not IRkernel.** It is a separate kernel. Whether it exposes a custom-comm API to R package authors is an open question we have not answered.
- **In RStudio/Positron console contexts there is no Jupyter comm at all.** The standard R interactive-output mechanism is `htmlwidgets`, which renders HTML in a pane — historically **one-way**. Round-tripping to R conventionally requires Shiny or a local HTTP server (`httpuv`).
- **R is single-threaded.** There is no background thread to run a streaming LLM call on while the UI stays live. Servers like Shiny work by pumping an event loop when R is idle at the prompt. Any design that assumes "kick off generation in the background and keep the widget responsive" must confront this.
- **Positron only fixed inline `htmlwidgets` rendering in R notebooks in its 2026.07 release.** Earlier versions will not render at all. Any R notebook target implies a minimum Positron version.
- **Quarto rendered output is static.** A `.qmd` rendered to HTML has no R process behind it. Anything interactive in rendered output must be entirely client-side.

### The "how does an R package run Python?" question is solved

`reticulate` (≥1.41) has `py_require()`, which uses `uv` to provision Python *and* declared packages automatically — downloading `uv` itself into the R user cache if needed. From the user's perspective, `install.packages(...)` is the whole setup. `reticulate` also auto-converts `data.frame` ↔ `pandas.DataFrame`, so the data path costs nothing.

So "R package that runs Python" is **not** a blocker. The open question is whether it is the right architecture, not whether it is possible.

---

## 6. Approaches considered so far, and their tradeoffs

**A. Static-only.** R calls the engine (via reticulate or a subprocess), gets back a self-contained HTML artifact, renders it inline. No transport at all.
*Pro:* roughly a day of work; works identically in Positron notebooks, the console viewer, and rendered Quarto.
*Con:* one-way. No outputs to R, no grab-edit, no streaming. Loses the three most distinctive features.

**B. Python sidecar + local WebSocket.** Engine stays Python. R runs an `httpuv` server; the frontend connects over a WebSocket implementing the same packet protocol as a third port.
*Pro:* full round-trip; works in Positron, RStudio, and `quarto preview` alike because it does not depend on Jupyter comms; engine stays single-sourced.
*Con:* R's event loop must be pumped; fiddly concurrency; a live server is an awkward dependency for a document.

**C. Jupyter + R kernel, native widget.** Implement the comm protocol against IRkernel or RKernel.
*Pro:* "native" feel in Jupyter.
*Con:* does not help Positron console or Quarto at all — the primary targets. Ties users to a specific kernel.

**D. Full native R engine port.** Reimplement generation in R.
*Pro:* no Python dependency.
*Con:* months; two prompt/agent stacks that will diverge. We currently consider this a non-starter, but are open to being argued out of that.

---

## 7. Questions we actually want thought about

1. **Is the sidecar (B) the right spine, or is there a fundamentally better transport for R** that we are missing — something that works in Positron, RStudio, and Quarto preview without a long-lived server?
2. **Can the round-trip be made to work without a server at all?** Is there a way to get widget state back into an R session in Positron specifically — some editor-level channel, kernel comm, or file/IPC mechanism — that avoids `httpuv` and the event-loop problem?
3. **Does R's single-threadedness fundamentally change the interaction model?** If generation must block the R session, is the streaming-with-live-status experience simply off the table, and what should replace it? Is a blocking call with a progress bar actually *fine* for R users, whose tooling norms differ from Python's?
4. **How should grab-edit work when the revision round-trip is expensive or unavailable?** Is there a design where annotation is collected client-side and applied in a batch, so a single blocking call does the work?
5. **What is the right minimum viable feature set for R?** Is a one-way "prompt → interactive widget" tool genuinely valuable to R users, or is it a toy without outputs flowing back? R already has strong static-viz culture (ggplot2) and a strong interactive-app culture (Shiny) — where does this actually sit for them, and does that change what we should build?
6. **Should the R package wrap Python, or should the engine become a standalone local service** that any language binds to (with the Python package becoming one client among several)? The second is more work now and much less later if Julia/Observable/others follow.
7. **What does Quarto's rendered-output case want to be?** Is the goal that a `.qmd` renders a fully client-side interactive widget (static artifact, no R), and the live editing only exists during authoring? That split may be the cleanest framing but has implications for how state is declared.

---

## 8. Success criteria and non-goals

**Success, minimum:** an R user in Positron writes one line of R with a `data.frame` and gets a working interactive widget inline, with no manual Python setup.

**Success, ideal:** that widget's selection state is readable as an R variable, and the user can point at part of it and revise it in English.

**Non-goals (for now):** RStudio Server / Posit Connect deployment, Shiny integration, non-notebook R scripts, and feature parity with every Python capability (themes, `.vw` bundles, full audit UI).

---

## 9. Known operational landmines

Carried over from headless-generation work; relevant to anything that drives the engine from outside a notebook:

- The esbuild-based bundler for generated code resolves `react` relative to the working directory, so it fails from a foreign cwd and must be disabled. **Consequence: generated widgets that import npm packages will not bundle** in an R-hosted context until this is fixed. This is a real capability gap, not just an annoyance.
- Headless creation returns immediately and starts generating a few seconds later on a fallback thread; callers must poll status. (In R this is arguably simpler, since blocking is wanted anyway.)
- Agent tool names contain dots, which some provider/model combinations reject with HTTP 400.
- Default output token budget truncates complex widgets.
- Concurrent generation runs in a single working directory collide on persisted filenames.
