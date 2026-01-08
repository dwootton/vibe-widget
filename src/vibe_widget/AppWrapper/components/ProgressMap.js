import React from "react";

export default function ProgressMap({ logs = [], status = "ready", fullHeight = false, heading = null, footer = null }) {
  const isActive = status !== "ready" && status !== "error";
  const isDone = status === "ready";
  const [spinnerIndex, setSpinnerIndex] = React.useState(0);
  const spinnerFrames = ["|", "/", "-", "\\"];
  const logContainerRef = React.useRef(null);

  React.useEffect(() => {
    const el = logContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 24) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  React.useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => {
      setSpinnerIndex((prev) => (prev + 1) % spinnerFrames.length);
    }, 140);
    return () => clearInterval(timer);
  }, [isActive, spinnerFrames.length]);

  return (
    <div class="progress-bezel">
      <style>{`
        .progress-bezel {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          color: #e2e8f0;
          background: #050505;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 0;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
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
          padding-left: 9px;
        }
        .progress-heading .dot {
          width: 8px;
          height: 8px;
          border-radius: 0;
          background: ${isDone ? "#22c55e" : "#f97316"};
          box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.12);
        }
        .progress-log-container {
          flex: 1;
          min-height: 0;
          ${fullHeight ? "" : "max-height: 240px;"}
          overflow: auto;
          background: transparent;
          border: 0;
          border-radius: 0;
          padding: 6px 0 0;
          box-shadow: none;
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
          text-transform: uppercase;
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

        .progress-footer {
          padding-top: 8px;
        }
        
        .log-entry {
          display: flex;
          align-items: baseline;
          gap: 4px;
          padding: 2px 0;
          color: #94a3b8;
          opacity: 0;
          animation: fadeIn 0.3s ease-out forwards;
          animation-delay: calc(var(--entry-index) * 0.03s);
          white-space: pre-wrap;
          word-break: break-word;
          text-transform: uppercase;
        }

        .log-icon {
          width: 10px;
          flex: 0 0 10px;
          margin-left: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .log-icon-block {
          width: 6px;
          height: 6px;
          border-radius: 0;
          background: rgba(148, 163, 184, 0.6);
        }

        .log-entry--live .log-text {
          color: #f97316;
          text-transform: uppercase;
        }

        .log-entry--live .log-icon {
          color: #f97316;
        }

        .log-entry--done .log-text {
          color: #94a3b8;
        }

        .log-entry--terminal .log-text {
          color: #cbd5e1;
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
      <div class="progress-log-container" ref={logContainerRef}>
        <ul class="progress-log-list">
          {logs.map((entry, idx) => {
            const text = typeof entry === "string" ? entry : String(entry);
            const isTerminal = text.toLowerCase().includes("runtime error");
            const isLive = idx === logs.length - 1 && isActive;
            const classes = [
              "log-entry",
              isDone ? "log-entry--done" : "",
              isLive ? "log-entry--live" : "",
              isTerminal ? "log-entry--terminal" : ""
            ].filter(Boolean).join(" ");
            return (
              <li key={idx} class={classes} style={{ "--entry-index": idx }}>
                <span class="log-icon">
                  {isLive ? spinnerFrames[spinnerIndex] : <span class="log-icon-block" />}
                </span>
                <span class="log-text">
                  {text}
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
