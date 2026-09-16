import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { tw } from "../../styles/setup.js";

const wrapperClass = tw("relative w-full flex flex-col min-h-0 min-w-0");
const editorClass = tw(
  "flex-1 bg-[#0b0b0b] border border-[rgba(242,240,233,0.15)] rounded-[4px] text-[12px] text-text-primary font-mono overflow-auto flex flex-col min-h-0"
);
const editorContainerClass = tw("flex-1 min-h-0");
const messageClass = tw("px-3 py-2 text-[12px]");
const errorClass = tw("text-error-light");

const editorStyles = `
.source-viewer-editor {
  position: relative;
  height: 100%;
}
.source-viewer-editor,
.source-viewer-editor .cm-content,
.source-viewer-editor .cm-line {
  user-select: text;
  -webkit-user-select: text;
}
.source-viewer-editor .cm-editor {
  height: 100%;
}
.source-viewer-editor .cm-scroller {
  font-family: inherit;
  font-size: inherit;
}
.source-viewer-loading, .source-viewer-error {
  padding: 12px;
  font-size: 12px;
}
.source-viewer-error {
  color: #fca5a5;
}
`;

const synthesizedTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#161618",
      color: "#E5E7EB",
      fontSize: "12px",
      fontFamily:
        "JetBrains Mono, Space Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    },
    ".cm-content": {
      caretColor: "#EF7D45",
      lineHeight: "1.6"
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#EF7D45",
      borderLeftWidth: "2px"
    },
    "&.cm-focused .cm-cursor": {
      borderLeftColor: "#EF7D45"
    },
    "&.cm-focused .cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(239, 125, 69, 0.2)"
    },
    ".cm-selectionBackground": {
      backgroundColor: "rgba(239, 125, 69, 0.15)"
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(239, 125, 69, 0.03)",
      boxShadow: "inset 2px 0 0 #EF7D45"
    },
    ".cm-gutters": {
      backgroundColor: "#161618",
      color: "#6B7280",
      border: "none",
      borderRight: "1px solid #2d3139"
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(239, 125, 69, 0.08)",
      color: "#EF7D45"
    },
    ".cm-lineNumbers .cm-gutterElement": {
      color: "#6B7280",
      minWidth: "3ch"
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "rgba(239, 125, 69, 0.1)",
      border: "1px solid rgba(239, 125, 69, 0.3)",
      color: "#FDBA74"
    },
    ".cm-tooltip": {
      backgroundColor: "#0f141a",
      border: "1px solid rgba(71, 85, 105, 0.6)",
      borderRadius: "6px"
    },
    ".cm-tooltip.cm-tooltip-autocomplete": {
      "& > ul > li[aria-selected]": {
        backgroundColor: "rgba(239, 125, 69, 0.2)",
        color: "#EF7D45"
      }
    }
  },
  { dark: true }
);

const synthesizedHighlighting = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword], color: "#E89560", fontWeight: "600" },
  { tag: [t.namespace], color: "#FDBA74", fontWeight: "500" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#FDBA74", fontWeight: "500" },
  { tag: [t.className, t.typeName, t.definition(t.typeName)], color: "#FCD34D" },
  { tag: [t.string, t.special(t.string)], color: "#A3B18A" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "#E5B887", fontWeight: "500" },
  { tag: t.comment, color: "#6B7280", fontStyle: "italic" },
  { tag: [t.operator, t.punctuation], color: "#9CA3AF" },
  { tag: [t.propertyName], color: "#D1D5DB" },
  { tag: [t.variableName], color: "#E5E7EB" },
  { tag: [t.definition(t.variableName)], color: "#EF7D45", fontWeight: "500" },
  { tag: [t.tagName, t.angleBracket], color: "#FB923C" },
  { tag: t.attributeName, color: "#FCD34D" },
  { tag: t.invalid, color: "#F87171", textDecoration: "underline wavy" },
  { tag: t.meta, color: "#FB923C" }
]);

const CodeEditor = React.forwardRef(function CodeEditor({ value, onChange }, ref) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const internalUpdateRef = useRef(false);
  const [isLoading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const setEditorValue = (nextCode) => {
    if (!viewRef.current) return;
    const current = viewRef.current.state.doc.toString();
    const next = nextCode || "";
    if (current === next) return;
    const selection = viewRef.current.state.selection.main;
    const nextAnchor = Math.min(selection.anchor, next.length);
    const nextHead = Math.min(selection.head, next.length);
    viewRef.current.dispatch({
      changes: { from: 0, to: current.length, insert: next },
      selection: { anchor: nextAnchor, head: nextHead }
    });
  };

  useImperativeHandle(ref, () => ({
    getView: () => viewRef.current,
    getContainer: () => containerRef.current,
    setCode: setEditorValue
  }));

  useEffect(() => {
    if (!containerRef.current || viewRef.current) return;
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
            internalUpdateRef.current = true;
            onChange?.(update.state.doc.toString());
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
  }, []);

  useEffect(() => {
    if (!viewRef.current) return;
    const current = viewRef.current.state.doc.toString();
    if (current === (value || "")) {
      internalUpdateRef.current = false;
      return;
    }
    if (internalUpdateRef.current) {
      internalUpdateRef.current = false;
      return;
    }
    setEditorValue(value);
  }, [value]);

  return (
    <div class={wrapperClass}>
      <style>{editorStyles}</style>
      {isLoading && <div class={messageClass}>Loading editor...</div>}
      {loadError && <div class={`${messageClass} ${errorClass}`}>{loadError}</div>}
      <div
        class={`${editorClass} source-viewer-editor`}
        onMouseDown={() => {
          if (viewRef.current) {
            viewRef.current.focus();
          }
        }}
      >
        <div ref={containerRef} class={editorContainerClass}></div>
      </div>
    </div>
  );
});

export default CodeEditor;
