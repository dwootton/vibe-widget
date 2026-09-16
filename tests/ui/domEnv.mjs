// Installs a happy-dom window onto globalThis so browser modules can be imported
// under `node --test`. Call before importing anything that touches `document`.
import { Window } from "happy-dom";

export function installDom() {
  const window = new Window({ url: "https://localhost/" });
  const keys = [
    "window",
    "document",
    "navigator",
    "location",
    "HTMLElement",
    "Element",
    "Node",
    "MutationObserver",
    "CSSStyleSheet",
    "customElements",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "Blob",
    "Event",
    "ErrorEvent",
    "CustomEvent",
    "DocumentFragment",
    "Text",
  ];
  for (const key of keys) {
    if (window[key] === undefined) continue;
    const value = key === "getComputedStyle" ? window[key].bind(window) : window[key];
    // Some globals (navigator, location) are getter-only on globalThis in Node.
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  globalThis.self = globalThis;
  // React 19 forwards errors caught by boundaries here.
  globalThis.reportError = () => {};
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  return window;
}
