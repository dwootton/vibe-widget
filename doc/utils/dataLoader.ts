/**
 * Data Loader Utility
 * 
 * Simplified data loading with caching for widget previews.
 */

// Data cache for loaded files
const dataCache = new Map<string, any[]>();
const loadingPromises = new Map<string, Promise<any[]>>();

/**
 * Parse CSV string to array of objects
 */
export function parseCSV(csvText: string): any[] {
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
      const num = Number(value);
      row[header] = (!isNaN(num) && value !== undefined && value.trim() !== '') ? num : value;
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Load a data file (CSV or JSON) with caching
 */
export async function loadDataFile(url: string, type: 'csv' | 'json' = 'csv'): Promise<any[]> {
  if (dataCache.has(url)) {
    return dataCache.get(url)!;
  }

  if (loadingPromises.has(url)) {
    return loadingPromises.get(url)!;
  }

  const loadPromise = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status}`);
      }

      let data: any[];
      if (type === 'json') {
        const json = await response.json();
        data = Array.isArray(json) ? json : [json];
      } else {
        const text = await response.text();
        data = parseCSV(text);
      }

      dataCache.set(url, data);
      return data;
    } catch (error) {
      console.error(`Error loading data from ${url}:`, error);
      loadingPromises.delete(url);
      throw error;
    }
  })();

  loadingPromises.set(url, loadPromise);
  return loadPromise;
}

/**
 * Check if data is cached
 */
export function isDataCached(url: string): boolean {
  return dataCache.has(url);
}

/**
 * Get cached data (returns undefined if not cached)
 */
export function getCachedData(url: string): any[] | undefined {
  return dataCache.get(url);
}

/**
 * Clear the data cache
 */
export function clearDataCache(): void {
  dataCache.clear();
  loadingPromises.clear();
}
