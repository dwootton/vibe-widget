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
const hintClass = tw("text-[11px] text-text-tertiary mt-1.5");
const actionsClass = tw("flex justify-end gap-2 mt-4");
const baseButtonClass = tw(
  "rounded-[6px] px-3 py-1.5 text-[12px] font-semibold cursor-pointer transition-colors duration-150"
);
const primaryButtonClass = `${baseButtonClass} ${tw("bg-accent text-surface-1 border-none hover:bg-[#fb923c]")}`;
const secondaryButtonClass = `${baseButtonClass} ${tw("bg-transparent text-text-primary border border-border-medium hover:bg-surface-3")}`;
const disabledClass = tw("opacity-60 cursor-not-allowed");

export default function SaveDialog({ isOpen, onSave, onCancel, defaultName = "widget.vw" }) {
  const [filename, setFilename] = useState(defaultName);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setFilename(defaultName);
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

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && filename.trim()) {
      e.preventDefault();
      onSave(filename.trim());
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleSave = () => {
    const trimmed = filename.trim();
    if (!trimmed) return;
    onSave(trimmed);
  };

  if (!isOpen) return null;

  return (
    <div class={overlayClass} onClick={onCancel}>
      <div class={cardClass} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
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
          onKeyDown={handleKeyDown}
          placeholder="widget.vw"
        />
        <div class={hintClass}>
          Widget will be saved as a .vw bundle in your working directory
        </div>
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
