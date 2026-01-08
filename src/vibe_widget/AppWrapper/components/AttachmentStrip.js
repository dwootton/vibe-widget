import * as React from "react";
import htm from "htm";

const html = htm.bind(React.createElement);

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
  const pendingCount = pendingChanges.length;

  return html`
    <div class="terminal-attachments">
      <style>
        .terminal-attachments {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .terminal-attachments-row {
          display: flex;
          gap: 8px;
          align-items: center;
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: none;
        }
        .terminal-attachments-row::-webkit-scrollbar {
          width: 0;
          height: 0;
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
      </style>
      <div class="terminal-attachments-row">
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
                <div class="audit-bubble-editor" ref=${bubbleEditorRef}>
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
  `;
}
