import React, { useMemo, useState } from "react";
import TerminalViewer from "./TerminalViewer";
import { buildStackSummary } from "../utils/stackSummary";

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
  lastRuntimeError,
  retryCount,
  hideOuterStatus = false,
  onSubmitPrompt
}) {
  const [prompt, setPrompt] = useState("");
  const isGenerating = status === "generating";
  const isRepairing = status === "retrying";
  const isRepairState = status === "error" || status === "blocked";
  const canPrompt = (isGenerating || isRepairState) && !isRepairing;

  const displayLogs = useMemo(() => {
    const next = Array.isArray(logs) ? logs.slice() : [];
    if (errorMessage) {
      next.push(`Generation error:\n${errorMessage}`);
    }
    if (widgetError && widgetError !== errorMessage) {
      next.push(`Runtime error:\n${widgetError}`);
    }
    if (lastRuntimeError) {
      const runtimeText = `Runtime error:\n${lastRuntimeError}`;
      const alreadyIncluded = next.some((entry) => String(entry).includes(lastRuntimeError));
      if (!alreadyIncluded) {
        next.push(runtimeText);
      }
    }
    if (Array.isArray(widgetLogs) && widgetLogs.length > 0) {
      widgetLogs
        .filter((entry) => entry && (entry.level === "error" || entry.level === "warn"))
        .forEach((entry) => {
          const message = entry && typeof entry === "object" ? entry.message : entry;
          if (message) {
            next.push(`Runtime log: ${message}`);
          }
        });
    }
    const isRepairingFlag =
      status === "retrying" ||
      (Array.isArray(logs) && logs.some((entry) => String(entry).toLowerCase().includes("repairing code")));
    if (isRepairingFlag) {
      const summaryLines = buildStackSummary({
        errorMessage,
        widgetError,
        logs,
        widgetLogs
      });
      if (summaryLines.length > 0) {
        const summaryText = `Stack trace (most recent):\n${summaryLines.join("\n")}`;
        const alreadyIncluded = next.some((entry) => String(entry).startsWith("Stack trace (most recent):"));
        if (!alreadyIncluded) {
          const repairIndex = next.findIndex((entry) =>
            String(entry).toLowerCase().includes("repairing code")
          );
          if (repairIndex >= 0) {
            next.splice(repairIndex + 1, 0, summaryText);
          } else {
            next.push(summaryText);
          }
        }
      }
    }
    return next;
  }, [logs, widgetLogs, errorMessage, widgetError, lastRuntimeError, status]);

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed || !canPrompt) return;
    onSubmitPrompt(trimmed);
    setPrompt("");
  };

  return (
    <div class="state-viewer">
      <style>{`
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
          width: 100%;
          padding: 0 8px;
        }
        .state-viewer-status {
          color: ${status === "blocked" ? "#fca5a5" : "#f8fafc"};
          flex: 1;
        }
        .state-viewer-meta {
          font-size: 11px;
          color: #9ca3af;
          text-transform: none;
          text-align: right;
        }
        .state-viewer-body {
          flex: 1;
          min-height: 0;
        }
        .state-debug-banner {
          border: 1px solid rgba(242, 240, 233, 0.35);
          background: rgba(26, 26, 26, 0.7);
          color: #f8fafc;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 11px;
          line-height: 1.4;
          padding: 8px 10px;
          border-radius: 6px;
          white-space: pre-wrap;
        }
      `}</style>
      {!hideOuterStatus && (
        <div class="state-viewer-header">
          <span class="state-viewer-status">{buildStatusLabel(status)}</span>
          <span class="state-viewer-meta">Retries: {retryCount ?? 0}</span>
        </div>
      )}
      <div class="state-viewer-body">
        <TerminalViewer
          logs={displayLogs}
          status={status}
          heading={`Status: ${buildStatusLabel(status)} • Retries: ${retryCount ?? 0}`}
          promptValue={prompt}
          onPromptChange={setPrompt}
          onPromptSubmit={handleSubmit}
          promptDisabled={!canPrompt}
          promptBlink={true}
        />
      </div>
    </div>
  );
}
