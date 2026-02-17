import type { NotebookSpec } from "./types";
import { crossWidget } from "./cross-widget";
import { pdfWeb } from "./pdf-web";
import { revise } from "./revise";
import { tictactoe } from "./tictactoe";

const REGISTRY: Record<string, NotebookSpec> = {
  "cross-widget": crossWidget,
  tictactoe,
  "pdf-web": pdfWeb,
  edit: revise,
  revise,
};

/**
 * Look up a notebook by id. Use "edit" for the widget editing demo (same as "revise").
 */
export function getNotebook(id: string): NotebookSpec | null {
  return REGISTRY[id] ?? null;
}

export type { NotebookCell, NotebookSpec } from "./types";
export { crossWidget } from "./cross-widget";
export { pdfWeb } from "./pdf-web";
export { revise } from "./revise";
export { tictactoe } from "./tictactoe";
