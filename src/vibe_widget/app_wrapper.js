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
        
        @keyframes fadeIn {
          to {
            opacity: 1;
          }
        }
      </style>
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

function FloatingMenu({ isOpen, onToggle, onGrabModeStart }) {
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
    // Store both the description (for LLM) and bounds (for positioning)
    setGrabMode({ element: elementDescription, bounds: elementBounds });
  };

  const handleEditSubmit = (prompt) => {
    model.set('grab_edit_request', {
      element: grabMode.element,
      prompt: prompt,
    });
    model.save_changes();
    setGrabMode(null);
  };

  const handleCancel = () => {
    setGrabMode(null);
  };

  const isLoading = status === 'generating';

  // Always render the widget if we have code, regardless of status
  const hasCode = code && code.length > 0;


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
      <${LoadingOverlay} logs=${logs} hasExistingWidget=${hasCode} />
    `}
    
    ${!isLoading && hasCode && html`
      <${FloatingMenu} 
        isOpen=${isMenuOpen} 
        onToggle=${() => setMenuOpen(!isMenuOpen)}
        onGrabModeStart=${handleGrabStart}
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

function LoadingOverlay({ logs, hasExistingWidget }) {
  // If there's an existing widget, show progress overlay on top
  // If no widget yet, show full progress view
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
        </div>
      </div>
    `;
  }

  // No existing widget - show full progress view
  return html`<${ProgressMap} logs=${logs} />`;
}


function SelectionOverlay({ onElementSelect, onCancel }) {
  const [hoveredEl, setHoveredEl] = React.useState(null);
  const [bounds, setBounds] = React.useState(null);

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
        } else {
          setBounds(null);
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
        border: '2px solid #667eea',
        background: 'rgba(102, 126, 234, 0.1)',
        borderRadius: '2px',
        pointerEvents: 'none',
        transition: 'all 0.1s ease-out',
      }}/>
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
function EditPromptPanel({ elementBounds, elementDescription, onSubmit, onCancel }) {
  const [prompt, setPrompt] = React.useState('');
  const panelRef = React.useRef(null);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });

  const PANEL_WIDTH = 320;
  const PANEL_HEIGHT = 52; // Approximate height of compact input
  const PADDING = 12;
  const GAP = 8; // Gap between element and panel

  React.useEffect(() => {
    if (!elementBounds) return;

    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // Calculate element center
    const elCenterX = elementBounds.left + elementBounds.width / 2;
    const elCenterY = elementBounds.top + elementBounds.height / 2;

    // Default: position below the element, centered horizontally
    let top = elementBounds.bottom + GAP;
    let left = elCenterX - PANEL_WIDTH / 2;

    // If panel would go off the bottom, position above the element
    if (top + PANEL_HEIGHT + PADDING > viewport.height) {
      top = elementBounds.top - PANEL_HEIGHT - GAP;
    }

    // If panel would still be off screen (element at very top), position to the side
    if (top < PADDING) {
      top = Math.max(PADDING, elCenterY - PANEL_HEIGHT / 2);
      // Position to the right of element if there's room, otherwise left
      if (elementBounds.right + GAP + PANEL_WIDTH + PADDING < viewport.width) {
        left = elementBounds.right + GAP;
      } else {
        left = elementBounds.left - PANEL_WIDTH - GAP;
      }
    }

    // Clamp horizontal position to stay on screen
    left = Math.max(PADDING, Math.min(left, viewport.width - PANEL_WIDTH - PADDING));

    // Clamp vertical position
    top = Math.max(PADDING, Math.min(top, viewport.height - PANEL_HEIGHT - PADDING));

    setPosition({ top, left });
  }, [elementBounds]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && prompt.trim()) {
      onSubmit(prompt);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return html`
    <div 
      ref=${panelRef}
      class="edit-panel" 
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
      gap: '6px',
      alignItems: 'center',
    }}
    >
      <input
        type="text"
        value=${prompt}
        onInput=${(e) => setPrompt(e.target.value)}
        onKeyDown=${handleKeyDown}
        placeholder="What would you like to change?"
        style=${{
      flex: 1,
      padding: '10px 12px',
      borderRadius: '6px',
      border: '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(255,255,255,0.05)',
      color: 'white',
      fontSize: '13px',
      outline: 'none',
    }}
        autoFocus
      />
      <button 
        onClick=${() => prompt.trim() && onSubmit(prompt)} 
        disabled=${!prompt.trim()}
        style=${{
      padding: '10px 14px',
      borderRadius: '6px',
      background: prompt.trim()
        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        : 'rgba(255,255,255,0.1)',
      color: prompt.trim() ? 'white' : 'rgba(255,255,255,0.4)',
      border: 'none',
      cursor: prompt.trim() ? 'pointer' : 'not-allowed',
      fontSize: '13px',
      fontWeight: 500,
      transition: 'all 0.2s',
    }}
      >
        Apply
      </button>
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