import type { DataFileConfig } from "../../utils/exampleDataLoader";

export interface NotebookCell {
  type: "markdown" | "code";
  content: string;
  readOnly?: boolean;
  defaultCollapsed?: boolean;
  label?: string;
}

export interface NotebookSpec {
  cells: NotebookCell[];
  dataFiles: DataFileConfig[];
}
