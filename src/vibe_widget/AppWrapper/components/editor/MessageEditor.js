import React from "react";

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
    <div class={`audit-changes-strip ${pendingCount === 0 ? "compact" : ""}`}>
      <style>{`
        .audit-changes-strip {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .audit-changes-row {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .audit-changes-items {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .audit-change-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #0b0b0b;
          border: 1px solid #4b5563;
          border-radius: 6px;
          padding: 6px 10px;
          color: #e5e7eb;
          font-size: 11px;
          max-width: 220px;
          position: relative;
          cursor: pointer;
          white-space: nowrap;
        }
        .audit-change-pill span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .audit-change-remove {
          border: none;
          background: transparent;
          color: #9aa4b2;
          cursor: pointer;
          font-size: 12px;
          line-height: 1;
        }
        .audit-change-remove:hover {
          color: #f87171;
        }
        .audit-bubble-editor {
          position: absolute;
          bottom: 130%;
          left: 0;
          width: 240px;
          background: #0f141a;
          border: 1px solid rgba(71, 85, 105, 0.6);
          border-radius: 10px;
          padding: 8px;
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
          z-index: 10;
        }
        .audit-bubble-editor textarea {
          width: 100%;
          min-height: 80px;
          background: #12141d;
          color: #e5e7eb;
          border: 1px solid rgba(71, 85, 105, 0.6);
          border-radius: 8px;
          padding: 6px;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 11px;
          resize: vertical;
        }
        .audit-bubble-editor-actions {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
          margin-top: 6px;
        }
        .audit-bubble-editor button {
          background: rgba(239, 125, 69, 0.9);
          color: #0b0b0b;
          border: none;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 10px;
          cursor: pointer;
        }
        .audit-changes-input {
          flex: 1;
          min-height: 60px;
          background: #0b0b0b;
          color: #e5e7eb;
          border: 1px solid #4b5563;
          border-radius: 6px;
          padding: 8px;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          resize: vertical;
        }
        .audit-send-button {
          align-self: flex-start;
          background: rgba(239, 125, 69, 0.9);
          color: #0b0b0b;
          border: none;
          border-radius: 8px;
          padding: 8px 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .audit-send-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
      <div class="audit-changes-row">
        <div class="audit-changes-items">
          {pendingChanges.map((item) => {
            const isEditing = editingBubbleId === item.itemId;
            return (
              <div
                class="audit-change-pill"
                onMouseEnter={() => onHoverCard(item.cardId)}
                onMouseLeave={() => onHoverCard(null)}
                onClick={() => onStartEdit(item)}
              >
                <span title={item.label}>{item.label}</span>
                <button
                  class="audit-change-remove"
                  title="Remove"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemovePending(item.itemId);
                  }}
                >
                  ×
                </button>
                {isEditing && (
                  <div class="audit-bubble-editor">
                    <textarea
                      value={editingText}
                      onInput={(event) => onEditingTextChange(event.target.value)}
                      placeholder="Edit what will be sent..."
                    ></textarea>
                    <div class="audit-bubble-editor-actions">
                      <button
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
                class="audit-change-pill"
                title={`Changed: ${codeChangeRanges
                  .map((range) =>
                    range[0] === range[1] ? `Line ${range[0]}` : `Lines ${range[0]}-${range[1]}`
                  )
                  .join(", ")}`}
              >
                <span>Code changes ({codeChangeRanges.length})</span>
              </div>
            ) : (
              codeChangeRanges.map((range) => {
                const label = range[0] === range[1] ? `Line ${range[0]}` : `Lines ${range[0]}-${range[1]}`;
                return (
                  <div class="audit-change-pill" title="Source code edits">
                    <span>{label}</span>
                  </div>
                );
              })
            ))}
        </div>
      </div>
      <div class="audit-changes-row">
        <textarea
          ref={manualNoteRef}
          class="audit-changes-input"
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
        class="audit-send-button"
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
