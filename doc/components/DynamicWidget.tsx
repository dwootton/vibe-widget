import React, { useMemo, useState, useEffect, useRef } from 'react';
// @ts-ignore
import { html } from 'htm/react/index.js';
import { loadDataFile, createWidgetModel, EXAMPLE_DATA_CONFIG, isDataCached, getCachedData } from '../utils/exampleDataLoader';

interface DynamicWidgetProps {
  moduleUrl?: string; // runtime-loaded ESM from public
  model?: any;
  /** Example ID to auto-load data from testdata */
  exampleId?: string;
  /** Direct data URL override (e.g., /testdata/seattle-weather.csv) */
  dataUrl?: string;
  /** Data type for dataUrl (csv or json) */
  dataType?: 'csv' | 'json';
  /** Show blur overlay while loading data */
  showLoadingBlur?: boolean;
}

export default function DynamicWidget({
  moduleUrl,
  model,
  exampleId,
  dataUrl,
  dataType = 'csv',
  showLoadingBlur = true
}: DynamicWidgetProps) {
  // Determine URL for data loading
  const resolvedDataUrl = useMemo(() => {
    if (dataUrl) return dataUrl;
    if (exampleId) {
      const config = EXAMPLE_DATA_CONFIG[exampleId];
      return config?.previewDataFiles?.[0]?.url;
    }
    return undefined;
  }, [exampleId, dataUrl]);

  const resolvedDataType = useMemo(() => {
    if (dataUrl) return dataType;
    if (exampleId) {
      const config = EXAMPLE_DATA_CONFIG[exampleId];
      return config?.previewDataFiles?.[0]?.type || 'csv';
    }
    return 'csv';
  }, [exampleId, dataUrl, dataType]);

  // Determine if this widget needs data for preview
  const needsData = useMemo(() => {
    if (exampleId) {
      const config = EXAMPLE_DATA_CONFIG[exampleId];
      return config?.requiresDataForPreview ?? false;
    }
    return !!dataUrl;
  }, [exampleId, dataUrl]);

  // Use provided model or create new one (stable reference)
  const widgetModel = useMemo(() => {
    if (model) return model;
    return createWidgetModel([]);
  }, [model]);

  // Check for initial data availability (cached or already in model)
  const initialCachedData = useMemo(() => {
    if (resolvedDataUrl && isDataCached(resolvedDataUrl)) {
      return getCachedData(resolvedDataUrl);
    }
    return undefined;
  }, [resolvedDataUrl]);

  const modelInitialData = useMemo(() => {
    if (model) {
      const modelData = model.get('data');
      if (modelData && Array.isArray(modelData) && modelData.length > 0) {
        return modelData;
      }
    }
    return undefined;
  }, [model]);

  const hasInitialData = !!(initialCachedData || modelInitialData);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Sync dataLoaded state with actual data availability
  useEffect(() => {
    if (hasInitialData && !dataLoaded) {
      setDataLoaded(true);
    }
  }, [hasInitialData, dataLoaded]);

  // Populate model with cached data if available (run once on mount)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const dataToUse = initialCachedData || modelInitialData;
    if (dataToUse && dataToUse.length > 0) {
      const currentData = widgetModel.get('data');
      if (!currentData || currentData.length === 0) {
        widgetModel.set('data', dataToUse);
        setDataLoaded(true);
      }
    }
  }, []);

  // Track if we've already loaded data for this URL
  const loadedUrlRef = useRef<string | null>(null);

  // Load data lazily when component mounts
  useEffect(() => {
    // Skip if: no data needed, no URL
    if (!needsData || !resolvedDataUrl) return;

    // Skip if already loaded this URL
    if (loadedUrlRef.current === resolvedDataUrl) return;

    // Check if model already has data
    const currentData = widgetModel.get('data');
    if (currentData && Array.isArray(currentData) && currentData.length > 0) {
      setDataLoaded(true);
      setIsDataLoading(false);
      loadedUrlRef.current = resolvedDataUrl;
      return;
    }

    let cancelled = false;

    async function loadData() {
      setIsDataLoading(true);
      try {
        const data = await loadDataFile(resolvedDataUrl!, resolvedDataType);
        if (!cancelled && data && data.length > 0) {
          widgetModel.set('data', data);
          setDataLoaded(true);
          loadedUrlRef.current = resolvedDataUrl;
        }
      } catch (e) {
        console.error('Failed to load widget data:', e);
      } finally {
        if (!cancelled) {
          setIsDataLoading(false);
        }
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [resolvedDataUrl, resolvedDataType, needsData, widgetModel]);

  const [Loaded, setLoaded] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (moduleUrl) {
          const mod = await import(/* @vite-ignore */ moduleUrl);
          const fn = mod?.default ?? mod;
          if (typeof fn !== 'function') throw new Error('Invalid widget module from URL');
          if (!cancelled) setLoaded(() => fn);
        }
      } catch (e) {
        console.error('Widget Module Load Error:', e);
        if (!cancelled) setLoaded(() => () => <div className="p-4 text-red-500 font-mono text-xs">Error loading widget module. Check console.</div>);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [moduleUrl]);

  // Show blur while loading data (only for widgets that need data)
  const showBlur = showLoadingBlur && needsData && isDataLoading && !dataLoaded;

  // Don't render widget until data is ready (prevents NaN errors in charts)
  const canRenderWidget = !needsData || dataLoaded;

  return (
    <div className="w-full h-full overflow-hidden relative">
      {/* Blur overlay while loading data */}
      {showBlur && (
        <div className="absolute inset-0 z-10 backdrop-blur-sm bg-white/30 dark:bg-slate-900/30 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Loading data…</span>
          </div>
        </div>
      )}

      {Loaded && canRenderWidget ? (
        <Loaded model={widgetModel} html={html} React={React} />
      ) : (
        <div className="p-4 text-slate/50 font-mono text-xs flex items-center justify-center h-full">
          {isDataLoading ? 'Loading data…' : 'Loading widget…'}
        </div>
      )}
    </div>
  );
}