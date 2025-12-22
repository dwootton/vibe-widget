"""
Widget storage and caching system.

Stores generated widget JS files in a project-root `.vibewidget/` directory
with a JSON index for quick lookup and versioning.
"""
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any


class WidgetStore:
    """Manages widget persistence and caching in .vibewidget/ directory."""
    
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
    
    def _load_index(self) -> dict[str, Any]:
        """Load the widget index from disk."""
        if self.index_file.exists():
            try:
                with open(self.index_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, OSError):
                return {"schema_version": 1, "widgets": []}
        else:
            return {"schema_version": 1, "widgets": []}
    
    def _save_index(self):
        """Save the widget index to disk."""
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(self.index, f, indent=2, ensure_ascii=False)

    def clear(self) -> int:
        """Remove all cached widgets and reset the index."""
        removed = 0
        for entry in list(self.index.get("widgets", [])):
            file_name = entry.get("file_name")
            if not file_name:
                continue
            widget_file = self.widgets_dir / file_name
            if widget_file.exists():
                widget_file.unlink()
                removed += 1
        self.index = {"schema_version": 1, "widgets": []}
        self._save_index()
        return removed

    def clear_for_widget(self, *, widget_id: str | None = None, slug: str | None = None) -> int:
        """Remove cached widgets that match the given widget id or slug."""
        if not widget_id and not slug:
            return 0
        removed = 0
        remaining = []
        for entry in self.index.get("widgets", []):
            matches = False
            if widget_id and entry.get("id") == widget_id:
                matches = True
            if slug and entry.get("slug") == slug:
                matches = True
            if matches:
                file_name = entry.get("file_name")
                if file_name:
                    widget_file = self.widgets_dir / file_name
                    if widget_file.exists():
                        widget_file.unlink()
                        removed += 1
            else:
                remaining.append(entry)
        if removed:
            self.index["widgets"] = remaining
            self._save_index()
        return removed
    
    def _compute_cache_key(
        self,
        description: str,
        data_var_name: str | None,
        data_shape: tuple[int, int],
        exports_signature: str,
        imports_signature: str,
        theme_signature: str,
    ) -> tuple[str, str]:
        """
        Compute cache key from inputs.
        Only hashes: stripped description, var name, data shape, exports, imports, and theme.
        Does NOT include model or notebook path to avoid unnecessary regeneration.
        
        Returns:
            (full_hash, short_hash) tuple
        """
        # Strip whitespace from description for consistent hashing
        stripped_description = " ".join(description.split())
        
        cache_input = {
            "description": stripped_description,
            "data_var_name": data_var_name or "",
            "data_shape": list(data_shape),
            "exports_signature": exports_signature,
            "imports_signature": imports_signature,
            "theme_signature": theme_signature,
        }
        
        cache_str = json.dumps(cache_input, sort_keys=True)
        full_hash = hashlib.sha256(cache_str.encode()).hexdigest()
        short_hash = full_hash[:10]
        
        return full_hash, short_hash
    
    def _generate_slug(self, description: str, data_var_name: str | None) -> str:
        """Generate human-readable slug from description."""
        words = description.lower().split()
        stop_words = {"a", "an", "the", "of", "in", "on", "at", "to", "for", "with", "by", "and", "or", "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself", "they", "them", "their", "theirs", "themselves", "what", "which", "who", "whom", "this", "that", "these", "those", "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing", "a", "an", "the", "and", "but", "if", "or", "because", "as", "until", "while", "of", "at", "by", "for", "with", "about", "against", "between", "into", "through", "during", "before", "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now"}
        meaningful_words = [w for w in words if w not in stop_words][:8]
        
        slug_parts = []
        for word in meaningful_words:
            cleaned = ''.join(c if c.isalnum() else '_' for c in word)
            if cleaned and cleaned != '_':
                slug_parts.append(cleaned)
        
        slug = '_'.join(slug_parts)
        
        while '__' in slug:
            slug = slug.replace('__', '_')
        
        slug = slug[:40]
        if data_var_name and len(slug) < 35:
            slug = f"{slug}_{data_var_name}"[:40]
        
        return slug.strip('_') or "widget"
    
    def _compute_exports_signature(self, exports: dict[str, str] | None) -> str:
        """Compute stable signature for exports."""
        if not exports:
            return ""
        items = sorted(exports.items())
        return hashlib.md5(json.dumps(items).encode()).hexdigest()[:8]
    
    def _compute_imports_signature(self, imports_serialized: dict[str, str] | None) -> str:
        """Compute stable signature for imports."""
        if not imports_serialized:
            return ""
        items = sorted(imports_serialized.items())
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
        data_var_name: str | None,
        data_shape: tuple[int, int],
        exports: dict[str, str] | None,
        imports_serialized: dict[str, str] | None,
        theme_description: str | None,
    ) -> dict[str, Any] | None:
        """
        Look up a cached widget by cache key.
        
        Args:
            description: Widget description
            data_var_name: Variable name of the data
            data_shape: Shape of the data as (rows, columns)
            exports: Export trait definitions
            imports_serialized: Import trait values
        
        Returns:
            Widget metadata dict if found, None otherwise
        """
        exports_signature = self._compute_exports_signature(exports)
        imports_signature = self._compute_imports_signature(imports_serialized)
        theme_signature = self._compute_theme_signature(theme_description)
        
        full_hash, short_hash = self._compute_cache_key(
            description=description,
            data_var_name=data_var_name,
            data_shape=data_shape,
            exports_signature=exports_signature,
            imports_signature=imports_signature,
            theme_signature=theme_signature,
        )
        
        matching_entries = [
            entry for entry in self.index["widgets"]
            if entry.get("hash") == full_hash
        ]
        
        if not matching_entries:
            return None
        
        # Prefer the highest version for this cache key (latest saved)
        matching_entries.sort(key=lambda e: e.get("version", 0), reverse=True)
        
        for widget_entry in matching_entries:
            widget_file = self.widgets_dir / widget_entry["file_name"]
            if widget_file.exists():
                widget_entry["last_used_at"] = datetime.utcnow().isoformat()
                self._save_index()
                return widget_entry
        
        return None
    
    def save(
        self,
        widget_code: str,
        description: str,
        data_var_name: str | None,
        data_shape: tuple[int, int],
        model: str,
        exports: dict[str, str] | None,
        imports_serialized: dict[str, str] | None,
        theme_name: str | None = None,
        theme_description: str | None = None,
        notebook_path: str | None = None,
    ) -> dict[str, Any]:
        """
        Save a newly generated widget to the store.
        
        Args:
            widget_code: Generated JavaScript code
            description: Widget description
            data_var_name: Variable name of the data
            data_shape: Shape of the data as (rows, columns)
            model: Model used for generation (stored for reference, not in cache key)
            exports: Export trait definitions
            imports_serialized: Import trait values
            notebook_path: Path to notebook (stored for reference, not in cache key)
        
        Returns:
            Widget metadata dict
        """
        exports_signature = self._compute_exports_signature(exports)
        imports_signature = self._compute_imports_signature(imports_serialized)
        theme_signature = self._compute_theme_signature(theme_description)
        
        full_hash, short_hash = self._compute_cache_key(
            description=description,
            data_var_name=data_var_name,
            data_shape=data_shape,
            exports_signature=exports_signature,
            imports_signature=imports_signature,
            theme_signature=theme_signature,
        )
        
        slug = self._generate_slug(description, data_var_name)
        
        existing_versions = [
            entry["version"]
            for entry in self.index["widgets"]
            if entry["slug"] == slug
        ]
        version = max(existing_versions) + 1 if existing_versions else 1
        
        file_name = f"{slug}__{short_hash}__v{version}.js"
        
        widget_file = self.widgets_dir / file_name
        widget_file.write_text(widget_code, encoding='utf-8')
        
        widget_id = f"{short_hash}-v{version}"
        now = datetime.utcnow().isoformat()
        
        # Extract components from generated code
        components = self.extract_components(widget_code)
        
        widget_entry = {
            "id": widget_id,
            "slug": slug,
            "hash": full_hash,
            "version": version,
            "file_name": file_name,
            "description": description,
            "data_var_name": data_var_name,
            "data_shape": list(data_shape),  # Convert tuple to list for JSON
            "model": model,
            "exports_signature": exports_signature,
            "imports_signature": imports_signature,
            "theme_signature": theme_signature,
            "theme_name": theme_name,
            "theme_description": theme_description,
            "created_at": now,
            "last_used_at": now,
            "notebook_path": notebook_path,
            "tags": [],
            "origin": "local",
            "remote_url": None,
            "base_widget_id": None,
            "components": components,
        }
        
        self.index["widgets"].append(widget_entry)
        self._save_index()
        
        return widget_entry
    
    def load_widget_code(self, widget_entry: dict[str, Any]) -> str:
        """Load widget JS code from disk."""
        widget_file = self.widgets_dir / widget_entry["file_name"]
        return widget_file.read_text(encoding='utf-8')
    
    def load_by_id(self, widget_id: str) -> tuple[dict[str, Any], str] | None:
        """
        Load widget by ID.
        
        Args:
            widget_id: Widget ID (format: {short_hash}-v{version})
        
        Returns:
            Tuple of (widget_entry, code) if found, None otherwise
        """
        for widget_entry in self.index["widgets"]:
            if widget_entry["id"] == widget_id:
                widget_file = self.widgets_dir / widget_entry["file_name"]
                if widget_file.exists():
                    code = widget_file.read_text(encoding='utf-8')
                    return widget_entry, code
        return None
    
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
            "id": f"file-{file_path.stem}",
            "slug": file_path.stem,
            "file_name": file_path.name,
            "description": f"Loaded from {file_path}",
            "origin": "file",
            "file_path": str(file_path),
            "components": self.extract_components(code),
        }
        
        return widget_entry, code
    
    def extract_components(self, code: str) -> list[str]:
        """
        Extract named exports (components) from JavaScript code.
        
        Detects patterns like:
        - export const ComponentName = ...
        - export function ComponentName(...) {...}
        - export class ComponentName {...}
        
        Args:
            code: JavaScript code
        
        Returns:
            List of component names found
        """
        components = []
        
        # Match: export const Name = ...
        const_exports = re.findall(r'export\s+const\s+([A-Z][a-zA-Z0-9_]*)\s*=', code)
        components.extend(const_exports)
        
        # Match: export function Name(...) {...}
        func_exports = re.findall(r'export\s+function\s+([A-Z][a-zA-Z0-9_]*)\s*\(', code)
        components.extend(func_exports)
        
        # Match: export class Name {...}
        class_exports = re.findall(r'export\s+class\s+([A-Z][a-zA-Z0-9_]*)\s*\{', code)
        components.extend(class_exports)
        
        return list(set(components))  # Remove duplicates
    
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
