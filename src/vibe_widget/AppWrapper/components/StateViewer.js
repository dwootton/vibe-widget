import * as React from "react";
import htm from "htm";
import ProgressMap from "./ProgressMap";

const html = htm.bind(React.createElement);

function buildStatusLabel(status) {
  if (status === "retrying") return "Repairing widget";
  if (status === "blocked") return "Repair blocked";
  if (status === "error") return "Repair failed";
  if (status === "generating") return "Generating widget";
  return "Preparing widget";
}

export default function StateViewer({
  status,
  logs,
  errorMessage,
  widgetError,
  retryCount,
  onSubmitPrompt
}) {
  const [prompt, setPrompt] = React.useState("");
  const isGenerating = status === "generating";
  const isRepairing = status === "retrying";
  const isRepairState = status === "error" || status === "blocked";
  const canPrompt = (isGenerating || isRepairState) && !isRepairing;
  const inputWidth = Math.max(1, prompt.length + 1);

  const displayLogs = React.useMemo(() => {
    const next = Array.isArray(logs) ? logs.slice() : [];
    if (errorMessage) {
      next.push(`Generation error:\n${errorMessage}`);
    }
    if (widgetError && widgetError !== errorMessage) {
      next.push(`Runtime error:\n${widgetError}`);
    }
    return next;
  }, [logs, errorMessage, widgetError]);

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed || !canPrompt) return;
    onSubmitPrompt(trimmed);
    setPrompt("");
  };

  const inputRow = html`
    <div class="state-input-row">
      <div class="log-entry log-entry--active log-entry--input">
      <style>
        .state-input-row {
          border-top: 1px solid rgba(148, 163, 184, 0.35);
          margin: 8px 8px 0;
          padding-top: 8px;
        }
        .log-entry--input {
          align-items: center;
        }
        .log-entry--input .log-text {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          background: transparent;
          padding: 0;
        }
        .state-input {
          flex: 0 1 auto;
          background: transparent;
          color: #f8fafc;
          border: none;
          outline: none;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          line-height: 1.4;
        }
        .state-input::placeholder {
          color: #6b7280;
        }
        .state-input:disabled {
          opacity: 0.6;
        }
        .state-input-caret {
          color: #f97316;
          animation: cursorBlink 1s steps(2, end) infinite;
        }
      </style>
      <span class="log-icon log-icon--active">${">"}</span>
      <span class="log-text">
        <input
          class="state-input"
          value=${prompt}
          placeholder=${canPrompt ? "" : ""}
          disabled=${!canPrompt}
          style=${{ width: `${inputWidth}ch`, maxWidth: "100%" }}
          onInput=${(event) => setPrompt(event.target.value)}
          onKeyDown=${(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleSubmit();
            }
          }}
        />
        <span class="state-input-caret">█</span>
      </span>
      </div>
    </div>
  `;

  return html`
    <div class="state-viewer">
      <style>
        .state-viewer {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 12px;
          box-sizing: border-box;
        }
        .state-viewer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #e2e8f0;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .state-viewer-status {
          color: ${status === "blocked" ? "#fca5a5" : "#f8fafc"};
        }
        .state-viewer-meta {
          font-size: 11px;
          color: #94a3b8;
          text-transform: none;
        }
        .state-viewer-body {
          flex: 1;
          min-height: 0;
        }
      </style>
      <div class="state-viewer-header">
        <span class="state-viewer-status">${buildStatusLabel(status)}</span>
        <span class="state-viewer-meta">Retries: ${retryCount ?? 0}</span>
      </div>
      <div class="state-viewer-body">
        <${ProgressMap} logs=${displayLogs} fullHeight=${true} footer=${inputRow} />
      </div>
    </div>
  `;
}
