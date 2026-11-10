"""Hard spend caps: one OpenRouter API key per participant, with a credit limit.

``vw.config(budget_usd=...)`` is a client-side guard a participant could lift.
A key with a credit limit is enforced by OpenRouter itself: once it is spent,
requests fail (HTTP 402/403) and Vibe Widget tells the participant to ask the
researcher. Use both: the key is the cap, the budget gives an early warning.

Researcher side (needs an OpenRouter *management* key, created in the
OpenRouter dashboard; it can only manage keys, not make requests)::

    from vibe_widget_study import keys
    k = keys.create_participant_key(MGMT_KEY, "P07 - cohort study", limit_usd=5)
    k["key"]     # send this to the participant, once
    k["hash"]    # keep this to check usage or revoke it
    keys.get_key(MGMT_KEY, k["hash"])         # usage, limit, limit_remaining
    keys.disable_key(MGMT_KEY, k["hash"])     # revoke

Participant side::

    keys.key_status(api_key)                  # what this key has left
"""

from __future__ import annotations

from typing import Any

import requests

OPENROUTER_API = "https://openrouter.ai/api/v1"
TIMEOUT = 30


class KeyManagementError(RuntimeError):
    """An OpenRouter key-management call failed."""


def _check(response: requests.Response) -> dict[str, Any]:
    try:
        body = response.json()
    except ValueError:
        body = {}
    if response.status_code >= 400:
        error = body.get("error") if isinstance(body, dict) else None
        message = error.get("message") if isinstance(error, dict) else None
        raise KeyManagementError(f"OpenRouter returned HTTP {response.status_code}: {message or 'no detail'}")
    return body if isinstance(body, dict) else {}


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def create_participant_key(
    management_key: str,
    name: str,
    limit_usd: float,
    *,
    limit_reset: str | None = None,
) -> dict[str, Any]:
    """Create an API key that stops working after ``limit_usd`` of spend.

    Args:
        management_key: An OpenRouter management key (dashboard → Management keys).
        name: Label shown in the OpenRouter dashboard, e.g. a participant id.
        limit_usd: Credit limit in dollars (OpenRouter credits are dollars).
        limit_reset: Optional reset period such as ``"daily"``, ``"weekly"``, ``"monthly"``.

    Returns:
        ``{"key": <secret, shown only once>, "hash": <id for later calls>, "name", "limit_usd"}``.
    """
    if isinstance(limit_usd, bool) or not isinstance(limit_usd, (int, float)) or limit_usd <= 0:
        raise ValueError("limit_usd must be a positive number of dollars")
    payload: dict[str, Any] = {"name": name, "limit": float(limit_usd)}
    if limit_reset:
        payload["limit_reset"] = limit_reset
    body = _check(
        requests.post(
            f"{OPENROUTER_API}/keys", headers=_headers(management_key), json=payload, timeout=TIMEOUT
        )
    )
    data = body.get("data") or {}
    secret = body.get("key") or data.get("key")
    if not secret:
        raise KeyManagementError("OpenRouter created the key but returned no key string")
    return {
        "key": secret,
        "hash": data.get("hash"),
        "name": data.get("name", name),
        "limit_usd": data.get("limit", float(limit_usd)),
    }


def get_key(management_key: str, key_hash: str) -> dict[str, Any]:
    """Usage and limits for one participant key (``usage``, ``limit``, ``limit_remaining``...)."""
    body = _check(
        requests.get(f"{OPENROUTER_API}/keys/{key_hash}", headers=_headers(management_key), timeout=TIMEOUT)
    )
    return body.get("data") or {}


def set_key_limit(management_key: str, key_hash: str, limit_usd: float) -> dict[str, Any]:
    """Raise or lower a participant key's credit limit."""
    if isinstance(limit_usd, bool) or not isinstance(limit_usd, (int, float)) or limit_usd <= 0:
        raise ValueError("limit_usd must be a positive number of dollars")
    body = _check(
        requests.patch(
            f"{OPENROUTER_API}/keys/{key_hash}",
            headers=_headers(management_key),
            json={"limit": float(limit_usd)},
            timeout=TIMEOUT,
        )
    )
    return body.get("data") or {}


def disable_key(management_key: str, key_hash: str, disabled: bool = True) -> dict[str, Any]:
    """Revoke (or with ``disabled=False``, restore) a participant key."""
    body = _check(
        requests.patch(
            f"{OPENROUTER_API}/keys/{key_hash}",
            headers=_headers(management_key),
            json={"disabled": bool(disabled)},
            timeout=TIMEOUT,
        )
    )
    return body.get("data") or {}


def key_status(api_key: str) -> dict[str, Any]:
    """What the key in use has spent and has left (participant side).

    Returns:
        ``{"usage_usd", "limit_usd", "remaining_usd"}``; limit and remaining are
        ``None`` for a key with no limit.
    """
    data = _check(requests.get(f"{OPENROUTER_API}/key", headers=_headers(api_key), timeout=TIMEOUT)).get(
        "data"
    ) or {}
    return {
        "usage_usd": data.get("usage"),
        "limit_usd": data.get("limit"),
        "remaining_usd": data.get("limit_remaining"),
    }
