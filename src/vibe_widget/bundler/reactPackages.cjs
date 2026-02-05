/**
 * Pure functions for identifying React-family packages and resolving
 * CDN URL paths to package names.
 *
 * Extracted from build.cjs so they can be unit-tested without running esbuild.
 */

// Exact package names that should be aliased to shims
const REACT_SHIM_PACKAGES = new Set([
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "preact",
  "preact/compat",
  "preact/hooks",
  "preact/jsx-runtime"
]);

const REACT_DOM_SHIM_PACKAGES = new Set([
  "react-dom",
  "react-dom/server",
  "react-dom/server.browser",
  "react-dom/test-utils"
]);

const REACT_DOM_CLIENT_SHIM_PACKAGES = new Set([
  "react-dom/client"
]);

const SCHEDULER_SHIM_PACKAGES = new Set([
  "scheduler",
  "scheduler/tracing"
]);

const REACT_IS_SHIM_PACKAGES = new Set([
  "react-is"
]);

// Check if a path matches a React package (exact match or subpath)
function isReactPackage(importPath) {
  // Exact match checks first (fast path)
  if (REACT_SHIM_PACKAGES.has(importPath)) return { shim: "react" };
  if (REACT_DOM_CLIENT_SHIM_PACKAGES.has(importPath)) return { shim: "react-dom-client" };
  if (REACT_DOM_SHIM_PACKAGES.has(importPath)) return { shim: "react-dom" };
  if (SCHEDULER_SHIM_PACKAGES.has(importPath)) return { shim: "scheduler" };
  if (REACT_IS_SHIM_PACKAGES.has(importPath)) return { shim: "react-is" };

  // Check for subpaths (e.g., "react/cjs/react.production.min.js")
  for (const pkg of REACT_SHIM_PACKAGES) {
    if (importPath === pkg || importPath.startsWith(pkg + "/")) {
      return { shim: "react" };
    }
  }
  for (const pkg of REACT_DOM_CLIENT_SHIM_PACKAGES) {
    if (importPath === pkg || importPath.startsWith(pkg + "/")) {
      return { shim: "react-dom-client" };
    }
  }
  for (const pkg of REACT_DOM_SHIM_PACKAGES) {
    if (importPath === pkg || importPath.startsWith(pkg + "/")) {
      return { shim: "react-dom" };
    }
  }
  for (const pkg of SCHEDULER_SHIM_PACKAGES) {
    if (importPath === pkg || importPath.startsWith(pkg + "/")) {
      return { shim: "scheduler" };
    }
  }
  for (const pkg of REACT_IS_SHIM_PACKAGES) {
    if (importPath === pkg || importPath.startsWith(pkg + "/")) {
      return { shim: "react-is" };
    }
  }

  return null;
}

// Parse a URL pathname to extract the package name
// Handles CDN URL formats like:
//   /react@18.2.0 -> react
//   /v135/react@18.2.0/es2022/react.mjs -> react
//   /@tanstack/react-virtual@3.0.0 -> @tanstack/react-virtual
function extractPackageFromUrlPath(urlPath) {
  // Remove leading slash
  let p = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath;

  // Remove version prefix like "v135/" or "stable/"
  p = p.replace(/^(v\d+|stable)\//, "");

  // Handle scoped packages (@org/pkg)
  let pkgName;
  if (p.startsWith("@")) {
    // Scoped package: @org/pkg@version or @org/pkg/subpath
    const match = p.match(/^(@[^/]+\/[^/@]+)/);
    if (match) {
      pkgName = match[1];
    }
  } else {
    // Regular package: pkg@version or pkg/subpath
    const match = p.match(/^([^/@]+)/);
    if (match) {
      pkgName = match[1];
    }
  }

  if (!pkgName) return null;

  // Remove version suffix (@18.2.0)
  pkgName = pkgName.replace(/@[^/]+$/, "");

  // Get the rest of the path after the package name
  const restStart = p.indexOf(pkgName) + pkgName.length;
  let rest = p.slice(restStart);

  // Remove version from rest if present
  rest = rest.replace(/^@[^/]+/, "");

  // Clean up subpath
  if (rest.startsWith("/")) {
    rest = rest.slice(1);
  }

  // Build the full import path
  if (rest && !rest.includes(".")) {
    // It's a subpath like "jsx-runtime"
    return pkgName + "/" + rest.split("/")[0];
  }

  return pkgName;
}

module.exports = {
  REACT_SHIM_PACKAGES,
  REACT_DOM_SHIM_PACKAGES,
  REACT_DOM_CLIENT_SHIM_PACKAGES,
  SCHEDULER_SHIM_PACKAGES,
  REACT_IS_SHIM_PACKAGES,
  isReactPackage,
  extractPackageFromUrlPath,
};
