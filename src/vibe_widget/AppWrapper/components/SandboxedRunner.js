import * as React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import * as Babel from "@babel/standalone";
import { appendWidgetLogs } from "../actions/modelActions";
import { captureRuntimeError } from "../utils/runtimeError";
import { debugLog } from "../utils/debug";

const FORBIDDEN_REACT_IMPORT =
  /from\s+["'](?:react(?:\/jsx-runtime)?|react-dom(?:\/client)?|preact(?:\/compat)?|preact\/hooks)["']|require\(\s*["'](?:react(?:\/jsx-runtime)?|react-dom(?:\/client)?|preact(?:\/compat)?|preact\/hooks)["']\s*\)|from\s+["']https?:\/\/[^"']*react[^"']*["']/;

// Expose a stable React runtime for transformed widgets.
// Use the full namespace import (React) which includes all hooks.
if (typeof globalThis !== "undefined") {
  globalThis.__VIBE_REACT = React;
}

let sandboxInstanceCounter = 0;

function SandboxedRunner({ code, model, runKey }) {
  const instanceId = React.useRef(++sandboxInstanceCounter).current;
  debugLog(model, "[vibe][debug] SandboxedRunner render", { instanceId, codeLen: code?.length, runKey });

  const [GuestWidget, setGuestWidget] = React.useState(null);
  const logQueueRef = React.useRef([]);
  const flushTimerRef = React.useRef(null);

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

  React.useEffect(() => {
    const original = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };

    console.log = (...args) => {
      enqueueLog("info", args.map(String).join(" "));
      original.log(...args);
    };
    console.warn = (...args) => {
      enqueueLog("warn", args.map(String).join(" "));
      original.warn(...args);
    };
    console.error = (...args) => {
      enqueueLog("error", args.map(String).join(" "));
      original.error(...args);
    };

    return () => {
      console.log = original.log;
      console.warn = original.warn;
      console.error = original.error;
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      flushLogs();
    };
  }, [enqueueLog, flushLogs]);

  const handleRuntimeError = React.useCallback((err, extraStack = "") => {
    console.error("Code execution error:", err);
    captureRuntimeError({ model, enqueueLog, err, extraStack });
  }, [model, enqueueLog]);

  React.useEffect(() => {
    debugLog(model, "[vibe][debug] SandboxedRunner useEffect running", { instanceId, codeLen: code?.length });
    if (!code) return;

    debugLog(model, "[vibe][debug] SandboxedRunner useEffect has code, setting up", { instanceId });

    const guardState = { closed: false };
    const disposers = [];

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

    const teardown = () => {
      debugLog(model, "[vibe][debug] teardown called", { instanceId, alreadyClosed: guardState.closed });
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
      // After teardown, prevent further sync attempts on this model
      model.set = () => undefined;
      model.save_changes = () => undefined;
      setGuestWidget(null);
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

    // Patch model.on/off if available to auto-unsubscribe
    if (model && typeof model.on === "function" && typeof model.off === "function") {
      const originalOn = model.on.bind(model);
      model.on = (event, handler, ...rest) => {
        originalOn(event, handler, ...rest);
        trackDisposer(() => {
          try {
            model.off(event, handler, ...rest);
          } catch (_) {
            /* ignore */
          }
        });
      };
    }

    // Guard model.set/save_changes to halt on closed comm
    const guardCall = (fn) => (...args) => {
      if (guardState.closed || !fn) return;
      try {
        return fn(...args);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err || "");
        if (msg.toLowerCase().includes("cannot send")) {
          enqueueLog("warn", "Widget comm closed; tearing down widget runtime.");
          teardown();
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

    const handleWindowError = (event) => {
      if (!event) return;
      const err = event.error || event.reason || event.message || event;
      handleRuntimeError(err);
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleWindowError);
    trackDisposer(() => window.removeEventListener("error", handleWindowError));
    trackDisposer(() => window.removeEventListener("unhandledrejection", handleWindowError));

    const transformWidgetCode = (source) => {
      const wrapped = `const React = globalThis.__VIBE_REACT;\n${source}`;
      const result = Babel.transform(wrapped, {
        presets: [["react", { runtime: "classic", pragma: "React.createElement", pragmaFrag: "React.Fragment" }]],
        sourceType: "module",
        filename: "widget.jsx"
      });
      return result.code;
    };

    const executeCode = async () => {
      debugLog(model, "[vibe][debug] executeCode called", { instanceId });
      try {
        setGuestWidget(null);
        if (FORBIDDEN_REACT_IMPORT.test(code)) {
          throw new Error(
            "Generated code must not import React/ReactDOM/Preact. Use the host-provided React runtime instead."
          );
        }
        const transformed = transformWidgetCode(code);
        const blob = new Blob([transformed], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);

        const module = await import(url);
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
    return (
      <div style={{ padding: "20px", color: "#8b949e" }}>
        Loading widget...
      </div>
    );
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
