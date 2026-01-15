"""Server-side bundling for widget code."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
import shutil
import subprocess
import tempfile
import json
import re

from vibe_widget.utils.audit_store import compute_code_hash


# Path to bundler assets
_BUNDLER_DIR = Path(__file__).resolve().parent.parent / "bundler"


@dataclass
class BundleResult:
    """Result of a bundle attempt."""

    code: str
    bundled: bool
    error: str | None = None
    cache_hit: bool = False


class BundleService:
    """Bundle widget code with an esbuild-based React shim."""

    def __init__(self, store_dir: Path | None = None):
        base_dir = store_dir or Path.cwd()
        self._root = base_dir / ".vibewidget" / "bundles"
        self._packages_dir = base_dir / ".vibewidget" / "packages"
        self._root.mkdir(parents=True, exist_ok=True)
        self._packages_dir.mkdir(parents=True, exist_ok=True)
        self._node_path = self._resolve_node_modules()
        self._bundle_rev = "v10-auto-react-import"

    def _resolve_node_modules(self) -> str | None:
        repo_root = Path(__file__).resolve().parents[3]
        candidate = repo_root / "node_modules"
        if candidate.exists():
            return str(candidate)
        return None

    def _bundler_available(self) -> bool:
        if os.getenv("VIBE_DISABLE_BUNDLING") == "1":
            return False
        if shutil.which("node") is None:
            return False
        if self._node_path is None:
            return False
        if not (Path(self._node_path) / "esbuild").exists():
            return False
        return True

    def bundle_key(self, source: str) -> str:
        """Stable cache key for a source string."""
        return compute_code_hash(f"{self._bundle_rev}:{source}")

    def bundle(self, source: str) -> BundleResult:
        """Bundle source code; fall back to raw source if unavailable."""
        if not source:
            return BundleResult(code="", bundled=False, error="no_source")
        if not self._bundler_available():
            return BundleResult(code=source, bundled=False, error="bundler_unavailable")

        deps_result = self._ensure_package_deps(source)
        if deps_result:
            return BundleResult(code=source, bundled=False, error=deps_result)

        code_hash = self.bundle_key(source)
        target = self._root / f"{code_hash}.js"
        if target.exists():
            cached = target.read_text(encoding="utf-8")
            return BundleResult(code=cached, bundled=True, cache_hit=True)

        with tempfile.TemporaryDirectory(prefix="vibe-bundle-") as tmpdir:
            tmp_path = Path(tmpdir)
            entry_path = tmp_path / "entry.jsx"
            shim_path = tmp_path / "react-shim.js"
            dom_shim_path = tmp_path / "react-dom-shim.js"
            dom_client_shim_path = tmp_path / "react-dom-client-shim.js"
            scheduler_shim_path = tmp_path / "scheduler-shim.js"
            react_is_shim_path = tmp_path / "react-is-shim.js"
            build_path = tmp_path / "bundle.cjs"
            out_path = tmp_path / "bundle.js"

            # Ensure React is imported for JSX transform (React.createElement)
            # Only add if not already importing React
            entry_source = source
            if not _has_react_import(source):
                entry_source = "import React from 'react';\n" + source
            entry_path.write_text(entry_source, encoding="utf-8")
            shim_path.write_text(_load_bundler_asset("react-shim.js"), encoding="utf-8")
            dom_shim_path.write_text(_load_bundler_asset("react-dom-shim.js"), encoding="utf-8")
            dom_client_shim_path.write_text(_load_bundler_asset("react-dom-client-shim.js"), encoding="utf-8")
            scheduler_shim_path.write_text(_load_bundler_asset("scheduler-shim.js"), encoding="utf-8")
            react_is_shim_path.write_text(_load_bundler_asset("react-is-shim.js"), encoding="utf-8")
            build_path.write_text(_load_bundler_asset("build.cjs"), encoding="utf-8")

            env = os.environ.copy()
            if self._node_path:
                env["NODE_PATH"] = self._node_path
            env["VIBE_PKG_DIR"] = str(self._packages_dir)

            result = subprocess.run(
                ["node", str(build_path), str(entry_path), str(out_path)],
                cwd=str(tmp_path),
                capture_output=True,
                text=True,
                env=env,
                timeout=60,
            )

            if result.returncode != 0:
                error = (result.stderr or result.stdout or "bundle_failed").strip()
                return BundleResult(code=source, bundled=False, error=error)

            bundled = out_path.read_text(encoding="utf-8")
            bundled_with_marker = f"/*__VIBE_BUNDLED__*/\n{bundled}"
            target.write_text(bundled_with_marker, encoding="utf-8")
            return BundleResult(code=bundled_with_marker, bundled=True)

    def _ensure_package_deps(self, source: str) -> str | None:
        package_names = _extract_package_names(source)
        if not package_names:
            return None
        package_json = self._packages_dir / "package.json"
        if not package_json.exists():
            package_json.write_text(json.dumps({"name": "vibewidget-cache", "private": True}), encoding="utf-8")
        node_modules = self._packages_dir / "node_modules"
        if not node_modules.exists():
            node_modules.mkdir(parents=True, exist_ok=True)
        missing = []
        for name in sorted(package_names):
            if not (node_modules / name.split("/", 1)[0]).exists():
                missing.append(name)
        if not missing:
            return None
        if shutil.which("npm") is None:
            return "npm_not_available"
        try:
            result = subprocess.run(
                ["npm", "install", "--no-save", "--silent", "--prefix", str(self._packages_dir), *missing],
                capture_output=True,
                text=True,
                timeout=120,
            )
        except Exception as exc:
            return f"npm_install_failed: {exc}"
        if result.returncode != 0:
            stderr = (result.stderr or result.stdout or "").strip()
            return f"npm_install_failed: {stderr or 'unknown_error'}"
        return None


def _load_bundler_asset(filename: str) -> str:
    """Load a bundler asset file."""
    asset_path = _BUNDLER_DIR / filename
    return asset_path.read_text(encoding="utf-8")


# Packages that are shimmed by the bundler and should NOT be npm installed
SHIMMED_PACKAGES = frozenset([
    "react",
    "react-dom",
    "preact",
    "scheduler",
    "react-is",
])


def _has_react_import(source: str) -> bool:
    """Check if source already imports React."""
    if not source:
        return False
    # Check for various React import patterns
    patterns = [
        r"import\s+React",  # import React from 'react'
        r"import\s+\*\s+as\s+React",  # import * as React from 'react'
        r"import\s+{[^}]*}\s+from\s+['\"]react['\"]",  # import { useState } from 'react'
        r"from\s+['\"]react['\"]",  # any from 'react'
        r"require\s*\(\s*['\"]react['\"]\s*\)",  # require('react')
    ]
    for pattern in patterns:
        if re.search(pattern, source):
            return True
    return False


def _extract_package_names(source: str) -> set[str]:
    packages: set[str] = set()
    if not source:
        return packages
    for spec in _extract_import_specifiers(source):
        if not spec or spec.startswith((".", "/", "http://", "https://")):
            continue
        name = spec
        if spec.startswith("@"):
            parts = spec.split("/")
            if len(parts) >= 2:
                name = "/".join(parts[:2])
        else:
            name = spec.split("/", 1)[0]
        # Skip shimmed packages - they're provided by the host runtime
        if name in SHIMMED_PACKAGES:
            continue
        packages.add(name)
    return packages


def _extract_import_specifiers(source: str) -> list[str]:
    specs: list[str] = []
    if not source:
        return specs
    for match in re.finditer(r'from\s+["\']([^"\']+)["\']', source):
        specs.append(match.group(1))
    for match in re.finditer(r'require\(\s*["\']([^"\']+)["\']\s*\)', source):
        specs.append(match.group(1))
    for match in re.finditer(r'import\(\s*["\']([^"\']+)["\']\s*\)', source):
        specs.append(match.group(1))
    return specs
