import React, { useMemo, useState } from "react";
import TerminalViewer from "./TerminalViewer";
import { buildStackSummary } from "../utils/stackSummary";
import { tw } from "../styles/setup.js";

function buildStatusLabel(status) {
  if (status === "retrying") return "Repairing widget";
  if (status === "blocked") return "Repair blocked";
  if (status === "error") return "Repair failed";
  if (status === "generating") return "Generating widget";
  return "Preparing widget";
}

const containerClass = tw("w-full h-full flex flex-col gap-3 p-3 box-border");
const headerClass = tw("flex items-center justify-between gap-2 w-full px-2 text-xs font-mono uppercase tracking-[0.06em]");
const metaClass = tw("text-[11px] text-text-muted text-right");
const bodyClass = tw("flex-1 min-h-0 flex");

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
  const containerRef = React.useRef(null);

  const displayLogs = useMemo(() => {
    const next = Array.isArray(logs) ? logs.slice() : [];
    const shouldSkipMessage = (message) => {
      const text = String(message || "").toLowerCase();
      return (
        text.includes("cannot send widget sync message") ||
        text.includes("error: cannot send")
      );
    };
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
          if (message && !shouldSkipMessage(message)) {
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

  const statusColor = status === "blocked" ? "text-error-light" : "text-text-primary";

  React.useEffect(() => {
    if (canPrompt) return;
    const active = document.activeElement;
    if (active && containerRef.current && containerRef.current.contains(active)) {
      active.blur();
    }
  }, [canPrompt]);

  return (
    <div class={containerClass} ref={containerRef}>
      {!hideOuterStatus && (
        <div class={headerClass}>
          <span class={`${statusColor} flex-1`}>{buildStatusLabel(status)}</span>
          <span class={metaClass}>Retries: {retryCount ?? 0}</span>
        </div>
      )}
      <div class={bodyClass}>
        <TerminalViewer
          logs={displayLogs}
          status={status}
          heading={`Status: ${buildStatusLabel(status)} • Retries: ${retryCount ?? 0}`}
          promptValue={prompt}
          onPromptChange={setPrompt}
          onPromptSubmit={handleSubmit}
          promptDisabled={!canPrompt}
          promptBlink={true}
          promptAutoFocus={false}
          showPrompt={canPrompt}
          debugLabel="StateViewer"
        />
      </div>
    </div>
  );
}
