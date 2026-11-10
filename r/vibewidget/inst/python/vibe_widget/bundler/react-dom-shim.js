const ReactDOM = globalThis.__VIBE_REACT_DOM || {};
const ReactDOMClient = globalThis.__VIBE_REACT_DOM_CLIENT || ReactDOM;

// Modern APIs
export const createPortal = ReactDOM.createPortal;
export const flushSync = ReactDOM.flushSync;
export const createRoot = ReactDOMClient.createRoot;
export const hydrateRoot = ReactDOMClient.hydrateRoot;

// Legacy APIs (some packages still use these, they may be undefined in React 19)
export const render = ReactDOM.render;
export const hydrate = ReactDOM.hydrate;
export const unmountComponentAtNode = ReactDOM.unmountComponentAtNode;
export const findDOMNode = ReactDOM.findDOMNode;

// Version
export const version = ReactDOM.version;

export default ReactDOM;
