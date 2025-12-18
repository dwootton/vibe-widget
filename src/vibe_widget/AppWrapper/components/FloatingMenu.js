import * as React from "https://esm.sh/react@18";
import htm from "https://esm.sh/htm@3";

const html = htm.bind(React.createElement);

export default function FloatingMenu({ isOpen, onToggle, onGrabModeStart, isEditMode }) {
  return html`
    <div class="floating-menu-container">
      <style>
        .floating-menu-container {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 1000;
        }
        .menu-dot {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: #f97316;
          cursor: pointer;
          display: flex;
          align-items: center;
          justifyContent: center;
          box-shadow: 0 2px 8px rgba(249, 115, 22, 0.3);
          transition: all 0.3s ease;
        }
        .menu-dot:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 16px rgba(249, 115, 22, 0.5);
        }
        .menu-dot.spinning {
          animation: spin 2s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .menu-dot-inner {
          width: 6px;
          height: 6px;
          border-radius: 2px;
          background: white;
        }
        .menu-options {
          position: absolute;
          top: 36px;
          right: 0;
          background: #1e1e1e;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 8px;
          min-width: 150px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }
        .menu-option {
          padding: 8px 12px;
          color: #e0e0e0;
          cursor: pointer;
          border-radius: 4px;
          font-size: 13px;
          transition: background 0.2s;
        }
        .menu-option:hover {
          background: #2a2a2a;
        }
        .menu-option.disabled {
          color: #666;
          cursor: not-allowed;
        }
      </style>
      
      <div class="menu-dot ${isEditMode ? "spinning" : ""}" onClick=${onToggle}>
        <div class="menu-dot-inner"></div>
      </div>
      
      ${isOpen && html`
        <div class="menu-options">
          <div class="menu-option" onClick=${onGrabModeStart}>Edit Element</div>
          <div class="menu-option disabled">Export (Coming Soon)</div>
          <div class="menu-option disabled">View Source</div>
        </div>
      `}
    </div>
  `;
}
