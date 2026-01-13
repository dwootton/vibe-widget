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
            shim_path.write_text(_react_shim_source(), encoding="utf-8")
            dom_shim_path.write_text(_react_dom_shim_source(), encoding="utf-8")
            dom_client_shim_path.write_text(_react_dom_client_shim_source(), encoding="utf-8")
            scheduler_shim_path.write_text(_scheduler_shim_source(), encoding="utf-8")
            react_is_shim_path.write_text(_react_is_shim_source(), encoding="utf-8")
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
const schedulerShimPath = path.join(process.cwd(), "scheduler-shim.js");
const reactIsShimPath = path.join(process.cwd(), "react-is-shim.js");

// Exact package names that should be aliased to shims
// Using a Set for O(1) lookup
const REACT_SHIM_PACKAGES = new Set([
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "preact",
  "preact/compat",
  "preact/hooks",
  "preact/jsx-runtime"
]);

const REACT_DOM_SHIM_PACKAGES = new Set([
  "react-dom",
  "react-dom/server",
  "react-dom/server.browser",
  "react-dom/test-utils"
]);

const REACT_DOM_CLIENT_SHIM_PACKAGES = new Set([
  "react-dom/client"
]);

const SCHEDULER_SHIM_PACKAGES = new Set([
  "scheduler",
  "scheduler/tracing"
]);

const REACT_IS_SHIM_PACKAGES = new Set([
  "react-is"
]);

// Check if a path matches a React package (exact match or subpath)
function isReactPackage(importPath) {
  // Exact match checks first (fast path)
  if (REACT_SHIM_PACKAGES.has(importPath)) return { shim: "react" };
  if (REACT_DOM_CLIENT_SHIM_PACKAGES.has(importPath)) return { shim: "react-dom-client" };
  if (REACT_DOM_SHIM_PACKAGES.has(importPath)) return { shim: "react-dom" };
  if (SCHEDULER_SHIM_PACKAGES.has(importPath)) return { shim: "scheduler" };
  if (REACT_IS_SHIM_PACKAGES.has(importPath)) return { shim: "react-is" };

  // Check for subpaths (e.g., "react/cjs/react.production.min.js")
  for (const pkg of REACT_SHIM_PACKAGES) {
    if (importPath === pkg || importPath.startsWith(pkg + "/")) {
      return { shim: "react" };
    }
  }
  for (const pkg of REACT_DOM_CLIENT_SHIM_PACKAGES) {
    if (importPath === pkg || importPath.startsWith(pkg + "/")) {
      return { shim: "react-dom-client" };
    }
  }
  for (const pkg of REACT_DOM_SHIM_PACKAGES) {
    if (importPath === pkg || importPath.startsWith(pkg + "/")) {
      return { shim: "react-dom" };
    }
  }
  for (const pkg of SCHEDULER_SHIM_PACKAGES) {
    if (importPath === pkg || importPath.startsWith(pkg + "/")) {
      return { shim: "scheduler" };
    }
  }
  for (const pkg of REACT_IS_SHIM_PACKAGES) {
    if (importPath === pkg || importPath.startsWith(pkg + "/")) {
      return { shim: "react-is" };
    }
  }

  return null;
}

// Parse a URL pathname to extract the package name
// Handles CDN URL formats like:
//   /react@18.2.0 -> react
//   /v135/react@18.2.0/es2022/react.mjs -> react
//   /@tanstack/react-virtual@3.0.0 -> @tanstack/react-virtual
function extractPackageFromUrlPath(urlPath) {
  // Remove leading slash
  let p = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath;

  // Remove version prefix like "v135/" or "stable/"
  p = p.replace(/^(v\\d+|stable)\\//, "");

  // Handle scoped packages (@org/pkg)
  let pkgName;
  if (p.startsWith("@")) {
    // Scoped package: @org/pkg@version or @org/pkg/subpath
    const match = p.match(/^(@[^/]+\\/[^/@]+)/);
    if (match) {
      pkgName = match[1];
    }
  } else {
    // Regular package: pkg@version or pkg/subpath
    const match = p.match(/^([^/@]+)/);
    if (match) {
      pkgName = match[1];
    }
  }

  if (!pkgName) return null;

  // Remove version suffix (@18.2.0)
  pkgName = pkgName.replace(/@[^/]+$/, "");

  // Get the rest of the path after the package name
  const restStart = p.indexOf(pkgName) + pkgName.length;
  let rest = p.slice(restStart);

  // Remove version from rest if present
  rest = rest.replace(/^@[^/]+/, "");

  // Clean up subpath
  if (rest.startsWith("/")) {
    rest = rest.slice(1);
  }

  // Build the full import path
  if (rest && !rest.includes(".")) {
    // It's a subpath like "jsx-runtime"
    return pkgName + "/" + rest.split("/")[0];
  }

  return pkgName;
}

// Map shim type to path
function getShimPath(shimType) {
  switch (shimType) {
    case "react": return shimPath;
    case "react-dom": return domShimPath;
    case "react-dom-client": return domClientShimPath;
    case "scheduler": return schedulerShimPath;
    case "react-is": return reactIsShimPath;
    default: return null;
  }
}

const DEBUG = process.env.VIBE_BUNDLE_DEBUG === "1";

const reactAlias = {
  name: "react-alias",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      const importPath = args.path;

      // Handle HTTP/HTTPS URLs (CDN imports)
      if (importPath.startsWith("http://") || importPath.startsWith("https://")) {
        try {
          const parsed = new URL(importPath);
          const pkgName = extractPackageFromUrlPath(parsed.pathname);
          if (pkgName) {
            const result = isReactPackage(pkgName);
            if (result) {
              const resolvedPath = getShimPath(result.shim);
              if (DEBUG) console.error(`[react-alias] URL ${importPath} -> ${result.shim} shim`);
              if (resolvedPath) return { path: resolvedPath };
            }
          }
        } catch (err) {
          // ignore URL parse errors
        }
        // Let http-loader handle non-React URLs
        return null;
      }

      // Handle bare imports (from node_modules or direct)
      const result = isReactPackage(importPath);
      if (result) {
        const resolvedShimPath = getShimPath(result.shim);
        if (DEBUG) console.error(`[react-alias] ${importPath} -> ${result.shim} shim`);
        if (resolvedShimPath) return { path: resolvedShimPath };
      }

      return null;
    });
  }
};

const httpPlugin = {
  name: "http-loader",
  setup(build) {
    build.onResolve({ filter: /^https?:\\/\\// }, (args) => {
      // First check if this URL points to a React package
      try {
        const parsed = new URL(args.path);
        const pkgName = extractPackageFromUrlPath(parsed.pathname);
        if (pkgName) {
          const result = isReactPackage(pkgName);
          if (result) {
            const resolvedPath = getShimPath(result.shim);
            if (DEBUG) console.error(`[http-plugin] URL ${args.path} -> ${result.shim} shim`);
            if (resolvedPath) return { path: resolvedPath };
          }
        }
      } catch (err) {
        // ignore URL parse errors
      }
      return {
        path: args.path,
        namespace: "http-url"
      };
    });

    build.onResolve({ filter: /.*/, namespace: "http-url" }, (args) => {
      if (!args.importer) {
        return null;
      }

      // CRITICAL: Check if this is a React package import from within CDN code
      // e.g., react-window from esm.sh imports 'react' which should be shimmed
      const result = isReactPackage(args.path);
      if (result) {
        const resolvedPath = getShimPath(result.shim);
        if (DEBUG) console.error(`[http-plugin] CDN internal import ${args.path} -> ${result.shim} shim`);
        if (resolvedPath) return { path: resolvedPath };
      }

      try {
        const resolved = new URL(args.path, args.importer).toString();

        // Also check the resolved URL for React packages
        try {
          const parsed = new URL(resolved);
          const pkgName = extractPackageFromUrlPath(parsed.pathname);
          if (pkgName) {
            const pkgResult = isReactPackage(pkgName);
            if (pkgResult) {
              const resolvedShimPath = getShimPath(pkgResult.shim);
              if (DEBUG) console.error(`[http-plugin] Resolved URL ${resolved} -> ${pkgResult.shim} shim`);
              if (resolvedShimPath) return { path: resolvedShimPath };
            }
          }
        } catch (err) {
          // ignore URL parse errors
        }

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

// Core classes
export const Component = React.Component;
export const PureComponent = React.PureComponent;

// Core utilities
export const Children = React.Children;
export const Fragment = React.Fragment;
export const Profiler = React.Profiler;
export const StrictMode = React.StrictMode;
export const Suspense = React.Suspense;

// Element creation
export const cloneElement = React.cloneElement;
export const createContext = React.createContext;
export const createElement = React.createElement;
export const createFactory = React.createFactory;
export const createRef = React.createRef;

// Higher-order components
export const forwardRef = React.forwardRef;
export const lazy = React.lazy;
export const memo = React.memo;

// Element validation
export const isValidElement = React.isValidElement;

// Hooks
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

// Concurrent features
export const startTransition = React.startTransition;
export const use = React.use;

// Version
export const version = React.version;

// JSX runtime (for react/jsx-runtime compatibility)
export const jsx = React.jsx || React.createElement;
export const jsxs = React.jsxs || React.createElement;
export const jsxDEV = React.jsxDEV || React.createElement;

// Legacy APIs (some packages still use these)
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
"""


def _react_dom_shim_source() -> str:
    return """const ReactDOM = globalThis.__VIBE_REACT_DOM || {};
const ReactDOMClient = globalThis.__VIBE_REACT_DOM_CLIENT || ReactDOM;

// Modern APIs
export const createPortal = ReactDOM.createPortal;
export const flushSync = ReactDOM.flushSync;
export const createRoot = ReactDOMClient.createRoot;
export const hydrateRoot = ReactDOMClient.hydrateRoot;

// Legacy APIs (some packages still use these, they may be undefined in React 19)
export const render = ReactDOM.render;
export const hydrate = ReactDOM.hydrate;
export const unmountComponentAtNode = ReactDOM.unmountComponentAtNode;
export const findDOMNode = ReactDOM.findDOMNode;

// Version
export const version = ReactDOM.version;

export default ReactDOM;
"""


def _react_dom_client_shim_source() -> str:
    return """const ReactDOMClient = globalThis.__VIBE_REACT_DOM_CLIENT || globalThis.__VIBE_REACT_DOM || {};

export const createRoot = ReactDOMClient.createRoot;
export const hydrateRoot = ReactDOMClient.hydrateRoot;

export default ReactDOMClient;
"""


def _scheduler_shim_source() -> str:
    # Minimal scheduler shim - React's internal scheduler
    # Most of these are no-ops or use the host React's internals
    return """// Scheduler shim - provides minimal scheduler API
// These are React internals that some packages import directly

export const unstable_ImmediatePriority = 1;
export const unstable_UserBlockingPriority = 2;
export const unstable_NormalPriority = 3;
export const unstable_IdlePriority = 5;
export const unstable_LowPriority = 4;

export function unstable_runWithPriority(priority, callback) {
  return callback();
}

export function unstable_scheduleCallback(priority, callback) {
  const id = setTimeout(callback, 0);
  return { id };
}

export function unstable_cancelCallback(task) {
  if (task && task.id) clearTimeout(task.id);
}

export function unstable_wrapCallback(callback) {
  return callback;
}

export function unstable_getCurrentPriorityLevel() {
  return unstable_NormalPriority;
}

export function unstable_shouldYield() {
  return false;
}

export function unstable_requestPaint() {}

export function unstable_now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function unstable_forceFrameRate() {}

export function unstable_pauseExecution() {}

export function unstable_continueExecution() {}

export function unstable_getFirstCallbackNode() {
  return null;
}

// For scheduler/tracing
export const __interactionsRef = { current: new Set() };
export const __subscriberRef = { current: null };
export function unstable_clear(callback) { return callback(); }
export function unstable_getCurrent() { return null; }
export function unstable_getThreadID() { return 0; }
export function unstable_subscribe() {}
export function unstable_unsubscribe() {}
export function unstable_trace(name, timestamp, callback) { return callback(); }
export function unstable_wrap(callback) { return callback; }

export default {
  unstable_ImmediatePriority,
  unstable_UserBlockingPriority,
  unstable_NormalPriority,
  unstable_IdlePriority,
  unstable_LowPriority,
  unstable_runWithPriority,
  unstable_scheduleCallback,
  unstable_cancelCallback,
  unstable_wrapCallback,
  unstable_getCurrentPriorityLevel,
  unstable_shouldYield,
  unstable_requestPaint,
  unstable_now,
  unstable_forceFrameRate,
  unstable_pauseExecution,
  unstable_continueExecution,
  unstable_getFirstCallbackNode
};
"""


def _react_is_shim_source() -> str:
    # react-is shim - type checking utilities for React elements
    return """const React = globalThis.__VIBE_REACT;

// Type symbols - use React's if available, or create placeholders
const REACT_ELEMENT_TYPE = Symbol.for('react.element');
const REACT_PORTAL_TYPE = Symbol.for('react.portal');
const REACT_FRAGMENT_TYPE = Symbol.for('react.fragment');
const REACT_STRICT_MODE_TYPE = Symbol.for('react.strict_mode');
const REACT_PROFILER_TYPE = Symbol.for('react.profiler');
const REACT_PROVIDER_TYPE = Symbol.for('react.provider');
const REACT_CONTEXT_TYPE = Symbol.for('react.context');
const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');
const REACT_SUSPENSE_TYPE = Symbol.for('react.suspense');
const REACT_SUSPENSE_LIST_TYPE = Symbol.for('react.suspense_list');
const REACT_MEMO_TYPE = Symbol.for('react.memo');
const REACT_LAZY_TYPE = Symbol.for('react.lazy');

function typeOf(object) {
  if (typeof object === 'object' && object !== null) {
    const $$typeof = object.$$typeof;
    if ($$typeof === REACT_ELEMENT_TYPE) {
      const type = object.type;
      if (typeof type === 'function') return null;
      if (typeof type === 'string') return REACT_ELEMENT_TYPE;
      switch (type) {
        case REACT_FRAGMENT_TYPE: return REACT_FRAGMENT_TYPE;
        case REACT_PROFILER_TYPE: return REACT_PROFILER_TYPE;
        case REACT_STRICT_MODE_TYPE: return REACT_STRICT_MODE_TYPE;
        case REACT_SUSPENSE_TYPE: return REACT_SUSPENSE_TYPE;
        case REACT_SUSPENSE_LIST_TYPE: return REACT_SUSPENSE_LIST_TYPE;
      }
      if (typeof type === 'object') {
        switch (type.$$typeof) {
          case REACT_CONTEXT_TYPE: return REACT_CONTEXT_TYPE;
          case REACT_PROVIDER_TYPE: return REACT_PROVIDER_TYPE;
          case REACT_FORWARD_REF_TYPE: return REACT_FORWARD_REF_TYPE;
          case REACT_MEMO_TYPE: return REACT_MEMO_TYPE;
          case REACT_LAZY_TYPE: return REACT_LAZY_TYPE;
        }
      }
    } else if ($$typeof === REACT_PORTAL_TYPE) {
      return REACT_PORTAL_TYPE;
    }
  }
  return undefined;
}

export { typeOf };

export const ContextConsumer = REACT_CONTEXT_TYPE;
export const ContextProvider = REACT_PROVIDER_TYPE;
export const Element = REACT_ELEMENT_TYPE;
export const ForwardRef = REACT_FORWARD_REF_TYPE;
export const Fragment = REACT_FRAGMENT_TYPE;
export const Lazy = REACT_LAZY_TYPE;
export const Memo = REACT_MEMO_TYPE;
export const Portal = REACT_PORTAL_TYPE;
export const Profiler = REACT_PROFILER_TYPE;
export const StrictMode = REACT_STRICT_MODE_TYPE;
export const Suspense = REACT_SUSPENSE_TYPE;
export const SuspenseList = REACT_SUSPENSE_LIST_TYPE;

export function isValidElementType(type) {
  return typeof type === 'string' ||
    typeof type === 'function' ||
    type === REACT_FRAGMENT_TYPE ||
    type === REACT_PROFILER_TYPE ||
    type === REACT_STRICT_MODE_TYPE ||
    type === REACT_SUSPENSE_TYPE ||
    type === REACT_SUSPENSE_LIST_TYPE ||
    (typeof type === 'object' && type !== null && (
      type.$$typeof === REACT_LAZY_TYPE ||
      type.$$typeof === REACT_MEMO_TYPE ||
      type.$$typeof === REACT_PROVIDER_TYPE ||
      type.$$typeof === REACT_CONTEXT_TYPE ||
      type.$$typeof === REACT_FORWARD_REF_TYPE
    ));
}

export function isAsyncMode() { return false; }
export function isConcurrentMode() { return false; }
export function isContextConsumer(object) { return typeOf(object) === REACT_CONTEXT_TYPE; }
export function isContextProvider(object) { return typeOf(object) === REACT_PROVIDER_TYPE; }
export function isElement(object) { return typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE; }
export function isForwardRef(object) { return typeOf(object) === REACT_FORWARD_REF_TYPE; }
export function isFragment(object) { return typeOf(object) === REACT_FRAGMENT_TYPE; }
export function isLazy(object) { return typeOf(object) === REACT_LAZY_TYPE; }
export function isMemo(object) { return typeOf(object) === REACT_MEMO_TYPE; }
export function isPortal(object) { return typeOf(object) === REACT_PORTAL_TYPE; }
export function isProfiler(object) { return typeOf(object) === REACT_PROFILER_TYPE; }
export function isStrictMode(object) { return typeOf(object) === REACT_STRICT_MODE_TYPE; }
export function isSuspense(object) { return typeOf(object) === REACT_SUSPENSE_TYPE; }
export function isSuspenseList(object) { return typeOf(object) === REACT_SUSPENSE_LIST_TYPE; }

export default {
  typeOf,
  ContextConsumer,
  ContextProvider,
  Element,
  ForwardRef,
  Fragment,
  Lazy,
  Memo,
  Portal,
  Profiler,
  StrictMode,
  Suspense,
  SuspenseList,
  isValidElementType,
  isAsyncMode,
  isConcurrentMode,
  isContextConsumer,
  isContextProvider,
  isElement,
  isForwardRef,
  isFragment,
  isLazy,
  isMemo,
  isPortal,
  isProfiler,
  isStrictMode,
  isSuspense,
  isSuspenseList
};
"""


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
    for match in re.finditer(r'from\\s+["\\\']([^"\\\']+)["\\\']', source):
        specs.append(match.group(1))
    for match in re.finditer(r'require\\(\\s*["\\\']([^"\\\']+)["\\\']\\s*\\)', source):
        specs.append(match.group(1))
    for match in re.finditer(r'import\\(\\s*["\\\']([^"\\\']+)["\\\']\\s*\\)', source):
        specs.append(match.group(1))
    return specs
