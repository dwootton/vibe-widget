import * as React from "react";
import { requestGrabEdit, requestBatchGrabEdit } from "../actions/modelActions";

let annotationCounter = 0;

export default function useGrabEdit(model) {
  const [mode, setMode] = React.useState(null); // null | "annotating"
  const [annotations, setAnnotations] = React.useState([]);
  const [activeAnnotationId, setActiveAnnotationId] = React.useState(null);

  const startAnnotating = React.useCallback(() => {
    setMode("annotating");
    setAnnotations([]);
    setActiveAnnotationId(null);
    annotationCounter = 0;
  }, []);

  const addAnnotation = React.useCallback((elementDescription, elementBounds) => {
    const elementKey = `${elementDescription.tag}-${elementDescription.classes}-${elementDescription.text?.slice(0, 20)}`;

    setAnnotations((prev) => {
      // Deduplicate: if elementKey already exists, activate that annotation instead
      const existing = prev.find((a) => a.elementKey === elementKey);
      if (existing) {
        setActiveAnnotationId(existing.id);
        return prev;
      }

      // Warn at 5+, soft cap at 10
      if (prev.length >= 10) return prev;

      annotationCounter += 1;
      const id = `ann-${Date.now()}-${annotationCounter}`;
      const annotation = {
        id,
        number: annotationCounter,
        element: elementDescription,
        bounds: elementBounds,
        elementKey,
        prompt: ""
      };

      // Auto-close current editor when adding new annotation
      setActiveAnnotationId(id);
      return [...prev, annotation];
    });
  }, []);

  const removeAnnotation = React.useCallback((annotationId) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
    setActiveAnnotationId((prev) => (prev === annotationId ? null : prev));
  }, []);

  const setAnnotationPrompt = React.useCallback((annotationId, prompt) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === annotationId ? { ...a, prompt } : a))
    );
  }, []);

  const clearAnnotations = React.useCallback(() => {
    setAnnotations([]);
    setActiveAnnotationId(null);
    annotationCounter = 0;
  }, []);

  const submitAnnotations = React.useCallback(() => {
    const filled = annotations.filter((a) => a.prompt.trim());
    if (filled.length === 0) return;

    if (filled.length === 1) {
      // Single annotation: use original single-element path for backward compat
      requestGrabEdit(model, { element: filled[0].element, prompt: filled[0].prompt.trim() });
    } else {
      requestBatchGrabEdit(model, {
        annotations: filled.map((a) => ({ element: a.element, prompt: a.prompt.trim() }))
      });
    }

    setAnnotations([]);
    setActiveAnnotationId(null);
    setMode(null);
    annotationCounter = 0;
  }, [annotations, model]);

  const cancelAnnotating = React.useCallback(() => {
    setAnnotations([]);
    setActiveAnnotationId(null);
    setMode(null);
    annotationCounter = 0;
  }, []);

  return {
    mode,
    annotations,
    activeAnnotationId,
    startAnnotating,
    addAnnotation,
    removeAnnotation,
    setAnnotationPrompt,
    setActiveAnnotation: setActiveAnnotationId,
    clearAnnotations,
    submitAnnotations,
    cancelAnnotating
  };
}
