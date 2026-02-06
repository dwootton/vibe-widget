import React from "react";
import { tw } from "../styles/setup.js";

const toolbarClass = tw(
  "fixed z-[10000] flex items-center gap-3 px-4 py-2.5 rounded-lg font-mono text-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
);
const countClass = tw("text-text-muted whitespace-nowrap");
const baseBtn = tw("rounded-[6px] px-3 py-1.5 text-[11px] font-semibold cursor-pointer transition-colors duration-150 whitespace-nowrap");
const clearBtn = `${baseBtn} ${tw("bg-transparent text-text-primary border border-border-medium")}`;
const sendBtn = `${baseBtn} ${tw("bg-accent text-surface-1 border-none")}`;
const disabledBtn = tw("opacity-50 cursor-not-allowed");
const hintClass = tw("text-text-muted text-[11px] ml-1");

export default function AnnotationToolbar({
  annotations,
  onClear,
  onSubmit,
  onCancel
}) {
  const total = annotations.length;
  const filled = annotations.filter((a) => a.prompt.trim()).length;
  const canSend = filled > 0;

  return (
    <div
      class={`annotation-toolbar ${toolbarClass}`}
      style={{
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,0.9)",
        border: "1px solid rgba(255,255,255,0.1)"
      }}
    >
      <span class={countClass}>
        {total} annotation{total !== 1 ? "s" : ""}
        {filled > 0 && filled < total && ` (${filled} with prompts)`}
      </span>

      <button
        class={`${clearBtn} ${total === 0 ? disabledBtn : ""}`}
        onClick={onClear}
        disabled={total === 0}
      >
        Clear
      </button>

      <button
        class={`${sendBtn} ${!canSend ? disabledBtn : ""}`}
        onClick={onSubmit}
        disabled={!canSend}
      >
        Send {filled > 0 ? filled : ""} Annotation{filled !== 1 ? "s" : ""}
      </button>

      <span class={hintClass}>Esc to cancel</span>
    </div>
  );
}
