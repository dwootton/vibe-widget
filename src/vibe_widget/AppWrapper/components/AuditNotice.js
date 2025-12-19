import * as React from "react";
import htm from "htm";

const html = htm.bind(React.createElement);

export default function AuditNotice({ onAccept }) {
  return html`
    <div class="audit-overlay">
      <style>
        .audit-overlay {
          position: absolute;
          inset: 0;
          z-index: 1200;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(6, 6, 6, 0.72);
          backdrop-filter: blur(4px);
        }
        .audit-card {
          width: min(520px, 92%);
          background: #0f172a;
          color: #e2e8f0;
          border: 2px solid rgba(248, 113, 113, 0.65);
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.4);
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }
        .audit-title {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #fca5a5;
          margin-bottom: 12px;
        }
        .audit-body {
          font-size: 13px;
          line-height: 1.5;
          color: #e2e8f0;
          margin-bottom: 16px;
        }
        .audit-body strong {
          color: #fef2f2;
        }
        .audit-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        .audit-accept {
          background: #f97316;
          color: #0b0b0b;
          border: none;
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .audit-accept:hover {
          background: #fb923c;
        }
      </style>
      <div class="audit-card" role="dialog" aria-live="polite">
        <div class="audit-title">Audit Required</div>
        <div class="audit-body">
          Vibe widgets are <strong>LLM-generated code</strong>. Before using results,
          review the widget for correctness, data handling, and safety.
          By continuing, you acknowledge the need to audit outputs.
        </div>
        <div class="audit-actions">
          <button class="audit-accept" onClick=${onAccept}>
            I Understand
          </button>
        </div>
      </div>
    </div>
  `;
}
