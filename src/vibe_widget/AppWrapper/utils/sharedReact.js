/**
 * Page-wide React ownership for guest (generated widget) trees.
 *
 * anywidget evaluates AppWrapper.bundle.js once per widget instance, so a
 * notebook page with several widgets holds several bundled React copies. The
 * import-map shim modules installed by SandboxedRunner are registered once per
 * page and bind their exports (`useRef`, `useState`, ...) to
 * `globalThis.ReactProvided` at their first evaluation. Guest code imports
 * hooks through that shim, so every guest tree on the page must be rendered by
 * that same React instance; a tree rendered by another copy throws React error
 * #321 as soon as a sub-component calls a hook.
 *
 * Hence: the first bundle to load registers itself and never gets replaced, and
 * guest trees are mounted with the registered instance instead of the
 * bundle-local one. Wrapper UI keeps using its own bundle-local React; it is a
 * separate root and never shares hooks with the guest.
 */
import { makeErrorBoundary } from "../components/RuntimeErrorBoundary.js";

/** Registers this bundle's React as the page-wide instance, first one wins. */
export function provideReact(React, ReactDOM, ReactDOMClient) {
  globalThis.ReactProvided ??= React;
  globalThis.ReactDOMProvided ??= ReactDOM;
  globalThis.ReactDOMClientProvided ??= ReactDOMClient;
  // Canonical keys too, so constrained hosts don't fall back to a CDN import.
  globalThis.React ??= globalThis.ReactProvided;
  globalThis.ReactDOM ??= globalThis.ReactDOMProvided;
  globalThis.ReactDOMClient ??= globalThis.ReactDOMClientProvided;
}

export function sharedReact() {
  return globalThis.ReactProvided;
}

export function sharedReactDOM() {
  return globalThis.ReactDOMProvided;
}

export function sharedCreateRoot() {
  const client = globalThis.ReactDOMClientProvided || globalThis.ReactDOMProvided;
  return client.createRoot;
}

/**
 * Mounts `Guest` into `container` as its own root owned by the shared React,
 * wrapped in an error boundary built from that same instance. Returns the root.
 */
export function mountGuest(container, { Guest, props, onError, fallback, resetKey }) {
  const React = sharedReact();
  const Boundary = makeErrorBoundary(React);
  const root = sharedCreateRoot()(container);
  root.render(
    React.createElement(
      Boundary,
      { resetKey, onError, fallback },
      React.createElement(Guest, { ...props, React })
    )
  );
  return root;
}
