import * as React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import * as Babel from "@babel/standalone";
import { appendWidgetLogs } from "../actions/modelActions";
import { captureRuntimeError } from "../utils/runtimeError";
import { debugLog } from "../utils/debug";
import {
  isBundledSource,
  REACT_PACKAGE_NAMES,
  REACT_URL_PATH_PATTERN,
} from "../utils/codeTransform";
import { ES_MODULE_SHIMS_SOURCE } from "../vendor/esModuleShims";

let sandboxInstanceCounter = 0;

function SandboxedRunner({ code, model, runKey }) {
  const instanceId = React.useRef(++sandboxInstanceCounter).current;
  debugLog(model, "[vibe][debug] SandboxedRunner render", { instanceId, codeLen: code?.length, runKey });

  const [GuestWidget, setGuestWidget] = React.useState(null);
  const logQueueRef = React.useRef([]);
  const flushTimerRef = React.useRef(null);
  const lastConsoleErrorRef = React.useRef("");
  const lastRuntimeEventRef = React.useRef("");
  const remoteCallIdRef = React.useRef(0);
  const remoteCallPendingRef = React.useRef(new Map());

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

    // The blob modules read from globalThis.ReactProvided (always current),
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

  const shouldIgnoreConsole = React.useCallback((message) => {
    if (!message) return false;
    return (
      message.startsWith("[vibe][debug]") ||
      message.startsWith("[VIBE_RENDER_TRACE]") ||
      message.startsWith("[VIBE_STATE_TRACE]")
    );
  }, []);

  React.useEffect(() => {
    const original = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };

    const handleWindowError = (event) => {
      const message = event?.error || event?.message || "Unknown runtime error";
      const key = String(message);
      if (key && key === lastRuntimeEventRef.current) {
        return;
      }
      lastRuntimeEventRef.current = key;
      const err = message instanceof Error ? message : new Error(String(message));
      captureRuntimeError({ model, enqueueLog, err });
    };

    const handleUnhandledRejection = (event) => {
      const reason = event?.reason || "Unhandled promise rejection";
      const key = String(reason);
      if (key && key === lastRuntimeEventRef.current) {
        return;
      }
      lastRuntimeEventRef.current = key;
      const err = reason instanceof Error ? reason : new Error(String(reason));
      captureRuntimeError({ model, enqueueLog, err });
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    console.log = (...args) => {
      const message = args.map(String).join(" ");
      if (!shouldIgnoreConsole(message)) {
        enqueueLog("info", message);
      }
      original.log(...args);
    };
    console.warn = (...args) => {
      const message = args.map(String).join(" ");
      if (!shouldIgnoreConsole(message)) {
        enqueueLog("warn", message);
      }
      original.warn(...args);
    };
    console.error = (...args) => {
      const message = args.map(String).join(" ");
      if (!shouldIgnoreConsole(message)) {
        enqueueLog("error", message);
      }
      const explicitError = args.find((arg) => arg instanceof Error);
      const candidate =
        explicitError ||
        (typeof message === "string" && /(^|\b)(TypeError|ReferenceError|SyntaxError|Error):/i.test(message)
          ? new Error(message)
          : null);
      if (candidate && message !== lastConsoleErrorRef.current) {
        lastConsoleErrorRef.current = message;
        captureRuntimeError({ model, enqueueLog, err: candidate });
      }
      original.error(...args);
    };

    return () => {
      console.log = original.log;
      console.warn = original.warn;
      console.error = original.error;
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      flushLogs();
    };
  }, [enqueueLog, flushLogs, shouldIgnoreConsole]);

    const clearRuntimeCheck = () => {
      try {
        const currentExec = model.get?.("execution_state") || {};
        if (currentExec.runtime_check) {
          model.set("execution_state", { ...currentExec, runtime_check: false });
        }
      } catch (err) {
        // ignore
      }
    };

    const handleRuntimeError = React.useCallback((err, extraStack = "") => {
      console.error("Code execution error:", err);
      clearRuntimeCheck();
      captureRuntimeError({ model, enqueueLog, err, extraStack });
    }, [model, enqueueLog]);

  React.useEffect(() => {
    debugLog(model, "[vibe][debug] SandboxedRunner useEffect running", { instanceId, codeLen: code?.length });
    if (!code) return;

    debugLog(model, "[vibe][debug] SandboxedRunner useEffect has code, setting up", { instanceId });

    const guardState = { closed: false };
    const disposers = [];
    const previousCommClosed = model.__vibeOnCommClosed;

    // Preserve originals
    const originalSet = model.set?.bind(model);
    const originalSave = model.save_changes?.bind(model);
    const originalSetInterval = window.setInterval;
    const originalSetTimeout = window.setTimeout;
    const originalRaf = window.requestAnimationFrame;

    const trackDisposer = (fn) => {
      disposers.push(fn);
      return fn;
    };

    const teardown = (reason = "unmount") => {
      debugLog(model, "[vibe][debug] teardown called", {
        instanceId,
        alreadyClosed: guardState.closed,
        reason
      });
      if (guardState.closed) return;
      guardState.closed = true;
      while (disposers.length) {
        try {
          const dispose = disposers.pop();
          dispose?.();
        } catch (err) {
          // ignore teardown errors
        }
      }
      // Restore globals
      window.setInterval = originalSetInterval;
      window.setTimeout = originalSetTimeout;
      window.requestAnimationFrame = originalRaf;
      if (reason === "comm-closed") {
        // After comm closure, prevent further sync attempts on this model
        model.set = () => undefined;
        model.save_changes = () => undefined;
      } else {
        if (originalSet) {
          model.set = originalSet;
        }
        if (originalSave) {
          model.save_changes = originalSave;
        }
      }
      setGuestWidget(null);
      if (model.__vibeOnCommClosed === teardown) {
        model.__vibeOnCommClosed = previousCommClosed;
      }
    };

    // Patch timers
    window.setInterval = (...args) => {
      const id = originalSetInterval(...args);
      trackDisposer(() => clearInterval(id));
      return id;
    };
    window.setTimeout = (...args) => {
      const id = originalSetTimeout(...args);
      trackDisposer(() => clearTimeout(id));
      return id;
    };
    window.requestAnimationFrame = (cb) => {
      const id = originalRaf(cb);
      trackDisposer(() => cancelAnimationFrame(id));
      return id;
    };

    // Guard model.set/save_changes to halt on closed comm
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

    const handleRemoteMessage = (content) => {
      if (!content || content.type !== "remote_call_result") {
        return;
      }
      const pending = remoteCallPendingRef.current.get(content.id);
      if (!pending) {
        return;
      }
      remoteCallPendingRef.current.delete(content.id);
      if (content.error) {
        pending.reject(new Error(content.error));
      } else {
        pending.resolve(content.result);
      }
    };

    const callRemote = (name, args = {}, options = {}) => {
      if (!model || typeof model.send !== "function") {
        return Promise.reject(new Error("Widget comm not available."));
      }
      const timeoutMs =
        typeof options.timeout === "number" && options.timeout > 0
          ? options.timeout
          : 20000;
      const id = `remote-${Date.now()}-${remoteCallIdRef.current++}`;
      return new Promise((resolve, reject) => {
        remoteCallPendingRef.current.set(id, { resolve, reject });
        let timeout = null;
        if (timeoutMs) {
          timeout = setTimeout(() => {
            if (!remoteCallPendingRef.current.has(id)) return;
            remoteCallPendingRef.current.delete(id);
            reject(new Error("Remote call timed out."));
          }, timeoutMs);
        }
        try {
          model.send({ type: "remote_call", id, name, args });
        } catch (err) {
          if (timeout) clearTimeout(timeout);
          remoteCallPendingRef.current.delete(id);
          reject(err);
        }
      });
    };

    if (model && typeof model.on === "function") {
      model.on("msg:custom", handleRemoteMessage);
      trackDisposer(() => model.off("msg:custom", handleRemoteMessage));
    }
    model.call_remote = callRemote;
    trackDisposer(() => {
      if (model.call_remote === callRemote) {
        model.call_remote = undefined;
      }
      remoteCallPendingRef.current.forEach((pending) => {
        try {
          pending.reject(new Error("Remote call cancelled."));
        } catch (err) {
          // ignore
        }
      });
      remoteCallPendingRef.current.clear();
    });

    model.__vibeOnCommClosed = () => {
      if (typeof previousCommClosed === "function") {
        previousCommClosed();
      }
      teardown();
    };

    const handleWindowError = (event) => {
      if (!event) return;
      const err = event.error || event.reason || event.message || event;
      handleRuntimeError(err);
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleWindowError);
    trackDisposer(() => window.removeEventListener("error", handleWindowError));
    trackDisposer(() => window.removeEventListener("unhandledrejection", handleWindowError));

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

        const module = await globalThis.importShim(url);
        URL.revokeObjectURL(url);

        if (module.default && typeof module.default === "function") {
          debugLog(model, "[vibe][runtime] module loaded successfully");
          // Pre-mount guard: attempt a fast render into a detached node to catch synchronous throws.
          try {
            const probeContainer = document.createElement("div");
            const Element = React.createElement(module.default, { model, React });
            const probeRoot = createRoot(probeContainer);
            flushSync(() => {
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
        console.error("[vibe][runtime] executeCode failed", err);
        handleRuntimeError(err);
        teardown();
      }
    };

    executeCode();

    return () => {
      debugLog(model, "[vibe][debug] useEffect cleanup called", { instanceId });
      teardown();
    };
  }, [code, model, handleRuntimeError, runKey]);

  if (!GuestWidget) {
    return null;
  }

  class RuntimeErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null };
    }

    componentDidCatch(err, info) {
      console.error("[vibe][runtime][boundary] render error", err, info?.componentStack);
      const componentStack = info && info.componentStack ? `\n\nComponent stack:\n${info.componentStack}` : "";
      this.setState({ error: err });
      if (this.props.onError) {
        this.props.onError(err, componentStack);
      }
    }

    componentDidUpdate(prevProps) {
      if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
        this.setState({ error: null });
      }
    }

    render() {
      if (this.state.error) {
        return this.props.fallback || null;
      }
      return this.props.children;
    }
  }

  const fallback = (
    <div style={{ padding: "20px", color: "#f8fafc", fontSize: "14px" }}>
      Runtime error detected. Check the panel above.
    </div>
  );

  const GuardedGuest = (props) => {
    try {
      return <GuestWidget {...props} />;
    } catch (err) {
      console.error("[vibe][runtime] render threw synchronously", err);
      handleRuntimeError(err);
      return fallback;
    }
  };

  return (
    <RuntimeErrorBoundary resetKey={code} onError={handleRuntimeError} fallback={fallback}>
      <GuardedGuest model={model} React={React} />
    </RuntimeErrorBoundary>
  );
}

export default React.memo(
  SandboxedRunner,
  (prevProps, nextProps) =>
    prevProps.code === nextProps.code &&
    prevProps.model === nextProps.model &&
    prevProps.runKey === nextProps.runKey
);
