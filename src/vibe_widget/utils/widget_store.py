"""
Widget storage and caching system.

Stores generated widget JS files in a project-root `.vibewidget/` directory
with a hierarchical JSON index using variable names as primary identifiers.

JSON index structure (v3):
{
    "schema_version": 3,
    "metadata": {
        "total_count": int,
        "oldest_created": ISO timestamp,
        "newest_created": ISO timestamp,
        "var_names": ["scatter_plot", "chart", ...]
    },
    "widgets": {
        "scatter_plot": [  # Grouped by var_name, newest-first
            {
                "created_at": ISO timestamp,
                "file_name": "scatter_plot_20241229_120000.js",
                "cache_key": "abc123...",  # Full hash for cache lookup
                "description": "...",
                "data_shape": [100, 5],
                "model": "...",
                ...metadata fields...
            }
        ],
        "_anonymous_": [  # Widgets without assigned variable names
            ...
        ]
    },
    "cache_index": {
        "cache_key_hash": "var_name/index"  # O(1) lookup by cache key
    }
}

Design notes:
- Variable names (var_name) are the primary identifier for grouping related widgets
- Cache key is computed from: description + all inputs (data shape, imports) + outputs + theme
- When data moves to inputs in future API, cache key computation stays the same
- File names: {var_name}_{timestamp}.js for easy filesystem browsing
- _anonymous_ group collects widgets created without variable assignment
"""
import hashlib
import inspect
import json
from datetime import datetime
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 3
ANONYMOUS_VAR_NAME = "_anonymous_"


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


class WidgetStore:
    """
    Manages widget persistence and caching in .vibewidget/ directory.
    
    Uses variable names as primary identifiers for grouping related widgets.
    Cache lookup is O(1) via cache_index hash map.
    """
    
    def __init__(self, store_dir: Path | None = None):
        """
        Initialize widget store.
        
        Args:
            store_dir: Root directory for .vibewidget/ (defaults to cwd)
        """
        if store_dir is None:
            store_dir = Path.cwd()
        
        self.store_dir = store_dir / ".vibewidget"
        self.widgets_dir = self.store_dir / "widgets"
        self.index_dir = self.store_dir / "index"
        self.index_file = self.index_dir / "widgets.json"
        
        self.widgets_dir.mkdir(parents=True, exist_ok=True)
        self.index_dir.mkdir(parents=True, exist_ok=True)
        
        self.index = self._load_index()
    
    def _empty_index(self) -> dict[str, Any]:
        """Return a new empty v3 index."""
        return {
            "schema_version": SCHEMA_VERSION,
            "metadata": {
                "total_count": 0,
                "oldest_created": None,
                "newest_created": None,
                "var_names": [],
            },
            "widgets": {},  # var_name -> [widget_entries]
            "cache_index": {},  # cache_key -> "var_name/index"
        }
    
    def _load_index(self) -> dict[str, Any]:
        """Load the widget index from disk."""
        if not self.index_file.exists():
            return self._empty_index()
        
        try:
            with open(self.index_file, 'r', encoding='utf-8') as f:
                index = json.load(f)
                # Handle schema version upgrade if needed
                if index.get("schema_version", 1) < SCHEMA_VERSION:
                    return self._migrate_index(index)
                return index
        except (json.JSONDecodeError, OSError):
            return self._empty_index()
    
    def _migrate_index(self, old_index: dict[str, Any]) -> dict[str, Any]:
        """Migrate from v1/v2 schema to v3 (var_name-based)."""
        new_index = self._empty_index()
        
        # v1/v2 had widgets as a flat list
        old_widgets = old_index.get("widgets", [])
        if isinstance(old_widgets, list):
            for widget in old_widgets:
                # Use data_var_name or slug as var_name, fallback to anonymous
                var_name = widget.get("data_var_name") or widget.get("slug") or ANONYMOUS_VAR_NAME
                var_name = self._sanitize_var_name(var_name)
                
                if var_name not in new_index["widgets"]:
                    new_index["widgets"][var_name] = []
                
                # Build new widget entry
                cache_key = widget.get("hash", "")
                new_entry = {
                    "created_at": widget.get("created_at"),
                    "file_name": widget.get("file_name"),
                    "cache_key": cache_key,
                    "description": widget.get("description"),
                    "data_shape": widget.get("data_shape"),
                    "model": widget.get("model"),
                    "exports_signature": widget.get("exports_signature"),
                    "imports_signature": widget.get("imports_signature"),
                    "theme_signature": widget.get("theme_signature"),
                    "theme_name": widget.get("theme_name"),
                    "theme_description": widget.get("theme_description"),
                    "notebook_path": widget.get("notebook_path"),
                    "components": widget.get("components", []),
                    "revision_parent": widget.get("revision_parent") or widget.get("base_widget_id"),
                    # Backwards compatibility fields for audit system
                    "id": widget.get("id") or cache_key,
                    "slug": widget.get("slug") or var_name,
                    "version": widget.get("version") or 1,
                }
                
                new_index["widgets"][var_name].append(new_entry)
                
                # Update cache_index
                if cache_key:
                    idx = len(new_index["widgets"][var_name]) - 1
                    new_index["cache_index"][cache_key] = f"{var_name}/{idx}"
        
        # Sort each var_name group by created_at (newest first)
        for var_name in new_index["widgets"]:
            new_index["widgets"][var_name].sort(
                key=lambda w: w.get("created_at") or "",
                reverse=True
            )
        
        # Rebuild cache_index after sorting
        new_index["cache_index"] = {}
        for var_name, widgets in new_index["widgets"].items():
            for idx, widget in enumerate(widgets):
                cache_key = widget.get("cache_key")
                if cache_key:
                    new_index["cache_index"][cache_key] = f"{var_name}/{idx}"
        
        self._update_metadata(new_index)
        return new_index
    
    def _sanitize_var_name(self, name: str) -> str:
        """Sanitize a string to be a valid Python identifier."""
        if not name:
            return ANONYMOUS_VAR_NAME
        
        # Replace non-alphanumeric with underscore
        sanitized = ''.join(c if c.isalnum() or c == '_' else '_' for c in name)
        
        # Remove leading digits
        while sanitized and sanitized[0].isdigit():
            sanitized = sanitized[1:]
        
        # Collapse multiple underscores
        while '__' in sanitized:
            sanitized = sanitized.replace('__', '_')
        
        sanitized = sanitized.strip('_')
        
        return sanitized if sanitized and sanitized.isidentifier() else ANONYMOUS_VAR_NAME
    
    def _update_metadata(self, index: dict[str, Any]) -> None:
        """Update metadata from widgets dict."""
        widgets_dict = index.get("widgets", {})
        
        total_count = 0
        oldest: str | None = None
        newest: str | None = None
        var_names: list[str] = []
        
        for var_name, widgets in widgets_dict.items():
            if widgets:
                var_names.append(var_name)
                total_count += len(widgets)
                
                for widget in widgets:
                    created_at = widget.get("created_at")
                    if created_at:
                        if oldest is None or created_at < oldest:
                            oldest = created_at
                        if newest is None or created_at > newest:
                            newest = created_at
        
        index["metadata"] = {
            "total_count": total_count,
            "oldest_created": oldest,
            "newest_created": newest,
            "var_names": sorted(var_names),
        }
    
    def _rebuild_cache_index(self, index: dict[str, Any]) -> None:
        """Rebuild cache_index from widgets dict."""
        index["cache_index"] = {}
        for var_name, widgets in index.get("widgets", {}).items():
            for idx, widget in enumerate(widgets):
                cache_key = widget.get("cache_key")
                if cache_key:
                    index["cache_index"][cache_key] = f"{var_name}/{idx}"
    
    def _save_index(self) -> None:
        """Update metadata, rebuild cache_index, and save to disk."""
        self._update_metadata(self.index)
        self._rebuild_cache_index(self.index)
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(self.index, f, indent=2, ensure_ascii=False)

    def clear(self) -> int:
        """Remove all cached widgets and reset the index."""
        removed = 0
        widgets_dict = self.index.get("widgets", {})
        
        for var_name, widgets in widgets_dict.items():
            for entry in widgets:
                file_name = entry.get("file_name")
                if not file_name:
                    continue
                widget_file = self.widgets_dir / file_name
                if widget_file.exists():
                    widget_file.unlink()
                    removed += 1
        
        self.index = self._empty_index()
        self._save_index()
        return removed

    def clear_for_widget(
        self,
        *,
        var_name: str | None = None,
        cache_key: str | None = None,
        # Legacy support
        widget_id: str | None = None,
        slug: str | None = None,
    ) -> int:
        """
        Remove cached widgets by var_name or cache_key.
        
        Args:
            var_name: Remove all widgets for this variable name
            cache_key: Remove widget with this specific cache key
            widget_id: (legacy) Treated as cache_key
            slug: (legacy) Treated as var_name
        
        Returns:
            Number of widgets removed
        """
        # Handle legacy parameters
        if slug and not var_name:
            var_name = slug
        if widget_id and not cache_key:
            cache_key = widget_id
        
        if not var_name and not cache_key:
            return 0
        
        widgets_dict = self.index.get("widgets", {})
        cache_index = self.index.get("cache_index", {})
        removed = 0
        
        if cache_key:
            # Remove specific widget by cache key
            location = cache_index.get(cache_key)
            if location:
                v_name, idx_str = location.split("/")
                idx = int(idx_str)
                if v_name in widgets_dict and idx < len(widgets_dict[v_name]):
                    entry = widgets_dict[v_name][idx]
                    file_name = entry.get("file_name")
                    if file_name:
                        widget_file = self.widgets_dir / file_name
                        if widget_file.exists():
                            widget_file.unlink()
                            removed += 1
                    widgets_dict[v_name].pop(idx)
                    if not widgets_dict[v_name]:
                        del widgets_dict[v_name]
        
        if var_name and var_name in widgets_dict:
            # Remove all widgets for this var_name
            for entry in widgets_dict[var_name]:
                file_name = entry.get("file_name")
                if file_name:
                    widget_file = self.widgets_dir / file_name
                    if widget_file.exists():
                        widget_file.unlink()
                        removed += 1
            del widgets_dict[var_name]
        
        if removed:
            self._save_index()
        
        return removed
    
    def _compute_cache_key(
        self,
        description: str,
        data_shape: tuple[int, int] | None,
        exports_signature: str,
        imports_signature: str,
        theme_signature: str,
    ) -> str:
        """
        Compute cache key from inputs.
        
        Hashes: description + data shape + exports + imports + theme.
        Does NOT include model, notebook path, or var_name to avoid unnecessary regeneration.
        
        The cache key determines if we can reuse an existing widget.
        When data moves to inputs in the future, imports_signature will include
        the data shape, so this design is forward-compatible.
        
        Args:
            description: Widget description (whitespace-normalized)
            data_shape: Shape of data as (rows, cols), or None if no data
            exports_signature: Hash of export definitions
            imports_signature: Hash of import definitions (will include data in future)
            theme_signature: Hash of theme description
        
        Returns:
            Full SHA256 hash as cache key
        """
        # Strip whitespace from description for consistent hashing
        stripped_description = " ".join(description.split())
        
        cache_input = {
            "description": stripped_description,
            "data_shape": list(data_shape) if data_shape else None,
            "exports_signature": exports_signature,
            "imports_signature": imports_signature,
            "theme_signature": theme_signature,
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
        data_shape: tuple[int, int] | None = None,
    ) -> str:
        """
        Compute stable signature for imports.
        
        Currently includes data_shape as a separate parameter.
        In future when data moves to inputs, data_shape will be part of imports_serialized
        and this method will still work the same way.
        
        Args:
            imports_serialized: Import trait definitions
            data_shape: Shape of data (will be part of imports in future)
        
        Returns:
            MD5 hash signature (first 8 chars)
        """
        if not imports_serialized and not data_shape:
            return ""
        
        # Build combined inputs dict for hashing
        combined = {}
        if imports_serialized:
            combined.update(imports_serialized)
        
        # Include data_shape - when data moves to inputs, this will be redundant
        # but still work since data_shape will be in imports_serialized
        if data_shape:
            combined["__data_shape__"] = list(data_shape)
        
        items = sorted(combined.items(), key=lambda x: str(x[0]))
        return hashlib.md5(json.dumps(items).encode()).hexdigest()[:8]

    def _compute_theme_signature(self, theme_description: str | None) -> str:
        """Compute stable signature for theme description."""
        if not theme_description:
            return ""
        normalized = " ".join(theme_description.split())
        return hashlib.md5(normalized.encode()).hexdigest()[:8]
    
    def lookup(
        self,
        description: str,
        var_name: str | None,
        data_shape: tuple[int, int] | None,
        exports: dict[str, str] | None,
        imports_serialized: dict[str, str] | None,
        theme_description: str | None,
    ) -> dict[str, Any] | None:
        """
        Look up a cached widget by cache key.
        
        Args:
            description: Widget description
            var_name: Variable name for storage grouping (not part of cache key)
            data_shape: Shape of the data as (rows, columns)
            exports: Export trait definitions
            imports_serialized: Import trait values
            theme_description: Theme description for signature
        
        Returns:
            Widget metadata dict with var_name if found, None otherwise
        """
        exports_signature = self._compute_exports_signature(exports)
        imports_signature = self._compute_imports_signature(imports_serialized, data_shape)
        theme_signature = self._compute_theme_signature(theme_description)
        
        cache_key = self._compute_cache_key(
            description=description,
            data_shape=data_shape,
            exports_signature=exports_signature,
            imports_signature=imports_signature,
            theme_signature=theme_signature,
        )
        
        # Use cache_index for O(1) lookup
        cache_index = self.index.get("cache_index", {})
        location = cache_index.get(cache_key)
        
        if not location:
            return None
        
        # Parse location "var_name/index"
        stored_var_name, idx_str = location.split("/")
        idx = int(idx_str)
        
        widgets_dict = self.index.get("widgets", {})
        if stored_var_name not in widgets_dict:
            return None
        
        widgets_list = widgets_dict[stored_var_name]
        if idx >= len(widgets_list):
            return None
        
        widget_entry = widgets_list[idx]
        widget_file = self.widgets_dir / widget_entry["file_name"]
        
        if not widget_file.exists():
            return None
        
        # Return entry with var_name for reference
        result = dict(widget_entry)
        result["var_name"] = stored_var_name
        result["_index"] = idx
        return result
    
    def save(
        self,
        widget_code: str,
        description: str,
        var_name: str | None,
        data_shape: tuple[int, int] | None,
        model: str,
        exports: dict[str, str] | None,
        imports_serialized: dict[str, str] | None,
        theme_name: str | None = None,
        theme_description: str | None = None,
        notebook_path: str | None = None,
        revision_parent: str | None = None,
    ) -> dict[str, Any]:
        """
        Save a newly generated widget to the store.
        
        Widgets are grouped by var_name. The cache key is computed from
        description + data_shape + exports + imports + theme (not var_name).
        
        If the same var_name is used with different code (e.g., user changed description),
        a new entry is added to that var_name's list (newest first).
        
        Args:
            widget_code: Generated JavaScript code
            description: Widget description
            var_name: Variable name from user's code (e.g., "scatter_plot")
            data_shape: Shape of the data as (rows, columns)
            model: Model used for generation (stored for reference, not in cache key)
            exports: Export trait definitions
            imports_serialized: Import trait values
            theme_name: Theme name for reference
            theme_description: Theme description for signature
            notebook_path: Path to notebook (stored for reference, not in cache key)
            revision_parent: Cache key of parent widget (for edit chains)
        
        Returns:
            Widget metadata dict with var_name
        """
        exports_signature = self._compute_exports_signature(exports)
        imports_signature = self._compute_imports_signature(imports_serialized, data_shape)
        theme_signature = self._compute_theme_signature(theme_description)
        
        cache_key = self._compute_cache_key(
            description=description,
            data_shape=data_shape,
            exports_signature=exports_signature,
            imports_signature=imports_signature,
            theme_signature=theme_signature,
        )
        
        # Sanitize var_name to be a valid identifier
        safe_var_name = self._sanitize_var_name(var_name) if var_name else ANONYMOUS_VAR_NAME
        
        # File name: {var_name}_{timestamp}.js
        now = datetime.utcnow()
        timestamp = now.strftime("%Y%m%d_%H%M%S")
        file_name = f"{safe_var_name}_{timestamp}.js"
        
        widget_file = self.widgets_dir / file_name
        widget_file.write_text(widget_code, encoding='utf-8')
        
        now_iso = now.isoformat()
        
        # Extract components from generated code
        components = self.extract_components(widget_code)
        
        widget_entry = {
            "created_at": now_iso,
            "file_name": file_name,
            "cache_key": cache_key,
            "description": description,
            "data_shape": list(data_shape) if data_shape else None,
            "model": model,
            "exports_signature": exports_signature,
            "imports_signature": imports_signature,
            "theme_signature": theme_signature,
            "theme_name": theme_name,
            "theme_description": theme_description,
            "notebook_path": notebook_path,
            "components": components,
            "revision_parent": revision_parent,
            # Backwards compatibility fields for audit system
            "id": cache_key,  # Use cache_key as unique identifier
            "slug": safe_var_name,  # Use var_name as human-readable slug
            "version": 1,  # Version within var_name group (could be computed but 1 is fine for new entries)
        }
        
        # Initialize var_name group if needed
        widgets_dict = self.index.get("widgets", {})
        if safe_var_name not in widgets_dict:
            widgets_dict[safe_var_name] = []
        
        # Insert at beginning (newest first)
        widgets_dict[safe_var_name].insert(0, widget_entry)
        self.index["widgets"] = widgets_dict
        
        self._save_index()  # Rebuilds cache_index and metadata
        
        # Return entry with var_name for reference
        result = dict(widget_entry)
        result["var_name"] = safe_var_name
        result["_index"] = 0
        return result
    
    def load_widget_code(self, widget_entry: dict[str, Any]) -> str:
        """Load widget JS code from disk."""
        widget_file = self.widgets_dir / widget_entry["file_name"]
        return widget_file.read_text(encoding='utf-8')
    
    def load_by_cache_key(self, cache_key: str) -> tuple[dict[str, Any], str] | None:
        """
        Load widget by cache key.
        
        Args:
            cache_key: Full cache key hash
        
        Returns:
            Tuple of (widget_entry, code) if found, None otherwise
        """
        cache_index = self.index.get("cache_index", {})
        location = cache_index.get(cache_key)
        
        if not location:
            return None
        
        var_name, idx_str = location.split("/")
        idx = int(idx_str)
        
        widgets_dict = self.index.get("widgets", {})
        if var_name not in widgets_dict:
            return None
        
        widgets_list = widgets_dict[var_name]
        if idx >= len(widgets_list):
            return None
        
        widget_entry = widgets_list[idx]
        widget_file = self.widgets_dir / widget_entry["file_name"]
        
        if not widget_file.exists():
            return None
        
        code = widget_file.read_text(encoding='utf-8')
        result = dict(widget_entry)
        result["var_name"] = var_name
        result["_index"] = idx
        return result, code
    
    def load_by_var_name(self, var_name: str, index: int = 0) -> tuple[dict[str, Any], str] | None:
        """
        Load widget by variable name.
        
        Args:
            var_name: Variable name group
            index: Index within the group (0 = most recent)
        
        Returns:
            Tuple of (widget_entry, code) if found, None otherwise
        """
        widgets_dict = self.index.get("widgets", {})
        if var_name not in widgets_dict:
            return None
        
        widgets_list = widgets_dict[var_name]
        if index >= len(widgets_list):
            return None
        
        widget_entry = widgets_list[index]
        widget_file = self.widgets_dir / widget_entry["file_name"]
        
        if not widget_file.exists():
            return None
        
        code = widget_file.read_text(encoding='utf-8')
        result = dict(widget_entry)
        result["var_name"] = var_name
        result["_index"] = index
        return result, code
    
    def load_from_file(self, file_path: Path | str) -> tuple[dict[str, Any], str] | None:
        """
        Load widget from a local JS file path.
        
        Args:
            file_path: Path to JavaScript file
        
        Returns:
            Tuple of (minimal_widget_entry, code) if file exists, None otherwise
        """
        file_path = Path(file_path)
        if not file_path.exists():
            return None
        
        code = file_path.read_text(encoding='utf-8')
        
        # Create minimal widget entry for external file
        widget_entry = {
            "var_name": file_path.stem,
            "file_name": file_path.name,
            "description": f"Loaded from {file_path}",
            "origin": "file",
            "file_path": str(file_path),
            "components": self.extract_components(code),
        }
        
        return widget_entry, code
    
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
    # Convenience accessor methods
    # -------------------------------------------------------------------------
    
    def get_recent_widgets(self, limit: int = 10) -> list[dict[str, Any]]:
        """
        Get the most recently created widgets across all var_names.
        
        Args:
            limit: Maximum number of widgets to return
        
        Returns:
            List of widget metadata dicts, newest first
        """
        all_widgets: list[tuple[str, dict[str, Any]]] = []
        widgets_dict = self.index.get("widgets", {})
        
        for var_name, widgets in widgets_dict.items():
            for widget in widgets:
                all_widgets.append((var_name, widget))
        
        # Sort by created_at (newest first)
        all_widgets.sort(key=lambda x: x[1].get("created_at") or "", reverse=True)
        
        result = []
        for var_name, widget in all_widgets[:limit]:
            entry = dict(widget)
            entry["var_name"] = var_name
            result.append(entry)
        
        return result
    
    def get_widgets_for_var_name(self, var_name: str) -> list[dict[str, Any]]:
        """
        Get all widgets for a specific variable name.
        
        Args:
            var_name: Variable name to look up
        
        Returns:
            List of widget metadata dicts, newest first
        """
        widgets_dict = self.index.get("widgets", {})
        widgets = widgets_dict.get(var_name, [])
        
        result = []
        for idx, widget in enumerate(widgets):
            entry = dict(widget)
            entry["var_name"] = var_name
            entry["_index"] = idx
            result.append(entry)
        
        return result
    
    def get_widgets_for_notebook(self, notebook_path: str) -> list[dict[str, Any]]:
        """
        Get all widgets created from a specific notebook.
        
        Args:
            notebook_path: Full path to the notebook file
        
        Returns:
            List of widget metadata dicts, newest first
        """
        result: list[dict[str, Any]] = []
        widgets_dict = self.index.get("widgets", {})
        
        for var_name, widgets in widgets_dict.items():
            for idx, widget in enumerate(widgets):
                if widget.get("notebook_path") == notebook_path:
                    entry = dict(widget)
                    entry["var_name"] = var_name
                    entry["_index"] = idx
                    result.append(entry)
        
        # Sort by created_at (newest first)
        result.sort(key=lambda x: x.get("created_at") or "", reverse=True)
        return result
    
    def get_revision_chain(self, var_name: str) -> list[dict[str, Any]]:
        """
        Get all widgets for a var_name, sorted by created_at (oldest first).
        
        This shows the evolution of a widget over time.
        
        Args:
            var_name: The variable name
        
        Returns:
            List of widget metadata dicts, oldest first
        """
        widgets = self.get_widgets_for_var_name(var_name)
        widgets.sort(key=lambda w: w.get("created_at") or "")
        return widgets
    
    def set_revision_parent(
        self,
        var_name: str,
        index: int,
        parent_cache_key: str,
    ) -> bool:
        """
        Set the revision_parent for a widget after creation.
        
        This is used to track edit chains (widget A was edited to create widget B).
        
        Args:
            var_name: Variable name group of the widget
            index: Index within the group
            parent_cache_key: Cache key of the parent widget
        
        Returns:
            True if updated successfully, False if widget not found
        """
        widgets_dict = self.index.get("widgets", {})
        if var_name not in widgets_dict:
            return False
        
        widgets_list = widgets_dict[var_name]
        if index >= len(widgets_list):
            return False
        
        widgets_list[index]["revision_parent"] = parent_cache_key
        self._save_index()
        return True
    
    def get_widget_by_cache_key(self, cache_key: str) -> dict[str, Any] | None:
        """
        Get widget metadata by cache key without loading the code.
        
        Args:
            cache_key: Full cache key hash
        
        Returns:
            Widget metadata dict if found, None otherwise
        """
        cache_index = self.index.get("cache_index", {})
        location = cache_index.get(cache_key)
        
        if not location:
            return None
        
        var_name, idx_str = location.split("/")
        idx = int(idx_str)
        
        widgets_dict = self.index.get("widgets", {})
        if var_name not in widgets_dict:
            return None
        
        widgets_list = widgets_dict[var_name]
        if idx >= len(widgets_list):
            return None
        
        result = dict(widgets_list[idx])
        result["var_name"] = var_name
        result["_index"] = idx
        return result
    
    def list_var_names(self) -> list[str]:
        """
        Get list of all variable names that have cached widgets.
        
        Returns:
            Sorted list of variable names
        """
        metadata = self.index.get("metadata", {})
        return metadata.get("var_names", [])
    
    def list_notebooks(self) -> list[str]:
        """
        Get list of all notebooks that have cached widgets.
        
        Returns:
            Sorted list of notebook paths
        """
        notebooks: set[str] = set()
        widgets_dict = self.index.get("widgets", {})
        
        for widgets in widgets_dict.values():
            for widget in widgets:
                notebook_path = widget.get("notebook_path")
                if notebook_path:
                    notebooks.add(notebook_path)
        
        return sorted(notebooks)
    
    def get_stats(self) -> dict[str, Any]:
        """
        Get statistics about the widget cache.
        
        Returns:
            Dict with total_count, var_names_count, oldest_created, newest_created
        """
        metadata = self.index.get("metadata", {})
        return {
            "total_count": metadata.get("total_count", 0),
            "var_names_count": len(metadata.get("var_names", [])),
            "oldest_created": metadata.get("oldest_created"),
            "newest_created": metadata.get("newest_created"),
        }
