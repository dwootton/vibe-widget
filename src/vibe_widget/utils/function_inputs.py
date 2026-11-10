"""Python functions passed as widget inputs.

A function given in ``vw.inputs(...)`` is not shipped to the browser. The widget sees a
JSON descriptor (name, signature, docstring) under the input's name and calls the function
with ``await model.call("<input_name>", ...args)``. The call travels as a custom comm
message, runs in the kernel, and the JSON-cleaned return value is sent back.
"""

from __future__ import annotations

import functools
import inspect
from typing import Any, Callable

from vibe_widget.utils.logging import get_logger
from vibe_widget.utils.serialization import clean_for_json

logger = get_logger(__name__)

# Prompt summaries of function inputs start with this marker so the prompt builder can
# list them under FUNCTIONS instead of INPUTS.
FUNCTION_SUMMARY_PREFIX = "Python function "

CALL_MESSAGE = "call_function"
RESULT_MESSAGE = "function_result"

_MAX_DOC_CHARS = 400


def is_function_input(value: Any) -> bool:
    """Return True for plain functions, methods, builtins, and functools.partial objects.

    Callable objects in general are excluded on purpose: export handles and widgets are
    callable too, and they are linked as traits rather than invoked.
    """
    return inspect.isroutine(value) or isinstance(value, functools.partial)


def _target(fn: Callable[..., Any]) -> Callable[..., Any]:
    return fn.func if isinstance(fn, functools.partial) else fn


def function_signature(fn: Callable[..., Any]) -> str:
    """Return ``name(params)`` for display; falls back to ``name(...)``."""
    target = _target(fn)
    name = getattr(target, "__name__", None) or type(target).__name__
    try:
        params = str(inspect.signature(fn))
    except (TypeError, ValueError):
        params = "(...)"
    return f"{name}{params}"


def function_doc(fn: Callable[..., Any]) -> str:
    """Return the first paragraph of the docstring, trimmed for the prompt."""
    doc = inspect.getdoc(_target(fn)) or ""
    first = doc.split("\n\n", 1)[0].replace("\n", " ").strip()
    if len(first) > _MAX_DOC_CHARS:
        first = first[: _MAX_DOC_CHARS - 1].rstrip() + "…"
    return first


def function_descriptor(name: str, fn: Callable[..., Any]) -> dict[str, Any]:
    """JSON-safe stand-in synced to the widget in place of the function."""
    return {
        "__vibe_function__": True,
        "name": name,
        "signature": function_signature(fn),
        "doc": function_doc(fn),
    }


def function_summary(fn: Callable[..., Any]) -> str:
    """Prompt summary for a function input."""
    summary = FUNCTION_SUMMARY_PREFIX + function_signature(fn)
    doc = function_doc(fn)
    return f"{summary} — {doc}" if doc else summary


def is_function_summary(summary: Any) -> bool:
    return isinstance(summary, str) and summary.startswith(FUNCTION_SUMMARY_PREFIX)


def run_function_call(functions: dict[str, Callable[..., Any]], content: dict[str, Any]) -> dict[str, Any]:
    """Execute a ``call_function`` message and build the reply message.

    Only functions registered as inputs of this widget can be called. The function's own
    exception text is returned to the widget so it can show it; nothing else leaks.
    """
    call_id = content.get("call_id")
    name = content.get("name")
    reply: dict[str, Any] = {"type": RESULT_MESSAGE, "call_id": call_id, "name": name}
    fn = functions.get(name) if isinstance(name, str) else None
    if fn is None:
        reply.update(ok=False, error=f"'{name}' is not a function input of this widget")
        return reply

    args = content.get("args") or []
    kwargs = content.get("kwargs") or {}
    if not isinstance(args, list) or not isinstance(kwargs, dict):
        reply.update(ok=False, error="call arguments must be a list and keyword arguments an object")
        return reply

    try:
        result = fn(*args, **kwargs)
    except Exception as exc:  # the widget shows this to the user
        logger.warning("Function input '%s' raised: %s", name, exc)
        reply.update(ok=False, error=f"{type(exc).__name__}: {exc}")
        return reply

    try:
        reply.update(ok=True, result=clean_for_json(result))
    except Exception as exc:
        reply.update(ok=False, error=f"result of '{name}' is not JSON-serializable: {exc}")
    return reply
