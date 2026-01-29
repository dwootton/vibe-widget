import React, { useState, useEffect, useRef, useMemo } from 'react';
import { loadDataFile, createWidgetModel, isDataCached, getCachedData } from '../utils/exampleDataLoader';
import { resolvePublicUrl } from '../utils/resolvePublicUrl';
import { transformWidgetModule } from '../utils/transformWidgetModule';

interface WidgetPreviewProps {
  /** Path to a .vw bundle or .js module in /public (e.g. "/widgets/my_chart.vw") */
  src: string;
  /** Optional data file URL (e.g. "/testdata/seattle-weather.csv") */
  dataUrl?: string;
  /** Data type for dataUrl */
  dataType?: 'csv' | 'json';
  /** Preview height in pixels */
  height?: number;
}

/**
 * Renders a widget preview above code blocks in docs.
 * Supports both .vw bundles (JSON with `code` field) and raw .js modules.
 */
export default function WidgetPreview({
  src,
  dataUrl,
  dataType = 'csv',
  height = 400,
}: WidgetPreviewProps) {
  const [Widget, setWidget] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(!dataUrl);
  const blobUrlRef = useRef<string | null>(null);

  const widgetModel = useMemo(() => createWidgetModel([]), []);

  // Load data if needed
  useEffect(() => {
    if (!dataUrl) return;

    const resolved = resolvePublicUrl(dataUrl);
    if (isDataCached(resolved)) {
      widgetModel.set('data', getCachedData(resolved));
      setDataLoaded(true);
      return;
    }

    let cancelled = false;
    loadDataFile(resolved, dataType)
      .then((data) => {
        if (!cancelled && data?.length) {
          widgetModel.set('data', data);
          setDataLoaded(true);
        }
      })
      .catch((e) => {
        console.error('WidgetPreview: failed to load data', e);
        if (!cancelled) setDataLoaded(true); // render anyway
      });
    return () => { cancelled = true; };
  }, [dataUrl, dataType, widgetModel]);

  // Load widget code
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const resolved = resolvePublicUrl(src);
        const response = await fetch(resolved);
        if (!response.ok) throw new Error(`Failed to fetch ${src}: ${response.statusText}`);

        let code: string;
        const text = await response.text();

        // .vw files are JSON bundles with a `code` field
        if (src.endsWith('.vw')) {
          const bundle = JSON.parse(text);
          code = bundle.code || '';
          if (!code) throw new Error('.vw bundle has no code');
        } else {
          code = text;
        }

        const compiled = await transformWidgetModule(code);
        const blob = new Blob([compiled], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;

        const mod = await import(/* @vite-ignore */ blobUrl);
        const fn = mod?.default ?? mod;
        if (typeof fn !== 'function') throw new Error('Widget module has no default export');
        if (!cancelled) setWidget(() => fn);
      } catch (e: any) {
        console.error('WidgetPreview:', e);
        if (!cancelled) setError(e.message || 'Failed to load widget');
      }
    }

    load();
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [src]);

  return (
    <div
      className="bg-white border-2 border-slate rounded-lg overflow-hidden my-4 shadow-hard-sm"
      style={{ height }}
    >
      {error ? (
        <div className="flex items-center justify-center h-full p-4 text-red-500 font-mono text-xs">
          {error}
        </div>
      ) : Widget && dataLoaded ? (
        <Widget model={widgetModel} React={React} />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate/40 font-mono">Loading widget…</span>
          </div>
        </div>
      )}
    </div>
  );
}
