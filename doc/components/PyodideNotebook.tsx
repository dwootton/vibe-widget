import React, { useState, useEffect, useRef, useCallback, ReactNode, Key, useMemo } from 'react';
// @ts-ignore
import { html } from 'htm/react/index.js';
import { pyodideRuntime, PyodideState, WidgetModel } from '../utils/PyodideRuntime';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialLight, materialDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import DynamicWidget from './DynamicWidget';
import { EXAMPLES } from '../data/examples';
import { useIsMobile } from '../utils/useIsMobile';


/**
 * Chevron icon for collapsible sections
 */
function ChevronIcon({ expanded, className = '' }: { expanded: boolean; className?: string }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''} ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export interface NotebookCell {
  type: 'markdown' | 'code';
  content: string;
  readOnly?: boolean; // If true, show as static display
  defaultCollapsed?: boolean; // If true, start collapsed
  label?: string; // Optional label for collapsed state
}

export interface CellOutput {
  type: 'stdout' | 'stderr' | 'result' | 'widget';
  content: any;
  widgetId?: string;
  moduleUrl?: string;
}

interface CellState {
  running: boolean;
  executed: boolean;
  outputs: CellOutput[];
  codeCollapsed: boolean;
  outputCollapsed: boolean;
}

interface PyodideNotebookProps {
  cells: NotebookCell[];
  title?: string;
  dataFiles?: { url: string; varName: string; type?: string }[];
  widgetConfig?: Record<string, { url: string; match: string[] }>;
  notebookKey?: string; // Unique key to identify the notebook for data loading
}

// Helper type for components used in .map()
interface WithKey { key?: Key; }

/**
 * PyodideNotebook - A Jupyter-style notebook powered by Pyodide
 * 
 * Runs actual Python code in the browser:
 * - pandas, numpy, scikit-learn available
 * - Cross-widget reactivity via traitlets simulation
 * - Pre-generated widgets load from /examples
 */
export default function PyodideNotebook({ cells, title, dataFiles = [], widgetConfig = {}, notebookKey }: PyodideNotebookProps) {
  const [pyodideState, setPyodideState] = useState<PyodideState>({
    ready: false,
    loading: false,
    error: null,
    loadProgress: 0,
  });
  const [cellStates, setCellStates] = useState<CellState[]>(
    cells.map((cell) => ({
      running: false,
      executed: false,
      outputs: [],
      codeCollapsed: cell.defaultCollapsed ?? false,
      outputCollapsed: false,
    }))
  );
  const [widgets, setWidgets] = useState<Map<string, { moduleUrl: string; model: WidgetModel }>>(new Map());
  const loadedDataFilesRef = useRef<Set<string>>(new Set());
  const currentNotebookKeyRef = useRef<string | undefined>(undefined);
  const isMobile = useIsMobile();

  const mobilePreview = useMemo(() => {
    if (!notebookKey) return EXAMPLES[0];
    return EXAMPLES.find(ex => ex.id === notebookKey) || EXAMPLES[0];
  }, [notebookKey]);

  // Subscribe to Pyodide state changes
  useEffect(() => {
    if (isMobile) return;
    return pyodideRuntime.onStateChange(setPyodideState);
  }, [isMobile]);

  // Set up widget display handler
  useEffect(() => {
    if (isMobile) return;
    pyodideRuntime.setWidgetHandler((widgetId, moduleUrl, model) => {
      setWidgets(prev => {
        const next = new Map(prev);
        next.set(widgetId, { moduleUrl, model: model as WidgetModel });
        return next;
      });
    });
  }, [isMobile]);

  // Load Pyodide on mount
  useEffect(() => {
    if (isMobile) return;
    pyodideRuntime.load().catch(console.error);
  }, [isMobile]);

  // Load data files when Pyodide is ready or when notebook changes
  useEffect(() => {
    if (isMobile || !pyodideState.ready || dataFiles.length === 0) return;

    // Check if we need to load new data files
    const notebookChanged = currentNotebookKeyRef.current !== notebookKey;
    if (notebookChanged) {
      currentNotebookKeyRef.current = notebookKey;
    }

    // Load only new files that haven't been loaded yet
    const filesToLoad = dataFiles.filter(
      (file: any) => !loadedDataFilesRef.current.has(file.url)
    );

    if (filesToLoad.length === 0 && !notebookChanged) return;

    // Load new data files without restarting kernel
    Promise.all(
      filesToLoad.map((file: any) => {
        loadedDataFilesRef.current.add(file.url);
        return pyodideRuntime.loadDataFile(file.url, file.varName, file.type);
      })
    ).catch(console.error);
  }, [dataFiles, isMobile, notebookKey, pyodideState.ready]);

  // Set widget configuration when notebook changes or Pyodide becomes ready
  useEffect(() => {
    if (isMobile || !pyodideState.ready || Object.keys(widgetConfig).length === 0) return;
    
    pyodideRuntime.setWidgetConfig(widgetConfig).catch(console.error);
  }, [widgetConfig, isMobile, pyodideState.ready, notebookKey]);

  const runCell = useCallback(async (index: number) => {
    if (isMobile) return;

    const cell = cells[index];
    if (cell.type !== 'code') return;

    // If Pyodide not ready, try to load it first
    if (!pyodideState.ready) {
      try {
        await pyodideRuntime.load();
      } catch (error: any) {
        setCellStates(prev => {
          const next = [...prev];
          next[index] = {
            ...next[index],
            running: false,
            executed: true,
            outputs: [{ type: 'stderr', content: `Failed to load Python runtime: ${error.message}` }]
          };
          return next;
        });
        return;
      }
    }

    // Update cell state to running
    setCellStates(prev => {
      const next = [...prev];
      next[index] = { ...next[index], running: true, outputs: [] };
      return next;
    });

    const outputs: CellOutput[] = [];

    try {
      // Extract Python code from HTML if wrapped in <pre><code> tags
      let pythonCode = cell.content;
      const codeMatch = cell.content.match(/<code[^>]*>([\s\S]*?)<\/code>/);
      if (codeMatch) {
        pythonCode = codeMatch[1]
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
      }

      const result = await pyodideRuntime.runPython(pythonCode, (text, type) => {
        if (text.trim()) {
          outputs.push({ type, content: text });
        }
      });

      // Check if result is displayable
      if (result !== undefined && result !== null) {
        outputs.push({ type: 'result', content: String(result) });
      }

    } catch (error: any) {
      outputs.push({ type: 'stderr', content: error.message });
    }

    setCellStates(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        running: false,
        executed: true,
        outputs,
      };
      return next;
    });
  }, [cells, isMobile, pyodideState.ready]);

  const runAllCells = useCallback(async () => {
    if (isMobile) return;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].type === 'code' && !cells[i].readOnly) {
        await runCell(i);
      }
    }
  }, [cells, isMobile, runCell]);

  const toggleCodeCollapse = useCallback((index: number) => {
    setCellStates(prev => {
      const next = [...prev];
      next[index] = { ...next[index], codeCollapsed: !next[index].codeCollapsed };
      return next;
    });
  }, []);

  const toggleOutputCollapse = useCallback((index: number) => {
    setCellStates(prev => {
      const next = [...prev];
      next[index] = { ...next[index], outputCollapsed: !next[index].outputCollapsed };
      return next;
    });
  }, []);

  const collapseAllCode = useCallback(() => {
    setCellStates(prev => prev.map(s => ({ ...s, codeCollapsed: true })));
  }, []);

  const expandAllCode = useCallback(() => {
    setCellStates(prev => prev.map(s => ({ ...s, codeCollapsed: false })));
  }, []);

  if (isMobile) {
    return (
      <div className="bg-white border-2 border-slate rounded-2xl p-6 shadow-hard-sm">
        {title && (
          <div className="mb-4">
            <h1 className="text-3xl font-display font-bold mb-2">{title}</h1>
            <p className="text-sm text-slate/70 font-mono">
              Full notebook playback lives on desktop. Enjoy a lightweight widget preview while on mobile.
            </p>
          </div>
        )}
        {mobilePreview && (
          <div className="mt-6 bg-[#F2F0E9] border-2 border-slate/10 rounded-xl p-3">
            <DynamicWidget
              moduleUrl={mobilePreview.moduleUrl}
              exampleId={mobilePreview.id}
              dataUrl={mobilePreview.dataUrl}
              dataType={mobilePreview.dataType}
            />
          </div>
        )}
        <p className="mt-4 text-xs font-mono text-slate/60">
          Tip: open this doc on a larger screen to run Python in-browser with Pyodide.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {title && (
        <div className="mb-8">
          <h1 className="text-5xl font-display font-bold mb-4">{title}</h1>
        </div>
      )}

      {/* Pyodide Loading Status */}
      {!pyodideState.ready && (
        <div className="mb-8 bg-white border-2 border-slate/20 rounded-lg p-6 shadow-sm">
          {pyodideState.loading ? (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin" />
                <span className="font-mono text-sm">Loading Python runtime...</span>
              </div>
              <div className="w-full bg-slate/10 rounded-full h-2">
                <div
                  className="bg-orange h-2 rounded-full transition-all duration-300"
                  style={{ width: `${pyodideState.loadProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate/50 mt-2 font-mono">
                Loading vibe-widget, pandas, numpy ({pyodideState.loadProgress}%)
              </p>
            </div>
          ) : pyodideState.error ? (
            <div className="text-red-600">
              <p className="font-bold">Failed to load Python runtime</p>
              <p className="text-sm font-mono mt-2">{pyodideState.error}</p>
            </div>
          ) : (
            <button
              onClick={() => pyodideRuntime.load()}
              className="bg-orange text-white px-4 py-2 rounded-lg font-mono text-sm hover:bg-orange/80 transition-colors"
            >
              Load Python Runtime
            </button>
          )}
        </div>
      )}

      {/* Run All Button */}
      {pyodideState.ready && (
        <div className="mb-6 flex flex-wrap gap-3 items-center">
          <button
            onClick={runAllCells}
            className="bg-orange text-white px-4 py-2 rounded-lg font-mono text-sm hover:bg-orange/80 transition-colors flex items-center gap-2"
          >
            <span>▶</span> Run All Cells
          </button>
          <button
            onClick={collapseAllCode}
            className="bg-slate/10 text-slate px-3 py-2 rounded-lg font-mono text-xs hover:bg-slate/20 transition-colors"
          >
            ⊟ Collapse All
          </button>
          <button
            onClick={expandAllCode}
            className="bg-slate/10 text-slate px-3 py-2 rounded-lg font-mono text-xs hover:bg-slate/20 transition-colors"
          >
            ⊞ Expand All
          </button>
          <span className="text-slate/50 text-sm font-mono">
            Python ready • pandas, numpy, sklearn
          </span>
        </div>
      )}

      {/* Notebook Cells */}
      <div className="space-y-4">
        {cells.map((cell, index) => (
          <NotebookCellComponent
            key={index}
            cell={cell}
            index={index}
            state={cellStates[index]}
            widgets={widgets}
            pyodideReady={pyodideState.ready}
            onRun={() => runCell(index)}
            onToggleCode={() => toggleCodeCollapse(index)}
            onToggleOutput={() => toggleOutputCollapse(index)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual notebook cell
 */
interface NotebookCellComponentProps extends WithKey {
  cell: NotebookCell;
  index: number;
  state: CellState;
  widgets: Map<string, { moduleUrl: string; model: WidgetModel }>;
  pyodideReady: boolean;
  onRun: () => void;
  onToggleCode: () => void;
  onToggleOutput: () => void;
}

function NotebookCellComponent(props: NotebookCellComponentProps) {
  const { cell, index, state, widgets, pyodideReady, onRun, onToggleCode, onToggleOutput } = props;
  const [markdownCollapsed, setMarkdownCollapsed] = useState(cell.defaultCollapsed ?? false);
  // const codeRef = useRef<HTMLDivElement>(null);

  if (cell.type === 'markdown') {
    // Extract title from HTML for collapsed preview
    const titleMatch = cell.content.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/);
    const previewTitle = titleMatch ? titleMatch[1] : 'Markdown';

    return (
      <div className="bg-white border-2 border-slate/10 rounded-lg overflow-hidden">
        <button
          onClick={() => setMarkdownCollapsed(!markdownCollapsed)}
          className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-slate/5 transition-colors"
        >
          <ChevronIcon expanded={!markdownCollapsed} className="text-slate/40" />
          <span className="font-mono text-xs text-slate/50">Markdown</span>
          {markdownCollapsed && (
            <span className="text-sm text-slate/60 truncate">{previewTitle}</span>
          )}
        </button>
        {!markdownCollapsed && (
          <div className="px-6 pb-6">
            <div
              className="prose prose-slate max-w-none"
              dangerouslySetInnerHTML={{ __html: cell.content }}
            />
          </div>
        )}
      </div>
    );
  }

  // Code cell
  const hasOutput = state.outputs.length > 0 || state.running;
  const hasWidget = state.outputs.some(o => o.type === 'result' && o.content.includes('Widget:'));
  const codePreview = cell.content.split('\n')[0].slice(0, 50) + (cell.content.length > 50 ? '...' : '');

  return (
    <div className="bg-white border-2 border-slate/20 rounded-lg overflow-hidden shadow-sm">
      {/* Code Input Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate/5 border-b border-slate/10">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleCode}
            className="flex items-center gap-2 hover:bg-slate/10 rounded px-1 py-0.5 transition-colors"
          >
            <ChevronIcon expanded={!state.codeCollapsed} className="text-slate/40" />
            <span className="font-mono text-xs text-slate/50">
              In [{state.executed ? index + 1 : ' '}]:
            </span>
          </button>
          {state.codeCollapsed && (
            <span className="font-mono text-xs text-slate/40 truncate max-w-[300px]">{codePreview}</span>
          )}
          {!cell.readOnly && pyodideReady && !state.codeCollapsed && (
            <button
              onClick={onRun}
              disabled={state.running}
              className="text-xs bg-orange/10 text-orange px-2 py-1 rounded hover:bg-orange/20 transition-colors disabled:opacity-50 font-mono"
            >
              {state.running ? '⏳ Running...' : '▶ Run'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {cell.readOnly && (
            <span className="text-xs text-slate/40 font-mono">read-only</span>
          )}
          {cell.label && (
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded font-mono">{cell.label}</span>
          )}
        </div>
      </div>

      {/* Code Content */}
      {!state.codeCollapsed && (
        // <div 
        //   ref={codeRef}
        //   className="px-4 py-3 overflow-x-auto bg-slate/5"
        // />
        <SyntaxHighlighter
          language="python"
          style={materialLight}
          showLineNumbers
        >
          {cell.content}
        </SyntaxHighlighter>
      )}


      {/* Cell Output */}
      {hasOutput && (
        <div className="border-t-2 border-slate/10">
          {/* Output Header */}
          <button
            onClick={onToggleOutput}
            className="w-full flex items-center gap-2 px-4 py-2 bg-bone/30 hover:bg-bone/50 transition-colors text-left"
          >
            <ChevronIcon expanded={!state.outputCollapsed} className="text-slate/40" />
            <span className="font-mono text-xs text-slate/50">
              Out [{state.executed ? index + 1 : ' '}]:
            </span>
            {state.outputCollapsed && hasWidget && (
              <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded font-mono">Widget</span>
            )}
            {state.running && (
              <div className="flex items-center gap-2 text-slate/50 font-mono text-xs">
                <div className="w-3 h-3 border-2 border-orange border-t-transparent rounded-full animate-spin" />
                Executing...
              </div>
            )}
          </button>

          {/* Output Content */}
          {!state.outputCollapsed && (
            <div className="p-4 bg-bone/30">
              {state.outputs.map((output, i) => (
                <CellOutputComponent key={i} output={output} widgets={widgets} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Cell output renderer
 */
interface CellOutputComponentProps extends WithKey {
  output: CellOutput;
  widgets: Map<string, { moduleUrl: string; model: WidgetModel }>;
}

function CellOutputComponent(props: CellOutputComponentProps) {
  const { output, widgets } = props;
  if (output.type === 'stdout') {
    return (
      <pre className="font-mono text-sm text-slate whitespace-pre-wrap mb-2">
        {output.content}
      </pre>
    );
  }

  if (output.type === 'stderr') {
    return (
      <pre className="font-mono text-sm text-red-600 whitespace-pre-wrap mb-2 bg-red-50 p-2 rounded">
        {output.content}
      </pre>
    );
  }

  if (output.type === 'result') {
    // Check if it's a widget display marker (Widget:widgetId format without space)
    const widgetMatch = output.content.match(/Widget:(\S+)/);
    if (widgetMatch) {
      const widgetId = widgetMatch[1];
      const widget = widgets.get(widgetId);
      if (widget) {
        return (
          <div className="bg-white border-2 border-slate/10 rounded-lg p-4">
            <WidgetRenderer moduleUrl={widget.moduleUrl} model={widget.model} />
          </div>
        );
      }
    }

    return (
      <pre className="font-mono text-sm text-slate whitespace-pre-wrap mb-2">
        {output.content}
      </pre>
    );
  }

  return null;
}

/**
 * Widget renderer - loads and displays a widget module
 */
function WidgetRenderer({ moduleUrl, model }: { moduleUrl: string; model: WidgetModel }) {
  const [Widget, setWidget] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;

    async function loadWidget() {
      try {
        // Fetch the module code and create a blob URL to avoid Vite's public folder import restriction
        const response = await fetch(moduleUrl);
        if (!response.ok) throw new Error(`Failed to fetch module: ${response.statusText}`);

        const code = await response.text();
        const blob = new Blob([code], { type: 'application/javascript' });
        blobUrl = URL.createObjectURL(blob);

        const mod = await import(/* @vite-ignore */ blobUrl);
        const fn = mod?.default ?? mod;

        if (typeof fn !== 'function') {
          throw new Error('Widget module must export a default function');
        }

        if (!cancelled) {
          setWidget(() => fn);
          setError(null);
        }
      } catch (e: any) {
        console.error('Widget load error:', e);
        if (!cancelled) {
          setError(e.message || 'Failed to load widget');
        }
      }
    }

    loadWidget();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [moduleUrl]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border-2 border-red-200 rounded text-red-700 font-mono text-xs">
        Error loading widget: {error}
      </div>
    );
  }

  if (!Widget) {
    return (
      <div className="p-4 text-slate/50 font-mono text-xs animate-pulse">
        Loading widget...
      </div>
    );
  }

  return <Widget model={model} html={html} React={React} />;
}
