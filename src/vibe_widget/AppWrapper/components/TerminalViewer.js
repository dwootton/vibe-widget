import * as React from "react";
import htm from "htm";
import ProgressMap from "./ProgressMap";
import StatePromptInputRow from "./StatePromptInputRow";
import AttachmentStrip from "./AttachmentStrip";

const html = htm.bind(React.createElement);

export default function TerminalViewer({
  logs,
  status,
  heading,
  promptValue,
  onPromptChange,
  onPromptSubmit,
  promptDisabled,
  attachments,
  promptBlink = false
}) {
  const hasAttachments = attachments && (
    attachments.pendingChanges.length > 0
    || attachments.codeChangeRanges.length > 0
    || attachments.isDirty
  );

  const footer = html`
    <div class="terminal-footer">
      <style>
        .terminal-footer {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
      </style>
      <${StatePromptInputRow}
        value=${promptValue}
        onChange=${onPromptChange}
        onSubmit=${onPromptSubmit}
        disabled=${promptDisabled}
        blink=${promptBlink}
        maxHeight=${200}
      />
      ${hasAttachments && html`
        <${AttachmentStrip}
          pendingChanges=${attachments.pendingChanges}
          codeChangeRanges=${attachments.codeChangeRanges}
          editingBubbleId=${attachments.editingBubbleId}
          editingText=${attachments.editingText}
          onStartEdit=${attachments.onStartEdit}
          onEditingTextChange=${attachments.onEditingTextChange}
          onSaveEdit=${attachments.onSaveEdit}
          onRemovePending=${attachments.onRemovePending}
          onHoverCard=${attachments.onHoverCard}
          bubbleEditorRef=${attachments.bubbleEditorRef}
        />
      `}
    </div>
  `;

  return html`
    <${ProgressMap}
      logs=${logs}
      status=${status}
      fullHeight=${true}
      heading=${heading}
      footer=${footer}
    />
  `;
}
