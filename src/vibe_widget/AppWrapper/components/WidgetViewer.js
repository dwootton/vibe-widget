import * as React from "react";
import htm from "htm";

import SandboxedRunner from "./SandboxedRunner";
import FloatingMenu from "./FloatingMenu";
import SelectionOverlay from "./SelectionOverlay";
import EditPromptPanel from "./EditPromptPanel";
import useGrabEdit from "../hooks/useGrabEdit";
import useKeyboardShortcuts from "../hooks/useKeyboardShortcuts";

const html = htm.bind(React.createElement);

export default function WidgetViewer({
  model,
  code,
  containerBounds,
  onViewSource,
  highAuditCount
}) {
  const [isMenuOpen, setMenuOpen] = React.useState(false);
  const {
    grabMode,
    promptCache,
    startGrab,
    selectElement,
    submitEdit,
    cancelEdit
  } = useGrabEdit(model);
  const hasCode = code && code.length > 0;
  const handleGrabStart = () => {
    setMenuOpen(false);
    startGrab();
  };

  useKeyboardShortcuts({ isLoading: false, hasCode, grabMode, onGrabStart: handleGrabStart });

  return html`
    <div style=${{ width: "100%", height: "100%" }}>
      ${hasCode && html`
        <${SandboxedRunner} code=${code} model=${model} runKey=${0} />
      `}

      ${hasCode && html`
        <${FloatingMenu}
          isOpen=${isMenuOpen}
          onToggle=${() => setMenuOpen(!isMenuOpen)}
          onGrabModeStart=${handleGrabStart}
          onViewSource=${() => {
            setMenuOpen(false);
            onViewSource();
          }}
          highAuditCount=${highAuditCount}
          isEditMode=${!!grabMode}
        />
      `}

      ${grabMode === "selecting" && html`
        <${SelectionOverlay}
          onElementSelect=${selectElement}
          onCancel=${cancelEdit}
        />
      `}

      ${grabMode && grabMode !== "selecting" && html`
        <${EditPromptPanel}
          elementBounds=${grabMode.bounds}
          containerBounds=${containerBounds}
          elementDescription=${grabMode.element}
          initialPrompt=${promptCache[grabMode.elementKey] || ""}
          onSubmit=${submitEdit}
          onCancel=${cancelEdit}
        />
      `}
    </div>
  `;
}
