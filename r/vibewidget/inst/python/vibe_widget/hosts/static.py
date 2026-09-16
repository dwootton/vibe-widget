"""Static (self-contained) and live-session HTML documents.

``emit_html`` produces a single, dependency-free HTML file: the host JS
bundle inlined, plus one escaped JSON snapshot of the widget's current
state. It is the read-only counterpart to the live WebSocket path in
:mod:`server` - the mode rendered Quarto output and a plain ``vw_html()``
export use, since neither has a live R/Python process behind it.

``live_page_html`` is the small page :class:`~vibe_widget.hosts.server.
LocalHostServer` serves at ``/w/<session_id>``: it points the same host
bundle at a WebSocket instead of an embedded snapshot.
"""

from __future__ import annotations

import json
from html import escape
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from vibe_widget.hosts.bridge import HostSession

STATIC_DIR = Path(__file__).resolve().parent / "static"
HOST_BUNDLE_PATH = STATIC_DIR / "vibewidget-host.js"

# Row guard for static export: mirrors the intent of the row-guard already
# applied to the `data` trait elsewhere in the engine. A static document has
# no server to page further results from, so its data really must be bounded
# once, here, rather than relying on the caller to have already done it.
DEFAULT_MAX_ROWS = 500

# `<` must never appear unescaped inside a `<script>` body embedding
# arbitrary JSON, or a value containing the literal text `</script>` would
# terminate the script tag early and let the rest of the string execute (or
# render) as HTML. `<` is indistinguishable to the JS parser but not to
# an HTML tokenizer scanning for `</script>`.
def _json_for_script(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"), default=str).replace("<", "\\u003c")


def _read_bundle() -> str:
    if not HOST_BUNDLE_PATH.exists():
        raise FileNotFoundError(
            f"Host bundle not found at {HOST_BUNDLE_PATH}. Run `npm run build-app-wrapper:host` "
            "(or the full `npm run build-app-wrapper`) before exporting static HTML."
        )
    return HOST_BUNDLE_PATH.read_text(encoding="utf-8")


def _row_guarded_snapshot(bridge: "HostSession", *, max_rows: int) -> dict[str, Any]:
    snapshot = dict(bridge.snapshot())
    data = snapshot.get("data")
    if isinstance(data, list) and len(data) > max_rows:
        snapshot["data"] = data[:max_rows]
        snapshot["_vibewidget_truncated"] = {"original_rows": len(data), "shown_rows": max_rows}
    return snapshot


def emit_html(
    bridge: "HostSession",
    *,
    max_rows: int = DEFAULT_MAX_ROWS,
    inline_bundle: bool = True,
    title: str | None = None,
) -> str:
    """Build a self-contained static document for `bridge`'s current state.

    The widget is expected to already be in a terminal status (``ready``,
    ``error``, or ``blocked``); callers (see ``Session.save_html`` and the R
    package's ``vw_html()``) are responsible for waiting first. Exporting a
    still-generating widget is not rejected outright (there is a legitimate
    use in tests), but the resulting page will simply show that in-progress
    state frozen, with no way to resume it.
    """
    if not 0 <= max_rows:
        raise ValueError("max_rows must be >= 0")

    snapshot = _row_guarded_snapshot(bridge, max_rows=max_rows)
    bundle = _read_bundle() if inline_bundle else None
    snapshot_json = _json_for_script(snapshot)
    doc_title = escape(title or "Vibe Widget")

    bundle_tag = (
        f"<script>{bundle}</script>"
        if inline_bundle
        else '<script src="vibewidget-host.js"></script>'
    )

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{doc_title}</title>
<style>html,body{{margin:0;padding:0}}#vibewidget-root{{min-height:100px}}</style>
</head>
<body>
<div id="vibewidget-root"></div>
{bundle_tag}
<script>
  window.__VIBEWIDGET_SNAPSHOT__ = {snapshot_json};
  VibeWidgetHost.mount(document.getElementById("vibewidget-root"), {{
    mode: "static",
    snapshot: window.__VIBEWIDGET_SNAPSHOT__,
  }});
</script>
</body>
</html>
"""


def live_page_html(*, session_id: str, token: str, ws_url: str, title: str | None = None) -> str:
    """The page served at ``/w/<session_id>`` by :class:`LocalHostServer`.

    Unlike :func:`emit_html`, this always references the bundle by URL
    (``/assets/vibewidget-host.js``) rather than inlining it, so the server
    need not re-read and re-stringify a multi-megabyte file per request and
    a browser can cache it across sessions in the same process.
    """
    doc_title = escape(title or "Vibe Widget")
    config_json = _json_for_script(
        {"mode": "live", "wsUrl": ws_url, "sessionId": session_id, "token": token}
    )
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{doc_title}</title>
<style>html,body{{margin:0;padding:0}}#vibewidget-root{{min-height:100px}}</style>
</head>
<body>
<div id="vibewidget-root"></div>
<script src="/assets/vibewidget-host.js"></script>
<script>
  VibeWidgetHost.mount(document.getElementById("vibewidget-root"), {config_json});
</script>
</body>
</html>
"""
