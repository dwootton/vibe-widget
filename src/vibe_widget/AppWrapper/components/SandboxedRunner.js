import * as React from "react";
import htm from "htm";

const html = htm.bind(React.createElement);

function getErrorSuggestion(errMessage) {
  if (errMessage.includes("is not a function") || errMessage.includes("Cannot read")) {
    return "Type error in data or input shape. Check that inputs match expected types.";
  }
  if (errMessage.includes("Failed to fetch")) {
    return "Network error loading library. Check internet connection.";
  }
  if (errMessage.includes("Unexpected token")) {
    return "Syntax error in generated code.";
  }
  return "";
}

export default function SandboxedRunner({ code, model }) {
  const [error, setError] = React.useState(null);
  const [GuestWidget, setGuestWidget] = React.useState(null);
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRuntimeError = React.useCallback((err, extraStack = "") => {
    console.error("Code execution error:", err);

    const retryCount = model.get("retry_count") || 0;
    const baseMessage = err instanceof Error ? err.toString() : String(err);
    const stack = err instanceof Error && err.stack ? err.stack : "No stack trace";
    const errorDetails = `${baseMessage}\n\nStack:\n${stack}${extraStack}`;

    if (retryCount < 2) {
      setIsRetrying(true);
      model.set("error_message", errorDetails);
      model.save_changes();
      return;
    }

    const suggestion = getErrorSuggestion(baseMessage);
    setError(suggestion ? `${baseMessage}\n\nSuggestion: ${suggestion}` : baseMessage);
  }, [model]);

  React.useEffect(() => {
    if (!code) return;

    const executeCode = async () => {
      try {
        setIsRetrying(false);
        setError(null);
        const blob = new Blob([code], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);

        const module = await import(url);
        URL.revokeObjectURL(url);

        if (module.default && typeof module.default === "function") {
          setGuestWidget(() => module.default);
          setError(null);
          model.set("error_message", "");
          model.set("retry_count", 0);
          model.save_changes();
        } else {
          throw new Error("Generated code must export a default function");
        }
      } catch (err) {
        handleRuntimeError(err);
      }
    };

    executeCode();
  }, [code, model, handleRuntimeError]);

  if (isRetrying) {
    return html`
      <div style=${{ padding: "20px", color: "#ffa07a", fontSize: "14px" }}>
        Error detected. Asking LLM to fix...
      </div>
    `;
  }

  if (error) {
    return html`
      <div style=${{
        padding: "20px",
        background: "#3c1f1f",
        color: "#ff6b6b",
        borderRadius: "6px",
        fontFamily: "monospace",
        whiteSpace: "pre-wrap",
      }}>
        <strong>Error (after 2 retry attempts):</strong> ${error}
        <div style=${{ marginTop: "16px", fontSize: "12px", color: "#ffa07a" }}>
          Check browser console for full stack trace
        </div>
      </div>
    `;
  }

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
    <div style=${{ padding: "20px", color: "#ffa07a", fontSize: "14px" }}>
      Runtime error detected. Asking LLM to fix...
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
