"""
Widget storage and caching system.

Stores generated widget JS files in a project-root `.vibewidget/` directory
with a JSON index for quick lookup and versioning.
"""
import hashlib
import json
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
    
    def _compute_cache_key(
        self,
        description: str,
        data_var_name: str | None,
        model: str,
        exports_signature: str,
        imports_signature: str,
    ) -> tuple[str, str]:
        """
        Compute cache key from inputs.
        
        Returns:
            (full_hash, short_hash) tuple
        """
        cache_input = {
            "description": description,
            "data_var_name": data_var_name or "",
            "model": model,
            "exports_signature": exports_signature,
            "imports_signature": imports_signature,
        }
        
        cache_str = json.dumps(cache_input, sort_keys=True)
        full_hash = hashlib.sha256(cache_str.encode()).hexdigest()
        short_hash = full_hash[:10]
        
        return full_hash, short_hash
    
    def _generate_slug(self, description: str, data_var_name: str | None) -> str:
        """Generate human-readable slug from description."""
        words = description.lower().split()
        stop_words = {"a", "an", "the", "of", "in", "on", "at", "to", "for", "with", "by", "and", "or"}
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
    
    def lookup(
        self,
        description: str,
        data_var_name: str | None,
        model: str,
        exports: dict[str, str] | None,
        imports_serialized: dict[str, str] | None,
    ) -> dict[str, Any] | None:
        """
        Look up a cached widget by cache key.
        
        Returns:
            Widget metadata dict if found, None otherwise
        """
        exports_signature = self._compute_exports_signature(exports)
        imports_signature = self._compute_imports_signature(imports_serialized)
        
        full_hash, short_hash = self._compute_cache_key(
            description=description,
            data_var_name=data_var_name,
            model=model,
            exports_signature=exports_signature,
            imports_signature=imports_signature,
        )
        
        for widget_entry in self.index["widgets"]:
            if widget_entry["hash"] == full_hash:
                widget_file = self.widgets_dir / widget_entry["file_name"]
                if widget_file.exists():
                    widget_entry["last_used_at"] = datetime.utcnow().isoformat()
                    self._save_index()
                    return widget_entry
                else:
                    return None
        
        return None
    
    def save(
        self,
        widget_code: str,
        description: str,
        data_var_name: str | None,
        model: str,
        exports: dict[str, str] | None,
        imports_serialized: dict[str, str] | None,
        notebook_path: str | None = None,
    ) -> dict[str, Any]:
        """
        Save a newly generated widget to the store.
        
        Returns:
            Widget metadata dict
        """
        exports_signature = self._compute_exports_signature(exports)
        imports_signature = self._compute_imports_signature(imports_serialized)
        
        full_hash, short_hash = self._compute_cache_key(
            description=description,
            data_var_name=data_var_name,
            model=model,
            exports_signature=exports_signature,
            imports_signature=imports_signature,
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
        
        widget_entry = {
            "id": widget_id,
            "slug": slug,
            "hash": full_hash,
            "version": version,
            "file_name": file_name,
            "description": description,
            "data_var_name": data_var_name,
            "model": model,
            "exports_signature": exports_signature,
            "imports_signature": imports_signature,
            "created_at": now,
            "last_used_at": now,
            "notebook_path": notebook_path,
            "tags": [],
            "origin": "local",
            "remote_url": None,
            "base_widget_id": None,
        }
        
        self.index["widgets"].append(widget_entry)
        self._save_index()
        
        return widget_entry
    
    def load_widget_code(self, widget_entry: dict[str, Any]) -> str:
        """Load widget JS code from disk."""
        widget_file = self.widgets_dir / widget_entry["file_name"]
        return widget_file.read_text(encoding='utf-8')
    
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
