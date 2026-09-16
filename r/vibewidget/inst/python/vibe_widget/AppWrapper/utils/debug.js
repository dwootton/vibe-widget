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
  const message = args.map((item) => {
    if (typeof item === "string") return item;
    try {
      return JSON.stringify(item);
    } catch (err) {
      return String(item);
    }
  }).join(" ");
  if (typeof globalThis !== "undefined" && typeof globalThis.__VIBE_DEBUG_SINK === "function") {
    globalThis.__VIBE_DEBUG_SINK({
      source: "debugLog",
      message
    });
    return;
  }
  console.debug(...args);
}
