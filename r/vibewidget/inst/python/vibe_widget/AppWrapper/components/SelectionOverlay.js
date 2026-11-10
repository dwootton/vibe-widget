import React, { useEffect, useState } from "react";
import { describeElement, getElementAtPosition } from "../utils/dom";

export default function SelectionOverlay({ onElementSelect, onCancel }) {
  const [hoveredEl, setHoveredEl] = useState(null);
  const [bounds, setBounds] = useState(null);
  const [tagName, setTagName] = useState(null);

  useEffect(() => {
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
  }, [hoveredEl, onElementSelect, onCancel]);

  return (
    <div class="grab-overlay" style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}>
      {bounds && (
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
        Click an element to edit • Escape to cancel
      </div>
    </div>
  );
}
