import React, { useState, useRef, useEffect } from "react";
import { tw } from "../styles/setup.js";

const overlayClass = tw(
  "absolute inset-0 z-[1200] flex items-center justify-center bg-[rgba(6,6,6,0.72)] backdrop-blur-[4px]"
);
const cardClass = tw(
  "w-[min(400px,92%)] bg-surface-2 text-text-primary border border-border-medium rounded-[8px] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.4)] font-mono"
);
const titleClass = tw("text-[13px] uppercase tracking-[0.08em] text-accent mb-3");
const labelClass = tw("text-[12px] text-text-secondary mb-1.5 block");
const inputClass = tw(
  "w-full bg-surface-1 border border-border-medium rounded-[4px] px-3 py-2 text-[13px] text-text-primary font-mono outline-none transition-colors duration-150 focus:border-accent"
);
const hintClass = tw("text-[11px] text-text-muted mt-1.5");
const checkboxRowClass = tw("flex items-center gap-2 mt-3 text-[12px] text-text-secondary");
const actionsClass = tw("flex justify-end gap-2 mt-4");
const baseButtonClass = tw(
  "rounded-[6px] px-3 py-1.5 text-[12px] font-semibold cursor-pointer transition-colors duration-150"
);
const primaryButtonClass = `${baseButtonClass} ${tw("bg-accent text-surface-1 border-none hover:bg-[#fb923c]")}`;
const secondaryButtonClass = `${baseButtonClass} ${tw("bg-transparent text-text-primary border border-border-medium hover:bg-surface-3")}`;
const disabledClass = tw("opacity-60 cursor-not-allowed");

export default function SaveDialog({ isOpen, onSave, onCancel, defaultName = "widget.vw" }) {
  const [filename, setFilename] = useState(defaultName);
  const [includeInputs, setIncludeInputs] = useState(false);
  const inputRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setFilename(defaultName);
      setIncludeInputs(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const dotIndex = defaultName.lastIndexOf(".");
          if (dotIndex > 0) {
            inputRef.current.setSelectionRange(0, dotIndex);
          } else {
            inputRef.current.select();
          }
        }
      }, 50);
    }
  }, [isOpen, defaultName]);

  const handleSave = () => {
    const trimmed = filename.trim();
    if (!trimmed) return;
    onSave(trimmed, includeInputs);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" && filename.trim()) {
      e.preventDefault();
      handleSave();
    }
  };

  // Escape closes; Tab cycles within the card so focus cannot reach the notebook behind it.
  const handleCardKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key !== "Tab" || !cardRef.current) return;
    const focusable = cardRef.current.querySelectorAll("input:not([disabled]), button:not([disabled])");
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div class={overlayClass} onClick={onCancel}>
      <div
        ref={cardRef}
        class={cardClass}
        role="dialog"
        aria-modal="true"
        aria-label="Save widget"
        onKeyDown={handleCardKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <div class={titleClass}>Save Widget</div>
        <label class={labelClass} htmlFor="save-filename">
          File name
        </label>
        <input
          ref={inputRef}
          id="save-filename"
          type="text"
          class={inputClass}
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="widget.vw"
        />
        <div class={hintClass}>
          Widget will be saved as a .vw bundle; the kernel decides the final path
        </div>
        <label class={checkboxRowClass} htmlFor="save-include-inputs">
          <input
            id="save-include-inputs"
            type="checkbox"
            checked={includeInputs}
            onChange={(e) => setIncludeInputs(e.target.checked)}
          />
          Embed input data in the bundle
        </label>
        <div class={actionsClass}>
          <button class={secondaryButtonClass} onClick={onCancel}>
            Cancel
          </button>
          <button
            class={`${primaryButtonClass} ${!filename.trim() ? disabledClass : ""}`}
            onClick={handleSave}
            disabled={!filename.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
