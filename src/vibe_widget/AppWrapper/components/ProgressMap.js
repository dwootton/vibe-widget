import React from "react";

export default function ProgressMap({ logs = [], status = "ready", fullHeight = false, heading = null, footer = null }) {
  const isActive = status !== "ready" && status !== "error";
  const isDone = status === "ready";

  return (
    <div class="progress-bezel">
      <style>{`
        .progress-bezel {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          color: #e2e8f0;
          background: #0b0b0b;
          border: 1px solid rgba(242, 240, 233, 0.08);
          border-radius: 4px;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02), 0 8px 24px rgba(0, 0, 0, 0.25);
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .progress-heading {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #f2f0e9;
        }
        .progress-heading .dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: ${isDone ? "#22c55e" : "#f97316"};
          box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.15);
        }
        .progress-log-container {
          flex: 1;
          min-height: ${fullHeight ? "100%" : "120px"};
          max-height: ${fullHeight ? "100%" : "240px"};
          overflow: auto;
          background: linear-gradient(180deg, rgba(18, 18, 18, 0.9), rgba(18, 18, 18, 0.6));
          border: 1px solid rgba(242, 240, 233, 0.12);
          border-radius: 4px;
          padding: 10px;
        }
        .progress-log-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
        }
        .progress-log-list::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        
        .progress-log-list::-webkit-scrollbar-thumb {
          background: rgba(243, 119, 38, 0.3);
          border-radius: 2px;
        }
        
        .progress-log-list::-webkit-scrollbar-thumb:hover {
          background: rgba(243, 119, 38, 0.5);
        }
        
        .log-entry {
          display: flex;
          align-items: baseline;
          gap: 4px;
          padding: 2px 0;
          color: #D1D5DB;
          opacity: 0;
          animation: fadeIn 0.3s ease-out forwards;
          animation-delay: calc(var(--entry-index) * 0.03s);
          white-space: pre-wrap;
          word-break: break-word;
        }

        .log-icon {
          width: 10px;
          flex: 0 0 10px;
          color: #6B7280;
          margin-left: 8px;
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

        .log-entry--terminal .log-text {
          background: #334155;
          color: #e2e8f0;
          padding: 1px 4px;
          text-transform: uppercase;
          display: inline-block;
        }

        .log-icon--terminal {
          color: #9ca3af;
        }

        .cursor {
          display: inline-block;
          margin-left: 1px;
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
      `}</style>
      {heading && (
        <div class="progress-heading">
          <span class="dot" aria-hidden="true"></span>
          <span>{heading}</span>
        </div>
      )}
      <div class="progress-log-container">
        <ul class="progress-log-list">
          {logs.map((entry, idx) => {
            const text = typeof entry === "string" ? entry : String(entry);
            const isTerminal = text.toLowerCase().includes("runtime error");
            const isLive = idx === logs.length - 1 && isActive;
            const classes = [
              "log-entry",
              isDone ? "log-entry--done" : "",
              isActive && !isTerminal ? "log-entry--active" : "",
              isTerminal ? "log-entry--terminal" : ""
            ].filter(Boolean).join(" ");
            return (
              <li key={idx} class={classes} style={{ "--entry-index": idx }}>
                <span class={`log-icon ${isLive ? "log-icon--active" : isTerminal ? "log-icon--terminal" : ""}`}>
                  {isTerminal ? "!" : ">"} 
                </span>
                <span class="log-text">
                  {text}
                  {isLive && <span class="cursor">█</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      {footer && <div class="progress-footer">{footer}</div>}
    </div>
  );
}
