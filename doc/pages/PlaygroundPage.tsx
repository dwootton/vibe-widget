import React, { useState } from "react";
import Notebook from "../components/Notebook";
import { STARTER_CELLS, nextCellId } from "../data/playgroundStarterCells";

export default function PlaygroundPage(): React.ReactElement {
  const [initialCells] = useState(() =>
    STARTER_CELLS.map((c) => ({ ...c, id: nextCellId() }))
  );

  return (
    <main className="relative pt-24 pb-20 min-h-screen">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-5xl font-display font-bold mb-3">Playground</h1>
          <p className="text-lg text-slate/60 font-mono">
            Interactive Python notebook with vibe_widget, pandas, and numpy. Same
            notebook UI as the gallery—edit cells, run code, and add new cells.
          </p>
        </div>
        <Notebook editable cells={initialCells} />
      </div>
    </main>
  );
}
