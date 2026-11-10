"""A study budget that survives kernel restarts.

Core ``vibe_widget.budget`` keeps a per-process spend total. A study needs the
total across every session a participant runs, so this keeps a small ledger
file next to the traces (``spend.json``) and feeds earlier sessions' spend back
into the core ledger as a baseline.

The ledger is written whether or not the participant consented to the
``usage`` stream: it is local, and it is what keeps the budget honest.
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from vibe_widget.budget import ledger

SPEND_FILE = "spend.json"


def validate_budget(budget_usd: Any) -> None:
    """Raise ValueError unless ``budget_usd`` is None or a positive number of dollars."""
    if budget_usd is None:
        return
    if isinstance(budget_usd, bool) or not isinstance(budget_usd, (int, float)) or budget_usd <= 0:
        raise ValueError("budget_usd must be a positive number of dollars or None")


def _read(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _write(path: Path, data: dict[str, Any]) -> None:
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


class StudyBudget:
    """Persist this session's spend and enforce the study's budget across sessions."""

    def __init__(self, trace_dir: Path, session_id: str, budget_usd: float | None = None):
        self.path = Path(trace_dir) / SPEND_FILE
        self.session_id = session_id
        self._lock = threading.Lock()
        saved = _read(self.path)
        self.budget_usd = budget_usd if budget_usd is not None else saved.get("budget_usd")
        self._session_start_usd = ledger.spent_usd  # spend before the study started is not counted
        self._previous_limit = ledger.limit_usd

    def earlier_sessions_usd(self) -> float:
        sessions = _read(self.path).get("sessions") or {}
        return float(
            sum(v for k, v in sessions.items() if k != self.session_id and isinstance(v, (int, float)))
        )

    def session_usd(self) -> float:
        return max(0.0, ledger.spent_usd - self._session_start_usd)

    def attach(self) -> None:
        """Apply the budget to the core ledger and start persisting spend."""
        ledger.set_baseline(self.earlier_sessions_usd() - self._session_start_usd)
        if self.budget_usd is not None:
            ledger.set_limit(self.budget_usd)
        ledger.add_listener(self._on_request)
        self._save()

    def detach(self) -> None:
        """Stop persisting and restore the limit that was in place before the study."""
        ledger.remove_listener(self._on_request)
        self._save()
        ledger.set_baseline(0.0)
        if self.budget_usd is not None:
            ledger.set_limit(self._previous_limit)

    def _on_request(self, record: dict[str, Any]) -> None:
        self._save()

    def _save(self) -> None:
        with self._lock:
            data = _read(self.path)
            sessions = data.get("sessions") or {}
            sessions[self.session_id] = round(self.session_usd(), 6)
            data["sessions"] = sessions
            data["budget_usd"] = self.budget_usd
            data["total_usd"] = round(sum(v for v in sessions.values() if isinstance(v, (int, float))), 6)
            data["updated"] = datetime.now(timezone.utc).isoformat()
            try:
                self.path.parent.mkdir(parents=True, exist_ok=True)
                _write(self.path, data)
            except OSError:
                pass

    def status(self) -> dict[str, Any]:
        total = self.earlier_sessions_usd() + self.session_usd()
        return {
            "budget_usd": self.budget_usd,
            "spent_usd": round(total, 6),
            "remaining_usd": (
                round(max(0.0, self.budget_usd - total), 6) if self.budget_usd is not None else None
            ),
            "this_session_usd": round(self.session_usd(), 6),
            "unpriced_requests": ledger.unpriced_requests,
            "ledger": str(self.path),
        }
