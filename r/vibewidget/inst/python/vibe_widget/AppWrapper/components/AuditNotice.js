import React from "react";
import { tw } from "../styles/setup.js";

const overlayClass = tw(
  "absolute inset-0 z-[1200] flex items-center justify-center bg-[rgba(6,6,6,0.72)] backdrop-blur-[4px]"
);
const cardClass = tw(
  // The card pins a dark surface, so its text pins the light foreground too.
  // text-text-primary follows --jp-ui-font-color0 and turns black in a light
  // host (Quarto, JupyterLab light), leaving black text on dark navy.
  "w-[min(520px,92%)] bg-[#0f172a] text-[#f2f0e9] border-2 border-[rgba(248,113,113,0.65)] rounded-[12px] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.4)] font-mono"
);
const titleClass = tw("text-[14px] uppercase tracking-[0.08em] text-error-light mb-3");
const bodyClass = tw("text-[13px] leading-[1.5] text-[#f2f0e9] mb-4");
const actionsClass = tw("flex justify-end gap-2");
const acceptButtonClass = tw(
  "bg-accent text-[#0b0b0b] border-none rounded-[8px] px-4 py-2 text-[12px] font-semibold cursor-pointer transition-colors duration-150 hover:bg-[#fb923c]"
);
const auditButtonClass = tw(
  "bg-transparent text-[#f2f0e9] border border-[rgba(242,240,233,0.45)] rounded-[8px] px-4 py-2 text-[12px] font-semibold cursor-pointer transition-colors duration-150 hover:bg-[rgba(242,240,233,0.12)] disabled:cursor-default disabled:opacity-60"
);
const strongClass = tw("text-[#fef2f2]");

export default function AuditNotice({ onRunAudit, onApprove, auditStatus }) {
  const auditing = auditStatus === "running";
  return (
    <div class={overlayClass}>
      <div class={cardClass} role="dialog" aria-live="polite">
        <div class={titleClass}>Approval Required</div>
        <div class={bodyClass}>
          Vibe widgets are <strong class={strongClass}>LLM-generated code</strong> that runs with the
          privileges of this page. Review it for correctness, data handling, and safety before
          approving. An audit asks the model to review the code and costs a request.
        </div>
        <div class={actionsClass}>
          <button class={auditButtonClass} onClick={() => onRunAudit("fast")} disabled={auditing}>
            {auditing ? "Auditing..." : "Run audit"}
          </button>
          <button class={acceptButtonClass} onClick={onApprove}>
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
