// Scheduler shim - provides minimal scheduler API
// These are React internals that some packages import directly

export const unstable_ImmediatePriority = 1;
export const unstable_UserBlockingPriority = 2;
export const unstable_NormalPriority = 3;
export const unstable_IdlePriority = 5;
export const unstable_LowPriority = 4;

export function unstable_runWithPriority(priority, callback) {
  return callback();
}

export function unstable_scheduleCallback(priority, callback) {
  const id = setTimeout(callback, 0);
  return { id };
}

export function unstable_cancelCallback(task) {
  if (task && task.id) clearTimeout(task.id);
}

export function unstable_wrapCallback(callback) {
  return callback;
}

export function unstable_getCurrentPriorityLevel() {
  return unstable_NormalPriority;
}

export function unstable_shouldYield() {
  return false;
}

export function unstable_requestPaint() {}

export function unstable_now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function unstable_forceFrameRate() {}

export function unstable_pauseExecution() {}

export function unstable_continueExecution() {}

export function unstable_getFirstCallbackNode() {
  return null;
}

// For scheduler/tracing
export const __interactionsRef = { current: new Set() };
export const __subscriberRef = { current: null };
export function unstable_clear(callback) { return callback(); }
export function unstable_getCurrent() { return null; }
export function unstable_getThreadID() { return 0; }
export function unstable_subscribe() {}
export function unstable_unsubscribe() {}
export function unstable_trace(name, timestamp, callback) { return callback(); }
export function unstable_wrap(callback) { return callback; }

export default {
  unstable_ImmediatePriority,
  unstable_UserBlockingPriority,
  unstable_NormalPriority,
  unstable_IdlePriority,
  unstable_LowPriority,
  unstable_runWithPriority,
  unstable_scheduleCallback,
  unstable_cancelCallback,
  unstable_wrapCallback,
  unstable_getCurrentPriorityLevel,
  unstable_shouldYield,
  unstable_requestPaint,
  unstable_now,
  unstable_forceFrameRate,
  unstable_pauseExecution,
  unstable_continueExecution,
  unstable_getFirstCallbackNode
};
