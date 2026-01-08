export function isDebugEnabled(model) {
  if (typeof globalThis !== "undefined" && globalThis.__VIBE_DEBUG === true) {
    return true;
  }
  if (model && typeof model.get === "function") {
    return model.get("debug_mode") === true;
  }
  return false;
}

export function debugLog(model, ...args) {
  if (!isDebugEnabled(model)) return;
  console.debug(...args);
}
