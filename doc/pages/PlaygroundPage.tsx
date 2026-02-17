import React, { useState, useEffect, useRef, useCallback } from "react";
// @ts-ignore
import { pyodideRuntime, PyodideState, WidgetModel } from "../utils/PyodideRuntime";
import VibeWidget from "../components/VibeWidget";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CellOutput {
  type: 'stdout' | 'stderr' | 'result';
  content: string;
}

interface CellRunState {
  running: boolean;
  executed: boolean;
  outputs: CellOutput[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

import {
  STARTER_CELLS,
  nextCellId,
  type PlaygroundCell,
} from "../data/playgroundStarterCells";

/* ------------------------------------------------------------------ */
/*  Editable code cell                                                 */
/* ------------------------------------------------------------------ */

function CodeCell({
  cell,
  index,
  runState,
  widgets,
  pyodideReady,
  onRun,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  onToggleType,
  isFirst,
  isLast,
}: {
  cell: PlaygroundCell;
  index: number;
  runState: CellRunState;
  widgets: Map<string, { moduleUrl: string; model: WidgetModel }>;
  pyodideReady: boolean;
  onRun: () => void;
  onChange: (content: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleType: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(ta.scrollHeight, 60)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [cell.content, autoResize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      onRun();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newValue = ta.value.substring(0, start) + '    ' + ta.value.substring(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 4;
      });
    }
  };

  const executionLabel = runState.executed ? `[${index + 1}]` : '[ ]';

  return (
    <div className="group border-2 border-slate/15 rounded-lg overflow-hidden bg-white shadow-sm hover:border-slate/25 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate/5 border-b border-slate/10 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-orange/70 font-bold">In {executionLabel}:</span>
          {pyodideReady && (
            <button
              onClick={onRun}
              disabled={runState.running}
              className="px-2 py-0.5 rounded bg-orange/10 text-orange hover:bg-orange/20 disabled:opacity-40 transition-colors"
            >
              {runState.running ? 'Running...' : 'Run'}
            </button>
          )}
          <span className="text-slate/40">Shift+Enter</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onToggleType} className="px-1.5 py-0.5 rounded hover:bg-slate/10 text-slate/50" title="Toggle to markdown">
            M
          </button>
          {!isFirst && (
            <button onClick={onMoveUp} className="px-1.5 py-0.5 rounded hover:bg-slate/10 text-slate/50" title="Move up">
              &uarr;
            </button>
          )}
          {!isLast && (
            <button onClick={onMoveDown} className="px-1.5 py-0.5 rounded hover:bg-slate/10 text-slate/50" title="Move down">
              &darr;
            </button>
          )}
          <button onClick={onDelete} className="px-1.5 py-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600" title="Delete cell">
            &times;
          </button>
        </div>
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={cell.content}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        className="w-full px-4 py-3 font-mono text-sm bg-[#1e1e1e] text-[#d4d4d4] resize-none outline-none leading-relaxed"
        style={{ minHeight: 60, tabSize: 4 }}
      />

      {/* Outputs */}
      {(runState.outputs.length > 0 || runState.running) && (
        <div className="border-t border-slate/10 bg-bone/40 px-4 py-3">
          {runState.running && (
            <div className="flex items-center gap-2 text-slate/50 font-mono text-xs mb-2">
              <div className="w-3 h-3 border-2 border-orange border-t-transparent rounded-full animate-spin" />
              Executing...
            </div>
          )}
          {runState.outputs.map((output, i) => {
            if (output.type === 'stderr') {
              return (
                <pre key={i} className="font-mono text-sm text-red-600 whitespace-pre-wrap mb-1 bg-red-50 p-2 rounded">
                  {output.content}
                </pre>
              );
            }
            // Check for widget display
            const widgetMatch = output.content.match(/Widget:(\S+)/);
            if (widgetMatch) {
              const widgetId = widgetMatch[1];
              const widget = widgets.get(widgetId);
              if (widget) {
                return (
                  <div key={i} className="bg-white border border-slate/10 rounded-lg p-4 mb-2">
                    <VibeWidget moduleUrl={widget.moduleUrl} model={widget.model} />
                  </div>
                );
              }
            }
            return (
              <pre key={i} className="font-mono text-sm text-slate whitespace-pre-wrap mb-1">
                {output.content}
              </pre>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Markdown cell                                                      */
/* ------------------------------------------------------------------ */

function MarkdownCell({
  cell,
  index,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  onToggleType,
  isFirst,
  isLast,
}: {
  cell: PlaygroundCell;
  index: number;
  onChange: (content: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleType: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 60)}px`;
    }
  }, [editing]);

  if (editing) {
    return (
      <div className="group border-2 border-blue-300 rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 border-b border-blue-200 text-xs font-mono">
          <span className="text-blue-600 font-bold">Markdown (editing)</span>
          <button
            onClick={() => setEditing(false)}
            className="px-2 py-0.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-200"
          >
            Done
          </button>
        </div>
        <textarea
          ref={textareaRef}
          value={cell.content}
          onChange={(e) => {
            onChange(e.target.value);
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto';
              textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 60)}px`;
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false);
          }}
          spellCheck={false}
          className="w-full px-4 py-3 font-mono text-sm bg-white text-slate resize-none outline-none leading-relaxed"
          style={{ minHeight: 60 }}
        />
      </div>
    );
  }

  return (
    <div
      className="group border-2 border-slate/10 rounded-lg overflow-hidden bg-white shadow-sm cursor-pointer hover:border-slate/20 transition-colors"
      onDoubleClick={() => setEditing(true)}
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate/5 border-b border-slate/10 text-xs font-mono">
        <span className="text-slate/50">Markdown</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="px-1.5 py-0.5 rounded hover:bg-slate/10 text-slate/50" title="Edit">
            Edit
          </button>
          <button onClick={onToggleType} className="px-1.5 py-0.5 rounded hover:bg-slate/10 text-slate/50" title="Toggle to code">
            { }
          </button>
          {!isFirst && (
            <button onClick={onMoveUp} className="px-1.5 py-0.5 rounded hover:bg-slate/10 text-slate/50" title="Move up">
              &uarr;
            </button>
          )}
          {!isLast && (
            <button onClick={onMoveDown} className="px-1.5 py-0.5 rounded hover:bg-slate/10 text-slate/50" title="Move down">
              &darr;
            </button>
          )}
          <button onClick={onDelete} className="px-1.5 py-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600" title="Delete cell">
            &times;
          </button>
        </div>
      </div>
      <div className="px-6 py-4">
        <div
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: cell.content }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add-cell divider                                                   */
/* ------------------------------------------------------------------ */

function AddCellDivider({ onAddCode, onAddMarkdown }: { onAddCode: () => void; onAddMarkdown: () => void }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity">
      <div className="flex-1 h-px bg-slate/10" />
      <button
        onClick={onAddCode}
        className="px-2 py-0.5 text-xs font-mono text-slate/40 hover:text-orange hover:bg-orange/10 rounded transition-colors"
      >
        + Code
      </button>
      <button
        onClick={onAddMarkdown}
        className="px-2 py-0.5 text-xs font-mono text-slate/40 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
      >
        + Markdown
      </button>
      <div className="flex-1 h-px bg-slate/10" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main PlaygroundPage                                                */
/* ------------------------------------------------------------------ */

export default function PlaygroundPage() {
  const [cells, setCells] = useState<PlaygroundCell[]>(() =>
    STARTER_CELLS.map((c) => ({ ...c, id: nextCellId() }))
  );
  const [runStates, setRunStates] = useState<Map<string, CellRunState>>(new Map());
  const [widgets, setWidgets] = useState<Map<string, { moduleUrl: string; model: WidgetModel }>>(new Map());
  const [pyodideState, setPyodideState] = useState<PyodideState>({
    ready: false,
    loading: false,
    error: null,
    loadProgress: 0,
  });

  // Subscribe to Pyodide state
  useEffect(() => {
    return pyodideRuntime.onStateChange(setPyodideState);
  }, []);

  // Set up widget handler
  useEffect(() => {
    pyodideRuntime.setWidgetHandler((widgetId: string, moduleUrl: string, model: any) => {
      setWidgets((prev) => {
        const next = new Map(prev);
        next.set(widgetId, { moduleUrl, model: model as WidgetModel });
        return next;
      });
    });
  }, []);

  // Load Pyodide on mount, then enable playground mode
  useEffect(() => {
    pyodideRuntime.load()
      .then(() => pyodideRuntime.enablePlaygroundMode())
      .catch((e: any) => console.error('Playground setup error:', e));
  }, []);

  const getRunState = useCallback(
    (id: string): CellRunState =>
      runStates.get(id) || { running: false, executed: false, outputs: [] },
    [runStates]
  );

  const runCell = useCallback(
    async (id: string) => {
      const cell = cells.find((c) => c.id === id);
      if (!cell || cell.type !== 'code') return;

      if (!pyodideState.ready) {
        try {
          await pyodideRuntime.load();
        } catch (error: any) {
          setRunStates((prev) => {
            const next = new Map(prev);
            next.set(id, {
              running: false,
              executed: true,
              outputs: [{ type: 'stderr', content: `Failed to load Python runtime: ${error.message}` }],
            });
            return next;
          });
          return;
        }
      }

      setRunStates((prev) => {
        const next = new Map(prev);
        next.set(id, { running: true, executed: false, outputs: [] });
        return next;
      });

      const outputs: CellOutput[] = [];

      try {
        const result = await pyodideRuntime.runPython(cell.content, (text: string, type: 'stdout' | 'stderr') => {
          if (text.trim()) outputs.push({ type, content: text });
        });
        if (result !== undefined && result !== null) {
          outputs.push({ type: 'result', content: String(result) });
        }
      } catch (error: any) {
        outputs.push({ type: 'stderr', content: error.message });
      }

      setRunStates((prev) => {
        const next = new Map(prev);
        next.set(id, { running: false, executed: true, outputs });
        return next;
      });
    },
    [cells, pyodideState.ready]
  );

  const runAllCells = useCallback(async () => {
    for (const cell of cells) {
      if (cell.type === 'code') await runCell(cell.id);
    }
  }, [cells, runCell]);

  const updateCellContent = useCallback((id: string, content: string) => {
    setCells((prev) => prev.map((c) => (c.id === id ? { ...c, content } : c)));
  }, []);

  const deleteCell = useCallback((id: string) => {
    setCells((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((c) => c.id !== id);
    });
  }, []);

  const addCell = useCallback((afterId: string, type: 'code' | 'markdown') => {
    const newCell: PlaygroundCell = {
      id: nextCellId(),
      type,
      content: type === 'code' ? '' : '<p>Double-click to edit</p>',
    };
    setCells((prev) => {
      const idx = prev.findIndex((c) => c.id === afterId);
      if (idx === -1) return [...prev, newCell];
      const next = [...prev];
      next.splice(idx + 1, 0, newCell);
      return next;
    });
  }, []);

  const addCellAtEnd = useCallback((type: 'code' | 'markdown') => {
    const newCell: PlaygroundCell = {
      id: nextCellId(),
      type,
      content: type === "code" ? "" : "<p>Double-click to edit</p>",
    };
    setCells((prev) => [...prev, newCell]);
  }, []);

  const moveCell = useCallback((id: string, direction: -1 | 1) => {
    setCells((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      const targetIdx = idx + direction;
      if (idx === -1 || targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
  }, []);

  const toggleCellType = useCallback((id: string) => {
    setCells((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          type: c.type === 'code' ? 'markdown' : 'code',
        };
      })
    );
  }, []);

  const resetNotebook = useCallback(() => {
    setCells(STARTER_CELLS.map((c) => ({ ...c, id: nextCellId() })));
    setRunStates(new Map());
  }, []);

  return (
    <main className="relative pt-24 pb-20 min-h-screen">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-display font-bold mb-3">Playground</h1>
          <p className="text-lg text-slate/60 font-mono">
            Interactive Python notebook with vibe_widget, pandas, and numpy.
          </p>
        </div>

        {/* Pyodide Loading */}
        {!pyodideState.ready && (
          <div className="mb-6 bg-white border-2 border-slate/20 rounded-lg p-5 shadow-sm">
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
                <button
                  onClick={() => pyodideRuntime.load()}
                  className="mt-3 bg-orange text-white px-4 py-2 rounded-lg font-mono text-sm hover:bg-orange/80 transition-colors"
                >
                  Retry
                </button>
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

        {/* Toolbar */}
        {pyodideState.ready && (
          <div className="mb-6 flex flex-wrap gap-3 items-center">
            <button
              onClick={runAllCells}
              className="bg-orange text-white px-4 py-2 rounded-lg font-mono text-sm hover:bg-orange/80 transition-colors flex items-center gap-2"
            >
              <span>&#9654;</span> Run All
            </button>
            <button
              onClick={() => addCellAtEnd('code')}
              className="bg-slate/10 text-slate px-3 py-2 rounded-lg font-mono text-xs hover:bg-slate/20 transition-colors"
            >
              + Code Cell
            </button>
            <button
              onClick={() => addCellAtEnd('markdown')}
              className="bg-slate/10 text-slate px-3 py-2 rounded-lg font-mono text-xs hover:bg-slate/20 transition-colors"
            >
              + Markdown Cell
            </button>
            <button
              onClick={resetNotebook}
              className="bg-slate/10 text-slate px-3 py-2 rounded-lg font-mono text-xs hover:bg-slate/20 transition-colors"
            >
              Reset
            </button>
            <span className="text-slate/40 text-xs font-mono ml-auto">
              Python ready
            </span>
          </div>
        )}

        {/* Cells */}
        <div className="space-y-2">
          {cells.map((cell, index) => (
            <React.Fragment key={cell.id}>
              {cell.type === 'code' ? (
                <CodeCell
                  cell={cell}
                  index={index}
                  runState={getRunState(cell.id)}
                  widgets={widgets}
                  pyodideReady={pyodideState.ready}
                  onRun={() => runCell(cell.id)}
                  onChange={(content) => updateCellContent(cell.id, content)}
                  onDelete={() => deleteCell(cell.id)}
                  onMoveUp={() => moveCell(cell.id, -1)}
                  onMoveDown={() => moveCell(cell.id, 1)}
                  onToggleType={() => toggleCellType(cell.id)}
                  isFirst={index === 0}
                  isLast={index === cells.length - 1}
                />
              ) : (
                <MarkdownCell
                  cell={cell}
                  index={index}
                  onChange={(content) => updateCellContent(cell.id, content)}
                  onDelete={() => deleteCell(cell.id)}
                  onMoveUp={() => moveCell(cell.id, -1)}
                  onMoveDown={() => moveCell(cell.id, 1)}
                  onToggleType={() => toggleCellType(cell.id)}
                  isFirst={index === 0}
                  isLast={index === cells.length - 1}
                />
              )}
              <AddCellDivider
                onAddCode={() => addCell(cell.id, 'code')}
                onAddMarkdown={() => addCell(cell.id, 'markdown')}
              />
            </React.Fragment>
          ))}
        </div>
      </div>
    </main>
  );
}
