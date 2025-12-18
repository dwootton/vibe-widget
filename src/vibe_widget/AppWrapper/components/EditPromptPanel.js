import * as React from "https://esm.sh/react@18";
import htm from "https://esm.sh/htm@3";

const html = htm.bind(React.createElement);

export default function EditPromptPanel({ elementBounds, elementDescription, initialPrompt, onSubmit, onCancel }) {
  const [prompt, setPrompt] = React.useState(initialPrompt || "");
  const panelRef = React.useRef(null);
  const textareaRef = React.useRef(null);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const [textareaHeight, setTextareaHeight] = React.useState(40);
  const [panelHovered, setPanelHovered] = React.useState(false);
  const [buttonHovered, setButtonHovered] = React.useState(false);

  const PANEL_WIDTH = 320;
  const MIN_TEXTAREA_HEIGHT = 40;
  const MAX_TEXTAREA_HEIGHT = 288;
  const LINE_HEIGHT = 24;
  const PADDING = 12;
  const GAP = 8;
  
  const getButtonOpacity = () => {
    if (buttonHovered) return 1;
    if (panelHovered) return 0.3;
    return 0.1;
  };

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onCancel(prompt);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onCancel, prompt]);

  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = MIN_TEXTAREA_HEIGHT + "px";
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT);
      setTextareaHeight(newHeight);
      textareaRef.current.style.height = newHeight + "px";
    }
  }, [prompt]);

  React.useEffect(() => {
    if (!elementBounds) return;

    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const panelHeight = textareaHeight + 56;

    const elCenterX = elementBounds.left + elementBounds.width / 2;
    const elCenterY = elementBounds.top + elementBounds.height / 2;

    let top = elementBounds.bottom + GAP;
    let left = elCenterX - PANEL_WIDTH / 2;

    if (top + panelHeight + PADDING > viewport.height) {
      top = elementBounds.top - panelHeight - GAP;
    }

    if (top < PADDING) {
      top = Math.max(PADDING, elCenterY - panelHeight / 2);
      if (elementBounds.right + GAP + PANEL_WIDTH + PADDING < viewport.width) {
        left = elementBounds.right + GAP;
      } else {
        left = elementBounds.left - PANEL_WIDTH - GAP;
      }
    }

    left = Math.max(PADDING, Math.min(left, viewport.width - PANEL_WIDTH - PADDING));
    top = Math.max(PADDING, Math.min(top, viewport.height - panelHeight - PADDING));

    setPosition({ top, left });
  }, [elementBounds, textareaHeight]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        e.stopPropagation();
      } else if (prompt.trim()) {
        e.preventDefault();
        e.stopPropagation();
        onSubmit(prompt);
      }
    } else if (e.key === "Escape") {
      onCancel(prompt);
    }
  };

  return html`
    <div>
      ${elementBounds && html`
        <div class="selected-element-highlight" style=${{
          position: "fixed",
          left: elementBounds.left + "px",
          top: elementBounds.top + "px",
          width: elementBounds.width + "px",
          height: elementBounds.height + "px",
          outline: "2px solid #f97316",
          outlineOffset: "0px",
          background: "rgba(249, 115, 22, 0.1)",
          borderRadius: "2px",
          pointerEvents: "none",
          zIndex: 10000,
          boxSizing: "border-box",
        }}>
          ${elementDescription?.tag && html`
            <div style=${{
              position: "absolute",
              top: "-18px",
              left: "-2px",
              background: "#f97316",
              color: "white",
              fontSize: "10px",
              fontWeight: 600,
              padding: "1px 5px",
              borderRadius: "3px 3px 0 0",
              whiteSpace: "nowrap",
              fontFamily: "ui-monospace, monospace",
            }}>
              ${elementDescription.tag.toLowerCase()}
            </div>
          `}
        </div>
      `}
      <div 
        ref=${panelRef}
        class="edit-panel" 
        onMouseEnter=${() => setPanelHovered(true)}
        onMouseLeave=${() => setPanelHovered(false)}
        style=${{
        position: "fixed",
        top: position.top + "px",
        left: position.left + "px",
        width: PANEL_WIDTH + "px",
        background: "rgba(26, 26, 26, 0.95)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: "10px",
        padding: "8px",
        zIndex: 10001,
        backdropFilter: "blur(8px)",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
      >
        <div style=${{ position: "relative", width: "100%" }}>
          <textarea
            ref=${textareaRef}
            value=${prompt}
            onInput=${(e) => setPrompt(e.target.value)}
            onKeyDown=${handleKeyDown}
            placeholder="What would you like to change?"
            rows="1"
            style=${{
          width: "100%",
          minHeight: MIN_TEXTAREA_HEIGHT + "px",
          maxHeight: MAX_TEXTAREA_HEIGHT + "px",
          padding: "10px 50px 10px 12px",
          borderRadius: "6px",
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.05)",
          color: "white",
          fontSize: "13px",
          lineHeight: "20px",
          outline: "none",
          resize: "none",
          overflowY: textareaHeight >= MAX_TEXTAREA_HEIGHT ? "auto" : "hidden",
          boxSizing: "border-box",
          fontFamily: "inherit",
        }}
            autoFocus
          />
          <button 
            onClick=${() => prompt.trim() ? onSubmit(prompt) : onCancel(prompt)} 
            onMouseEnter=${() => setButtonHovered(true)}
            onMouseLeave=${() => setButtonHovered(false)}
            style=${{
          position: "absolute",
          top: "6px",
          right: textareaHeight >= MAX_TEXTAREA_HEIGHT ? "16px" : "8px",
          width: "28px",
          height: "28px",
          borderRadius: "6px",
          background: prompt.trim()
            ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            : "rgba(255,255,255,0.15)",
          color: "white",
          border: "none",
          cursor: "pointer",
          fontSize: "14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "opacity 0.2s, background 0.2s",
          padding: 0,
          opacity: getButtonOpacity(),
        }}
            title=${prompt.trim() ? "Send (Enter)" : "Cancel (Esc)"}
          >
            ${prompt.trim() ? html`
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            ` : html`
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            `}
          </button>
        </div>
        <div style=${{
          fontSize: "11px",
          color: "rgba(255,255,255,0.4)",
          paddingLeft: "4px",
        }}>
          Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  `;
}
