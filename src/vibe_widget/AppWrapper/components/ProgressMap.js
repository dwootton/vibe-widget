import * as React from "react";
import htm from "htm";

const html = htm.bind(React.createElement);
const SPINNER_FRAMES = ["/", "-", "\\", "|"];
const SPINNER_INTERVAL_MS = 120;

export default function ProgressMap({
  logs,
  status = "generating",
  fullHeight = false,
  footer = null,
  heading = "Welcome to Vibe Widgets!"
}) {
  const logListRef = React.useRef(null);
  const shouldAutoScrollRef = React.useRef(true);
  const prevScrollHeightRef = React.useRef(0);
  const [spinnerFrame, setSpinnerFrame] = React.useState(0);
  const isTerminal = status === "blocked" || status === "error" || status === "ready";
  const shouldSpin = Array.isArray(logs) && logs.length > 0 && !isTerminal;

  React.useLayoutEffect(() => {
    const node = logListRef.current;
    if (!node) return;
    const prevHeight = prevScrollHeightRef.current || 0;
    const nextHeight = node.scrollHeight;
    const heightDelta = nextHeight - prevHeight;
    const raf = requestAnimationFrame(() => {
      if (shouldAutoScrollRef.current) {
        node.scrollTop = node.scrollHeight;
      } else if (heightDelta) {
        node.scrollTop = node.scrollTop + heightDelta;
      }
      prevScrollHeightRef.current = node.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [logs]);

  React.useEffect(() => {
    if (!shouldSpin) return;
    const interval = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, SPINNER_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [shouldSpin]);

  const sanitizeLogText = (log) => {
    const upper = String(log ?? "").toUpperCase();
    return upper.replace(/[.\u2026]+$/g, "").trimEnd();
  };

  return html`
    <div class=${`progress-wrapper ${fullHeight ? "progress-wrapper--full" : ""}`}>
      <style>
        .progress-wrapper {
          position: relative;
          padding: 12px;
          background: transparent;
          height: 300px;
        }
        .progress-wrapper--full {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        
        .progress-bezel {
          border-radius: 6px;
          background: #1A1A1A;
          border: 3px solid #F2F0E9;
          box-shadow: inset 0px 2px 4px rgba(0, 0, 0, 0.5);
        }
        .progress-wrapper--full .progress-bezel {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        
        .progress-heading {
          padding: 10px 12px 0;
          color: #F2F0E9;
          font-family: "Inter", "JetBrains Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 13px;
          letter-spacing: 0.02em;
        }
        
        .progress-body {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .progress-log-list {
          width: 100%;
          padding: 10px 12px;
          background: transparent;
          color: #F2F0E9;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          line-height: 1.4;
          overflow-y: auto;
          flex: 1;
          min-height: 0;
        }
        .progress-footer {
          padding: 0 12px 12px;
          flex: 0 0 auto;
        }
        
        .progress-log-list::-webkit-scrollbar {
          width: 4px;
        }
        
        .progress-log-list::-webkit-scrollbar-track {
          background: transparent;
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
      </style>
      <div class="progress-bezel">
        ${heading ? html`
          <div class="progress-heading">
            ${heading}
          </div>
        ` : null}
        <div class="progress-body">
          <div
            class="progress-log-list"
            ref=${logListRef}
            onScroll=${(event) => {
              const node = event.currentTarget;
              const remaining = node.scrollHeight - node.scrollTop - node.clientHeight;
              shouldAutoScrollRef.current = remaining <= 4;
              prevScrollHeightRef.current = node.scrollHeight;
            }}
          >
            ${logs.map((log, idx) => {
              const isActive = idx === logs.length - 1;
              const isLive = isActive && !isTerminal;
              const icon = isLive ? SPINNER_FRAMES[spinnerFrame] : "\u25A0";
              const text = sanitizeLogText(log);
              const entryClass = isLive
                ? "log-entry--active"
                : isActive
                  ? "log-entry--terminal"
                  : "log-entry--done";
              return html`
                <div
                  key=${idx}
                  class=${`log-entry ${entryClass}`}
                  style=${{ "--entry-index": idx }}
                >
                  <span class=${`log-icon ${isLive ? "log-icon--active" : isActive ? "log-icon--terminal" : ""}`}>
                    ${icon}
                  </span>
                  <span class="log-text">
                    ${text}${isLive && html`<span class="cursor">█</span>`}
                  </span>
                </div>
              `;
            })}
          </div>
          ${footer && html`<div class="progress-footer">${footer}</div>`}
        </div>
      </div>
    </div>
  `;
}
