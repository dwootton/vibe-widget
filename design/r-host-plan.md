# Plan: Vibe Widget for R (`vibewidget`) — Positron, RStudio, Quarto

*Companion to `r-host-brief.md`. Written 2026-09-15 against repo state `a3dfe4c` + working tree.*
*Everything marked **verified** was checked in this repo, this Mac, or primary docs during planning; everything marked **spike** must be proven in Phase 0 before it is relied on.*

---

## 0. Decision in one paragraph

Build the R package as a **thin client of the existing gen-1 Python engine**, run **in-process via reticulate**, with the **transport owned by Python threads** rather than by R. The Python side gains a small `vibe_widget.hosts` package: a `HostSession` that drives a headless `VibeWidget` (no Jupyter comm) and a loopback WebSocket + HTTP server. The JS side gains a ~200-line "host model" that implements the six AnyWidget model methods over that WebSocket (live) or over an embedded JSON snapshot (static), then calls the unchanged `render({ model, el })`. R renders through `htmlwidgets`, and never runs a server or pumps an event loop for the browser round trip. Rendered Quarto output is the static mode of the same artifact. This keeps one engine, one frontend, one prompt stack, and gives R users streaming generation, live outputs, inputs, actions, and grab-edit in Positron and RStudio, with a graceful read-only degradation wherever no R process exists.

Why not the brief's option B as written (httpuv in R)? Because R's single thread is exactly the wrong place to host a WebSocket server that must stay live while the LLM streams. reticulate ≥ 1.39 runs Python background threads concurrently with R (**verified** in the reticulate NEWS), and the engine already does its work on Python threads, so the server belongs next to the engine. R stays a synchronous caller.

---

## 1. Answers to the brief's seven questions

**Q1. Is the sidecar the right spine, or is there a better transport?**
The sidecar idea is right; the placement is wrong. Put the WebSocket server in Python threads inside the R process (reticulate), not in R via httpuv. Same protocol, no R concurrency, no `later::run_now()` pumping, and it works identically in the Positron console, Positron notebooks, RStudio, and `quarto preview` *authoring* sessions in Positron (the console). A separate-process sidecar (`vibe-widget serve`) is kept as the fallback and the future multi-language service; the Python `HostSession` class is written so both modes share it.

**Q2. Can the round trip work with no server at all?**
No, not today. **Verified**: ark (Positron's R kernel, bundled at `Positron.app/.../positron-r/resources/ark/ark`) exposes only fixed `.ps.ui.*` RPCs (showUrl, executeCommand, executeCode, showDialog…) and `.ps.view_html_widget`; there is no API for an R package to open a custom Jupyter comm. Notebook outputs and the Viewer are isolated webviews. A Positron *extension* could bridge webview ↔ runtime (`positron.runtime.executeCode`, `createPreviewPanel().webview.postMessage`), but that is a second deliverable in TypeScript and Positron-only. Recommendation: loopback WebSocket now, extension-bridge as a later optional enhancement. One curiosity worth a half-day spike: Positron's `positron-reticulate` extension can turn the R process's embedded Python into a real Positron Python kernel, which would make genuine AnyWidget comms available from inside R. It is undocumented and displays into the Python console, so it is not the spine.

**Q3. Does single-threaded R change the interaction model?**
Less than feared. Generation, streaming, repair, and grab-edit all run on Python threads, and reticulate lets them run while R is idle at the prompt or even while R executes. So the streaming-terminal experience is preserved: `vw_create()` returns immediately, the widget streams logs and code, and the R prompt is free. What R cannot do is be *interrupted*: output changes cannot push into R code mid-computation. So outputs are pull-based (`w$outputs$selection()` reads the current value) plus an opt-in `vw_observe()` whose callbacks fire from a `later` drain loop when R is idle. In knitr/Quarto (non-interactive), `vw_create()` blocks with a `cli` progress bar until the widget is ready. That is the norm for R rendering and is fine.

**Q4. Grab-edit when the round trip is expensive or unavailable?**
Live mode: unchanged, the frontend sets `grab_edit_request`, Python revises on a worker thread, the code trait streams back. Static mode (rendered Quarto): hide the annotation affordance via a host capability flag; the frontend already keys features off model state, so this is a snapshot field. **Correction to the brief**: gen-1 has *no* batch annotation payload (`grab_edit_request` is a single `{element, prompt, request_id}`; batching exists only in vibe-next). Adding an `annotations: [...]` array to the request is a small engine enhancement that benefits Python users too; it is scheduled in Phase 3 as optional. A "collect annotations offline, apply later" flow is possible on top of that but is not needed for the success criteria.

**Q5. Minimum viable feature set?**
One-way prompt→widget is a demo, not a product, for an audience that already has ggplot2 and Shiny. The R value proposition is *zero-code interactivity whose state flows back into R*. So the public MVP is Phase 3 (outputs, inputs, actions, grab-edit), and Phase 2 (static + live render) is an internal milestone that satisfies the brief's "minimum success". Themes, full audit UI, `.vw` browsing, and Shiny integration stay out.

**Q6. Wrap Python, or make the engine a standalone service?**
Wrap Python now, through a boundary that *is* the service. `vibe_widget.hosts.HostSession` + the `vibe.host/1` packet protocol are transport-neutral; the in-process WebSocket server and a future `vibe-widget serve` subprocess (launchable from R with `reticulate::uv_run_tool()`) are two drivers of the same class. Julia or Observable would bind to the subprocess. No R-side redesign is required to switch.

**Q7. What should rendered Quarto be?**
Static and client-side, generated at authoring time and cached. `vw_create()` in a knitr chunk resolves to a cache hit (hash of prompt, data schema fingerprint, declared ports, model, engine version) under `_vibewidget/` next to the `.qmd`, or generates and caches on miss. `vw_load("x.vw")` is the explicit form. **Verified**: `quarto preview` with knitr spawns a fresh `Rscript` per render, so preview is also static; live editing happens in the Positron console or notebook, and the `.qmd` consumes the result. Data in the static artifact is bounded (same row guard as Python today).

---

## 2. Architecture

```
R session (Positron / RStudio / Rscript)
├─ vibewidget (R pkg) ── reticulate ──► Python (uv-managed, py_require)
│     vw_create / vw_edit / vw_save / vw_load     vibe_widget            (engine, unchanged API)
│     w$outputs$x()  w$inputs$y <- v  w$actions$z()vibe_widget.hosts     (NEW)
│     htmlwidgets::createWidget("vibewidget", x)     ├─ HostSession        wraps headless VibeWidget
│                                                     ├─ LocalHostServer    websockets + HTTP, Python threads
│                                                     ├─ static.emit_html   bundle + snapshot + mount
│                                                     └─ protocol           vibe.host/1 packets
└─ htmlwidget output (Viewer pane / notebook cell / knitr HTML)
      inst/htmlwidgets/vibewidget.js  ──► VibeWidgetHost.mount(el, x)     (NEW JS, IIFE bundle)
            mode "live":   WsPort  ⇄ ws://127.0.0.1:PORT/ws?token=…  ⇄ HostSession
            mode "static": StaticPort over embedded snapshot
            both:          HostModel{get,set,save_changes,on,off,send} → render({model, el})  (unchanged AppWrapper)
```

### 2.1 Python: `src/vibe_widget/hosts/`

| File | Responsibility |
|---|---|
| `bridge.py` | `HostSession(widget)`: subscribes to every `sync=True` trait (excluding anywidget internals), overrides `widget.send` to capture outbound custom messages, exposes `snapshot()`, `apply_changes(dict)`, `dispatch_custom(content)`, `wait(timeout)`, `events` queue for R observers. All inbound applies run on one dedicated worker thread so blocking observers (`_on_grab_edit`, `_on_audit_state`, `_on_error`) never stall the socket loop. Trait writes are serialized with an `RLock`. |
| `server.py` | `LocalHostServer`: one `websockets` server (already installed, 15.0.1 **verified**) with `process_request` serving HTTP for `/assets/vibewidget-host.js`, `/assets/editor.js`, `/w/<session>` (full page), `/health`. Bound to `127.0.0.1`, random port, per-process random token, `Origin` allow-list (`vscode-webview://`, `null`, `http://127.0.0.1`, RStudio viewer origins). Runs its asyncio loop on a daemon thread; one server per process, many sessions. |
| `static.py` | `emit_html(session, *, inline_bundle=True, max_rows)`: self-contained document = host bundle + escaped snapshot JSON + `VibeWidgetHost.mount(...)`. Mirrors vibe-next's `_static_document` (escapes `<` as `<`). |
| `protocol.py` | Packet helpers and validators for `vibe.host/1` (below). |
| `session_api.py` | The surface R calls: `create_session(description, data, outputs, inputs, actions, theme, model, api_key, wait, mode) -> HostSession`, `edit_session(...)`, `load_session(path)`, `session.save(path)`, `session.get_trait/set_trait`, `session.invoke_action`, `session.drain_events()`, `describe_data(df)` (wraps `pretty_little_summary.describe`). |
| `cli.py` (Phase 5) | `vibe-widget serve --stdio|--port`: same `HostSession` over a subprocess, JSON-lines control channel, Arrow IPC files for data. |

### 2.2 JS: `src/vibe_widget/AppWrapper/hosts/`

| File | Responsibility |
|---|---|
| `hostModel.js` | In-memory model implementing `get/set/save_changes/on/off/send/close`, `change:<trait>` and `msg:custom` events, `comm:close`, plus the ad-hoc props the AppWrapper touches (`model_id`, `comm` stub with `on/off`). Coalesces `set` calls until `save_changes` into one `state.set` packet, exactly like AnyWidget. |
| `wsPort.js` | Connects, sends `client.hello`, applies `state.snapshot` then `state.patch`, forwards `custom.msg` as `msg:custom`, emits `comm:close` on disconnect, reconnects with backoff and re-hydrates. |
| `staticPort.js` | Hydrates the model from an embedded snapshot; `send` resolves save/editor requests locally (editor bundle embedded or URL) or returns a host error; sets `host_capabilities` so the UI hides revision/save. |
| `mount.js` | `mount(el, options)` → picks port by `options.mode`, builds the model, calls the existing `render({ model, el })`, returns `{ close, model }`. |
| `index.js` | Entry for a new esbuild target: `--format=iife --global-name=VibeWidgetHost`, output `src/vibe_widget/hosts/static/vibewidget-host.js`. Also copied into the R package `inst/`. |

The only change inside existing frontend code is one new snapshot field (`host_capabilities`) consulted where the grab-edit and save affordances render. `useModelSync.js` stays as is; `frontend_ready` is set by the AppWrapper itself (**verified** at `AppWrapper.js:103`), which is what starts generation on the Python side.

### 2.3 Protocol `vibe.host/1`

Envelope copied from vibe-next's `vibe.transport/1` so a future port to that runtime is mechanical: `{ protocol, session, sender, senderSequence, rpc }` with JSON-RPC 2.0 inside.

| Direction | Method | Params |
|---|---|---|
| frontend → host | `client.hello` | `{ clientId, token }` → result `{ session, capabilities }` |
| host → frontend | `state.snapshot` | `{ state: {trait: value…}, host: {kind:"r", mode}, capabilities, assets: {editor_bundle_url} }` |
| host → frontend | `state.patch` | `{ changes: {trait: value…}, seq }` |
| frontend → host | `state.set` | `{ changes: {trait: value…} }` (one per `save_changes`) |
| frontend → host | `custom.send` | `{ content }` (`request_editor_bundle`, `save_widget`, `remote_call`) |
| host → frontend | `custom.msg` | `{ content }` (`editor_bundle`, `save_widget_result`, `remote_call_result`) |
| either | `session.disconnected`, `vibe.close` | `{ reason }` |

Binary buffers are not needed for gen-1's three custom message types; v1 is JSON-only and rejects packets with attachments (explicit error, not silent drop). Fixtures for every method live in `tests/hosts/fixtures/packets/` and are consumed by both the Python and JS test suites.

### 2.4 R package `r/vibewidget/`

```
r/vibewidget/
├─ DESCRIPTION            Imports: reticulate (>= 1.41), htmlwidgets, htmltools, jsonlite, later, cli, rlang
├─ R/zzz.R                .onLoad: reticulate::py_require("vibe-widget==<pinned>") (or VIBEWIDGET_PYTHON_SRC for dev)
├─ R/python.R             lazy `vw_py()` import, error translation, version check
├─ R/create.R             vw_create(), vw_edit(), vw_load(), vw_save(), vw_html()
├─ R/widget-class.R       `vibe_widget` R6/env object: $outputs, $inputs, $actions, $status(), $code(), $wait()
├─ R/observe.R            vw_observe()/vw_unobserve(), later-driven drain loop
├─ R/render.R             htmlwidget construction, host detection (Positron console vs notebook, RStudio, knitr, plain)
├─ R/config.R             vw_config(model, api_key, mode, execution, store_dir), vw_options()
├─ R/data.R               data.frame normalization before conversion (Date/POSIXct/factor/integer64/list cols)
├─ inst/htmlwidgets/vibewidget.js, vibewidget.yaml, lib/vibewidget-host/vibewidget-host.js
├─ tests/testthat/        see §5
└─ POSITRON_SMOKE.md      manual checklist
```

R API (mirrors Python, idiomatic where it matters):

```r
library(vibewidget)
vw_config(model = "google/gemini-3.1-pro-preview")        # api_key from OPENROUTER_API_KEY by default

w <- vw_create("temperature trends by region with a year slider", df,
               outputs = list(selection = "selected rows"),
               inputs  = list(threshold = 20),
               actions = list(reset = "clear selection"))
w                        # prints: htmlwidget → Viewer pane / notebook cell; streams generation live
w$status()               # "generating" | "ready" | "error" | "blocked"
w$wait(timeout = 120)    # block until ready (default in knitr)
w$outputs$selection()    # current value (pull)
w$inputs$threshold <- 25 # pushes to the widget
w$actions$reset()
vw_observe(w, "selection", function(v) message(nrow(v), " rows"))   # fires when R is idle
w2 <- vw_create("bar chart of the selected rows", df, inputs = list(sel = w$outputs$selection))  # linked
vw_edit(w, "make the legend a dropdown")
vw_save(w, "trends.vw"); w3 <- vw_load("trends.vw", data = df)
vw_html(w, "trends.html")             # static self-contained export
```

---

## 3. Environment matrix (what works where)

| Environment | Render path | Generation | Outputs/inputs/actions | Grab-edit | Notes |
|---|---|---|---|---|---|
| Positron console (≥ 2026.07; **2026.09.1 installed here, verified**) | htmlwidget → ark `.ps.view_html_widget` → Viewer pane webview; or `vw_open(w)` → `getOption("viewer")(url)` | streaming, live | live | live | Bundle served by URL from the local server so ark does not inline 4 MB (ark inlines *file* deps only, **verified** in `html_widgets.R`) |
| Positron notebook (R) | htmlwidget inline (`ps_html_display_data`) | streaming, live | live | live | **Spike S2**: `vscode-webview://` → `ws://127.0.0.1` and `<script src=http://127.0.0.1…>`. Fallbacks: iframe to server page → static snapshot |
| RStudio console / R Markdown notebook chunks | htmlwidget → Viewer / inline | streaming, live | live | live | Viewer is Chromium; localhost WS allowed |
| `quarto render` / `quarto preview` (knitr) | knitr → static htmlwidget, bundle inlined once per doc | blocking at render, cached | frozen snapshot | hidden | Fresh `Rscript` per render (**verified** in quarto-cli `rmd.ts`) |
| Jupyter + IRkernel | htmlwidget via `repr_html` | streaming, live | live | live | Same WS path; kernel comms unnecessary |
| Plain `Rscript` / headless | `vw_html()` or `vw_save()` | blocking | n/a | n/a | Used by tests and batch builds |

---

## 4. Work plan

Estimates are engineer-days for one person who knows the repo; add 30% buffer. Each phase ends with its tests green in CI, not with "it works on my machine".

### Phase 0 — Spikes and environment (2–3 days)

Goal: retire the unknowns that could invalidate the architecture, and set up an R toolchain on this Mac (R is **not installed** here; Positron 2026.09.1, Node 24, Playwright Chromium, `uv`, `websockets` are).

| Spike | Question | Pass criterion | Fallback if it fails |
|---|---|---|---|
| S1 reticulate threads | In the Positron console, can a Python `websockets` server on a daemon thread accept a browser connection and stream messages while the R prompt is free and while R runs `Sys.sleep()`? | Browser page counts ≥ 50 messages in 5 s with R idle; ≥ 50 with R sleeping; `reticulate::py_allow_threads`/1.39+ semantics confirmed | Subprocess sidecar via `reticulate::uv_run_tool()`; same protocol |
| S2 notebook webview | From a Positron R notebook output, can inline HTML open `ws://127.0.0.1:PORT` and load `<script src="http://127.0.0.1:PORT/…">`? | Both succeed with no CSP error in the webview console | (a) `<iframe src=http://127.0.0.1…>` to the server's full page; (b) inline bundle + WS; (c) static snapshot in cell + live in Viewer |
| S3 asset size | Does ark's `ark.html_widget.deduplicate` avoid re-inlining a 4 MB file dep across cells, and does the URL-dependency approach keep the `.ipynb` small? | Notebook file grows < 100 KB per widget cell in live mode | Ship a smaller host bundle (React + AppWrapper only, editor lazy) and accept inlining |
| S4 data fidelity | `data.frame` → pandas → `pretty_little_summary.describe()` and `to_dict(orient="records")` for Date, POSIXct with tz, factor, logical NA, integer64, nested list columns | Golden JSON fixtures match; no exceptions | Pre-normalize in `R/data.R` (already planned) |
| S5 Positron reticulate kernel (optional, ½ day) | Does `positron-reticulate` make the R-embedded Python a real Positron kernel with working AnyWidget comms? | A `vw.create()` from `repl_python()` renders and round-trips | Not needed; informational |

Environment tasks: `brew install --cask rig && rig add release`; install R deps; confirm Positron finds R; use Positron's bundled Quarto (`/Applications/Positron.app/Contents/Resources/app/quarto/bin/quarto`, 1.10.18 **verified**) for render tests; `npm ci`; `npx playwright install chromium`.

Deliverables: `spikes/r-host/S1..S5/` scripts and a `RESULTS.md` with pass/fail and screenshots. Go/no-go meeting on S1 and S2.

### Phase 1 — Engine hardening + Python host bridge + static emitter (5–7 days)

Engine fixes (all with regression tests, all benefit Python users):

1. `core/widget.py` `handle_complete`: assign `data_info` before `_apply_code`; `_on_error` must not read attributes that may not exist (**verified** crash: `AttributeError: data_info` on the headless error path).
2. `_on_error`: classify provider/auth/network exceptions separately from generated-code runtime errors; provider errors set `status="error"` and do *not* enter the repair loop (**verified**: a 401 currently triggers "Repairing code..." against empty code).
3. Decouple async generation from display: add `generation="async"|"sync"` to `_start_generation`/`create`, default async when a host session is attached; today the branch is `getattr(self, "_display_widget", True)`.
4. Agent tool names: sanitize dots (`fs.list` → `fs_list`) with a reverse map for providers that reject them (Anthropic via OpenRouter).
5. `vw.config(max_output_tokens=...)` plumbed to `AgentSdkOrchestrator._run_agent_loop` (current default 16384 truncates).
6. `WidgetStore` filenames: add a short uuid to avoid same-second collisions; make the store root configurable (`config(store_dir=)`), since R users' cwd is arbitrary.
7. Fix the `VIBE_INCLUDE_REACT` vs `VIBE_EXTERNALIZE_REACT` env mismatch in `services/bundling.py` / `bundler/build.cjs`.

Host bridge:

8. `hosts/bridge.py`, `hosts/protocol.py`, `hosts/server.py`, `hosts/static.py`, `hosts/session_api.py` as in §2.1.
9. `llm/providers/fake_provider.py`: selected by `VIBE_PROVIDER=fake`; replays canned generations/revisions from `tests/hosts/fixtures/generations/*.js` with configurable streaming delay and failure injection. This is the backbone of every offline test in every language.
10. JS `AppWrapper/hosts/*` and the new esbuild target `build-app-wrapper:host`; `host_capabilities` gate for revision/save affordances.
11. Static emitter parity check: Python-emitted HTML renders in headless Chromium and shows the fixture widget.

Exit criteria: `pytest tests/hosts`, `npm run test:ui:contract`, `npm run test:host` (new), and one Playwright test green; `python -m vibe_widget.hosts.demo` opens a browser page that streams a fake generation and applies a grab-edit round trip with no Jupyter anywhere.

### Phase 2 — R package: static + live rendering (5–7 days) → brief's "minimum success"

12. Package skeleton with `usethis`; `.onLoad` → `py_require("vibe-widget==0.2.x")` (dev override `VIBEWIDGET_PYTHON_SRC=/path/to/repo/src` → `py_require(local path)`); `vw_py()` lazy import with a clear error if Python cannot be provisioned.
13. `vw_create()` → `session_api.create_session()`; returns the `vibe_widget` R object; `print()` builds the htmlwidget (`mode` auto: live when interactive and server reachable, static in knitr or when `vw_options(mode="static")`).
14. `inst/htmlwidgets/vibewidget.js` binding: `renderValue` → `VibeWidgetHost.mount`; `resize` forwards to the AppWrapper container; dependency declared twice: URL dep (live) and file dep (static), chosen per render.
15. Host detection (`R/render.R`): `interactive()`, `Sys.getenv("POSITRON")`, `rstudioapi::isAvailable()`, `knitr::is_html_output()`, `isTRUE(getOption("knitr.in.progress"))`, `commandArgs()` for `Rscript`.
16. `vw_html()`, `w$wait()`, `w$status()`, `w$code()`; `cli` progress during blocking waits.
17. `R/data.R` normalization from S4.

Exit criteria: In Positron console and notebook, `vw_create("…", df)` streams and renders inline with the fake provider and with a real key; `quarto render` of a `.qmd` produces a working static widget; testthat green (pure-R and Python-backed lanes); R-driven Playwright E2E green.

### Phase 3 — Round trip: outputs, inputs, actions, grab-edit, edit/save/load (4–6 days) → brief's "ideal success"

18. `$outputs$<name>()` pull; `vw_observe()` with a `later` drain loop that starts on first observer and stops on last; events queued in Python (`HostSession.events`).
19. `$inputs$<name> <- v` via active bindings → `session.set_trait`; linked widgets by passing `ExportHandle` Python refs through reticulate (engine links natively; no R logic).
20. `$actions$<name>(...)` → `widget.actions.<name>(**kwargs)`.
21. Grab-edit: already live through `state.set`; add `vw_edit(w, prompt)` and, optionally, the `annotations[]` batch extension to `grab_edit_request` with a Python-side dispatcher (single vs batch) and matching frontend batching (mirrors vibe-next's Shift-click grouping).
22. `vw_save()` / `vw_load()` over the existing `.vw` JSON; `remote_call` and `save_widget` custom messages proxied through the bridge; approval mode (`vw_config(execution="approve")`) surfaced in R via `w$approve()`.

Exit criteria: Playwright E2E: click a widget element in the browser → `w$outputs$selection()` in R returns it; set an input from R → DOM updates; grab-edit round trip with fake provider changes the DOM; testthat covers the R-side semantics; a two-widget linked example works in Positron.

### Phase 4 — Quarto and persistence ergonomics (3–4 days)

23. Render cache: `_vibewidget/<hash>.vw` keyed on prompt + schema fingerprint + ports + model + engine version; `vw_options(cache = TRUE)`; honors Quarto `freeze` semantics by being deterministic on hit.
24. Static asset policy: single inlined host bundle per document (htmltools dependency dedup), editor bundle excluded from static docs, `max_rows` guard with a visible note in the widget.
25. `quarto preview` guidance and a `vignettes/quarto.qmd` that renders in CI with the fake provider.
26. Sizing policy tuned for Viewer pane (`viewer.fill`), notebook (`defaultHeight`), and knitr (`knitr.figure = FALSE`, explicit height).

Exit criteria: `quarto render` twice hits the cache the second time (no provider calls; asserted via fake provider counters); rendered HTML passes the Playwright static suite; document size within budget.

### Phase 5 — Packaging, CI, no-Node npm imports, sidecar (4–6 days)

27. `vibe-widget` wheel must include `hosts/static/vibewidget-host.js` and the editor bundle; version pin shared between `pyproject.toml` and R `DESCRIPTION`/`zzz.R` via a release script.
28. npm imports without Node (**real capability gap in the brief §9**): packaged installs have no `node_modules`, so `BundleService` reports `bundler_unavailable` and generated code is served raw. Add a runtime import-map resolution mode (`VIBE_NPM_RESOLUTION=cdn|node|off`, R default `cdn`) that maps bare specifiers to `https://esm.sh/<pkg>@<version>` through the es-module-shims map already installed by `SandboxedRunner.js` (`mapOverrides: true`, **verified**). Allow-list packages; document the offline trade-off.
29. `vibe-widget serve` CLI + R `driver = "sidecar"` using `reticulate::uv_run_tool()`; Arrow IPC file handoff for data; same protocol; used as the fallback from S1.
30. GitHub Actions `r-host.yml`: jobs `js-unit`, `py-tests`, `r-tests` (r-lib/actions `setup-r`, `setup-r-dependencies`, `astral-sh/setup-uv`), `e2e` (Playwright), `quarto` (quarto-dev/quarto-actions); matrix `macos-latest`, `ubuntu-latest`; Windows as allow-fail at first.
31. Docs: R README, `vignettes/getting-started.Rmd`, `POSITRON_SMOKE.md`, and an update to `design/vibe-widget-modernization/portable-staging-plan.md` recording that the R host is a third port on gen-1 pending vibe-next parity.

Exit criteria: fresh machine (CI runner) goes from `install.packages()`-equivalent to a rendered widget with no manual Python setup; all lanes green.

Total: roughly 23–33 engineer-days, i.e. 5–7 calendar weeks for one person with the buffer.

---

## 5. Test strategy

Principle: the LLM is never on the test path. Every layer runs against the fake provider, and the same packet fixtures are consumed by Python and JS.

| Lane | Tooling | Location | What it proves |
|---|---|---|---|
| A. JS host model | `node --test` + happy-dom (existing `ui-tests/contract/testHarness.mjs`) | `ui-tests/host/*.test.mjs` | `HostModel` passes the same behavioral suite as `createMockModel`; `WsPort` applies snapshot/patch ordering, coalesces `set`+`save_changes`, reconnects and re-hydrates; `StaticPort` hides revision/save; AppWrapper mounts and reaches `status: ready` from a fixture snapshot |
| B. Python bridge | pytest | `tests/hosts/` | snapshot contents; trait change from a worker thread → one `state.patch`; inbound `state.set` on `grab_edit_request` → fake revision → `code` patch; `custom.send` editor bundle round trip; token/origin rejection; 500 patches under load with a connected client; `wait()`; provider error → `status=error` with no repair loop; static emit contains bundle + escaped snapshot |
| C. Protocol fixtures | JSON + validators | `tests/hosts/fixtures/packets/` | every method has a valid and an invalid example; both languages validate identically |
| D. R package | testthat | `r/vibewidget/tests/testthat/` | pure-R lane (always): argument normalization, data normalization goldens, host detection, htmlwidget payload, `.vw` I/O, static HTML assembly. Python lane (`VIBEWIDGET_TEST_PYTHON=true`): create/wait/status, outputs pull, inputs push, actions, observe drain, edit, save/load, error translation |
| E. Browser E2E | Playwright (installed) driven from node | `ui-tests/host-e2e/` | static page renders fixture widget; live page streams logs then renders; click → output visible in Python; input set → DOM; grab-edit round trip; reconnect after server restart; two widgets isolated on one page. Also an R-driven variant: `Rscript` creates the widget and serves it while Playwright interacts |
| F. Quarto | bundled Quarto binary locally, quarto-actions in CI | `r/vibewidget/tests/qmd/` | render succeeds, cache hit on second render, output passes lane E static checks |
| G. Manual smoke | checklist | `r/vibewidget/POSITRON_SMOKE.md` | Positron console Viewer, Positron notebook inline, RStudio Viewer, `quarto preview` in Positron; run before each release with a real model |

Performance gates (lane B/E): time-to-first-log after `vw_create()` < 1 s with the fake provider; snapshot for a 10k-row frame < 2 MB; patch fan-out latency < 50 ms locally.

---

## 6. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Notebook webview blocks `ws://127.0.0.1` or `<script src=http://127.0.0.1>` | medium | S2 decides early; fallbacks ordered: iframe → inline bundle + WS → static cell + live Viewer |
| reticulate thread semantics differ in Positron's embedded R (ark) vs RStudio | low–medium | S1 runs in both; subprocess sidecar is the designed fallback |
| ark inlines the 4 MB bundle into every notebook cell output | medium | URL dependency in live mode; `ark.html_widget.deduplicate`; lighter host bundle |
| traitlets is not thread-safe and gen-1 already mutates from worker threads | medium | single inbound worker + `RLock` in `HostSession`; stress test in lane B; long-term fix is vibe-next's port |
| Generated code that imports npm packages fails in R installs (no Node) | high (known) | Phase 5 CDN import map; until then a clear in-widget message |
| Blocking observers (`_on_grab_edit`, audit) stall the socket | medium | inbound worker thread; socket loop never calls into the widget |
| API key handling across R/Python | low | env var by default, `vw_config(api_key=)` passes through, never written to `.vw`, HTML, or logs (assert in tests) |
| Version drift between R package and Python engine | medium | pinned `py_require` version, handshake `engine_version` check with a friendly upgrade message |
| Windows (uv, paths, sockets) | medium | CI allow-fail lane first; not a v1 target per the brief |

---

## 7. What this plan deliberately does not do

- No R reimplementation of prompts, agent loop, audit, or repair (option D).
- No httpuv server in R; no Shiny dependency.
- No IRkernel/RKernel comm implementation (option C); IRkernel users get the same WebSocket path.
- No Positron extension in v1; documented as a later enhancement for a server-free channel.
- No port to vibe-next yet; the protocol envelope is aligned so that the swap is mechanical when vibe-next reaches feature parity.

---

## 8. Appendix

### 8.1 Verified facts this plan rests on

- `AppWrapper.js` exports `render({ model, el })`; the frontend touches the host only via `get/set/save_changes/on/off/send/close`, `comm:close`, and three custom message types (`request_editor_bundle`, `save_widget`, `remote_call`). Mock models already exist in `ui-tests/contract/testHarness.mjs` and `doc/utils/PyodideRuntime.ts`.
- Outside a kernel, `VibeWidget.comm` is `comm.DummyComm`; `widget.send` can be overridden per instance; `widget.observe(cb, names=widget.traits(sync=True))` sees changes from the main thread and `_generation_worker`; `frontend_ready = True` starts generation; `_display_widget = True` selects the async branch (probe run 2026-09-15 from a scratch cwd).
- Positron 2026.09.1 installed; 2026.07.0 release notes confirm inline htmlwidgets fix; ark's `html_widgets.R` inlines file dependencies and leaves URL dependencies alone; ark exposes no custom comm API to R.
- reticulate: `py_require()` since 1.41 (uv-managed, `.onLoad`-friendly); background Python threads run concurrently with R since 1.39; data.frame ↔ pandas automatic; Arrow tables cross via the C Data Interface.
- `quarto preview` with knitr spawns `Rscript` per render; rendered output has no R process.
- Bundles: `AppWrapper.bundle.js` 3.97 MB, editor bundle 0.58 MB; root `package.json` builds both with inline esbuild flags; Node 24, Playwright Chromium, `websockets` 15.0.1, `aiohttp` 3.13 available locally.
- vibe-next's port contract is `open/send/subscribe/close` over `vibe.transport/1` packets; its static emitter is bundle + two JSON blobs + `<vibe-app>`.

### 8.2 Dev setup on this Mac

```bash
brew install --cask rig && rig add release
Rscript -e 'install.packages(c("reticulate","htmlwidgets","htmltools","jsonlite","later","cli","rlang","testthat","devtools","usethis","knitr","rmarkdown"))'
export VIBEWIDGET_PYTHON_SRC=$PWD/src            # dev: reticulate uses the repo engine
export VIBE_PROVIDER=fake                        # offline tests
npm ci && npx playwright install chromium
alias quarto=/Applications/Positron.app/Contents/Resources/app/quarto/bin/quarto
```

### 8.3 Files touched, by phase

- Phase 1: `src/vibe_widget/core/widget.py`, `services/bundling.py`, `bundler/build.cjs`, `llm/providers/fake_provider.py` (new), `hosts/` (new), `AppWrapper/hosts/` (new), `package.json`, `tests/hosts/` (new), `ui-tests/host/` (new).
- Phase 2–4: `r/vibewidget/` (new), `ui-tests/host-e2e/` (new), `r/vibewidget/tests/qmd/` (new).
- Phase 5: `pyproject.toml`, `hosts/cli.py`, `.github/workflows/r-host.yml`, docs.
