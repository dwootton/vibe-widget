import * as React from "react";
import htm from "htm";

const html = htm.bind(React.createElement);

export default function FloatingMenu({
  isOpen,
  onToggle,
  onGrabModeStart,
  onViewSource,
  highAuditCount,
  isEditMode
}) {
  return html`
    <div class="floating-menu-container">
      <style>
        .floating-menu-container {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 1000;
        }
        .menu-dot-wrapper {
          position: relative;
          width: 20px;
          height: 20px;
        }
        .menu-dot {
          width: 20px;
          height: 20px;
          border-radius: 0;
          background: #ffffff;
          border: 2px solid #2a2a2a;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: none;
          transition: none;
        }
        .menu-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 20px;
          height: 20px;
          border-radius: 999px;
          background: #f87171;
          color: #0b0b0b;
          font-size: 9px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .menu-dot:hover {
          transform: none;
          box-shadow: none;
        }
        .menu-dot.spinning {
          animation: spin 2s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .menu-dot-inner {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #f97316;
        }
        .menu-options {
          position: absolute;
          top: 16px;
          right: 0;
          background: #0f0f0f;
          border: 1px solid rgba(242, 240, 233, 0.35);
          border-radius: 2px;
          padding: 6px;
          min-width: 170px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }
        .menu-option {
          padding: 6px 8px 6px 20px;
          color: #f2f0e9;
          cursor: pointer;
          border-radius: 2px;
          font-size: 12px;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          position: relative;
          transition: background 0.2s;
        }
        .menu-option::before {
          content: ">";
          position: absolute;
          left: 8px;
          color: #f2f0e9;
        }
        .menu-option:hover {
          background: #1a1a1a;
        }
        .menu-option.disabled {
          color: #6b7280;
          cursor: not-allowed;
        }
        .menu-option.disabled::before {
          color: #6b7280;
        }
      </style>
      
      <div class="menu-dot-wrapper">
        <div class="menu-dot ${isEditMode ? "spinning" : ""}" onClick=${onToggle}>
          <div class="menu-dot-inner"></div>
        </div>
        ${highAuditCount > 0 && html`
          <div class="menu-badge" title="High impact audit items">
            ${highAuditCount}
          </div>
        `}
      </div>
      
      ${isOpen && html`
        <div class="menu-options">
          <div class="menu-option" onClick=${onGrabModeStart}>Edit Element</div>
          <div class="menu-option" onClick=${onViewSource}>Edit Code</div>
          <div class="menu-option disabled">Export (Coming Soon)</div>
        </div>
      `}
    </div>
  `;
}
