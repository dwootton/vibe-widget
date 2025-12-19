import * as React from "https://esm.sh/react@18";
import htm from "https://esm.sh/htm@3";

const html = htm.bind(React.createElement);

function getErrorSuggestion(errMessage) {
  if (errMessage.includes("is not a function") || errMessage.includes("Cannot read")) {
    return "Library import error. Check CDN URL and import syntax.";
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

  React.useEffect(() => {
    if (!code) return;

    const executeCode = async () => {
      try {
        setIsRetrying(false);
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
        console.error("Code execution error:", err);

        const retryCount = model.get("retry_count") || 0;

        if (retryCount < 2) {
          setIsRetrying(true);
          const errorDetails = err.toString() + "\n\nStack:\n" + (err.stack || "No stack trace");
          model.set("error_message", errorDetails);
          model.save_changes();
          return;
        }

        const suggestion = getErrorSuggestion(err.message || "");
        setError(suggestion ? `${err.message}\n\nSuggestion: ${suggestion}` : err.message);
      }
    };

    executeCode();
  }, [code, model]);

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

  return html`<${GuestWidget} model=${model} html=${html} React=${React} />`;
}
