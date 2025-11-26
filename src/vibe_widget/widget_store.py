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
        
        # Ensure directories exist
        self.widgets_dir.mkdir(parents=True, exist_ok=True)
        self.index_dir.mkdir(parents=True, exist_ok=True)
        
        # Load or initialize index
        self.index = self._load_index()
    
    def _load_index(self) -> dict[str, Any]:
        """Load the widget index from disk."""
        if self.index_file.exists():
            try:
                with open(self.index_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, OSError):
                # If index is corrupted, start fresh
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
        use_preprocessor: bool,
        context_fingerprint: str,
        exports_signature: str,
        imports_signature: str,
        agentic: bool,
    ) -> tuple[str, str]:
        """
        Compute cache key from simplified inputs.
        
        Args:
            description: User's description string
            data_var_name: Variable name of the data parameter (e.g., "df", "flights_df")
            model: Model name
            use_preprocessor: Whether preprocessor is used
            context_fingerprint: Hash of context dict or DataProfile
            exports_signature: Stable representation of exports
            imports_signature: Stable representation of imports
            agentic: Whether agentic mode is enabled
        
        Returns:
            (full_hash, short_hash) tuple
        """
        # Build stable cache input
        cache_input = {
            "description": description,
            "data_var_name": data_var_name or "",
            "model": model,
            "use_preprocessor": use_preprocessor,
            "context_fingerprint": context_fingerprint,
            "exports_signature": exports_signature,
            "imports_signature": imports_signature,
            "agentic": agentic,
        }
        
        # Compute hash
        cache_str = json.dumps(cache_input, sort_keys=True)
        full_hash = hashlib.sha256(cache_str.encode()).hexdigest()
        short_hash = full_hash[:10]
        
        return full_hash, short_hash
    
    def _generate_slug(self, description: str, data_var_name: str | None) -> str:
        """
        Generate human-readable slug from description.
        
        Args:
            description: User's description
            data_var_name: Variable name hint (optional)
        
        Returns:
            Slug string like "scatter_flights_by_delay"
        """
        # Take first ~8 meaningful words from description
        words = description.lower().split()
        # Filter out common stop words
        stop_words = {"a", "an", "the", "of", "in", "on", "at", "to", "for", "with", "by", "and", "or"}
        meaningful_words = [w for w in words if w not in stop_words][:8]
        
        # Clean and join
        slug_parts = []
        for word in meaningful_words:
            # Keep only alphanumerics
            cleaned = ''.join(c if c.isalnum() else '_' for c in word)
            if cleaned and cleaned != '_':
                slug_parts.append(cleaned)
        
        slug = '_'.join(slug_parts)
        
        # Collapse consecutive underscores
        while '__' in slug:
            slug = slug.replace('__', '_')
        
        # Trim and add data var hint if available
        slug = slug[:40]
        if data_var_name and len(slug) < 35:
            slug = f"{slug}_{data_var_name}"[:40]
        
        return slug.strip('_') or "widget"
    
    def _compute_context_fingerprint(self, context: Any) -> str:
        """Compute stable fingerprint for context."""
        if context is None:
            return ""
        
        # Import here to avoid circular dependency
        from vibe_widget.data_parser.data_profile import DataProfile
        
        if isinstance(context, DataProfile):
            # Use a stable summary of the profile
            summary = {
                "domain": context.inferred_domain,
                "purpose": context.dataset_purpose,
                "is_timeseries": context.is_timeseries,
                "is_geospatial": context.is_geospatial,
                "columns": [col.name for col in context.columns],
            }
            return hashlib.md5(json.dumps(summary, sort_keys=True).encode()).hexdigest()[:8]
        elif isinstance(context, dict):
            # Hash the dict
            return hashlib.md5(json.dumps(context, sort_keys=True).encode()).hexdigest()[:8]
        else:
            # Fallback: use string representation
            return hashlib.md5(str(context).encode()).hexdigest()[:8]
    
    def _compute_exports_signature(self, exports: dict[str, str] | None) -> str:
        """Compute stable signature for exports."""
        if not exports:
            return ""
        
        # Sort by key and create list of (name, description) tuples
        items = sorted(exports.items())
        return hashlib.md5(json.dumps(items).encode()).hexdigest()[:8]
    
    def _compute_imports_signature(self, imports_serialized: dict[str, str] | None) -> str:
        """Compute stable signature for imports."""
        if not imports_serialized:
            return ""
        
        # Sort by key and use the serialized descriptions
        items = sorted(imports_serialized.items())
        return hashlib.md5(json.dumps(items).encode()).hexdigest()[:8]
    
    def lookup(
        self,
        description: str,
        data_var_name: str | None,
        model: str,
        use_preprocessor: bool,
        context: Any,
        exports: dict[str, str] | None,
        imports_serialized: dict[str, str] | None,
        agentic: bool,
    ) -> dict[str, Any] | None:
        """
        Look up a cached widget by cache key.
        
        Returns:
            Widget metadata dict if found, None otherwise
        """
        # Compute signatures
        context_fingerprint = self._compute_context_fingerprint(context)
        exports_signature = self._compute_exports_signature(exports)
        imports_signature = self._compute_imports_signature(imports_serialized)
        
        # Compute cache key
        full_hash, short_hash = self._compute_cache_key(
            description=description,
            data_var_name=data_var_name,
            model=model,
            use_preprocessor=use_preprocessor,
            context_fingerprint=context_fingerprint,
            exports_signature=exports_signature,
            imports_signature=imports_signature,
            agentic=agentic,
        )
        
        # Search index
        for widget_entry in self.index["widgets"]:
            if widget_entry["hash"] == full_hash:
                # Check that file exists
                widget_file = self.widgets_dir / widget_entry["file_name"]
                if widget_file.exists():
                    # Update last_used_at
                    widget_entry["last_used_at"] = datetime.utcnow().isoformat()
                    self._save_index()
                    return widget_entry
                else:
                    # File missing, treat as cache miss
                    return None
        
        return None
    
    def save(
        self,
        widget_code: str,
        description: str,
        data_var_name: str | None,
        model: str,
        use_preprocessor: bool,
        context: Any,
        exports: dict[str, str] | None,
        imports_serialized: dict[str, str] | None,
        agentic: bool,
        notebook_path: str | None = None,
    ) -> dict[str, Any]:
        """
        Save a newly generated widget to the store.
        
        Returns:
            Widget metadata dict
        """
        # Compute signatures
        context_fingerprint = self._compute_context_fingerprint(context)
        exports_signature = self._compute_exports_signature(exports)
        imports_signature = self._compute_imports_signature(imports_serialized)
        
        # Compute cache key
        full_hash, short_hash = self._compute_cache_key(
            description=description,
            data_var_name=data_var_name,
            model=model,
            use_preprocessor=use_preprocessor,
            context_fingerprint=context_fingerprint,
            exports_signature=exports_signature,
            imports_signature=imports_signature,
            agentic=agentic,
        )
        
        # Generate slug
        slug = self._generate_slug(description, data_var_name)
        
        # Determine version
        existing_versions = [
            entry["version"]
            for entry in self.index["widgets"]
            if entry["slug"] == slug
        ]
        version = max(existing_versions) + 1 if existing_versions else 1
        
        # Build file name
        file_name = f"{slug}__{short_hash}__v{version}.js"
        
        # Write JS file
        widget_file = self.widgets_dir / file_name
        widget_file.write_text(widget_code, encoding='utf-8')
        
        # Create metadata entry
        widget_id = f"{short_hash}-v{version}"
        now = datetime.utcnow().isoformat()
        
        widget_entry = {
            "id": widget_id,
            "slug": slug,
            "hash": full_hash,
            "version": version,
            "file_name": file_name,
            # Inputs
            "description": description,
            "data_var_name": data_var_name,
            "model": model,
            "use_preprocessor": use_preprocessor,
            "context_fingerprint": context_fingerprint,
            "exports_signature": exports_signature,
            "imports_signature": imports_signature,
            "agentic": agentic,
            # Provenance
            "created_at": now,
            "last_used_at": now,
            "notebook_path": notebook_path,
            "tags": [],
            # Relations
            "origin": "local",
            "remote_url": None,
            "base_widget_id": None,
        }
        
        # Append to index
        self.index["widgets"].append(widget_entry)
        self._save_index()
        
        return widget_entry
    
    def load_widget_code(self, widget_entry: dict[str, Any]) -> str:
        """Load widget JS code from disk."""
        widget_file = self.widgets_dir / widget_entry["file_name"]
        return widget_file.read_text(encoding='utf-8')
    
    def get_notebook_path(self) -> str | None:
        """
        Try to infer the current notebook path from IPython.
        
        Returns:
            Notebook path string or None if not in a notebook
        """
        try:
            from IPython import get_ipython
            ipython = get_ipython()
            
            if ipython is not None and hasattr(ipython, 'kernel'):
                # Try to get notebook name from kernel
                try:
                    # This works in Jupyter notebook/lab
                    import json
                    from pathlib import Path
                    
                    # Try multiple approaches to get notebook name
                    # Approach 1: Check if we're in a notebook with a file
                    if hasattr(ipython, 'user_ns'):
                        user_ns = ipython.user_ns
                        if '__vsc_ipynb_file__' in user_ns:
                            return user_ns['__vsc_ipynb_file__']
                    
                    # Approach 2: Get connection file and try to find notebook
                    connection_file = Path(ipython.kernel.config['IPKernelApp']['connection_file'])
                    kernel_id = connection_file.stem.split('-', 1)[-1]
                    
                    # In Jupyter, we could search for sessions, but that requires jupyter_client
                    # For now, just return None - notebook path is optional
                    return None
                except Exception:
                    return None
            
            return None
        except Exception:
            return None
