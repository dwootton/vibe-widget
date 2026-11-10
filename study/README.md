# vibe-widget-study

Record **intent artifact traces** from [Vibe Widget](https://vibewidget.dev) for vis research
studies: what people asked for, the code each request produced, and what went wrong along the
way.

This is a separate, opt-in package. Core `vibe_widget` only announces trace events through a
no-op hook (`vibe_widget.tracing`); nothing is recorded unless this package is installed **and**
`start()` is called.

```bash
pip install "git+https://github.com/dwootton/vibe-widget#subdirectory=study"
```

```python
import vibe_widget as vw
import vibe_widget_study as study   # also reachable as vw.study once installed

study.start()                       # .vibewidget/traces/<session>.jsonl, local only
w = vw.create("scatter of x vs y", df)
w.edit("add a tooltip")
study.events()                      # DataFrame of the recorded trace
study.stop()
```

## What is recorded

| Stream | Events | Default |
|---|---|---|
| `intents` (required) | `intent.create`, `intent.edit`, `intent.grab_edit`, `intent.state_prompt`, `intent.approve`, `intent.cancel`, `context.contract`, `artifact.version` | on |
| `code` | `artifact.code` (full generated code per version) | on |
| `errors` | `error.generation`, `error.runtime`, `error.edit` | on |
| `schema` | `context.schema` (column names and dtypes, never values) | on |
| `usage` | `usage.request` (model, tokens, dollar cost per LLM request) | on |

Choose streams with `study.start(streams=["intents", "errors"])`. Events from other streams are
dropped before they reach any sink.

Each widget's revisions share a `lineage_id` (saved in the widget's provenance, so it survives
edits, `vw.load`, and new kernels). Each code version has a `version_id` and a
`parent_version_id`, so a lineage reads as a tree of intents and the artifacts they produced.

## Spend caps

- `study.start(budget_usd=5)` stops LLM requests once $5 is spent across every session in the trace
  folder (kept in `spend.json`, so a kernel restart doesn't reset it). `study.budget()` reports it.
  This is a client-side guard built on core `vw.config(budget_usd=...)` / `vw.spend()`.
- For a hard cap, mint one OpenRouter key per participant with a credit limit:
  `keys.create_participant_key(management_key, name, limit_usd=5)`, then `keys.get_key`,
  `keys.set_key_limit`, `keys.disable_key`. Participants can check theirs with `keys.key_status`.

## Status

Local recording only. Study manifests, consent cards, and upload to a researcher-owned store
(Supabase) are next; see [`design/study-traces/`](../design/study-traces/README.md).

## Development

```bash
pip install -e .          # from the repo root: core vibe_widget
pip install -e study      # this package
pytest study/tests
```
