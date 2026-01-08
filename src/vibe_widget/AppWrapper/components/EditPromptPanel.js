import React, { useEffect, useRef, useState } from "react";

export default function EditPromptPanel({
  elementBounds,
  containerBounds,
  elementDescription,
  initialPrompt,
  onSubmit,
  onCancel
}) {
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const textareaRef = useRef(null);

  useEffect(() => {
    setPrompt(initialPrompt || "");
  }, [initialPrompt]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  const width = Math.max(260, Math.min(380, containerBounds?.width || 320));
  const left = containerBounds?.left || 0;
  const top = containerBounds?.top || 0;
  const bounds = elementBounds || { top: 0, left: 0, width: 0, height: 0 };

  return (
    <div
      class="edit-prompt-panel"
      style={{
        position: "absolute",
        left: `${left + bounds.left}px`,
        top: `${top + bounds.bottom + 10}px`,
        width: `${width}px`,
        zIndex: 1000
      }}
    >
      <style>{`
        .edit-panel {
          background: rgba(0, 0, 0, 0.9);
          color: #f2f0e9;
          border: 1px solid rgba(242, 240, 233, 0.2);
          border-radius: 6px;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
          padding: 12px;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          width: 100%;
          box-sizing: border-box;
        }
        .edit-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .edit-panel-title {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #f97316;
        }
        .edit-panel-body {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .edit-panel-tags {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .edit-panel-tag {
          background: rgba(249, 115, 22, 0.1);
          color: #f97316;
          border: 1px solid rgba(249, 115, 22, 0.4);
          border-radius: 4px;
          padding: 4px 6px;
          font-size: 11px;
        }
        .edit-panel textarea {
          width: 100%;
          min-height: 80px;
          background: transparent;
          color: #f2f0e9;
          border: 1px solid rgba(242, 240, 233, 0.2);
          border-radius: 4px;
          padding: 8px;
          resize: vertical;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
        }
        .edit-panel-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .edit-btn {
          background: #f97316;
          color: #0b0b0b;
          border: none;
          border-radius: 6px;
          padding: 8px 10px;
          font-size: 11px;
          cursor: pointer;
        }
        .edit-btn.secondary {
          background: transparent;
          color: #e2e8f0;
          border: 1px solid rgba(242, 240, 233, 0.2);
        }
        .edit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
      <div class="edit-panel">
        <div class="edit-panel-header">
          <div class="edit-panel-title">Edit Element</div>
          {elementDescription?.tag && (
            <div class="edit-panel-tag">{elementDescription.tag}</div>
          )}
        </div>
        <div class="edit-panel-body">
          <textarea
            ref={textareaRef}
            value={prompt}
            onInput={(e) => setPrompt(e.target.value)}
            placeholder="Describe the change you want..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          ></textarea>
        </div>
        <div class="edit-panel-footer">
          <button class="edit-btn secondary" onClick={onCancel}>Cancel</button>
          <button class="edit-btn" onClick={handleSubmit} disabled={!prompt.trim()}>
            Apply Change
          </button>
        </div>
      </div>
    </div>
  );
}
