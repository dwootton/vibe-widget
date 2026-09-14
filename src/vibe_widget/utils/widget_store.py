"""
Widget storage as a git-shareable artifact.

Layout under `<root>/.vibewidget/`:
    widgets/<var_name>__<cache_key[:10]>.js    generated code
    widgets/<var_name>__<cache_key[:10]>.json  sidecar metadata
    .gitignore                                 ignores derived dirs

There is no shared index file: every widget is self-describing, so two
processes (or two notebooks, or two git branches) never clobber each other.
A v3 `index/widgets.json` is migrated to sidecars once on init.

Cache key covers description + column names/dtypes + exports + imports +
theme + revision parent. Row counts are deliberately excluded so appending
rows to a DataFrame reuses the widget.
"""
from __future__ import annotations

import hashlib
import inspect
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 4
ANONYMOUS_VAR_NAME = "_anonymous_"
GITIGNORE_BODY = "bundles/\npackages/\nsandbox/\naudits/\n"



def extract_prompt_keywords(description: str, max_words: int = 3) -> list[str]:
    """
    Extract key words from a widget description for file naming.

    Args:
        description: Natural language widget description
        max_words: Maximum number of keywords to extract

    Returns:
        List of meaningful keywords

    Examples:
        "scatter plot of sales data" -> ["scatter", "plot", "sales"]
        "Show temperature trends" -> ["temperature", "trends"]
    """
    import re

    # Common words to skip (articles, prepositions, etc.)
    SKIP_WORDS = {
        'a', 'an', 'the', 'of', 'for', 'in', 'on', 'at', 'to', 'from',
        'with', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been',
        'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
        'would', 'should', 'could', 'may', 'might', 'must', 'can',
        'show', 'display', 'visualize', 'create', 'make', 'draw',
        'render', 'that', 'this', 'and', 'or', 'over', 'under',
        'about', 'into', 'through', 'during', 'using', 'add', 'change',
    }

    # Visualization-related keywords that are meaningful
    VIZ_KEYWORDS = {
        'chart', 'plot', 'graph', 'map', 'histogram', 'scatter',
        'bar', 'line', 'pie', 'area', 'heatmap', 'treemap',
        'dashboard', 'gauge', 'slider', 'timeline', 'network',
        'sankey', 'bubble', 'violin', 'box', 'radar', 'funnel',
    }

    # Clean and tokenize
    text = description.lower().strip()
    # Remove punctuation
    text = re.sub(r'[^\w\s]', ' ', text)
    # Split into words
    words = text.split()

    # Extract meaningful words
    meaningful_words = []
    for word in words[:15]:  # Look at first 15 words
        # Keep visualization keywords and skip common words
        if word in VIZ_KEYWORDS or (word not in SKIP_WORDS and len(word) > 2):
            meaningful_words.append(word)

        # Stop after collecting enough words
        if len(meaningful_words) >= max_words:
            break

    return meaningful_words


def compute_prompt_delta(old_description: str, new_description: str, max_words: int = 3) -> list[str]:
    """
    Compute the delta between two prompts, showing what changed.

    Extracts keywords from both prompts and returns words that were added
    or changed in the new description.

    Args:
        old_description: Original widget description
        new_description: New/edited widget description
        max_words: Maximum number of delta words to return

    Returns:
        List of keywords highlighting the change

    Examples:
        ("scatter plot", "scatter plot with tooltips") -> ["tooltips"]
        ("bar chart", "line chart") -> ["line"]
        ("red circles", "blue circles") -> ["blue"]
    """
    old_keywords = set(extract_prompt_keywords(old_description, max_words=10))
    new_keywords = extract_prompt_keywords(new_description, max_words=10)

    # Find added or changed keywords (preserve order from new)
    delta_words = []
    for word in new_keywords:
        if word not in old_keywords:
            delta_words.append(word)
            if len(delta_words) >= max_words:
                break

    # If no new words, just return the first few keywords from new description
    if not delta_words:
        return new_keywords[:max_words]

    return delta_words


def extract_var_name_from_description(description: str) -> str:
    """
    Extract a potential variable name from a widget description.

    Extracts key nouns and adjectives from the description to create
    a meaningful variable name instead of using "_anonymous_".

    Args:
        description: Natural language widget description

    Returns:
        A sanitized variable name derived from the description

    Examples:
        "scatter plot of sales data" -> "scatter_plot"
        "interactive bar chart" -> "bar_chart"
        "Show temperature trends over time" -> "temperature_trends"
    """
    # Use the existing keyword extraction
    keywords = extract_prompt_keywords(description, max_words=3)

    if keywords:
        # Join with underscore
        extracted_name = '_'.join(keywords)
        # Validate it's a proper identifier
        if extracted_name and extracted_name.isidentifier():
            return extracted_name

    # Fallback to anonymous if we couldn't extract anything meaningful
    return ANONYMOUS_VAR_NAME


def capture_caller_var_name(depth: int = 2) -> str | None:
    """
    Capture the variable name from the calling context.

    When user writes: `scatter_plot = vw.create(...)`, this captures "scatter_plot".

    Args:
        depth: Stack frame depth to inspect (2 = caller's caller)

    Returns:
        Variable name if assignment detected, None otherwise
    """
    try:
        frame = inspect.currentframe()
        for _ in range(depth):
            if frame is None:
                return None
            frame = frame.f_back

        if frame is None:
            return None

        import dis
        code = frame.f_code

        # Get bytecode instructions
        instructions = list(dis.get_instructions(code))

        # Find the instruction at current offset
        current_offset = frame.f_lasti

        # Look for STORE_NAME or STORE_FAST after current position
        for i, instr in enumerate(instructions):
            if instr.offset >= current_offset:
                # Look ahead for store instructions
                for j in range(i, min(i + 10, len(instructions))):
                    next_instr = instructions[j]
                    if next_instr.opname in ('STORE_NAME', 'STORE_FAST', 'STORE_GLOBAL', 'STORE_DEREF'):
                        var_name = next_instr.argval
                        # Validate it's a reasonable variable name
                        if var_name and not var_name.startswith('_') and var_name.isidentifier():
                            return var_name
                break

        return None
    except Exception:
        return None


def build_data_signature(data: Any) -> dict[str, Any] | None:
    """Build a cache-stable signature dict for a DataFrame-like object."""
    if data is None:
        return None
    shape = getattr(data, "shape", None)
    if shape is None:
        return None

    columns = getattr(data, "columns", None)
    names = [str(c) for c in columns] if columns is not None else []
    try:
        kinds = [str(d) for d in getattr(data, "dtypes", [])]
    except TypeError:
        kinds = []

    # dtypes is an ordered [column, dtype] list, not a dict: duplicate column
    # names are legal in pandas and a dict would collapse them into one key.
    return {
        "shape": [int(n) for n in shape],
        "columns": names,
        "dtypes": [[name, kind] for name, kind in zip(names, kinds)],
    }


class WidgetStore:
    """Reads and writes widget code plus one JSON sidecar per widget."""

    def __init__(self, store_dir: Path | None = None):
        """Initialize the store rooted at store_dir (defaults to cwd)."""
        if store_dir is None:
            store_dir = Path.cwd()

        self.root = Path(store_dir)
        self.store_dir = self.root / ".vibewidget"
        self.widgets_dir = self.store_dir / "widgets"

        self.widgets_dir.mkdir(parents=True, exist_ok=True)
        self._ensure_gitignore()
        self._migrate_v3_index()

    # -------------------------------------------------------------------------
    # Disk primitives
    # -------------------------------------------------------------------------

    def _ensure_gitignore(self) -> None:
        """Write .vibewidget/.gitignore once, never overwriting a user edit."""
        path = self.store_dir / ".gitignore"
        if path.exists():
            return
        try:
            path.write_text(GITIGNORE_BODY, encoding="utf-8")
        except OSError:
            pass

    @staticmethod
    def _atomic_write(path: Path, text: str) -> None:
        """Write text to path via a temp file and os.replace."""
        fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                handle.write(text)
            os.replace(tmp, path)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise

    def _sidecar_path(self, file_name: str) -> Path:
        """Return the sidecar path matching a widget .js file name."""
        return self.widgets_dir / (Path(file_name).stem + ".json")

    def _write_entry(self, entry: dict[str, Any], widget_code: str) -> None:
        """Persist a widget's code and sidecar atomically."""
        # ponytail: code first so a crash between the two writes leaves an
        # orphan .js that all_entries() ignores rather than a sidecar pointing
        # at nothing; sweep orphans on init if they ever accumulate.
        js_path = self.widgets_dir / entry["file_name"]
        self._atomic_write(js_path, widget_code)
        self._atomic_write(
            self._sidecar_path(entry["file_name"]),
            json.dumps(entry, indent=2, ensure_ascii=False),
        )

    def _remove_entry(self, entry: dict[str, Any]) -> bool:
        """Delete a widget's code and sidecar. Returns True if code was removed."""
        file_name = entry.get("file_name")
        if not file_name:
            return False
        self._sidecar_path(file_name).unlink(missing_ok=True)
        js_path = self.widgets_dir / file_name
        if js_path.exists():
            js_path.unlink()
            return True
        return False

    def _migrate_v3_index(self) -> None:
        """Convert a legacy index/widgets.json into sidecars, once."""
        index_dir = self.store_dir / "index"
        legacy = index_dir / "widgets.json"
        if not legacy.exists():
            return

        try:
            index = json.loads(legacy.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            index = {}

        for var_name, widgets in (index.get("widgets") or {}).items():
            for old_entry in widgets or []:
                old_name = old_entry.get("file_name")
                cache_key = old_entry.get("cache_key")
                if not old_name or not cache_key:
                    continue
                old_path = self.widgets_dir / old_name
                if not old_path.exists():
                    continue

                entry = self._normalize_entry(dict(old_entry), var_name)
                entry["file_name"] = f"{var_name}__{cache_key[:10]}.js"
                new_path = self.widgets_dir / entry["file_name"]
                if new_path != old_path:
                    os.replace(old_path, new_path)
                self._atomic_write(
                    self._sidecar_path(entry["file_name"]),
                    json.dumps(entry, indent=2, ensure_ascii=False),
                )

        legacy.unlink(missing_ok=True)
        try:
            index_dir.rmdir()
        except OSError:
            pass

    @staticmethod
    def _normalize_entry(entry: dict[str, Any], var_name: str) -> dict[str, Any]:
        """Fill in v4 fields on an entry read from a v3 index."""
        # ponytail: migrated entries have no column names, so recomputed cache
        # keys miss and the widget regenerates once; load_by_cache_key still works.
        shape = entry.pop("data_shape", None)
        entry.setdefault(
            "data_signature",
            {"shape": list(shape), "columns": [], "dtypes": []} if shape else None,
        )
        entry["schema_version"] = SCHEMA_VERSION
        entry["var_name"] = var_name
        for key in ("outputs", "actions", "inputs", "provenance"):
            entry.setdefault(key, {})
        entry.setdefault("prompt_history", [])
        entry.setdefault("components", [])
        return entry

    # -------------------------------------------------------------------------
    # Entry reading
    # -------------------------------------------------------------------------

    def all_entries(self) -> list[dict[str, Any]]:
        """Return every stored entry, newest first, with var_name and _index."""
        entries: list[dict[str, Any]] = []
        try:
            paths = sorted(self.widgets_dir.glob("*.json"))
        except OSError:
            return []

        for path in paths:
            try:
                entry = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            if not isinstance(entry, dict) or not entry.get("cache_key"):
                continue
            entry.setdefault("file_name", path.stem + ".js")
            if not entry.get("var_name"):
                entry["var_name"] = path.stem.split("__")[0]
            entries.append(entry)

        entries.sort(key=lambda e: (e.get("created_at") or "", e["file_name"]), reverse=True)

        seen: dict[str, int] = {}
        for entry in entries:
            var_name = entry["var_name"]
            entry["_index"] = seen.get(var_name, 0)
            seen[var_name] = entry["_index"] + 1
        return entries

    def _code_path(self, entry: dict[str, Any]) -> Path:
        """Return the .js path for an entry."""
        return self.widgets_dir / entry["file_name"]

    def _resolve(
        self,
        entries: list[dict[str, Any]],
        match: dict[str, Any],
        follow_revisions: bool,
    ) -> dict[str, Any] | None:
        """Apply follow_revisions and drop entries whose code file is gone."""
        if follow_revisions and match.get("_index", 0) > 0:
            for entry in entries:
                if entry["var_name"] == match["var_name"] and entry["_index"] == 0:
                    if self._code_path(entry).exists():
                        result = dict(entry)
                        result["_original_cache_key"] = match["cache_key"]
                        return result
                    break
        if not self._code_path(match).exists():
            return None
        return dict(match)

    # -------------------------------------------------------------------------
    # Signatures
    # -------------------------------------------------------------------------

    def _sanitize_var_name(self, name: str) -> str:
        """Sanitize a string to be a valid Python identifier."""
        if not name:
            return ANONYMOUS_VAR_NAME

        sanitized = ''.join(c if c.isalnum() or c == '_' else '_' for c in name)

        while sanitized and sanitized[0].isdigit():
            sanitized = sanitized[1:]

        while '__' in sanitized:
            sanitized = sanitized.replace('__', '_')

        sanitized = sanitized.strip('_')

        return sanitized if sanitized and sanitized.isidentifier() else ANONYMOUS_VAR_NAME

    @staticmethod
    def _data_key(data_signature: dict[str, Any] | None) -> list[list[str]] | None:
        """Reduce a data signature to the ordered [column, dtype] pairs the key uses."""
        if not data_signature:
            return None
        pairs = data_signature.get("dtypes")
        if not pairs:
            return [[str(c), ""] for c in data_signature.get("columns") or []]
        return [[str(a), str(b)] for a, b in pairs]

    def _compute_cache_key(
        self,
        description: str,
        exports_signature: str,
        imports_signature: str,
        theme_signature: str,
        revision_parent: str | None = None,
    ) -> str:
        """Compute the SHA256 cache key. Data enters via imports_signature only."""
        cache_input = {
            "description": " ".join(description.split()),
            "exports_signature": exports_signature,
            "imports_signature": imports_signature,
            "theme_signature": theme_signature,
            "revision_parent": revision_parent,
        }

        cache_str = json.dumps(cache_input, sort_keys=True)
        return hashlib.sha256(cache_str.encode()).hexdigest()

    def _compute_exports_signature(self, exports: dict[str, str] | None) -> str:
        """Compute stable signature for exports."""
        if not exports:
            return ""
        items = sorted(exports.items())
        return hashlib.md5(json.dumps(items).encode()).hexdigest()[:8]

    def _compute_imports_signature(
        self,
        imports_serialized: dict[str, str] | None,
        data_signature: dict[str, Any] | None = None,
    ) -> str:
        """Compute stable signature for imports plus the data columns."""
        data_key = self._data_key(data_signature)
        if not imports_serialized and not data_key:
            return ""

        combined: dict[str, Any] = {}
        if imports_serialized:
            combined.update(imports_serialized)
        if data_key:
            combined["__data_signature__"] = data_key

        items = sorted(combined.items(), key=lambda x: str(x[0]))
        return hashlib.md5(json.dumps(items, sort_keys=True).encode()).hexdigest()[:8]

    def _compute_theme_signature(self, theme_description: str | None) -> str:
        """Compute stable signature for theme description."""
        if not theme_description:
            return ""
        normalized = " ".join(theme_description.split())
        return hashlib.md5(normalized.encode()).hexdigest()[:8]

    def _compute_parameter_signature(
        self,
        data_signature: dict[str, Any] | None,
        exports_signature: str,
        imports_signature: str,
        theme_signature: str,
    ) -> str:
        """Compute a 10-character signature over all widget parameters."""
        combined_parts = [
            json.dumps(self._data_key(data_signature), sort_keys=True) if data_signature else "nodata",
            exports_signature or "noexp",
            imports_signature or "noimp",
            theme_signature or "notheme",
        ]
        combined_str = "_".join(combined_parts)
        return hashlib.md5(combined_str.encode()).hexdigest()[:10]

    # -------------------------------------------------------------------------
    # Lookup and save
    # -------------------------------------------------------------------------

    def lookup(
        self,
        description: str,
        var_name: str | None,
        data_signature: dict[str, Any] | None,
        exports: dict[str, str] | None,
        imports_serialized: dict[str, str] | None,
        theme_description: str | None,
        revision_parent: str | None = None,
        follow_revisions: bool = True,
    ) -> dict[str, Any] | None:
        """Look up a cached widget by recomputed cache key.

        var_name is accepted for API stability; grouping comes from the stored entry.
        """
        exports_signature = self._compute_exports_signature(exports)
        imports_signature = self._compute_imports_signature(imports_serialized, data_signature)
        theme_signature = self._compute_theme_signature(theme_description)

        cache_key = self._compute_cache_key(
            description=description,
            exports_signature=exports_signature,
            imports_signature=imports_signature,
            theme_signature=theme_signature,
            revision_parent=revision_parent,
        )

        entries = self.all_entries()
        for entry in entries:
            if entry["cache_key"] == cache_key:
                return self._resolve(entries, entry, follow_revisions)
        return None

    def save(
        self,
        widget_code: str,
        description: str,
        var_name: str | None,
        data_signature: dict[str, Any] | None,
        model: str,
        exports: dict[str, str] | None,
        imports_serialized: dict[str, str] | None,
        theme_name: str | None = None,
        theme_description: str | None = None,
        notebook_path: str | None = None,
        revision_parent: str | None = None,
        prompt_history: list[dict[str, Any]] | None = None,
        outputs: dict[str, Any] | None = None,
        inputs: dict[str, str] | None = None,
        actions: dict[str, Any] | None = None,
        provenance: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Write a generated widget and its sidecar; returns the stored entry."""
        exports_signature = self._compute_exports_signature(exports)
        imports_signature = self._compute_imports_signature(imports_serialized, data_signature)
        theme_signature = self._compute_theme_signature(theme_description)

        cache_key = self._compute_cache_key(
            description=description,
            exports_signature=exports_signature,
            imports_signature=imports_signature,
            theme_signature=theme_signature,
            revision_parent=revision_parent,
        )

        if var_name:
            safe_var_name = self._sanitize_var_name(var_name)
        else:
            safe_var_name = self._sanitize_var_name(extract_var_name_from_description(description))

        if revision_parent:
            parent_widget = self.get_widget_by_cache_key(revision_parent)
            if parent_widget and parent_widget.get("description"):
                prompt_words = compute_prompt_delta(
                    parent_widget["description"], description, max_words=2
                )
            else:
                prompt_words = extract_prompt_keywords(description, max_words=2)
        else:
            prompt_words = extract_prompt_keywords(description, max_words=2)

        param_signature = self._compute_parameter_signature(
            data_signature=data_signature,
            exports_signature=exports_signature,
            imports_signature=imports_signature,
            theme_signature=theme_signature,
        )

        now = datetime.now(timezone.utc)
        file_name = f"{safe_var_name}__{cache_key[:10]}.js"

        widget_entry = {
            "schema_version": SCHEMA_VERSION,
            "created_at": now.isoformat(),
            "file_name": file_name,
            "var_name": safe_var_name,
            "cache_key": cache_key,
            "description": description,
            "data_signature": data_signature,
            "model": model,
            "exports_signature": exports_signature,
            "imports_signature": imports_signature,
            "theme_signature": theme_signature,
            "parameter_signature": param_signature,
            "prompt_keywords": prompt_words,
            "theme_name": theme_name,
            "theme_description": theme_description,
            "notebook_path": self._relative_notebook_path(notebook_path),
            "components": self.extract_components(widget_code),
            "revision_parent": revision_parent,
            "prompt_history": prompt_history or [],
            "outputs": outputs or {},
            "inputs": inputs or {},
            "actions": actions or {},
            "provenance": self._build_provenance(provenance, model),
        }

        self._write_entry(widget_entry, widget_code)

        result = dict(widget_entry)
        result["_index"] = 0
        return result

    def _relative_notebook_path(self, notebook_path: str | None) -> str | None:
        """Store notebook paths relative to the store root when they live under it."""
        if not notebook_path:
            return notebook_path
        try:
            path = Path(notebook_path)
            if path.is_absolute():
                return str(path.resolve().relative_to(self.root.resolve()))
        except (ValueError, OSError):
            pass
        return notebook_path

    @staticmethod
    def _build_provenance(provenance: dict[str, Any] | None, model: str) -> dict[str, Any]:
        """Return the caller's provenance dict with the package version filled in."""
        result = dict(provenance or {})
        result.setdefault("model", model)
        try:
            from vibe_widget import __version__

            result["vibe_widget_version"] = __version__
        except ImportError:
            result.setdefault("vibe_widget_version", None)
        return result

    # -------------------------------------------------------------------------
    # Loading
    # -------------------------------------------------------------------------

    def load_widget_code(self, widget_entry: dict[str, Any]) -> str:
        """Load widget JS code from disk."""
        return self._code_path(widget_entry).read_text(encoding='utf-8')

    def load_by_cache_key(
        self,
        cache_key: str,
        follow_revisions: bool = True,
    ) -> tuple[dict[str, Any], str] | None:
        """Load (entry, code) by full cache key."""
        entries = self.all_entries()
        for entry in entries:
            if entry["cache_key"] == cache_key:
                resolved = self._resolve(entries, entry, follow_revisions)
                if resolved is None:
                    return None
                return resolved, self.load_widget_code(resolved)
        return None

    def load_by_var_name(self, var_name: str, index: int = 0) -> tuple[dict[str, Any], str] | None:
        """Load (entry, code) by var_name group and index (0 = newest)."""
        for entry in self.all_entries():
            if entry["var_name"] == var_name and entry["_index"] == index:
                if not self._code_path(entry).exists():
                    return None
                return entry, self.load_widget_code(entry)
        return None

    def load_by_id(self, identifier: str) -> tuple[dict[str, Any], str] | None:
        """Load (entry, code) by exact var_name or unique cache-key prefix."""
        if not identifier:
            return None

        by_var_name = self.load_by_var_name(identifier)
        if by_var_name:
            return by_var_name

        if len(identifier) < 6:
            return None

        matches = [e for e in self.all_entries() if e["cache_key"].startswith(identifier)]
        if len(matches) != 1:
            return None
        entry = matches[0]
        if not self._code_path(entry).exists():
            return None
        return entry, self.load_widget_code(entry)

    def load_from_file(self, file_path: Path | str) -> tuple[dict[str, Any], str] | None:
        """Load (entry, code) from a JS file outside the store."""
        file_path = Path(file_path)
        if not file_path.exists():
            return None

        code = file_path.read_text(encoding='utf-8')

        widget_entry = {
            "var_name": file_path.stem,
            "file_name": file_path.name,
            "description": f"Loaded from {file_path}",
            "origin": "file",
            "file_path": str(file_path),
            "components": self.extract_components(code),
        }

        return widget_entry, code

    def find_entry_for_path(self, file_path: Path | str) -> dict[str, Any] | None:
        """Return the stored entry whose .js file is at file_path, if any."""
        try:
            target = Path(file_path).resolve()
        except OSError:
            return None
        for entry in self.all_entries():
            try:
                if self._code_path(entry).resolve() == target:
                    return entry
            except OSError:
                continue
        return None

    # -------------------------------------------------------------------------
    # Removal
    # -------------------------------------------------------------------------

    def clear(self) -> int:
        """Remove every stored widget. Returns the number of code files removed."""
        removed = 0
        for entry in self.all_entries():
            if self._remove_entry(entry):
                removed += 1
        return removed

    def clear_for_widget(
        self,
        *,
        var_name: str | None = None,
        cache_key: str | None = None,
    ) -> int:
        """Remove widgets by var_name or cache_key. Returns the number removed."""
        if not var_name and not cache_key:
            return 0

        removed = 0
        for entry in self.all_entries():
            if cache_key and entry["cache_key"] == cache_key:
                removed += int(self._remove_entry(entry))
                continue
            if var_name and entry["var_name"] == var_name:
                removed += int(self._remove_entry(entry))
        return removed

    # -------------------------------------------------------------------------
    # Code inspection
    # -------------------------------------------------------------------------

    def extract_components(self, code: str) -> list[str]:
        """Extract named exports (components) from JavaScript code."""
        from vibe_widget.utils.code_parser import extract_named_exports
        return extract_named_exports(code)

    def extract_component_code(self, full_code: str, component_name: str) -> str | None:
        """Extract the code for a specific named export component."""
        from vibe_widget.utils.code_parser import extract_component_code
        return extract_component_code(full_code, component_name)

    def get_notebook_path(self) -> str | None:
        """Try to infer the current notebook path from IPython."""
        try:
            from IPython import get_ipython
            ipython = get_ipython()

            if ipython is not None and hasattr(ipython, 'kernel'):
                try:
                    if hasattr(ipython, 'user_ns'):
                        user_ns = ipython.user_ns
                        if '__vsc_ipynb_file__' in user_ns:
                            return user_ns['__vsc_ipynb_file__']
                    return None
                except Exception:
                    return None
            return None
        except Exception:
            return None

    # -------------------------------------------------------------------------
    # Convenience accessors
    # -------------------------------------------------------------------------

    def get_recent_widgets(self, limit: int = 10) -> list[dict[str, Any]]:
        """Get the most recently created widgets across all var_names."""
        return self.all_entries()[:limit]

    def get_widgets_for_var_name(self, var_name: str) -> list[dict[str, Any]]:
        """Get all widgets for a variable name, newest first."""
        return [e for e in self.all_entries() if e["var_name"] == var_name]

    def get_widgets_for_notebook(self, notebook_path: str) -> list[dict[str, Any]]:
        """Get all widgets created from a specific notebook, newest first."""
        wanted = self._relative_notebook_path(notebook_path)
        return [
            e for e in self.all_entries()
            if e.get("notebook_path") in (notebook_path, wanted)
        ]

    def get_revision_chain(self, var_name: str) -> list[dict[str, Any]]:
        """Get all widgets for a var_name, oldest first."""
        widgets = self.get_widgets_for_var_name(var_name)
        widgets.sort(key=lambda w: w.get("created_at") or "")
        return widgets

    def set_revision_parent(
        self,
        var_name: str,
        index: int,
        parent_cache_key: str,
    ) -> bool:
        """Set revision_parent on a stored widget. Returns True if updated."""
        for entry in self.all_entries():
            if entry["var_name"] == var_name and entry["_index"] == index:
                stored = {k: v for k, v in entry.items() if not k.startswith("_")}
                stored["revision_parent"] = parent_cache_key
                self._atomic_write(
                    self._sidecar_path(entry["file_name"]),
                    json.dumps(stored, indent=2, ensure_ascii=False),
                )
                return True
        return False

    def get_widget_by_cache_key(self, cache_key: str) -> dict[str, Any] | None:
        """Get widget metadata by cache key without loading the code."""
        for entry in self.all_entries():
            if entry["cache_key"] == cache_key:
                return entry
        return None

    def list_var_names(self) -> list[str]:
        """Get the sorted list of variable names that have cached widgets."""
        return sorted({e["var_name"] for e in self.all_entries()})

    def list_notebooks(self) -> list[str]:
        """Get the sorted list of notebooks that have cached widgets."""
        return sorted({e["notebook_path"] for e in self.all_entries() if e.get("notebook_path")})

    def get_stats(self) -> dict[str, Any]:
        """Get counts and creation timestamps for the widget cache."""
        entries = self.all_entries()
        created = sorted(e.get("created_at") or "" for e in entries)
        return {
            "total_count": len(entries),
            "var_names_count": len({e["var_name"] for e in entries}),
            "oldest_created": created[0] if created else None,
            "newest_created": created[-1] if created else None,
        }
