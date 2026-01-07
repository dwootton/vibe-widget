import * as React from "react";
import htm from "htm";

const html = htm.bind(React.createElement);

function formatMessage(status) {
  if (status === "retrying") {
    return "Error detected. Asking the LLM to fix the issue...";
  }
  if (status === "blocked") {
    return "Automatic repair is blocked after repeated failures.";
  }
  return "Runtime error detected.";
}

export default function RuntimePanel({
  status,
  errorMessage,
  widgetError,
  widgetLogs,
  onRetry
}) {
  const activeError = widgetError || errorMessage || "";
  const shouldShow = status === "retrying" || status === "error" || status === "blocked" || activeError;
  const recentLogs = Array.isArray(widgetLogs) ? widgetLogs.slice(-3) : [];

  if (!shouldShow) {
    return null;
  }

  return html`
    <div style=${{
      padding: "12px 16px",
      marginBottom: "12px",
      borderRadius: "10px",
      background: status === "blocked" ? "#3a1d1d" : "#1f2937",
      color: "#f8fafc",
      fontFamily: "monospace",
      whiteSpace: "pre-wrap",
    }}>
      <div style=${{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <strong>${formatMessage(status)}</strong>
        ${(status === "error" || status === "blocked") && html`
          <button
            onClick=${onRetry}
            style=${{
              background: "transparent",
              color: "#f8fafc",
              border: "1px solid #64748b",
              borderRadius: "6px",
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Retry run
          </button>
        `}
      </div>
      ${activeError && html`
        <div style=${{ marginTop: "8px", fontSize: "12px", color: "#fca5a5" }}>
          ${activeError}
        </div>
      `}
      ${recentLogs.length ? html`
        <div style=${{ marginTop: "8px", fontSize: "12px", color: "#94a3b8" }}>
          Recent logs:
          <ul style=${{ margin: "6px 0 0 16px", padding: 0 }}>
            ${recentLogs.map((entry) => html`<li>${entry.message}</li>`)}
          </ul>
        </div>
      ` : null}
    </div>
  `;
}
