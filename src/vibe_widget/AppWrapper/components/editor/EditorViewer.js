import React, { useMemo, useState } from "react";
import CodeEditor from "./CodeEditor";
import AuditPanel from "./AuditPanel";
import EditorHeader from "./EditorHeader";
import TerminalViewer from "../TerminalViewer";
import { buildStackSummary } from "../../utils/stackSummary";

export default function EditorViewer({
  code,
  errorMessage,
  status,
  logs,
  widgetLogs,
  stateErrorMessage,
  stateWidgetError,
  lastRuntimeError,
  auditStatus,
  auditReport,
  auditError,
  auditMeta,
  auditData,
  auditApplyStatus,
  auditApplyResponse,
  auditApplyError,
  onAudit,
  onApply,
  onClose,
  onSubmitPrompt,
  approvalMode,
  isApproved,
  onApprove
}) {
  const [draftCode, setDraftCode] = useState(code || "");
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [dismissedConcerns, setDismissedConcerns] = useState({});
  const [showDismissed, setShowDismissed] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});
  const [technicalCards, setTechnicalCards] = useState({});
  const [editingBubbleId, setEditingBubbleId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [codeChangeRanges, setCodeChangeRanges] = useState([]);
  const [terminalPrompt, setTerminalPrompt] = useState("");
  const [showDismissedLocal, setShowDismissedLocal] = useState(false);

  const hasAuditReport = auditReport && auditReport.length > 0;
  const auditPayload = auditData?.fast_audit || auditData?.full_audit || null;
  const auditSavedPath = auditMeta?.saved_path || "";
  const auditIndicator = auditSavedPath
    ? `Saved to ${auditSavedPath}`
    : hasAuditReport
      ? "Audit saved"
      : "";
  const hasAuditPayload = !!auditPayload;
  const showApprove = approvalMode && !isApproved;
  const canPrompt = status !== "retrying";

  const displayLogs = useMemo(() => {
    const next = Array.isArray(logs) ? logs.slice() : [];
    if (stateErrorMessage) {
      next.push(`Generation error:\n${stateErrorMessage}`);
    }
    if (stateWidgetError && stateWidgetError !== stateErrorMessage) {
      next.push(`Runtime error:\n${stateWidgetError}`);
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
    const isRepairing =
      status === "retrying" ||
      (Array.isArray(logs) && logs.some((entry) => String(entry).toLowerCase().includes("repairing code")));
    if (isRepairing) {
      const summaryLines = buildStackSummary({
        errorMessage: stateErrorMessage,
        widgetError: stateWidgetError,
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
  }, [logs, widgetLogs, stateErrorMessage, stateWidgetError, lastRuntimeError, status]);

  const visibleConcerns = auditPayload?.concerns || auditPayload?.concerns || [];

  return (
    <div class="source-viewer">
      <style>{`
        .source-viewer {
          position: fixed;
          inset: 0;
          z-index: 1100;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          box-sizing: border-box;
        }
        .source-viewer-card {
          width: min(1080px, 96vw);
          height: min(720px, 92vh);
          background: #0c0c0c;
          border: 1px solid rgba(242, 240, 233, 0.12);
          border-radius: 8px;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .source-viewer-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 8px 12px 12px;
          overflow: hidden;
        }
        .source-viewer-main {
          flex: 1;
          display: grid;
          grid-template-columns: ${showAuditPanel ? "minmax(0, 1fr) 320px" : "minmax(0, 1fr)"};
          gap: 12px;
          min-height: 0;
        }
        .source-viewer-terminal {
          margin-top: 6px;
        }
        .source-viewer-error-banner {
          background: rgba(239, 125, 69, 0.1);
          color: #fca5a5;
          border: 1px solid rgba(239, 125, 69, 0.4);
          border-radius: 6px;
          padding: 8px 10px;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          white-space: pre-wrap;
        }
        .source-debug-banner {
          background: rgba(59, 130, 246, 0.12);
          color: #cbd5e1;
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 6px;
          padding: 8px 10px;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          white-space: pre-wrap;
        }
      `}</style>
      <div class="source-viewer-card" role="dialog" aria-live="polite">
        <EditorHeader
          showApprove={showApprove}
          auditIndicator={auditIndicator}
          auditStatus={auditStatus}
          hasAuditPayload={hasAuditPayload}
          showAuditPanel={showAuditPanel}
          onToggleAuditPanel={() => setShowAuditPanel(!showAuditPanel)}
          onRunAudit={() => {
            setShowAuditPanel(true);
            onAudit("fast");
          }}
          onApprove={onApprove}
          onClose={onClose}
        />
        <div class="source-viewer-body">
          {lastRuntimeError && <div class="source-debug-banner">Last runtime error:{`\n`}{lastRuntimeError}</div>}
          {errorMessage && <div class="source-viewer-error-banner">{errorMessage}</div>}
          {auditError && <div class="source-viewer-error-banner">Audit failed: {auditError}</div>}
          {auditApplyError && <div class="source-viewer-error-banner">Apply failed: {auditApplyError}</div>}
          <div class="source-viewer-main">
            <CodeEditor value={draftCode} onChange={setDraftCode} />
            {showAuditPanel && (
              <AuditPanel
                hasAuditPayload={hasAuditPayload}
                visibleConcerns={visibleConcerns}
                dismissedConcerns={dismissedConcerns}
                showDismissed={showDismissed}
                onToggleDismissed={() => setShowDismissed(!showDismissed)}
                onRestoreDismissed={(cardId) => {
                  const next = { ...dismissedConcerns };
                  delete next[cardId];
                  setDismissedConcerns(next);
                }}
                expandedCards={expandedCards}
                technicalCards={technicalCards}
                hoveredCardId={hoveredCardId}
                onHoverCard={setHoveredCardId}
                onToggleExpanded={(cardId) => setExpandedCards((prev) => ({ ...prev, [cardId]: !prev[cardId] }))}
                onToggleTechnical={(cardId) => setTechnicalCards((prev) => ({ ...prev, [cardId]: !prev[cardId] }))}
                onAddPendingChange={(concern, cardId, options) => {
                  setPendingChanges((prev) => prev.concat([{ itemId: options.itemId || `${cardId}-change`, cardId, label: options.label || concern.summary || "Audit change" }]));
                }}
                onDismissConcern={(cardId, label) => {
                  setDismissedConcerns((prev) => ({ ...prev, [cardId]: label }));
                }}
                onScrollToLines={(location) => {
                  // No-op in this simplified viewer
                }}
                onRunAudit={() => {
                  setShowAuditPanel(true);
                  onAudit("fast");
                }}
              />
            )}
          </div>
          <div
            class="source-viewer-terminal"
            style={{ height: "180px" }}
          >
            <TerminalViewer
              logs={displayLogs}
              status={status || "ready"}
              heading={null}
              promptValue={terminalPrompt}
              onPromptChange={setTerminalPrompt}
              onPromptSubmit={onSubmitPrompt ? () => onSubmitPrompt(terminalPrompt) : () => {}}
              promptDisabled={!canPrompt}
              attachments={{
                pendingChanges,
                codeChangeRanges,
                isDirty: false,
                editingBubbleId,
                editingText,
                onStartEdit: () => {},
                onEditingTextChange: setEditingText,
                onSaveEdit: () => {},
                onRemovePending: () => {},
                onHoverCard: setHoveredCardId,
                bubbleEditorRef: null
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
