import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";

import "./styles/setup.js";
import { ensureGlobalStyles } from "./utils/styles";
import AuditNotice from "./components/AuditNotice";
import SaveDialog from "./components/SaveDialog";
import StateViewer from "./components/StateViewer";
import WidgetViewer from "./components/WidgetViewer";
import EditorViewer from "./components/editor/EditorViewer";
import useAuditFlow from "./hooks/useAuditFlow";
import useCodeFlow from "./hooks/useCodeFlow";
import useContainerMetrics from "./hooks/useContainerMetrics";
import useModelSync from "./hooks/useModelSync";
import { appendWidgetLogs, requestSaveWidget, requestStatePrompt } from "./actions/modelActions";
import { debugLog } from "./utils/debug";

ensureGlobalStyles();

let appWrapperCounter = 0;

function AppWrapper({ model }) {
  const instanceId = React.useRef(++appWrapperCounter).current;
  const debugEnabled =
    typeof globalThis !== "undefined" &&
    (globalThis.__VIBE_DEBUG === true ||
      (model && typeof model.get === "function" && model.get("debug_mode") === true));
  if (debugEnabled) {
    debugLog(model, "[vibe][debug] AppWrapper render", { instanceId });
    console.log("[vibe][debug] AppWrapper render", {
      instanceId,
      modelId: model?.cid || model?.model_id || model?.id || model?.get?.("_model_id")
    });
  }

  useEffect(() => {
    if (!model) return;
    const handleCommClose = () => {
      model.__vibeCommClosed = true;
      if (typeof model.__vibeOnCommClosed === "function") {
        model.__vibeOnCommClosed();
      }
    };
    if (typeof model.on === "function") {
      model.on("comm:close", handleCommClose);
    }
    if (model.comm && typeof model.comm.on === "function") {
      model.comm.on("close", handleCommClose);
    }
    return () => {
      if (typeof model.off === "function") {
        model.off("comm:close", handleCommClose);
      }
      if (model.comm && typeof model.comm.off === "function") {
        model.comm.off("close", handleCommClose);
      }
      model.__vibeCommClosed = true;
      try {
        model?.close?.();
      } catch (err) {
        // Ignore close failures during teardown.
      }
    };
  }, [model]);

  useEffect(() => {
    if (!model || typeof model.save_changes !== "function") return;
    const originalSave = model.save_changes.bind(model);
    model.save_changes = (...args) => {
      try {
        const result = originalSave(...args);
        model.__vibeCommClosed = false;
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err || "");
        if (message.toLowerCase().includes("cannot send")) {
          model.__vibeCommClosed = true;
          return;
        }
        throw err;
      }
    };
    return () => {
      model.save_changes = originalSave;
    };
  }, [model]);

  useEffect(() => {
    if (!model) return;
    try {
      model.set("frontend_ready", true);
      model.save_changes?.();
    } catch (err) {
      // Ignore frontend readiness failures.
    }
  }, [model]);

  useEffect(() => {
    if (typeof globalThis === "undefined") return;
    const sink = (payload) => {
      const debugEnabled =
        globalThis.__VIBE_DEBUG === true ||
        (model && typeof model.get === "function" && model.get("debug_mode") === true);
      if (!debugEnabled) {
        return;
      }
      try {
        const current = model?.get?.("debug_event") || {};
        model?.set?.("debug_event", {
          ...payload,
          modelId: model?.cid || model?.model_id || model?.id,
          ts: Date.now(),
          seq: (current.seq || 0) + 1
        });
        model?.save_changes?.();
      } catch (err) {
        // Ignore debug sink failures.
      }
    };
    globalThis.__VIBE_DEBUG_SINK = sink;
    return () => {
      if (globalThis.__VIBE_DEBUG_SINK === sink) {
        delete globalThis.__VIBE_DEBUG_SINK;
      }
    };
  }, [model]);

  const {
    status,
    logs,
    code,
    renderCode,
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
    executionApproved,
    executionState
  } = useModelSync(model);

  const isLoading = status === "generating" || status === "retrying";
  const approvalMode = executionMode === "approve";

  const {
    renderCode: flowRenderCode,
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

  const effectiveRenderCode = renderCode || flowRenderCode;
  const { containerRef, containerBounds, minHeight } = useContainerMetrics(effectiveRenderCode);
  const hasCode = effectiveRenderCode && effectiveRenderCode.length > 0;
  const isApproved = executionApproved || !approvalMode;
  const hasRuntimeError = !!(widgetError || lastRuntimeError);
  const runtimeCheck = executionState?.runtime_check === true;
  const shouldRenderWidget = hasCode && isApproved && !hasRuntimeError && (status === "ready" || runtimeCheck);
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

  const [editorDraft, setEditorDraft] = React.useState(null);
  const [editorCodeRanges, setEditorCodeRanges] = React.useState([]);
  const editorBaseRef = React.useRef(code || "");
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);

  React.useEffect(() => {
    if (!code) return;
    if (code !== editorBaseRef.current) {
      editorBaseRef.current = code;
      setEditorDraft(null);
      setEditorCodeRanges([]);
    }
  }, [code]);

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

  React.useEffect(() => {
    debugLog(model, "[vibe][debug] AppWrapper view flags", {
      instanceId,
      status,
      hasRuntimeError,
      showStateViewer: status !== "ready" || hasRuntimeError,
      showWidgetViewer: status === "ready" && shouldRenderWidget,
      showSource
    });
    console.log("[vibe][debug] AppWrapper view flags", {
      instanceId,
      modelId: model?.cid || model?.model_id || model?.id,
      status,
      hasRuntimeError,
      showStateViewer: status !== "ready" || hasRuntimeError,
      showWidgetViewer: status === "ready" && shouldRenderWidget,
      showSource
    });
  }, [model, instanceId, status, hasRuntimeError, shouldRenderWidget, showSource]);

  const handleStatePrompt = (payload) => {
    if (payload && typeof payload === "object") {
      const trimmed = (payload.prompt || "").trim();
      if (!trimmed) return;
      requestStatePrompt(model, {
        prompt: trimmed,
        mode: status,
        error: widgetError || errorMessage || "",
        base_code: payload.base_code,
        code_change_ranges: payload.code_change_ranges
      });
      return;
    }
    const trimmed = (payload || "").trim();
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

  const handleSaveWidget = () => {
    setShowSaveDialog(true);
  };

  const handleSaveConfirm = async (filename) => {
    setShowSaveDialog(false);
    if (!filename) return;
    try {
      const savedPath = await requestSaveWidget(model, { path: filename });
      const message = savedPath ? `Saved widget to ${savedPath}` : `Saved widget to ${filename}`;
      appendWidgetLogs(model, [
        {
          timestamp: Date.now() / 1000,
          message,
          level: "info",
          source: "ui"
        }
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err || "Save failed.");
      appendWidgetLogs(model, [
        {
          timestamp: Date.now() / 1000,
          message: `Save failed: ${message}`,
          level: "error",
          source: "ui"
        }
      ]);
    }
  };

  const handleSaveCancel = () => {
    setShowSaveDialog(false);
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

      <SaveDialog
        isOpen={showSaveDialog}
        onSave={handleSaveConfirm}
        onCancel={handleSaveCancel}
        defaultName="widget.vw"
      />

      {(status !== "ready" || hasRuntimeError || runtimeCheck) && (
        <div
          style={
            runtimeCheck && status === "ready"
              ? { position: "absolute", inset: 0, zIndex: 20 }
              : { width: "100%", height: "100%", minHeight: 0, display: "flex" }
          }
        >
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
        </div>
      )}

      {status === "ready" && shouldRenderWidget && (
        <WidgetViewer
          model={model}
          code={effectiveRenderCode}
          containerBounds={containerBounds}
          onViewSource={handleViewSource}
          onSave={handleSaveWidget}
          highAuditCount={highAuditCount}
        />
      )}

      {showSource && (
        <EditorViewer
          code={code}
          initialDraft={editorDraft ?? code}
          initialCodeChangeRanges={editorCodeRanges}
          onDraftChange={setEditorDraft}
          onCodeChangeRangesChange={setEditorCodeRanges}
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
  const traceTs = new Date().toISOString();
  const traceModelId = model?.cid || model?.model_id || model?.id || model?.get?.("_model_id");
  const stack = new Error("VIBE_RENDER_TRACE").stack;
  const renderCount = el ? (el.__vibeRenderCount = (el.__vibeRenderCount || 0) + 1) : 0;
  console.log("[VIBE_RENDER_TRACE]", {
    ts: traceTs,
    phase: "render_entry",
    modelId: traceModelId,
    hasEl: !!el,
    hasRoot: !!el?.__vibeRoot,
    renderCount,
    stack
  });
  const modelId = traceModelId;
  debugLog(model, "[vibe][debug] render() called", { modelId, hasRoot: !!el.__vibeRoot });

  let root = el.__vibeRoot;
  if (!root) {
    console.log("[VIBE_RENDER_TRACE]", {
      ts: new Date().toISOString(),
      phase: "create_root",
      modelId
    });
    debugLog(model, "[vibe][debug] creating root for model", { modelId });
    root = createRoot(el);
    el.__vibeRoot = root;
  }
  console.log("[VIBE_RENDER_TRACE]", {
    ts: new Date().toISOString(),
    phase: "render_call",
    modelId
  });
  root.render(<AppWrapper model={model} />);
}

export default { render };
