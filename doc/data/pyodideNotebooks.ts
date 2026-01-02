import type { NotebookCell } from '../components/PyodideNotebook';

// Import notebook definitions from JSON files
import reviseNotebookData from './notebooks/revise_notebook.json';
import crossWidgetNotebookData from './notebooks/cross_widget_notebook.json';
import tictactoeNotebookData from './notebooks/tictactoe_notebook.json';
import pdfWebNotebookData from './notebooks/pdf_web_notebook.json';
import mnistNotebookData from './notebooks/mnist_notebook.json';
import chiPapersNotebookData from './notebooks/chi_papers_notebook.json';

/**
 * Notebook data structure with cells and metadata
 */
export interface NotebookData {
  cells: NotebookCell[];
  dataFiles?: DataFile[];
  remoteDataFiles?: RemoteDataFile[];
  preloadWidgets?: { url: string }[];
}

export interface DataFile {
  url: string;
  varName: string;
  type?: string;
}

export interface RemoteDataFile {
  url: string;
  varName: string;
  type?: 'csv' | 'json';
}

/**
 * Type guard to validate notebook data structure
 */
function isNotebookData(data: unknown): data is NotebookData {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.cells);
}

/**
 * Helper to extract cells from notebook data
 */
function extractCells(data: unknown): NotebookCell[] {
  if (isNotebookData(data)) {
    return data.cells;
  }
  if (Array.isArray(data)) {
    return data as NotebookCell[];
  }
  console.warn('Invalid notebook data format');
  return [];
}

// ============================================================================
// Exported Notebooks (extracted from JSON)
// ============================================================================

/**
 * Widget Editing demo notebook
 * Showcases iterative refinement of widgets
 */
export const REVISE_NOTEBOOK: NotebookCell[] = extractCells(reviseNotebookData);

/**
 * Cross-Widget Interactions notebook
 * Demonstrates traitlets-based reactivity between widgets
 */
export const CROSS_WIDGET_NOTEBOOK: NotebookCell[] = extractCells(crossWidgetNotebookData);

/**
 * Tic-Tac-Toe AI demo notebook
 * Showcases Python ML + widget interactions
 */
export const TICTACTOE_NOTEBOOK: NotebookCell[] = extractCells(tictactoeNotebookData);

/**
 * PDF & Web Data Extraction notebook
 */
export const PDF_WEB_NOTEBOOK: NotebookCell[] = extractCells(pdfWebNotebookData);

/**
 * MNIST Digit Recognition notebook
 * Interactive canvas with live predictions using traitlets reactivity
 */
export const MNIST_NOTEBOOK: NotebookCell[] = extractCells(mnistNotebookData);

/**
 * CHI 2025 Papers Explorer notebook
 * Semantic similarity search with cross-widget communication
 */
export const CHI_PAPERS_NOTEBOOK: NotebookCell[] = extractCells(chiPapersNotebookData);

// ============================================================================
// Data File Configurations
// ============================================================================

/**
 * Data files for weather-based demos
 */
export const WEATHER_DATA_FILES: DataFile[] = [
  { url: '/testdata/seattle-weather.csv', varName: 'data' },
];

/**
 * Data files for Tic-Tac-Toe demo
 */
export const TICTACTOE_DATA_FILES: DataFile[] = [
  { url: '/testdata/X_moves.csv', varName: 'x_moves_df' },
  { url: '/testdata/O_moves.csv', varName: 'o_moves_df' },
];

/**
 * Data files for PDF & Web extraction demo
 */
export const PDF_WEB_DATA_FILES: DataFile[] = [
  { url: '/testdata/planets.csv', varName: 'planets_df' },
  { url: '/testdata/hn_stories.json', varName: 'hn_df', type: 'json' },
];

/**
 * Data files for widget editing demo
 */
export const REVISE_DATA_FILES: DataFile[] = [
  { url: '/testdata/day_wise.csv', varName: 'covid_df' },
];

/**
 * MNIST notebook uses remote data from GitHub releases
 */
export const MNIST_DATA_FILES: DataFile[] = [
  { url: '/testdata/mnist_model.h5', varName: 'mnist_model', type: 'binary' },
];
export const MNIST_REMOTE_DATA_FILES: RemoteDataFile[] = [];

/**
 * CHI Papers notebook loads data from GitHub releases
 */
export const CHI_PAPERS_DATA_FILES: DataFile[] = [];
export const CHI_PAPERS_REMOTE_DATA_FILES: RemoteDataFile[] = [];
export const CHI_PAPERS_LOCAL_DATA_FILES: DataFile[] = [
  { url: '/testdata/CHI_2025_papers_2D.csv', varName: 'papers_df', type: 'csv' }
];

// ============================================================================
// Notebook Registry
// ============================================================================

/**
 * Map notebook key to its cells, data files, and metadata
 */
export const NOTEBOOK_REGISTRY: Record<string, {
  cells: NotebookCell[];
  dataFiles: DataFile[];
  remoteDataFiles?: RemoteDataFile[];
  title?: string;
  description?: string;
}> = {
  'edit': {
    cells: REVISE_NOTEBOOK,
    dataFiles: REVISE_DATA_FILES,
    title: 'Widget Editing',
    description: 'Iteratively refine widgets with vw.edit()'
  },
  'cross-widget': {
    cells: CROSS_WIDGET_NOTEBOOK,
    dataFiles: WEATHER_DATA_FILES,
    title: 'Cross-Widget Interactions',
    description: 'Traitlets-based reactivity between widgets'
  },
  'tictactoe': {
    cells: TICTACTOE_NOTEBOOK,
    dataFiles: TICTACTOE_DATA_FILES,
    title: 'Tic-Tac-Toe AI',
    description: 'Play against ML-powered AI'
  },
  'pdf-web': {
    cells: PDF_WEB_NOTEBOOK,
    dataFiles: PDF_WEB_DATA_FILES,
    title: 'PDF & Web Extraction',
    description: 'Extract and visualize data from PDFs and websites'
  },
  'mnist': {
    cells: MNIST_NOTEBOOK,
    dataFiles: MNIST_DATA_FILES,
    remoteDataFiles: MNIST_REMOTE_DATA_FILES,
    title: 'MNIST Digit Recognition',
    description: 'Draw digits and watch neural network predictions'
  },
  'chi-papers': {
    cells: CHI_PAPERS_NOTEBOOK,
    dataFiles: [...CHI_PAPERS_DATA_FILES, ...CHI_PAPERS_LOCAL_DATA_FILES],
    title: 'CHI 2025 Paper Explorer',
    description: 'Semantic similarity search across research papers'
  }
};

/**
 * Legacy: Map notebook name to its required data files
 * @deprecated Use NOTEBOOK_REGISTRY instead
 */
export const NOTEBOOK_DATA_MAP: Record<string, DataFile[]> = {
  'cross-widget': WEATHER_DATA_FILES,
  'tictactoe': TICTACTOE_DATA_FILES,
  'pdf-web': PDF_WEB_DATA_FILES,
  'edit': REVISE_DATA_FILES,
  'mnist': MNIST_DATA_FILES,
  'chi-papers': CHI_PAPERS_DATA_FILES,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get notebook data by key
 */
export function getNotebook(key: string): NotebookData | null {
  const entry = NOTEBOOK_REGISTRY[key];
  if (!entry) return null;

  return {
    cells: entry.cells,
    dataFiles: entry.dataFiles,
    remoteDataFiles: entry.remoteDataFiles,
  };
}

/**
 * Get all available notebook keys
 */
export function getNotebookKeys(): string[] {
  return Object.keys(NOTEBOOK_REGISTRY);
}

/**
 * Load notebook from JSON file dynamically
 * Useful for lazy loading notebooks not in the registry
 */
export async function loadNotebookFromJson(url: string): Promise<NotebookData | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load notebook: ${response.status}`);
    }
    const data = await response.json();

    if (isNotebookData(data)) {
      return data;
    }

    // Handle legacy format (just array of cells)
    if (Array.isArray(data)) {
      return { cells: data };
    }

    console.warn('Invalid notebook format from:', url);
    return null;
  } catch (error) {
    console.error('Error loading notebook:', error);
    return null;
  }
}
