/**
 * Example Data Loader Utility
 * 
 * Centralized data loading for widget previews and notebooks.
 * Supports lazy loading with caching and cross-widget data sharing.
 */

// Data file configurations for each example
export interface DataFileConfig {
    url: string;
    varName: string;
    type?: 'csv' | 'json';
}

// Example metadata with data requirements
export interface ExampleDataConfig {
    id: string;
    /** Data files required for widget preview (loaded lazily) */
    previewDataFiles?: DataFileConfig[];
    /** Data files required for notebook execution */
    notebookDataFiles?: DataFileConfig[];
    /** Whether this example requires data to render the preview */
    requiresDataForPreview: boolean;
}

// Centralized data configuration for all examples
export const EXAMPLE_DATA_CONFIG: Record<string, ExampleDataConfig> = {
    'tic-tac-toe': {
        id: 'tic-tac-toe',
        previewDataFiles: [], // No data needed for preview
        notebookDataFiles: [
            { url: '/testdata/X_moves.csv', varName: 'x_moves_df', type: 'csv' },
            { url: '/testdata/O_moves.csv', varName: 'o_moves_df', type: 'csv' },
        ],
        requiresDataForPreview: false,
    },
    'weather-scatter': {
        id: 'weather-scatter',
        previewDataFiles: [
            { url: '/testdata/seattle-weather.csv', varName: 'data', type: 'csv' },
        ],
        notebookDataFiles: [
            { url: '/testdata/seattle-weather.csv', varName: 'data', type: 'csv' },
        ],
        requiresDataForPreview: true,
    },
    'weather-bars': {
        id: 'weather-bars',
        previewDataFiles: [
            { url: '/testdata/seattle-weather.csv', varName: 'data', type: 'csv' },
        ],
        notebookDataFiles: [
            { url: '/testdata/seattle-weather.csv', varName: 'data', type: 'csv' },
        ],
        requiresDataForPreview: true,
    },
    'solar-system': {
        id: 'solar-system',
        previewDataFiles: [
            { url: '/testdata/planets.csv', varName: 'planets_df', type: 'csv' },
        ],
        notebookDataFiles: [
            { url: '/testdata/planets.csv', varName: 'planets_df', type: 'csv' },
        ],
        requiresDataForPreview: true,
    },
    'hn-clone': {
        id: 'hn-clone',
        previewDataFiles: [
            { url: '/testdata/hn_stories.json', varName: 'hn_df', type: 'json' },
        ],
        notebookDataFiles: [
            { url: '/testdata/hn_stories.json', varName: 'hn_df', type: 'json' },
        ],
        requiresDataForPreview: true,
    },
    'covid-trends': {
        id: 'covid-trends',
        previewDataFiles: [
            { url: '/testdata/day_wise.csv', varName: 'covid_df', type: 'csv' },
        ],
        notebookDataFiles: [
            { url: '/testdata/day_wise.csv', varName: 'covid_df', type: 'csv' },
        ],
        requiresDataForPreview: true,
    },
    'covid-trends-2': {
        id: 'covid-trends-2',
        previewDataFiles: [
            { url: '/testdata/day_wise.csv', varName: 'covid_df', type: 'csv' },
        ],
        notebookDataFiles: [
            { url: '/testdata/day_wise.csv', varName: 'covid_df', type: 'csv' },
        ],
        requiresDataForPreview: true,
    },
};

// Data cache for loaded files
const dataCache = new Map<string, any[]>();
const loadingPromises = new Map<string, Promise<any[]>>();

/**
 * Parse CSV string to array of objects
 */
function parseCSV(csvText: string): any[] {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, any> = {};
        headers.forEach((header, idx) => {
            const value = values[idx];
            // Try to parse numbers
            const num = Number(value);
            row[header] = (!isNaN(num) && value !== undefined && value.trim() !== '') ? num : value;
        });
        rows.push(row);
    }

    return rows;
}

/**
 * Load a single data file (with caching)
 */
export async function loadDataFile(url: string, type: 'csv' | 'json' = 'csv'): Promise<any[]> {
    // Return cached data if available
    if (dataCache.has(url)) {
        return dataCache.get(url)!;
    }

    // Return existing promise if already loading
    if (loadingPromises.has(url)) {
        return loadingPromises.get(url)!;
    }

    // Start loading
    const loadPromise = (async () => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load ${url}: ${response.status}`);
            }

            let data: any[];
            if (type === 'json') {
                data = await response.json();
                // If it's not an array, wrap it
                if (!Array.isArray(data)) {
                    data = [data];
                }
            } else {
                const text = await response.text();
                data = parseCSV(text);
            }

            // Cache the result
            dataCache.set(url, data);
            loadingPromises.delete(url);

            return data;
        } catch (error) {
            loadingPromises.delete(url);
            throw error;
        }
    })();

    loadingPromises.set(url, loadPromise);
    return loadPromise;
}

/**
 * Load all preview data files for an example
 */
export async function loadPreviewData(exampleId: string): Promise<any[] | null> {
    const config = EXAMPLE_DATA_CONFIG[exampleId];
    if (!config || !config.previewDataFiles || config.previewDataFiles.length === 0) {
        return null;
    }

    // Load all data files (for now, return first one as primary data)
    const dataFiles = config.previewDataFiles;
    const loadedData = await Promise.all(
        dataFiles.map(file => loadDataFile(file.url, file.type || 'csv'))
    );

    // Return the first dataset as primary data
    return loadedData[0] || null;
}

/**
 * Check if example requires data for preview
 */
export function requiresDataForPreview(exampleId: string): boolean {
    const config = EXAMPLE_DATA_CONFIG[exampleId];
    return config?.requiresDataForPreview ?? false;
}

/**
 * Get notebook data files for an example
 */
export function getNotebookDataFiles(exampleId: string): DataFileConfig[] {
    const config = EXAMPLE_DATA_CONFIG[exampleId];
    return config?.notebookDataFiles ?? [];
}

/**
 * Create a widget model with data loading support
 */
export function createWidgetModel(initialData: any[] = []) {
    const listeners = new Map<string, Set<Function>>();
    const state: Record<string, any> = {
        data: initialData,
        selected_indices: [],
    };

    return {
        get: (k: string) => state[k],
        set: (k: string, v: any) => {
            state[k] = v;
            // Notify listeners
            const subs = listeners.get(k);
            if (subs) {
                const change = { name: k, new: v };
                subs.forEach(fn => {
                    try { fn(change); } catch { }
                });
            }
        },
        save_changes: () => {
            for (const [key, subs] of listeners) {
                const change = { name: key, new: state[key] };
                subs.forEach((fn) => {
                    try { fn(change); } catch { }
                });
            }
        },
        on: (eventName: string, handler: Function) => {
            const key = eventName.startsWith('change:') ? eventName.slice(7) : eventName;
            const set = listeners.get(key) || new Set();
            set.add(handler);
            listeners.set(key, set);
        },
        off: (eventName: string, handler: Function) => {
            const key = eventName.startsWith('change:') ? eventName.slice(7) : eventName;
            const set = listeners.get(key);
            if (set) set.delete(handler);
        },
        observe: (handler: Function, names?: string | string[]) => {
            const keys = Array.isArray(names) ? names : names ? [names] : Object.keys(state);
            keys.forEach((k) => {
                const set = listeners.get(k) || new Set();
                set.add(handler);
                listeners.set(k, set);
            });
        },
    };
}

/**
 * Shared model registry for cross-widget communication
 * Widgets sharing the same data source can share a model instance
 */
const sharedModels = new Map<string, ReturnType<typeof createWidgetModel>>();

/**
 * Get or create a shared model for widgets that share data
 */
export function getSharedModel(dataUrl: string, initialData: any[] = []): ReturnType<typeof createWidgetModel> {
    if (!sharedModels.has(dataUrl)) {
        sharedModels.set(dataUrl, createWidgetModel(initialData));
    }
    const model = sharedModels.get(dataUrl)!;
    // Update data if provided
    if (initialData.length > 0) {
        model.set('data', initialData);
    }
    return model;
}

/**
 * Clear shared model cache (useful for testing or resetting state)
 */
export function clearSharedModels(): void {
    sharedModels.clear();
}

/**
 * Check if data for a URL is already cached
 */
export function isDataCached(url: string): boolean {
    return dataCache.has(url);
}

/**
 * Get cached data synchronously (returns undefined if not cached)
 */
export function getCachedData(url: string): any[] | undefined {
    return dataCache.get(url);
}

/**
 * Check if data is currently being loaded
 */
export function isDataLoading(url: string): boolean {
    return loadingPromises.has(url);
}
