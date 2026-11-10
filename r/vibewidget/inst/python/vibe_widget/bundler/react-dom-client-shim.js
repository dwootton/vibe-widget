const ReactDOMClient = globalThis.__VIBE_REACT_DOM_CLIENT || globalThis.__VIBE_REACT_DOM || {};

export const createRoot = ReactDOMClient.createRoot;
export const hydrateRoot = ReactDOMClient.hydrateRoot;

export default ReactDOMClient;
