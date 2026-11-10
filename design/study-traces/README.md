# vw.study: intent artifact traces for vis research

Status: design draft (2026-11-10). Spike in [`spike/`](spike/).

## Goal

A vis researcher sets up a study, hands a join code to domain collaborators, and
collaborators keep using Vibe Widget in their own Jupyter notebooks. Every widget's
**intent artifact trace** (what they asked for, what the model produced, and what
they did with it) flows to a store the researcher controls, with consent the
collaborator can see and revoke.

```
Vis researcher ──join code──▶ Domain collaborator (Jupyter)
      ▲                              │
      │                       local trace log  (inspect / pause / delete)
      │                              │
 vw.study.fetch() ◀── study store (researcher's Supabase) ◀── upload
```

## What a trace is

One trace = one widget **lineage**: a chain of intents, each paired with the artifact
it produced. Most of this already exists per widget in `.vibewidget/widgets/*.json`
(`prompt_history`, `revision_parent`, provenance); the study system gives it a
uniform event shape, consent, and a destination.

| Stream | Event kinds | Source today |
|---|---|---|
| `intents` | `create`, `edit.text`, `edit.grab` (annotated element + prompt), `approve`/`reject`, `abandon` (inferred) | `_append_prompt_history`, `_on_grab_edit`, execution state |
| `code` | `generated` (code, hash, model, latency, tokens), `autofix` | `handle_complete` in `_start_generation` |
| `errors` | `runtime_error`, `audit` | `handle_error`, audit state |
| `schema` | column names + dtypes of inputs | data summarizer |
| `interactions` | export value changes, widget-to-widget links | export handles / traitlets |
| `replay` | rrweb chunks, one segment per artifact version | new (see below) |

Raw data values are never collected at any tier.

### Event table

```sql
create table events (
  id               uuid primary key default gen_random_uuid(),
  study_id         text not null references studies(id),
  participant_id   uuid not null references participants(id),
  session_id       uuid not null,     -- one kernel session
  notebook_hash    text,              -- optional: which notebook
  lineage_id       text not null,     -- root widget of the revision chain
  version_id       text,              -- artifact version (code hash)
  parent_version_id text,
  ts               timestamptz not null,
  kind             text not null,     -- e.g. 'intent.edit.grab'
  stream           text not null,     -- manifest stream name; enforced server-side
  payload          jsonb not null,
  client_version   text not null      -- vibe-widget version (py or R)
);
-- replay chunks go to Supabase Storage; events hold only pointers:
--   kind='replay.chunk', payload={path, version_id, t0, t1, bytes}
```

The schema is plain JSON so the R shim emits identical events.

## Study manifest (researcher decides what to collect)

```yaml
study: Clinical cohort exploration
contact: researcher@lab.edu
irb: "2026-0412"
retention_days: 365
upload: batch            # or "review": participant approves each batch before upload

streams:
  intents:      { required: true }
  code:         { default: on }
  errors:       { default: on }
  schema:       { default: on }
  interactions: { default: off }
  replay:
    default: off
    mask_text: false         # true = all widget text becomes ****
    mask_inputs: true
    canvas_fps: 2
    max_minutes_per_session: 30
```

- The consent card is **generated from the manifest**: one plain-language row per
  stream, required streams locked on, optional streams as toggles preset to the
  researcher's default. Replay gets an explicit "screen recording of widgets" warning.
- Consent stores the **manifest hash**. Editing the manifest forces re-consent before
  any new event is accepted.
- **The server enforces consent.** The ingest function drops any event whose `stream`
  the participant didn't agree to, so the client is never trusted.

## Researcher setup (bring-your-own Supabase)

1. `vibewidget study init` (or a template repo) applies the migration: `studies`,
   `participants`, `consents`, `events`, RLS policies, and a Storage bucket for replay.
2. Deploy one Edge Function, `ingest`, which:
   - exchanges a join code for a pseudonymous `participant_id` + short-lived upload token
   - validates events against the participant's consented streams
   - enforces payload size, rate limits, and the replay minutes cap
   - serves `DELETE /participant/me` for withdrawal
3. `vibewidget study create manifest.yaml` → prints a join code (`vws_…`).
4. Analysis: `vw.study.fetch(study_id)` signs in as the researcher and returns
   DataFrames (`events`, `lineages`, `participants`); `vw.study.replay(event)` opens
   the replay segment for an artifact version.

No service-role key ever reaches a notebook. A `TraceSink` interface (`LocalSink`,
`SupabaseSink`, `HTTPSink`) keeps Supabase the documented default without lock-in.

**Open:** also offer a hosted vibewidget.dev collector for researchers who don't want
to run Supabase? Easier onboarding, but we become the data custodian.

## Collaborator experience

```python
import vibe_widget as vw
vw.study.join("vws_7f3k-…")   # fetch manifest → consent card in the notebook
```

```
┌ Clinical cohort exploration · IRB 2026-0412 ──────────────────┐
│ ■ Your prompts and edits to widgets          required         │
│ ☑ Code the AI generated                      [on]             │
│ ☑ Column names and types (never values)      [on]             │
│ ☐ How you interact with widgets              [off]            │
│ ☐ Screen replay of widgets only              [off]            │
│ Kept 365 days · pause or delete anytime: vw.study.leave()     │
│                                   [ Decline ]  [ Agree ]      │
└───────────────────────────────────────────────────────────────┘
```

- **Local-first.** Every event is written to `.vibewidget/traces/*.jsonl` before
  upload; batched upload with an offline retry queue.
- `vw.study.status()`, `pause()`, `resume()`, `show()` (what was sent),
  `leave(delete=True)`.
- A "recording for <study>" badge in the widget's floating menu while active.
- Join state lives in `~/.vibewidget/studies/` so it persists across kernels.

## rrweb replay

Replay shows what people *did* with an artifact, not just what they asked for.
Segments are aligned to `version_id`, so clicking "edit 3" in a lineage view jumps to
the replay just after that artifact appeared. Each code version remounts the widget,
which naturally starts a new full snapshot.

### Spike: how to scope the recording (JupyterLab 4.4, rrweb 2.0.0-alpha.4)

Widgets render straight into the notebook DOM (`SandboxedRunner` uses no iframe or
shadow root), so `rrweb.record()` on the page records far more than the widget. The
spike ([`spike/rrweb_scoping_spike.ipynb`](spike/rrweb_scoping_spike.ipynb)) ran
the same d3 widget (brush, drag, hover tooltips, canvas animation, text input,
keyboard listener) three ways, ~20 s of interaction each:

| | A: page | B: page + `blockSelector` | C: same-origin iframe |
|---|---|---|---|
| Size | 1204 kB | 1234 kB | **147 kB** |
| …of which first snapshot | 1066 kB | 1086 kB | 85 kB |
| Another cell's DataFrame values | **leaked** | blocked | not captured |
| Notebook chrome, file name, other cells' code | leaked | **leaked** | not captured |
| Widget content, brush, drag, hover | ✓ | ✓ | ✓ |
| Canvas frames (2 fps webp) | ✓ | ✓ | ✓ (43 frames, 58 kB) |

Findings:

1. **The iframe approach (C) works and is the one to build.** Brush, drag,
   `d3.pointer`, and a `keydown` listener on the widget's own window all worked with
   d3 running in the parent realm and the DOM in the iframe. Copying `--jp-*` CSS
   variables kept the theme; a `ResizeObserver` handled auto-height. Replay shows only
   the widget.
2. **`blockSelector` (B) is not enough.** It hid the sibling DataFrame, but the
   replay still shows the JupyterLab shell, the notebook file name, and the code of
   any cell that contains a widget. It also stays ~8× larger because JupyterLab's CSS
   is inlined into the snapshot.
3. **Generated code that touches the global `document` escapes the iframe.** A
   tooltip appended to `document.body` landed in the parent page at the wrong
   position and was missing from the recording. In study-replay mode the runtime
   must hand generated code the iframe's `document`/`window` (or the prompt must
   require `el.ownerDocument`), and we should lint for bare `document.` /
   `window.` use.
4. **Input values are recorded by default.** Set `maskAllInputs: true` unless the
   manifest opts out.
5. **Canvas replay needs `UNSAFE_replayCanvas: true`** in the player; without it the
   canvas replays blank.
6. ~150 kB per 20 s for a small widget → budget roughly 0.5–1 MB/min with canvas.
   Compress chunks (gzip/`rrweb` pack) and upload to Storage, not the events table.

Not yet tested: VS Code and Colab (both already isolate outputs in iframes, so
recording that iframe's document may give scoping for free), WebGL canvases, the full
vibe-widget runtime (`SandboxedRunner` + Preact) mounted into an iframe, and keyboard
shortcuts leaking between the iframe and JupyterLab.

## Build order

1. Event schema + `LocalSink` + hooks in `core/widget.py` (no network, useful alone).
   **Done.** Split in two so research code is opt-in:
   - core `vibe_widget.tracing`: a no-op hook; widgets announce events via `_trace()` /
     `_apply_code(origin=...)`; lineage persisted in `provenance.lineage_id`
     (tests: `tests/test_tracing.py`)
   - separate package `study/` → `pip install vibe-widget-study`, import
     `vibe_widget_study` (or `vw.study`): recorder, streams, sinks, local JSONL
     (tests: `study/tests/`)
   **Spend caps (done):** core `vw.config(budget_usd=...)` / `vw.spend()` meter every
   request at `OpenAICompatProvider._create` (OpenRouter's `usage.cost`) and refuse new
   requests once spent; `study.start(budget_usd=...)` persists spend across sessions in
   `spend.json`; `vibe_widget_study.keys` mints OpenRouter keys with a credit limit
   (the hard cap). Tests: `tests/test_budget.py`, `study/tests/test_budget_and_keys.py`.
2. Manifest format + consent card widget + `vw.study.join/status/pause/leave`.
   The manifest's `budget_usd` feeds `start(budget_usd=...)`; `join()` can hand out a
   capped key minted by the ingest function.
3. Supabase template (migration, RLS, `ingest` Edge Function) + `SupabaseSink`.
4. `vw.study.fetch` + a lineage viewer (dogfood: a vibe widget over the traces).
5. Iframe render path in `SandboxedRunner` behind a flag, then the rrweb `replay`
   stream and `vw.study.replay`.

## Open questions

- Hosted collector in addition to bring-your-own Supabase?
- Session boundary: kernel session vs notebook file (do we hash notebook paths)?
- Should `interactions` include widget-to-widget links and export reads (how the
  artifact fed back into the analysis)?
- Redaction of prompts that contain data values: is "review before upload" enough?
