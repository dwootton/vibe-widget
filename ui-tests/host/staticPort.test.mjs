import assert from "node:assert/strict";
import test from "node:test";

import { createStaticPort } from "../../src/vibe_widget/AppWrapper/hosts/staticPort.js";

function waitForMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test("the embedded snapshot is delivered asynchronously to onSnapshot", async () => {
  const port = createStaticPort({ snapshot: { status: "ready" } });
  let received = null;
  port.onSnapshot((s) => {
    received = s;
  });
  assert.equal(received, null, "must not fire synchronously - callers must be able to subscribe first");
  await waitForMicrotasks();
  assert.deepEqual(received, { status: "ready" });
});

test("a missing snapshot defaults to an empty object", async () => {
  const port = createStaticPort({});
  let received = "not called";
  port.onSnapshot((s) => {
    received = s;
  });
  await waitForMicrotasks();
  assert.deepEqual(received, {});
});

test("sendSet is a no-op (nothing to persist to in static mode)", () => {
  const port = createStaticPort({ snapshot: {} });
  assert.doesNotThrow(() => port.sendSet({ code: "x" }));
});

test("save_widget gets a correlated failure reply instead of hanging", async () => {
  const port = createStaticPort({ snapshot: {} });
  const replies = [];
  port.onCustom((c) => replies.push(c));
  port.sendCustom({ type: "save_widget", request_id: "req-42", path: "x.vw" });
  await waitForMicrotasks();
  assert.deepEqual(replies, [
    { type: "save_widget_result", request_id: "req-42", success: false, error: "Saving is not available in a static export." },
  ]);
});

test("an unknown message type produces no reply (matching the engine, which ignores it too)", async () => {
  const port = createStaticPort({ snapshot: {} });
  const replies = [];
  port.onCustom((c) => replies.push(c));
  port.sendCustom({ type: "request_editor_bundle" });
  port.sendCustom({ type: "remote_call", id: "call-1", name: "fs_list" });
  await waitForMicrotasks();
  assert.deepEqual(replies, []);
});

test("an unrecognized custom message type produces no reply", async () => {
  const port = createStaticPort({ snapshot: {} });
  const replies = [];
  port.onCustom((c) => replies.push(c));
  port.sendCustom({ type: "something_unknown" });
  await waitForMicrotasks();
  assert.deepEqual(replies, []);
});

test("close() does not throw (nothing to tear down)", () => {
  const port = createStaticPort({ snapshot: {} });
  assert.doesNotThrow(() => port.close());
});

test("sessionId defaults to a stable value when not provided", () => {
  const port = createStaticPort({ snapshot: {} });
  assert.equal(port.sessionId, "static-session");
});
