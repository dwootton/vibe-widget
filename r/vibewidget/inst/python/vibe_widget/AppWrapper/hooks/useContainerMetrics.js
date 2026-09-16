import * as React from "react";

export default function useContainerMetrics(renderCode) {
  const containerRef = React.useRef(null);
  const [containerBounds, setContainerBounds] = React.useState(null);
  const [minHeight, setMinHeight] = React.useState(0);

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateBounds = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setContainerBounds({
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      });
    };

    updateBounds();

    let resizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateBounds);
      resizeObserver.observe(node);
    }

    window.addEventListener("resize", updateBounds);
    window.addEventListener("scroll", updateBounds, true);

    return () => {
      window.removeEventListener("resize", updateBounds);
      window.removeEventListener("scroll", updateBounds, true);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  React.useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = Math.round(entry.contentRect.height || 0);
        if (height > 50) {
          setMinHeight(height);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    setMinHeight(0);
  }, [renderCode]);

  return { containerRef, containerBounds, minHeight };
}
