"""Audit services for Vibe Widgets."""

from __future__ import annotations

from typing import Any

from vibe_widget.llm.providers.base import LLMProvider
from vibe_widget.utils.audit_store import (
    AuditStore,
    compute_code_hash,
    compute_line_hashes,
    format_audit_yaml,
    normalize_location,
    render_numbered_code,
    strip_internal_fields,
)
from vibe_widget.utils.serialization import clean_for_json


class AuditService:
    """Generate and persist audit reports."""

    def __init__(self, store: AuditStore | None = None):
        self.store = store or AuditStore()

    def _parse_audit_json(self, raw_text: str) -> dict[str, Any]:
        try:
            import json

            return json.loads(raw_text)
        except Exception:
            start = raw_text.find("{")
            end = raw_text.rfind("}")
            if start != -1 and end != -1 and end > start:
                import json

                return json.loads(raw_text[start : end + 1])
            raise

    def _normalize_audit_report(
        self,
        report: dict[str, Any],
        level: str,
        widget_description: str,
    ) -> dict[str, Any]:
        root_key = "fast_audit" if level == "fast" else "full_audit"
        alt_key = "full_audit" if root_key == "fast_audit" else "fast_audit"
        if root_key in report:
            payload = report.get(root_key)
        elif alt_key in report:
            payload = report.get(alt_key)
        else:
            payload = report
        if not isinstance(payload, dict):
            payload = {}
        payload.setdefault("version", "1.0")
        payload.setdefault("widget_description", widget_description)

        raw_concerns = payload.get("concerns", [])
        if not isinstance(raw_concerns, list):
            raw_concerns = []

        normalized_concerns: list[dict[str, Any]] = []
        for concern in raw_concerns:
            if not isinstance(concern, dict):
                continue
            location = normalize_location(concern.get("location", "global"))
            impact = str(concern.get("impact", "low")).lower()
            if level == "full" and impact not in {"high", "medium", "low"}:
                impact = "medium"
            if level == "fast" and impact not in {"high", "medium", "low"}:
                impact = "low"

            alternatives = concern.get("alternatives", [])
            if not isinstance(alternatives, list):
                alternatives = []
            if level == "full":
                normalized_alts = []
                for item in alternatives:
                    if isinstance(item, dict):
                        normalized_alts.append(
                            {
                                "option": str(item.get("option", "")).strip(),
                                "when_better": str(item.get("when_better", "")).strip(),
                                "when_worse": str(item.get("when_worse", "")).strip(),
                            }
                        )
                    else:
                        normalized_alts.append(
                            {
                                "option": str(item).strip(),
                                "when_better": "",
                                "when_worse": "",
                            }
                        )
                alternatives = normalized_alts

            normalized = {
                "id": str(concern.get("id", "")).strip() or "concern.unknown",
                "location": location,
                "summary": str(concern.get("summary", "")).strip(),
                "details": str(concern.get("details", "")).strip(),
                "technical_summary": str(concern.get("technical_summary", "")).strip(),
                "impact": impact,
                "default": bool(concern.get("default", False)),
                "alternatives": alternatives,
            }
            if level == "full":
                lenses = concern.get("lenses", {})
                if not isinstance(lenses, dict):
                    lenses = {}
                normalized["rationale"] = str(concern.get("rationale", "")).strip()
                normalized["lenses"] = {
                    "impact": str(lenses.get("impact", "medium")).lower(),
                    "uncertainty": str(lenses.get("uncertainty", "")).strip(),
                    "reproducibility": str(lenses.get("reproducibility", "")).strip(),
                    "edge_behavior": str(lenses.get("edge_behavior", "")).strip(),
                    "default_vs_explicit": str(lenses.get("default_vs_explicit", "")).strip(),
                    "appropriateness": str(lenses.get("appropriateness", "")).strip(),
                    "safety": str(lenses.get("safety", "")).strip(),
                }
            normalized_concerns.append(normalized)

        payload["concerns"] = normalized_concerns
        open_questions = payload.get("open_questions", [])
        if not isinstance(open_questions, list):
            open_questions = []
        payload["open_questions"] = [str(q).strip() for q in open_questions if str(q).strip()]
        safety = payload.get("safety", {})
        if not isinstance(safety, dict):
            safety = {}
        checks = safety.get("checks", {})
        if not isinstance(checks, dict):
            checks = {}

        def _normalize_check(key: str) -> dict[str, str]:
            raw = checks.get(key, {})
            if not isinstance(raw, dict):
                raw = {}
            status = str(raw.get("status", "unknown")).lower()
            if status not in {"yes", "no", "unknown"}:
                status = "unknown"
            return {
                "status": status,
                "evidence": str(raw.get("evidence", "")).strip(),
                "notes": str(raw.get("notes", "")).strip(),
            }

        normalized_checks = {
            "external_network_usage": _normalize_check("external_network_usage"),
            "dynamic_code_execution": _normalize_check("dynamic_code_execution"),
            "storage_writes": _normalize_check("storage_writes"),
            "cross_origin_fetch": _normalize_check("cross_origin_fetch"),
            "iframe_script_injection": _normalize_check("iframe_script_injection"),
        }
        risk_level = str(safety.get("risk_level", "unknown")).lower()
        if risk_level not in {"low", "medium", "high", "unknown"}:
            risk_level = "unknown"
        caveats = safety.get("caveats", [])
        if not isinstance(caveats, list):
            caveats = []
        payload["safety"] = {
            "checks": normalized_checks,
            "risk_level": risk_level,
            "caveats": [str(c).strip() for c in caveats if str(c).strip()],
        }
        return {root_key: payload}

    def run_audit(
        self,
        *,
        code: str,
        level: str,
        reuse: bool,
        widget_metadata: dict[str, Any],
        widget_description: str,
        data_info: dict[str, Any],
        provider: LLMProvider,
    ) -> dict[str, Any]:
        if not code:
            raise ValueError("No widget code available to audit.")
        level = level.lower()
        if level not in {"fast", "full"}:
            raise ValueError("Audit level must be 'fast' or 'full'.")

        store = self.store
        current_code_hash = compute_code_hash(code)
        current_line_hashes = compute_line_hashes(code)

        previous_audit = None
        if reuse and widget_metadata.get("cache_key"):
            previous_audit = store.load_latest_audit(widget_metadata["cache_key"], level)
        if not previous_audit and reuse and widget_metadata.get("base_widget_id"):
            previous_audit = store.load_latest_audit(widget_metadata["base_widget_id"], level)

        reused_concerns: list[dict[str, Any]] = []
        stale_concerns: list[dict[str, Any]] = []
        previous_questions: list[str] = []
        changed_lines: list[int] | None = None

        if reuse and previous_audit:
            prev_report = previous_audit.get("report", {})
            root_key = "fast_audit" if level == "fast" else "full_audit"
            prev_payload = prev_report.get(root_key, {})
            prev_concerns = prev_payload.get("concerns", []) if isinstance(prev_payload, dict) else []
            prev_line_hashes = previous_audit.get("line_hashes", {})
            prev_code_hash = previous_audit.get("code_hash")
            previous_questions = prev_payload.get("open_questions", []) if isinstance(prev_payload, dict) else []
            if not isinstance(previous_questions, list):
                previous_questions = []

            for concern in prev_concerns:
                if not isinstance(concern, dict):
                    continue
                location = normalize_location(concern.get("location", "global"))
                if location == "global":
                    if prev_code_hash == current_code_hash:
                        reused_concerns.append(concern)
                    else:
                        stale_concerns.append(concern)
                    continue
                line_hashes = concern.get("line_hashes", [])
                if not isinstance(line_hashes, list) or not line_hashes or len(line_hashes) != len(location):
                    stale_concerns.append(concern)
                    continue
                current_matches = []
                for line_num, expected_hash in zip(location, line_hashes):
                    current_matches.append(current_line_hashes.get(int(line_num)) == expected_hash)
                if all(current_matches):
                    reused_concerns.append(concern)
                else:
                    stale_concerns.append(concern)

            if not stale_concerns and prev_code_hash == current_code_hash:
                report_public = strip_internal_fields(prev_report)
                return {
                    "level": level,
                    "report": report_public,
                    "report_yaml": previous_audit.get("report_yaml", ""),
                    "saved_path": str(
                        (store.audits_dir / previous_audit["entry"]["yaml_file_name"]).resolve()
                    ),
                    "audit_id": previous_audit["entry"]["audit_id"],
                    "reused_count": len(reused_concerns),
                    "updated_count": 0,
                }

            prev_line_hashes_int = (
                {int(k): v for k, v in prev_line_hashes.items()}
                if isinstance(prev_line_hashes, dict)
                else {}
            )
            max_line = max(
                max(prev_line_hashes_int.keys(), default=0),
                max(current_line_hashes.keys(), default=0),
            )
            changed = []
            for line_num in range(1, max_line + 1):
                if prev_line_hashes_int.get(line_num) != current_line_hashes.get(line_num):
                    changed.append(line_num)
            changed_lines = changed or None

        numbered_code = render_numbered_code(code)
        raw_report = provider.generate_audit_report(
            code=numbered_code,
            description=widget_description,
            data_info=clean_for_json(data_info),
            level=level,
            changed_lines=changed_lines,
        )
        parsed = self._parse_audit_json(raw_report)
        normalized_report = self._normalize_audit_report(parsed, level, widget_description)

        root_key = "fast_audit" if level == "fast" else "full_audit"
        payload = normalized_report[root_key]
        new_concerns = payload.get("concerns", [])
        filtered_concerns: list[dict[str, Any]] = []
        for concern in new_concerns:
            location = normalize_location(concern.get("location", "global"))
            concern["location"] = location
            if changed_lines and location != "global":
                if not any(line in changed_lines for line in location):
                    continue
            if location != "global":
                concern["line_hashes"] = [current_line_hashes.get(int(line)) for line in location]
            filtered_concerns.append(concern)

        merged_concerns = reused_concerns[:]
        existing_ids = {c.get("id") for c in merged_concerns if isinstance(c, dict)}
        for concern in filtered_concerns:
            if concern.get("id") in existing_ids:
                continue
            merged_concerns.append(concern)

        new_questions = payload.get("open_questions", [])
        if not isinstance(new_questions, list):
            new_questions = []
        merged_questions = list(dict.fromkeys([*previous_questions, *new_questions]))
        payload["concerns"] = merged_concerns
        payload["open_questions"] = merged_questions
        normalized_report[root_key] = payload

        report_public = strip_internal_fields(normalized_report)
        report_yaml = format_audit_yaml(report_public)

        saved = store.save_audit(
            level=level,
            widget_metadata=widget_metadata,
            report=normalized_report,
            report_yaml=report_yaml,
            code_hash=current_code_hash,
            line_hashes=current_line_hashes,
            reused_concerns=[c.get("id") for c in reused_concerns if isinstance(c, dict)],
            updated_concerns=[c.get("id") for c in filtered_concerns if isinstance(c, dict)],
            source_widget_id=widget_metadata.get("base_widget_id"),
        )

        return {
            "level": level,
            "report": report_public,
            "report_yaml": report_yaml,
            "saved_path": str((store.audits_dir / saved["entry"]["yaml_file_name"]).resolve()),
            "audit_id": saved["entry"]["audit_id"],
            "reused_count": len(reused_concerns),
            "updated_count": len(filtered_concerns),
        }
