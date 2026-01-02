import type { NotebookCell } from '../components/PyodideNotebook';

// Import notebook definitions from JSON files
import reviseNotebookData from './notebooks/revise_notebook.json';
import crossWidgetNotebookData from './notebooks/cross_widget_notebook.json';
import tictactoeNotebookData from './notebooks/tictactoe_notebook.json';
import pdfWebNotebookData from './notebooks/pdf_web_notebook.json';
import mnistNotebookData from './notebooks/mnist_notebook.json';
import chiPapersNotebookData from './notebooks/chi_papers_notebook.json';

// ============================================================================
// Types
// ============================================================================

/**
 * Widget configuration for matching prompts to pre-generated widgets
 */
export interface WidgetConfig {
  url: string;
  match: string[];
}

/**
 * Data file to be loaded into Python namespace
 */
export interface DataFile {
  url: string;
  varName: string;
  type?: string;
}

/**
 * Complete notebook data structure (new schema)
 */
export interface NotebookData {
  id: string;
  title: string;
  description: string;
  widgets: Record<string, WidgetConfig>;
  dataFiles: DataFile[];
  cells: NotebookCell[];
}

/**
 * Type guard to validate notebook data structure
 */
function isNotebookData(data: unknown): data is NotebookData {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    Array.isArray(obj.cells) &&
    typeof obj.widgets === 'object'
  );
}

// ============================================================================
// Notebook Registry (auto-generated from JSON imports)
// ============================================================================

// Type assertion for JSON imports
const notebooks = [
  reviseNotebookData,
  crossWidgetNotebookData,
  tictactoeNotebookData,
  pdfWebNotebookData,
  mnistNotebookData,
  chiPapersNotebookData,
] as unknown as NotebookData[];

/**
 * Registry of all available notebooks, keyed by ID
 */
export const NOTEBOOK_REGISTRY: Record<string, NotebookData> = {};

// Populate registry from JSON imports
for (const notebook of notebooks) {
  if (isNotebookData(notebook)) {
    NOTEBOOK_REGISTRY[notebook.id] = notebook;
  } else {
    console.warn('Invalid notebook data format:', notebook);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get notebook data by key
 */
export function getNotebook(key: string): NotebookData | null {
  return NOTEBOOK_REGISTRY[key] ?? null;
}

/**
 * Get all available notebook keys
 */
export function getNotebookKeys(): string[] {
  return Object.keys(NOTEBOOK_REGISTRY);
}

/**
 * Get all widget configs from a notebook, merged into a single record
 */
export function getNotebookWidgets(key: string): Record<string, WidgetConfig> {
  return NOTEBOOK_REGISTRY[key]?.widgets ?? {};
}

/**
 * Get all widget configs from all notebooks
 */
export function getAllWidgetConfigs(): Record<string, WidgetConfig> {
  const allWidgets: Record<string, WidgetConfig> = {};
  for (const notebook of Object.values(NOTEBOOK_REGISTRY)) {
    Object.assign(allWidgets, notebook.widgets);
  }
  return allWidgets;
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

    console.warn('Invalid notebook format from:', url);
    return null;
  } catch (error) {
    console.error('Error loading notebook:', error);
    return null;
  }
}
