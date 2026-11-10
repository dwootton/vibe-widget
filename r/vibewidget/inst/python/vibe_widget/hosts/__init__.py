"""Non-Jupyter hosting for VibeWidget: drive a headless widget from any
process (an R session via reticulate, a plain script, a test) with no
Jupyter comm anywhere in the stack.

Public surface: :mod:`vibe_widget.hosts.session_api`. Everything else
(:mod:`bridge`, :mod:`server`, :mod:`static`, :mod:`protocol`) is an
implementation detail those functions assemble.
"""

from vibe_widget.hosts.session_api import (
    HostApiError,
    Session,
    create_session,
    describe_data,
    edit_session,
    engine_version,
    load_session,
)

__all__ = [
    "HostApiError",
    "Session",
    "create_session",
    "describe_data",
    "edit_session",
    "engine_version",
    "load_session",
]
