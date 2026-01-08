import * as React from "react";
import htm from "htm";
import TerminalViewer from "./TerminalViewer";
import { buildStackSummary } from "../utils/stackSummary";

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
  widgetLogs,
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

  const displayLogs = React.useMemo(() => {
    const next = Array.isArray(logs) ? logs.slice() : [];
    if (errorMessage) {
      next.push(`Generation error:\n${errorMessage}`);
    }
    if (widgetError && widgetError !== errorMessage) {
      next.push(`Runtime error:\n${widgetError}`);
    }
    const isRepairing = status === "retrying"
      || (Array.isArray(logs) && logs.some((entry) => String(entry).toLowerCase().includes("repairing code")));
    if (isRepairing) {
      const summaryLines = buildStackSummary({
        errorMessage,
        widgetError,
        logs,
        widgetLogs
      });
      if (summaryLines.length > 0) {
        next.push(`Stack trace (most recent):\n${summaryLines.join("\n")}`);
      }
    }
    return next;
  }, [logs, widgetLogs, errorMessage, widgetError, status]);

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed || !canPrompt) return;
    onSubmitPrompt(trimmed);
    setPrompt("");
  };

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
        <${TerminalViewer}
          logs=${displayLogs}
          status=${status}
          heading=${"Welcome to Vibe Widgets!"}
          promptValue=${prompt}
          onPromptChange=${setPrompt}
          onPromptSubmit=${handleSubmit}
          promptDisabled=${!canPrompt}
          promptBlink=${true}
        />
      </div>
    </div>
  `;
}
