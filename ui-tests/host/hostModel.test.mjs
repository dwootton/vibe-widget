import assert from "node:assert/strict";
import test from "node:test";

import { createHostModel } from "../../src/vibe_widget/AppWrapper/hosts/hostModel.js";

// A minimal fake port satisfying exactly the interface `hostModel.js`
// expects from `wsPort.js`/`staticPort.js`, so these tests exercise
// `hostModel.js` in isolation from any real transport.
function createFakePort() {
  const handlers = { snapshot: [], patch: [], custom: [], closed: [] };
  return {
    sessionId: "fake-session",
    sentSets: [],
    sentCustom: [],
    closed: false,
    onSnapshot(h) {
      handlers.snapshot.push(h);
    },
    onPatch(h) {
      handlers.patch.push(h);
    },
    onCustom(h) {
      handlers.custom.push(h);
    },
    onClosed(h) {
      handlers.closed.push(h);
    },
    sendSet(changes) {
      this.sentSets.push(changes);
    },
    sendCustom(content) {
      this.sentCustom.push(content);
    },
    close() {
      this.closed = true;
    },
    // test helpers, not part of the real port interface
    emitSnapshot(state) {
      for (const h of handlers.snapshot) h(state);
    },
    emitPatch(changes) {
      for (const h of handlers.patch) h(changes);
    },
    emitCustom(content) {
      for (const h of handlers.custom) h(content);
    },
    emitClosed() {
      for (const h of handlers.closed) h();
    },
  };
}

test("get() returns undefined before any snapshot arrives", () => {
  const port = createFakePort();
  const model = createHostModel(port);
  assert.equal(model.get("status"), undefined);
});

test("snapshot populates state and fires change:<trait> for each key", () => {
  const port = createFakePort();
  const model = createHostModel(port);
  const seen = [];
  model.on("change:status", (c) => seen.push(c));
  port.emitSnapshot({ status: "ready", code: "export default function X(){}" });
  assert.equal(model.get("status"), "ready");
  assert.equal(model.get("code"), "export default function X(){}");
  assert.deepEqual(seen, [{ name: "status", old: undefined, new: "ready" }]);
});

test("a later patch overwrites only the keys it names", () => {
  const port = createFakePort();
  const model = createHostModel(port);
  port.emitSnapshot({ status: "generating", code: "" });
  port.emitPatch({ status: "ready" });
  assert.equal(model.get("status"), "ready");
  assert.equal(model.get("code"), ""); // untouched
});

test("set() stages changes without applying them until save_changes()", () => {
  const port = createFakePort();
  const model = createHostModel(port);
  port.emitSnapshot({ threshold: 1 });
  model.set("threshold", 42);
  assert.equal(model.get("threshold"), 1, "not yet applied");
  model.save_changes();
  assert.equal(model.get("threshold"), 42);
});

test("set() also accepts an object of multiple keys at once", () => {
  const port = createFakePort();
  const model = createHostModel(port);
  port.emitSnapshot({ a: 1, b: 1 });
  model.set({ a: 2, b: 2 });
  model.save_changes();
  assert.equal(model.get("a"), 2);
  assert.equal(model.get("b"), 2);
});

test("save_changes sends exactly the staged changes to the port", () => {
  const port = createFakePort();
  const model = createHostModel(port);
  model.set("code", "next");
  model.save_changes();
  assert.deepEqual(port.sentSets, [{ code: "next" }]);
});

test("save_changes with nothing staged does not call the port", () => {
  const port = createFakePort();
  const model = createHostModel(port);
  model.save_changes();
  assert.deepEqual(port.sentSets, []);
});

test("save_changes fires change:<trait> for every staged key, applied optimistically", () => {
  const port = createFakePort();
  const model = createHostModel(port);
  const events = [];
  model.on("change:code", (c) => events.push(c));
  model.set("code", "v1");
  model.save_changes();
  assert.deepEqual(events, [{ name: "code", old: undefined, new: "v1" }]);
});

test("send() forwards to the port's sendCustom", () => {
  const port = createFakePort();
  const model = createHostModel(port);
  model.send({ type: "save_widget", path: "x.vw" });
  assert.deepEqual(port.sentCustom, [{ type: "save_widget", path: "x.vw" }]);
});

test("on/off msg:custom mirrors inbound custom messages from the port", () => {
  const port = createFakePort();
  const model = createHostModel(port);
  const received = [];
  const handler = (content) => received.push(content);
  model.on("msg:custom", handler);
  port.emitCustom({ type: "save_widget_result", success: true });
  assert.deepEqual(received, [{ type: "save_widget_result", success: true }]);

  model.off("msg:custom", handler);
  port.emitCustom({ type: "save_widget_result", success: false });
  assert.equal(received.length, 1, "handler must not fire after off()");
});

test("off() with no handler clears every listener for that event", () => {
  const port = createFakePort();
  const model = createHostModel(port);
  let calls = 0;
  model.on("msg:custom", () => calls++);
  model.on("msg:custom", () => calls++);
  model.off("msg:custom");
  port.emitCustom({ type: "x" });
  assert.equal(calls, 0);
});

test("a listener that throws does not prevent other listeners from running", () => {
  const port = createFakePort();
  const model = createHostModel(port);
  let secondRan = false;
  model.on("change:status", () => {
    throw new Error("boom");
  });
  model.on("change:status", () => {
    secondRan = true;
  });
  port.emitSnapshot({ status: "ready" });
  assert.equal(secondRan, true);
});

test("port disconnection emits comm:close and the model.comm.on('close') shim", () => {
  const port = createFakePort();
  const model = createHostModel(port);
  let viaEvent = false;
  let viaComm = false;
  model.on("comm:close", () => {
    viaEvent = true;
  });
  model.comm.on("close", () => {
    viaComm = true;
  });
  port.emitClosed();
  assert.equal(viaEvent, true);
  assert.equal(viaComm, true);
});

test("model.comm.off('close') stops the comm shim handler", () => {
  const port = createFakePort();
  const model = createHostModel(port);
  let calls = 0;
  const handler = () => calls++;
  model.comm.on("close", handler);
  model.comm.off("close", handler);
  port.emitClosed();
  assert.equal(calls, 0);
});

test("close() forwards to the port's close", () => {
  const port = createFakePort();
  const model = createHostModel(port);
  model.close();
  assert.equal(port.closed, true);
});

test("model_id reflects the port's sessionId", () => {
  const port = createFakePort();
  const model = createHostModel(port);
  assert.equal(model.model_id, "fake-session");
});
