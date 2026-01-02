import React, { useEffect, useState, Suspense } from 'react';
import type { NotebookData } from '../data/pyodideNotebooks';

const PyodideNotebook = React.lazy(() => import('./PyodideNotebook'));

const ExampleNotebook = ({ exampleId, title }: { exampleId: string; title?: string }) => {
  const [notebook, setNotebook] = useState<NotebookData | null>(null);

  useEffect(() => {
    let mounted = true;

    import('../data/pyodideNotebooks').then((mod) => {
      if (mounted) {
        // Look up notebook directly from registry
        setNotebook(mod.NOTEBOOK_REGISTRY[exampleId] || null);
      }
    });

    return () => {
      mounted = false;
    };
  }, [exampleId]);

  if (!notebook) {
    return (
      <div className="bg-white border-2 border-slate rounded-2xl p-6 shadow-hard-sm">
        <p className="text-sm text-slate/70 font-mono">Loading notebook...</p>
      </div>
    );
  }

  return (
    <Suspense
      fallback={(
        <div className="bg-white border-2 border-slate rounded-2xl p-6 shadow-hard-sm">
          <p className="text-sm text-slate/70 font-mono">Loading notebook...</p>
        </div>
      )}
    >
      <PyodideNotebook
        cells={notebook.cells}
        title={title || notebook.title}
        dataFiles={notebook.dataFiles}
        widgetConfig={notebook.widgets}
        notebookKey={exampleId}
      />
    </Suspense>
  );
};

export default ExampleNotebook;
