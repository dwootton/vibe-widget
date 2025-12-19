import * as React from "react";
import htm from "htm";

const html = htm.bind(React.createElement);

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

  return html`
    <div class="audit-changes-strip ${pendingCount === 0 ? "compact" : ""}">
      <div class="audit-changes-row">
        <div class="audit-changes-items">
          ${pendingChanges.map((item) => {
            const isEditing = editingBubbleId === item.itemId;
            return html`
              <div
                class="audit-change-pill"
                onMouseEnter=${() => onHoverCard(item.cardId)}
                onMouseLeave=${() => onHoverCard(null)}
                onClick=${() => onStartEdit(item)}
              >
                <span title=${item.label}>${item.label}</span>
                <button
                  class="audit-change-remove"
                  title="Remove"
                  onClick=${(event) => {
                    event.stopPropagation();
                    onRemovePending(item.itemId);
                  }}
                >
                  ×
                </button>
                ${isEditing && html`
                  <div class="audit-bubble-editor">
                    <textarea
                      value=${editingText}
                      onInput=${(event) => onEditingTextChange(event.target.value)}
                      placeholder="Edit what will be sent..."
                    ></textarea>
                    <div class="audit-bubble-editor-actions">
                      <button onClick=${(event) => {
                        event.stopPropagation();
                        onSaveEdit();
                      }}>
                        Save
                      </button>
                    </div>
                  </div>
                `}
              </div>
            `;
          })}
          ${codeChangeRanges.length >= 3 ? html`
            <div
              class="audit-change-pill"
              title=${`Changed: ${codeChangeRanges.map((range) => range[0] === range[1] ? `Line ${range[0]}` : `Lines ${range[0]}-${range[1]}`).join(", ")}`}
            >
              <span>Code changes (${codeChangeRanges.length})</span>
            </div>
          ` : codeChangeRanges.map((range) => {
            const label = range[0] === range[1]
              ? `Line ${range[0]}`
              : `Lines ${range[0]}-${range[1]}`;
            return html`
              <div class="audit-change-pill" title="Source code edits">
                <span>${label}</span>
              </div>
            `;
          })}
        </div>
      </div>
      <div class="audit-changes-row">
        <textarea
          ref=${manualNoteRef}
          class="audit-changes-input"
          placeholder="Add a note for the changes..."
          value=${manualNote}
          onInput=${(event) => {
            onManualNoteChange(event.target.value);
            autoResizeManualNote();
          }}
          onKeyDown=${(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
        ></textarea>
      </div>
      <button
        class="audit-send-button"
        title=${applyTooltip}
        disabled=${pendingCount === 0 && !isDirty && manualNote.trim().length === 0}
        onClick=${onSend}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 14L12 8L18 14" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
  `;
}
