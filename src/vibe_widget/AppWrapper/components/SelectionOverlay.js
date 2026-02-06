import React, { useEffect, useState } from "react";
import { describeElement, getElementAtPosition } from "../utils/dom";

const UI_SELECTORS = [
  ".floating-menu",
  ".annotation-marker",
  ".annotation-toolbar",
  ".inline-prompt-editor"
];

function isUIElement(target) {
  if (!(target instanceof Element)) return false;
  return UI_SELECTORS.some((sel) => target.closest(sel));
}

export default function SelectionOverlay({
  onElementSelect,
  onCancel,
  suppressHover = false,
  showHint = true
}) {
  const [hoveredEl, setHoveredEl] = useState(null);
  const [bounds, setBounds] = useState(null);
  const [tagName, setTagName] = useState(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (suppressHover || isUIElement(e.target)) {
        if (hoveredEl) {
          setHoveredEl(null);
          setBounds(null);
          setTagName(null);
        }
        return;
      }

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
      if (suppressHover) return;

      // Let clicks on UI elements (toolbar, markers, menu) pass through
      if (isUIElement(e.target)) return;

      e.preventDefault();
      e.stopPropagation();

      const clickedEl = getElementAtPosition(e.clientX, e.clientY);
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
        onElementSelect(description, clickBounds);
      }
    };

    const handleEscape = (e) => {
      if (e.key === "Escape") onCancel();
    };

    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleEscape);
    document.body.style.cursor = suppressHover ? "" : "crosshair";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.cursor = "";
    };
  }, [hoveredEl, onElementSelect, onCancel, suppressHover]);

  return (
    <div class="grab-overlay" style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}>
      {bounds && !suppressHover && (
        <div
          class="highlight-box"
          style={{
            position: "fixed",
            left: `${bounds.left}px`,
            top: `${bounds.top}px`,
            width: `${bounds.width}px`,
            height: `${bounds.height}px`,
            outline: "2px solid #f97316",
            outlineOffset: "0px",
            background: "rgba(249, 115, 22, 0.1)",
            borderRadius: "2px",
            pointerEvents: "none",
            transition: "all 0.1s ease-out",
            boxSizing: "border-box"
          }}
        >
          {tagName && (
            <div
              style={{
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
              }}
            >
              {tagName}
            </div>
          )}
        </div>
      )}
      {showHint && (
        <div
          class="grab-hint"
          style={{
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
          }}
        >
          Click elements to annotate · Escape to exit
        </div>
      )}
    </div>
  );
}
