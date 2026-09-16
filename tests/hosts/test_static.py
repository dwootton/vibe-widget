import json
import re

import pytest

from vibe_widget.hosts import static as static_module
from vibe_widget.hosts.bridge import HostSession


def _snapshot_script_json(html: str) -> dict:
    match = re.search(r"window\.__VIBEWIDGET_SNAPSHOT__ = (\{.*?\});", html, re.DOTALL)
    assert match, "embedded snapshot script not found"
    return json.loads(match.group(1))


def test_emit_html_embeds_bundle_and_snapshot(widget, bridge):
    widget.wait_for = None  # not used here; just documents bridge is already attached
    html = static_module.emit_html(bridge, inline_bundle=True)
    assert "VibeWidgetHost.mount" in html
    assert "<script>" in html  # the bundle is inlined as its own script tag
    snapshot = _snapshot_script_json(html)
    assert snapshot["status"] == widget.status
    assert "_esm" not in snapshot


def test_emit_html_escapes_close_script_tags_in_data(sample_df, widget, bridge):
    # A value containing the literal text `</script>` must never be able to
    # break out of the embedding <script> tag.
    widget.data = [{"x": "</script><script>alert(1)</script>"}]
    html = static_module.emit_html(bridge, inline_bundle=True)
    assert "</script><script>alert(1)</script>" not in html
    assert "\\u003c/script>" in html


def test_emit_html_row_guards_large_data(widget, bridge):
    widget.data = [{"i": i} for i in range(1000)]
    html = static_module.emit_html(bridge, max_rows=10, inline_bundle=True)
    snapshot = _snapshot_script_json(html)
    assert len(snapshot["data"]) == 10
    assert snapshot["_vibewidget_truncated"] == {"original_rows": 1000, "shown_rows": 10}


def test_emit_html_without_truncation_omits_truncation_marker(widget, bridge):
    html = static_module.emit_html(bridge, max_rows=500, inline_bundle=True)
    snapshot = _snapshot_script_json(html)
    assert "_vibewidget_truncated" not in snapshot


def test_emit_html_rejects_negative_max_rows(bridge):
    with pytest.raises(ValueError):
        static_module.emit_html(bridge, max_rows=-1)


def test_emit_html_can_reference_the_bundle_by_url_instead_of_inlining(bridge):
    html = static_module.emit_html(bridge, inline_bundle=False)
    assert '<script src="vibewidget-host.js"></script>' in html
    assert "VibeWidgetHost.mount" in html


def test_live_page_html_embeds_session_config_and_escapes_title():
    html = static_module.live_page_html(
        session_id="abc123", token="tok-xyz", ws_url="ws://127.0.0.1:9999", title="<b>hi</b>"
    )
    assert "&lt;b&gt;hi&lt;/b&gt;" in html  # title is HTML-escaped
    assert '"sessionId":"abc123"' in html
    assert '"token":"tok-xyz"' in html
    assert '"wsUrl":"ws://127.0.0.1:9999"' in html
    assert '<script src="/assets/vibewidget-host.js"></script>' in html
