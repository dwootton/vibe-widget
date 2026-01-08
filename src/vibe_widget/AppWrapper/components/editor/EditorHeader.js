import * as React from "react";
import htm from "htm";

const html = htm.bind(React.createElement);

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
  return html`
    <div class="source-viewer-header">
      <span>${showApprove ? "Review & Approve" : "Code Editor"}</span>
      <div class="source-viewer-actions">
        ${auditIndicator && html`<span class="audit-indicator">${auditIndicator}</span>`}
        ${auditStatus === "running" && html`<span class="audit-indicator">Auditing...</span>`}
        ${!hasAuditPayload && html`
          <button class="source-viewer-button" disabled=${auditStatus === "running"} onClick=${onRunAudit}>
            ${auditStatus === "running" ? "Auditing..." : "Audit"}
          </button>
        `}
        ${hasAuditPayload && html`
          <button class="source-viewer-button subtle" onClick=${onToggleAuditPanel}>
            ${showAuditPanel ? "Hide Audit" : "Show Audit"}
          </button>
        `}
        ${showApprove && html`
          <button class="source-viewer-button" onClick=${onApprove}>Approve & Run</button>
        `}
        ${!showApprove && html`
          <button class="source-viewer-button" onClick=${onClose}>Close</button>
        `}
      </div>
    </div>
  `;
}
