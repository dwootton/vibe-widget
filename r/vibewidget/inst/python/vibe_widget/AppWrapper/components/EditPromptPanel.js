import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import StatePromptInputRow from "./StatePromptInputRow";
import { tw } from "../styles/setup.js";

const panelClass = tw(
  "bg-[rgba(0,0,0,0.9)] text-text-primary border border-border-medium rounded-[6px] shadow-[0_12px_28px_rgba(0,0,0,0.35)] p-3 font-mono text-[12px] w-full box-border"
);
const headerClass = tw("flex items-center justify-between mb-2 gap-2");
const titleClass = tw("text-[11px] uppercase tracking-[0.08em] text-accent");
const tagClass = tw(
  "bg-[rgba(249,115,22,0.1)] text-accent border border-[rgba(249,115,22,0.4)] rounded-[4px] px-2 py-[4px] text-[11px]"
);
const bodyClass = tw("flex flex-col gap-2");
const footerClass = tw("flex justify-end gap-2");
const baseButtonClass = tw("rounded-[6px] px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors duration-150");
const primaryButtonClass = `${baseButtonClass} ${tw("bg-accent text-surface-1 border-none")}`;
const secondaryButtonClass = `${baseButtonClass} ${tw("bg-transparent text-text-primary border border-border-medium")}`;
const disabledClass = tw("opacity-60 cursor-not-allowed");

export default function EditPromptPanel({
  elementBounds,
  containerBounds,
  elementDescription,
  initialPrompt,
  onSubmit,
  onCancel
}) {
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const panelRef = useRef(null);
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    setPrompt(initialPrompt || "");
  }, [initialPrompt]);

  useLayoutEffect(() => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    setPanelSize({ width: rect.width, height: rect.height });
  }, [prompt, elementBounds, containerBounds]);

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  const container = containerBounds || { top: 0, left: 0, width: 0, height: 0 };
  const bounds = elementBounds || { top: 0, left: 0, width: 0, height: 0 };
  const baseWidth = Math.max(220, Math.min(360, container.width || 320));
  const width = Math.min(baseWidth, Math.max(200, (container.width || baseWidth) - 16));
  const panelHeight = panelSize.height || 160;
  const relLeft = bounds.left - container.left;
  const relTop = bounds.top - container.top;
  const relBottom = bounds.bottom - container.top;
  let nextTop = relBottom + 10;
  if (container.height && nextTop + panelHeight > container.height - 8) {
    nextTop = relTop - panelHeight - 10;
  }
  let nextLeft = relLeft;
  if (container.width) {
    nextLeft = Math.min(Math.max(8, nextLeft), Math.max(8, container.width - width - 8));
  }
  if (container.height) {
    nextTop = Math.min(Math.max(8, nextTop), Math.max(8, container.height - panelHeight - 8));
  }

  return (
    <div
      ref={panelRef}
      class={panelClass}
      style={{
        position: "absolute",
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        width: `${width}px`,
        zIndex: 1000
      }}
    >
      <div class={headerClass}>
        <div class={titleClass}>Edit Element</div>
        {elementDescription?.tag && (
          <div class={tagClass}>{elementDescription.tag}</div>
        )}
      </div>
      <div class={bodyClass}>
        <StatePromptInputRow
          value={prompt}
          onChange={setPrompt}
          onSubmit={handleSubmit}
          disabled={false}
          blink={true}
          maxHeight={72}
        />
      </div>
      <div class={footerClass}>
        <button class={secondaryButtonClass} onClick={() => onCancel(prompt)}>
          Cancel
        </button>
        <button
          class={`${primaryButtonClass} ${!prompt.trim() ? disabledClass : ""}`}
          onClick={handleSubmit}
          disabled={!prompt.trim()}
        >
          Apply Change
        </button>
      </div>
    </div>
  );
}
