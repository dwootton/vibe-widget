import test from "node:test";
import assert from "node:assert/strict";

import { createModelFacade } from "../../src/vibe_widget/AppWrapper/utils/modelFacade.js";

function fakeModel(values = {}) {
  const handlers = new Map();
  return {
    values,
    changed: {},
    saveCount: 0,
    get(key) {
      return values[key];
    },
    set(key, value) {
      values[key] = value;
    },
    save_changes() {
      this.saveCount += 1;
    },
    on(name, fn) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(fn);
    },
    off(name, fn) {
      const list = handlers.get(name) || [];
      const index = list.indexOf(fn);
      if (index !== -1) list.splice(index, 1);
    },
    emit(name, ...args) {
      (handlers.get(name) || []).slice().forEach((fn) => fn(this, ...args));
    },
    listenerCount(name) {
      return (handlers.get(name) || []).length;
    },
  };
}

const contract = { inputs: ["upstream"], outputs: ["selection"], actions: ["reset"] };

test("with a contract, reads are limited to data, inputs, outputs and action_event", () => {
  const model = fakeModel({ data: [1], upstream: "u", selection: null, code: "secret" });
  const facade = createModelFacade(model, contract);

  assert.deepEqual(facade.get("data"), [1]);
  assert.equal(facade.get("upstream"), "u");
  assert.equal(facade.get("selection"), null);
  assert.equal(facade.get("action_event"), undefined);
  assert.throws(
    () => facade.get("code"),
    /vibe_widget: 'code' is not an input or output of this widget/
  );
  assert.throws(() => facade.get("render_code"), /not an input or output/);
});

test("with a contract, writes are limited to outputs and accept both call forms", () => {
  const model = fakeModel({ upstream: "u", selection: null });
  const facade = createModelFacade(model, contract);

  facade.set("selection", 3);
  assert.equal(model.values.selection, 3);

  facade.set({ selection: 4 });
  assert.equal(model.values.selection, 4);

  facade.set("upstream", "x");
  assert.equal(model.values.upstream, "u", "a write to an input never reaches the model");

  assert.throws(() => facade.set({ selection: 5, status: "ready" }), /'status' is not an input/);
  // A rejected object write is applied atomically: nothing lands.
  assert.equal(model.values.selection, 4);

  facade.save_changes();
  assert.equal(model.saveCount, 1);
  assert.equal(facade.send, undefined);
});

test("without a contract, only internal wrapper traits are denied", () => {
  const model = fakeModel({ data: [1], anything: "ok" });
  const facade = createModelFacade(model, null);

  assert.equal(facade.get("anything"), "ok");
  facade.set("anything", "changed");
  assert.equal(model.values.anything, "changed");
  assert.throws(() => facade.get("execution_state"), /not an input or output/);
  assert.throws(() => facade.set("status", "ready"), /not an input or output/);
});

test("an empty or partial contract falls back to the legacy denylist", () => {
  for (const bad of [{}, { inputs: [], outputs: [] }, { inputs: [], outputs: [], actions: null }]) {
    const model = fakeModel({ anything: "ok" });
    const facade = createModelFacade(model, bad);
    assert.equal(facade.get("anything"), "ok");
    facade.set("anything", "changed");
    assert.equal(model.values.anything, "changed");
    assert.throws(() => facade.get("code"), /not an input or output/);
  }
});

test("on hands the facade to the handler and off removes the mapped wrapper", () => {
  const model = fakeModel({ data: [], action_event: {} });
  const facade = createModelFacade(model, contract);
  const seen = [];
  const handler = (received) => seen.push(received);

  facade.on("change:action_event", handler);
  assert.equal(model.listenerCount("change:action_event"), 1);
  model.emit("change:action_event");
  assert.equal(seen.length, 1);
  assert.equal(seen[0], facade, "handler receives the facade, never the raw model");

  facade.off("change:action_event", handler);
  assert.equal(model.listenerCount("change:action_event"), 0);
  model.emit("change:action_event");
  assert.equal(seen.length, 1);
  assert.equal(facade.__wrapperCount, 0, "off prunes the wrapper map");
});

test("on rejects denied traits and non-change events", () => {
  const model = fakeModel({});
  const facade = createModelFacade(model, contract);

  assert.throws(() => facade.on("change:code", () => {}), /'code' is not an input/);
  assert.throws(() => facade.on("msg:custom", () => {}), /'msg:custom' is not an input/);
});

test("changed exposes only readable traits", () => {
  const model = fakeModel({});
  model.changed = { selection: 1, code: "secret" };
  const facade = createModelFacade(model, contract);

  assert.deepEqual(facade.changed, { selection: 1 });
});

test("an undeclared set stays in the widget and never reaches Python", () => {
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    const model = fakeModel({ data: [1] });
    const facade = createModelFacade(model, { inputs: [], outputs: [], actions: [] });

    facade.set("n_points", 42);
    facade.set("n_points", 43);
    facade.set({ n_slices: 7 });

    assert.equal(facade.get("n_points"), 43);
    assert.equal(facade.get("n_slices"), 7);
    assert.equal("n_points" in model.values, false, "never written to the model");
    assert.equal("n_slices" in model.values, false);

    facade.save_changes();
    assert.deepEqual(facade.changed, {}, "local state produces no change event");
    assert.equal(warnings.length, 2, "one warning per undeclared key");

    assert.throws(() => facade.set("code", "x"), /'code' is not an input or output/);
    assert.throws(() => facade.get("code"), /'code' is not an input or output/);
  } finally {
    console.warn = realWarn;
  }
});
