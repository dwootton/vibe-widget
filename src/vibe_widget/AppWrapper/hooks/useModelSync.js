import * as React from "react";
import { debugLog } from "../utils/debug";

// Syncs status/logs/code from the traitlets model with cleanup.
export default function useModelSync(model) {
  const [status, setStatus] = React.useState(model.get("status"));
  const [logs, setLogs] = React.useState(model.get("logs"));
  const [code, setCode] = React.useState(model.get("code"));
  const [renderCode, setRenderCode] = React.useState(model.get("render_code"));
  const [errorMessage, setErrorMessage] = React.useState(model.get("error_message"));
  const [widgetError, setWidgetError] = React.useState(model.get("widget_error"));
  const [lastRuntimeError, setLastRuntimeError] = React.useState(model.get("last_runtime_error"));
  const [widgetLogs, setWidgetLogs] = React.useState(model.get("widget_logs"));
  const [retryCount, setRetryCount] = React.useState(model.get("retry_count"));
  const [auditState, setAuditState] = React.useState(model.get("audit_state") || {});
  const [executionState, setExecutionState] = React.useState(model.get("execution_state") || {});
  const traceRef = React.useRef({
    status,
    logsLen: Array.isArray(logs) ? logs.length : 0,
    codeLen: code ? code.length : 0,
    renderCodeLen: renderCode ? renderCode.length : 0,
    errorMessage,
    widgetError,
    lastRuntimeError,
    widgetLogsLen: Array.isArray(widgetLogs) ? widgetLogs.length : 0,
    retryCount,
    auditState,
    executionState
  });

  const traceChange = React.useCallback((label, nextValue) => {
    const modelId = model?.cid || model?.model_id || model?.id || model?.get?.("_model_id");
    console.log("[VIBE_STATE_TRACE]", {
      ts: new Date().toISOString(),
      modelId,
      label,
      next: nextValue
    });
  }, [model]);

  React.useEffect(() => {
    const onStatusChange = () => {
      const nextStatus = model.get("status");
      const nextRuntime = model.get("last_runtime_error");
      if (traceRef.current.status !== nextStatus) {
        traceRef.current.status = nextStatus;
        traceChange("status", nextStatus);
      }
      if (traceRef.current.lastRuntimeError !== nextRuntime) {
        traceRef.current.lastRuntimeError = nextRuntime;
        traceChange("last_runtime_error", nextRuntime);
      }
      setStatus(nextStatus);
      setLastRuntimeError(nextRuntime);
    };
    const onLogsChange = () => {
      const nextLogs = model.get("logs");
      const nextLen = Array.isArray(nextLogs) ? nextLogs.length : 0;
      if (traceRef.current.logsLen !== nextLen) {
        traceRef.current.logsLen = nextLen;
        traceChange("logs.length", nextLen);
      }
      setLogs(nextLogs);
    };
    const onCodeChange = () => {
      const nextCode = model.get("code");
      const nextLen = nextCode ? nextCode.length : 0;
      if (traceRef.current.codeLen !== nextLen) {
        traceRef.current.codeLen = nextLen;
        traceChange("code.length", nextLen);
      }
      setCode(nextCode);
    };
    const onRenderCodeChange = () => {
      const nextCode = model.get("render_code");
      const nextLen = nextCode ? nextCode.length : 0;
      if (traceRef.current.renderCodeLen !== nextLen) {
        traceRef.current.renderCodeLen = nextLen;
        traceChange("render_code.length", nextLen);
      }
      setRenderCode(nextCode);
    };
    const onErrorChange = () => {
      const nextError = model.get("error_message");
      const nextRuntime = model.get("last_runtime_error");
      if (traceRef.current.errorMessage !== nextError) {
        traceRef.current.errorMessage = nextError;
        traceChange("error_message", nextError);
      }
      if (traceRef.current.lastRuntimeError !== nextRuntime) {
        traceRef.current.lastRuntimeError = nextRuntime;
        traceChange("last_runtime_error", nextRuntime);
      }
      setErrorMessage(nextError);
      setLastRuntimeError(nextRuntime);
    };
    const onWidgetErrorChange = () => {
      const nextWidgetError = model.get("widget_error");
      const nextRuntime = model.get("last_runtime_error");
      if (traceRef.current.widgetError !== nextWidgetError) {
        traceRef.current.widgetError = nextWidgetError;
        traceChange("widget_error", nextWidgetError);
      }
      if (traceRef.current.lastRuntimeError !== nextRuntime) {
        traceRef.current.lastRuntimeError = nextRuntime;
        traceChange("last_runtime_error", nextRuntime);
      }
      setWidgetError(nextWidgetError);
      setLastRuntimeError(nextRuntime);
    };
    const onLastRuntimeErrorChange = () => {
      const nextRuntime = model.get("last_runtime_error");
      if (traceRef.current.lastRuntimeError !== nextRuntime) {
        traceRef.current.lastRuntimeError = nextRuntime;
        traceChange("last_runtime_error", nextRuntime);
      }
      setLastRuntimeError(nextRuntime);
    };
    const onWidgetLogsChange = () => {
      const nextLogs = model.get("widget_logs");
      const nextLen = Array.isArray(nextLogs) ? nextLogs.length : 0;
      if (traceRef.current.widgetLogsLen !== nextLen) {
        traceRef.current.widgetLogsLen = nextLen;
        traceChange("widget_logs.length", nextLen);
      }
      setWidgetLogs(nextLogs);
    };
    const onRetryCountChange = () => {
      const nextRetry = model.get("retry_count");
      if (traceRef.current.retryCount !== nextRetry) {
        traceRef.current.retryCount = nextRetry;
        traceChange("retry_count", nextRetry);
      }
      setRetryCount(nextRetry);
    };
    const onAuditStateChange = () => {
      const nextAudit = model.get("audit_state") || {};
      debugLog(model, "[vibe][audit] audit_state changed", nextAudit);
      traceChange("audit_state", nextAudit);
      setAuditState(nextAudit);
    };
    const onExecutionStateChange = () => {
      const nextExec = model.get("execution_state") || {};
      traceChange("execution_state", nextExec);
      setExecutionState(nextExec);
    };

    model.on("change:status", onStatusChange);
    model.on("change:logs", onLogsChange);
    model.on("change:code", onCodeChange);
    model.on("change:render_code", onRenderCodeChange);
    model.on("change:error_message", onErrorChange);
    model.on("change:widget_error", onWidgetErrorChange);
    model.on("change:last_runtime_error", onLastRuntimeErrorChange);
    model.on("change:widget_logs", onWidgetLogsChange);
    model.on("change:retry_count", onRetryCountChange);
    model.on("change:audit_state", onAuditStateChange);
    model.on("change:execution_state", onExecutionStateChange);

    return () => {
      model.off("change:status", onStatusChange);
      model.off("change:logs", onLogsChange);
      model.off("change:code", onCodeChange);
      model.off("change:render_code", onRenderCodeChange);
      model.off("change:error_message", onErrorChange);
      model.off("change:widget_error", onWidgetErrorChange);
      model.off("change:last_runtime_error", onLastRuntimeErrorChange);
      model.off("change:widget_logs", onWidgetLogsChange);
      model.off("change:retry_count", onRetryCountChange);
      model.off("change:audit_state", onAuditStateChange);
      model.off("change:execution_state", onExecutionStateChange);
    };
  }, [model]);

  const auditApply = auditState.apply || {};

  const auditStatus = auditState.status || "idle";
  const auditResponse = auditState.response || {};
  const auditError = auditState.error || "";
  const auditApplyStatus = auditApply.status || "idle";
  const auditApplyResponse = auditApply.response || {};
  const auditApplyError = auditApply.error || "";

  const executionMode = executionState.mode || "auto";
  const executionApproved = executionState.approved !== false;

  return {
    status,
    logs,
    code,
    renderCode,
    errorMessage,
    widgetError,
    lastRuntimeError,
    widgetLogs,
    retryCount,
    auditState,
    auditStatus,
    auditResponse,
    auditError,
    auditApplyStatus,
    auditApplyResponse,
    auditApplyError,
    executionState,
    executionMode,
    executionApproved
  };
}
