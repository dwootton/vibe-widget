import React from "react";

export default function EditorHeader({
  showApprove,
  auditIndicator,
  auditStatus,
  hasAuditPayload,
  showAuditPanel,
  onToggleAuditPanel,
  onRunAudit,
  onApprove,
  onClose
}) {
  return (
    <div class="source-viewer-header">
      <style>{`
        .source-viewer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(12, 12, 12, 0.9);
          border-bottom: 1px solid rgba(242, 240, 233, 0.12);
          color: #f2f0e9;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
        }
        .source-viewer-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .source-viewer-button {
          background: #f97316;
          color: #0b0b0b;
          border: none;
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 12px;
          cursor: pointer;
        }
        .source-viewer-button.subtle {
          background: transparent;
          color: #e2e8f0;
          border: 1px solid rgba(242, 240, 233, 0.18);
        }
        .audit-indicator {
          color: #f97316;
          font-size: 11px;
        }
      `}</style>
      <div class="source-viewer-title">
        <span>Source Viewer</span>
        {auditIndicator && <span class="audit-indicator">{auditIndicator}</span>}
        {auditStatus === "running" && <span class="audit-indicator">Auditing...</span>}
      </div>
      <div class="source-viewer-actions">
        {!hasAuditPayload && (
          <button
            class="source-viewer-button"
            disabled={auditStatus === "running"}
            onClick={onRunAudit}
          >
            {auditStatus === "running" ? "Auditing..." : "Audit"}
          </button>
        )}
        {hasAuditPayload && (
          <button class="source-viewer-button subtle" onClick={onToggleAuditPanel}>
            {showAuditPanel ? "Hide Audit" : "Show Audit"}
          </button>
        )}
        {showApprove ? (
          <button class="source-viewer-button" onClick={onApprove}>Approve</button>
        ) : (
          <button class="source-viewer-button subtle" onClick={onClose}>Close</button>
        )}
      </div>
    </div>
  );
}
