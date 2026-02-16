"""Platform detection utilities for Vibe Widget."""

from __future__ import annotations

import os
import sys

_colab_cache: bool | None = None


def is_emscripten() -> bool:
    """Return True when running under Pyodide / JupyterLite (WASM).

    In this environment ``threading.Thread.start()`` always raises
    ``RuntimeError: can't start new thread``, so callers should fall back
    to synchronous execution.
    """
    return sys.platform == "emscripten"


def is_colab() -> bool:
    """Return True when running inside Google Colab.

    Colab is real CPython on Linux, but threading can cause issues with
    widget comm synchronisation (traitlet updates from background threads
    are unreliable).  Callers that need reliable widget updates should
    fall back to synchronous execution, similar to emscripten.
    """
    global _colab_cache  # noqa: PLW0603
    if _colab_cache is not None:
        return _colab_cache

    if (
        os.environ.get("COLAB_RELEASE_TAG")
        or os.environ.get("COLAB_BACKEND_VERSION")
        or os.environ.get("COLAB_GPU")
    ):
        _colab_cache = True
        return True
    try:
        import google.colab  # noqa: F401

        _colab_cache = True
        return True
    except Exception:
        _colab_cache = False
        return False


def is_restricted_env() -> bool:
    """Return True for environments where threaded generation is unreliable.

    Currently: Pyodide/emscripten (threads unavailable) and Google Colab
    (threads cause widget comm issues).  Callers should run generation
    synchronously when this returns True.
    """
    return is_emscripten() or is_colab()
