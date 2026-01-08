import React from "react";

function buildStatusLabel(status) {
  if (status === "retrying") return "Repairing widget";
  if (status === "blocked") return "Repair blocked";
  if (status === "error") return "Repair failed";
  if (status === "generating") return "Generating widget";
  return "Preparing widget";
}

export default function RuntimePanel({ status, errorMessage, widgetError, recentLogs }) {
  const activeError = errorMessage || widgetError;
  const label = buildStatusLabel(status);

  return (
    <div class="runtime-panel">
      <style>{`
        .runtime-panel {
          border: 1px solid rgba(242, 240, 233, 0.2);
          border-radius: 6px;
          padding: 8px 10px;
          background: rgba(10, 10, 10, 0.85);
          color: #e2e8f0;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
        }
        .runtime-panel h4 {
          margin: 0 0 6px 0;
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #f97316;
        }
        .runtime-panel ul {
          margin: 6px 0 0 16px;
          padding: 0;
          color: #cbd5e1;
        }
      `}</style>
      <h4>{label}</h4>
      {(status === "error" || status === "blocked") && (
        <div>Repair attempt failed. Check the logs.</div>
      )}
      {activeError && (
        <div>
          <div>Last error:</div>
          <div style={{ whiteSpace: "pre-wrap", color: "#fca5a5" }}>{activeError}</div>
        </div>
      )}
      {recentLogs.length ? (
        <ul>
          {recentLogs.map((entry, idx) => (
            <li key={idx}>{entry.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
