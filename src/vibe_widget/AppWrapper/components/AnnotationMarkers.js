import React from "react";

export default function AnnotationMarkers({ annotations, activeAnnotationId, onMarkerClick }) {
  if (!annotations || annotations.length === 0) return null;

  return (
    <div
      class="annotation-marker"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        pointerEvents: "none"
      }}
    >
      {annotations.map((ann) => {
        const isActive = ann.id === activeAnnotationId;
        const cx = ann.bounds.left + ann.bounds.width / 2;
        const cy = ann.bounds.top;

        return (
          <div
            key={ann.id}
            style={{
              position: "fixed",
              left: `${cx - 12}px`,
              top: `${cy - 28}px`,
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              background: "#f97316",
              color: "white",
              fontSize: "12px",
              fontWeight: 700,
              fontFamily: "ui-monospace, monospace",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "auto",
              cursor: "pointer",
              transition: "transform 0.15s ease, border 0.15s ease",
              transform: isActive ? "scale(1.15)" : "scale(1)",
              border: isActive ? "2px solid white" : "2px solid transparent",
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              userSelect: "none",
              lineHeight: 1
            }}
            onClick={(e) => {
              e.stopPropagation();
              onMarkerClick(ann.id);
            }}
          >
            {ann.number}
          </div>
        );
      })}
    </div>
  );
}
