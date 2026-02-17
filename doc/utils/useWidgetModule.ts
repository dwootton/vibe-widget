import { useState, useEffect, useRef } from "react";
import { resolvePublicUrl } from "./resolvePublicUrl";
import { transformWidgetModule, isLikelyHtml } from "./transformWidgetModule";

export interface UseWidgetModuleResult {
  Widget: ((props: { model: any; React: any }) => JSX.Element) | null;
  error: string | null;
  loading: boolean;
}

/**
 * Load a widget module from a URL (.vw bundle or .js file).
 * Handles fetch, .vw JSON parsing, transform, blob URL, and dynamic import.
 */
export function useWidgetModule(moduleUrl: string | undefined): UseWidgetModuleResult {
  const [Widget, setWidget] = useState<UseWidgetModuleResult["Widget"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!moduleUrl);
  const blobUrlRef = useRef<string | null>(null);
  /** True while load() is running (including during import()). Prevents cleanup from revoking the blob before import() resolves. */
  const loadingInProgressRef = useRef(false);

  useEffect(() => {
    if (!moduleUrl) {
      setLoading(false);
      setWidget(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const previousBlobUrl = blobUrlRef.current;
    blobUrlRef.current = null;
    // Do NOT revoke previous blob if a load is still in progress (React Strict Mode
    // remounts and re-runs the effect while the first load's import() is still in flight).
    if (previousBlobUrl && !loadingInProgressRef.current) {
      URL.revokeObjectURL(previousBlobUrl);
    }
    setLoading(true);
    setError(null);

    async function load(): Promise<void> {
      loadingInProgressRef.current = true;
      let createdBlobUrl: string | null = null;
      try {
        const resolved = resolvePublicUrl(moduleUrl!);
        const response = await fetch(resolved);
        if (!response.ok) {
          throw new Error(`Failed to fetch module: ${response.statusText}`);
        }

        const text = await response.text();
        // Blob URLs return the actual module content; only check HTTP responses for HTML
        const isBlob = moduleUrl.startsWith("blob:");
        const trimmed = text.trim().toLowerCase();
        if (!isBlob && (trimmed.startsWith("<!") || trimmed.startsWith("<html"))) {
          throw new Error(
            `Module URL returned HTML instead of JavaScript (status ${response.status}). ` +
              "The path may be wrong or the server may be returning the app's index page. " +
              "Ensure the widget file exists (e.g. under /widgets/) and the URL is correct."
          );
        }
        let code: string;

        if (moduleUrl.endsWith(".vw")) {
          const bundle = JSON.parse(text);
          code = bundle.code ?? "";
          if (!code) throw new Error(".vw bundle has no code");
        } else {
          code = text;
        }

        if (isLikelyHtml(code)) {
          throw new Error(
            "Module returned HTML instead of JavaScript (e.g. 404 or SPA index). " +
              "Use vw.config(api_key=...) for live widget generation, or ensure the widget URL is correct."
          );
        }

        const compiled = await transformWidgetModule(code);
        const blob = new Blob([compiled], { type: "application/javascript" });
        createdBlobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = createdBlobUrl;

        const mod = await import(/* @vite-ignore */ createdBlobUrl);
        const fn = mod?.default ?? mod;

        if (typeof fn !== "function") {
          throw new Error("Widget module has no default export");
        }

        if (!cancelled) {
          setWidget(() => fn);
          setError(null);
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to load widget";
        if (!cancelled) {
          setError(message);
          setWidget(null);
        }
        console.error("useWidgetModule:", e);
      } finally {
        loadingInProgressRef.current = false;
        if (!cancelled) {
          setLoading(false);
        }
        if (cancelled && createdBlobUrl) {
          URL.revokeObjectURL(createdBlobUrl);
          if (blobUrlRef.current === createdBlobUrl) blobUrlRef.current = null;
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      if (!loadingInProgressRef.current && blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [moduleUrl]);

  return { Widget, error, loading };
}
