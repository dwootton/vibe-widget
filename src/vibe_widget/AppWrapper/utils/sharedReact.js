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
import React from "react";

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

const GUEST_HOST_STYLE = { width: "100%", height: "100%" };

const GUEST_FALLBACK_STYLE = {
  padding: "20px",
  color: "var(--jp-ui-font-color1, #f8fafc)",
  fontSize: "14px",
};

/**
 * Hosts the guest tree in its own root owned by the page-wide React instance.
 * The wrapper tree around it belongs to this bundle's React copy, which on a
 * page with several widgets is a different copy from the one the guest's
 * imported hooks come from. Lives here rather than in SandboxedRunner so it can
 * be tested without a JSX transform.
 */
export function GuestHost({ Guest, facade, resetKey, onError }) {
  const hostRef = React.useRef(null);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Fresh node per mount: the deferred unmount can outlive this effect.
    const mountPoint = document.createElement("div");
    mountPoint.style.width = "100%";
    mountPoint.style.height = "100%";
    host.appendChild(mountPoint);
    const shared = sharedReact();
    const root = mountGuest(mountPoint, {
      Guest,
      props: { model: facade },
      onError,
      resetKey,
      fallback: shared.createElement(
        "div",
        { style: GUEST_FALLBACK_STYLE },
        "Runtime error detected. Check the panel above."
      ),
    });
    return () => {
      // React refuses a synchronous unmount from inside a commit; defer one tick.
      queueMicrotask(() => {
        try {
          root.unmount();
        } finally {
          mountPoint.remove();
        }
      });
    };
  }, [Guest, facade, resetKey, onError]);

  return React.createElement("div", { ref: hostRef, style: GUEST_HOST_STYLE });
}
