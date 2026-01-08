import React from "react";
import ProgressMap from "./ProgressMap";

export default function LoadingOverlay({ logs, hasExistingWidget }) {
  if (hasExistingWidget) {
    return (
      <div
        class="loading-overlay"
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.6)",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "stretch",
          zIndex: 1000,
          backdropFilter: "blur(3px)"
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            padding: "12px"
          }}
        >
          <ProgressMap logs={logs} fullHeight={true} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ProgressMap logs={logs} fullHeight={true} />
    </div>
  );
}
