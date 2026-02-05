/**
 * Pure functions for validating and inspecting widget source code.
 * Extracted from SandboxedRunner so they can be unit-tested independently.
 */

export const REACT_PACKAGE_NAMES = new Set([
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom/client",
  "react-dom/server",
  "preact",
  "preact/compat",
  "preact/hooks",
  "preact/jsx-runtime",
  "scheduler",
  "scheduler/tracing",
  "react-is",
]);

// Match React packages in URL paths, ensuring we don't match react-window, react-query, etc.
// Matches: /react, /react@18.0.0, /react/jsx-runtime, /v135/react@18.0.0/...
// Does NOT match: /react-window, /react-query, /@tanstack/react-virtual
export const REACT_URL_PATH_PATTERN = /(?:^|\/)(react|react-dom|preact|scheduler|react-is)(?:@[\d.]+)?(?:\/|$)/i;

export function extractImportSpecifiers(source) {
  if (!source) return [];
  const specs = [];
  const importRe = /from\s+["']([^"']+)["']/g;
  const requireRe = /require\(\s*["']([^"']+)["']\s*\)/g;
  let match = importRe.exec(source);
  while (match) {
    specs.push(match[1]);
    match = importRe.exec(source);
  }
  match = requireRe.exec(source);
  while (match) {
    specs.push(match[1]);
    match = requireRe.exec(source);
  }
  return specs;
}

export function isBundledSource(source) {
  if (!source) return false;
  const trimmed = source.trimStart();
  return trimmed.startsWith("/*__VIBE_BUNDLED__*/");
}

export function isReactImportForbidden(source) {
  if (!source) return false;
  const specs = extractImportSpecifiers(source);
  for (const spec of specs) {
    if (!spec) continue;
    const normalized = spec.trim();
    const isUrl = normalized.startsWith("http://") || normalized.startsWith("https://");
    if (isUrl) {
      try {
        const parsed = new URL(normalized);
        if (REACT_URL_PATH_PATTERN.test(parsed.pathname)) {
          return true; // React pulled from a CDN/URL is forbidden; use bare specifiers
        }
      } catch (err) {
        // ignore malformed URL
      }
      continue;
    }
    // Disallow all React-family packages as explicit imports; host/runtime provides React.
    if (REACT_PACKAGE_NAMES.has(normalized)) {
      return true;
    }
  }
  return false;
}
