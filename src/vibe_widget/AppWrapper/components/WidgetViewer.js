import React, { useState } from "react";

import SandboxedRunner from "./SandboxedRunner";
import FloatingMenu from "./FloatingMenu";
import SelectionOverlay from "./SelectionOverlay";
import EditPromptPanel from "./EditPromptPanel";
import useGrabEdit from "../hooks/useGrabEdit";
import useKeyboardShortcuts from "../hooks/useKeyboardShortcuts";
import { debugLog } from "../utils/debug";

let widgetViewerCounter = 0;

export default function WidgetViewer({
  model,
  code,
  containerBounds,
  onViewSource,
  highAuditCount
}) {
  const instanceId = React.useRef(++widgetViewerCounter).current;
  debugLog(model, "[vibe][debug] WidgetViewer render", { instanceId, codeLen: code?.length });

  const [isMenuOpen, setMenuOpen] = useState(false);
  const { grabMode, promptCache, startGrab, selectElement, submitEdit, cancelEdit } = useGrabEdit(model);
  const hasCode = code && code.length > 0;

  const handleGrabStart = () => {
    setMenuOpen(false);
    startGrab();
  };

  useKeyboardShortcuts({ isLoading: false, hasCode, grabMode, onGrabStart: handleGrabStart });

  return (
    <div style={{ width: "100%", height: "100%" }}>
      {hasCode && <SandboxedRunner code={code} model={model} runKey={0} />}

      {hasCode && (
        <FloatingMenu
          isOpen={isMenuOpen}
          onToggle={() => setMenuOpen(!isMenuOpen)}
          onGrabModeStart={handleGrabStart}
          onViewSource={() => {
            setMenuOpen(false);
            onViewSource();
          }}
          highAuditCount={highAuditCount}
          isEditMode={!!grabMode}
        />
      )}

      {grabMode === "selecting" && (
        <SelectionOverlay onElementSelect={selectElement} onCancel={cancelEdit} />
      )}

      {grabMode && grabMode !== "selecting" && (
        <EditPromptPanel
          elementBounds={grabMode.bounds}
          containerBounds={containerBounds}
          elementDescription={grabMode.element}
          initialPrompt={promptCache[grabMode.elementKey] || ""}
          onSubmit={submitEdit}
          onCancel={cancelEdit}
        />
      )}
    </div>
  );
}
