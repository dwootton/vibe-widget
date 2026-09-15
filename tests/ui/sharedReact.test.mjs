import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { installDom } from "./domEnv.mjs";

installDom();

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { flushSync } = await import("react-dom");
const { makeErrorBoundary } = await import(
  "../../src/vibe_widget/AppWrapper/components/RuntimeErrorBoundary.js"
);
const { provideReact, sharedReact, mountGuest } = await import(
  "../../src/vibe_widget/AppWrapper/utils/sharedReact.js"
);

// A genuinely separate React + ReactDOM pair, standing in for the second
// widget's bundle copy: anywidget evaluates AppWrapper.bundle.js once per
// widget, so two widgets on a page never share a React instance.
const require = createRequire(import.meta.url);
for (const key of Object.keys(require.cache)) {
  if (/node_modules[\\/](react|react-dom)[\\/]/.test(key)) delete require.cache[key];
}
const otherReact = require("react");
const otherCreateRoot = require("react-dom/client").createRoot;
const otherFlushSync = require("react-dom").flushSync;

// Widget A's bundle loads first, then widget B's.
const domA = { createRoot, flushSync };
provideReact(React, domA, { createRoot });
// The page-wide import map registers here and binds its exports once.
const shim = { useRef: sharedReact().useRef, useState: sharedReact().useState };
provideReact(otherReact, { createRoot: otherCreateRoot, flushSync: otherFlushSync }, {
  createRoot: otherCreateRoot,
});

function Sub({ label }) {
  // Guest sub-components get their hooks from the import-map shim, not props.
  const kept = shim.useRef(label);
  return React.createElement("span", null, `sub:${kept.current}`);
}

function Guest({ model, React: injected }) {
  return injected.createElement(
    "div",
    null,
    injected.createElement(Sub, { label: model.get("label") })
  );
}

function mountInto(label, onError) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root;
  flushSync(() => {
    root = mountGuest(container, {
      Guest,
      props: { model: { get: () => label } },
      onError,
      fallback: null,
      resetKey: "v1",
    });
  });
  return { container, root };
}

test("the first bundle to load owns React for the whole page", () => {
  assert.notEqual(React, otherReact, "the two copies really are distinct");
  assert.equal(globalThis.ReactProvided, React);
  assert.equal(globalThis.ReactDOMProvided, domA);
  assert.equal(globalThis.ReactDOMClientProvided.createRoot, createRoot);
  assert.equal(sharedReact().useRef, shim.useRef, "shim bindings stay valid");
});

test("boundaries are built per React instance and cached", () => {
  assert.equal(makeErrorBoundary(React), makeErrorBoundary(React));
  assert.notEqual(makeErrorBoundary(React), makeErrorBoundary(otherReact));
});

test("two guest trees mount under the shared React, whichever bundle runs them", () => {
  const errors = [];
  const first = mountInto("one", (err) => errors.push(err));
  const second = mountInto("two", (err) => errors.push(err));

  assert.match(first.container.innerHTML, /sub:one/);
  assert.match(second.container.innerHTML, /sub:two/);
  assert.deepEqual(errors, []);

  first.root.unmount();
  second.root.unmount();
  first.container.remove();
  second.container.remove();
});

test("the same guest under a second React instance is the bug we are avoiding", () => {
  // Negative control: widget B's own React renders the tree while the guest's
  // hooks still come from widget A's copy -> invalid hook call (React #321).
  const errors = [];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Boundary = makeErrorBoundary(otherReact);
  const root = otherCreateRoot(container);

  const originalError = console.error;
  console.error = () => {};
  try {
    otherFlushSync(() => {
      root.render(
        otherReact.createElement(
          Boundary,
          { resetKey: "v1", onError: (err) => errors.push(err), fallback: null },
          otherReact.createElement(Guest, { model: { get: () => "x" }, React: otherReact })
        )
      );
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(errors.length, 1);
  assert.equal(container.innerHTML, "");

  root.unmount();
  container.remove();
});
