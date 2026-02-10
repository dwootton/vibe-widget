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

// --- Annotation toolbar styles ---
const toolbarClass = tw(
  "flex items-center h-7 rounded-[4px] border border-border-medium overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
);
const toolbarCountClass = tw(
  "flex items-center h-full px-2 text-[10px] font-mono text-text-muted bg-surface-2 select-none whitespace-nowrap"
);
const toolbarBtnClass = tw(
  "flex items-center justify-center h-full w-7 cursor-pointer transition-colors duration-100 text-[12px] leading-none border-none outline-none"
);
const toolbarDivider = tw("w-px h-full bg-border-medium flex-none");
const toolbarBtnDisabled = tw("opacity-30 cursor-not-allowed");

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
  const hasAnnotations = annotationCount > 0;

  if (isEditMode) {
    return (
      <div class={`floating-menu ${containerClass}`}>
        <div class={toolbarClass} style={{ background: "rgba(0,0,0,0.88)" }}>
          {hasAnnotations && (
            <span class={toolbarCountClass} style={{ background: "transparent" }}>
              {annotationCount}
            </span>
          )}
          {hasAnnotations && <span class={toolbarDivider} />}

          <button
            type="button"
            class={`${toolbarBtnClass} ${!canSubmit ? toolbarBtnDisabled : ""}`}
            style={{ color: canSubmit ? "#f97316" : undefined, background: "transparent" }}
            onClick={onAnnotationSubmit}
            disabled={!canSubmit}
            title={canSubmit ? `Send ${filledCount} annotation${filledCount !== 1 ? "s" : ""}` : "Add prompts first"}
          >
            &#x2713;
          </button>

          <span class={toolbarDivider} />

          <button
            type="button"
            class={`${toolbarBtnClass} ${!hasAnnotations ? toolbarBtnDisabled : ""}`}
            style={{ color: "rgba(242,240,233,0.55)", background: "transparent" }}
            onClick={onAnnotationClear}
            disabled={!hasAnnotations}
            title="Clear all annotations"
          >
            &#x21BA;
          </button>

          <span class={toolbarDivider} />

          <button
            type="button"
            class={toolbarBtnClass}
            style={{ color: "rgba(242,240,233,0.55)", background: "transparent" }}
            onClick={onAnnotationCancel}
            title="Cancel (Esc)"
          >
            &#x2715;
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class={`floating-menu ${containerClass}`}>
      <div class={dotWrapperClass}>
        <div class={dotClass} onClick={onToggle}>
          <div class={dotInnerClass}></div>
        </div>
        {badge}
      </div>
      {isOpen ? options : null}
    </div>
  );
}
