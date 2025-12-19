import * as React from "react";
import htm from "htm";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const html = htm.bind(React.createElement);

// Synthesized Theme: Warm, tactile, mechanical keyboard aesthetic
const synthesizedTheme = EditorView.theme({
  "&": {
    backgroundColor: "#161618",
    color: "#E5E7EB",
    fontSize: "12px",
    fontFamily: "JetBrains Mono, Space Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  ".cm-content": {
    caretColor: "#EF7D45",
    lineHeight: "1.6",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#EF7D45",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "#EF7D45",
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(239, 125, 69, 0.2)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "rgba(239, 125, 69, 0.15)",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(239, 125, 69, 0.03)",
    boxShadow: "inset 2px 0 0 #EF7D45",
  },
  ".cm-gutters": {
    backgroundColor: "#161618",
    color: "#6B7280",
    border: "none",
    borderRight: "1px solid #2d3139",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(239, 125, 69, 0.08)",
    color: "#EF7D45",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    color: "#6B7280",
    minWidth: "3ch",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "rgba(239, 125, 69, 0.1)",
    border: "1px solid rgba(239, 125, 69, 0.3)",
    color: "#FDBA74",
  },
  ".cm-tooltip": {
    backgroundColor: "#0f141a",
    border: "1px solid rgba(71, 85, 105, 0.6)",
    borderRadius: "6px",
  },
  ".cm-tooltip.cm-tooltip-autocomplete": {
    "& > ul > li[aria-selected]": {
      backgroundColor: "rgba(239, 125, 69, 0.2)",
      color: "#EF7D45",
    },
  },
}, { dark: true });

// Syntax highlighting with warm, tactile colors
const synthesizedHighlighting = HighlightStyle.define([
  // Structural keywords: Desaturated orange
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword], color: "#E89560", fontWeight: "600" },

  // Library namespaces (React, d3, model): Warm Amber - THE "power players"
  { tag: [t.namespace], color: "#FDBA74", fontWeight: "500" },

  // Function names: Sunlight Gold
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#FDBA74", fontWeight: "500" },

  // Class names: Warm amber
  { tag: [t.className, t.typeName, t.definition(t.typeName)], color: "#FCD34D" },

  // Strings: Sage Green
  { tag: [t.string, t.special(t.string)], color: "#A3B18A" },

  // Numbers: Brighter warm clay
  { tag: [t.number, t.bool, t.null, t.atom], color: "#E5B887", fontWeight: "500" },

  // Comments: Muted Clay (italic)
  { tag: t.comment, color: "#6B7280", fontStyle: "italic" },

  // Operators: Subtle warm gray
  { tag: [t.operator, t.punctuation], color: "#9CA3AF" },

  // Object properties (.current, .top, .bottom): Off-white
  { tag: [t.propertyName], color: "#D1D5DB" },

  // Variables: Bright enough to pop
  { tag: [t.variableName], color: "#E5E7EB" },

  // Variables being DEFINED: Vibe Orange
  { tag: [t.definition(t.variableName)], color: "#EF7D45", fontWeight: "500" },

  // Tags (JSX): Warm orange
  { tag: [t.tagName, t.angleBracket], color: "#FB923C" },

  // Attributes: Muted amber
  { tag: t.attributeName, color: "#FCD34D" },

  // Invalid/errors: Warm red
  { tag: t.invalid, color: "#F87171", textDecoration: "underline wavy" },

  // Meta/preprocessor: Muted orange
  { tag: t.meta, color: "#FB923C" },
]);

const CodeEditor = React.forwardRef(function CodeEditor({ value, onChange }, ref) {
  const containerRef = React.useRef(null);
  const viewRef = React.useRef(null);
  const [isLoading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");

  const setEditorValue = (nextCode) => {
    if (!viewRef.current) return;
    const current = viewRef.current.state.doc.toString();
    const next = nextCode || "";
    if (current === next) return;
    viewRef.current.dispatch({
      changes: { from: 0, to: current.length, insert: next }
    });
  };

  React.useImperativeHandle(ref, () => ({
    getView: () => viewRef.current,
    getContainer: () => containerRef.current,
    setCode: setEditorValue
  }));

  React.useEffect(() => {
    if (!containerRef.current) return;
    if (viewRef.current) return;
    try {
      setLoading(true);
      const extensions = [
        basicSetup,
        javascript({ jsx: true, typescript: false }),
        synthesizedTheme,
        syntaxHighlighting(synthesizedHighlighting),
        EditorView.lineWrapping,
        EditorView.domEventHandlers({
          keydown: (event) => {
            event.stopPropagation();
          }
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
        EditorView.editable.of(true)
      ];
      const startState = EditorState.create({
        doc: value || "",
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
  }, [value, onChange]);

  React.useEffect(() => {
    if (!viewRef.current) return;
    if (typeof viewRef.current.hasFocus === "function" && viewRef.current.hasFocus()) {
      return;
    }
    setEditorValue(value);
  }, [value]);

  return html`
    <div class="source-viewer-editor">
      ${isLoading && html`<div class="source-viewer-loading">Loading editor...</div>`}
      ${loadError && html`<div class="source-viewer-error">${loadError}</div>`}
      <div ref=${containerRef} style=${{ height: "100%" }}></div>
    </div>
  `;
});

export default CodeEditor;
