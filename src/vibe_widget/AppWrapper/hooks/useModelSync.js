import * as React from "react";

// Syncs status/logs/code from the traitlets model with cleanup.
export default function useModelSync(model) {
  const [status, setStatus] = React.useState(model.get("status"));
  const [logs, setLogs] = React.useState(model.get("logs"));
  const [code, setCode] = React.useState(model.get("code"));
  const [errorMessage, setErrorMessage] = React.useState(model.get("error_message"));
  const [auditStatus, setAuditStatus] = React.useState(model.get("audit_status"));
  const [auditResponse, setAuditResponse] = React.useState(model.get("audit_response"));
  const [auditError, setAuditError] = React.useState(model.get("audit_error"));
  const [auditApplyStatus, setAuditApplyStatus] = React.useState(model.get("audit_apply_status"));
  const [auditApplyResponse, setAuditApplyResponse] = React.useState(model.get("audit_apply_response"));
  const [auditApplyError, setAuditApplyError] = React.useState(model.get("audit_apply_error"));

  React.useEffect(() => {
    const onStatusChange = () => setStatus(model.get("status"));
    const onLogsChange = () => setLogs(model.get("logs"));
    const onCodeChange = () => setCode(model.get("code"));
    const onErrorChange = () => setErrorMessage(model.get("error_message"));
    const onAuditStatusChange = () => setAuditStatus(model.get("audit_status"));
    const onAuditResponseChange = () => setAuditResponse(model.get("audit_response"));
    const onAuditErrorChange = () => setAuditError(model.get("audit_error"));
    const onAuditApplyStatusChange = () => setAuditApplyStatus(model.get("audit_apply_status"));
    const onAuditApplyResponseChange = () => setAuditApplyResponse(model.get("audit_apply_response"));
    const onAuditApplyErrorChange = () => setAuditApplyError(model.get("audit_apply_error"));

    model.on("change:status", onStatusChange);
    model.on("change:logs", onLogsChange);
    model.on("change:code", onCodeChange);
    model.on("change:error_message", onErrorChange);
    model.on("change:audit_status", onAuditStatusChange);
    model.on("change:audit_response", onAuditResponseChange);
    model.on("change:audit_error", onAuditErrorChange);
    model.on("change:audit_apply_status", onAuditApplyStatusChange);
    model.on("change:audit_apply_response", onAuditApplyResponseChange);
    model.on("change:audit_apply_error", onAuditApplyErrorChange);

    return () => {
      model.off("change:status", onStatusChange);
      model.off("change:logs", onLogsChange);
      model.off("change:code", onCodeChange);
      model.off("change:error_message", onErrorChange);
      model.off("change:audit_status", onAuditStatusChange);
      model.off("change:audit_response", onAuditResponseChange);
      model.off("change:audit_error", onAuditErrorChange);
      model.off("change:audit_apply_status", onAuditApplyStatusChange);
      model.off("change:audit_apply_response", onAuditApplyResponseChange);
      model.off("change:audit_apply_error", onAuditApplyErrorChange);
    };
  }, [model]);

  return {
    status,
    logs,
    code,
    errorMessage,
    auditStatus,
    auditResponse,
    auditError,
    auditApplyStatus,
    auditApplyResponse,
    auditApplyError
  };
}
