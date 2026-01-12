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
        self._bundle_rev = "v6-package-cache"

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
            build_path = tmp_path / "bundle.cjs"
            out_path = tmp_path / "bundle.js"

            entry_path.write_text(source, encoding="utf-8")
            shim_path.write_text(_react_shim_source(), encoding="utf-8")
            dom_shim_path.write_text(_react_dom_shim_source(), encoding="utf-8")
            dom_client_shim_path.write_text(_react_dom_client_shim_source(), encoding="utf-8")
            build_path.write_text(_build_script_source(), encoding="utf-8")

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


def _build_script_source() -> str:
    return """const esbuild = require("esbuild");
const path = require("path");

const entry = process.argv[2];
const outfile = process.argv[3];
const shimPath = path.join(process.cwd(), "react-shim.js");
const domShimPath = path.join(process.cwd(), "react-dom-shim.js");
const domClientShimPath = path.join(process.cwd(), "react-dom-client-shim.js");

const reactAlias = {
  name: "react-alias",
  setup(build) {
    const aliasMap = {
      "react": shimPath,
      "react/jsx-runtime": shimPath,
      "react-dom": domShimPath,
      "react-dom/client": domClientShimPath,
      "preact": shimPath,
      "preact/compat": shimPath,
      "preact/hooks": shimPath
    };
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.path.startsWith("/react-dom/client")) {
        return { path: domClientShimPath };
      }
      if (args.path.startsWith("/react-dom")) {
        return { path: domShimPath };
      }
      if (args.path.startsWith("/react/jsx-runtime")) {
        return { path: shimPath };
      }
      if (args.path.startsWith("/react") || args.path.startsWith("/preact")) {
        return { path: shimPath };
      }
      if (args.path.startsWith("http://") || args.path.startsWith("https://")) {
        try {
          const parsed = new URL(args.path);
          const path = parsed.pathname || "";
          if (path.startsWith("/react-dom/client")) {
            return { path: domClientShimPath };
          }
          if (path.startsWith("/react-dom")) {
            return { path: domShimPath };
          }
          if (path.startsWith("/react/jsx-runtime")) {
            return { path: shimPath };
          }
          if (path.startsWith("/react")) {
            return { path: shimPath };
          }
          if (path.startsWith("/preact")) {
            return { path: shimPath };
          }
        } catch (err) {
          // ignore URL parse errors
        }
      }
      if (aliasMap[args.path]) {
        return { path: aliasMap[args.path] };
      }
      return null;
    });
  }
};

const httpPlugin = {
  name: "http-loader",
  setup(build) {
    build.onResolve({ filter: /^https?:\\/\\// }, (args) => ({
      path: args.path,
      namespace: "http-url"
    }));

    build.onResolve({ filter: /.*/, namespace: "http-url" }, (args) => {
      if (!args.importer) {
        return null;
      }
      try {
        const resolved = new URL(args.path, args.importer).toString();
        return { path: resolved, namespace: "http-url" };
      } catch (err) {
        return null;
      }
    });

    build.onLoad({ filter: /.*/, namespace: "http-url" }, async (args) => {
      const response = await fetch(args.path);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${args.path}: ${response.status}`);
      }
      const contents = await response.text();
      let loader = "js";
      if (args.path.endsWith(".tsx")) loader = "tsx";
      else if (args.path.endsWith(".ts")) loader = "ts";
      else if (args.path.endsWith(".jsx")) loader = "jsx";
      return { contents, loader };
    });
  }
};

esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  outfile,
  absWorkingDir: process.env.VIBE_PKG_DIR || process.cwd(),
  nodePaths: process.env.VIBE_PKG_DIR ? [path.join(process.env.VIBE_PKG_DIR, "node_modules")] : [],
  logLevel: "silent",
  plugins: [reactAlias, httpPlugin],
  jsx: "transform",
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  define: {
    "process.env.NODE_ENV": "\\"production\\""
  }
}).catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
"""


def _react_shim_source() -> str:
    return """const React = globalThis.__VIBE_REACT;
if (!React) {
  throw new Error("React runtime not available. Ensure the host provides __VIBE_REACT.");
}

export default React;
export const Children = React.Children;
export const Fragment = React.Fragment;
export const StrictMode = React.StrictMode;
export const Suspense = React.Suspense;
export const cloneElement = React.cloneElement;
export const createContext = React.createContext;
export const createElement = React.createElement;
export const createRef = React.createRef;
export const forwardRef = React.forwardRef;
export const isValidElement = React.isValidElement;
export const lazy = React.lazy;
export const memo = React.memo;
export const startTransition = React.startTransition;
export const use = React.use;
export const useCallback = React.useCallback;
export const useContext = React.useContext;
export const useDebugValue = React.useDebugValue;
export const useDeferredValue = React.useDeferredValue;
export const useEffect = React.useEffect;
export const useId = React.useId;
export const useImperativeHandle = React.useImperativeHandle;
export const useInsertionEffect = React.useInsertionEffect;
export const useLayoutEffect = React.useLayoutEffect;
export const useMemo = React.useMemo;
export const useReducer = React.useReducer;
export const useRef = React.useRef;
export const useState = React.useState;
export const useSyncExternalStore = React.useSyncExternalStore;
export const useTransition = React.useTransition;
export const version = React.version;
export const jsx = React.jsx || React.createElement;
export const jsxs = React.jsxs || React.createElement;
export const jsxDEV = React.jsxDEV || React.createElement;
"""


def _react_dom_shim_source() -> str:
    return """const ReactDOM = globalThis.__VIBE_REACT_DOM || {};
export const createPortal = ReactDOM.createPortal;
export const flushSync = ReactDOM.flushSync;
export default ReactDOM;
"""


def _react_dom_client_shim_source() -> str:
    return """const ReactDOMClient = globalThis.__VIBE_REACT_DOM_CLIENT || globalThis.__VIBE_REACT_DOM || {};
export const createRoot = ReactDOMClient.createRoot;
export default ReactDOMClient;
"""


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
        packages.add(name)
    return packages


def _extract_import_specifiers(source: str) -> list[str]:
    specs: list[str] = []
    if not source:
        return specs
    for match in re.finditer(r'from\\s+["\\\']([^"\\\']+)["\\\']', source):
        specs.append(match.group(1))
    for match in re.finditer(r'require\\(\\s*["\\\']([^"\\\']+)["\\\']\\s*\\)', source):
        specs.append(match.group(1))
    for match in re.finditer(r'import\\(\\s*["\\\']([^"\\\']+)["\\\']\\s*\\)', source):
        specs.append(match.group(1))
    return specs
