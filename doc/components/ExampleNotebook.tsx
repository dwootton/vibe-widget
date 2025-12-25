import React from 'react';
import PyodideNotebook from './PyodideNotebook';
import {
  CROSS_WIDGET_NOTEBOOK,
  TICTACTOE_NOTEBOOK,
  PDF_WEB_NOTEBOOK,
  REVISE_NOTEBOOK,
  WEATHER_DATA_FILES,
  TICTACTOE_DATA_FILES,
  PDF_WEB_DATA_FILES,
  REVISE_DATA_FILES,
} from '../data/pyodideNotebooks';

const NOTEBOOKS = {
  'cross-widget': {
    cells: CROSS_WIDGET_NOTEBOOK,
    dataFiles: WEATHER_DATA_FILES,
    title: 'Cross-Widget Interactions',
  },
  tictactoe: {
    cells: TICTACTOE_NOTEBOOK,
    dataFiles: TICTACTOE_DATA_FILES,
    title: 'Tic-Tac-Toe AI',
  },
  'pdf-web': {
    cells: PDF_WEB_NOTEBOOK,
    dataFiles: PDF_WEB_DATA_FILES,
    title: 'PDF & Web Data Extraction',
  },
  edit: {
    cells: REVISE_NOTEBOOK,
    dataFiles: REVISE_DATA_FILES,
    title: 'Widget Editing',
  },
};

const ExampleNotebook = ({ exampleId, title }: { exampleId: keyof typeof NOTEBOOKS; title?: string }) => {
  const config = NOTEBOOKS[exampleId];

  if (!config) {
    return (
      <div className="bg-white border-2 border-slate rounded-2xl p-6 shadow-hard-sm">
        <p className="text-sm text-slate/70 font-mono">Example notebook not found.</p>
      </div>
    );
  }

  return (
    <PyodideNotebook
      cells={config.cells}
      title={title || config.title}
      dataFiles={config.dataFiles}
      notebookKey={exampleId}
    />
  );
};

export default ExampleNotebook;
