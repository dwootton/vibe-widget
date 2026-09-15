import test from "node:test";
import assert from "node:assert/strict";

import { installDom } from "./domEnv.mjs";

installDom();

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { flushSync } = await import("react-dom");
const RuntimeErrorBoundary = (
  await import("../../src/vibe_widget/AppWrapper/components/RuntimeErrorBoundary.js")
).default;

function Thrower() {
  throw new Error("guest widget exploded");
}

test("boundary reports the error, renders the fallback, and does not rethrow", () => {
  const reported = [];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  // React logs caught errors; silence it so the run stays readable.
  const originalError = console.error;
  console.error = () => {};
  try {
    flushSync(() => {
      root.render(
        React.createElement(
          RuntimeErrorBoundary,
          {
            resetKey: "v1",
            onError: (err, stack) => reported.push({ err, stack }),
            fallback: React.createElement("div", null, "fallback shown"),
          },
          React.createElement(Thrower)
        )
      );
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(reported.length, 1);
  assert.equal(reported[0].err.message, "guest widget exploded");
  assert.match(container.innerHTML, /fallback shown/);

  root.unmount();
  container.remove();
});

test("boundary renders children when nothing throws", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  flushSync(() => {
    root.render(
      React.createElement(
        RuntimeErrorBoundary,
        { resetKey: "v1", onError: () => {}, fallback: null },
        React.createElement("div", null, "guest ok")
      )
    );
  });

  assert.match(container.innerHTML, /guest ok/);
  root.unmount();
  container.remove();
});
