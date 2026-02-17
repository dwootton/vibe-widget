/**
 * Data loading for widget previews and notebooks.
 * Supports lazy loading with caching and cross-widget data sharing.
 */

export interface DataFileConfig {
  url: string;
  varName: string;
  type?: "csv" | "json";
}

const dataCache = new Map<string, any[]>();
const loadingPromises = new Map<string, Promise<any[]>>();

function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split("\n");
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, any> = {};
    headers.forEach((header, idx) => {
      const value = values[idx];
      const num = Number(value);
      row[header] =
        !isNaN(num) && value !== undefined && value.trim() !== "" ? num : value;
    });
    rows.push(row);
  }

  return rows;
}

export async function loadDataFile(
  url: string,
  type: "csv" | "json" = "csv"
): Promise<any[]> {
  if (dataCache.has(url)) return dataCache.get(url)!;
  if (loadingPromises.has(url)) return loadingPromises.get(url)!;

  const loadPromise = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);

      let data: any[];
      if (type === "json") {
        data = await response.json();
        if (!Array.isArray(data)) data = [data];
      } else {
        const text = await response.text();
        data = parseCSV(text);
      }

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

export function createWidgetModel(initialData: any[] = []) {
  const listeners = new Map<string, Set<(change: { name: string; new: any }) => void>>();
  const state: Record<string, any> = {
    data: initialData,
    selected_indices: [],
  };

  return {
    get: (k: string) => state[k],
    set: (k: string, v: any) => {
      state[k] = v;
      const subs = listeners.get(k);
      if (subs) {
        subs.forEach((fn) => {
          try {
            fn({ name: k, new: v });
          } catch {
            /* noop */
          }
        });
      }
    },
    save_changes: () => {
      for (const [key, subs] of listeners) {
        subs.forEach((fn) => {
          try {
            fn({ name: key, new: state[key] });
          } catch {
            /* noop */
          }
        });
      }
    },
    on: (eventName: string, handler: (change: { name: string; new: any }) => void) => {
      const key = eventName.startsWith("change:") ? eventName.slice(7) : eventName;
      const set = listeners.get(key) ?? new Set();
      set.add(handler);
      listeners.set(key, set);
    },
    off: (eventName: string, handler: (change: { name: string; new: any }) => void) => {
      const key = eventName.startsWith("change:") ? eventName.slice(7) : eventName;
      const set = listeners.get(key);
      if (set) set.delete(handler);
    },
    observe: (
      handler: (change: { name: string; new: any }) => void,
      names?: string | string[]
    ) => {
      const keys = Array.isArray(names) ? names : names ? [names] : Object.keys(state);
      keys.forEach((k) => {
        const set = listeners.get(k) ?? new Set();
        set.add(handler);
        listeners.set(k, set);
      });
    },
  };
}

const sharedModels = new Map<string, ReturnType<typeof createWidgetModel>>();

export function getSharedModel(
  dataUrl: string,
  initialData: any[] = []
): ReturnType<typeof createWidgetModel> {
  if (!sharedModels.has(dataUrl)) {
    sharedModels.set(dataUrl, createWidgetModel(initialData));
  }
  const model = sharedModels.get(dataUrl)!;
  if (initialData.length > 0) model.set("data", initialData);
  return model;
}

export function clearSharedModels(): void {
  sharedModels.clear();
}

export function isDataCached(url: string): boolean {
  return dataCache.has(url);
}

export function getCachedData(url: string): any[] | undefined {
  return dataCache.get(url);
}

export function isDataLoading(url: string): boolean {
  return loadingPromises.has(url);
}
