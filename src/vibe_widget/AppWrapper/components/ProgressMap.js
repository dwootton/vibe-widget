import * as React from "react";
import htm from "htm";

const html = htm.bind(React.createElement);
const SPINNER_FRAMES = ["/", "-", "\\", "|"];
const SPINNER_INTERVAL_MS = 120;

export default function ProgressMap({ logs, fullHeight = false }) {
  const containerRef = React.useRef(null);
  const [spinnerFrame, setSpinnerFrame] = React.useState(0);

  React.useLayoutEffect(() => {
    if (!containerRef.current) return;
    const node = containerRef.current;
    const raf = requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [logs]);

  React.useEffect(() => {
    if (!logs || logs.length === 0) return;
    const interval = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, SPINNER_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [logs]);

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
        
        .progress-container {
          width: 100%;
          max-height: 280px;
          padding: 10px 12px;
          background: transparent;
          color: #F2F0E9;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          line-height: 1.4;
          overflow-y: auto;
        }
        .progress-wrapper--full .progress-container {
          flex: 1;
          max-height: none;
          min-height: 0;
        }
        
        .progress-container::-webkit-scrollbar {
          width: 4px;
        }
        
        .progress-container::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .progress-container::-webkit-scrollbar-thumb {
          background: rgba(243, 119, 38, 0.3);
          border-radius: 2px;
        }
        
        .progress-container::-webkit-scrollbar-thumb:hover {
          background: rgba(243, 119, 38, 0.5);
        }
        
        .log-entry {
          display: flex;
          align-items: baseline;
          gap: 8px;
          padding: 2px 0;
          color: #D1D5DB;
          opacity: 0;
          animation: fadeIn 0.3s ease-out forwards;
          animation-delay: calc(var(--entry-index) * 0.03s);
          white-space: pre-wrap;
          word-break: break-word;
        }

        .log-icon {
          width: 14px;
          flex: 0 0 14px;
          color: #6B7280;
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

        .cursor {
          display: inline-block;
          margin-left: 4px;
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
        <div class="progress-heading">
          Welcome to Vibe Widgets!
        </div>
        <div class="progress-container" ref=${containerRef}>
          ${logs.map((log, idx) => {
            const isActive = idx === logs.length - 1;
            const icon = isActive ? SPINNER_FRAMES[spinnerFrame] : "\u25A0";
            const text = sanitizeLogText(log);
            return html`
              <div
                key=${idx}
                class=${`log-entry ${isActive ? "log-entry--active" : "log-entry--done"}`}
                style=${{ "--entry-index": idx }}
              >
                <span class=${`log-icon ${isActive ? "log-icon--active" : ""}`}>${icon}</span>
                <span class="log-text">
                  ${text}${isActive && html`<span class="cursor">█</span>`}
                </span>
              </div>
            `;
          })}
        </div>
      </div>
    </div>
  `;
}
