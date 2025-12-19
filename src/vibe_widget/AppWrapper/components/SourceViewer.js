import * as React from "https://esm.sh/react@18";
import htm from "https://esm.sh/htm@3";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const html = htm.bind(React.createElement);

// Synthesized Theme: Warm, tactile, mechanical keyboard aesthetic
const synthesizedTheme = EditorView.theme({
  "&": {
    backgroundColor: "#161618",
    color: "#E5E7EB",
    fontSize: "12px",
    fontFamily: "JetBrains Mono, Space Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  ".cm-content": {
    caretColor: "#EF7D45",
    lineHeight: "1.6",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#EF7D45",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "#EF7D45",
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(239, 125, 69, 0.2)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "rgba(239, 125, 69, 0.15)",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(239, 125, 69, 0.03)",
    boxShadow: "inset 2px 0 0 #EF7D45",
  },
  ".cm-gutters": {
    backgroundColor: "#161618",
    color: "#6B7280",
    border: "none",
    borderRight: "1px solid #2d3139",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(239, 125, 69, 0.08)",
    color: "#EF7D45",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    color: "#6B7280",
    minWidth: "3ch",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "rgba(239, 125, 69, 0.1)",
    border: "1px solid rgba(239, 125, 69, 0.3)",
    color: "#FDBA74",
  },
  ".cm-tooltip": {
    backgroundColor: "#0f141a",
    border: "1px solid rgba(71, 85, 105, 0.6)",
    borderRadius: "6px",
  },
  ".cm-tooltip.cm-tooltip-autocomplete": {
    "& > ul > li[aria-selected]": {
      backgroundColor: "rgba(239, 125, 69, 0.2)",
      color: "#EF7D45",
    },
  },
}, { dark: true });

// Syntax highlighting with warm, tactile colors
const synthesizedHighlighting = HighlightStyle.define([
  // Structural keywords: Desaturated orange
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword], color: "#E89560", fontWeight: "600" },

  // Library namespaces (React, d3, model): Warm Amber - THE "power players"
  { tag: [t.namespace], color: "#FDBA74", fontWeight: "500" },

  // Function names: Sunlight Gold
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#FDBA74", fontWeight: "500" },

  // Class names: Warm amber
  { tag: [t.className, t.typeName, t.definition(t.typeName)], color: "#FCD34D" },

  // Strings: Sage Green
  { tag: [t.string, t.special(t.string)], color: "#A3B18A" },

  // Numbers: Brighter warm clay
  { tag: [t.number, t.bool, t.null, t.atom], color: "#E5B887", fontWeight: "500" },

  // Comments: Muted Clay (italic)
  { tag: t.comment, color: "#6B7280", fontStyle: "italic" },

  // Operators: Subtle warm gray
  { tag: [t.operator, t.punctuation], color: "#9CA3AF" },

  // Object properties (.current, .top, .bottom): Off-white
  { tag: [t.propertyName], color: "#D1D5DB" },

  // Variables: Bright enough to pop
  { tag: [t.variableName], color: "#E5E7EB" },

  // Variables being DEFINED: Vibe Orange
  { tag: [t.definition(t.variableName)], color: "#EF7D45", fontWeight: "500" },

  // Tags (JSX): Warm orange
  { tag: [t.tagName, t.angleBracket], color: "#FB923C" },

  // Attributes: Muted amber
  { tag: t.attributeName, color: "#FCD34D" },

  // Invalid/errors: Warm red
  { tag: t.invalid, color: "#F87171", textDecoration: "underline wavy" },

  // Meta/preprocessor: Muted orange
  { tag: t.meta, color: "#FB923C" },
]);


export default function SourceViewer({
  code,
  errorMessage,
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
  onClose
}) {
  const containerRef = React.useRef(null);
  const viewRef = React.useRef(null);
  const [draftCode, setDraftCode] = React.useState(code || "");
  const [isLoading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const isDirtyRef = React.useRef(false);
  const autoScrollRef = React.useRef(false);
  const [showAuditPanel, setShowAuditPanel] = React.useState(false);
  const [pendingChanges, setPendingChanges] = React.useState([]);
  const [dismissedConcerns, setDismissedConcerns] = React.useState({});
  const [showDismissed, setShowDismissed] = React.useState(false);
  const [hoveredCardId, setHoveredCardId] = React.useState(null);
  const [editingBubbleId, setEditingBubbleId] = React.useState(null);
  const [editingText, setEditingText] = React.useState("");
  const [manualNote, setManualNote] = React.useState("");
  const [codeChangeRanges, setCodeChangeRanges] = React.useState([]);
  const [lastClearSnapshot, setLastClearSnapshot] = React.useState(null);
  const bubbleEditorRef = React.useRef(null);
  const manualNoteRef = React.useRef(null);

  React.useEffect(() => {
    isDirtyRef.current = draftCode !== (code || "");
  }, [draftCode, code]);

  React.useEffect(() => {
    if (!isDirtyRef.current) {
      setDraftCode(code || "");
    }
  }, [code]);

  React.useEffect(() => {
    const handleWindowKeyDown = (event) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target)) {
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };
    const canScrollEditor = (deltaY) => {
      if (!viewRef.current) return false;
      const scroller = viewRef.current.scrollDOM;
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      if (maxScroll <= 0) return false;
      if (deltaY < 0) return scroller.scrollTop > 0;
      if (deltaY > 0) return scroller.scrollTop < maxScroll;
      return false;
    };
    const handleWheel = (event) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target)) {
        if (!canScrollEditor(event.deltaY)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
      }
    };
    const handleTouchMove = (event) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", handleWindowKeyDown, true);
    window.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    window.addEventListener("touchmove", handleTouchMove, { capture: true, passive: false });
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown, true);
      window.removeEventListener("wheel", handleWheel, true);
      window.removeEventListener("touchmove", handleTouchMove, true);
    };
  }, []);

  React.useEffect(() => {
    if (!containerRef.current) return;
    if (viewRef.current) return;
    try {
      setLoading(true);
      const extensions = [
        basicSetup,
        javascript({ jsx: true, typescript: false }),
        synthesizedTheme,
        syntaxHighlighting(synthesizedHighlighting),
        EditorView.lineWrapping,
        EditorView.domEventHandlers({
          keydown: (event) => {
            event.stopPropagation();
          }
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setDraftCode(update.state.doc.toString());
          }
        }),
        EditorView.editable.of(true)
      ];
      const startState = EditorState.create({
        doc: draftCode || "",
        extensions
      });
      viewRef.current = new EditorView({
        state: startState,
        parent: containerRef.current
      });
      setLoading(false);
    } catch (err) {
      console.error("Failed to load CodeMirror:", err);
      setLoadError("Failed to load editor.");
      setLoading(false);
    }
    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (!auditReport && !auditData) return;
    setShowAuditPanel(true);
  }, [auditReport, auditData]);

  React.useEffect(() => {
    if (!viewRef.current) return;
    if (typeof viewRef.current.hasFocus === "function" && viewRef.current.hasFocus()) return;
    const current = viewRef.current.state.doc.toString();
    if (current === (code || "")) return;
    viewRef.current.dispatch({
      changes: { from: 0, to: current.length, insert: code || "" }
    });
    autoScrollRef.current = false;
  }, [code]);

  const scrollToDefaultExport = () => {
    if (!viewRef.current || !draftCode || autoScrollRef.current) return;
    const match = draftCode.match(/\bexport\s+default\b/);
    if (!match) return;
    const pos = match.index ?? 0;
    viewRef.current.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: "center" })
    });
    autoScrollRef.current = true;
  };

  React.useEffect(() => {
    if (!viewRef.current || isDirtyRef.current) return;
    const timeout = setTimeout(scrollToDefaultExport, 0);
    return () => clearTimeout(timeout);
  }, [draftCode]);

  const handleApply = () => {
    onApply(draftCode);
  };

  const isDirty = draftCode !== (code || "");
  const isAuditing = auditStatus === "running";
  const hasAuditReport = auditReport && auditReport.length > 0;
  const auditPayload = auditData?.fast_audit || auditData?.full_audit || null;
  const concerns = auditPayload?.concerns || [];
  const [expandedCards, setExpandedCards] = React.useState({});
  const [technicalCards, setTechnicalCards] = React.useState({});
  const auditSavedPath = auditMeta?.saved_path || "";
  const auditIndicator = auditSavedPath
    ? `Saved to ${auditSavedPath}`
    : hasAuditReport
      ? "Audit saved"
      : "";
  const getCardId = (concern, index) => {
    const base = concern?.id || `concern-${index}`;
    const location = Array.isArray(concern?.location) ? concern.location.join("-") : "global";
    return `${base}-${location}-${index}`;
  };

  const hasAuditPayload = !!auditPayload;
  const pendingCount = pendingChanges.length;
  const applyTooltip = [
    pendingCount > 0 ? `${pendingCount} audit${pendingCount === 1 ? "" : "s"}` : null,
    isDirty ? "source code changes" : null,
    manualNote.trim().length > 0 ? "note" : null
  ].filter(Boolean).join(" and ") || "No pending changes";

  const visibleConcerns = concerns
    .map((concern, index) => ({
      concern,
      cardId: getCardId(concern, index),
      index
    }))
    .filter((item) => !dismissedConcerns[item.cardId]);

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

  React.useEffect(() => {
    if (auditApplyResponse?.success) {
      setPendingChanges([]);
      setManualNote("");
    }
  }, [auditApplyResponse]);

  const autoResizeManualNote = () => {
    const el = manualNoteRef.current;
    if (!el) return;
    const maxHeight = 72;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  React.useEffect(() => {
    autoResizeManualNote();
  }, [manualNote]);

  const computeChangedRanges = (nextCode, prevCode) => {
    const nextLines = (nextCode || "").split("\n");
    const prevLines = (prevCode || "").split("\n");
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

  const scrollToLines = (lines) => {
    if (!viewRef.current) return;
    if (!lines || lines.length === 0) return;
    const doc = viewRef.current.state.doc;
    const maxLine = doc.lines;
    const valid = lines
      .map((line) => parseInt(line, 10))
      .filter((line) => Number.isFinite(line) && line > 0 && line <= maxLine);
    if (valid.length === 0) return;
    const startLine = Math.min(...valid);
    const endLine = Math.max(...valid);
    const start = doc.line(startLine).from;
    const end = doc.line(endLine).to;
    viewRef.current.dispatch({
      selection: { anchor: start, head: end },
      effects: EditorView.scrollIntoView(start, { y: "center" })
    });
  };

  const setEditorValue = (nextCode) => {
    setDraftCode(nextCode);
    if (!viewRef.current) return;
    const current = viewRef.current.state.doc.toString();
    if (current === nextCode) return;
    viewRef.current.dispatch({
      changes: { from: 0, to: current.length, insert: nextCode }
    });
  };

  const handleClearStaging = () => {
    setLastClearSnapshot({
      pendingChanges,
      manualNote,
      draftCode
    });
    setPendingChanges([]);
    setManualNote("");
    setEditorValue(code || "");
  };

  React.useEffect(() => {
    const handleUndo = (event) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      if (viewRef.current?.hasFocus && viewRef.current.hasFocus()) return;
      if (!lastClearSnapshot) return;
      event.preventDefault();
      setPendingChanges(lastClearSnapshot.pendingChanges || []);
      setManualNote(lastClearSnapshot.manualNote || "");
      setEditorValue(lastClearSnapshot.draftCode || "");
      setLastClearSnapshot(null);
    };
    document.addEventListener("keydown", handleUndo, true);
    return () => document.removeEventListener("keydown", handleUndo, true);
  }, [lastClearSnapshot]);

  const handleCloseRequest = () => {
    const hasPending = pendingCount > 0 || manualNote.trim().length > 0;
    if (hasPending) {
      onApply({
        type: "audit_apply",
        baseCode: draftCode,
        changes: [
          ...pendingChanges,
          ...(manualNote.trim().length > 0
            ? [{
                itemId: `manual-${Date.now()}`,
                cardId: "manual",
                label: manualNote.trim(),
                summary: manualNote.trim(),
                user_note: manualNote.trim(),
                location: "global"
              }]
            : [])
        ]
      });
    } else if (isDirty) {
      handleApply();
    }
    onClose();
  };

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
          background: rgba(6, 8, 15, 0.82);
          backdrop-filter: blur(4px);
        }
        .source-viewer-card {
          width: min(1020px, 96%);
          height: 96%;
          background: #0d1117;
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 10px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
          display: flex;
          flex-direction: column;
        }
        .source-viewer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(71, 85, 105, 0.45);
          color: #e2e8f0;
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
          background: rgba(17, 24, 39, 0.6);
          color: #cbd5f5;
          border: 1px solid rgba(71, 85, 105, 0.55);
          border-radius: 8px;
          padding: 5px 10px;
          font-size: 11px;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .source-viewer-button.primary {
          background: #ef7d45;
          color: #0b0b0b;
          border-color: transparent;
          font-weight: 600;
        }
        .source-viewer-button.subtle {
          background: transparent;
          border-color: rgba(71, 85, 105, 0.4);
          color: #94a3b8;
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
        .source-viewer-main {
          flex: 1;
          display: grid;
          grid-template-columns: ${showAuditPanel ? "minmax(0, 1fr) 320px" : "minmax(0, 1fr)"};
          gap: 12px;
          overflow: hidden;
        }
        .audit-panel {
          border: 1px solid rgba(71, 85, 105, 0.45);
          border-radius: 10px;
          background: #121820;
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
        .audit-add-button {
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
          width: 18px;
          height: 18px;
          border-radius: 6px;
          border: 1px solid rgba(71, 85, 105, 0.6);
          background: rgba(15, 23, 42, 0.6);
          color: #9aa4b2;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 12px;
          line-height: 1;
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
        .audit-changes-strip {
          border: 1px dashed rgba(71, 85, 105, 0.6);
          border-radius: 10px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: rgba(13, 17, 23, 0.6);
          position: relative;
        }
        .audit-changes-strip.compact {
          padding: 6px 10px;
          gap: 6px;
        }
        .audit-changes-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .audit-changes-items {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: none;
        }
        .audit-changes-items::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
        .audit-changes-input {
          flex: 1;
          min-width: 0;
          background: #12141d;
          color: #e5e7eb;
          border: none;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 12px;
          min-height: 32px;
          max-height: 72px;
          resize: none;
          line-height: 1.4;
          outline: none;
          scrollbar-width: none;
        }
        .audit-changes-input::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
        .audit-changes-input:focus,
        .audit-changes-input:focus-visible {
          outline: none;
          box-shadow: none;
        }
        .audit-send-button {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          border: none;
          background: #ef7d45;
          color: #fff;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          position: absolute;
          right: 10px;
          bottom: 10px;
        }
        .audit-send-button:focus,
        .audit-send-button:focus-visible {
          outline: none;
          box-shadow: none;
        }
        .audit-send-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .audit-change-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(17, 24, 39, 0.8);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 8px;
          padding: 6px 10px;
          color: #e5e7eb;
          font-size: 11px;
          max-width: 220px;
          position: relative;
          cursor: pointer;
          white-space: nowrap;
        }
        .audit-change-pill span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .audit-change-remove {
          border: none;
          background: transparent;
          color: #9aa4b2;
          cursor: pointer;
          font-size: 12px;
          line-height: 1;
        }
        .audit-change-remove:hover {
          color: #f87171;
        }
        .audit-bubble-editor {
          position: absolute;
          bottom: 130%;
          left: 0;
          width: 240px;
          background: #0f141a;
          border: 1px solid rgba(71, 85, 105, 0.6);
          border-radius: 10px;
          padding: 8px;
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
          z-index: 10;
        }
        .audit-bubble-editor textarea {
          width: 100%;
          min-height: 80px;
          background: #12141d;
          color: #e5e7eb;
          border: 1px solid rgba(71, 85, 105, 0.6);
          border-radius: 8px;
          padding: 6px;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 11px;
          resize: vertical;
        }
        .audit-bubble-editor-actions {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
          margin-top: 6px;
        }
        .audit-bubble-editor button {
          background: rgba(239, 125, 69, 0.9);
          color: #0b0b0b;
          border: none;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 10px;
          cursor: pointer;
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
          border: 1px solid rgba(71, 85, 105, 0.45);
          border-radius: 10px;
          background: #0f141a;
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
        <div class="source-viewer-header">
          <span>Widget Source</span>
          <div class="source-viewer-actions">
            ${auditIndicator && html`<span class="audit-indicator">${auditIndicator}</span>`}
            ${!hasAuditPayload && html`
              <button class="source-viewer-button" disabled=${isAuditing} onClick=${() => {
                setShowAuditPanel(true);
                onAudit("fast");
              }}>
                ${isAuditing ? "Auditing..." : "Audit"}
              </button>
            `}
            ${hasAuditPayload && html`
              <button class="source-viewer-button subtle" onClick=${() => setShowAuditPanel(!showAuditPanel)}>
                ${showAuditPanel ? "Hide Audit" : "Show Audit"}
              </button>
            `}
            <button class="source-viewer-button" onClick=${handleCloseRequest}>Close</button>
          </div>
        </div>
        <div class="source-viewer-body">
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
          <div class="source-viewer-main">
            <div class="source-viewer-editor">
              ${isLoading && html`<div class="source-viewer-loading">Loading editor...</div>`}
              ${loadError && html`<div class="source-viewer-error">${loadError}</div>`}
              <div ref=${containerRef} style=${{ height: "100%" }}></div>
            </div>
            ${showAuditPanel && html`
              <div class="audit-panel">
                <div class="audit-panel-header">
                  <span>Audit Overview</span>
                  <span>${visibleConcerns.length} concerns</span>
                </div>
                ${visibleConcerns.length > 0 ? html`
                  <div class="audit-grid">
                    ${visibleConcerns.map(({ concern, cardId, index }) => {
                      const isExpanded = !!expandedCards[cardId];
                      const showTechnical = !!technicalCards[cardId];
                      const impact = (concern.impact || "low").toLowerCase();
                      const impactColor = impact === "high"
                        ? "#f87171"
                        : impact === "medium"
                          ? "#f59e0b"
                          : "#34d399";
                      const location = Array.isArray(concern.location) ? concern.location : [];
                      const lineLabel = location.length > 0
                        ? `LINES ${Math.min(...location)}-${Math.max(...location)}`
                        : "GLOBAL";
                      const plainSummary = concern.summary || "";
                      const technicalSummary = concern.technical_summary || "";
                      const detailText = concern.details || "";
                      const canToggleTechnical = technicalSummary && technicalSummary !== plainSummary;
                      const descriptionText = showTechnical && canToggleTechnical ? technicalSummary : plainSummary;
                      const isDimmed = hoveredCardId && hoveredCardId !== cardId;
                      const isHighlighted = hoveredCardId === cardId;
                      return html`
                        <div class="audit-card ${isDimmed ? "dimmed" : ""} ${isHighlighted ? "highlight" : ""}" onClick=${() => toggleExpanded(cardId)}>
                          <div class="audit-card-title" title=${`Impact: ${impact}`}>
                            <span class="impact-dot" style=${{ background: impactColor }}></span>
                            <span>${concern.id || "concern"}</span>
                          </div>
                          <div class="audit-card-actions">
                            <button
                              class="audit-add-button"
                              title="Add to Changes"
                              onClick=${(event) => {
                                event.stopPropagation();
                                addPendingChange(concern, cardId, { itemId: `${cardId}-base` });
                              }}
                            >
                              +
                            </button>
                            <button
                              class="audit-dismiss-button"
                              title="Dismiss"
                              onClick=${(event) => {
                                event.stopPropagation();
                                dismissConcern(cardId, concern.id || "concern");
                              }}
                            >
                              ×
                            </button>
                          </div>
                          <div class="audit-card-meta">
                            <button
                              class="audit-line-link"
                              onClick=${(event) => {
                                event.stopPropagation();
                                if (location.length > 0) {
                                  scrollToLines(location);
                                }
                              }}
                            >
                              ${lineLabel}
                            </button>
                          </div>
                          <div
                            class="audit-card-summary"
                            onClick=${(event) => {
                              if (!canToggleTechnical) return;
                              event.stopPropagation();
                              toggleTechnical(cardId);
                            }}
                            title=${canToggleTechnical ? "Click to toggle technical note" : ""}
                          >
                            ${descriptionText}
                          </div>
                          ${isExpanded && detailText && html`
                            <div class="audit-card-detail">${detailText}</div>
                          `}
                          ${isExpanded && concern.alternatives && concern.alternatives.length > 0 && html`
                            <div class="audit-card-list">
                              Recommendations: ${Array.isArray(concern.alternatives) ? concern.alternatives.map((alt, altIndex) => {
                                const altText = alt.option || alt;
                                const isLast = altIndex === concern.alternatives.length - 1;
                                return html`
                                  <button
                                    class="audit-alternative"
                                    onClick=${(event) => {
                                      event.stopPropagation();
                                      addPendingChange(concern, cardId, {
                                        itemId: `${cardId}-alt-${altIndex}`,
                                        label: `Recommendation: ${altText}`,
                                        alternative: altText
                                      });
                                    }}
                                  >
                                    ${altText}
                                  </button>${!isLast ? ", " : ""}
                                `;
                              }) : ""}
                            </div>
                          `}
                        </div>
                      `;
                    })}
                  </div>
                ` : html`
                  <div class="audit-empty">
                    All audits resolved.
                    ${Object.keys(dismissedConcerns).length > 0 && html`
                      <div>
                        <button onClick=${() => setShowDismissed(!showDismissed)}>
                          ${showDismissed ? "Hide dismissed" : "Show dismissed"}
                        </button>
                      </div>
                      ${showDismissed && html`
                        <div class="audit-dismissed-list">
                          ${Object.entries(dismissedConcerns).map(([cardId, label]) => html`
                            <div class="audit-dismissed-item">
                              <span>${label}</span>
                              <button onClick=${() => setDismissedConcerns((prev) => {
                                const next = { ...prev };
                                delete next[cardId];
                                return next;
                              })}>
                                Restore
                              </button>
                            </div>
                          `)}
                        </div>
                      `}
                    `}
                  </div>
                `}
              </div>
            `}
          </div>
          ${(pendingCount > 0 || isDirty || manualNote.trim().length > 0 || codeChangeRanges.length > 0) && html`
            <div class="audit-changes-strip ${pendingCount === 0 ? "compact" : ""}">
                    <div class="audit-changes-row">
                      <div class="audit-changes-items">
                        ${pendingChanges.map((item) => {
                          const isEditing = editingBubbleId === item.itemId;
                          return html`
                            <div
                              class="audit-change-pill"
                              onMouseEnter=${() => setHoveredCardId(item.cardId)}
                              onMouseLeave=${() => setHoveredCardId(null)}
                              onClick=${() => startEditingBubble(item)}
                            >
                              <span title=${item.label}>${item.label}</span>
                              <button
                                class="audit-change-remove"
                                title="Remove"
                                onClick=${(event) => {
                                  event.stopPropagation();
                                  removePendingChange(item.itemId);
                                }}
                              >
                                ×
                              </button>
                              ${isEditing && html`
                                <div class="audit-bubble-editor" ref=${bubbleEditorRef}>
                                  <textarea
                                    value=${editingText}
                                    onInput=${(event) => setEditingText(event.target.value)}
                                    placeholder="Edit what will be sent..."
                                  ></textarea>
                                  <div class="audit-bubble-editor-actions">
                                    <button onClick=${(event) => {
                                      event.stopPropagation();
                                      saveBubbleEdit();
                                    }}>
                                      Save
                                    </button>
                                  </div>
                                </div>
                              `}
                            </div>
                          `;
                        })}
                        ${codeChangeRanges.length >= 3 ? html`
                          <div
                            class="audit-change-pill"
                            title=${`Changed: ${codeChangeRanges.map((range) => range[0] === range[1] ? `Line ${range[0]}` : `Lines ${range[0]}-${range[1]}`).join(", ")}`}
                          >
                            <span>Code changes (${codeChangeRanges.length})</span>
                          </div>
                        ` : codeChangeRanges.map((range) => {
                          const label = range[0] === range[1]
                            ? `Line ${range[0]}`
                            : `Lines ${range[0]}-${range[1]}`;
                          return html`
                            <div class="audit-change-pill" title="Source code edits">
                              <span>${label}</span>
                            </div>
                          `;
                        })}
                      </div>
                    </div>
                    <div class="audit-changes-row">
                      <textarea
                        ref=${manualNoteRef}
                        class="audit-changes-input"
                        placeholder="Add a note for the changes..."
                        value=${manualNote}
                        onInput=${(event) => {
                          setManualNote(event.target.value);
                          autoResizeManualNote();
                        }}
                        onKeyDown=${(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            const hasPending = pendingCount > 0 || manualNote.trim().length > 0;
                            if (hasPending) {
                              onApply({
                                type: "audit_apply",
                                baseCode: draftCode,
                                changes: [
                                  ...pendingChanges,
                                  ...(manualNote.trim().length > 0
                                    ? [{
                                        itemId: `manual-${Date.now()}`,
                                        cardId: "manual",
                                        label: manualNote.trim(),
                                        summary: manualNote.trim(),
                                        user_note: manualNote.trim(),
                                        location: "global"
                                      }]
                                    : [])
                                ]
                              });
                            } else if (isDirty) {
                              handleApply();
                            }
                          }
                        }}
                      ></textarea>
                    </div>
                    <button
                      class="audit-send-button"
                      title=${applyTooltip}
                      disabled=${pendingCount === 0 && !isDirty && manualNote.trim().length === 0}
                      onClick=${() => {
                        const hasPending = pendingCount > 0 || manualNote.trim().length > 0;
                        if (hasPending) {
                          onApply({
                            type: "audit_apply",
                            baseCode: draftCode,
                            changes: [
                              ...pendingChanges,
                              ...(manualNote.trim().length > 0
                                ? [{
                                    itemId: `manual-${Date.now()}`,
                                    cardId: "manual",
                                    label: manualNote.trim(),
                                    summary: manualNote.trim(),
                                    user_note: manualNote.trim(),
                                    location: "global"
                                  }]
                                : [])
                            ]
                          });
                        } else if (isDirty) {
                          handleApply();
                        }
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M6 14L12 8L18 14" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </button>
                  </div>
                `}
        </div>
      </div>
    </div>
  `;
}
