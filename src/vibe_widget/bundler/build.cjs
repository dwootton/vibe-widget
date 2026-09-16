const esbuild = require("esbuild");
const path = require("path");
const entry = process.argv[2];
const outfile = process.argv[3];

const DEBUG = process.env.VIBE_BUNDLE_DEBUG === "1";

const httpPlugin = {
  name: "http-loader",
  setup(build) {
    build.onResolve({ filter: /^https?:\/\// }, (args) => {
      return {
        path: args.path,
        namespace: "http-url"
      };
    });

    build.onResolve({ filter: /.*/, namespace: "http-url" }, (args) => {
      if (!args.importer) {
        return null;
      }

      try {
        const resolved = new URL(args.path, args.importer).toString();
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

const externalizeReact = process.env.VIBE_EXTERNALIZE_REACT === "1";
const includeReact = !externalizeReact;

const nodePaths = [];
if (process.env.VIBE_PKG_DIR) {
  nodePaths.push(path.join(process.env.VIBE_PKG_DIR, "node_modules"));
}
if (includeReact && process.env.VIBE_NODE_MODULES) {
  nodePaths.push(process.env.VIBE_NODE_MODULES);
}

esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  outfile,
  absWorkingDir: process.env.VIBE_PKG_DIR || process.cwd(),
  nodePaths,
  logLevel: "silent",
  plugins: [httpPlugin],
  jsx: "transform",
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  external: includeReact
    ? []
    : [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/client",
        "scheduler",
        "react-is",
      ],
  define: {
    "process.env.NODE_ENV": "\"production\""
  }
}).catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
