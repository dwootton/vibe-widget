import React from "react";
import Notebook from "./Notebook";
import { getNotebook } from "../data/notebooks";

interface ExampleNotebookProps {
  exampleId: string;
  title?: string;
}

/**
 * Renders a read-only example notebook by id (e.g. "cross-widget", "tictactoe", "pdf-web", "edit").
 */
export default function ExampleNotebook({ exampleId, title }: ExampleNotebookProps): React.ReactElement {
  const spec = getNotebook(exampleId);

  if (!spec) {
    return (
      <div className="bg-white border-2 border-slate rounded-2xl p-6 shadow-hard-sm">
        <p className="text-sm text-slate/70 font-mono">Notebook not found: {exampleId}</p>
      </div>
    );
  }

  return (
    <Notebook
      editable={false}
      cells={[]}
      title={title}
      notebookKey={exampleId}
    />
  );
}
