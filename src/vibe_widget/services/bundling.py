"""Server-side bundling for widget code."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
import shutil
import subprocess
import tempfile

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
        self._root = (store_dir or Path.cwd()) / ".vibewidget" / "bundles"
        self._root.mkdir(parents=True, exist_ok=True)
        self._node_path = self._resolve_node_modules()

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

    def bundle(self, source: str) -> BundleResult:
        """Bundle source code; fall back to raw source if unavailable."""
        if not source:
            return BundleResult(code="", bundled=False, error="no_source")
        if not self._bundler_available():
            return BundleResult(code=source, bundled=False, error="bundler_unavailable")

        code_hash = compute_code_hash(source)
        target = self._root / f"{code_hash}.js"
        if target.exists():
            return BundleResult(code=target.read_text(encoding="utf-8"), bundled=True, cache_hit=True)

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
            target.write_text(bundled, encoding="utf-8")
            return BundleResult(code=bundled, bundled=True)


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
