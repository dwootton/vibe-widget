import * as React from "https://esm.sh/react@18";
import { createRoot } from "https://esm.sh/react-dom@18/client";
import htm from "https://esm.sh/htm@3";

const html = htm.bind(React.createElement);

function ProgressMap({ logs }) {
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return html`
    <div class="progress-wrapper">
      <style>
        .progress-wrapper {
          padding: 20px;
        }
        .progress-title {
          margin-bottom: 16px;
          color: #c9d1d9;
          font-size: 18px;
          font-weight: 600;
        }
        .progress-container {
          width: 100%;
          max-height: 300px;
          background: #0d1117;
          color: #c9d1d9;
          font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
          font-size: 13px;
          line-height: 1.6;
          padding: 16px;
          border-radius: 6px;
          border: 1px solid #30363d;
          overflow-y: auto;
        }
        .progress-container::-webkit-scrollbar {
          width: 8px;
        }
        .progress-container::-webkit-scrollbar-track {
          background: #161b22;
        }
        .progress-container::-webkit-scrollbar-thumb {
          background: #30363d;
          border-radius: 4px;
        }
        .progress-container::-webkit-scrollbar-thumb:hover {
          background: #484f58;
        }
        .log-entry {
          padding: 4px 0;
          color: #8b949e;
        }
        .log-entry:last-child {
          color: #58a6ff;
          animation: fadeIn 0.3s ease-in;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-4px); }
          to { opacity: 1; transform: translateX(0); }
        }
      </style>
      <h3 class="progress-title">Generating Widget...</h3>
      <div class="progress-container" ref=${containerRef}>
        ${logs.map((log, idx) => html`
          <div key=${idx} class="log-entry">${log}</div>
        `)}
      </div>
    </div>
  `;
}

function SandboxedRunner({ code, model }) {
  const [error, setError] = React.useState(null);
  const [GuestWidget, setGuestWidget] = React.useState(null);

  React.useEffect(() => {
    if (!code) return;

    const executeCode = async () => {
      try {
        const blob = new Blob([code], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        
        const module = await import(url);
        URL.revokeObjectURL(url);

        if (module.default && typeof module.default === 'function') {
          setGuestWidget(() => module.default);
          setError(null);
        } else {
          throw new Error('Generated code must export a default function');
        }
      } catch (err) {
        console.error('Code execution error:', err);
        setError(err.message);
      }
    };

    executeCode();
  }, [code]);

  if (error) {
    return html`
      <div style=${{
        padding: '20px',
        background: '#3c1f1f',
        color: '#ff6b6b',
        borderRadius: '6px',
        fontFamily: 'monospace'
      }}>
        <strong>Error:</strong> ${error}
      </div>
    `;
  }

  if (!GuestWidget) {
    return html`
      <div style=${{ padding: '20px', color: '#8b949e' }}>
        Loading widget...
      </div>
    `;
  }

  return html`<${GuestWidget} model=${model} html=${html} React=${React} />`;
}

function FloatingMenu({ isOpen, onToggle }) {
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
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          transition: all 0.3s ease;
        }
        .menu-dot:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }
        .menu-dot-inner {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: white;
        }
        .menu-options {
          position: absolute;
          top: 40px;
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
      
      <div class="menu-dot" onClick=${onToggle}>
        <div class="menu-dot-inner"></div>
      </div>
      
      ${isOpen && html`
        <div class="menu-options">
          <div class="menu-option disabled">Edit (Coming Soon)</div>
          <div class="menu-option disabled">Export (Coming Soon)</div>
          <div class="menu-option disabled">View Source</div>
        </div>
      `}
    </div>
  `;
}

function AppWrapper({ model }) {
  const [status, setStatus] = React.useState(model.get('status'));
  const [logs, setLogs] = React.useState(model.get('logs'));
  const [code, setCode] = React.useState(model.get('code'));
  const [isMenuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const onStatusChange = () => setStatus(model.get('status'));
    const onLogsChange = () => setLogs(model.get('logs'));
    const onCodeChange = () => setCode(model.get('code'));

    model.on('change:status', onStatusChange);
    model.on('change:logs', onLogsChange);
    model.on('change:code', onCodeChange);

    return () => {
      model.off('change:status', onStatusChange);
      model.off('change:logs', onLogsChange);
      model.off('change:code', onCodeChange);
    };
  }, [model]);

  if (status === 'generating') {
    return html`<${ProgressMap} logs=${logs} />`;
  }

  if (status === 'error') {
    return html`
      <div style=${{ 
        padding: '20px',
        background: '#3c1f1f',
        color: '#ff6b6b',
        borderRadius: '6px'
      }}>
        <strong>Error:</strong> Widget generation failed. Check logs.
        ${logs.length > 0 && html`
          <div style=${{ marginTop: '10px', fontSize: '12px' }}>
            ${logs[logs.length - 1]}
          </div>
        `}
      </div>
    `;
  }

  return html`
    <div class="vibe-container" style=${{ position: 'relative', width: '100%', minHeight: '400px' }}>
      <${SandboxedRunner} code=${code} model=${model} />
      <${FloatingMenu} isOpen=${isMenuOpen} onToggle=${() => setMenuOpen(!isMenuOpen)} />
    </div>
  `;
}

function render({ model, el }) {
  const root = createRoot(el);
  root.render(html`<${AppWrapper} model=${model} />`);
}

export default { render };
