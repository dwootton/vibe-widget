import React, { useMemo, useState } from "react";
import CodeEditor from "./CodeEditor";
import AuditPanel from "./AuditPanel";
import EditorHeader from "./EditorHeader";
import TerminalViewer from "../TerminalViewer";
import { buildStackSummary } from "../../utils/stackSummary";
import { tw } from "../../styles/setup.js";

const overlayClass = tw(
  "absolute inset-0 z-[1100] flex items-stretch justify-stretch p-4 box-border bg-[rgba(0,0,0,0.7)] backdrop-blur-[4px]"
);
const cardClass = tw(
  "w-full h-full max-w-full max-h-full bg-[#0c0c0c] border border-[rgba(242,240,233,0.12)] rounded-[8px] shadow-[0_18px_48px_rgba(0,0,0,0.55)] flex flex-col overflow-hidden min-w-0 min-h-0"
);
const bodyClass = tw("flex-1 flex flex-col min-h-0 gap-2 p-[8px_12px_12px] overflow-hidden");
const errorBannerClass = tw(
  "rounded-[6px] border border-[rgba(239,125,69,0.4)] bg-[rgba(239,125,69,0.1)] text-error-light text-[12px] font-mono whitespace-pre-wrap px-3 py-2"
);
const debugBannerClass = tw(
  "rounded-[6px] border border-[rgba(59,130,246,0.3)] bg-[rgba(59,130,246,0.12)] text-[#cbd5e1] text-[12px] font-mono whitespace-pre-wrap px-3 py-2"
);
const mainGridClass = tw("flex-1 grid gap-3 min-h-0 min-w-0");
const terminalWrapperClass = tw("mt-1");

export default function EditorViewer({
  code,
  initialDraft,
  initialCodeChangeRanges,
  onDraftChange,
  onCodeChangeRangesChange,
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
  const [draftCode, setDraftCode] = useState(initialDraft ?? code ?? "");
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [dismissedConcerns, setDismissedConcerns] = useState({});
  const [showDismissed, setShowDismissed] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});
  const [technicalCards, setTechnicalCards] = useState({});
  const [editingBubbleId, setEditingBubbleId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [codeChangeRanges, setCodeChangeRanges] = useState(initialCodeChangeRanges || []);
  const [terminalPrompt, setTerminalPrompt] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy");
  const baseCodeRef = React.useRef(code || "");

  React.useEffect(() => {
    if (initialDraft === undefined || initialDraft === null) return;
    if (initialDraft !== draftCode) {
      setDraftCode(initialDraft);
    }
  }, [initialDraft]);

  React.useEffect(() => {
    if (!code) return;
    if (code !== baseCodeRef.current) {
      baseCodeRef.current = code;
    }
  }, [code]);

  const computeDiffRanges = React.useCallback((baseText, nextText) => {
    const baseLines = String(baseText || "").split("\n");
    const nextLines = String(nextText || "").split("\n");
    const maxLines = Math.max(baseLines.length, nextLines.length);
    const ranges = [];
    let currentStart = null;
    for (let i = 0; i < maxLines; i += 1) {
      const baseLine = baseLines[i];
      const nextLine = nextLines[i];
      const differs = baseLine !== nextLine;
      if (differs && currentStart === null) {
        currentStart = i + 1;
      }
      if (!differs && currentStart !== null) {
        ranges.push([currentStart, i]);
        currentStart = null;
      }
    }
    if (currentStart !== null) {
      ranges.push([currentStart, maxLines]);
    }
    return ranges;
  }, []);

  React.useEffect(() => {
    if (!code) return;
    if (draftCode === code) {
      if (codeChangeRanges.length !== 0) {
        setCodeChangeRanges([]);
        onCodeChangeRangesChange?.([]);
      }
      onDraftChange?.(draftCode);
      return;
    }
    const ranges = computeDiffRanges(code, draftCode);
    setCodeChangeRanges(ranges);
    onCodeChangeRangesChange?.(ranges);
    onDraftChange?.(draftCode);
  }, [code, draftCode, computeDiffRanges, onDraftChange, onCodeChangeRangesChange]);

  const hasAuditReport = auditReport && auditReport.length > 0;
  const auditPayload = auditData?.fast_audit || auditData?.full_audit || null;
  const hasAuditPayload = !!(auditPayload && Object.keys(auditPayload).length > 0);
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

  const handleOverlayClick = (event) => {
    if (event.target !== event.currentTarget) return;
    onClose();
  };
  const handleCopy = async () => {
    const text = draftCode || code || "";
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyLabel("Copied");
      setTimeout(() => setCopyLabel("Copy"), 1200);
    } catch (err) {
      console.error("Copy failed:", err);
      setCopyLabel("Failed");
      setTimeout(() => setCopyLabel("Copy"), 1200);
    }
  };
  const formatCodeRange = (range) => {
    if (typeof range === "string") return range;
    if (!range || typeof range !== "object") return "";
    const start = range.startLine ?? range.from ?? range.start ?? range.line;
    const end = range.endLine ?? range.to ?? range.end ?? start;
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return start === end ? `line ${start}` : `lines ${start}-${end}`;
    }
    return "";
  };

  const handleTerminalSubmit = () => {
    if (!onSubmitPrompt) return;
    const trimmed = terminalPrompt.trim();
    const hasAttachments = pendingChanges.length > 0 || codeChangeRanges.length > 0;
    if (!trimmed && !hasAttachments) return;
    const codeChanged = draftCode !== code;
    if (!trimmed && pendingChanges.length === 0 && codeChangeRanges.length > 0 && onApply && codeChanged) {
      onApply(draftCode);
      setTerminalPrompt("");
      onClose();
      return;
    }
    const basePrompt = trimmed || "Apply selected audit changes.";
    const sections = [basePrompt];
    if (pendingChanges.length > 0) {
      const items = pendingChanges
        .map((item) => {
          const label = item?.label || item?.summary || "Audit change";
          const suffix = item?.cardId ? ` (${item.cardId})` : "";
          return `- ${label}${suffix}`;
        })
        .filter(Boolean);
      if (items.length > 0) {
        sections.push(`AUDIT CHANGES:\n${items.join("\n")}`);
      }
    }
    if (codeChangeRanges.length > 0) {
      const items = codeChangeRanges
        .map((range, index) => {
          const label = formatCodeRange(range) || `change ${index + 1}`;
          return `- ${label}`;
        })
        .filter(Boolean);
      if (items.length > 0) {
        sections.push(`CODE CHANGES:\n${items.join("\n")}`);
      }
    }
    onSubmitPrompt({
      prompt: sections.join("\n\n"),
      base_code: draftCode,
      code_change_ranges: codeChangeRanges
    });
    if (pendingChanges.length > 0) {
      setDismissedConcerns((prev) => {
        const next = { ...prev };
        pendingChanges.forEach((item) => {
          if (item?.cardId) {
            next[item.cardId] = item?.label || item?.summary || "Audit change";
          }
        });
        return next;
      });
      setPendingChanges([]);
    }
    setTerminalPrompt("");
    onClose();
  };
  const handleAuditAction = () => {
    if (!onAudit) return;
    if (hasAuditPayload) {
      setShowAuditPanel((prev) => !prev);
      return;
    }
    setShowAuditPanel(true);
    onAudit("fast");
  };

  return (
    <div class={overlayClass} onClick={handleOverlayClick}>
      <div class={cardClass} role="dialog" aria-live="polite" onClick={(event) => event.stopPropagation()}>
        <EditorHeader
          showApprove={showApprove}
          hasAuditPayload={hasAuditPayload}
          auditStatus={auditStatus}
          showAuditPanel={showAuditPanel}
          onToggleAuditPanel={() => setShowAuditPanel(!showAuditPanel)}
          onRunAudit={handleAuditAction}
          onCopy={handleCopy}
          copyLabel={copyLabel}
          copyDisabled={!draftCode && !code}
          onApprove={onApprove}
          onClose={onClose}
        />
        <div class={bodyClass}>
          {lastRuntimeError && <div class={debugBannerClass}>Last runtime error:{`\n`}{lastRuntimeError}</div>}
          {errorMessage && <div class={errorBannerClass}>{errorMessage}</div>}
          {auditError && <div class={errorBannerClass}>Audit failed: {auditError}</div>}
          {auditApplyError && <div class={errorBannerClass}>Apply failed: {auditApplyError}</div>}
          <div
            class={mainGridClass}
            style={{
              gridTemplateColumns: showAuditPanel ? "minmax(0, 1fr) minmax(260px, 32%)" : "minmax(0, 1fr)",
              gridAutoRows: "minmax(0, 1fr)"
            }}
          >
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
                  setPendingChanges((prev) => prev.filter((item) => item.cardId !== cardId));
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
          <div class={terminalWrapperClass}>
            <TerminalViewer
              logs={[]}
              status={status || "ready"}
              heading={null}
              promptValue={terminalPrompt}
              onPromptChange={setTerminalPrompt}
              onPromptSubmit={handleTerminalSubmit}
              promptDisabled={!canPrompt}
              debugLabel="EditorViewer"
              compact={true}
              showFooterBorder={false}
              promptMaxHeight={80}
              promptAlign="start"
              promptAutoFocus={true}
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
