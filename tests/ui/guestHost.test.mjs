import test from "node:test";
import assert from "node:assert/strict";

import { installDom } from "./domEnv.mjs";

installDom();

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { flushSync } = await import("react-dom");
const { GuestHost, provideReact } = await import(
  "../../src/vibe_widget/AppWrapper/utils/sharedReact.js"
);

provideReact(React, { createRoot, flushSync }, { createRoot });

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act } = React;

let mounts = 0;

function Guest({ model }) {
  React.useEffect(() => {
    mounts += 1;
  }, []);
  return React.createElement("p", null, `guest:${model.get("x")}`);
}

async function render(container, props) {
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(GuestHost, props));
  });
  return root;
}

test("the guest mounts in its own node and survives wrapper re-renders", async () => {
  mounts = 0;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const facade = { get: () => "one" };
  const props = { Guest, facade, resetKey: "v1", onError: () => {} };

  const root = await render(container, props);
  assert.match(container.innerHTML, /guest:one/);
  assert.equal(mounts, 1);

  // Same props, new wrapper render: the guest root must not be torn down.
  await act(async () => {
    root.render(React.createElement(GuestHost, { ...props }));
  });
  assert.equal(mounts, 1, "guest remounted on a wrapper re-render");

  await act(async () => {
    root.unmount();
  });
  assert.equal(container.querySelectorAll("div").length, 0, "mount point leaked");
  container.remove();
});

test("new code remounts the guest in a fresh node", async () => {
  mounts = 0;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const facade = { get: () => "two" };
  const root = await render(container, { Guest, facade, resetKey: "v1", onError: () => {} });

  await act(async () => {
    root.render(
      React.createElement(GuestHost, { Guest, facade, resetKey: "v2", onError: () => {} })
    );
  });
  assert.equal(mounts, 2);
  assert.match(container.innerHTML, /guest:two/);

  await act(async () => {
    root.unmount();
  });
  container.remove();
});
