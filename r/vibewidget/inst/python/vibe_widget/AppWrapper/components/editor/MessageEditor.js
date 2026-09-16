import React from "react";
import { tw } from "../../styles/setup.js";

const containerClass = tw("flex flex-col gap-2");
const rowClass = tw("flex flex-wrap gap-2 items-center");
const itemsClass = tw("flex flex-wrap gap-2 items-center");
const pillClass = tw(
  "inline-flex items-center gap-2 bg-[#0b0b0b] border border-[#4b5563] rounded-[6px] px-[10px] py-[6px] text-[11px] text-[#e5e7eb] max-w-[220px] relative cursor-pointer whitespace-nowrap"
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
const inputClass = tw(
  "flex-1 min-h-[60px] bg-[#0b0b0b] text-[#e5e7eb] border border-[#4b5563] rounded-[6px] px-2 py-2 font-mono text-[12px] resize-y"
);
const sendButtonClass = tw(
  "self-start bg-[rgba(239,125,69,0.9)] text-[#0b0b0b] border-none rounded-[8px] px-3 py-2 inline-flex items-center justify-center cursor-pointer transition-opacity duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
);

export default function MessageEditor({
  pendingChanges,
  codeChangeRanges,
  manualNote,
  onManualNoteChange,
  onSend,
  onRemovePending,
  onStartEdit,
  editingBubbleId,
  editingText,
  onEditingTextChange,
  onSaveEdit,
  onHoverCard,
  manualNoteRef,
  autoResizeManualNote,
  applyTooltip,
  isDirty
}) {
  const pendingCount = pendingChanges.length;
  const hasCodeChanges = codeChangeRanges.length > 0;

  return (
    <div class={containerClass}>
      <div class={rowClass}>
        <div class={itemsClass}>
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
                  <div class={bubbleEditorClass}>
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
          {hasCodeChanges &&
            (codeChangeRanges.length >= 3 ? (
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
              codeChangeRanges.map((range, index) => {
                const label = range[0] === range[1] ? `Line ${range[0]}` : `Lines ${range[0]}-${range[1]}`;
                return (
                  <div
                    key={`code-range-${range[0]}-${range[1]}-${index}`}
                    class={pillClass}
                    title="Source code edits"
                  >
                    <span class={pillTextClass}>{label}</span>
                  </div>
                );
              })
            ))}
        </div>
      </div>
      <div class={rowClass}>
        <textarea
          ref={manualNoteRef}
          class={inputClass}
          placeholder="Add a note for the changes..."
          value={manualNote}
          onInput={(event) => {
            onManualNoteChange(event.target.value);
            autoResizeManualNote();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
        ></textarea>
      </div>
      <button
        class={sendButtonClass}
        title={applyTooltip}
        disabled={pendingCount === 0 && !isDirty && manualNote.trim().length === 0}
        onClick={onSend}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 14L12 8L18 14" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
  );
}
