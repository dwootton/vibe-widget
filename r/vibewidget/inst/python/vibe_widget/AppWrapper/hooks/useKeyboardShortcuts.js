import * as React from "react";

// Handles Ctrl/Cmd+E to start grab mode, scoped to one widget's subtree so
// multiple widgets on a page do not all fire on the same keystroke.
export default function useKeyboardShortcuts({ targetRef, isLoading, hasCode, grabMode, onGrabStart }) {
  React.useEffect(() => {
    const el = targetRef && targetRef.current;
    if (!el) return;
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        if (!isLoading && hasCode && !grabMode) {
          onGrabStart();
        }
      }
    };
    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [targetRef, isLoading, hasCode, grabMode, onGrabStart]);
}
