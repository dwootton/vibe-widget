import React, { useMemo, useState, useEffect, useRef } from "react";
import { useWidgetModule } from "../utils/useWidgetModule";
import {
  loadDataFile,
  createWidgetModel,
  isDataCached,
  getCachedData,
} from "../utils/exampleDataLoader";
import type { DataFileConfig } from "../utils/exampleDataLoader";

export interface VibeWidgetProps {
  /** URL to .vw bundle or .js module in /public */
  moduleUrl: string;
  /** Optional shared model (e.g. for cross-widget reactivity) */
  model?: ReturnType<typeof createWidgetModel>;
  /** Data files to load into the model (first file's data used for preview) */
  dataFiles?: DataFileConfig[];
  /** Fixed height in pixels */
  height?: number;
  /** Show blur overlay while loading data */
  showLoadingBlur?: boolean;
}

/**
 * Single widget rendering component. Loads module via useWidgetModule,
 * optionally loads data into model, and renders loading/error states.
 */
export default function VibeWidget({
  moduleUrl,
  model: providedModel,
  dataFiles = [],
  height,
  showLoadingBlur = true,
}: VibeWidgetProps): JSX.Element {
  const { Widget, error, loading: moduleLoading } = useWidgetModule(moduleUrl);

  const widgetModel = useMemo(() => {
    if (providedModel) return providedModel;
    return createWidgetModel([]);
  }, [providedModel]);

  const primaryFile = dataFiles[0];
  const needsData = dataFiles.length > 0;

  const initialCached = useMemo(() => {
    if (!primaryFile || !isDataCached(primaryFile.url)) return undefined;
    return getCachedData(primaryFile.url);
  }, [primaryFile?.url]);

  const modelHasData = useMemo(() => {
    const d = widgetModel.get("data");
    return Array.isArray(d) && d.length > 0;
  }, [widgetModel]);

  const [dataLoading, setDataLoading] = useState(false);
  const [dataReady, setDataReady] = useState(!needsData || !!initialCached || modelHasData);
  const loadedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!needsData || !primaryFile) return;
    if (loadedUrlRef.current === primaryFile.url) return;
    if (modelHasData) {
      setDataReady(true);
      loadedUrlRef.current = primaryFile.url;
      return;
    }

    let cancelled = false;
    setDataLoading(true);

    loadDataFile(primaryFile.url, primaryFile.type ?? "csv")
      .then((data) => {
        if (cancelled || !data?.length) return;
        widgetModel.set("data", data);
        setDataReady(true);
        loadedUrlRef.current = primaryFile.url;
      })
      .catch((e) => {
        console.error("VibeWidget: failed to load data", e);
        if (!cancelled) setDataReady(true);
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [needsData, primaryFile?.url, primaryFile?.type, widgetModel, modelHasData]);

  useEffect(() => {
    if (!initialCached?.length || modelHasData) return;
    widgetModel.set("data", initialCached);
    setDataReady(true);
    if (primaryFile) loadedUrlRef.current = primaryFile.url;
  }, [initialCached, primaryFile?.url, widgetModel, modelHasData]);

  const showBlur = showLoadingBlur && needsData && dataLoading && !dataReady;
  const canRender = !needsData || dataReady;

  if (error) {
    return (
      <div
        className="flex items-center justify-center p-4 text-red-500 font-mono text-xs"
        style={height != null ? { height } : undefined}
      >
        {error}
      </div>
    );
  }

  if (moduleLoading || !Widget) {
    return (
      <div
        className="flex items-center justify-center p-4 text-slate/50 font-mono text-xs"
        style={height != null ? { height } : undefined}
      >
        {dataLoading ? "Loading data…" : "Loading widget…"}
      </div>
    );
  }

  const inner = canRender ? (
    <Widget model={widgetModel} React={React} />
  ) : (
    <div className="flex items-center justify-center h-full p-4 text-slate/50 font-mono text-xs">
      Loading data…
    </div>
  );

  const wrapperStyle = height != null ? { height } : undefined;

  return (
    <div className="w-full h-full overflow-hidden relative" style={wrapperStyle}>
      {showBlur && (
        <div className="absolute inset-0 z-10 backdrop-blur-sm bg-white/30 dark:bg-slate-900/30 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Loading data…</span>
          </div>
        </div>
      )}
      {inner}
    </div>
  );
}
