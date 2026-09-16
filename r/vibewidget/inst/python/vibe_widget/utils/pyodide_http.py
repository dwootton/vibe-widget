"""Pyodide-compatible httpx transport for JupyterLite / Web Worker environments.

When running inside Pyodide / JupyterLite, the standard httpx transport
fails because the Python event loop isn't wired to the browser networking
stack.  Synchronous ``XMLHttpRequest`` also fails for cross-origin URLs
when ``Cross-Origin-Embedder-Policy`` (COEP) headers are in effect (which
JupyterLite enables for ``SharedArrayBuffer`` support).

The **only** reliable mechanism is the browser's **async ``fetch()`` API**,
bridged to synchronous Python via ``pyodide.ffi.run_sync`` (which uses
JSPI / stack-switching — the same mechanism that powers top-level ``await``
in notebook cells).

To avoid all Python↔JS proxy pitfalls (double ``to_js`` conversion,
``Map`` vs plain object for headers, etc.) the ``fetch()`` call is
constructed **entirely in JavaScript** via ``pyodide.code.run_js``.
Python passes only primitive strings and receives a JSON string back.

Usage (only call on emscripten)::

    from vibe_widget.utils.pyodide_http import make_pyodide_http_client
    client = make_pyodide_http_client()
    # Pass to OpenAI:  OpenAI(..., http_client=client)
"""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import httpx

logger = logging.getLogger(__name__)

# Headers that are safe to forward through the browser Fetch API.
# We use a WHITELIST instead of a blocklist because:
#  1. Browser-forbidden headers (Host, Connection, Content-Length, …) are
#     automatically stripped.
#  2. The OpenAI SDK sends headers like ``X-Stainless-Async`` and
#     ``x-stainless-read-timeout`` that are NOT in OpenRouter's
#     ``Access-Control-Allow-Headers`` list, causing the CORS preflight
#     to fail and the entire request to be rejected.
# Only headers explicitly allowed by OpenRouter's CORS policy are forwarded.
_ALLOWED_HEADERS: frozenset[str] = frozenset(
    {
        # Standard
        "accept",
        "content-type",
        "authorization",
        "user-agent",
        # OpenRouter-specific
        "http-referer",
        "x-title",
        "x-openrouter-title",
        "x-windowai-title",
        # X-Stainless subset that OpenRouter allows
        "x-stainless-lang",
        "x-stainless-package-version",
        "x-stainless-os",
        "x-stainless-arch",
        "x-stainless-runtime",
        "x-stainless-runtime-version",
        "x-stainless-retry-count",
        "x-stainless-timeout",
        "x-stainless-helper-method",
    }
)

# ---------------------------------------------------------------------------
# JavaScript async function executed via run_js().
#
# It receives four string arguments (url, method, headersJSON, body) and
# returns a *Promise* that resolves to a JSON string containing the
# response status, body text, and headers.
#
# Using async fetch() + run_sync (JSPI) is the ONLY cross-origin HTTP
# mechanism that works in JupyterLite Web Workers with COEP headers.
# Synchronous XHR is blocked by COEP for cross-origin requests.
# ---------------------------------------------------------------------------
_FETCH_JS = """\
(async function(url, method, headersJSON, body) {
    try {
        var headers = JSON.parse(headersJSON);
        var options = {
            method: method,
            headers: headers,
            mode: "cors",
            credentials: "omit",
            cache: "no-store",
        };
        if (body !== null && body !== "") {
            options.body = body;
        }
        var response = await fetch(url, options);
        var text = await response.text();
        var respHeaders = {};
        response.headers.forEach(function(value, key) {
            respHeaders[key] = value;
        });
        return JSON.stringify({
            status: response.status,
            body: text,
            headers: respHeaders
        });
    } catch (err) {
        return JSON.stringify({
            status: 0,
            body: "JS fetch error: " + err.name + ": " + err.message,
            headers: {}
        });
    }
})
"""


def make_pyodide_http_client() -> httpx.Client:
    """Return an ``httpx.Client`` whose transport uses the browser ``fetch()``
    API via ``run_sync`` (JSPI).  Works for cross-origin requests even when
    COEP is active.

    Must only be called when ``sys.platform == "emscripten"``.
    """
    import httpx as _httpx  # lazy import – only available inside Pyodide

    return _httpx.Client(transport=_PyodideFetchTransport())


class _PyodideFetchTransport:
    """httpx transport: async ``fetch()`` in JS, bridged to sync via JSPI."""

    def __init__(self) -> None:
        self._fetch_fn: Any = None  # cached JS async function

    def _get_fetch_fn(self) -> Any:
        """Lazily compile and cache the JS async fetch function."""
        if self._fetch_fn is None:
            from pyodide.code import run_js  # type: ignore[import-not-found]

            self._fetch_fn = run_js(_FETCH_JS)
        return self._fetch_fn

    def handle_request(self, request: Any) -> Any:
        """Handle a single httpx Request and return an httpx Response."""
        import httpx as _httpx  # lazy import

        url = str(request.url)
        method = request.method

        # Build plain-dict headers — only pass whitelisted names to avoid
        # CORS preflight failures from unsupported custom headers.
        headers: dict[str, str] = {}
        for raw_name, raw_value in request.headers.raw:
            key = raw_name.decode("latin-1")
            if key.lower() in _ALLOWED_HEADERS:
                headers[key] = raw_value.decode("latin-1")

        # Build body string for non-GET/HEAD
        body: str | None = None
        if method not in ("GET", "HEAD") and request.content:
            raw = request.content
            body = raw.decode("utf-8") if isinstance(raw, bytes) else raw

        try:
            status, resp_body, resp_headers = self._do_request(
                url, method, headers, body
            )
        except Exception as exc:
            raise _httpx.ConnectError(str(exc)) from exc

        return _httpx.Response(
            status_code=status,
            headers=resp_headers,
            content=resp_body,
        )

    def _do_request(
        self,
        url: str,
        method: str,
        headers: dict[str, str],
        body: str | None,
    ) -> tuple[int, bytes, dict[str, str]]:
        """Execute async fetch() in JS, wait via run_sync (JSPI)."""
        from pyodide.ffi import run_sync  # type: ignore[import-not-found]

        fetch_fn = self._get_fetch_fn()
        headers_json = json.dumps(headers)

        # fetch_fn() returns a JS Promise → run_sync suspends Wasm stack
        # until the Promise resolves (same mechanism as top-level await).
        promise = fetch_fn(url, method, headers_json, body or "")
        result_raw = run_sync(promise)

        result = json.loads(str(result_raw))

        status: int = int(result["status"])
        resp_body: bytes = result["body"].encode("utf-8")

        resp_headers: dict[str, str] = result.get("headers", {})
        if isinstance(resp_headers, str):
            # Shouldn't happen with current JS, but be safe
            resp_headers = json.loads(resp_headers)

        if status == 0:
            raise RuntimeError(
                f"fetch() returned status 0 for {method} {url} "
                "– likely a CORS or network error"
            )

        return status, resp_body, resp_headers

