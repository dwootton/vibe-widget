"""
Audit storage and helper utilities.

Stores audit reports in `.vibewidget/audits` with an index for lookup and reuse.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def compute_code_hash(code: str) -> str:
    """Compute a stable hash for a full code string."""
    return hashlib.sha1(code.encode("utf-8")).hexdigest()


def compute_line_hashes(code: str) -> dict[int, str]:
    """Compute line-level hashes for reuse checks (1-based line numbers)."""
    line_hashes: dict[int, str] = {}
    for idx, line in enumerate(code.splitlines(), start=1):
        line_hashes[idx] = hashlib.sha1(line.encode("utf-8")).hexdigest()
    return line_hashes


def render_numbered_code(code: str) -> str:
    """Render code with 1-based line numbers for audit prompts."""
    lines = code.splitlines()
    width = max(3, len(str(len(lines))))
    return "\n".join(f"{str(i).rjust(width)} | {line}" for i, line in enumerate(lines, start=1))


def _yaml_scalar(value: Any, indent: int) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value)
    if "\n" in text:
        lines = text.splitlines()
        padding = " " * (indent + 2)
        return "|\n" + "\n".join(f"{padding}{line}" for line in lines)
    return json.dumps(text, ensure_ascii=True)


def _to_yaml(value: Any, indent: int = 0) -> str:
    padding = " " * indent
    if isinstance(value, dict):
        if not value:
            return f"{padding}{{}}"
        lines = []
        for key, val in value.items():
            if isinstance(val, (dict, list)):
                lines.append(f"{padding}{key}:")
                lines.append(_to_yaml(val, indent + 2))
            else:
                lines.append(f"{padding}{key}: {_yaml_scalar(val, indent)}")
        return "\n".join(lines)
    if isinstance(value, list):
        if not value:
            return f"{padding}[]"
        lines = []
        for item in value:
            if isinstance(item, (dict, list)):
                lines.append(f"{padding}-")
                lines.append(_to_yaml(item, indent + 2))
            else:
                lines.append(f"{padding}- {_yaml_scalar(item, indent)}")
        return "\n".join(lines)
    return f"{padding}{_yaml_scalar(value, indent)}"


def format_audit_yaml(report: dict[str, Any]) -> str:
    """Serialize audit dict as YAML."""
    return _to_yaml(report).strip() + "\n"


def strip_internal_fields(report: dict[str, Any]) -> dict[str, Any]:
    """Remove internal-only keys (like line_hashes) for display."""
    cleaned = json.loads(json.dumps(report))
    root_key = "fast_audit" if "fast_audit" in cleaned else "full_audit"
    concerns = cleaned.get(root_key, {}).get("concerns", [])
    for concern in concerns:
        if isinstance(concern, dict):
            concern.pop("line_hashes", None)
    return cleaned


def normalize_location(location: Any) -> str | list[int]:
    """Normalize location into 'global' or list of ints."""
    if location == "global":
        return "global"
    if isinstance(location, int):
        return [location]
    if isinstance(location, list):
        out: list[int] = []
        for item in location:
            try:
                out.append(int(item))
            except (TypeError, ValueError):
                continue
        return out
    return "global"


def safe_id(text: str) -> str:
    """Make a safe file/id segment."""
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", text).strip("_") or "audit"


class AuditStore:
    """Manages audit persistence in .vibewidget/ directory."""

    def __init__(self, store_dir: Path | None = None):
        if store_dir is None:
            store_dir = Path.cwd()
        self.store_dir = store_dir / ".vibewidget"
        self.audits_dir = self.store_dir / "audits"
        self.index_dir = self.store_dir / "index"
        self.index_file = self.index_dir / "audits.json"

        self.audits_dir.mkdir(parents=True, exist_ok=True)
        self.index_dir.mkdir(parents=True, exist_ok=True)
        self.index = self._load_index()

    def _load_index(self) -> dict[str, Any]:
        if self.index_file.exists():
            try:
                with open(self.index_file, "r", encoding="utf-8") as handle:
                    return json.load(handle)
            except (json.JSONDecodeError, OSError):
                return {"schema_version": 1, "audits": []}
        return {"schema_version": 1, "audits": []}

    def _save_index(self) -> None:
        with open(self.index_file, "w", encoding="utf-8") as handle:
            json.dump(self.index, handle, indent=2, ensure_ascii=True)

    def clear(self) -> int:
        """Remove all cached audits and reset the index."""
        removed = 0
        for entry in list(self.index.get("audits", [])):
            file_name = entry.get("file_name")
            yaml_name = entry.get("yaml_file_name")
            if file_name:
                audit_file = self.audits_dir / file_name
                if audit_file.exists():
                    audit_file.unlink()
                    removed += 1
            if yaml_name:
                yaml_file = self.audits_dir / yaml_name
                if yaml_file.exists():
                    yaml_file.unlink()
        self.index = {"schema_version": 1, "audits": []}
        self._save_index()
        return removed

    def clear_for_widget(self, *, widget_id: str | None = None, widget_slug: str | None = None) -> int:
        """Remove cached audits that match the given widget id or slug."""
        if not widget_id and not widget_slug:
            return 0
        removed = 0
        remaining = []
        for entry in self.index.get("audits", []):
            matches = False
            if widget_id and entry.get("widget_id") == widget_id:
                matches = True
            if widget_slug and entry.get("widget_slug") == widget_slug:
                matches = True
            if matches:
                file_name = entry.get("file_name")
                yaml_name = entry.get("yaml_file_name")
                if file_name:
                    audit_file = self.audits_dir / file_name
                    if audit_file.exists():
                        audit_file.unlink()
                        removed += 1
                if yaml_name:
                    yaml_file = self.audits_dir / yaml_name
                    if yaml_file.exists():
                        yaml_file.unlink()
            else:
                remaining.append(entry)
        if removed:
            self.index["audits"] = remaining
            self._save_index()
        return removed

    def load_latest_audit(self, widget_id: str, level: str) -> dict[str, Any] | None:
        entries = [
            entry for entry in self.index["audits"]
            if entry.get("widget_id") == widget_id and entry.get("level") == level
        ]
        if not entries:
            return None
        entries.sort(key=lambda e: e.get("version", 0), reverse=True)
        entry = entries[0]
        audit_file = self.audits_dir / entry["file_name"]
        if not audit_file.exists():
            return None
        with open(audit_file, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        data["entry"] = entry
        return data

    def save_audit(
        self,
        *,
        level: str,
        widget_metadata: dict[str, Any] | None,
        report: dict[str, Any],
        report_yaml: str,
        code_hash: str,
        line_hashes: dict[int, str],
        reused_concerns: list[str],
        updated_concerns: list[str],
        source_widget_id: str | None,
    ) -> dict[str, Any]:
        widget_metadata = widget_metadata or {}
        widget_id = widget_metadata.get("id") or f"unsaved-{code_hash[:8]}"
        widget_slug = widget_metadata.get("slug") or "widget"
        widget_version = widget_metadata.get("version")

        existing_versions = [
            entry["version"]
            for entry in self.index["audits"]
            if entry.get("widget_id") == widget_id and entry.get("level") == level
        ]
        version = max(existing_versions) + 1 if existing_versions else 1
        audit_id = f"{widget_id}-{level}-v{version}"

        file_stub = safe_id(f"audit__{audit_id}__{code_hash[:10]}")
        json_name = f"{file_stub}.json"
        yaml_name = f"{file_stub}.yaml"

        now = datetime.now(timezone.utc).isoformat()
        audit_payload = {
            "schema_version": 1,
            "audit_id": audit_id,
            "level": level,
            "widget_id": widget_id,
            "widget_slug": widget_slug,
            "widget_version": widget_version,
            "created_at": now,
            "code_hash": code_hash,
            "line_hashes": {str(k): v for k, v in line_hashes.items()},
            "report": report,
            "report_yaml": report_yaml,
            "reused_concerns": reused_concerns,
            "updated_concerns": updated_concerns,
            "source_widget_id": source_widget_id,
        }

        with open(self.audits_dir / json_name, "w", encoding="utf-8") as handle:
            json.dump(audit_payload, handle, indent=2, ensure_ascii=True)
        with open(self.audits_dir / yaml_name, "w", encoding="utf-8") as handle:
            handle.write(report_yaml)

        entry = {
            "audit_id": audit_id,
            "widget_id": widget_id,
            "widget_slug": widget_slug,
            "widget_version": widget_version,
            "level": level,
            "version": version,
            "file_name": json_name,
            "yaml_file_name": yaml_name,
            "created_at": now,
            "code_hash": code_hash,
        }
        self.index["audits"].append(entry)
        self._save_index()
        audit_payload["entry"] = entry
        return audit_payload
