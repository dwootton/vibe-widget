import * as React from "react";
import { createRoot } from "react-dom/client";
import htm from "htm";

import { ensureGlobalStyles } from "./utils/styles";
import SandboxedRunner from "./components/SandboxedRunner";
import FloatingMenu from "./components/FloatingMenu";
import LoadingOverlay from "./components/LoadingOverlay";
import SelectionOverlay from "./components/SelectionOverlay";
import EditPromptPanel from "./components/EditPromptPanel";
import AuditNotice from "./components/AuditNotice";
import EditorViewer from "./components/editor/EditorViewer";
import useModelSync from "./hooks/useModelSync";
import useKeyboardShortcuts from "./hooks/useKeyboardShortcuts";

const html = htm.bind(React.createElement);

ensureGlobalStyles();

const AUDIT_ACK_KEY = "vibe_widget_audit_ack";
const AUDIT_AUTORUN_KEY = "vibe_widget_audit_autorun";

function AppWrapper({ model }) {
  const {
    status,
    logs,
    code,
    errorMessage,
    retryCount,
    auditStatus,
    auditResponse,
    auditError,
    auditApplyStatus,
    auditApplyResponse,
    auditApplyError,
    executionMode,
    executionApproved
  } = useModelSync(model);
  const [isMenuOpen, setMenuOpen] = React.useState(false);
  const [grabMode, setGrabMode] = React.useState(null);
  const [promptCache, setPromptCache] = React.useState({});
  const [showSource, setShowSource] = React.useState(false);
  const [sourceError, setSourceError] = React.useState("");
  const [renderCode, setRenderCode] = React.useState(code || "");
  const [lastGoodCode, setLastGoodCode] = React.useState(code || "");
  const [applyState, setApplyState] = React.useState({
    pending: false,
    previousCode: "",
    nextCode: ""
  });
  const containerRef = React.useRef(null);
  const [minHeight, setMinHeight] = React.useState(0);
  const [hasAuditAck, setHasAuditAck] = React.useState(() => {
    try {
      return sessionStorage.getItem(AUDIT_ACK_KEY) === "true";
    } catch (err) {
      return false;
    }
  });
  const [showAudit, setShowAudit] = React.useState(false);
  const [hasAutoRunAudit, setHasAutoRunAudit] = React.useState(() => {
    try {
      return sessionStorage.getItem(AUDIT_AUTORUN_KEY) === "true";
    } catch (err) {
      return false;
    }
  });

  const handleGrabStart = () => {
    setMenuOpen(false);
    setGrabMode("selecting");
  };

  const handleViewSource = () => {
    setMenuOpen(false);
    setShowSource(true);
  };

  const handleElementSelect = (elementDescription, elementBounds) => {
    const elementKey = `${elementDescription.tag}-${elementDescription.classes}-${elementDescription.text?.slice(0, 20)}`;
    setGrabMode({ element: elementDescription, bounds: elementBounds, elementKey });
  };

  const handleEditSubmit = (prompt) => {
    model.set("grab_edit_request", {
      element: grabMode.element,
      prompt: prompt,
    });
    model.save_changes();
    setPromptCache((prev) => ({ ...prev, [grabMode.elementKey]: prompt }));
    setGrabMode(null);
  };

  const handleCancel = (currentPrompt) => {
    if (grabMode?.elementKey && currentPrompt) {
      setPromptCache((prev) => ({ ...prev, [grabMode.elementKey]: currentPrompt }));
    }
    setGrabMode(null);
  };

  const isRetrying = Boolean(errorMessage) && (retryCount || 0) < 2;
  const isLoading = status === "generating" || isRetrying;
  const hasCode = renderCode && renderCode.length > 0;
  const approvalMode = executionMode === "approve";
  const isApproved = executionApproved || !approvalMode;
  const shouldRenderWidget = hasCode && isApproved;

  useKeyboardShortcuts({ isLoading, hasCode, grabMode, onGrabStart: handleGrabStart });
  React.useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = Math.round(entry.contentRect.height || 0);
        if (height > 50) {
          setMinHeight(height);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  React.useEffect(() => {
    setMinHeight(0);
  }, [renderCode]);
  React.useEffect(() => {
    if (approvalMode) {
      setShowAudit(false);
      return;
    }
    if (!hasAuditAck && !isLoading && hasCode) {
      setShowAudit(true);
    }
  }, [approvalMode, hasAuditAck, isLoading, hasCode]);

  React.useEffect(() => {
    if (hasAutoRunAudit) return;
    if (!approvalMode) return;
    if (status !== "ready") return;
    if (!code) return;
    if (auditStatus === "running") return;
    handleAuditRequest("fast");
    try {
      sessionStorage.setItem(AUDIT_AUTORUN_KEY, "true");
    } catch (err) {
      // Ignore storage failures and only track in memory.
    }
    setHasAutoRunAudit(true);
  }, [approvalMode, hasAutoRunAudit, status, code, auditStatus]);

  React.useEffect(() => {
    if (!applyState.pending) return;
    if (errorMessage) {
      setApplyState({ pending: false, previousCode: "", nextCode: "" });
      setSourceError(errorMessage);
      setShowSource(false);
      return;
    }
    if (code === applyState.nextCode && status === "ready") {
      setApplyState({ pending: false, previousCode: "", nextCode: "" });
      setRenderCode(code);
      setLastGoodCode(code);
      setSourceError("");
    }
  }, [applyState, code, errorMessage, model]);

  React.useEffect(() => {
    if (!sourceError || status === "generating" || showSource) return;
    if (renderCode !== code) {
      setShowSource(true);
    }
  }, [sourceError, status, showSource, renderCode, code]);

  React.useEffect(() => {
    if (!approvalMode) {
      return;
    }
    if (executionApproved) {
      setShowSource(false);
      return;
    }
    if (status === "ready" && hasCode) {
      setShowSource(true);
    }
  }, [approvalMode, executionApproved, status, hasCode]);

  React.useEffect(() => {
    if (applyState.pending) return;
    if (status !== "ready") return;
    if (!code) return;
    setRenderCode(code);
    setLastGoodCode(code);
  }, [applyState.pending, status, code]);

  React.useEffect(() => {
    if (!renderCode && lastGoodCode) {
      setRenderCode(lastGoodCode);
    }
  }, [renderCode, lastGoodCode]);

  const handleApplySource = (payload) => {
    if (payload && payload.type === "audit_apply") {
      model.set("audit_apply_request", {
        changes: payload.changes || [],
        base_code: payload.baseCode || ""
      });
      model.save_changes();
      setShowSource(false);
      return;
    }
    const nextCode = payload;
    setApplyState({
      pending: true,
      previousCode: code,
      nextCode
    });
    setShowSource(false);
    model.set("error_message", "");
    model.set("code", nextCode);
    model.save_changes();
  };

  const handleAuditRequest = (level) => {
    model.set("audit_request", {
      level: level || "fast",
      request_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`
    });
    model.save_changes();
  };

  const handleApproveRun = () => {
    model.set("execution_approved", true);
    model.save_changes();
    setShowSource(false);
    setShowAudit(false);
  };

  const auditReport = auditResponse?.report_yaml || "";
  const auditMeta = auditResponse && !auditResponse.error ? auditResponse : null;
  const auditData = auditResponse?.report || null;
  const auditConcerns = auditData?.fast_audit?.concerns || [];
  const highAuditCount = auditConcerns.filter((concern) => concern?.impact === "high").length;

  const handleAuditAccept = () => {
    try {
      sessionStorage.setItem(AUDIT_ACK_KEY, "true");
    } catch (err) {
      // Allow dismissal without persistence if session storage is blocked.
    }
    setHasAuditAck(true);
    setShowAudit(false);
  };

  return html`
    <div
      class="vibe-container"
      ref=${containerRef}
      style=${{
        position: "relative",
        width: "100%",
        minHeight: minHeight ? `${minHeight}px` : "220px"
      }}
    >
      ${shouldRenderWidget && html`
        <div style=${{
          opacity: isLoading ? 0.4 : 1,
          pointerEvents: isLoading ? "none" : "auto",
          transition: "opacity 0.3s ease",
        }}>
          <${SandboxedRunner} code=${renderCode} model=${model} />
        </div>
      `}
      
      ${isLoading && html`
        <${LoadingOverlay} 
          logs=${logs} 
          hasExistingWidget=${hasCode}
        />
      `}
      
      ${!isLoading && shouldRenderWidget && html`
        <${FloatingMenu} 
          isOpen=${isMenuOpen} 
          onToggle=${() => setMenuOpen(!isMenuOpen)}
          onGrabModeStart=${handleGrabStart}
          onViewSource=${handleViewSource}
          highAuditCount=${highAuditCount}
          isEditMode=${!!grabMode}
        />
      `}
        
      ${grabMode === "selecting" && html`
        <${SelectionOverlay} 
          onElementSelect=${handleElementSelect}
          onCancel=${handleCancel}
        />
      `}
      
      ${grabMode && grabMode !== "selecting" && html`
        <${EditPromptPanel}
          elementBounds=${grabMode.bounds}
          elementDescription=${grabMode.element}
          initialPrompt=${promptCache[grabMode.elementKey] || ""}
          onSubmit=${handleEditSubmit}
          onCancel=${handleCancel}
        />
      `}

      ${showAudit && html`
        <${AuditNotice} onAccept=${handleAuditAccept} />
      `}

      ${showSource && html`
        <${EditorViewer}
          code=${code}
          errorMessage=${sourceError}
          auditStatus=${auditStatus}
          auditReport=${auditReport}
          auditError=${auditError || auditResponse?.error}
          auditMeta=${auditMeta}
          auditData=${auditData}
          auditApplyStatus=${auditApplyStatus}
          auditApplyResponse=${auditApplyResponse}
          auditApplyError=${auditApplyError}
          onAudit=${handleAuditRequest}
          onApply=${handleApplySource}
          onClose=${() => setShowSource(false)}
          approvalMode=${approvalMode}
          isApproved=${isApproved}
          onApprove=${handleApproveRun}
        />
      `}
    </div>
  `;
}

let rootInstance = null;

function render({ model, el }) {
  if (!rootInstance) {
    rootInstance = createRoot(el);
  }
  rootInstance.render(html`<${AppWrapper} model=${model} />`);
}

export default { render };
