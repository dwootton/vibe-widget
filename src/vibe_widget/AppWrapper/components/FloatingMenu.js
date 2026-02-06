import React, { useMemo } from "react";
import { css, tw } from "../styles/setup.js";

const containerClass = tw("absolute top-3 right-3 z-[1000]");
const dotWrapperClass = tw("relative w-5 h-5");
const dotClass = tw(
  "w-5 h-5 rounded-none flex items-center justify-center border-2 border-[#2a2a2a] bg-white cursor-pointer"
);
const dotInnerClass = tw("w-2 h-2 rounded-full bg-accent");
const badgeClass = tw(
  "absolute top-2 right-2 w-5 h-5 rounded-full bg-error text-black text-[9px] font-semibold flex items-center justify-center"
);
const menuClass = tw(
  "absolute top-5 right-0 bg-surface-2 border border-border-medium rounded-[2px] px-1 py-1 min-w-[170px] shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
);
const menuOptionClass = tw(
  "w-full text-left pl-[10px] pr-[20px] py-[6px] flex items-center justify-between gap-2 text-xs font-mono text-text-primary rounded-[2px] transition-colors duration-200 hover:bg-surface-3 focus:outline-none"
);
const menuOptionAfter = css({
  "&::after": {
    content: '"<"',
    color: "currentColor",
    marginLeft: "8px"
  }
  ,
  "&[disabled]": {
    color: "rgba(148, 163, 184, 1)",
    cursor: "not-allowed",
    opacity: "0.65"
  }
});
const menuOptionButtonClass = `${menuOptionClass} ${menuOptionAfter}`;

// Annotation mode action icons row
const actionsRowClass = tw("flex items-center gap-1.5 mr-2");
const iconBtnBase = tw(
  "w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all duration-150 text-[11px] leading-none border-none"
);
const iconBtnSubmit = tw("bg-accent text-surface-1 hover:brightness-110");
const iconBtnClear = tw("bg-transparent text-text-muted border border-border-medium hover:text-text-primary hover:border-text-primary");
const iconBtnCancel = tw("bg-transparent text-text-muted border border-border-medium hover:text-error hover:border-error");
const iconBtnDisabled = tw("opacity-40 cursor-not-allowed");
const annotCountClass = tw("text-[10px] font-mono text-text-muted whitespace-nowrap mr-0.5");

export default function FloatingMenu({
  isOpen,
  onToggle,
  onGrabModeStart,
  onViewSource,
  onSave,
  highAuditCount,
  isEditMode,
  annotationCount,
  filledCount,
  onAnnotationSubmit,
  onAnnotationClear,
  onAnnotationCancel
}) {
  const badge = highAuditCount > 0 ? (
    <div class={badgeClass} title="High impact audit items">
      {highAuditCount}
    </div>
  ) : null;

  const options = useMemo(() => (
    <div class={menuClass}>
      <button type="button" class={menuOptionButtonClass} onClick={onGrabModeStart}>
        Edit Element
      </button>
      <button type="button" class={menuOptionButtonClass} onClick={onViewSource}>
        Edit Code
      </button>
      <button type="button" class={menuOptionButtonClass} onClick={onSave}>
        Save Widget
      </button>
    </div>
  ), [onGrabModeStart, onViewSource, onSave]);

  const canSubmit = filledCount > 0;

  return (
    <div class={`floating-menu ${containerClass}`}>
      <div class={tw("flex items-center")}>
        {isEditMode && (
          <div class={actionsRowClass}>
            {annotationCount > 0 && (
              <span class={annotCountClass}>{annotationCount}</span>
            )}
            <button
              type="button"
              class={`${iconBtnBase} ${iconBtnSubmit} ${!canSubmit ? iconBtnDisabled : ""}`}
              onClick={onAnnotationSubmit}
              disabled={!canSubmit}
              title={canSubmit ? `Send ${filledCount} annotation${filledCount !== 1 ? "s" : ""}` : "Add prompts first"}
            >
              &#x2713;
            </button>
            <button
              type="button"
              class={`${iconBtnBase} ${iconBtnClear} ${annotationCount === 0 ? iconBtnDisabled : ""}`}
              onClick={onAnnotationClear}
              disabled={annotationCount === 0}
              title="Clear all annotations"
            >
              &#x21BA;
            </button>
            <button
              type="button"
              class={`${iconBtnBase} ${iconBtnCancel}`}
              onClick={onAnnotationCancel}
              title="Cancel (Esc)"
            >
              &#x2715;
            </button>
          </div>
        )}
        <div class={dotWrapperClass}>
          <div class={`${dotClass} ${isEditMode ? "animate-spin-slow" : ""}`} onClick={onToggle}>
            <div class={dotInnerClass}></div>
          </div>
          {badge}
        </div>
      </div>
      {isOpen && !isEditMode ? options : null}
    </div>
  );
}
