import * as React from "react";
import htm from "htm";
import { appendWidgetLogs } from "../actions/modelActions";

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

    const baseMessage = err instanceof Error ? err.toString() : String(err);
    const stack = err instanceof Error && err.stack ? err.stack : "No stack trace";
    const errorDetails = `${baseMessage}\n\nStack:\n${stack}${extraStack}`;

    model.set("error_message", errorDetails);
    model.set("widget_error", errorDetails);
    model.save_changes();
  }, [model]);

  React.useEffect(() => {
    if (!code) return;

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
        handleRuntimeError(err);
      }
    };

    executeCode();
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

  return html`
    <${RuntimeErrorBoundary}
      resetKey=${code}
      onError=${handleRuntimeError}
      fallback=${fallback}
    >
      <${GuestWidget} model=${model} html=${html} React=${React} />
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
