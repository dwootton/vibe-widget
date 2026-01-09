import React from "react";
import ProgressMap from "./ProgressMap";
import StatePromptInputRow from "./StatePromptInputRow";
import AttachmentStrip from "./AttachmentStrip";
import { tw } from "../styles/setup.js";

const footerClass = tw("flex flex-col gap-2 border-t border-[rgba(242,240,233,0.25)] mt-2 pt-3");

export default function TerminalViewer({
  logs,
  status,
  heading,
  promptValue,
  onPromptChange,
  onPromptSubmit,
  promptDisabled,
  attachments,
  promptBlink = false,
  debugLabel = "TerminalViewer"
}) {
  const hasAttachments =
    attachments &&
    (attachments.pendingChanges.length > 0 ||
      attachments.codeChangeRanges.length > 0 ||
      attachments.isDirty);

  const footer = (
    <div class={footerClass}>
      {hasAttachments && (
        <AttachmentStrip
          pendingChanges={attachments.pendingChanges}
          codeChangeRanges={attachments.codeChangeRanges}
          editingBubbleId={attachments.editingBubbleId}
          editingText={attachments.editingText}
          onStartEdit={attachments.onStartEdit}
          onEditingTextChange={attachments.onEditingTextChange}
          onSaveEdit={attachments.onSaveEdit}
          onRemovePending={attachments.onRemovePending}
          onHoverCard={attachments.onHoverCard}
          bubbleEditorRef={attachments.bubbleEditorRef}
        />
      )}
      <StatePromptInputRow
        value={promptValue}
        onChange={onPromptChange}
        onSubmit={onPromptSubmit}
        disabled={promptDisabled}
        blink={promptBlink}
        maxHeight={200}
      />
    </div>
  );

  return (
    <ProgressMap
      logs={logs}
      status={status}
      fullHeight={true}
      heading={heading}
      footer={footer}
      debugLabel={debugLabel}
    />
  );
}
