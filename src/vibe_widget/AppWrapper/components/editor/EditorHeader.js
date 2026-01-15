import React from "react";
import { tw } from "../../styles/setup.js";

const headerClass = tw(
  "flex items-center justify-between gap-2 px-3 py-2 bg-[rgba(12,12,12,0.9)] border-b border-[rgba(242,240,233,0.12)] text-[12px] font-mono text-text-primary"
);
const actionsClass = tw("flex items-center gap-2");
const buttonBase = tw(
  "rounded-[6px] px-3 py-1 text-[12px] font-semibold transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
);
const primaryButton = `${buttonBase} ${tw("bg-accent text-surface-1 border-none")}`;
const subtleButton = `${buttonBase} ${tw("bg-transparent border border-[rgba(242,240,233,0.18)] text-text-primary")}`;

export default function EditorHeader({
  showApprove,
  hasAuditPayload,
  auditStatus,
  showAuditPanel,
  onToggleAuditPanel,
  onRunAudit,
  onCopy,
  copyLabel,
  copyDisabled,
  onApprove,
  onClose
}) {
  return (
    <div class={headerClass}>
      <div class="source-viewer-title">
        <span>Source Viewer</span>
      </div>
      <div class={actionsClass}>
        {onCopy && (
          <button class={subtleButton} disabled={copyDisabled} onClick={onCopy}>
            {copyLabel || "Copy"}
          </button>
        )}
        {!hasAuditPayload && (
          <button
            class={primaryButton}
            disabled={auditStatus === "running"}
            onClick={onRunAudit}
          >
            {auditStatus === "running" ? "Auditing..." : "Audit"}
          </button>
        )}
        {hasAuditPayload && (
          <button class={subtleButton} onClick={onToggleAuditPanel}>
            {showAuditPanel ? "Hide Audit" : "Show Audit"}
          </button>
        )}
        {showApprove ? (
          <button class={primaryButton} onClick={onApprove}>Approve</button>
        ) : (
          <button class={subtleButton} onClick={onClose}>Close</button>
        )}
      </div>
    </div>
  );
}
