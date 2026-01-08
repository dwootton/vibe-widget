import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";

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
import { debugLog } from "./utils/debug";

ensureGlobalStyles();

let appWrapperCounter = 0;

function AppWrapper({ model }) {
  const instanceId = React.useRef(++appWrapperCounter).current;
  debugLog(model, "[vibe][debug] AppWrapper render", { instanceId });

  useEffect(() => {
    return () => {
      try {
        if (model && typeof model.close === "function") {
          model.close();
        }
      } catch (err) {
        // Ignore teardown failures during output clear.
      }
    };
  }, [model]);

  const {
    status,
    logs,
    code,
    errorMessage,
    widgetError,
    lastRuntimeError,
    widgetLogs,
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
  const hasRuntimeError = !!(widgetError || lastRuntimeError);
  const shouldRenderWidget = hasCode && isApproved && !hasRuntimeError;
  const viewerStatus = hasRuntimeError && status === "ready" ? "error" : status;
  const { showAudit, setShowAudit, requestAudit, acceptAudit } = useAuditFlow({
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

  React.useEffect(() => {
    if (status === "ready" && shouldRenderWidget) {
      debugLog(model, "[vibe][debug] AppWrapper rendering WidgetViewer", {
        instanceId,
        status,
        shouldRenderWidget
      });
    }
  }, [model, instanceId, status, shouldRenderWidget]);

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

  return (
    <div
      class="vibe-container"
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        minHeight: minHeight ? `${minHeight}px` : "300px",
        height: status !== "ready" ? "300px" : "auto"
      }}
    >
      {showAudit && <AuditNotice onAccept={handleAuditAccept} />}

      {status !== "ready" && (
        <StateViewer
          status={viewerStatus}
          logs={logs}
          widgetLogs={widgetLogs}
          errorMessage={errorMessage}
          widgetError={widgetError}
          lastRuntimeError={lastRuntimeError}
          retryCount={retryCount}
          hideOuterStatus={true}
          onSubmitPrompt={handleStatePrompt}
        />
      )}

      {status === "ready" && hasRuntimeError && (
        <StateViewer
          status={viewerStatus}
          logs={logs}
          widgetLogs={widgetLogs}
          errorMessage={errorMessage}
          widgetError={widgetError}
          lastRuntimeError={lastRuntimeError}
          retryCount={retryCount}
          hideOuterStatus={true}
          onSubmitPrompt={handleStatePrompt}
        />
      )}

      {status === "ready" && shouldRenderWidget && (
        <WidgetViewer
          model={model}
          code={renderCode}
          containerBounds={containerBounds}
          onViewSource={handleViewSource}
          highAuditCount={highAuditCount}
        />
      )}

      {showSource && (
        <EditorViewer
          code={code}
          errorMessage={sourceError}
          status={status}
          logs={logs}
          widgetLogs={widgetLogs}
          stateErrorMessage={errorMessage}
          stateWidgetError={widgetError}
          lastRuntimeError={lastRuntimeError}
          auditStatus={auditStatus}
          auditReport={auditReport}
          auditError={auditError || auditResponse?.error}
          auditMeta={auditMeta}
          auditData={auditData}
          auditApplyStatus={auditApplyStatus}
          auditApplyResponse={auditApplyResponse}
          auditApplyError={auditApplyError}
          onAudit={requestAudit}
          onApply={handleApplySource}
          onClose={() => setShowSource(false)}
          onSubmitPrompt={handleStatePrompt}
          approvalMode={approvalMode}
          isApproved={isApproved}
          onApprove={() => {
            handleApproveRun();
            setShowAudit(false);
          }}
        />
      )}
    </div>
  );
}

function render({ model, el }) {
  const modelId = model?.cid || model?.model_id || model?.id || model?.get?.("_model_id");
  debugLog(model, "[vibe][debug] render() called", { modelId, hasRoot: !!el.__vibeRoot });

  let root = el.__vibeRoot;
  if (!root) {
    debugLog(model, "[vibe][debug] creating root for model", { modelId });
    root = createRoot(el);
    el.__vibeRoot = root;
  }
  root.render(<AppWrapper model={model} />);
}

export default { render };
