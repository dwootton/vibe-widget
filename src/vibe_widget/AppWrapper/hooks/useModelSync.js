import * as React from "react";

// Syncs status/logs/code from the traitlets model with cleanup.
export default function useModelSync(model) {
  const [status, setStatus] = React.useState(model.get("status"));
  const [logs, setLogs] = React.useState(model.get("logs"));
  const [code, setCode] = React.useState(model.get("code"));
  const [errorMessage, setErrorMessage] = React.useState(model.get("error_message"));
  const [retryCount, setRetryCount] = React.useState(model.get("retry_count"));
  const [auditState, setAuditState] = React.useState(model.get("audit_state") || {});
  const [executionState, setExecutionState] = React.useState(model.get("execution_state") || {});

  React.useEffect(() => {
    const onStatusChange = () => setStatus(model.get("status"));
    const onLogsChange = () => setLogs(model.get("logs"));
    const onCodeChange = () => setCode(model.get("code"));
    const onErrorChange = () => setErrorMessage(model.get("error_message"));
    const onRetryCountChange = () => setRetryCount(model.get("retry_count"));
    const onAuditStateChange = () => setAuditState(model.get("audit_state") || {});
    const onExecutionStateChange = () => setExecutionState(model.get("execution_state") || {});

    model.on("change:status", onStatusChange);
    model.on("change:logs", onLogsChange);
    model.on("change:code", onCodeChange);
    model.on("change:error_message", onErrorChange);
    model.on("change:retry_count", onRetryCountChange);
    model.on("change:audit_state", onAuditStateChange);
    model.on("change:execution_state", onExecutionStateChange);

    return () => {
      model.off("change:status", onStatusChange);
      model.off("change:logs", onLogsChange);
      model.off("change:code", onCodeChange);
      model.off("change:error_message", onErrorChange);
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
    errorMessage,
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
