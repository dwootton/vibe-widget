import * as React from "react";
import { requestAudit } from "../actions/modelActions";
import { debugLog } from "../utils/debug";

export default function useAuditFlow({ model, approvalMode, status, code, isApproved }) {
  // Approve mode only: the notice IS the approval gate. Auto mode never shows it,
  // and no audit runs until the user asks for one.
  const showAudit = approvalMode && !isApproved && !!code;

  const handleRequestAudit = React.useCallback((level) => {
    debugLog(model, "[vibe][audit] requestAudit", { level, status, codePresent: !!code });
    requestAudit(model, level);
  }, [model, status, code]);

  return {
    showAudit,
    requestAudit: handleRequestAudit
  };
}
