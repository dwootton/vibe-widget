"""Platform detection utilities for Vibe Widget."""

from __future__ import annotations

import sys


def is_emscripten() -> bool:
    """Return True when running under Pyodide / JupyterLite (WASM).

    In this environment ``threading.Thread.start()`` always raises
    ``RuntimeError: can't start new thread``, so callers should fall back
    to synchronous execution.
    """
    return sys.platform == "emscripten"
