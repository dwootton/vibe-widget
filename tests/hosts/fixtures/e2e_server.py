"""Test-only helper process for the host-bridge browser E2E suite
(``ui-tests/host-e2e/*.test.mjs``).

Not part of the shipped package: builds one fake-provider session, serves it
over :class:`~vibe_widget.hosts.server.LocalHostServer`, and additionally
exposes a tiny read-only debug HTTP endpoint (``/output``) so a Node/
Playwright test can observe a Python-side output value that a real R host
would read via ``session_api``/reticulate rather than HTTP - this endpoint
exists purely so the *browser-driven* half of the round trip has something
independent to assert against without spawning a second language runtime.

Prints one JSON line to stdout once ready: ``{"page_url", "debug_url"}``.
Runs until killed (SIGTERM/SIGINT), so the driving test is responsible for
terminating the subprocess.
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

os.environ.setdefault("VIBE_PROVIDER", "fake")
os.environ.setdefault("VIBE_DISABLE_BUNDLING", "1")

import pandas as pd  # noqa: E402

from vibe_widget.hosts import session_api as api  # noqa: E402
from vibe_widget.hosts.server import LocalHostServer  # noqa: E402


def main() -> None:
    df = pd.DataFrame({"x": [1, 2, 3], "y": [4, 5, 6]})
    session = api.create_session(
        "scatter of x vs y",
        df,
        outputs={"selection": "selected rows"},
        cache=False,
        wait=True,
        wait_timeout=20,
    )

    server = LocalHostServer()
    server.register(session.bridge, session_id=session.id)

    class DebugHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 - stdlib naming
            if self.path == "/output":
                body = json.dumps(session.get_output("selection"), default=str).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            else:
                self.send_response(404)
                self.end_headers()

        def log_message(self, *args) -> None:  # silence stdlib access logging
            pass

    debug_server = ThreadingHTTPServer(("127.0.0.1", 0), DebugHandler)
    debug_port = debug_server.server_address[1]
    threading.Thread(target=debug_server.serve_forever, daemon=True).start()

    print(json.dumps({
        "page_url": server.page_url(session.id),
        "debug_url": f"http://127.0.0.1:{debug_port}/output",
        "status": session.status(),
    }), flush=True)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    sys.exit(main())
