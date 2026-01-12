import React from "react";
import ProgressMap from "./ProgressMap";
import StatePromptInputRow from "./StatePromptInputRow";
import AttachmentStrip from "./AttachmentStrip";
import { tw } from "../styles/setup.js";

const footerClass = tw("flex flex-col gap-2 border-t border-[rgba(242,240,233,0.25)] mt-2 pt-3");
const compactClass = tw("flex flex-col gap-2");

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
  debugLabel = "TerminalViewer",
  compact = false,
  showFooterBorder = true,
  showPrompt = true,
  promptMaxHeight = 200,
  promptAlign,
  promptAutoFocus
}) {
  const resolvedAttachments = attachments || {
    pendingChanges: [],
    codeChangeRanges: [],
    isDirty: false
  };
  const hasAttachments =
    resolvedAttachments.pendingChanges.length > 0 ||
    resolvedAttachments.codeChangeRanges.length > 0 ||
    resolvedAttachments.isDirty;

  const footer = showPrompt ? (
    <div class={showFooterBorder ? footerClass : "flex flex-col gap-2"}>
      {hasAttachments && (
        <AttachmentStrip
          pendingChanges={resolvedAttachments.pendingChanges}
          codeChangeRanges={resolvedAttachments.codeChangeRanges}
          editingBubbleId={resolvedAttachments.editingBubbleId}
          editingText={resolvedAttachments.editingText}
          onStartEdit={resolvedAttachments.onStartEdit}
          onEditingTextChange={resolvedAttachments.onEditingTextChange}
          onSaveEdit={resolvedAttachments.onSaveEdit}
          onRemovePending={resolvedAttachments.onRemovePending}
          onHoverCard={resolvedAttachments.onHoverCard}
          bubbleEditorRef={resolvedAttachments.bubbleEditorRef}
        />
      )}
      <StatePromptInputRow
        value={promptValue}
        onChange={onPromptChange}
        onSubmit={onPromptSubmit}
        disabled={promptDisabled}
        blink={promptBlink}
        maxHeight={promptMaxHeight}
        align={promptAlign}
        autoFocus={promptAutoFocus}
      />
    </div>
  ) : null;

  if (compact) {
    return <div class={compactClass}>{footer}</div>;
  }

  return (
    <div class="flex-1 min-h-0 w-full">
      <ProgressMap
        logs={logs}
        status={status}
        fullHeight={true}
        heading={heading}
        footer={footer}
        debugLabel={debugLabel}
      />
    </div>
  );
}
