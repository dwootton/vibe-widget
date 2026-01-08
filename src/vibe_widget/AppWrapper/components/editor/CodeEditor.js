import React, { useEffect, useRef } from "react";

export default function CodeEditor({ value, onChange, isLoading, loadError }) {
  const textRef = useRef(null);

  useEffect(() => {
    if (textRef.current) {
      textRef.current.value = value || "";
    }
  }, [value]);

  return (
    <div class="source-viewer-editor" style={{ position: "relative", width: "100%", height: "100%" }}>
      <style>{`
        .source-viewer-editor {
          background: #0b0b0b;
          border: 1px solid rgba(242, 240, 233, 0.15);
          border-radius: 4px;
          min-height: 240px;
          color: #f2f0e9;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
        }
        .source-viewer-loading,
        .source-viewer-error {
          padding: 12px;
          font-size: 12px;
        }
        .source-viewer-error { color: #fca5a5; }
      `}</style>
      {isLoading && <div class="source-viewer-loading">Loading editor...</div>}
      {loadError && <div class="source-viewer-error">{loadError}</div>}
      {!isLoading && !loadError && (
        <textarea
          ref={textRef}
          defaultValue={value || ""}
          onInput={(e) => onChange && onChange(e.target.value)}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            color: "inherit",
            padding: "10px",
            boxSizing: "border-box",
            resize: "vertical"
          }}
        />
      )}
    </div>
  );
}
