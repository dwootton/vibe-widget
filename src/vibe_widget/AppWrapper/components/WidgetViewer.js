import React, { useState, useRef } from "react";

import SandboxedRunner from "./SandboxedRunner";
import FloatingMenu from "./FloatingMenu";
import SelectionOverlay from "./SelectionOverlay";
import AnnotationMarkers from "./AnnotationMarkers";
import AnnotationToolbar from "./AnnotationToolbar";
import InlinePromptEditor from "./InlinePromptEditor";
import useGrabEdit from "../hooks/useGrabEdit";
import useKeyboardShortcuts from "../hooks/useKeyboardShortcuts";
import { debugLog } from "../utils/debug";
import { tw } from "../styles/setup.js";

let widgetViewerCounter = 0;

export default function WidgetViewer({
  model,
  code,
  containerBounds,
  onViewSource,
  onSave,
  highAuditCount
}) {
  const instanceId = React.useRef(++widgetViewerCounter).current;
  debugLog(model, "[vibe][debug] WidgetViewer render", { instanceId, codeLen: code?.length });

  const [isMenuOpen, setMenuOpen] = useState(false);
  const {
    mode,
    annotations,
    activeAnnotationId,
    startAnnotating,
    addAnnotation,
    removeAnnotation,
    setAnnotationPrompt,
    setActiveAnnotation,
    clearAnnotations,
    submitAnnotations,
    cancelAnnotating
  } = useGrabEdit(model);
  const hasCode = code && code.length > 0;

  const handleGrabStart = () => {
    setMenuOpen(false);
    startAnnotating();
  };

  useKeyboardShortcuts({ isLoading: false, hasCode, grabMode: mode, onGrabStart: handleGrabStart });

  const handleElementSelect = (description, bounds) => {
    addAnnotation(description, bounds);
  };

  const handleMarkerClick = (annotationId) => {
    setActiveAnnotation(annotationId === activeAnnotationId ? null : annotationId);
  };

  const handlePromptDone = (annotationId) => {
    setActiveAnnotation(null);
  };

  const activeAnnotation = annotations.find((a) => a.id === activeAnnotationId) || null;
  const hasAnnotations = annotations.length > 0;

  return (
    <div class={tw("relative w-full h-full")}>
      {hasCode && <SandboxedRunner code={code} model={model} runKey={0} />}

      {hasCode && (
        <FloatingMenu
          isOpen={isMenuOpen}
          onToggle={() => setMenuOpen(!isMenuOpen)}
          onGrabModeStart={handleGrabStart}
          onViewSource={() => {
            setMenuOpen(false);
            onViewSource();
          }}
          onSave={() => {
            setMenuOpen(false);
            onSave?.();
          }}
          highAuditCount={highAuditCount}
          isEditMode={!!mode}
          annotationCount={annotations.length}
          filledCount={annotations.filter((a) => a.prompt.trim()).length}
          onAnnotationSubmit={submitAnnotations}
          onAnnotationClear={clearAnnotations}
          onAnnotationCancel={cancelAnnotating}
        />
      )}

      {mode === "annotating" && (
        <SelectionOverlay
          onElementSelect={handleElementSelect}
          onCancel={cancelAnnotating}
          suppressHover={!!activeAnnotationId}
          showHint={!hasAnnotations}
        />
      )}

      {mode === "annotating" && (
        <AnnotationMarkers
          annotations={annotations}
          activeAnnotationId={activeAnnotationId}
          onMarkerClick={handleMarkerClick}
        />
      )}

      {mode === "annotating" && activeAnnotation && (
        <InlinePromptEditor
          annotation={activeAnnotation}
          containerBounds={containerBounds}
          onPromptChange={setAnnotationPrompt}
          onDone={handlePromptDone}
          onRemove={removeAnnotation}
        />
      )}

      {mode === "annotating" && hasAnnotations && (
        <AnnotationToolbar
          annotations={annotations}
          onClear={clearAnnotations}
          onSubmit={submitAnnotations}
          onCancel={cancelAnnotating}
        />
      )}
    </div>
  );
}
