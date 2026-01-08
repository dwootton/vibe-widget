export function buildStackSummary({ errorMessage, widgetError, logs, widgetLogs }) {
  const combined = [errorMessage, widgetError].filter(Boolean).join("\n");
  const combinedSummary = extractStackLines(combined);
  if (combinedSummary.length > 0) {
    return combinedSummary;
  }
  if (Array.isArray(widgetLogs) && widgetLogs.length > 0) {
    const widgetLogText = widgetLogs
      .map((entry) => (entry && typeof entry === "object" ? entry.message : entry))
      .filter(Boolean)
      .join("\n");
    const widgetSummary = extractStackLines(widgetLogText);
    if (widgetSummary.length > 0) {
      return widgetSummary;
    }
  }
  if (Array.isArray(logs) && logs.length > 0) {
    return extractStackLines(logs.join("\n"));
  }
  return [];
}

function extractStackLines(text) {
  const raw = String(text || "");
  if (!raw) return [];
  const lines = raw
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const jsErrorIndex = lines.findIndex((line) => /\bError:\b/.test(line));
  if (jsErrorIndex >= 0) {
    const jsLines = lines.slice(jsErrorIndex, jsErrorIndex + 8);
    const filtered = jsLines.filter((line, idx) => idx === 0 || /^\s*at\s+/.test(line));
    return filtered.length > 0 ? filtered : jsLines;
  }
  const traceIndex = lines.findIndex((line) => line.toLowerCase().includes("traceback"));
  if (traceIndex >= 0) {
    return lines.slice(traceIndex).slice(-8);
  }
  return lines.slice(-6);
}
