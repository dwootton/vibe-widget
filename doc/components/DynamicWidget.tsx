import React, { useMemo } from 'react';
// @ts-ignore
import { html } from 'htm/react/index.js';

interface DynamicWidgetProps {
  moduleUrl?: string; // runtime-loaded ESM from public
  model?: any;
  initialData?: any[]; // Initial data to populate the widget
}

export default function DynamicWidget({ moduleUrl, model, initialData }: DynamicWidgetProps) {
  // Use provided model or a basic shared stub
  const sharedModel = useMemo(() => {
    if (model) return model;
    const listeners = new Map<string, Set<Function>>();
    const state: Record<string, any> = {
      // Initialize with data if provided
      data: initialData || [],
      selected_indices: [],
    };
    return {
      get: (k: string) => state[k],
      set: (k: string, v: any) => { state[k] = v; },
      save_changes: () => {
        for (const [key, subs] of listeners) {
          const change = { name: key, new: state[key] };
          subs.forEach((fn) => {
            try { fn(change); } catch { }
          });
        }
      },
      on: (eventName: string, handler: Function) => {
        // Expect format "change:trait"
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
  }, [model, initialData]);

  const [Loaded, setLoaded] = React.useState<any>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (moduleUrl) {
          const mod = await import(/* @vite-ignore */ moduleUrl);
          const fn = mod?.default ?? mod;
          console.log('Loaded widget module:', moduleUrl, mod);
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

  return (
    <div className="w-full h-full overflow-hidden">
      {Loaded ? (
        <Loaded model={sharedModel} html={html} React={React} />
      ) : (
        <div className="p-4 text-slate/50 font-mono text-xs">Loading widget…</div>
      )}
    </div>
  );
}