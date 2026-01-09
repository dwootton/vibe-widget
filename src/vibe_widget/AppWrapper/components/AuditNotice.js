import React from "react";
import { tw } from "../styles/setup.js";

const overlayClass = tw(
  "absolute inset-0 z-[1200] flex items-center justify-center bg-[rgba(6,6,6,0.72)] backdrop-blur-[4px]"
);
const cardClass = tw(
  "w-[min(520px,92%)] bg-[#0f172a] text-text-primary border-2 border-[rgba(248,113,113,0.65)] rounded-[12px] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.4)] font-mono"
);
const titleClass = tw("text-[14px] uppercase tracking-[0.08em] text-error-light mb-3");
const bodyClass = tw("text-[13px] leading-[1.5] text-text-primary mb-4");
const actionsClass = tw("flex justify-end gap-2");
const acceptButtonClass = tw(
  "bg-accent text-[#0b0b0b] border-none rounded-[8px] px-4 py-2 text-[12px] font-semibold cursor-pointer transition-colors duration-150 hover:bg-[#fb923c]"
);
const strongClass = tw("text-[#fef2f2]");

export default function AuditNotice({ onAccept }) {
  return (
    <div class={overlayClass}>
      <div class={cardClass} role="dialog" aria-live="polite">
        <div class={titleClass}>Audit Required</div>
        <div class={bodyClass}>
          Vibe widgets are <strong class={strongClass}>LLM-generated code</strong>. Before using results,
          review the widget for correctness, data handling, and safety.
          By continuing, you acknowledge the need to audit outputs.
        </div>
        <div class={actionsClass}>
          <button class={acceptButtonClass} onClick={onAccept}>
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
