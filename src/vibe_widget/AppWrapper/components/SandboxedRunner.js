import * as React from "react";
import * as Babel from "@babel/standalone";
import { appendWidgetLogs } from "../actions/modelActions";
import { captureRuntimeError } from "../utils/runtimeError";
import { debugLog } from "../utils/debug";
import { createModelFacade } from "../utils/modelFacade";
import { mountGuest, sharedCreateRoot, sharedReact, sharedReactDOM } from "../utils/sharedReact";
import {
  isBundledSource,
  REACT_PACKAGE_NAMES,
  REACT_URL_PATH_PATTERN,
} from "../utils/codeTransform";
import { ES_MODULE_SHIMS_SOURCE } from "../vendor/esModuleShims";

let sandboxInstanceCounter = 0;

const GUEST_FALLBACK_STYLE = {
  padding: "20px",
  color: "var(--jp-ui-font-color1, #f8fafc)",
  fontSize: "14px",
};

/**
 * Hosts the guest tree in its own root owned by the page-wide React instance.
 * The wrapper tree around it belongs to this bundle's React copy, which on a
 * page with several widgets is a different copy from the one the guest's
 * imported hooks come from.
 */
function GuestHost({ Guest, facade, resetKey, onError }) {
  const hostRef = React.useRef(null);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Fresh node per mount: the deferred unmount can outlive this effect.
    const mountPoint = document.createElement("div");
    mountPoint.style.width = "100%";
    mountPoint.style.height = "100%";
    host.appendChild(mountPoint);
    const shared = sharedReact();
    const root = mountGuest(mountPoint, {
      Guest,
      props: { model: facade },
      onError,
      resetKey,
      fallback: shared.createElement(
        "div",
        { style: GUEST_FALLBACK_STYLE },
        "Runtime error detected. Check the panel above."
      ),
    });
    return () => {
      // React refuses a synchronous unmount from inside a commit; defer one tick.
      queueMicrotask(() => {
        root.unmount();
        mountPoint.remove();
      });
    };
  }, [Guest, facade, resetKey, onError]);

  return <div ref={hostRef} style={{ width: "100%", height: "100%" }} />;
}

function SandboxedRunner({ code, model, runKey }) {
  const instanceId = React.useRef(++sandboxInstanceCounter).current;
  debugLog(model, "[vibe][debug] SandboxedRunner render", { instanceId, codeLen: code?.length, runKey });

  const [GuestWidget, setGuestWidget] = React.useState(null);
  const logQueueRef = React.useRef([]);
  const flushTimerRef = React.useRef(null);
  const lastRuntimeEventRef = React.useRef("");
  // Blob URL of this instance's guest module; used to attribute global errors.
  const blobUrlRef = React.useRef("");

  const facade = React.useMemo(
    () => createModelFacade(model, model.get("contract") || null),
    [model]
  );

  const ensureImportShim = React.useCallback(async () => {
    // Must be set before es-module-shims loads so it activates shim mode
    // (polyfill mode disables addImportMap which we need).
    self.esmsInitOptions = { shimMode: true, mapOverrides: true };

    // If importShim already exists, verify it's in shim mode by testing addImportMap.
    // A stale polyfill-mode instance (from a previous load without shimMode) must be replaced.
    if (typeof globalThis !== "undefined" && typeof globalThis.importShim === "function") {
      try {
        globalThis.importShim.addImportMap({ imports: {} });
        return;
      } catch (_) {
        // Polyfill mode — remove stale script and reimport below.
        const stale = document.querySelector('script[data-vibe-import-shim="1"]');
        if (stale) stale.remove();
        delete globalThis.importShim;
      }
    }
    await new Promise((resolve, reject) => {
      const shimInit = "self.esmsInitOptions={shimMode:true,mapOverrides:true};\n";
      const blob = new Blob([shimInit, ES_MODULE_SHIMS_SOURCE], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      const script = document.createElement("script");
      script.type = "application/javascript";
      script.async = true;
      script.setAttribute("data-vibe-import-shim", "1");
      script.src = url;
      script.onload = () => { URL.revokeObjectURL(url); resolve(); };
      script.onerror = () => { URL.revokeObjectURL(url); reject(new Error("es-module-shims failed to load")); };
      document.head.appendChild(script);
    });
  }, []);

  const installReactImportMap = React.useCallback(async () => {
    await ensureImportShim();

    // The blob modules bind to globalThis.ReactProvided at their first
    // evaluation and that instance never changes (see utils/sharedReact.js),
    // so the import map only needs to be registered once per page.
    const existing = globalThis.importShim.getImportMap?.();
    if (existing?.imports?.react) {
      return;
    }

    const reactModule = `
const React = globalThis.ReactProvided || globalThis.React;
if (!React) { throw new Error("ReactProvided missing"); }
export default React;
export const Children = React.Children;
export const Component = React.Component;
export const Fragment = React.Fragment;
export const Profiler = React.Profiler;
export const PureComponent = React.PureComponent;
export const StrictMode = React.StrictMode;
export const Suspense = React.Suspense;
export const createElement = React.createElement;
export const cloneElement = React.cloneElement;
export const createRef = React.createRef;
export const createContext = React.createContext;
export const forwardRef = React.forwardRef;
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
`;

    const reactDomModule = `
const ReactDOM = globalThis.ReactDOMProvided;
if (!ReactDOM) { throw new Error("ReactDOMProvided missing"); }
export const createRoot = ReactDOM.createRoot;
export const flushSync = ReactDOM.flushSync;
export default ReactDOM;
`;

    const reactDomClientModule = `
const ReactDOMClient = globalThis.ReactDOMClientProvided || globalThis.ReactDOMProvided;
if (!ReactDOMClient) { throw new Error("ReactDOMClientProvided missing"); }
export const createRoot = ReactDOMClient.createRoot;
export default ReactDOMClient;
`;
    const reactUrl = URL.createObjectURL(new Blob([reactModule], { type: "text/javascript" }));
    const reactDomUrl = URL.createObjectURL(new Blob([reactDomModule], { type: "text/javascript" }));
    const reactDomClientUrl = URL.createObjectURL(new Blob([reactDomClientModule], { type: "text/javascript" }));

    const imports = {
      react: reactUrl,
      "react/jsx-runtime": reactUrl,
      "react/jsx-dev-runtime": reactUrl,
      "react-dom": reactDomUrl,
      "react-dom/client": reactDomClientUrl,
    };

    await globalThis.importShim.addImportMap({ imports });
  }, [ensureImportShim]);

  const flushLogs = React.useCallback(() => {
    if (!logQueueRef.current.length) return;
    appendWidgetLogs(model, logQueueRef.current);
    logQueueRef.current = [];
  }, [model]);

  const enqueueLog = React.useCallback((level, message) => {
    logQueueRef.current.push({
      timestamp: Date.now(),
      message,
      level,
      source: "js",
    });
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        flushLogs();
      }, 200);
    }
  }, [flushLogs]);

  const clearRuntimeCheck = React.useCallback(() => {
    try {
      const currentExec = model.get?.("execution_state") || {};
      if (currentExec.runtime_check) {
        model.set("execution_state", { ...currentExec, runtime_check: false });
      }
    } catch (err) {
      // Comm may already be closed.
    }
  }, [model]);

  const handleRuntimeError = React.useCallback((err, extraStack = "") => {
    clearRuntimeCheck();
    captureRuntimeError({ model, enqueueLog, err, extraStack });
  }, [model, enqueueLog, clearRuntimeCheck]);

  // Attribute page-level errors to this widget only when the stack points at the
  // Blob module this instance loaded. No console or timer patching.
  React.useEffect(() => {
    const isOurs = (event) => {
      const url = blobUrlRef.current;
      if (!url) return false;
      if (typeof event?.filename === "string" && event.filename.includes(url)) return true;
      const source = event?.error ?? event?.reason;
      const stack = source && source.stack ? String(source.stack) : "";
      return stack.includes(url);
    };

    const handleGlobalError = (event) => {
      if (!isOurs(event)) return;
      const source = event?.error ?? event?.reason ?? event?.message ?? "Unknown runtime error";
      const key = String(source);
      if (key && key === lastRuntimeEventRef.current) return;
      lastRuntimeEventRef.current = key;
      handleRuntimeError(source instanceof Error ? source : new Error(key));
    };

    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleGlobalError);
    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleGlobalError);
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      flushLogs();
    };
  }, [handleRuntimeError, flushLogs]);

  React.useEffect(() => {
    debugLog(model, "[vibe][debug] SandboxedRunner useEffect running", { instanceId, codeLen: code?.length });
    if (!code) return;

    const guardState = { closed: false };
    const previousCommClosed = model.__vibeOnCommClosed;

    const originalSet = model.set?.bind(model);
    const originalSave = model.save_changes?.bind(model);

    const teardown = (reason = "unmount") => {
      debugLog(model, "[vibe][debug] teardown called", {
        instanceId,
        alreadyClosed: guardState.closed,
        reason
      });
      if (guardState.closed) return;
      guardState.closed = true;
      if (reason === "comm-closed") {
        // After comm closure, prevent further sync attempts on this model.
        model.set = () => undefined;
        model.save_changes = () => undefined;
      } else {
        if (originalSet) model.set = originalSet;
        if (originalSave) model.save_changes = originalSave;
      }
      setGuestWidget(null);
      if (model.__vibeOnCommClosed === teardown) {
        model.__vibeOnCommClosed = previousCommClosed;
      }
    };

    // Guard model.set/save_changes to halt on closed comm.
    const guardCall = (fn) => (...args) => {
      if (guardState.closed || !fn) return;
      try {
        return fn(...args);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err || "");
        if (msg.toLowerCase().includes("cannot send")) {
          model.__vibeCommClosed = true;
          enqueueLog("warn", "Widget comm closed; tearing down widget runtime.");
          teardown("comm-closed");
          return;
        }
        throw err;
      }
    };

    if (originalSet) {
      model.set = guardCall(originalSet);
    }
    if (originalSave) {
      model.save_changes = guardCall(originalSave);
    }

    model.__vibeOnCommClosed = () => {
      if (typeof previousCommClosed === "function") {
        previousCommClosed();
      }
      teardown();
    };

    const addExternalParams = (raw) => {
      if (!raw) return raw;
      const ensureList = ["react", "react-dom", "react/jsx-runtime", "react-dom/client"];
      return raw.replace(/(['"])(https:\/\/esm\.sh\/[^'"]+)\1/g, (match, quote, url) => {
        try {
          const u = new URL(url);
          const existing = u.searchParams.get("external") || "";
          const current = existing.split(",").filter(Boolean);
          const extras = [...new Set([...current, ...ensureList])];
          u.searchParams.set("external", extras.join(","));
          return `${quote}${u.toString()}${quote}`;
        } catch (err) {
          return match;
        }
      });
    };

    const stripReactImports = (raw) => {
      if (!raw) return raw;
      const isReact = (spec) => {
        if (!spec) return false;
        const normalized = spec.trim();
        if (REACT_PACKAGE_NAMES.has(normalized)) return true;
        if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
          try {
            const u = new URL(normalized);
            return REACT_URL_PATH_PATTERN.test(u.pathname);
          } catch (err) {
            return false;
          }
        }
        return false;
      };
      // Remove static imports/requires of React-family packages (including CDN URLs).
      const importPattern = /^\s*import\s+(?:[^;]*from\s+)?['"]([^'"]+)['"]\s*;?\s*$/gm;
      const requirePattern =
        /^\s*const\s+[^=]+=\s*require\(\s*['"]([^'"]+)['"]\s*\)\s*;?\s*$/gm;

      const replacer = (full, spec) => (isReact(spec) ? "" : full);
      return raw.replace(importPattern, replacer).replace(requirePattern, replacer);
    };

    const transformWidgetCode = (source) => {
      if (isBundledSource(source)) {
        return source;
      }
      // Ensure CDN-hosted React libs reuse the host React via import map.
      const rewiredSource = addExternalParams(stripReactImports(source));
      const wrapped = `const React = globalThis.ReactProvided || globalThis.React;
const ReactDOM = globalThis.ReactDOMProvided || globalThis.ReactDOM;
const ReactDOMClient = globalThis.ReactDOMClientProvided || globalThis.ReactDOMProvided;
const tw = globalThis.__VIBE_TW;
const css = globalThis.__VIBE_CSS;
${rewiredSource}`;
      const result = Babel.transform(wrapped, {
        presets: [["react", { runtime: "classic", pragma: "React.createElement", pragmaFrag: "React.Fragment" }]],
        plugins: ["syntax-top-level-await"],
        sourceType: "module",
        filename: "widget.jsx"
      });
      return result.code;
    };

    const executeCode = async () => {
      debugLog(model, "[vibe][debug] executeCode called", { instanceId });
      try {
        setGuestWidget(null);
        await installReactImportMap();
        const transformed = transformWidgetCode(code);
        const blob = new Blob([transformed], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;

        const module = await globalThis.importShim(url);
        URL.revokeObjectURL(url);

        if (module.default && typeof module.default === "function") {
          debugLog(model, "[vibe][runtime] module loaded successfully");
          // Pre-mount guard: render into a detached node to catch synchronous
          // throws. Uses the shared React, same as the real mount below.
          try {
            const shared = sharedReact();
            const probeContainer = document.createElement("div");
            const Element = shared.createElement(module.default, { model: facade, React: shared });
            const probeRoot = sharedCreateRoot()(probeContainer);
            sharedReactDOM().flushSync(() => {
              probeRoot.render(Element);
            });
            probeRoot.unmount();
          } catch (err) {
            handleRuntimeError(err);
            return;
          }
          setGuestWidget(() => module.default);
          model.set("error_message", "");
          model.set("widget_error", "");
          model.set("retry_count", 0);
          model.set("status", "ready");
          clearRuntimeCheck();
          model.save_changes();
        } else {
          throw new Error("Generated code must export a default function");
        }
      } catch (err) {
        handleRuntimeError(err);
        teardown();
      }
    };

    executeCode();

    return () => {
      debugLog(model, "[vibe][debug] useEffect cleanup called", { instanceId });
      teardown();
    };
  }, [code, model, facade, handleRuntimeError, clearRuntimeCheck, enqueueLog, installReactImportMap, instanceId, runKey]);

  if (!GuestWidget) {
    return null;
  }

  return (
    <GuestHost Guest={GuestWidget} facade={facade} resetKey={code} onError={handleRuntimeError} />
  );
}

export default React.memo(
  SandboxedRunner,
  (prevProps, nextProps) =>
    prevProps.code === nextProps.code &&
    prevProps.model === nextProps.model &&
    prevProps.runKey === nextProps.runKey
);
