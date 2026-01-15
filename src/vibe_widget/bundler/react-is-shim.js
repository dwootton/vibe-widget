const React = globalThis.__VIBE_REACT;

// Type symbols - use React's if available, or create placeholders
const REACT_ELEMENT_TYPE = Symbol.for('react.element');
const REACT_PORTAL_TYPE = Symbol.for('react.portal');
const REACT_FRAGMENT_TYPE = Symbol.for('react.fragment');
const REACT_STRICT_MODE_TYPE = Symbol.for('react.strict_mode');
const REACT_PROFILER_TYPE = Symbol.for('react.profiler');
const REACT_PROVIDER_TYPE = Symbol.for('react.provider');
const REACT_CONTEXT_TYPE = Symbol.for('react.context');
const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');
const REACT_SUSPENSE_TYPE = Symbol.for('react.suspense');
const REACT_SUSPENSE_LIST_TYPE = Symbol.for('react.suspense_list');
const REACT_MEMO_TYPE = Symbol.for('react.memo');
const REACT_LAZY_TYPE = Symbol.for('react.lazy');

function typeOf(object) {
  if (typeof object === 'object' && object !== null) {
    const $$typeof = object.$$typeof;
    if ($$typeof === REACT_ELEMENT_TYPE) {
      const type = object.type;
      if (typeof type === 'function') return null;
      if (typeof type === 'string') return REACT_ELEMENT_TYPE;
      switch (type) {
        case REACT_FRAGMENT_TYPE: return REACT_FRAGMENT_TYPE;
        case REACT_PROFILER_TYPE: return REACT_PROFILER_TYPE;
        case REACT_STRICT_MODE_TYPE: return REACT_STRICT_MODE_TYPE;
        case REACT_SUSPENSE_TYPE: return REACT_SUSPENSE_TYPE;
        case REACT_SUSPENSE_LIST_TYPE: return REACT_SUSPENSE_LIST_TYPE;
      }
      if (typeof type === 'object') {
        switch (type.$$typeof) {
          case REACT_CONTEXT_TYPE: return REACT_CONTEXT_TYPE;
          case REACT_PROVIDER_TYPE: return REACT_PROVIDER_TYPE;
          case REACT_FORWARD_REF_TYPE: return REACT_FORWARD_REF_TYPE;
          case REACT_MEMO_TYPE: return REACT_MEMO_TYPE;
          case REACT_LAZY_TYPE: return REACT_LAZY_TYPE;
        }
      }
    } else if ($$typeof === REACT_PORTAL_TYPE) {
      return REACT_PORTAL_TYPE;
    }
  }
  return undefined;
}

export { typeOf };

export const ContextConsumer = REACT_CONTEXT_TYPE;
export const ContextProvider = REACT_PROVIDER_TYPE;
export const Element = REACT_ELEMENT_TYPE;
export const ForwardRef = REACT_FORWARD_REF_TYPE;
export const Fragment = REACT_FRAGMENT_TYPE;
export const Lazy = REACT_LAZY_TYPE;
export const Memo = REACT_MEMO_TYPE;
export const Portal = REACT_PORTAL_TYPE;
export const Profiler = REACT_PROFILER_TYPE;
export const StrictMode = REACT_STRICT_MODE_TYPE;
export const Suspense = REACT_SUSPENSE_TYPE;
export const SuspenseList = REACT_SUSPENSE_LIST_TYPE;

export function isValidElementType(type) {
  return typeof type === 'string' ||
    typeof type === 'function' ||
    type === REACT_FRAGMENT_TYPE ||
    type === REACT_PROFILER_TYPE ||
    type === REACT_STRICT_MODE_TYPE ||
    type === REACT_SUSPENSE_TYPE ||
    type === REACT_SUSPENSE_LIST_TYPE ||
    (typeof type === 'object' && type !== null && (
      type.$$typeof === REACT_LAZY_TYPE ||
      type.$$typeof === REACT_MEMO_TYPE ||
      type.$$typeof === REACT_PROVIDER_TYPE ||
      type.$$typeof === REACT_CONTEXT_TYPE ||
      type.$$typeof === REACT_FORWARD_REF_TYPE
    ));
}

export function isAsyncMode() { return false; }
export function isConcurrentMode() { return false; }
export function isContextConsumer(object) { return typeOf(object) === REACT_CONTEXT_TYPE; }
export function isContextProvider(object) { return typeOf(object) === REACT_PROVIDER_TYPE; }
export function isElement(object) { return typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE; }
export function isForwardRef(object) { return typeOf(object) === REACT_FORWARD_REF_TYPE; }
export function isFragment(object) { return typeOf(object) === REACT_FRAGMENT_TYPE; }
export function isLazy(object) { return typeOf(object) === REACT_LAZY_TYPE; }
export function isMemo(object) { return typeOf(object) === REACT_MEMO_TYPE; }
export function isPortal(object) { return typeOf(object) === REACT_PORTAL_TYPE; }
export function isProfiler(object) { return typeOf(object) === REACT_PROFILER_TYPE; }
export function isStrictMode(object) { return typeOf(object) === REACT_STRICT_MODE_TYPE; }
export function isSuspense(object) { return typeOf(object) === REACT_SUSPENSE_TYPE; }
export function isSuspenseList(object) { return typeOf(object) === REACT_SUSPENSE_LIST_TYPE; }

export default {
  typeOf,
  ContextConsumer,
  ContextProvider,
  Element,
  ForwardRef,
  Fragment,
  Lazy,
  Memo,
  Portal,
  Profiler,
  StrictMode,
  Suspense,
  SuspenseList,
  isValidElementType,
  isAsyncMode,
  isConcurrentMode,
  isContextConsumer,
  isContextProvider,
  isElement,
  isForwardRef,
  isFragment,
  isLazy,
  isMemo,
  isPortal,
  isProfiler,
  isStrictMode,
  isSuspense,
  isSuspenseList
};
