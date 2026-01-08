import * as React from "react";
import htm from "htm";

const html = htm.bind(React.createElement);

export default function StatePromptInputRow({
  value,
  onChange,
  onSubmit,
  disabled = false,
  maxHeight = 200,
  blink = true
}) {
  const textareaRef = React.useRef(null);
  const markerRef = React.useRef(null);
  const mirrorRef = React.useRef(null);
  const wrapperRef = React.useRef(null);
  const [caretIndex, setCaretIndex] = React.useState(0);
  const [caretStyle, setCaretStyle] = React.useState({ left: 0, top: 0, height: 14 });

  const normalizedValue = (value || "").replace(/\r\n/g, "\n");
  const safeCaretIndex = Math.min(caretIndex, normalizedValue.length);
  const beforeCaret = normalizedValue.slice(0, safeCaretIndex);
  const afterCaret = normalizedValue.slice(safeCaretIndex);

  const updateCaretIndex = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const nextIndex = textarea.selectionStart ?? 0;
    setCaretIndex(nextIndex);
  }, []);

  const updateCaretPosition = React.useCallback(() => {
    const marker = markerRef.current;
    const textarea = textareaRef.current;
    if (!marker || !textarea) return;
    const lineHeightValue = parseFloat(window.getComputedStyle(textarea).lineHeight || "14");
    const lineHeight = Number.isFinite(lineHeightValue) ? lineHeightValue : 14;
    const scrollTop = textarea.scrollTop || 0;
    const scrollLeft = textarea.scrollLeft || 0;
    setCaretStyle({
      left: marker.offsetLeft - scrollLeft,
      top: marker.offsetTop - scrollTop,
      height: lineHeight
    });
  }, []);

  const autoResize = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [maxHeight]);

  React.useLayoutEffect(() => {
    autoResize();
    updateCaretPosition();
  }, [normalizedValue, safeCaretIndex, autoResize, updateCaretPosition]);

  React.useEffect(() => {
    const handleResize = () => updateCaretPosition();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateCaretPosition]);

  React.useEffect(() => {
    updateCaretIndex();
  }, [normalizedValue, updateCaretIndex]);

  return html`
    <div class="state-input-row">
      <div class="log-entry log-entry--active log-entry--input">
        <style>
          .state-input-row {
            border-top: 1px solid rgba(242, 240, 233, 0.25);
            margin: 8px 8px 0;
            padding-top: 8px;
          }
          .log-entry--input {
            align-items: flex-start;
          }
        .log-entry--input .log-text {
          display: flex;
          align-items: flex-start;
          gap: 4px;
          width: 100%;
          background: transparent;
          padding: 0;
          border: none;
          border-radius: 2px;
          margin-left: 12px;
        }
        .log-entry--input .log-icon {
          margin-left: -12px;
        }
          .state-input-wrapper {
            position: relative;
            flex: 1;
            min-width: 0;
          }
          .state-input {
            width: 100%;
            background: transparent;
            color: #f2f0e9;
            border: none;
            padding: 0;
            margin: 0;
            box-shadow: none;
            outline: none;
            appearance: none;
            font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
              Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 12px;
            line-height: 1.4;
            resize: none;
            min-height: 20px;
            caret-color: transparent;
          }
          .state-input:focus,
          .state-input:focus-visible {
            outline: none;
            box-shadow: none;
          }
          .state-input:disabled {
            color: rgba(242, 240, 233, 0.55);
          }
          .state-input-mirror {
            position: absolute;
            inset: 0;
            visibility: hidden;
            white-space: pre-wrap;
            word-break: break-word;
            padding: 0;
            margin: 0;
            font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
              Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 12px;
            line-height: 1.4;
          }
          .state-input-caret {
            position: absolute;
            width: 0.7ch;
            background: #f2f0e9;
            pointer-events: none;
            top: 0;
            left: 0;
          }
          .state-input-caret.is-blinking {
            animation: terminalCaretBlink 1.6s steps(2, end) infinite;
          }
          @keyframes terminalCaretBlink {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0; }
          }
        </style>
        <span class="log-icon log-icon--active">${">"}</span>
        <span class="log-text">
          <span class="state-input-wrapper" ref=${wrapperRef}>
            <textarea
              ref=${textareaRef}
              class="state-input"
              value=${normalizedValue}
              disabled=${disabled}
              rows=${1}
              onInput=${(event) => {
                onChange(event.target.value);
                updateCaretIndex();
                autoResize();
              }}
              onKeyDown=${(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSubmit();
                }
              }}
              onClick=${updateCaretIndex}
              onKeyUp=${updateCaretIndex}
              onSelect=${updateCaretIndex}
              onScroll=${updateCaretPosition}
            ></textarea>
            <div class="state-input-mirror" ref=${mirrorRef} aria-hidden="true">
              ${beforeCaret}
              <span ref=${markerRef}>&#8203;</span>
              ${afterCaret}
            </div>
            <span
              class=${`state-input-caret ${blink ? "is-blinking" : ""}`}
              style=${{
                transform: `translate(${caretStyle.left}px, ${caretStyle.top}px)`,
                height: `${caretStyle.height}px`
              }}
            ></span>
          </span>
        </span>
      </div>
    </div>
  `;
}
