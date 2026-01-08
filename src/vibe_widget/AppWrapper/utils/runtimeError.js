const DEBUG_RUNTIME_TRACE = true;

export function buildRuntimeErrorDetails(err, extraStack = "") {
  const baseMessage = err instanceof Error ? err.toString() : String(err);
  const stack = err instanceof Error && err.stack ? err.stack : "No stack trace";
  const prefix = DEBUG_RUNTIME_TRACE
    ? `[js_runtime_error_ts=${new Date().toISOString()}] `
    : "";
  return `${prefix}${baseMessage}\n\nStack:\n${stack}${extraStack}`;
}

export function shouldIgnoreRuntimeError(details) {
  const lowerDetails = String(details || "").toLowerCase();
  return lowerDetails.includes("cannot send widget sync message")
    || lowerDetails.includes("error: cannot send");
}

export function captureRuntimeError({ model, enqueueLog, err, extraStack = "" }) {
  const errorDetails = buildRuntimeErrorDetails(err, extraStack);
  if (shouldIgnoreRuntimeError(errorDetails)) {
    enqueueLog("warn", errorDetails);
    return;
  }
  enqueueLog("error", errorDetails);
  model.set("error_message", errorDetails);
  model.set("widget_error", errorDetails);
  model.save_changes();
}
