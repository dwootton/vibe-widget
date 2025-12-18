import * as React from "https://esm.sh/react@18";
import { createRoot } from "https://esm.sh/react-dom@18/client";
import htm from "https://esm.sh/htm@3";

import { ensureGlobalStyles } from "./utils/styles";
import SandboxedRunner from "./components/SandboxedRunner";
import FloatingMenu from "./components/FloatingMenu";
import LoadingOverlay from "./components/LoadingOverlay";
import SelectionOverlay from "./components/SelectionOverlay";
import EditPromptPanel from "./components/EditPromptPanel";
import useModelSync from "./hooks/useModelSync";
import useKeyboardShortcuts from "./hooks/useKeyboardShortcuts";

const html = htm.bind(React.createElement);

ensureGlobalStyles();

function AppWrapper({ model }) {
  const { status, logs, code } = useModelSync(model);
  const [isMenuOpen, setMenuOpen] = React.useState(false);
  const [grabMode, setGrabMode] = React.useState(null);
  const [promptCache, setPromptCache] = React.useState({});

  const handleGrabStart = () => {
    setMenuOpen(false);
    setGrabMode("selecting");
  };

  const handleElementSelect = (elementDescription, elementBounds) => {
    const elementKey = `${elementDescription.tag}-${elementDescription.classes}-${elementDescription.text?.slice(0, 20)}`;
    setGrabMode({ element: elementDescription, bounds: elementBounds, elementKey });
  };

  const handleEditSubmit = (prompt) => {
    model.set("grab_edit_request", {
      element: grabMode.element,
      prompt: prompt,
    });
    model.save_changes();
    setPromptCache((prev) => ({ ...prev, [grabMode.elementKey]: prompt }));
    setGrabMode(null);
  };

  const handleCancel = (currentPrompt) => {
    if (grabMode?.elementKey && currentPrompt) {
      setPromptCache((prev) => ({ ...prev, [grabMode.elementKey]: currentPrompt }));
    }
    setGrabMode(null);
  };

  const isLoading = status === "generating";
  const hasCode = code && code.length > 0;

  useKeyboardShortcuts({ isLoading, hasCode, grabMode, onGrabStart: handleGrabStart });

  return html`
    <div class="vibe-container" style=${{ position: "relative", width: "100%" }}>
      ${hasCode && html`
        <div style=${{
          opacity: isLoading ? 0.4 : 1,
          pointerEvents: isLoading ? "none" : "auto",
          transition: "opacity 0.3s ease",
        }}>
          <${SandboxedRunner} code=${code} model=${model} />
        </div>
      `}
      
      ${isLoading && html`
        <${LoadingOverlay} 
          logs=${logs} 
          hasExistingWidget=${hasCode}
        />
      `}
      
      ${!isLoading && hasCode && html`
        <${FloatingMenu} 
          isOpen=${isMenuOpen} 
          onToggle=${() => setMenuOpen(!isMenuOpen)}
          onGrabModeStart=${handleGrabStart}
          isEditMode=${!!grabMode}
        />
      `}
        
      ${grabMode === "selecting" && html`
        <${SelectionOverlay} 
          onElementSelect=${handleElementSelect}
          onCancel=${handleCancel}
        />
      `}
      
      ${grabMode && grabMode !== "selecting" && html`
        <${EditPromptPanel}
          elementBounds=${grabMode.bounds}
          elementDescription=${grabMode.element}
          initialPrompt=${promptCache[grabMode.elementKey] || ""}
          onSubmit=${handleEditSubmit}
          onCancel=${handleCancel}
        />
      `}
    </div>
  `;
}

let rootInstance = null;

function render({ model, el }) {
  if (!rootInstance) {
    rootInstance = createRoot(el);
  }
  rootInstance.render(html`<${AppWrapper} model=${model} />`);
}

export default { render };
