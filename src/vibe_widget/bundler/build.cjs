const esbuild = require("esbuild");
const path = require("path");

const entry = process.argv[2];
const outfile = process.argv[3];
const shimPath = path.join(process.cwd(), "react-shim.js");
const domShimPath = path.join(process.cwd(), "react-dom-shim.js");
const domClientShimPath = path.join(process.cwd(), "react-dom-client-shim.js");
const schedulerShimPath = path.join(process.cwd(), "scheduler-shim.js");
const reactIsShimPath = path.join(process.cwd(), "react-is-shim.js");

// Exact package names that should be aliased to shims
// Using a Set for O(1) lookup
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

// Map shim type to path
function getShimPath(shimType) {
  switch (shimType) {
    case "react": return shimPath;
    case "react-dom": return domShimPath;
    case "react-dom-client": return domClientShimPath;
    case "scheduler": return schedulerShimPath;
    case "react-is": return reactIsShimPath;
    default: return null;
  }
}

const DEBUG = process.env.VIBE_BUNDLE_DEBUG === "1";

const reactAlias = {
  name: "react-alias",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      const importPath = args.path;

      // Handle HTTP/HTTPS URLs (CDN imports)
      if (importPath.startsWith("http://") || importPath.startsWith("https://")) {
        try {
          const parsed = new URL(importPath);
          const pkgName = extractPackageFromUrlPath(parsed.pathname);
          if (pkgName) {
            const result = isReactPackage(pkgName);
            if (result) {
              const resolvedPath = getShimPath(result.shim);
              if (DEBUG) console.error(`[react-alias] URL ${importPath} -> ${result.shim} shim`);
              if (resolvedPath) return { path: resolvedPath };
            }
          }
        } catch (err) {
          // ignore URL parse errors
        }
        // Let http-loader handle non-React URLs
        return null;
      }

      // Handle bare imports (from node_modules or direct)
      const result = isReactPackage(importPath);
      if (result) {
        const resolvedShimPath = getShimPath(result.shim);
        if (DEBUG) console.error(`[react-alias] ${importPath} -> ${result.shim} shim`);
        if (resolvedShimPath) return { path: resolvedShimPath };
      }

      return null;
    });
  }
};

const httpPlugin = {
  name: "http-loader",
  setup(build) {
    build.onResolve({ filter: /^https?:\/\// }, (args) => {
      // First check if this URL points to a React package
      try {
        const parsed = new URL(args.path);
        const pkgName = extractPackageFromUrlPath(parsed.pathname);
        if (pkgName) {
          const result = isReactPackage(pkgName);
          if (result) {
            const resolvedPath = getShimPath(result.shim);
            if (DEBUG) console.error(`[http-plugin] URL ${args.path} -> ${result.shim} shim`);
            if (resolvedPath) return { path: resolvedPath };
          }
        }
      } catch (err) {
        // ignore URL parse errors
      }
      return {
        path: args.path,
        namespace: "http-url"
      };
    });

    build.onResolve({ filter: /.*/, namespace: "http-url" }, (args) => {
      if (!args.importer) {
        return null;
      }

      // CRITICAL: Check if this is a React package import from within CDN code
      // e.g., react-window from esm.sh imports 'react' which should be shimmed
      const result = isReactPackage(args.path);
      if (result) {
        const resolvedPath = getShimPath(result.shim);
        if (DEBUG) console.error(`[http-plugin] CDN internal import ${args.path} -> ${result.shim} shim`);
        if (resolvedPath) return { path: resolvedPath };
      }

      try {
        const resolved = new URL(args.path, args.importer).toString();

        // Also check the resolved URL for React packages
        try {
          const parsed = new URL(resolved);
          const pkgName = extractPackageFromUrlPath(parsed.pathname);
          if (pkgName) {
            const pkgResult = isReactPackage(pkgName);
            if (pkgResult) {
              const resolvedShimPath = getShimPath(pkgResult.shim);
              if (DEBUG) console.error(`[http-plugin] Resolved URL ${resolved} -> ${pkgResult.shim} shim`);
              if (resolvedShimPath) return { path: resolvedShimPath };
            }
          }
        } catch (err) {
          // ignore URL parse errors
        }

        return { path: resolved, namespace: "http-url" };
      } catch (err) {
        return null;
      }
    });

    build.onLoad({ filter: /.*/, namespace: "http-url" }, async (args) => {
      const response = await fetch(args.path);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${args.path}: ${response.status}`);
      }
      const contents = await response.text();
      let loader = "js";
      if (args.path.endsWith(".tsx")) loader = "tsx";
      else if (args.path.endsWith(".ts")) loader = "ts";
      else if (args.path.endsWith(".jsx")) loader = "jsx";
      return { contents, loader };
    });
  }
};

esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  outfile,
  absWorkingDir: process.env.VIBE_PKG_DIR || process.cwd(),
  nodePaths: process.env.VIBE_PKG_DIR ? [path.join(process.env.VIBE_PKG_DIR, "node_modules")] : [],
  logLevel: "silent",
  plugins: [reactAlias, httpPlugin],
  jsx: "transform",
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  define: {
    "process.env.NODE_ENV": "\"production\""
  }
}).catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
