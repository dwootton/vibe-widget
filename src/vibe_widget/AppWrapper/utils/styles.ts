// Shared style helpers for the AppWrapper bundle.

export function ensureGlobalStyles(): void {
  if (document.querySelector("#vibe-widget-global-styles")) return;

  const globalStyles = document.createElement("style");
  globalStyles.id = "vibe-widget-global-styles";
  globalStyles.textContent = `
  .cell-output-ipywidget-background {
    background: transparent !important;
  }
  .jp-OutputArea-output {
    background: transparent !important;
  }
`;

  document.head.appendChild(globalStyles);
}
