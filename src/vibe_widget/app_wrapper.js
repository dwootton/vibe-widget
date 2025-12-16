import * as React from "https://esm.sh/react@18";
import { createRoot } from "https://esm.sh/react-dom@18/client";
import htm from "https://esm.sh/htm@3";

const html = htm.bind(React.createElement);

// Inject global styles to fix Jupyter widget background
const globalStyles = document.createElement('style');
globalStyles.textContent = `
  .cell-output-ipywidget-background {
    background: transparent !important;
  }
  .jp-OutputArea-output {
    background: transparent !important;
  }
`;
if (!document.querySelector('#vibe-widget-global-styles')) {
  globalStyles.id = 'vibe-widget-global-styles';
  document.head.appendChild(globalStyles);
}

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
          border-radius: 6px;
          border: none;
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
        
        .animated-dots {
          display: inline-block;
          margin-left: 2px;
        }
        
        .animated-dots span {
          animation: dotPulse 1.4s infinite;
          opacity: 0;
        }
        
        .animated-dots span:nth-child(1) {
          animation-delay: 0s;
        }
        
        .animated-dots span:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .animated-dots span:nth-child(3) {
          animation-delay: 0.4s;
        }
        
        @keyframes dotPulse {
          0%, 80%, 100% {
            opacity: 0;
          }
          40% {
            opacity: 1;
          }
        }
        
        @keyframes fadeIn {
          to {
            opacity: 1;
          }
        }
      </style>
      <div class="progress-container" ref=${containerRef}>
        ${logs.map((log, idx) => html`
          <div key=${idx} class="log-entry" style=${{ '--entry-index': idx }}>
            ${log}${idx === logs.length - 1 && html`<span class="animated-dots"><span>.</span><span>.</span><span>.</span></span>`}
          </div>
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

function FloatingMenu({ isOpen, onToggle, onGrabModeStart, isEditMode }) {
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
          justify-content: center;
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
      
      <div class="menu-dot ${isEditMode ? 'spinning' : ''}" onClick=${onToggle}>
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

function AppWrapper({ model }) {
  const [status, setStatus] = React.useState(model.get('status'));
  const [logs, setLogs] = React.useState(model.get('logs'));
  const [code, setCode] = React.useState(model.get('code'));
  const [isMenuOpen, setMenuOpen] = React.useState(false);
  const [grabMode, setGrabMode] = React.useState(null);
  const [promptCache, setPromptCache] = React.useState({});


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

  const handleGrabStart = () => {
    setMenuOpen(false);
    setGrabMode('selecting');
  };

  const handleElementSelect = (elementDescription, elementBounds) => {
    const elementKey = `${elementDescription.tag}-${elementDescription.classes}-${elementDescription.text?.slice(0,20)}`;
    setGrabMode({ element: elementDescription, bounds: elementBounds, elementKey });
  };

  const handleEditSubmit = (prompt) => {
    model.set('grab_edit_request', {
      element: grabMode.element,
      prompt: prompt,
    });
    model.save_changes();
    setPromptCache(prev => ({ ...prev, [grabMode.elementKey]: prompt }));
    setGrabMode(null);
  };

  const handleCancel = (currentPrompt) => {
    if (grabMode?.elementKey && currentPrompt) {
      setPromptCache(prev => ({ ...prev, [grabMode.elementKey]: currentPrompt }));
    }
    setGrabMode(null);
  };

  const isLoading = status === 'generating';

  // Always render the widget if we have code, regardless of status
  const hasCode = code && code.length > 0;

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        if (!isLoading && hasCode && !grabMode) {
          handleGrabStart();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, hasCode, grabMode]);


  return html`
    <div class="vibe-container" style=${{ position: 'relative', width: '100%' }}>
    ${hasCode && html`
      <div style=${{
        opacity: isLoading ? 0.4 : 1,
        pointerEvents: isLoading ? 'none' : 'auto',
        transition: 'opacity 0.3s ease',
      }}>
        <${SandboxedRunner} code=${code} model=${model} />
      </div>
    `}
    
    ${isLoading && html`
      <${LoadingOverlay} 
        logs=${logs} 
        hasExistingWidget=${hasCode}
        editInProgress=${model.get('edit_in_progress')}
        onCancel=${() => {
          model.set('cancel_edit', true);
          model.save_changes();
        }}
      />
    `}
    
    ${!isLoading && hasCode && html`
      <${FloatingMenu} 
        isOpen=${isMenuOpen} 
        onToggle=${() => setMenuOpen(!isMenuOpen)}
        onGrabModeStart=${handleGrabStart}
        isEditMode=${!!grabMode}
      />
    `}
      
      ${grabMode === 'selecting' && html`
        <${SelectionOverlay} 
          onElementSelect=${handleElementSelect}
          onCancel=${handleCancel}
        />
      `}
      
      ${grabMode && grabMode !== 'selecting' && html`
        <${EditPromptPanel}
          elementBounds=${grabMode.bounds}
          elementDescription=${grabMode.element}
          initialPrompt=${promptCache[grabMode.elementKey] || ''}
          onSubmit=${handleEditSubmit}
          onCancel=${handleCancel}
        />
      `}
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

function LoadingOverlay({ logs, hasExistingWidget, editInProgress, onCancel }) {
  const [cancelHovered, setCancelHovered] = React.useState(false);
  
  if (hasExistingWidget) {
    return html`
      <div class="loading-overlay" style=${{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(3px)',
      }}>
        <div style=${{
          width: '90%',
          maxWidth: '500px',
        }}>
          <${ProgressMap} logs=${logs} />
          ${editInProgress && html`
            <div style=${{
              display: 'flex',
              justifyContent: 'center',
              marginTop: '16px',
            }}>
              <button
                onClick=${onCancel}
                onMouseEnter=${() => setCancelHovered(true)}
                onMouseLeave=${() => setCancelHovered(false)}
                style=${{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: cancelHovered ? 'rgba(255, 100, 100, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                  color: cancelHovered ? '#ff6b6b' : 'rgba(255, 255, 255, 0.7)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Cancel Edit
              </button>
            </div>
          `}
        </div>
      </div>
    `;
  }

  return html`<${ProgressMap} logs=${logs} />`;
}


function SelectionOverlay({ onElementSelect, onCancel }) {
  const [hoveredEl, setHoveredEl] = React.useState(null);
  const [bounds, setBounds] = React.useState(null);
  const [tagName, setTagName] = React.useState(null);

  React.useEffect(() => {
    // Use position-aware lookup instead of e.target
    const handleMouseMove = (e) => {
      const el = getElementAtPosition(e.clientX, e.clientY);

      if (el !== hoveredEl) {
        setHoveredEl(el);
        if (el) {
          const rect = el.getBoundingClientRect();
          setBounds({
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          });
          setTagName(el.tagName.toLowerCase());
        } else {
          setBounds(null);
          setTagName(null);
        }
      }
    };

    const handleClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Re-query element at click position to avoid stale closure
      const clickedEl = getElementAtPosition(e.clientX, e.clientY);
      
      console.log('[Grab] Click at', e.clientX, e.clientY);
      console.log('[Grab] Found element:', clickedEl);
      console.log('[Grab] Element tag:', clickedEl?.tagName);
      
      if (clickedEl) {
        const rect = clickedEl.getBoundingClientRect();
        const clickBounds = {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
        const description = describeElement(clickedEl);
        console.log('[Grab] Description:', description);
        onElementSelect(description, clickBounds);
      } else {
        console.log('[Grab] No valid element at click position');
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') onCancel();
    };

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleEscape);

    // Change cursor to indicate grab mode
    document.body.style.cursor = 'crosshair';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.cursor = '';
    };
  }, [hoveredEl, bounds, onElementSelect, onCancel]);

  return html`
    <div class="grab-overlay" style=${{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      ${bounds && html`
        <div class="highlight-box" style=${{
        position: 'fixed',
        left: bounds.left + 'px',
        top: bounds.top + 'px',
        width: bounds.width + 'px',
        height: bounds.height + 'px',
        outline: '2px solid #f97316',
        outlineOffset: '0px',
        background: 'rgba(249, 115, 22, 0.1)',
        borderRadius: '2px',
        pointerEvents: 'none',
        transition: 'all 0.1s ease-out',
        boxSizing: 'border-box',
      }}>
          ${tagName && html`
            <div style=${{
              position: 'absolute',
              top: '-14px',
              left: '-2px',
              background: '#f97316',
              color: 'white',
              fontSize: '10px',
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: '3px 3px 0 0',
              whiteSpace: 'nowrap',
              fontFamily: 'ui-monospace, monospace',
            }}>
              ${tagName}
            </div>
          `}
        </div>
      `}
      <div class="grab-hint" style=${{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.85)',
      color: 'white',
      padding: '10px 20px',
      borderRadius: '8px',
      fontSize: '13px',
      pointerEvents: 'none',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    }}>
        Click an element to edit${' '}&bull;${' '}Escape to cancel
      </div>
    </div>
  `;
}
function EditPromptPanel({ elementBounds, elementDescription, initialPrompt, onSubmit, onCancel }) {
  const [prompt, setPrompt] = React.useState(initialPrompt || '');
  const panelRef = React.useRef(null);
  const textareaRef = React.useRef(null);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const [textareaHeight, setTextareaHeight] = React.useState(40);
  const [panelHovered, setPanelHovered] = React.useState(false);
  const [buttonHovered, setButtonHovered] = React.useState(false);

  const PANEL_WIDTH = 320;
  const MIN_TEXTAREA_HEIGHT = 40;
  const MAX_TEXTAREA_HEIGHT = 288;
  const LINE_HEIGHT = 24;
  const PADDING = 12;
  const GAP = 8;
  
  const getButtonOpacity = () => {
    if (buttonHovered) return 1;
    if (panelHovered) return 0.3;
    return 0.1;
  };

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onCancel(prompt);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel, prompt]);

  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = MIN_TEXTAREA_HEIGHT + 'px';
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT);
      setTextareaHeight(newHeight);
      textareaRef.current.style.height = newHeight + 'px';
    }
  }, [prompt]);

  React.useEffect(() => {
    if (!elementBounds) return;

    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const panelHeight = textareaHeight + 56;

    const elCenterX = elementBounds.left + elementBounds.width / 2;
    const elCenterY = elementBounds.top + elementBounds.height / 2;

    let top = elementBounds.bottom + GAP;
    let left = elCenterX - PANEL_WIDTH / 2;

    if (top + panelHeight + PADDING > viewport.height) {
      top = elementBounds.top - panelHeight - GAP;
    }

    if (top < PADDING) {
      top = Math.max(PADDING, elCenterY - panelHeight / 2);
      if (elementBounds.right + GAP + PANEL_WIDTH + PADDING < viewport.width) {
        left = elementBounds.right + GAP;
      } else {
        left = elementBounds.left - PANEL_WIDTH - GAP;
      }
    }

    left = Math.max(PADDING, Math.min(left, viewport.width - PANEL_WIDTH - PADDING));
    top = Math.max(PADDING, Math.min(top, viewport.height - panelHeight - PADDING));

    setPosition({ top, left });
  }, [elementBounds, textareaHeight]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        e.stopPropagation();
      } else if (prompt.trim()) {
        e.preventDefault();
        e.stopPropagation();
        onSubmit(prompt);
      }
    } else if (e.key === 'Escape') {
      onCancel(prompt);
    }
  };

  return html`
    <div>
      ${elementBounds && html`
        <div class="selected-element-highlight" style=${{
          position: 'fixed',
          left: elementBounds.left + 'px',
          top: elementBounds.top + 'px',
          width: elementBounds.width + 'px',
          height: elementBounds.height + 'px',
          outline: '2px solid #f97316',
          outlineOffset: '0px',
          background: 'rgba(249, 115, 22, 0.1)',
          borderRadius: '2px',
          pointerEvents: 'none',
          zIndex: 10000,
          boxSizing: 'border-box',
        }}>
          ${elementDescription?.tag && html`
            <div style=${{
              position: 'absolute',
              top: '-18px',
              left: '-2px',
              background: '#f97316',
              color: 'white',
              fontSize: '10px',
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: '3px 3px 0 0',
              whiteSpace: 'nowrap',
              fontFamily: 'ui-monospace, monospace',
            }}>
              ${elementDescription.tag.toLowerCase()}
            </div>
          `}
        </div>
      `}
      <div 
        ref=${panelRef}
        class="edit-panel" 
        onMouseEnter=${() => setPanelHovered(true)}
        onMouseLeave=${() => setPanelHovered(false)}
        style=${{
        position: 'fixed',
        top: position.top + 'px',
        left: position.left + 'px',
        width: PANEL_WIDTH + 'px',
        background: 'rgba(26, 26, 26, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '10px',
        padding: '8px',
        zIndex: 10001,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
      >
        <div style=${{ position: 'relative', width: '100%' }}>
          <textarea
            ref=${textareaRef}
            value=${prompt}
            onInput=${(e) => setPrompt(e.target.value)}
            onKeyDown=${handleKeyDown}
            placeholder="What would you like to change?"
            rows="1"
            style=${{
          width: '100%',
          minHeight: MIN_TEXTAREA_HEIGHT + 'px',
          maxHeight: MAX_TEXTAREA_HEIGHT + 'px',
          padding: '10px 50px 10px 12px',
          borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.05)',
          color: 'white',
          fontSize: '13px',
          lineHeight: '20px',
          outline: 'none',
          resize: 'none',
          overflowY: textareaHeight >= MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
        }}
            autoFocus
          />
          <button 
            onClick=${() => prompt.trim() ? onSubmit(prompt) : onCancel(prompt)} 
            onMouseEnter=${() => setButtonHovered(true)}
            onMouseLeave=${() => setButtonHovered(false)}
            style=${{
          position: 'absolute',
          top: '6px',
          right: textareaHeight >= MAX_TEXTAREA_HEIGHT ? '16px' : '8px',
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          background: prompt.trim()
            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            : 'rgba(255,255,255,0.15)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'opacity 0.2s, background 0.2s',
          padding: 0,
          opacity: getButtonOpacity(),
        }}
            title=${prompt.trim() ? "Send (Enter)" : "Cancel (Esc)"}
          >
            ${prompt.trim() ? html`
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            ` : html`
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            `}
          </button>
        </div>
        <div style=${{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.4)',
          paddingLeft: '4px',
        }}>
          Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  `;
}


function isElementVisible(element, computedStyle) {
  if (!computedStyle) computedStyle = window.getComputedStyle(element);

  // Check visibility and display
  if (computedStyle.visibility === 'hidden') return false;
  if (computedStyle.display === 'none') return false;
  if (parseFloat(computedStyle.opacity) === 0) return false;

  // Check if element has dimensions
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;

  return true;
}

function isValidGrabbableElement(element) {
  // Skip non-element nodes
  if (!(element instanceof Element)) return false;

  // Skip the grab overlay itself and its children
  if (element.closest('.grab-overlay')) return false;
  
  // Skip the edit panel
  if (element.closest('.edit-panel')) return false;
  
  // Skip the loading overlay
  if (element.closest('.loading-overlay')) return false;

  // Skip script, style, and other non-visual elements
  const skipTags = ['SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD', 'HTML', 'BODY', 'DEFS', 'CLIPPATH'];
  if (skipTags.includes(element.tagName)) return false;

  const computedStyle = window.getComputedStyle(element);

  // Must be visible
  if (!isElementVisible(element, computedStyle)) return false;

  // Skip pointer-events:none ONLY for non-SVG elements
  // SVG elements often have pointer-events:none for interaction reasons but we still want to select them
  const isSVGElement = element instanceof SVGElement;
  if (!isSVGElement && computedStyle.pointerEvents === 'none') return false;

  // Prefer elements that are likely meaningful content
  const meaningfulTags = [
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'A', 'BUTTON',
    'IMG', 'SVG', 'RECT', 'CIRCLE', 'PATH', 'LINE', 'TEXT', 'G',
    'CANVAS', 'VIDEO', 'TABLE', 'TH', 'TD', 'LI', 'LABEL', 'INPUT',
    'POLYGON', 'POLYLINE', 'ELLIPSE'
  ];

  const hasMeaningfulTag = meaningfulTags.includes(element.tagName);
  const hasClass = element.classList.length > 0;
  const hasText = element.textContent?.trim().length > 0;

  // Accept if it's a meaningful tag, has classes, has text, or is SVG
  return hasMeaningfulTag || hasClass || hasText || isSVGElement;
}

// ============================================
// Position-Aware Element Lookup
// ============================================

function getElementAtPosition(clientX, clientY) {
  // Get all elements at this point, from topmost to bottom
  const elementsAtPoint = document.elementsFromPoint(clientX, clientY);

  for (const element of elementsAtPoint) {
    if (isValidGrabbableElement(element)) {
      return element;
    }
  }

  return null;
}

// ============================================
// Element Description for LLM
// ============================================

function describeElement(el) {
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList).join(' ');
  const text = el.textContent?.trim().substring(0, 50);
  const ancestors = getAncestorPath(el);

  // Sibling context (important for D3 data-bound elements)
  const siblingCount = el.parentElement
    ? Array.from(el.parentElement.children).filter(
      sibling => sibling.tagName === el.tagName
    ).length
    : 1;

  // For SVG elements, include key attributes
  let attrs = '';
  if (el instanceof SVGElement) {
    attrs = ['fill', 'stroke', 'd', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height']
      .map(a => {
        const val = el.getAttribute(a);
        return val ? `${a}="${val.substring(0, 30)}"` : '';
      })
      .filter(Boolean)
      .join(' ');
  }

  // Compute style hints for identification
  const computedStyle = window.getComputedStyle(el);
  const styleHints = {
    color: computedStyle.color,
    backgroundColor: computedStyle.backgroundColor,
    fill: computedStyle.fill,
  };

  return {
    tag,
    classes,
    text: text || null,
    attributes: attrs || null,
    ancestors,
    siblingCount,
    isDataBound: siblingCount > 1, // Likely D3/data-bound if many siblings of same type
    styleHints,
    description: `<${tag}${classes ? ` class="${classes}"` : ''}${attrs ? ` ${attrs}` : ''}>${text || ''}</${tag}>`
  };
}

function getAncestorPath(el, depth = 3) {
  const path = [];
  let current = el.parentElement;
  while (current && path.length < depth) {
    // Handle both HTML className (string) and SVG className (SVGAnimatedString)
    const className = typeof current.className === 'string' 
      ? current.className 
      : current.className?.baseVal || '';
    
    if (current.tagName !== 'DIV' || className) {
      path.push(`${current.tagName.toLowerCase()}${className ? '.' + className.split(' ')[0] : ''}`);
    }
    current = current.parentElement;
  }
  return path.reverse().join(' > ');
}