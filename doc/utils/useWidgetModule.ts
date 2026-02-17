import { useState, useEffect, useRef } from "react";
import { resolvePublicUrl } from "./resolvePublicUrl";
import { transformWidgetModule } from "./transformWidgetModule";

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

  useEffect(() => {
    if (!moduleUrl) {
      setLoading(false);
      setWidget(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load(): Promise<void> {
      try {
        const resolved = resolvePublicUrl(moduleUrl!);
        const response = await fetch(resolved);
        if (!response.ok) {
          throw new Error(`Failed to fetch module: ${response.statusText}`);
        }

        const text = await response.text();
        let code: string;

        if (moduleUrl.endsWith(".vw")) {
          const bundle = JSON.parse(text);
          code = bundle.code ?? "";
          if (!code) throw new Error(".vw bundle has no code");
        } else {
          code = text;
        }

        const compiled = await transformWidgetModule(code);
        const blob = new Blob([compiled], { type: "application/javascript" });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;

        const mod = await import(/* @vite-ignore */ blobUrl);
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
        if (!cancelled) {
          setLoading(false);
        }
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
  }, [moduleUrl]);

  return { Widget, error, loading };
}
