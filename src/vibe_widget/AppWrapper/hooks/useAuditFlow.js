import * as React from "react";
import { requestAudit } from "../actions/modelActions";

const AUDIT_ACK_KEY = "vibe_widget_audit_ack";
const AUDIT_AUTORUN_KEY = "vibe_widget_audit_autorun";

export default function useAuditFlow({
  model,
  approvalMode,
  status,
  code,
  auditStatus,
  isLoading,
  hasCode
}) {
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
    requestAudit(model, "fast");
    try {
      sessionStorage.setItem(AUDIT_AUTORUN_KEY, "true");
    } catch (err) {
      // Ignore storage failures and only track in memory.
    }
    setHasAutoRunAudit(true);
  }, [approvalMode, hasAutoRunAudit, status, code, auditStatus, model]);

  const acceptAudit = React.useCallback(() => {
    try {
      sessionStorage.setItem(AUDIT_ACK_KEY, "true");
    } catch (err) {
      // Allow dismissal without persistence if session storage is blocked.
    }
    setHasAuditAck(true);
    setShowAudit(false);
  }, []);

  const handleRequestAudit = React.useCallback((level) => {
    requestAudit(model, level);
  }, [model]);

  return {
    showAudit,
    setShowAudit,
    acceptAudit,
    requestAudit: handleRequestAudit
  };
}
