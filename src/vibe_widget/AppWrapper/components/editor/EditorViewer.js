import * as React from "react";
import htm from "htm";
import { EditorView } from "@codemirror/view";
import CodeEditor from "./CodeEditor";
import AuditPanel from "./AuditPanel";
import EditorHeader from "./EditorHeader";
import TerminalViewer from "../TerminalViewer";
import { buildStackSummary } from "../../utils/stackSummary";

const html = htm.bind(React.createElement);

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
  const editorRef = React.useRef(null);
  const [draftCode, setDraftCode] = React.useState(code || "");
  const isDirtyRef = React.useRef(false);
  const autoScrollRef = React.useRef(false);
  const [showAuditPanel, setShowAuditPanel] = React.useState(false);
  const [pendingChanges, setPendingChanges] = React.useState([]);
  const [dismissedConcerns, setDismissedConcerns] = React.useState({});
  const [showDismissed, setShowDismissed] = React.useState(false);
  const [hoveredCardId, setHoveredCardId] = React.useState(null);
  const [expandedCards, setExpandedCards] = React.useState({});
  const [technicalCards, setTechnicalCards] = React.useState({});
  const [editingBubbleId, setEditingBubbleId] = React.useState(null);
  const [editingText, setEditingText] = React.useState("");
  const [codeChangeRanges, setCodeChangeRanges] = React.useState([]);
  const [lastClearSnapshot, setLastClearSnapshot] = React.useState(null);
  const [terminalPrompt, setTerminalPrompt] = React.useState("");
  const lastAppliedChangesRef = React.useRef(null);
  const bubbleEditorRef = React.useRef(null);
  const workspaceRef = React.useRef(null);
  const mainAreaRef = React.useRef(null);
  const [workspaceSplit, setWorkspaceSplit] = React.useState(0.65);
  const [panelSplit, setPanelSplit] = React.useState(0.62);
  const [panelOrientation, setPanelOrientation] = React.useState("horizontal");

  React.useEffect(() => {
    console.debug("[vibe][audit] EditorViewer auditStatus", auditStatus, {
      hasAuditPayload: !!(auditData?.fast_audit || auditData?.full_audit),
      auditError
    });
  }, [auditStatus, auditData, auditError]);

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

  const displayLogs = React.useMemo(() => {
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
    const isRepairing = status === "retrying"
      || (Array.isArray(logs) && logs.some((entry) => String(entry).toLowerCase().includes("repairing code")));
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

  const getCardId = (concern, index) => {
    const base = concern?.id || `concern-${index}`;
    const location = Array.isArray(concern?.location) ? concern.location.join("-") : "global";
    return `${base}-${location}-${index}`;
  };

  const visibleConcerns = (auditPayload?.concerns || [])
    .map((concern, index) => ({
      concern,
      cardId: getCardId(concern, index),
      index
    }))
    .filter((item) => !dismissedConcerns[item.cardId]);

  const normalizeCode = React.useCallback((value) => {
    return (value || "").replace(/\r\n/g, "\n");
  }, []);

  React.useEffect(() => {
    isDirtyRef.current = normalizeCode(draftCode) !== normalizeCode(code || "");
  }, [draftCode, code, normalizeCode]);

  React.useEffect(() => {
    if (approvalMode) {
      setShowAuditPanel(true);
    }
  }, [approvalMode]);

  React.useEffect(() => {
    if (!isDirtyRef.current) {
      setDraftCode(code || "");
    }
  }, [code]);

  React.useEffect(() => {
    if (!editorRef.current) return;
    const container = editorRef.current.getContainer();
    const view = editorRef.current.getView();
    if (!container || !view) return;

    const handleWindowKeyDown = (event) => {
      if (container.contains(event.target)) {
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };
    const canScrollEditor = (deltaY) => {
      const scroller = view.scrollDOM;
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      if (maxScroll <= 0) return false;
      if (deltaY < 0) return scroller.scrollTop > 0;
      if (deltaY > 0) return scroller.scrollTop < maxScroll;
      return false;
    };
    const handleWheel = (event) => {
      if (!container.contains(event.target)) return;
      if (!canScrollEditor(event.deltaY)) {
        return;
      }
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    const handleTouchMove = (event) => {
      if (!container.contains(event.target)) return;
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    window.addEventListener("keydown", handleWindowKeyDown, true);
    window.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    window.addEventListener("touchmove", handleTouchMove, { capture: true, passive: false });
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown, true);
      window.removeEventListener("wheel", handleWheel, true);
      window.removeEventListener("touchmove", handleTouchMove, true);
    };
  }, [editorRef]);

  React.useEffect(() => {
    if (!editorRef.current || isDirtyRef.current) return;
    const view = editorRef.current.getView();
    if (!view) return;
    const doc = view.state.doc.toString();
    if (!doc || autoScrollRef.current) return;
    const match = doc.match(/\\bexport\\s+default\\b/);
    if (!match) return;
    const pos = match.index ?? 0;
    view.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: "center" })
    });
    autoScrollRef.current = true;
  }, [draftCode]);

  React.useEffect(() => {
    if (auditApplyResponse?.success) {
      const applied = lastAppliedChangesRef.current || [];
      const dismissed = applied
        .filter((item) => (item.source === "recommendation" || item.source === "base") && item.cardId)
        .map((item) => item.cardId);
      if (dismissed.length > 0) {
        setDismissedConcerns((prev) => {
          const next = { ...prev };
          dismissed.forEach((cardId) => {
            next[cardId] = next[cardId] || cardId;
          });
          return next;
        });
      }
      setPendingChanges([]);
      lastAppliedChangesRef.current = null;
    }
  }, [auditApplyResponse]);

  const computeChangedRanges = (nextCode, prevCode) => {
    const nextLines = (nextCode || "").split("\\n");
    const prevLines = (prevCode || "").split("\\n");
    const maxLen = Math.max(nextLines.length, prevLines.length);
    const changed = [];
    for (let i = 0; i < maxLen; i += 1) {
      if (nextLines[i] !== prevLines[i]) {
        changed.push(i + 1);
      }
    }
    if (changed.length === 0) return [];
    const ranges = [];
    let start = changed[0];
    let end = changed[0];
    for (let i = 1; i < changed.length; i += 1) {
      const line = changed[i];
      if (line === end + 1) {
        end = line;
      } else {
        ranges.push([start, end]);
        start = line;
        end = line;
      }
    }
    ranges.push([start, end]);
    return ranges;
  };

  React.useEffect(() => {
    setCodeChangeRanges(computeChangedRanges(draftCode, code || ""));
  }, [draftCode, code]);

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const getPointerPoint = (event) => {
    if (event.touches && event.touches[0]) {
      return event.touches[0];
    }
    return event;
  };

  const startWorkspaceResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const workspaceNode = workspaceRef.current;
    if (!workspaceNode) return;
    const { top, height } = workspaceNode.getBoundingClientRect();
    const handleMove = (moveEvent) => {
      moveEvent.preventDefault();
      const point = getPointerPoint(moveEvent);
      if (!point) return;
      const ratio = clamp((point.clientY - top) / height, 0.28, 0.86);
      setWorkspaceSplit(ratio);
    };
    const handleUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
  };

  const startPanelResize = (event) => {
    if (!showAuditPanel) return;
    event.preventDefault();
    event.stopPropagation();
    const mainNode = mainAreaRef.current;
    if (!mainNode) return;
    const rect = mainNode.getBoundingClientRect();
    const isHorizontal = panelOrientation === "horizontal";
    const size = isHorizontal ? rect.width : rect.height;
    const offset = isHorizontal ? rect.left : rect.top;
    const handleMove = (moveEvent) => {
      moveEvent.preventDefault();
      const point = getPointerPoint(moveEvent);
      if (!point || size <= 0) return;
      const position = isHorizontal ? point.clientX : point.clientY;
      const ratio = clamp((position - offset) / size, 0.2, 0.8);
      setPanelSplit(ratio);
    };
    const handleUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
    document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
  };

  const togglePanelOrientation = () => {
    setPanelOrientation((prev) => (prev === "horizontal" ? "vertical" : "horizontal"));
  };

  const ensureConsoleSpace = () => {
    setWorkspaceSplit((prev) => clamp(prev - 0.08, 0.28, 0.86));
  };

  const toggleExpanded = (cardId) => {
    setExpandedCards((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  const toggleTechnical = (cardId) => {
    setTechnicalCards((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  const addPendingChange = (concern, cardId, options = {}) => {
    if (!concern || !cardId) return;
    const itemId = options.itemId || cardId;
    setPendingChanges((prev) => {
      if (prev.some((item) => item.itemId === itemId)) {
        return prev;
      }
      const label = options.label || concern.summary || concern.id || "Audit change";
      return [
        ...prev,
        {
          itemId,
          cardId,
          label,
          summary: concern.summary || "",
          technical_summary: concern.technical_summary || "",
          details: concern.details || "",
          location: concern.location,
          id: concern.id || "",
          impact: concern.impact || "low",
          source: options.source || "",
          alternative: options.alternative || "",
          user_note: options.user_note || ""
        }
      ];
    });
  };

  const removePendingChange = (itemId) => {
    setPendingChanges((prev) => prev.filter((item) => item.itemId !== itemId));
  };

  const dismissConcern = (cardId, label) => {
    setDismissedConcerns((prev) => ({ ...prev, [cardId]: label || cardId }));
  };

  const restoreDismissed = (cardId) => {
    setDismissedConcerns((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
  };

  const startEditingBubble = (item) => {
    if (!item) return;
    setEditingBubbleId(item.itemId);
    setEditingText(item.user_note || item.label || "");
  };

  const saveBubbleEdit = () => {
    if (!editingBubbleId) return;
    setPendingChanges((prev) =>
      prev.map((item) =>
        item.itemId === editingBubbleId
          ? { ...item, user_note: editingText.trim() }
          : item
      )
    );
    setEditingBubbleId(null);
    setEditingText("");
  };

  React.useEffect(() => {
    if (!editingBubbleId) return;
    const handleClick = (event) => {
      if (!bubbleEditorRef.current) return;
      if (!bubbleEditorRef.current.contains(event.target)) {
        saveBubbleEdit();
      }
    };
    document.addEventListener("mousedown", handleClick, true);
    return () => document.removeEventListener("mousedown", handleClick, true);
  }, [editingBubbleId, editingText]);

  const scrollToLines = (lines) => {
    if (!editorRef.current) return;
    const view = editorRef.current.getView();
    if (!view || !lines || lines.length === 0) return;
    const doc = view.state.doc;
    const maxLine = doc.lines;
    const valid = lines
      .map((line) => parseInt(line, 10))
      .filter((line) => Number.isFinite(line) && line > 0 && line <= maxLine);
    if (valid.length === 0) return;
    const startLine = Math.min(...valid);
    const endLine = Math.max(...valid);
    const start = doc.line(startLine).from;
    const end = doc.line(endLine).to;
    view.dispatch({
      selection: { anchor: start, head: end },
      effects: EditorView.scrollIntoView(start, { y: "center" })
    });
  };

  const handleSend = (noteOverride = "") => {
    const noteText = noteOverride.trim();
    const hasPending = pendingChanges.length > 0 || noteText.length > 0;
    if (hasPending) {
      lastAppliedChangesRef.current = pendingChanges.slice();
      onApply({
        type: "audit_apply",
        baseCode: draftCode,
        changes: [
          ...pendingChanges,
          ...(noteText.length > 0
            ? [{
                itemId: `manual-${Date.now()}`,
                cardId: "manual",
                label: noteText,
                summary: noteText,
                user_note: noteText,
                location: "global"
              }]
            : [])
        ]
      });
      return;
    }
    if (isDirtyRef.current) {
      const normalizedDraft = normalizeCode(draftCode);
      const normalizedCode = normalizeCode(code || "");
      if (normalizedDraft !== normalizedCode) {
        onApply(draftCode);
      }
    }
  };

  const handleCloseRequest = () => {
    if (showApprove) {
      return;
    }
    if (pendingChanges.length > 0 || isDirtyRef.current) {
      handleSend("");
    }
    onClose();
  };

  const handleTerminalSubmit = () => {
    const trimmed = terminalPrompt.trim();
    const hasAttachments = pendingChanges.length > 0 || codeChangeRanges.length > 0 || isDirtyRef.current;
    if (hasAttachments) {
      handleSend(trimmed);
      setTerminalPrompt("");
      ensureConsoleSpace();
      return;
    }
    if (!trimmed || !canPrompt || !onSubmitPrompt) return;
    onSubmitPrompt(trimmed);
    setTerminalPrompt("");
    ensureConsoleSpace();
  };

  const workspaceRows = React.useMemo(() => {
    const topPercent = Math.round(workspaceSplit * 1000) / 10;
    const bottomPercent = Math.max(0, Math.round((100 - topPercent) * 10) / 10);
    return `minmax(200px, ${topPercent}%) 10px minmax(120px, ${bottomPercent}%)`;
  }, [workspaceSplit]);

  const mainGridStyle = React.useMemo(() => {
    if (!showAuditPanel) {
      return { gridTemplateColumns: "minmax(0, 1fr)" };
    }
    const codePercent = Math.round(panelSplit * 1000) / 10;
    const auditPercent = Math.max(0, Math.round((100 - codePercent) * 10) / 10);
    if (panelOrientation === "horizontal") {
      return {
        gridTemplateColumns: `minmax(0, ${codePercent}%) 10px minmax(0, ${auditPercent}%)`
      };
    }
    return {
      gridTemplateRows: `minmax(0, ${codePercent}%) 10px minmax(0, ${auditPercent}%)`,
      gridTemplateColumns: "1fr"
    };
  }, [panelOrientation, panelSplit, showAuditPanel]);

  return html`
    <div
      class="source-viewer-overlay"
      onMouseDown=${(event) => {
        if (event.target === event.currentTarget) {
          handleCloseRequest();
        }
      }}
    >
      <style>
        .source-viewer-overlay {
          position: absolute;
          inset: 0;
          z-index: 1150;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 10, 10, 0.82);
          backdrop-filter: blur(4px);
        }
        .source-viewer-card {
          width: min(1020px, 96%);
          height: 96%;
          background: #1a1a1a;
          border: 2px solid rgba(242, 240, 233, 0.6);
          border-radius: 2px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
          display: flex;
          flex-direction: column;
        }
        .source-viewer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(242, 240, 233, 0.35);
          color: #f2f0e9;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .source-viewer-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .source-viewer-button {
          background: #0f0f0f;
          color: #f2f0e9;
          border: 1px solid rgba(242, 240, 233, 0.35);
          border-radius: 2px;
          padding: 4px 8px;
          font-size: 10px;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .source-viewer-button.subtle {
          background: transparent;
          border-color: rgba(242, 240, 233, 0.2);
          color: #cbd5f5;
        }
        .source-viewer-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .audit-indicator {
          color: #6b7280;
          font-size: 10px;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          max-width: 240px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .source-viewer-body {
          padding: 14px 16px 18px;
          overflow: hidden;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .source-viewer-workspace {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-rows: 65% 10px 35%;
          gap: 0;
        }
        .workspace-splitter {
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: row-resize;
          background: transparent;
          padding: 4px 0;
          user-select: none;
          touch-action: none;
        }
        .workspace-splitter-line {
          width: 100%;
          height: 1px;
          background: #3f3f46;
          border-radius: 0;
        }
        .source-debug-banner {
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
        .source-viewer-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 0;
          overflow: hidden;
          min-height: 0;
        }
        .source-viewer-main--stacked {
          grid-template-columns: 1fr;
        }
        .panel-splitter {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(17, 17, 17, 0.8);
          cursor: col-resize;
          user-select: none;
          touch-action: none;
        }
        .panel-splitter--horizontal {
          cursor: row-resize;
        }
        .panel-splitter-line {
          background: #4b5563;
          border-radius: 0;
        }
        .panel-splitter--vertical .panel-splitter-line {
          width: 1px;
          height: 100%;
        }
        .panel-splitter--horizontal .panel-splitter-line {
          width: 100%;
          height: 1px;
        }
        .source-viewer-terminal {
          min-height: 140px;
          overflow: hidden;
          height: 100%;
        }
        .audit-panel {
          border: 1px solid rgba(242, 240, 233, 0.35);
          border-radius: 2px;
          background: #0f0f0f;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow: hidden;
        }
        .audit-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #fef3c7;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .audit-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          overflow: auto;
          padding-right: 2px;
          overflow-x: hidden;
          scrollbar-width: none;
        }
        .audit-grid::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
        .audit-card {
          padding: 12px 2px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
          position: relative;
          border-bottom: 1px solid rgba(71, 85, 105, 0.4);
          transition: opacity 0.5s ease, filter 0.5s ease, border-color 0.5s ease;
        }
        .audit-card:last-child {
          border-bottom: none;
        }
        .audit-card.dimmed {
          opacity: 0.35;
          filter: saturate(0.6);
        }
        .audit-card.highlight {
          border-color: rgba(239, 125, 69, 0.6);
        }
        .audit-card-title {
          font-size: 10px;
          color: #fef3c7;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          display: flex;
          align-items: center;
          gap: 8px;
          padding-right: 40px;
        }
        .audit-card-actions {
          position: absolute;
          top: 8px;
          right: 0;
          display: flex;
          gap: 6px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
          backdrop-filter: blur(6px);
          background: rgba(13, 17, 23, 0.8);
          padding: 2px 6px;
          border-radius: 8px;
        }
        .audit-card:hover .audit-card-actions {
          opacity: 1;
          pointer-events: auto;
        }
        .audit-card-meta {
          font-size: 10px;
          color: #6b7280;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .audit-card-summary {
          font-size: 12px;
          color: #e2e8f0;
        }
        .audit-card-list {
          font-size: 11px;
          color: #cbd5f5;
          display: block;
          line-height: 1.5;
          word-break: break-word;
          white-space: normal;
        }
        .impact-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          display: inline-block;
          flex-shrink: 0;
        }
        .audit-add-button,
        .audit-dismiss-button {
          width: 18px;
          height: 18px;
          border-radius: 6px;
          border: 1px solid rgba(71, 85, 105, 0.6);
          background: rgba(15, 23, 42, 0.6);
          color: #fcd34d;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 12px;
          line-height: 1;
        }
        .audit-dismiss-button {
          color: #9aa4b2;
        }
        .audit-dismiss-button:hover {
          color: #f87171;
          border-color: rgba(248, 113, 113, 0.6);
        }
        .audit-add-button:hover {
          color: #ef7d45;
          border-color: rgba(239, 125, 69, 0.6);
        }
        .audit-line-link {
          background: transparent;
          border: 1px solid rgba(71, 85, 105, 0.4);
          color: #6b7280;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          cursor: pointer;
          padding: 2px 8px;
          border-radius: 999px;
        }
        .audit-line-link:hover {
          color: #f59e0b;
        }
        .audit-card-summary {
          cursor: pointer;
          word-break: break-word;
        }
        .audit-card-summary:hover {
          color: #f8fafc;
        }
        .audit-card-detail {
          font-size: 11px;
          color: #cbd5f5;
          word-break: break-word;
        }
        .audit-alternative {
          display: inline;
          margin-top: 4px;
          padding: 0;
          border: none;
          background: transparent;
          color: #f59e0b;
          font-size: 10px;
          cursor: pointer;
          text-decoration: underline;
        }
        .audit-alternative:hover {
          color: #fcd34d;
        }
        .audit-empty {
          font-size: 12px;
          color: #94a3b8;
          padding: 12px;
          border: 1px dashed rgba(71, 85, 105, 0.6);
          border-radius: 8px;
        }
        .audit-empty button {
          background: none;
          border: none;
          color: #f59e0b;
          font-size: 11px;
          cursor: pointer;
          padding: 0;
          text-decoration: underline;
        }
        .audit-dismissed-list {
          margin-top: 6px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .audit-dismissed-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: #cbd5f5;
        }
        .audit-dismissed-item button {
          background: transparent;
          border: 1px solid rgba(71, 85, 105, 0.5);
          color: #94a3b8;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 10px;
          cursor: pointer;
        }
        .source-viewer-editor {
          border: 1px solid rgba(242, 240, 233, 0.3);
          border-radius: 0;
          background: #1a1a1a;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }
        .source-viewer-error-banner {
          border: 1px solid rgba(248, 113, 113, 0.6);
          background: rgba(127, 29, 29, 0.35);
          color: #fecaca;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 12px;
          white-space: pre-wrap;
        }
        .source-viewer-editor .cm-editor {
          height: 100%;
          background-color: #1a1a1a !important;
          color: #e5e7eb !important;
        }
        .source-viewer-editor .cm-gutters {
          background-color: #1a1a1a !important;
          border-right: 1px solid rgba(242, 240, 233, 0.15) !important;
          color: #6b7280 !important;
        }
        .source-viewer-editor .cm-keyword {
          color: #ef7d45 !important;
          font-weight: 600;
        }
        .source-viewer-editor .cm-variableName,
        .source-viewer-editor .cm-propertyName {
          color: #e5e7eb !important;
        }
        .source-viewer-editor .cm-functionName {
          color: #fdba74 !important;
        }
        .source-viewer-editor .cm-string {
          color: #f3f4f6 !important;
        }
        .source-viewer-editor .cm-comment {
          color: #6b7280 !important;
          font-style: italic;
        }
        .source-viewer-editor .cm-number,
        .source-viewer-editor .cm-atom {
          color: #d4a373 !important;
        }
        .source-viewer-editor .cm-activeLine {
          background-color: rgba(239, 125, 69, 0.05) !important;
          box-shadow: inset 2px 0 0 #ef7d45;
        }
        .source-viewer-editor .cm-scroller {
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
        }
        .source-viewer-editor .cm-content {
          line-height: 1.6;
        }
        .source-viewer-editor .cm-lineNumbers .cm-gutterElement {
          color: #6b7280 !important;
        }
        .source-viewer-editor .cm-selectionBackground {
          background: rgba(239, 125, 69, 0.2);
        }
        .source-viewer-loading {
          padding: 16px;
          color: #94a3b8;
          font-size: 12px;
        }
        .source-viewer-error {
          padding: 16px;
          color: #fca5a5;
          font-size: 12px;
        }
        @media (max-width: 900px) {
          .source-viewer-card {
            width: 96%;
          }
        }
      </style>
      <div class="source-viewer-card" role="dialog" aria-live="polite">
        <${EditorHeader}
          showApprove=${showApprove}
          auditIndicator=${auditIndicator}
          auditStatus=${auditStatus}
          hasAuditPayload=${hasAuditPayload}
          showAuditPanel=${showAuditPanel}
          onToggleAuditPanel=${() => setShowAuditPanel(!showAuditPanel)}
          onRunAudit=${() => {
            setShowAuditPanel(true);
            onAudit("fast");
          }}
          onApprove=${onApprove}
          onClose=${handleCloseRequest}
        />
        <div class="source-viewer-body">
          ${lastRuntimeError && html`
            <div class="source-debug-banner">
              Last runtime error:
              ${"\n"}${lastRuntimeError}
            </div>
          `}
          ${errorMessage && html`
            <div class="source-viewer-error-banner">
              ${errorMessage}
            </div>
          `}
          ${auditError && html`
            <div class="source-viewer-error-banner">
              Audit failed: ${auditError}
            </div>
          `}
          ${auditApplyError && html`
            <div class="source-viewer-error-banner">
              Apply failed: ${auditApplyError}
            </div>
          `}
          <div
            class="source-viewer-workspace"
            ref=${workspaceRef}
            style=${{ gridTemplateRows: workspaceRows }}
          >
            <div
              class=${`source-viewer-main ${panelOrientation === "vertical" ? "source-viewer-main--stacked" : ""}`}
              ref=${mainAreaRef}
              style=${mainGridStyle}
            >
              <${CodeEditor} ref=${editorRef} value=${draftCode} onChange=${setDraftCode} />
              ${showAuditPanel && html`
                <div
                  class=${`panel-splitter ${panelOrientation === "horizontal" ? "panel-splitter--vertical" : "panel-splitter--horizontal"}`}
                  onMouseDown=${startPanelResize}
                  onTouchStart=${startPanelResize}
                  onDoubleClick=${togglePanelOrientation}
                  title="Drag to resize code and audit panels. Double-click to flip orientation."
                >
                  <span class="panel-splitter-line"></span>
                </div>
                <${AuditPanel}
                  hasAuditPayload=${hasAuditPayload}
                  visibleConcerns=${visibleConcerns}
                  dismissedConcerns=${dismissedConcerns}
                  showDismissed=${showDismissed}
                  onToggleDismissed=${() => setShowDismissed(!showDismissed)}
                  onRestoreDismissed=${restoreDismissed}
                  expandedCards=${expandedCards}
                  technicalCards=${technicalCards}
                  hoveredCardId=${hoveredCardId}
                  onHoverCard=${setHoveredCardId}
                  onToggleExpanded=${toggleExpanded}
                  onToggleTechnical=${toggleTechnical}
                  onAddPendingChange=${addPendingChange}
                  onDismissConcern=${dismissConcern}
                  onScrollToLines=${scrollToLines}
                  onRunAudit=${() => {
                    setShowAuditPanel(true);
                    onAudit("fast");
                  }}
                />
              `}
            </div>
            <div
              class="workspace-splitter"
              onMouseDown=${startWorkspaceResize}
              onTouchStart=${startWorkspaceResize}
              title="Drag to resize the console"
            >
              <span class="workspace-splitter-line"></span>
            </div>
            <div class="source-viewer-terminal">
              <${TerminalViewer}
                logs=${displayLogs}
                status=${status || "ready"}
                heading=${null}
                promptValue=${terminalPrompt}
                onPromptChange=${setTerminalPrompt}
                onPromptSubmit=${handleTerminalSubmit}
                promptDisabled=${!canPrompt}
                attachments=${{
                  pendingChanges,
                  codeChangeRanges,
                  isDirty: isDirtyRef.current,
                  editingBubbleId,
                  editingText,
                  onStartEdit: startEditingBubble,
                  onEditingTextChange: setEditingText,
                  onSaveEdit: saveBubbleEdit,
                  onRemovePending: removePendingChange,
                  onHoverCard: setHoveredCardId,
                  bubbleEditorRef
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
