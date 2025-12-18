import * as React from "https://esm.sh/react@18";

// Handles Ctrl/Cmd+E to start grab mode when allowed.
export default function useKeyboardShortcuts({ isLoading, hasCode, grabMode, onGrabStart }) {
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        if (!isLoading && hasCode && !grabMode) {
          onGrabStart();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, hasCode, grabMode, onGrabStart]);
}
