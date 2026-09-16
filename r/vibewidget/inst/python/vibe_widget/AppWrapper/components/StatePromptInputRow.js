import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { css, tw } from "../styles/setup.js";

const wrapperClass = tw("mr-2");
const entryClass = tw("flex items-center gap-1 text-text-muted uppercase font-mono text-[12px]");
const entryTopClass = tw("flex items-start gap-1 text-text-muted uppercase font-mono text-[12px]");
const logIconClass = tw("flex-none text-text-muted");
const logTextClass = tw("flex-1 flex items-center gap-1");
const logTextTopClass = tw("flex-1 flex items-start gap-1");
const inputWrapperClass = tw("relative flex-1 min-w-0");
const textareaClass = tw(
  "w-full bg-transparent text-text-primary border-none outline-none focus:outline-none focus-visible:outline-none shadow-none p-0 pl-[1ch] m-0 resize-none font-mono text-[12px] leading-[1.4] caret-transparent disabled:text-[rgba(242,240,233,0.55)] appearance-none"
);
const mirrorClass = css({
  position: "absolute",
  inset: 0,
  visibility: "hidden",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  padding: 0,
  paddingLeft: "1ch",
  margin: 0,
  fontFamily:
    "JetBrains Mono, Space Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
  fontSize: "12px",
  lineHeight: "1.4"
});
const caretBaseClass = tw("absolute w-[0.7ch] bg-text-primary pointer-events-none top-0 left-0");

export default function StatePromptInputRow({
  value,
  onChange,
  onSubmit,
  disabled = false,
  maxHeight = 200,
  blink = true,
  align = "center",
  autoFocus = false
}) {
  const textareaRef = useRef(null);
  const markerRef = useRef(null);
  const mirrorRef = useRef(null);
  const wrapperRef = useRef(null);
  const [caretIndex, setCaretIndex] = useState(0);
  const [caretStyle, setCaretStyle] = useState({ left: 0, top: 0, height: 14 });

  const normalizedValue = (value || "").replace(/\r\n/g, "\n");
  const safeCaretIndex = Math.min(caretIndex, normalizedValue.length);
  const beforeCaret = normalizedValue.slice(0, safeCaretIndex);
  const afterCaret = normalizedValue.slice(safeCaretIndex);

  const updateCaretIndex = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const nextIndex = textarea.selectionStart ?? 0;
    setCaretIndex(nextIndex);
  }, []);

  const updateCaretPosition = useCallback(() => {
    const marker = markerRef.current;
    const textarea = textareaRef.current;
    const wrapper = wrapperRef.current;
    if (!marker || !textarea || !wrapper) return;
    const textareaStyle = window.getComputedStyle(textarea);
    const lineHeightValue = parseFloat(textareaStyle.lineHeight || "14");
    const lineHeight = Number.isFinite(lineHeightValue) ? lineHeightValue : 14;
    const scrollTop = textarea.scrollTop || 0;
    const scrollLeft = textarea.scrollLeft || 0;
    const wrapperRect = wrapper.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const paddingLeftValue = parseFloat(textareaStyle.paddingLeft || "0");
    const paddingLeft = Number.isFinite(paddingLeftValue) ? paddingLeftValue : 0;
    const isEmpty = normalizedValue.length === 0;
    setCaretStyle({
      left: isEmpty ? paddingLeft : markerRect.left - wrapperRect.left - scrollLeft,
      top: isEmpty ? 0 : markerRect.top - wrapperRect.top - scrollTop,
      height: lineHeight
    });
  }, [normalizedValue]);

  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [maxHeight]);

  useLayoutEffect(() => {
    autoResize();
    updateCaretPosition();
  }, [normalizedValue, safeCaretIndex, autoResize, updateCaretPosition]);

  useEffect(() => {
    const handleResize = () => updateCaretPosition();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateCaretPosition]);

  useEffect(() => {
    updateCaretIndex();
  }, [normalizedValue, updateCaretIndex]);

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    updateCaretIndex();
    updateCaretPosition();
  }, [autoFocus, disabled, updateCaretIndex, updateCaretPosition]);

  useEffect(() => {
    if (!disabled) return;
    const textarea = textareaRef.current;
    if (textarea && document.activeElement === textarea) {
      textarea.blur();
    }
  }, [disabled]);

  const rowClass = align === "start" ? entryTopClass : entryClass;
  const textClass = align === "start" ? logTextTopClass : logTextClass;

  return (
    <div class={wrapperClass}>
      <div class={rowClass}>
        <span class={logIconClass}>{">"}</span>
        <span class={textClass}>
          <span class={inputWrapperClass} ref={wrapperRef}>
            <textarea
              ref={textareaRef}
              class={textareaClass}
              value={normalizedValue}
              disabled={disabled}
              tabIndex={disabled ? -1 : 0}
              style={disabled ? { pointerEvents: "none" } : undefined}
              rows={1}
              onInput={(event) => {
                onChange(event.target.value);
                updateCaretIndex();
                autoResize();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  if (event.shiftKey) {
                    // Shift+Enter: insert newline, but stop propagation to prevent Jupyter from running the cell
                    event.stopPropagation();
                  } else {
                    // Enter without shift: submit
                    event.preventDefault();
                    onSubmit();
                  }
                }
              }}
              onFocus={() => {
                if (disabled) {
                  textareaRef.current?.blur();
                }
              }}
              onClick={updateCaretIndex}
              onKeyUp={updateCaretIndex}
              onSelect={updateCaretIndex}
              onScroll={updateCaretPosition}
            ></textarea>
            <div class={mirrorClass} ref={mirrorRef} aria-hidden="true">
              {beforeCaret}
              <span ref={markerRef}>&#8203;</span>
              {afterCaret}
            </div>
            <span
              class={`${caretBaseClass} ${blink ? "animate-terminal-caret-blink" : ""}`}
              style={{
                transform: `translate(${caretStyle.left}px, ${caretStyle.top}px)`,
                height: `${caretStyle.height}px`
              }}
            ></span>
          </span>
        </span>
      </div>
    </div>
  );
}
