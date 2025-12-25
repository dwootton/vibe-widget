import React, { useEffect, useState, Suspense } from 'react';

const PyodideNotebook = React.lazy(() => import('./PyodideNotebook'));

type NotebookConfig = {
  cells: any[];
  dataFiles: { url: string; varName: string; type?: string }[];
  title: string;
};

const ExampleNotebook = ({ exampleId, title }: { exampleId: string; title?: string }) => {
  const [config, setConfig] = useState<NotebookConfig | null>(null);

  useEffect(() => {
    let mounted = true;

    import('../data/pyodideNotebooks').then((mod) => {
      const notebooks: Record<string, NotebookConfig> = {
        'cross-widget': {
          cells: mod.CROSS_WIDGET_NOTEBOOK,
          dataFiles: mod.WEATHER_DATA_FILES,
          title: 'Cross-Widget Interactions',
        },
        tictactoe: {
          cells: mod.TICTACTOE_NOTEBOOK,
          dataFiles: mod.TICTACTOE_DATA_FILES,
          title: 'Tic-Tac-Toe AI',
        },
        'pdf-web': {
          cells: mod.PDF_WEB_NOTEBOOK,
          dataFiles: mod.PDF_WEB_DATA_FILES,
          title: 'PDF & Web Data Extraction',
        },
        edit: {
          cells: mod.REVISE_NOTEBOOK,
          dataFiles: mod.REVISE_DATA_FILES,
          title: 'Widget Editing',
        },
      };

      if (mounted) {
        setConfig(notebooks[exampleId] || null);
      }
    });

    return () => {
      mounted = false;
    };
  }, [exampleId]);

  if (!config) {
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
        cells={config.cells}
        title={title || config.title}
        dataFiles={config.dataFiles}
        notebookKey={exampleId}
      />
    </Suspense>
  );
};

export default ExampleNotebook;
