"""rrweb scoping spike widgets (not part of the vibe_widget package)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import anywidget
import traitlets

HERE = Path(__file__).parent


class Spike(anywidget.AnyWidget):
    _esm = HERE / "spike.js"
    mode = traitlets.Unicode("iframe").tag(sync=True)
    block_selector = traitlets.Unicode("").tag(sync=True)
    events = traitlets.Unicode("").tag(sync=True)
    measure = traitlets.Dict({}).tag(sync=True)


class Replay(anywidget.AnyWidget):
    _esm = HERE / "replay.js"
    events = traitlets.Unicode("").tag(sync=True)


NEEDLES = {
    "other cell's data (SECRET_PATIENT_4471)": "SECRET_PATIENT_4471",
    "notebook chrome (jp-NotebookPanel)": "jp-NotebookPanel",
    "file browser (jp-DirListing)": "jp-DirListing",
    "widget text (cohort A)": "cohort A",
    "naive tooltip": "naive tooltip",
    "scoped tooltip": "scoped tooltip",
    "canvas frames (data:image/webp)": "data:image/webp",
}


def stats(events_json: str) -> dict[str, Any]:
    events = json.loads(events_json or "[]")
    out: dict[str, Any] = {
        "events": len(events),
        "kB": round(len(events_json) / 1024, 1),
        "full_snapshots": sum(1 for e in events if e.get("type") == 2),
    }
    for label, needle in NEEDLES.items():
        out[label] = needle in events_json
    return out
