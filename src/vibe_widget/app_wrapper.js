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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=JetBrains+Mono:wght@400&display=swap');
        
        .progress-wrapper {
          position: relative;
          padding: 32px;
          background: 
            radial-gradient(
              circle at 50% 0%,
              rgba(243, 119, 38, 0.08),
              transparent 60%
            ),
            #1a1a1a;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .progress-title {
          font-family: 'Inter', sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 20px;
          letter-spacing: -0.01em;
        }
        
        .progress-container {
          width: 100%;
          max-height: 280px;
          background: rgba(30, 30, 30, 0.5);
          color: rgba(255, 255, 255, 0.6);
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          line-height: 1.7;
          padding: 16px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          overflow-y: auto;
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
          padding: 2px 0;
          color: rgba(255, 255, 255, 0.5);
          opacity: 0;
          animation: fadeIn 0.3s ease-out forwards;
          animation-delay: calc(var(--entry-index) * 0.03s);
        }
        
        .log-entry:last-child {
          color: #F37726;
        }
        
        .log-entry::before {
          content: '▸ ';
          color: rgba(243, 119, 38, 0.5);
          margin-right: 6px;
        }
        
        @keyframes fadeIn {
          to {
            opacity: 1;
          }
        }
      </style>
      <h3 class="progress-title">Generating Widget...</h3>
      <div class="progress-container" ref=${containerRef}>
        ${logs.map((log, idx) => html`
          <div key=${idx} class="log-entry" style=${{ '--entry-index': idx }}>${log}</div>
        `)}
      </div>
    </div>
  `;
}

function SandboxedRunner({ code, model }) {
  const [error, setError] = React.useState(null);
  const [GuestWidget, setGuestWidget] = React.useState(null);
  const [isRetrying, setIsRetrying] = React.useState(false);

  React.useEffect(() => {
    if (!code) return;

    const executeCode = async () => {
      try {
        setIsRetrying(false);
        const blob = new Blob([code], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        
        const module = await import(url);
        URL.revokeObjectURL(url);

        if (module.default && typeof module.default === 'function') {
          setGuestWidget(() => module.default);
          setError(null);
          model.set('error_message', '');
          model.save_changes();
        } else {
          throw new Error('Generated code must export a default function');
        }
      } catch (err) {
        console.error('Code execution error:', err);
        
        const retryCount = model.get('retry_count') || 0;
        
        if (retryCount < 2) {
          setIsRetrying(true);
          const errorDetails = err.toString() + '\n\nStack:\n' + (err.stack || 'No stack trace');
          model.set('error_message', errorDetails);
          model.save_changes();
        } else {
          let errorMessage = err.message;
          let suggestion = '';
          
          if (err.message.includes('is not a function') || err.message.includes('Cannot read')) {
            suggestion = 'Library import error. Check CDN URL and import syntax.';
          } else if (err.message.includes('Failed to fetch')) {
            suggestion = 'Network error loading library. Check internet connection.';
          } else if (err.message.includes('Unexpected token')) {
            suggestion = 'Syntax error in generated code.';
          }
          
          setError(suggestion ? `${errorMessage}\n\nSuggestion: ${suggestion}` : errorMessage);
        }
      }
    };

    executeCode();
  }, [code, model]);

  if (isRetrying) {
    return html`
      <div style=${{ padding: '20px', color: '#ffa07a', fontSize: '14px' }}>
        Error detected. Asking LLM to fix...
      </div>
    `;
  }

  if (error) {
    return html`
      <div style=${{
        padding: '20px',
        background: '#3c1f1f',
        color: '#ff6b6b',
        borderRadius: '6px',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap'
      }}>
        <strong>Error (after 2 retry attempts):</strong> ${error}
        <div style=${{ marginTop: '16px', fontSize: '12px', color: '#ffa07a' }}>
          Check browser console for full stack trace
        </div>
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
    <div class="vibe-container" style=${{ position: 'relative', width: '100%' }}>
      <${SandboxedRunner} code=${code} model=${model} />
      <${FloatingMenu} isOpen=${isMenuOpen} onToggle=${() => setMenuOpen(!isMenuOpen)} />
    </div>
  `;
}

let rootInstance = null;

function render({ model, el }) {
  if (!rootInstance) {
    rootInstance = createRoot(el);
  }
  rootInstance.render(html`<${AppWrapper} model=${model} />`);
}

export default { render };
