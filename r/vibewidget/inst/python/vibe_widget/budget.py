"""LLM spend tracking and an optional budget guard.

Every provider request reports its cost here. OpenRouter includes the cost of
each request in ``usage.cost`` (credits, which are US dollars). Hosts that do
not report a cost are counted as *unpriced* requests, so their spend is unknown.

With a budget set (``vw.config(budget_usd=5)``), a request that would start
after the budget is spent raises :class:`BudgetExceeded` instead. The check runs
before each request, so the last one in flight can go slightly past the limit.

This is a client-side guard: someone who can edit the notebook can lift it. A
study researcher who needs a hard cap should also give each participant an API
key with a credit limit (see ``vibe_widget_study.keys``).
"""

from __future__ import annotations

import threading
import warnings
from typing import Any, Callable

from vibe_widget import tracing
from vibe_widget.llm.providers.base import ProviderError

WARN_FRACTION = 0.8


def _usd(amount: float) -> str:
    """Dollars with cents, or more places for amounts under a cent."""
    return f"${amount:.2f}" if amount >= 0.01 or amount == 0 else f"${amount:.4f}"


class BudgetExceeded(ProviderError):
    """The configured LLM spend budget is used up."""

    def __init__(self, spent_usd: float, limit_usd: float) -> None:
        super().__init__(
            f"The LLM budget of {_usd(limit_usd)} is used up ({_usd(spent_usd)} spent). "
            "Raise it with vw.config(budget_usd=...), or ask the researcher running "
            "your study to raise it.",
            "budget",
        )
        self.spent_usd = spent_usd
        self.limit_usd = limit_usd


def cost_from_usage(usage: Any) -> float | None:
    """Return the dollar cost an API response reported, if it reported one."""
    if usage is None:
        return None
    cost = getattr(usage, "cost", None)
    if cost is None:
        extra = getattr(usage, "model_extra", None) or {}
        cost = extra.get("cost") if isinstance(extra, dict) else None
    if cost is None and isinstance(usage, dict):
        cost = usage.get("cost")
    try:
        return float(cost) if cost is not None else None
    except (TypeError, ValueError):
        return None


class SpendLedger:
    """Process-wide running total of LLM spend, with an optional limit."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.limit_usd: float | None = None
        self.baseline_usd = 0.0  # spend carried over from earlier sessions
        self.spent_usd = 0.0  # spend in this process
        self.requests = 0
        self.unpriced_requests = 0
        self._warned_near = False
        self._warned_unpriced = False
        self._listeners: list[Callable[[dict[str, Any]], None]] = []

    @property
    def total_usd(self) -> float:
        return max(0.0, self.baseline_usd + self.spent_usd)

    def set_limit(self, limit_usd: float | None) -> None:
        """Set (or with ``None``, clear) the budget in US dollars."""
        if limit_usd is not None:
            if isinstance(limit_usd, bool) or not isinstance(limit_usd, (int, float)):
                raise ValueError("budget_usd must be a positive number of dollars or None")
            if limit_usd <= 0:
                raise ValueError("budget_usd must be a positive number of dollars or None")
        with self._lock:
            self.limit_usd = float(limit_usd) if limit_usd is not None else None
            self._warned_near = False

    def set_baseline(self, offset_usd: float) -> None:
        """Shift the total by ``offset_usd``: spend from earlier sessions (a study's saved
        ledger), minus any spend in this process that should not count."""
        with self._lock:
            self.baseline_usd = float(offset_usd)

    def add_listener(self, listener: Callable[[dict[str, Any]], None]) -> None:
        """Call ``listener(record)`` after every recorded request."""
        self._listeners.append(listener)

    def remove_listener(self, listener: Callable[[dict[str, Any]], None]) -> None:
        if listener in self._listeners:
            self._listeners.remove(listener)

    def check(self) -> None:
        """Raise :class:`BudgetExceeded` if the budget is already spent."""
        with self._lock:
            limit, total = self.limit_usd, self.total_usd
        if limit is not None and total >= limit:
            raise BudgetExceeded(total, limit)

    def record(
        self,
        *,
        model: str,
        host: str,
        cost_usd: float | None,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
    ) -> dict[str, Any]:
        """Add one finished request to the total and announce it."""
        with self._lock:
            self.requests += 1
            if cost_usd is None:
                self.unpriced_requests += 1
            else:
                self.spent_usd += max(0.0, cost_usd)
            limit, total = self.limit_usd, self.total_usd
            warn_near = (
                limit is not None
                and not self._warned_near
                and total >= WARN_FRACTION * limit
                and total < limit
            )
            if warn_near:
                self._warned_near = True
            warn_unpriced = cost_usd is None and limit is not None and not self._warned_unpriced
            if warn_unpriced:
                self._warned_unpriced = True

        if warn_near:
            warnings.warn(
                f"LLM spend is {_usd(total)} of the {_usd(limit)} budget.", stacklevel=3
            )
        if warn_unpriced:
            warnings.warn(
                f"{host} did not report a cost for {model}, so requests to it do not count "
                "toward budget_usd. Use OpenRouter for an enforced budget.",
                stacklevel=3,
            )

        record = {
            "model": model,
            "host": host,
            "cost_usd": cost_usd,
            "prompt_tokens": int(prompt_tokens or 0),
            "completion_tokens": int(completion_tokens or 0),
            "total_usd": round(total, 6),
            "limit_usd": limit,
        }
        tracing.emit("usage.request", payload=record)
        for listener in list(self._listeners):
            try:
                listener(record)
            except Exception:  # noqa: BLE001 - a listener never breaks a request
                pass
        return record

    def status(self) -> dict[str, Any]:
        """Spend so far, the limit, and what remains."""
        with self._lock:
            total = self.total_usd
            return {
                "spent_usd": round(total, 6),
                "spent_this_session_usd": round(self.spent_usd, 6),
                "limit_usd": self.limit_usd,
                "remaining_usd": (
                    round(max(0.0, self.limit_usd - total), 6)
                    if self.limit_usd is not None
                    else None
                ),
                "requests": self.requests,
                "unpriced_requests": self.unpriced_requests,
            }


ledger = SpendLedger()
"""The process-wide ledger every provider reports to."""


def spend() -> dict[str, Any]:
    """LLM spend for this session (plus any carried-over study spend) and the budget.

    Example:
        >>> vw.config(budget_usd=2)
        >>> vw.spend()
        {'spent_usd': 0.0041, 'limit_usd': 2.0, 'remaining_usd': 1.9959, ...}
    """
    return ledger.status()
