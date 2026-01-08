import * as React from "react";
import { createRoot } from "react-dom/client";
import htm from "htm";

import { ensureGlobalStyles } from "./utils/styles";
import AuditNotice from "./components/AuditNotice";
import StateViewer from "./components/StateViewer";
import WidgetViewer from "./components/WidgetViewer";
import EditorViewer from "./components/editor/EditorViewer";
import useAuditFlow from "./hooks/useAuditFlow";
import useCodeFlow from "./hooks/useCodeFlow";
import useContainerMetrics from "./hooks/useContainerMetrics";
import useModelSync from "./hooks/useModelSync";
import { requestStatePrompt } from "./actions/modelActions";

const html = htm.bind(React.createElement);

ensureGlobalStyles();

function AppWrapper({ model }) {
  const {
    status,
    logs,
    code,
    errorMessage,
    widgetError,
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

  const isLoading = status === "generating" || status === "retrying";
  const approvalMode = executionMode === "approve";

  const {
    renderCode,
    showSource,
    sourceError,
    setShowSource,
    handleApplySource,
    handleApproveRun
  } = useCodeFlow({
    model,
    code,
    status,
    errorMessage,
    approvalMode,
    executionApproved
  });

  const { containerRef, containerBounds, minHeight } = useContainerMetrics(renderCode);
  const hasCode = renderCode && renderCode.length > 0;
  const isApproved = executionApproved || !approvalMode;
  const shouldRenderWidget = hasCode && isApproved;
  
  const {
    showAudit,
    setShowAudit,
    requestAudit,
    acceptAudit
  } = useAuditFlow({
    model,
    approvalMode,
    status,
    code,
    auditStatus,
    isLoading,
    hasCode
  });

  const handleViewSource = () => {
    setShowSource(true);
  };

  const auditReport = auditResponse?.report_yaml || "";
  const auditMeta = auditResponse && !auditResponse.error ? auditResponse : null;
  const auditData = auditResponse?.report || null;
  const auditConcerns = auditData?.fast_audit?.concerns || [];
  const highAuditCount = auditConcerns.filter((concern) => concern?.impact === "high").length;

  const handleStatePrompt = (prompt) => {
    const trimmed = (prompt || "").trim();
    if (!trimmed) return;
    requestStatePrompt(model, {
      prompt: trimmed,
      mode: status,
      error: widgetError || errorMessage || ""
    });
  };

  const handleAuditAccept = () => {
    acceptAudit();
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

      ${showAudit && html`
        <${AuditNotice} onAccept=${handleAuditAccept} />
      `}

      ${status !== "ready" && html`
        <${StateViewer}
          status=${status}
          logs=${logs}
          errorMessage=${errorMessage}
          widgetError=${widgetError}
          retryCount=${retryCount}
          onSubmitPrompt=${handleStatePrompt}
        />
      `}

      ${status === "ready" && shouldRenderWidget && html`
        <${WidgetViewer}
          model=${model}
          code=${renderCode}
          containerBounds=${containerBounds}
          onViewSource=${handleViewSource}
          highAuditCount=${highAuditCount}
        />
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
          onAudit=${requestAudit}
          onApply=${handleApplySource}
          onClose=${() => setShowSource(false)}
          approvalMode=${approvalMode}
          isApproved=${isApproved}
          onApprove=${() => {
            handleApproveRun();
            setShowAudit(false);
          }}
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
