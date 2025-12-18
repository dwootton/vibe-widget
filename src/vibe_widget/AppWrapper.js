// src/vibe_widget/AppWrapper/AppWrapper.js
import * as React9 from "https://esm.sh/react@18";
import { createRoot } from "https://esm.sh/react-dom@18/client";
import htm7 from "https://esm.sh/htm@3";

// src/vibe_widget/AppWrapper/utils/styles.ts
function ensureGlobalStyles() {
  if (document.querySelector("#vibe-widget-global-styles")) return;
  const globalStyles = document.createElement("style");
  globalStyles.id = "vibe-widget-global-styles";
  globalStyles.textContent = `
  .cell-output-ipywidget-background {
    background: transparent !important;
  }
  .jp-OutputArea-output {
    background: transparent !important;
  }
`;
  document.head.appendChild(globalStyles);
}

// src/vibe_widget/AppWrapper/components/SandboxedRunner.js
import * as React from "https://esm.sh/react@18";
import htm from "https://esm.sh/htm@3";
var html = htm.bind(React.createElement);
function getErrorSuggestion(errMessage) {
  if (errMessage.includes("is not a function") || errMessage.includes("Cannot read")) {
    return "Library import error. Check CDN URL and import syntax.";
  }
  if (errMessage.includes("Failed to fetch")) {
    return "Network error loading library. Check internet connection.";
  }
  if (errMessage.includes("Unexpected token")) {
    return "Syntax error in generated code.";
  }
  return "";
}
function SandboxedRunner({ code, model }) {
  const [error, setError] = React.useState(null);
  const [GuestWidget, setGuestWidget] = React.useState(null);
  const [isRetrying, setIsRetrying] = React.useState(false);
  const containerRef = React.useRef(null);
  React.useEffect(() => {
    if (!code) return;
    const executeCode = async () => {
      try {
        setIsRetrying(false);
        const blob = new Blob([code], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);
        const module = await import(url);
        URL.revokeObjectURL(url);
        if (module.default && typeof module.default === "function") {
          setGuestWidget(() => module.default);
          setError(null);
          model.set("error_message", "");
          model.save_changes();
        } else {
          throw new Error("Generated code must export a default function");
        }
      } catch (err) {
        console.error("Code execution error:", err);
        const retryCount = model.get("retry_count") || 0;
        if (retryCount < 2) {
          setIsRetrying(true);
          const errorDetails = err.toString() + "\n\nStack:\n" + (err.stack || "No stack trace");
          model.set("error_message", errorDetails);
          model.save_changes();
          return;
        }
        const suggestion = getErrorSuggestion(err.message || "");
        setError(suggestion ? `${err.message}

Suggestion: ${suggestion}` : err.message);
      }
    };
    executeCode();
  }, [code, model]);
  React.useEffect(() => {
    if (!GuestWidget) return;
    let cancelled = false;
    let triggered = false;
    const start = performance.now();
    const validateSize = () => {
      if (cancelled || triggered) return;
      const rect = containerRef.current?.getBoundingClientRect();
      const hasSize = rect && rect.width > 0 && rect.height > 0;
      if (hasSize) return;
      if (performance.now() - start < 1200) {
        requestAnimationFrame(validateSize);
        return;
      }
      triggered = true;
      const retryCount = model.get("retry_count") || 0;
      const message = `Widget rendered with zero size (width=${rect?.width ?? 0}, height=${rect?.height ?? 0}). Treating as failure.`;
      if (retryCount < 2) {
        setIsRetrying(true);
        model.set("error_message", message);
        model.save_changes();
      } else {
        setError(message);
      }
    };
    requestAnimationFrame(validateSize);
    return () => {
      cancelled = true;
    };
  }, [GuestWidget, code, model]);
  if (isRetrying) {
    return html`
      <div style=${{ padding: "20px", color: "#ffa07a", fontSize: "14px" }}>
        Error detected. Asking LLM to fix...
      </div>
    `;
  }
  if (error) {
    return html`
      <div style=${{
      padding: "20px",
      background: "#3c1f1f",
      color: "#ff6b6b",
      borderRadius: "6px",
      fontFamily: "monospace",
      whiteSpace: "pre-wrap"
    }}>
        <strong>Error (after 2 retry attempts):</strong> ${error}
        <div style=${{ marginTop: "16px", fontSize: "12px", color: "#ffa07a" }}>
          Check browser console for full stack trace
        </div>
      </div>
    `;
  }
  if (!GuestWidget) {
    return html`
      <div style=${{ padding: "20px", color: "#8b949e" }}>
        Loading widget...
      </div>
    `;
  }
  return html`
    <div ref=${containerRef} style=${{ width: "100%", minHeight: "1px" }}>
      <${GuestWidget} model=${model} html=${html} React=${React} />
    </div>
  `;
}

// src/vibe_widget/AppWrapper/components/FloatingMenu.js
import * as React2 from "https://esm.sh/react@18";
import htm2 from "https://esm.sh/htm@3";
var html2 = htm2.bind(React2.createElement);
function FloatingMenu({ isOpen, onToggle, onGrabModeStart, isEditMode }) {
  return html2`
    <div class="floating-menu-container">
      <style>
        .floating-menu-container {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 1000;
        }
        .menu-dot {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: #f97316;
          cursor: pointer;
          display: flex;
          align-items: center;
          justifyContent: center;
          box-shadow: 0 2px 8px rgba(249, 115, 22, 0.3);
          transition: all 0.3s ease;
        }
        .menu-dot:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 16px rgba(249, 115, 22, 0.5);
        }
        .menu-dot.spinning {
          animation: spin 2s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .menu-dot-inner {
          width: 6px;
          height: 6px;
          border-radius: 2px;
          background: white;
        }
        .menu-options {
          position: absolute;
          top: 36px;
          right: 0;
          background: #1e1e1e;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 8px;
          min-width: 150px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }
        .menu-option {
          padding: 8px 12px;
          color: #e0e0e0;
          cursor: pointer;
          border-radius: 4px;
          font-size: 13px;
          transition: background 0.2s;
        }
        .menu-option:hover {
          background: #2a2a2a;
        }
        .menu-option.disabled {
          color: #666;
          cursor: not-allowed;
        }
      </style>
      
      <div class="menu-dot ${isEditMode ? "spinning" : ""}" onClick=${onToggle}>
        <div class="menu-dot-inner"></div>
      </div>
      
      ${isOpen && html2`
        <div class="menu-options">
          <div class="menu-option" onClick=${onGrabModeStart}>Edit Element</div>
          <div class="menu-option disabled">Export (Coming Soon)</div>
          <div class="menu-option disabled">View Source</div>
        </div>
      `}
    </div>
  `;
}

// src/vibe_widget/AppWrapper/components/LoadingOverlay.js
import * as React4 from "https://esm.sh/react@18";
import htm4 from "https://esm.sh/htm@3";

// src/vibe_widget/AppWrapper/components/ProgressMap.js
import * as React3 from "https://esm.sh/react@18";
import htm3 from "https://esm.sh/htm@3";
var html3 = htm3.bind(React3.createElement);
var SPINNER_FRAMES = ["/", "-", "\\", "|"];
var SPINNER_INTERVAL_MS = 120;
function ProgressMap({ logs }) {
  const containerRef = React3.useRef(null);
  const [spinnerFrame, setSpinnerFrame] = React3.useState(0);
  React3.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);
  React3.useEffect(() => {
    if (!logs || logs.length === 0) return;
    const interval = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, SPINNER_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [logs]);
  const sanitizeLogText = (log) => {
    const upper = String(log ?? "").toUpperCase();
    return upper.replace(/[.\u2026]+$/g, "").trimEnd();
  };
  return html3`
    <div class="progress-wrapper">
      <style>
        .progress-wrapper {
          position: relative;
          padding: 12px;
          background: transparent;
        }
        
        .progress-bezel {
          border-radius: 6px;
          background: #1A1A1A;
          border: 3px solid #F2F0E9;
          box-shadow: inset 0px 2px 4px rgba(0, 0, 0, 0.5);
        }
        
        .progress-heading {
          padding: 10px 12px 0;
          color: #F2F0E9;
          font-family: "Inter", "JetBrains Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 13px;
          letter-spacing: 0.02em;
        }
        
        .progress-container {
          width: 100%;
          max-height: 280px;
          padding: 10px 12px;
          background: transparent;
          color: #F2F0E9;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          line-height: 1.4;
          overflow-y: auto;
        }
        
        .progress-container::-webkit-scrollbar {
          width: 4px;
        }
        
        .progress-container::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .progress-container::-webkit-scrollbar-thumb {
          background: rgba(243, 119, 38, 0.3);
          border-radius: 2px;
        }
        
        .progress-container::-webkit-scrollbar-thumb:hover {
          background: rgba(243, 119, 38, 0.5);
        }
        
        .log-entry {
          display: flex;
          align-items: baseline;
          gap: 8px;
          padding: 2px 0;
          color: #D1D5DB;
          opacity: 0;
          animation: fadeIn 0.3s ease-out forwards;
          animation-delay: calc(var(--entry-index) * 0.03s);
          white-space: pre-wrap;
          word-break: break-word;
        }

        .log-icon {
          width: 14px;
          flex: 0 0 14px;
          color: #6B7280;
        }

        .log-icon--active {
          color: #f97316;
        }

        .log-entry--done .log-text {
          text-transform: uppercase;
          color: #D1D5DB;
        }

        .log-entry--active .log-text {
          background: #f97316;
          color: #000000;
          padding: 1px 4px;
          text-transform: uppercase;
          display: inline-block;
        }

        .cursor {
          display: inline-block;
          margin-left: 4px;
          animation: cursorBlink 1s steps(2, end) infinite;
        }

        @keyframes cursorBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }

        @keyframes fadeIn {
          to {
            opacity: 1;
          }
        }
      </style>
      <div class="progress-bezel">
        <div class="progress-heading">
          Welcome to Vibe Widgets32!
        </div>
        <div class="progress-container" ref=${containerRef}>
          ${logs.map((log, idx) => {
    const isActive = idx === logs.length - 1;
    const icon = isActive ? SPINNER_FRAMES[spinnerFrame] : "\u25A0";
    const text = sanitizeLogText(log);
    return html3`
              <div
                key=${idx}
                class=${`log-entry ${isActive ? "log-entry--active" : "log-entry--done"}`}
                style=${{ "--entry-index": idx }}
              >
                <span class=${`log-icon ${isActive ? "log-icon--active" : ""}`}>${icon}</span>
                <span class="log-text">
                  ${text}${isActive && html3`<span class="cursor">█</span>`}
                </span>
              </div>
            `;
  })}
        </div>
      </div>
    </div>
  `;
}

// src/vibe_widget/AppWrapper/components/LoadingOverlay.js
var html4 = htm4.bind(React4.createElement);
function LoadingOverlay({ logs, hasExistingWidget }) {
  if (hasExistingWidget) {
    return html4`
      <div class="loading-overlay" style=${{
      position: "absolute",
      inset: 0,
      background: "rgba(0, 0, 0, 0.6)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1e3,
      backdropFilter: "blur(3px)"
    }}>
        <div style=${{
      width: "90%",
      maxWidth: "500px"
    }}>
          <${ProgressMap} logs=${logs} />
        </div>
      </div>
    `;
  }
  return html4`<${ProgressMap} logs=${logs} />`;
}

// src/vibe_widget/AppWrapper/components/SelectionOverlay.js
import * as React5 from "https://esm.sh/react@18";
import htm5 from "https://esm.sh/htm@3";

// src/vibe_widget/AppWrapper/utils/dom.ts
function isElementVisible(element, computedStyle) {
  if (!computedStyle) computedStyle = window.getComputedStyle(element);
  if (computedStyle.visibility === "hidden") return false;
  if (computedStyle.display === "none") return false;
  if (parseFloat(computedStyle.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  return true;
}
function isValidGrabbableElement(element) {
  if (!(element instanceof Element)) return false;
  if (element.closest(".grab-overlay")) return false;
  if (element.closest(".edit-panel")) return false;
  if (element.closest(".loading-overlay")) return false;
  const skipTags = ["SCRIPT", "STYLE", "LINK", "META", "HEAD", "HTML", "BODY", "DEFS", "CLIPPATH"];
  if (skipTags.includes(element.tagName)) return false;
  const computedStyle = window.getComputedStyle(element);
  if (!isElementVisible(element, computedStyle)) return false;
  const isSVGElement = element instanceof SVGElement;
  if (!isSVGElement && computedStyle.pointerEvents === "none") return false;
  const meaningfulTags = [
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "P",
    "SPAN",
    "A",
    "BUTTON",
    "IMG",
    "SVG",
    "RECT",
    "CIRCLE",
    "PATH",
    "LINE",
    "TEXT",
    "G",
    "CANVAS",
    "VIDEO",
    "TABLE",
    "TH",
    "TD",
    "LI",
    "LABEL",
    "INPUT",
    "POLYGON",
    "POLYLINE",
    "ELLIPSE"
  ];
  const hasMeaningfulTag = meaningfulTags.includes(element.tagName);
  const hasClass = element.classList.length > 0;
  const hasText = element.textContent?.trim().length > 0;
  return hasMeaningfulTag || hasClass || hasText || isSVGElement;
}
function getElementAtPosition(clientX, clientY) {
  const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
  for (const element of elementsAtPoint) {
    if (isValidGrabbableElement(element)) {
      return element;
    }
  }
  return null;
}
function describeElement(el) {
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList).join(" ");
  const text = el.textContent?.trim().substring(0, 50);
  const ancestors = getAncestorPath(el);
  const siblingCount = el.parentElement ? Array.from(el.parentElement.children).filter((sibling) => sibling.tagName === el.tagName).length : 1;
  let attrs = "";
  if (el instanceof SVGElement) {
    attrs = ["fill", "stroke", "d", "cx", "cy", "r", "x", "y", "width", "height"].map((a) => {
      const val = el.getAttribute(a);
      return val ? `${a}="${val.substring(0, 30)}"` : "";
    }).filter(Boolean).join(" ");
  }
  const computedStyle = window.getComputedStyle(el);
  const styleHints = {
    color: computedStyle.color,
    backgroundColor: computedStyle.backgroundColor,
    fill: computedStyle.fill
  };
  return {
    tag,
    classes,
    text: text || null,
    attributes: attrs || null,
    ancestors,
    siblingCount,
    isDataBound: siblingCount > 1,
    styleHints,
    description: `<${tag}${classes ? ` class="${classes}"` : ""}${attrs ? ` ${attrs}` : ""}>${text || ""}</${tag}>`
  };
}
function getAncestorPath(el, depth = 3) {
  const path = [];
  let current = el.parentElement;
  while (current && path.length < depth) {
    const className = typeof current.className === "string" ? current.className : (
      // @ts-ignore SVGAnimatedString for SVG elements
      current.className?.baseVal || ""
    );
    if (current.tagName !== "DIV" || className) {
      path.push(`${current.tagName.toLowerCase()}${className ? "." + className.split(" ")[0] : ""}`);
    }
    current = current.parentElement;
  }
  return path.reverse().join(" > ");
}

// src/vibe_widget/AppWrapper/components/SelectionOverlay.js
var html5 = htm5.bind(React5.createElement);
function SelectionOverlay({ onElementSelect, onCancel }) {
  const [hoveredEl, setHoveredEl] = React5.useState(null);
  const [bounds, setBounds] = React5.useState(null);
  const [tagName, setTagName] = React5.useState(null);
  React5.useEffect(() => {
    const handleMouseMove = (e) => {
      const el = getElementAtPosition(e.clientX, e.clientY);
      if (el !== hoveredEl) {
        setHoveredEl(el);
        if (el) {
          const rect = el.getBoundingClientRect();
          setBounds({
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
          });
          setTagName(el.tagName.toLowerCase());
        } else {
          setBounds(null);
          setTagName(null);
        }
      }
    };
    const handleClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const clickedEl = getElementAtPosition(e.clientX, e.clientY);
      console.log("[Grab] Click at", e.clientX, e.clientY);
      console.log("[Grab] Found element:", clickedEl);
      console.log("[Grab] Element tag:", clickedEl?.tagName);
      if (clickedEl) {
        const rect = clickedEl.getBoundingClientRect();
        const clickBounds = {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        };
        const description = describeElement(clickedEl);
        console.log("[Grab] Description:", description);
        onElementSelect(description, clickBounds);
      } else {
        console.log("[Grab] No valid element at click position");
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleEscape);
    document.body.style.cursor = "crosshair";
    return () => {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.cursor = "";
    };
  }, [hoveredEl, bounds, onElementSelect, onCancel]);
  return html5`
    <div class="grab-overlay" style=${{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}>
      ${bounds && html5`
        <div class="highlight-box" style=${{
    position: "fixed",
    left: bounds.left + "px",
    top: bounds.top + "px",
    width: bounds.width + "px",
    height: bounds.height + "px",
    outline: "2px solid #f97316",
    outlineOffset: "0px",
    background: "rgba(249, 115, 22, 0.1)",
    borderRadius: "2px",
    pointerEvents: "none",
    transition: "all 0.1s ease-out",
    boxSizing: "border-box"
  }}>
          ${tagName && html5`
            <div style=${{
    position: "absolute",
    top: "-14px",
    left: "-2px",
    background: "#f97316",
    color: "white",
    fontSize: "10px",
    fontWeight: 600,
    padding: "1px 5px",
    borderRadius: "3px 3px 0 0",
    whiteSpace: "nowrap",
    fontFamily: "ui-monospace, monospace"
  }}>
              ${tagName}
            </div>
          `}
        </div>
      `}
      <div class="grab-hint" style=${{
    position: "fixed",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(0,0,0,0.85)",
    color: "white",
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "13px",
    pointerEvents: "none",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
  }}>
        Click an element to edit${" "}&bull;${" "}Escape to cancel
      </div>
    </div>
  `;
}

// src/vibe_widget/AppWrapper/components/EditPromptPanel.js
import * as React6 from "https://esm.sh/react@18";
import htm6 from "https://esm.sh/htm@3";
var html6 = htm6.bind(React6.createElement);
function EditPromptPanel({ elementBounds, elementDescription, initialPrompt, onSubmit, onCancel }) {
  const [prompt, setPrompt] = React6.useState(initialPrompt || "");
  const panelRef = React6.useRef(null);
  const textareaRef = React6.useRef(null);
  const [position, setPosition] = React6.useState({ top: 0, left: 0 });
  const [textareaHeight, setTextareaHeight] = React6.useState(40);
  const [panelHovered, setPanelHovered] = React6.useState(false);
  const [buttonHovered, setButtonHovered] = React6.useState(false);
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
  React6.useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onCancel(prompt);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onCancel, prompt]);
  React6.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = MIN_TEXTAREA_HEIGHT + "px";
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT);
      setTextareaHeight(newHeight);
      textareaRef.current.style.height = newHeight + "px";
    }
  }, [prompt]);
  React6.useEffect(() => {
    if (!elementBounds) return;
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
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
  return html6`
    <div>
      ${elementBounds && html6`
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
    zIndex: 1e4,
    boxSizing: "border-box"
  }}>
          ${elementDescription?.tag && html6`
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
    fontFamily: "ui-monospace, monospace"
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
    gap: "6px"
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
    fontFamily: "inherit"
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
    background: prompt.trim() ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "rgba(255,255,255,0.15)",
    color: "white",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "opacity 0.2s, background 0.2s",
    padding: 0,
    opacity: getButtonOpacity()
  }}
            title=${prompt.trim() ? "Send (Enter)" : "Cancel (Esc)"}
          >
            ${prompt.trim() ? html6`
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            ` : html6`
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
    paddingLeft: "4px"
  }}>
          Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  `;
}

// src/vibe_widget/AppWrapper/hooks/useModelSync.js
import * as React7 from "https://esm.sh/react@18";
function useModelSync(model) {
  const [status, setStatus] = React7.useState(model.get("status"));
  const [logs, setLogs] = React7.useState(model.get("logs"));
  const [code, setCode] = React7.useState(model.get("code"));
  React7.useEffect(() => {
    const onStatusChange = () => setStatus(model.get("status"));
    const onLogsChange = () => setLogs(model.get("logs"));
    const onCodeChange = () => setCode(model.get("code"));
    model.on("change:status", onStatusChange);
    model.on("change:logs", onLogsChange);
    model.on("change:code", onCodeChange);
    return () => {
      model.off("change:status", onStatusChange);
      model.off("change:logs", onLogsChange);
      model.off("change:code", onCodeChange);
    };
  }, [model]);
  return { status, logs, code };
}

// src/vibe_widget/AppWrapper/hooks/useKeyboardShortcuts.js
import * as React8 from "https://esm.sh/react@18";
function useKeyboardShortcuts({ isLoading, hasCode, grabMode, onGrabStart }) {
  React8.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        if (!isLoading && hasCode && !grabMode) {
          onGrabStart();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, hasCode, grabMode, onGrabStart]);
}

// src/vibe_widget/AppWrapper/AppWrapper.js
var html7 = htm7.bind(React9.createElement);
ensureGlobalStyles();
function AppWrapper({ model }) {
  const { status, logs, code } = useModelSync(model);
  const [isMenuOpen, setMenuOpen] = React9.useState(false);
  const [grabMode, setGrabMode] = React9.useState(null);
  const [promptCache, setPromptCache] = React9.useState({});
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
      prompt
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
  return html7`
    <div class="vibe-container" style=${{ position: "relative", width: "100%" }}>
      ${hasCode && html7`
        <div style=${{
    opacity: isLoading ? 0.4 : 1,
    pointerEvents: isLoading ? "none" : "auto",
    transition: "opacity 0.3s ease"
  }}>
          <${SandboxedRunner} code=${code} model=${model} />
        </div>
      `}
      
      ${isLoading && html7`
        <${LoadingOverlay} 
          logs=${logs} 
          hasExistingWidget=${hasCode}
        />
      `}
      
      ${!isLoading && hasCode && html7`
        <${FloatingMenu} 
          isOpen=${isMenuOpen} 
          onToggle=${() => setMenuOpen(!isMenuOpen)}
          onGrabModeStart=${handleGrabStart}
          isEditMode=${!!grabMode}
        />
      `}
        
      ${grabMode === "selecting" && html7`
        <${SelectionOverlay} 
          onElementSelect=${handleElementSelect}
          onCancel=${handleCancel}
        />
      `}
      
      ${grabMode && grabMode !== "selecting" && html7`
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
var rootInstance = null;
function render({ model, el }) {
  if (!rootInstance) {
    rootInstance = createRoot(el);
  }
  rootInstance.render(html7`<${AppWrapper} model=${model} />`);
}
var AppWrapper_default = { render };
export {
  AppWrapper_default as default
};
