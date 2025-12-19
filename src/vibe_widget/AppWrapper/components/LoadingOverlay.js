import * as React from "https://esm.sh/react@18";
import htm from "https://esm.sh/htm@3";
import ProgressMap from "./ProgressMap";

const html = htm.bind(React.createElement);

export default function LoadingOverlay({ logs, hasExistingWidget }) {
  if (hasExistingWidget) {
    return html`
      <div class="loading-overlay" style=${{
        position: "absolute",
        inset: 0,
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "stretch",
        zIndex: 1000,
        backdropFilter: "blur(3px)",
      }}>
        <div style=${{
          width: "100%",
          height: "100%",
          padding: "12px",
        }}>
          <${ProgressMap} logs=${logs} fullHeight=${true} />
        </div>
      </div>
    `;
  }

  return html`
    <div style=${{ width: "100%", height: "100%" }}>
      <${ProgressMap} logs=${logs} fullHeight=${true} />
    </div>
  `;
}
