import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
// @ts-ignore
import { pyodideRuntime, PyodideState, WidgetModel } from "../utils/PyodideRuntime";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/cjs/styles/prism";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { autocompletion } from "@codemirror/autocomplete";
import type { CompletionContext } from "@codemirror/autocomplete";
import { keymap, EditorView } from "@codemirror/view";
import VibeWidget from "./VibeWidget";

/** CodeMirror theme matching doc site: bone/cream background, slate text, orange accents */
const playgroundEditorTheme = EditorView.theme({
  "&": {
    backgroundColor: "#fafaf9",
    borderRadius: "0",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-content": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "13px",
    lineHeight: "1.6",
    color: "#1a1a1a",
    caretColor: "#ea580c",
    padding: "12px 16px",
    minHeight: "80px",
  },
  ".cm-line": {
    padding: "0",
  },
  ".cm-gutters": {
    backgroundColor: "#f5f5f4",
    borderRight: "1px solid #e7e5e4",
    color: "#78716c",
    minWidth: "2.25em",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#fef3c7",
    color: "#1a1a1a",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  "& .cm-activeLine": {
    backgroundColor: "#fef3c7",
  },
  ".cm-selectionMatch": {
    backgroundColor: "#fed7aa",
  },
  ".cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "#ffedd5",
  },
  ".cm-cursor": {
    borderLeftColor: "#ea580c",
  },
});
import { getNotebook } from "../data/notebooks";
import type { NotebookCell } from "../data/notebooks";
import type { DataFileConfig } from "../utils/exampleDataLoader";
import { useIsMobile } from "../utils/useIsMobile";
import { EXAMPLES } from "../data/examples";
import {
  STARTER_CELLS,
  nextCellId,
  type PlaygroundCell,
} from "../data/playgroundStarterCells";

export interface NotebookProps {
  /** Read-only example notebook (false) or editable playground (true) */
  editable?: boolean;
  /** Cells to display. When editable, may include optional `id` for keying. */
  cells: (NotebookCell & { id?: string })[];
  /** Data files to preload in Pyodide (or from getNotebook(notebookKey) when provided) */
  dataFiles?: DataFileConfig[];
  title?: string;
  /** When set, dataFiles are resolved from getNotebook(notebookKey) if dataFiles not provided */
  notebookKey?: string;
}

interface CellState {
  running: boolean;
  executed: boolean;
  outputs: CellOutput[];
  codeCollapsed: boolean;
  outputCollapsed: boolean;
}

interface CellOutput {
  type: "stdout" | "stderr" | "result" | "widget";
  content: string;
  widgetId?: string;
  moduleUrl?: string;
}

function ChevronIcon({ expanded, className = "" }: { expanded: boolean; className?: string }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-90" : ""} ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

/** Resolve cells and dataFiles from props or notebookKey */
function useNotebookConfig(
  editable: boolean,
  cells: (NotebookCell & { id?: string })[],
  dataFiles?: DataFileConfig[],
  notebookKey?: string
): { cells: (NotebookCell & { id?: string })[]; dataFiles: DataFileConfig[] } {
  const fromNotebook = notebookKey && !editable ? getNotebook(notebookKey) : null;
  const resolvedDataFiles = dataFiles ?? fromNotebook?.dataFiles ?? [];
  const resolvedCells =
    cells.length > 0 ? cells : (fromNotebook?.cells ?? []);
  return { cells: resolvedCells, dataFiles: resolvedDataFiles };
}


export default function Notebook({
  editable = false,
  cells: propsCells,
  dataFiles: propsDataFiles,
  title,
  notebookKey,
}: NotebookProps): React.ReactElement {
  const { cells: resolvedCells, dataFiles } = useNotebookConfig(
    editable,
    propsCells,
    propsDataFiles,
    notebookKey
  );

  const [pyodideState, setPyodideState] = useState<PyodideState>({
    ready: false,
    loading: false,
    error: null,
    loadProgress: 0,
  });

  const isMobile = useIsMobile();

  const [cellStates, setCellStates] = useState<CellState[]>(() =>
    resolvedCells.map((cell) => ({
      running: false,
      executed: false,
      outputs: [] as CellOutput[],
      codeCollapsed: (cell as NotebookCell).defaultCollapsed ?? false,
      outputCollapsed: false,
    }))
  );

  const [widgets, setWidgets] = useState<Map<string, { moduleUrl: string; model: WidgetModel }>>(new Map());
  const loadedDataFilesRef = useRef<Set<string>>(new Set());
  const currentNotebookKeyRef = useRef<string | undefined>(undefined);

  const [editableCells, setEditableCells] = useState<PlaygroundCell[]>(() =>
    editable && resolvedCells.length > 0
      ? resolvedCells.map((c) => ({
          id: (c as { id?: string }).id ?? nextCellId(),
          type: c.type as "code" | "markdown",
          content: c.content,
        }))
      : []
  );
  const [runStatesById, setRunStatesById] = useState<Map<string, CellState>>(new Map());

  useEffect(() => {
    setCellStates(
      resolvedCells.map((cell) => ({
        running: false,
        executed: false,
        outputs: [] as CellOutput[],
        codeCollapsed: (cell as NotebookCell).defaultCollapsed ?? false,
        outputCollapsed: false,
      }))
    );
  }, [resolvedCells.length, notebookKey]);

  useEffect(() => {
    if (isMobile) return;
    return pyodideRuntime.onStateChange(setPyodideState);
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) return;
    pyodideRuntime.setWidgetHandler((widgetId: string, moduleUrl: string, model: WidgetModel) => {
      setWidgets((prev) => {
        const next = new Map(prev);
        next.set(widgetId, { moduleUrl, model });
        return next;
      });
    });
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) return;
    if (editable) {
      pyodideRuntime
        .load()
        .then(() => pyodideRuntime.enablePlaygroundMode())
        .catch((e: unknown) => console.error("Playground setup error:", e));
    } else {
      pyodideRuntime.load().catch(console.error);
    }
  }, [isMobile, editable]);

  useEffect(() => {
    if (isMobile || !pyodideState.ready || dataFiles.length === 0) return;
    const notebookChanged = currentNotebookKeyRef.current !== notebookKey;
    if (notebookChanged) currentNotebookKeyRef.current = notebookKey;
    const filesToLoad = dataFiles.filter((f) => !loadedDataFilesRef.current.has(f.url));
    if (filesToLoad.length === 0 && !notebookChanged) return;
    filesToLoad.forEach((f) => loadedDataFilesRef.current.add(f.url));
    Promise.all(
      filesToLoad.map((f) => pyodideRuntime.loadDataFile(f.url, f.varName, f.type))
    ).catch(console.error);
  }, [dataFiles, isMobile, notebookKey, pyodideState.ready]);

  const runCell = useCallback(
    async (index: number) => {
      if (isMobile) return;
      const cell = resolvedCells[index];
      if (!cell || cell.type !== "code") return;
      if (!pyodideState.ready) {
        try {
          await pyodideRuntime.load();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Failed to load Python runtime";
          setCellStates((prev) => {
            const next = [...prev];
            next[index] = {
              ...next[index],
              running: false,
              executed: true,
              outputs: [{ type: "stderr", content: message }],
            };
            return next;
          });
          return;
        }
      }
      setCellStates((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], running: true, outputs: [] };
        return next;
      });
      const outputs: CellOutput[] = [];
      let pythonCode = cell.content;
      const codeMatch = cell.content.match(/<code[^>]*>([\s\S]*?)<\/code>/);
      if (codeMatch) {
        pythonCode = codeMatch[1]
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
      }
      try {
        const result = await pyodideRuntime.runPython(pythonCode, (text: string, type: "stdout" | "stderr") => {
          if (text.trim()) outputs.push({ type, content: text });
        });
        if (result !== undefined && result !== null) {
          outputs.push({ type: "result", content: String(result) });
        }
      } catch (err: unknown) {
        outputs.push({
          type: "stderr",
          content: err instanceof Error ? err.message : String(err),
        });
      }
      setCellStates((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], running: false, executed: true, outputs };
        return next;
      });
    },
    [resolvedCells, isMobile, pyodideState.ready]
  );

  const runAllCells = useCallback(() => {
    if (isMobile) return;
    resolvedCells.forEach((cell, i) => {
      if (cell.type === "code" && !(cell as NotebookCell).readOnly) runCell(i);
    });
  }, [resolvedCells, isMobile, runCell]);

  const toggleCodeCollapse = useCallback((index: number) => {
    setCellStates((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], codeCollapsed: !next[index].codeCollapsed };
      return next;
    });
  }, []);

  const toggleOutputCollapse = useCallback((index: number) => {
    setCellStates((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], outputCollapsed: !next[index].outputCollapsed };
      return next;
    });
  }, []);

  const collapseAllCode = useCallback(() => {
    setCellStates((prev) => prev.map((s) => ({ ...s, codeCollapsed: true })));
  }, []);

  const expandAllCode = useCallback(() => {
    setCellStates((prev) => prev.map((s) => ({ ...s, codeCollapsed: false })));
  }, []);

  const getRunStateById = useCallback(
    (id: string): CellState =>
      runStatesById.get(id) ?? {
        running: false,
        executed: false,
        outputs: [],
        codeCollapsed: false,
        outputCollapsed: false,
      },
    [runStatesById]
  );

  const runCellById = useCallback(
    async (id: string) => {
      const cell = editableCells.find((c) => c.id === id);
      if (!cell || cell.type !== "code") return;
      if (!pyodideState.ready) {
        try {
          await pyodideRuntime.load();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to load Python runtime";
          setRunStatesById((prev) => {
            const next = new Map(prev);
            next.set(id, {
              running: false,
              executed: true,
              outputs: [{ type: "stderr", content: msg }],
              codeCollapsed: false,
              outputCollapsed: false,
            });
            return next;
          });
          return;
        }
      }
      setRunStatesById((prev) => {
        const next = new Map(prev);
        next.set(id, {
          ...getRunStateById(id),
          running: true,
          outputs: [],
        });
        return next;
      });
      const outputs: CellOutput[] = [];
      try {
        const result = await pyodideRuntime.runPython(cell.content, (text: string, type: "stdout" | "stderr") => {
          if (text.trim()) outputs.push({ type, content: text });
        });
        if (result !== undefined && result !== null) outputs.push({ type: "result", content: String(result) });
      } catch (err: unknown) {
        outputs.push({
          type: "stderr",
          content: err instanceof Error ? err.message : String(err),
        });
      }
      setRunStatesById((prev) => {
        const next = new Map(prev);
        next.set(id, {
          ...getRunStateById(id),
          running: false,
          executed: true,
          outputs,
        });
        return next;
      });
    },
    [editableCells, pyodideState.ready, getRunStateById]
  );

  const updateEditableContent = useCallback((id: string, content: string) => {
    setEditableCells((prev) => prev.map((c) => (c.id === id ? { ...c, content } : c)));
  }, []);

  const deleteEditableCell = useCallback((id: string) => {
    setEditableCells((prev) => (prev.length <= 1 ? prev : prev.filter((c) => c.id !== id)));
  }, []);

  const addEditableCell = useCallback((afterId: string, type: "code" | "markdown") => {
    const newCell: PlaygroundCell = {
      id: nextCellId(),
      type,
      content: type === "code" ? "" : "<p>Double-click to edit</p>",
    };
    setEditableCells((prev) => {
      const idx = prev.findIndex((c) => c.id === afterId);
      if (idx === -1) return [...prev, newCell];
      const next = [...prev];
      next.splice(idx + 1, 0, newCell);
      return next;
    });
  }, []);

  const addEditableCellAtEnd = useCallback((type: "code" | "markdown") => {
    setEditableCells((prev) => [
      ...prev,
      {
        id: nextCellId(),
        type,
        content: type === "code" ? "" : "<p>Double-click to edit</p>",
      },
    ]);
  }, []);

  const moveEditableCell = useCallback((id: string, direction: -1 | 1) => {
    setEditableCells((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      const targetIdx = idx + direction;
      if (idx === -1 || targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
  }, []);

  const toggleEditableCellType = useCallback((id: string) => {
    setEditableCells((prev) =>
      prev.map((c) => (c.id !== id ? c : { ...c, type: c.type === "code" ? "markdown" : "code" }))
    );
  }, []);

  const resetEditableNotebook = useCallback(() => {
    setEditableCells(STARTER_CELLS.map((c) => ({ ...c, id: nextCellId() })));
    setRunStatesById(new Map());
  }, []);

  const runAllEditableCells = useCallback(async () => {
    for (const cell of editableCells) {
      if (cell.type === "code") await runCellById(cell.id);
    }
  }, [editableCells, runCellById]);

  const mobilePreview = useMemo(() => {
    if (!notebookKey) return EXAMPLES[0];
    const byNotebookId = EXAMPLES.find((ex) => ex.notebookId === notebookKey);
    const byId = EXAMPLES.find((ex) => ex.id === notebookKey);
    return byNotebookId ?? byId ?? EXAMPLES[0];
  }, [notebookKey]);

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
            <VibeWidget
              moduleUrl={mobilePreview.moduleUrl}
              dataFiles={mobilePreview.dataFiles}
            />
          </div>
        )}
        <p className="mt-4 text-xs font-mono text-slate/60">
          Tip: open this doc on a larger screen to run Python in-browser with Pyodide.
        </p>
      </div>
    );
  }

  if (editable && editableCells.length > 0) {
    return (
      <div className="max-w-5xl mx-auto">
        {title && (
          <div className="mb-8">
            <h1 className="text-5xl font-display font-bold mb-4">{title}</h1>
          </div>
        )}
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
        {pyodideState.ready && (
          <div className="mb-6 flex flex-wrap gap-3 items-center">
            <button
              onClick={runAllEditableCells}
              className="bg-orange text-white px-4 py-2 rounded-lg font-mono text-sm hover:bg-orange/80 transition-colors flex items-center gap-2"
            >
              <span>▶</span> Run All Cells
            </button>
            <button
              onClick={() => addEditableCellAtEnd("code")}
              className="bg-slate/10 text-slate px-3 py-2 rounded-lg font-mono text-xs hover:bg-slate/20 transition-colors"
            >
              + Code Cell
            </button>
            <button
              onClick={() => addEditableCellAtEnd("markdown")}
              className="bg-slate/10 text-slate px-3 py-2 rounded-lg font-mono text-xs hover:bg-slate/20 transition-colors"
            >
              + Markdown Cell
            </button>
            <button
              onClick={resetEditableNotebook}
              className="bg-slate/10 text-slate px-3 py-2 rounded-lg font-mono text-xs hover:bg-slate/20 transition-colors"
            >
              Reset
            </button>
            <span className="text-slate/50 text-sm font-mono">Python ready • pandas, numpy, sklearn</span>
          </div>
        )}
        <div className="space-y-4">
          {editableCells.map((cell, index) => (
            <React.Fragment key={cell.id}>
              {cell.type === "code" ? (
                <EditableCodeCell
                  cell={cell}
                  index={index}
                  state={getRunStateById(cell.id)}
                  widgets={widgets}
                  pyodideReady={pyodideState.ready}
                  onRun={() => runCellById(cell.id)}
                  onChange={(content) => updateEditableContent(cell.id, content)}
                  onDelete={() => deleteEditableCell(cell.id)}
                  onMoveUp={() => moveEditableCell(cell.id, -1)}
                  onMoveDown={() => moveEditableCell(cell.id, 1)}
                  onToggleType={() => toggleEditableCellType(cell.id)}
                  isFirst={index === 0}
                  isLast={index === editableCells.length - 1}
                />
              ) : (
                <EditableMarkdownCell
                  cell={cell}
                  index={index}
                  onChange={(content) => updateEditableContent(cell.id, content)}
                  onDelete={() => deleteEditableCell(cell.id)}
                  onMoveUp={() => moveEditableCell(cell.id, -1)}
                  onMoveDown={() => moveEditableCell(cell.id, 1)}
                  onToggleType={() => toggleEditableCellType(cell.id)}
                  isFirst={index === 0}
                  isLast={index === editableCells.length - 1}
                />
              )}
              <AddCellDivider
                onAddCode={() => addEditableCell(cell.id, "code")}
                onAddMarkdown={() => addEditableCell(cell.id, "markdown")}
              />
            </React.Fragment>
          ))}
        </div>
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
          <span className="text-slate/50 text-sm font-mono">Python ready • pandas, numpy, sklearn</span>
        </div>
      )}

      <div className="space-y-4">
        {resolvedCells.map((cell, index) => (
          <ReadOnlyCell
            key={(cell as { id?: string }).id ?? index}
            cell={cell as NotebookCell}
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

interface ReadOnlyCellProps {
  cell: NotebookCell;
  index: number;
  state: CellState;
  widgets: Map<string, { moduleUrl: string; model: WidgetModel }>;
  pyodideReady: boolean;
  onRun: () => void;
  onToggleCode: () => void;
  onToggleOutput: () => void;
}

function ReadOnlyCell({
  cell,
  index,
  state,
  widgets,
  pyodideReady,
  onRun,
  onToggleCode,
  onToggleOutput,
}: ReadOnlyCellProps): React.ReactElement {
  const [markdownCollapsed, setMarkdownCollapsed] = useState(cell.defaultCollapsed ?? false);

  if (cell.type === "markdown") {
    const titleMatch = cell.content.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/);
    const previewTitle = titleMatch ? titleMatch[1] : "Markdown";
    return (
      <div className="bg-white border-2 border-slate/10 rounded-lg overflow-hidden">
        <button
          onClick={() => setMarkdownCollapsed(!markdownCollapsed)}
          className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-slate/5 transition-colors"
        >
          <ChevronIcon expanded={!markdownCollapsed} className="text-slate/40" />
          <span className="font-mono text-xs text-slate/50">Markdown</span>
          {markdownCollapsed && <span className="text-sm text-slate/60 truncate">{previewTitle}</span>}
        </button>
        {!markdownCollapsed && (
          <div className="px-6 pb-6">
            <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: cell.content }} />
          </div>
        )}
      </div>
    );
  }

  const hasOutput = state.outputs.length > 0 || state.running;
  const hasWidget = state.outputs.some((o) => o.type === "result" && o.content.includes("Widget:"));
  const codePreview = cell.content.split("\n")[0].slice(0, 50) + (cell.content.length > 50 ? "..." : "");

  return (
    <div className="bg-white border-2 border-slate/20 rounded-lg overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-slate/5 border-b border-slate/10">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleCode}
            className="flex items-center gap-2 hover:bg-slate/10 rounded px-1 py-0.5 transition-colors"
          >
            <ChevronIcon expanded={!state.codeCollapsed} className="text-slate/40" />
            <span className="font-mono text-xs text-slate/50">
              In [{state.executed ? index + 1 : " "}]:
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
              {state.running ? "⏳ Running..." : "▶ Run"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {cell.readOnly && <span className="text-xs text-slate/40 font-mono">read-only</span>}
          {cell.label && (
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded font-mono">{cell.label}</span>
          )}
        </div>
      </div>

      {!state.codeCollapsed && (
        <SyntaxHighlighter
          language="python"
          style={oneLight}
          showLineNumbers
          customStyle={{ margin: 0, padding: "12px 16px", fontSize: "13px", lineHeight: 1.5 }}
          codeTagProps={{ style: { fontFamily: "ui-monospace, monospace" } }}
          lineNumberStyle={{ minWidth: "2.25em" }}
          useInlineStyles
          wrapLongLines
        >
          {cell.content}
        </SyntaxHighlighter>
      )}

      {hasOutput && (
        <div className="border-t-2 border-slate/10">
          <button
            onClick={onToggleOutput}
            className="w-full flex items-center gap-2 px-4 py-2 bg-bone/30 hover:bg-bone/50 transition-colors text-left"
          >
            <ChevronIcon expanded={!state.outputCollapsed} className="text-slate/40" />
            <span className="font-mono text-xs text-slate/50">Out [{state.executed ? index + 1 : " "}]:</span>
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
          {!state.outputCollapsed && (
            <div className="p-4 bg-bone/30">
              {state.outputs.map((output, i) => (
                <CellOutputRender key={i} output={output} widgets={widgets} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CellOutputRender({
  output,
  widgets,
}: {
  output: CellOutput;
  widgets: Map<string, { moduleUrl: string; model: WidgetModel }>;
}): React.ReactElement | null {
  if (output.type === "stdout") {
    return <pre className="font-mono text-sm text-slate whitespace-pre-wrap mb-2">{output.content}</pre>;
  }
  if (output.type === "stderr") {
    return (
      <pre className="font-mono text-sm text-red-600 whitespace-pre-wrap mb-2 bg-red-50 p-2 rounded">
        {output.content}
      </pre>
    );
  }
  if (output.type === "result") {
    const widgetMatch = output.content.match(/Widget:(\S+)/);
    if (widgetMatch) {
      const widgetId = widgetMatch[1];
      const widget = widgets.get(widgetId);
      if (widget) {
        return (
          <div className="bg-white border-2 border-slate/10 rounded-lg p-4">
            <VibeWidget moduleUrl={widget.moduleUrl} model={widget.model} />
          </div>
        );
      }
    }
    return <pre className="font-mono text-sm text-slate whitespace-pre-wrap mb-2">{output.content}</pre>;
  }
  return null;
}

function AddCellDivider({
  onAddCode,
  onAddMarkdown,
}: {
  onAddCode: () => void;
  onAddMarkdown: () => void;
}): React.ReactElement {
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

/** Vibe-widget API completions for playground code cells (after "vw." or "vw") */
function vibeWidgetCompletions(context: CompletionContext) {
  // Match "vw." plus optional word chars, or just "vw" so we can suggest ".create" etc.
  const matchDot = context.matchBefore(/\bvw\.\w*$/);
  const matchVw = context.matchBefore(/\bvw$/);
  const match = matchDot ?? matchVw;
  if (!match) return null;
  const from = matchDot ? match.from + 3 : match.to; // replace only part after "vw." or insert after "vw"
  const options = [
    { label: "create", type: "function", info: "Create a widget from a description and optional data. vw.create(description, data=None, outputs=None, inputs=None)" },
    { label: "config", type: "function", info: "Set global config. vw.config(model=..., api_key=...)" },
    { label: "outputs", type: "function", info: "Declare widget outputs. vw.outputs(name='description', ...)" },
    { label: "inputs", type: "function", info: "Declare widget inputs or link from another widget. vw.inputs(data, trait=other.outputs.trait)" },
    { label: "edit", type: "function", info: "Edit an existing widget. vw.edit(widget, prompt)" },
    { label: "load", type: "function", info: "Load a saved widget. vw.load(path)" },
    { label: "theme", type: "function", info: "Generate theme from description. vw.theme(description)" },
    { label: "themes", type: "function", info: "List built-in themes. vw.themes()" },
    { label: "models", type: "function", info: "List available LLM models. vw.models(refresh=False)" },
  ].map((opt) =>
    matchVw ? { ...opt, apply: "." + opt.label } : opt
  );
  return {
    from,
    options,
    validFor: /^\w*$/,
  };
}

function makePlaygroundExtensions(onRun: () => void) {
  return [
    playgroundEditorTheme,
    python(),
    autocompletion({
      override: [vibeWidgetCompletions],
      activateOnTyping: true,
      maxRenderedOptions: 12,
    }),
    keymap.of([
      {
        key: "Shift-Enter",
        run: () => {
          onRun();
          return true;
        },
      },
    ]),
  ];
}

interface EditableCodeCellProps {
  cell: PlaygroundCell;
  index: number;
  state: CellState;
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
}

function EditableCodeCell({
  cell,
  index,
  state,
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
}: EditableCodeCellProps): React.ReactElement {
  const extensions = useMemo(() => makePlaygroundExtensions(onRun), [onRun]);

  const hasOutput = state.outputs.length > 0 || state.running;
  const executionLabel = state.executed ? `[${index + 1}]` : "[ ]";

  return (
    <div className="bg-white border-2 border-slate/20 rounded-lg overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-slate/5 border-b border-slate/10">
        <div className="flex items-center gap-3">
          <ChevronIcon expanded className="text-slate/40" />
          <span className="font-mono text-xs text-slate/50">In {executionLabel}:</span>
          {pyodideReady && (
            <button
              onClick={onRun}
              disabled={state.running}
              className="text-xs bg-orange/10 text-orange px-2 py-1 rounded hover:bg-orange/20 transition-colors disabled:opacity-50 font-mono"
            >
              {state.running ? "⏳ Running..." : "▶ Run"}
            </button>
          )}
          <span className="text-xs text-slate/40 font-mono">Shift+Enter</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onToggleType} className="px-1.5 py-0.5 rounded hover:bg-slate/10 text-slate/50 font-mono text-xs" title="Toggle to markdown">
            M
          </button>
          {!isFirst && (
            <button onClick={onMoveUp} className="px-1.5 py-0.5 rounded hover:bg-slate/10 text-slate/50" title="Move up">
              ↑
            </button>
          )}
          {!isLast && (
            <button onClick={onMoveDown} className="px-1.5 py-0.5 rounded hover:bg-slate/10 text-slate/50" title="Move down">
              ↓
            </button>
          )}
          <button onClick={onDelete} className="px-1.5 py-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600" title="Delete cell">
            ×
          </button>
        </div>
      </div>
      <div className="border-t border-slate/10">
        <CodeMirror
          value={cell.content}
          height="auto"
          minHeight="120px"
          extensions={extensions}
          onChange={(value) => onChange(value)}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            history: true,
            foldGutter: false,
            drawSelection: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            tabSize: 4,
            defaultKeymap: true,
            historyKeymap: true,
            completionKeymap: true,
          }}
          placeholder="Type vw. then choose a completion, or Ctrl+Space for suggestions"
          className="[&_.cm-editor]:outline-none [&_.cm-scroller]:font-mono"
        />
      </div>
      {hasOutput && (
        <div className="border-t-2 border-slate/10">
          <div className="px-4 py-2 bg-bone/30 font-mono text-xs text-slate/50">Out [{state.executed ? index + 1 : " "}]:</div>
          <div className="p-4 bg-bone/30">
            {state.running && (
              <div className="flex items-center gap-2 text-slate/50 font-mono text-xs mb-2">
                <div className="w-3 h-3 border-2 border-orange border-t-transparent rounded-full animate-spin" />
                Executing...
              </div>
            )}
            {state.outputs.map((output, i) => (
              <CellOutputRender key={i} output={output} widgets={widgets} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface EditableMarkdownCellProps {
  cell: PlaygroundCell;
  index: number;
  onChange: (content: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleType: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function EditableMarkdownCell({
  cell,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  onToggleType,
  isFirst,
  isLast,
}: EditableMarkdownCellProps): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 60)}px`;
    }
  }, [editing]);

  if (editing) {
    return (
      <div className="bg-white border-2 border-slate/20 rounded-lg overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-2 bg-slate/5 border-b border-slate/10">
          <span className="font-mono text-xs text-slate/50">Markdown (editing)</span>
          <button
            onClick={() => setEditing(false)}
            className="text-xs bg-orange/10 text-orange px-2 py-1 rounded hover:bg-orange/20 font-mono"
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
              textareaRef.current.style.height = "auto";
              textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 60)}px`;
            }
          }}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          spellCheck={false}
          className="w-full px-4 py-3 font-mono text-sm bg-slate/5 text-slate resize-none outline-none leading-relaxed"
          style={{ minHeight: 60 }}
        />
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-slate/10 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate/10">
        <span className="font-mono text-xs text-slate/50">Markdown</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing(true)} className="px-1.5 py-0.5 rounded hover:bg-slate/10 text-slate/50 font-mono text-xs">
            Edit
          </button>
          <button onClick={onToggleType} className="px-1.5 py-0.5 rounded hover:bg-slate/10 text-slate/50 font-mono text-xs" title="Toggle to code">
            Code
          </button>
          {!isFirst && <button onClick={onMoveUp} className="px-1.5 py-0.5 rounded hover:bg-slate/10 text-slate/50" title="Move up">↑</button>}
          {!isLast && <button onClick={onMoveDown} className="px-1.5 py-0.5 rounded hover:bg-slate/10 text-slate/50" title="Move down">↓</button>}
          <button onClick={onDelete} className="px-1.5 py-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600" title="Delete">×</button>
        </div>
      </div>
      <div
        className="px-6 pb-6 pt-2 cursor-pointer hover:bg-slate/5 transition-colors"
        onDoubleClick={() => setEditing(true)}
      >
        <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: cell.content }} />
      </div>
    </div>
  );
}
