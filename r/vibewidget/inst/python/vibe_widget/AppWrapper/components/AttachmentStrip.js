import React from "react";
import { css, tw } from "../styles/setup.js";

const containerClass = tw("flex flex-col gap-[6px] font-mono text-[11px]");
const rowClass = css({
  display: "flex",
  gap: "8px",
  alignItems: "center",
  overflowX: "auto",
  paddingBottom: "2px",
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": {
    width: 0,
    height: 0
  }
});
const pillClass = tw(
  "inline-flex items-center gap-2 bg-[#0b0b0b] border border-[#4b5563] rounded-[2px] px-2 py-[4px] text-[11px] text-[#e5e7eb] max-w-[220px] relative cursor-pointer whitespace-nowrap font-mono"
);
const pillTextClass = tw("overflow-hidden text-ellipsis whitespace-nowrap");
const removeButtonClass = tw(
  "border-none bg-transparent text-[#9aa4b2] cursor-pointer text-[12px] leading-[1] transition-colors duration-150 hover:text-error"
);
const bubbleEditorClass = tw(
  "absolute bottom-[130%] left-0 w-[240px] bg-[#0f141a] border border-[rgba(71,85,105,0.6)] rounded-[10px] p-2 shadow-[0_12px_24px_rgba(0,0,0,0.4)] z-10"
);
const bubbleTextareaClass = tw(
  "w-full min-h-[80px] bg-[#12141d] text-[#e5e7eb] border border-[rgba(71,85,105,0.6)] rounded-[8px] px-2 py-1 font-mono text-[11px] resize-y"
);
const bubbleActionsClass = tw("flex justify-end gap-1 mt-1");
const bubbleButtonClass = tw(
  "bg-[rgba(239,125,69,0.9)] text-[#0b0b0b] border-none rounded-[6px] px-2 py-1 text-[10px] cursor-pointer"
);

export default function AttachmentStrip({
  pendingChanges,
  codeChangeRanges,
  editingBubbleId,
  editingText,
  onStartEdit,
  onEditingTextChange,
  onSaveEdit,
  onRemovePending,
  onHoverCard,
  bubbleEditorRef
}) {
  return (
    <div class={containerClass}>
      <div class={rowClass}>
        {pendingChanges.map((item) => {
          const isEditing = editingBubbleId === item.itemId;
          return (
            <div
              key={item.itemId}
              class={pillClass}
              onMouseEnter={() => onHoverCard(item.cardId)}
              onMouseLeave={() => onHoverCard(null)}
              onClick={() => onStartEdit(item)}
            >
              <span class={pillTextClass} title={item.label}>{item.label}</span>
              <button
                class={removeButtonClass}
                title="Remove"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemovePending(item.itemId);
                }}
              >
                ×
              </button>
              {isEditing && (
                <div class={bubbleEditorClass} ref={bubbleEditorRef}>
                  <textarea
                    class={bubbleTextareaClass}
                    value={editingText}
                    onInput={(event) => onEditingTextChange(event.target.value)}
                    placeholder="Edit what will be sent..."
                  ></textarea>
                  <div class={bubbleActionsClass}>
                    <button
                      class={bubbleButtonClass}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSaveEdit();
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {codeChangeRanges.length >= 3 ? (
          <div
            key="code-change-summary"
            class={pillClass}
            title={`Changed: ${codeChangeRanges
              .map((range) =>
                range[0] === range[1] ? `Line ${range[0]}` : `Lines ${range[0]}-${range[1]}`
              )
              .join(", ")}`}
          >
            <span class={pillTextClass}>Code changes ({codeChangeRanges.length})</span>
          </div>
        ) : (
          codeChangeRanges.map((range, idx) => {
            const label = range[0] === range[1] ? `Line ${range[0]}` : `Lines ${range[0]}-${range[1]}`;
            return (
              <div class={pillClass} title="Source code edits" key={`code-range-${range[0]}-${range[1]}-${idx}`}>
                <span class={pillTextClass}>{label}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
