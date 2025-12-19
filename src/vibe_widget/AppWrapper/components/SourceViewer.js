import * as React from "https://esm.sh/react@18";
import htm from "https://esm.sh/htm@3";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

const html = htm.bind(React.createElement);

export default function SourceViewer({ code, errorMessage, onApply, onClose }) {
  const containerRef = React.useRef(null);
  const viewRef = React.useRef(null);
  const editableCompartmentRef = React.useRef(null);
  const [draftCode, setDraftCode] = React.useState(code || "");
  const [isReadOnly, setReadOnly] = React.useState(false);
  const [isLoading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const isDirtyRef = React.useRef(false);
  const autoScrollRef = React.useRef(false);

  React.useEffect(() => {
    isDirtyRef.current = draftCode !== (code || "");
  }, [draftCode, code]);

  React.useEffect(() => {
    if (!isDirtyRef.current) {
      setDraftCode(code || "");
    }
  }, [code]);

  React.useEffect(() => {
    const handleWindowKeyDown = (event) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target)) {
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };
    const canScrollEditor = (deltaY) => {
      if (!viewRef.current) return false;
      const scroller = viewRef.current.scrollDOM;
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      if (maxScroll <= 0) return false;
      if (deltaY < 0) return scroller.scrollTop > 0;
      if (deltaY > 0) return scroller.scrollTop < maxScroll;
      return false;
    };
    const handleWheel = (event) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target)) {
        if (!canScrollEditor(event.deltaY)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
      }
    };
    const handleTouchMove = (event) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", handleWindowKeyDown, true);
    window.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    window.addEventListener("touchmove", handleTouchMove, { capture: true, passive: false });
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown, true);
      window.removeEventListener("wheel", handleWheel, true);
      window.removeEventListener("touchmove", handleTouchMove, true);
    };
  }, []);

  React.useEffect(() => {
    if (!containerRef.current) return;
    if (viewRef.current) return;
    try {
      setLoading(true);
      const editableCompartment = new Compartment();
      editableCompartmentRef.current = editableCompartment;
      const extensions = [
        basicSetup,
        javascript({ jsx: true, typescript: false }),
        oneDark,
        EditorView.lineWrapping,
        EditorView.domEventHandlers({
          keydown: (event) => {
            event.stopPropagation();
          }
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setDraftCode(update.state.doc.toString());
          }
        }),
        editableCompartment.of(EditorView.editable.of(!isReadOnly))
      ];
      const startState = EditorState.create({
        doc: draftCode || "",
        extensions
      });
      viewRef.current = new EditorView({
        state: startState,
        parent: containerRef.current
      });
      setLoading(false);
    } catch (err) {
      console.error("Failed to load CodeMirror:", err);
      setLoadError("Failed to load editor.");
      setLoading(false);
    }
    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (!viewRef.current || !editableCompartmentRef.current) return;
    viewRef.current.dispatch({
      effects: editableCompartmentRef.current.reconfigure(
        EditorView.editable.of(!isReadOnly)
      )
    });
  }, [isReadOnly]);

  React.useEffect(() => {
    if (!viewRef.current) return;
    if (typeof viewRef.current.hasFocus === "function" && viewRef.current.hasFocus()) return;
    const current = viewRef.current.state.doc.toString();
    if (current === (code || "")) return;
    viewRef.current.dispatch({
      changes: { from: 0, to: current.length, insert: code || "" }
    });
    autoScrollRef.current = false;
  }, [code]);

  const scrollToDefaultExport = () => {
    if (!viewRef.current || !draftCode || autoScrollRef.current) return;
    const match = draftCode.match(/\bexport\s+default\b/);
    if (!match) return;
    const pos = match.index ?? 0;
    viewRef.current.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: "center" })
    });
    autoScrollRef.current = true;
  };

  React.useEffect(() => {
    if (!viewRef.current || isDirtyRef.current) return;
    const timeout = setTimeout(scrollToDefaultExport, 0);
    return () => clearTimeout(timeout);
  }, [draftCode]);

  const handleApply = () => {
    onApply(draftCode);
  };

  const isDirty = draftCode !== (code || "");

  return html`
    <div class="source-viewer-overlay">
      <style>
        .source-viewer-overlay {
          position: absolute;
          inset: 0;
          z-index: 1150;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(5, 5, 5, 0.78);
          backdrop-filter: blur(4px);
        }
        .source-viewer-card {
          width: min(980px, 96%);
          height: 96%;
          background: #0b1220;
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 12px;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.45);
          display: flex;
          flex-direction: column;
        }
        .source-viewer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.2);
          color: #e2e8f0;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .source-viewer-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .source-viewer-button {
          background: transparent;
          color: #94a3b8;
          border: 1px solid rgba(148, 163, 184, 0.4);
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 11px;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .source-viewer-button.primary {
          background: #f97316;
          color: #0b0b0b;
          border-color: transparent;
          font-weight: 600;
        }
        .source-viewer-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .source-viewer-body {
          padding: 12px 14px 16px;
          overflow: hidden;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .source-viewer-editor {
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 8px;
          background: #0a0f1a;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }
        .source-viewer-error-banner {
          border: 1px solid rgba(248, 113, 113, 0.6);
          background: rgba(127, 29, 29, 0.35);
          color: #fecaca;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 12px;
          white-space: pre-wrap;
        }
        .source-viewer-editor .cm-editor {
          height: 100%;
        }
        .source-viewer-editor .cm-scroller {
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
        }
        .source-viewer-editor .cm-gutters {
          background: #0a0f1a;
          border-right: 1px solid rgba(148, 163, 184, 0.2);
        }
        .source-viewer-editor .cm-lineNumbers .cm-gutterElement {
          color: rgba(148, 163, 184, 0.7);
        }
        .source-viewer-loading {
          padding: 16px;
          color: #94a3b8;
          font-size: 12px;
        }
        .source-viewer-error {
          padding: 16px;
          color: #fca5a5;
          font-size: 12px;
        }
        @media (max-width: 900px) {
          .source-viewer-card {
            width: 96%;
          }
        }
      </style>
      <div class="source-viewer-card" role="dialog" aria-live="polite">
        <div class="source-viewer-header">
          <span>Widget Source</span>
          <div class="source-viewer-actions">
            <button class="source-viewer-button" onClick=${() => setReadOnly(!isReadOnly)}>
              ${isReadOnly ? "Editable" : "Read-Only"}
            </button>
            <button class="source-viewer-button primary" disabled=${!isDirty} onClick=${handleApply}>
              Apply Changes
            </button>
            <button class="source-viewer-button" onClick=${onClose}>Close</button>
          </div>
        </div>
        <div class="source-viewer-body">
          ${errorMessage && html`
            <div class="source-viewer-error-banner">
              ${errorMessage}
            </div>
          `}
          <div class="source-viewer-editor">
            ${isLoading && html`<div class="source-viewer-loading">Loading editor...</div>`}
            ${loadError && html`<div class="source-viewer-error">${loadError}</div>`}
            <div ref=${containerRef} style=${{ height: "100%" }}></div>
          </div>
        </div>
      </div>
    </div>
  `;
}
