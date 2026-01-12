# Python-First Transformation Plan

This document proposes a notebook-native iteration model for interactive widgets. It
removes in-widget editing/regeneration and makes Python cells the sole source of truth
for prompts, edits, and widget lineage.

The goals are:
- Keep all intent and iteration history visible in Python cells.
- Allow fast iteration with minimal explicit commands.
- Provide consistent, debuggable inference for extend/edit/fork/new.
- Avoid UI-heavy workflows; focus on prompts, metadata, and reproducibility.

## Summary of the New Interaction Flow

1. The user writes a prompt in a Python cell and runs it.
2. The system creates a widget node and renders the interactive viewer.
3. The user edits or extends the prompt in a cell (same or new) and re-runs.
4. The system computes a prompt diff and classifies intent:
   - extend
   - edit
   - fork
   - new
5. The system generates a new node in a prompt graph and updates the widget view.
6. The notebook remains the only surface for edits; the widget UI is view-only.

## Architecture Overview

### Core Components

- PromptGraph
  - A session-level graph of prompt nodes and edit edges.
  - Nodes represent prompt states and generated code.
  - Edges represent inferred edit type and diff metadata.

- PromptDiffEngine
  - Computes semantic and structural differences between prompts.
  - Produces a normalized diff summary used by classifiers and logging.

- IntentClassifier
  - Heuristic-first classifier for extend/edit/fork/new.
  - Optional LLM assistance for ambiguity or low confidence.

- GenerationService
  - Accepts the current prompt, prior prompt (if any), and diff summary.
  - Produces code and metadata, then stores results in PromptGraph.

- NotebookGlue
  - Minimal Python API for create/iterate/list/history.
  - Keeps all state in Python (no hidden frontend state).

### Prompt Graph Model

Use a directed acyclic graph (DAG), not a linear chain, to capture forks.

- Node
  - node_id: UUID
  - prompt_text: str
  - prompt_hash: str (hash of normalized prompt)
  - code_hash: str
  - generated_code: str
  - created_at: float
  - metadata: dict

- Edge
  - from_id: UUID
  - to_id: UUID
  - edit_type: literal("extend", "edit", "fork", "new")
  - diff_summary: dict
  - confidence: float
  - classifier: literal("heuristic", "llm")

- Graph
  - root nodes = new widgets
  - fork edges branch from any node
  - no UI mutation, only append nodes

## Prompt Diffing Strategy

Prompt diffing should be semantic-first, not just string diff. Use layered analysis:

1. Normalization
   - Trim whitespace, collapse repeated spaces.
   - Normalize bullet styles ("-", "*", "1.") into a canonical form.
   - Remove trailing punctuation-only lines.
   - Keep original prompt for logging, but diff on normalized text.

2. Structural segmentation
   - Split into sections by blank lines or headings.
   - Split lists into items.
   - Extract code blocks if present (fence markers).

3. Semantic embedding (optional)
   - Compute embeddings per section or sentence.
   - Track similarity to detect rewrites vs additions.

4. Keyword and intent cues
   - Detect verbs like "change", "replace", "remove", "instead", "only", "make it".
   - Detect correction language ("fix", "adjust", "tweak", "align", "spacing").

5. Diff summary
   - added_sections: list of new sections
   - removed_sections: list
   - modified_sections: list of pairs (old, new)
   - appended_items: list
   - replaced_terms: list
   - similarity_score: float

The diff summary is used both for classification and for storing a compact history.

## Intent Classification Heuristics

These heuristics are deterministic and explainable. When confidence is low, an optional
LLM classifier can be used to break ties.

### Extend
- New prompt contains most of the old prompt plus new lines at the end.
- High similarity (>= 0.85) and mostly additions.
- Added content is bullet items or appended paragraphs.
- Old sections are not removed or rewritten.

### Edit
- Similarity is high but some sections are modified or replaced.
- Change verbs are present ("change", "swap", "instead of").
- Small edits (label changes, styling tweaks, spacing fixes).
- Old content is partially replaced or reordered.

### Fork
- Similarity is moderate (0.45 to 0.85), and new prompt includes a shared core
  but introduces a new direction ("try a different version", "alternate").
- User starts in a new cell with a prompt that references a previous output
  but diverges significantly.
- "what if" or variant language appears.

### New
- Similarity is low (< 0.45).
- No overlap in key entities or constraints.
- No explicit references to a previous widget.

### Optional Model Assist
When multiple heuristics match or confidence < 0.6, call a lightweight model to
classify intent based on:
- old prompt
- new prompt
- diff summary
- usage context (cell history)

## Metadata to Store per Node

Store enough to audit and reproduce behavior, without bloating the UI:

- prompt_text (original)
- prompt_normalized
- prompt_hash
- diff_summary
- parent_id (if any)
- edit_type
- confidence
- classifier
- code_hash
- generated_code
- model_config (model, mode, version, provider)
- execution_mode (auto/review/manual)
- created_at
- notebook_cell_id (if available)
- kernel_session_id
- user_tags (optional)

## Notebook-Friendly Python API

Keep the API minimal, explicit, and cell-centric. Prefer a single entry point for
prompt submission and a small set of optional helpers.

Suggested API:

```python
import vibe_widget as vw

# Create or iterate; intention inferred
w = vw.prompt("scatter plot of x vs y with tooltips", df)

# Optional: give a hint to resolve ambiguity
w = vw.prompt("make it dark themed", df, hint="edit")

# Optional: reference a specific prior widget
w = vw.prompt("try a different color palette", df, parent=w)

# Inspect history
vw.history(w)        # list of nodes
vw.graph(w)          # graph summary
vw.diff(w, -1)       # last diff summary
```

Notes:
- `vw.prompt(...)` is the only required entry point.
- `hint` is optional and only used to override classification in ambiguous cases.
- `parent` is optional and allows explicit lineage when needed.

## What the Frontend Should No Longer Do

Remove the following from the widget UI:
- In-widget regeneration buttons
- Inline code editors or prompt editors
- Audit panels that collect user decisions
- UI state that can mutate prompts or code
- Element-level editing (move to text prompt in cells)

The widget UI should be:
- A viewer for the current widget output
- A place to show runtime errors and logs
- A place to show provenance or metadata in read-only form (optional)

## Helpful Views for Iteration (Read-Only)

These are optional views that remain notebook-safe and do not mutate state:

- Prompt lineage view
  - A compact tree or list showing prompt versions and edit types

- Diff summary view
  - Shows changes between prompt versions (text-only)

- Provenance panel
  - Model, timestamp, execution mode, code hash

- Runtime logs view
  - Widget logs and errors surfaced in the notebook output

- Reproducibility snippet
  - A copyable Python cell showing the exact prompt and metadata

## Cross-Cell Semantics

To support iteration across cells, store per-cell metadata:
- cell_id or execution count (if available)
- prompt_hash
- last_active_widget_id in session

When a new cell runs:
- If it references a prior widget object, use that as parent.
- Else infer parent using prompt similarity to recent nodes.
- If no close match, treat as new.

This preserves "riffing" behavior without forcing explicit methods.

## Debuggability and Transparency

Every classification decision should be explainable:
- Store a diff summary and a reason code.
- Expose `vw.explain(w)` to show why the system chose extend/edit/fork/new.
- Allow a user override via `hint` or `parent`.

## Implementation Plan (Phased)

1. Add PromptGraph data model and storage (in-memory + optional disk cache).
2. Implement PromptDiffEngine with normalization and structural diffing.
3. Add heuristic IntentClassifier + low-cost LLM fallback.
4. Update Python API to use `vw.prompt` as the primary entry point.
5. Remove or hide frontend editing surfaces; keep viewer and logs only.
6. Add read-only notebook views for lineage and diff summaries.

## Open Questions

- Should prompt graph be persisted per notebook file or per session only?
- How to best extract a stable cell_id across notebook environments?
- What similarity threshold yields the most intuitive classification?

## Non-Goals

- Perfect intent inference.
- Interactive UI editing or regeneration.
- Heavy frontend state management.

This approach shifts iteration back to Python while keeping rapid exploration
possible, with a consistent and auditable history of prompt evolution.
