import * as React from "react";
import htm from "htm";
import { appendWidgetLogs } from "../actions/modelActions";
import { captureRuntimeError } from "../utils/runtimeError";

const html = htm.bind(React.createElement);
const FORBIDDEN_REACT_IMPORT = /from\s+["'](?:react(?:\/jsx-runtime)?|react-dom(?:\/client)?)["']|require\(\s*["'](?:react(?:\/jsx-runtime)?|react-dom(?:\/client)?)["']\s*\)|from\s+["']https?:\/\/[^"']*react[^"']*["']/;

function SandboxedRunner({ code, model, runKey }) {
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
    if (!code) return;

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

    const executeCode = async () => {
      try {
        setGuestWidget(null);
        if (FORBIDDEN_REACT_IMPORT.test(code)) {
          throw new Error(
            "Generated code must not import React/ReactDOM or react/jsx-runtime. Use the React and html props provided by the host."
          );
        }
        const blob = new Blob([code], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);

        const module = await import(url);
        URL.revokeObjectURL(url);

        if (module.default && typeof module.default === "function") {
          console.debug("[vibe][runtime] module loaded successfully");
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
      teardown();
    };
  }, [code, model, handleRuntimeError, runKey]);

  if (!GuestWidget) {
    return html`
      <div style=${{ padding: "20px", color: "#8b949e" }}>
        Loading widget...
      </div>
    `;
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

  const fallback = html`
    <div style=${{ padding: "20px", color: "#f8fafc", fontSize: "14px" }}>
      Runtime error detected. Check the panel above.
    </div>
  `;

  const GuardedGuest = (props) => {
    try {
      return html`<${GuestWidget} ...${props} />`;
    } catch (err) {
      console.error("[vibe][runtime] render threw synchronously", err);
      handleRuntimeError(err);
      return fallback;
    }
  };

  return html`
    <${RuntimeErrorBoundary}
      resetKey=${code}
      onError=${handleRuntimeError}
      fallback=${fallback}
    >
      <${GuardedGuest} model=${model} html=${html} React=${React} />
    </${RuntimeErrorBoundary}>
  `;
}

export default React.memo(
  SandboxedRunner,
  (prevProps, nextProps) =>
    prevProps.code === nextProps.code &&
    prevProps.model === nextProps.model &&
    prevProps.runKey === nextProps.runKey
);
