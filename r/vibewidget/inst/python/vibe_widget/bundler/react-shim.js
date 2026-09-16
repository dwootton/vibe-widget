const React = globalThis.__VIBE_REACT;
if (!React) {
  throw new Error("React runtime not available. Ensure the host provides __VIBE_REACT.");
}

export default React;

// Core classes
export const Component = React.Component;
export const PureComponent = React.PureComponent;

// Core utilities
export const Children = React.Children;
export const Fragment = React.Fragment;
export const Profiler = React.Profiler;
export const StrictMode = React.StrictMode;
export const Suspense = React.Suspense;

// Element creation
export const cloneElement = React.cloneElement;
export const createContext = React.createContext;
export const createElement = React.createElement;
export const createFactory = React.createFactory;
export const createRef = React.createRef;

// Higher-order components
export const forwardRef = React.forwardRef;
export const lazy = React.lazy;
export const memo = React.memo;

// Element validation
export const isValidElement = React.isValidElement;

// Hooks
export const useCallback = React.useCallback;
export const useContext = React.useContext;
export const useDebugValue = React.useDebugValue;
export const useDeferredValue = React.useDeferredValue;
export const useEffect = React.useEffect;
export const useId = React.useId;
export const useImperativeHandle = React.useImperativeHandle;
export const useInsertionEffect = React.useInsertionEffect;
export const useLayoutEffect = React.useLayoutEffect;
export const useMemo = React.useMemo;
export const useReducer = React.useReducer;
export const useRef = React.useRef;
export const useState = React.useState;
export const useSyncExternalStore = React.useSyncExternalStore;
export const useTransition = React.useTransition;

// Concurrent features
export const startTransition = React.startTransition;
export const use = React.use;

// Version
export const version = React.version;

// JSX runtime (for react/jsx-runtime compatibility)
export const jsx = React.jsx || React.createElement;
export const jsxs = React.jsxs || React.createElement;
export const jsxDEV = React.jsxDEV || React.createElement;

// Legacy APIs (some packages still use these)
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
