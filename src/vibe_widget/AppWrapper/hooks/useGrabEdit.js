import * as React from "react";
import { requestGrabEdit } from "../actions/modelActions";

export default function useGrabEdit(model) {
  const [grabMode, setGrabMode] = React.useState(null);
  const [promptCache, setPromptCache] = React.useState({});

  const startGrab = React.useCallback(() => {
    setGrabMode("selecting");
  }, []);

  const selectElement = React.useCallback((elementDescription, elementBounds) => {
    const elementKey = `${elementDescription.tag}-${elementDescription.classes}-${elementDescription.text?.slice(0, 20)}`;
    setGrabMode({ element: elementDescription, bounds: elementBounds, elementKey });
  }, []);

  const submitEdit = React.useCallback((prompt) => {
    if (!grabMode || grabMode === "selecting") return;
    requestGrabEdit(model, { element: grabMode.element, prompt });
    setPromptCache((prev) => ({ ...prev, [grabMode.elementKey]: prompt }));
    setGrabMode(null);
  }, [grabMode, model]);

  const cancelEdit = React.useCallback((currentPrompt) => {
    if (grabMode?.elementKey && currentPrompt) {
      setPromptCache((prev) => ({ ...prev, [grabMode.elementKey]: currentPrompt }));
    }
    setGrabMode(null);
  }, [grabMode]);

  return {
    grabMode,
    promptCache,
    startGrab,
    selectElement,
    submitEdit,
    cancelEdit
  };
}
