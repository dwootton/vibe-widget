import * as React from "react";
import { applyAuditChanges, approveExecution, updateCode } from "../actions/modelActions";

export default function useCodeFlow({
  model,
  code,
  status,
  errorMessage,
  approvalMode,
  executionApproved
}) {
  const [showSource, setShowSource] = React.useState(false);
  const [sourceError, setSourceError] = React.useState("");
  const [renderCode, setRenderCode] = React.useState(code || "");
  const [lastGoodCode, setLastGoodCode] = React.useState(code || "");
  const [applyState, setApplyState] = React.useState({
    pending: false,
    previousCode: "",
    nextCode: ""
  });

  const hasCode = renderCode && renderCode.length > 0;

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
  }, [applyState, code, errorMessage, status]);

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

  const handleApplySource = React.useCallback((payload) => {
    if (payload && payload.type === "audit_apply") {
      applyAuditChanges(model, { changes: payload.changes, baseCode: payload.baseCode });
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
    updateCode(model, nextCode);
  }, [code, model]);

  const handleApproveRun = React.useCallback(() => {
    approveExecution(model);
    setShowSource(false);
  }, [model]);

  return {
    renderCode,
    showSource,
    sourceError,
    setShowSource,
    handleApplySource,
    handleApproveRun
  };
}
