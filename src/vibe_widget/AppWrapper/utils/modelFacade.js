/**
 * Restricted view of the anywidget model handed to generated widget code.
 *
 * Generated code never receives the real model: no `send`, no access to the
 * traits the wrapper uses to drive generation, repair and approval.
 */

// Traits owned by the wrapper/Python side. Never readable or writable by guests.
export const INTERNAL_KEYS = new Set([
  "code",
  "render_code",
  "execution_state",
  "audit_state",
  "grab_edit_request",
  "state_prompt_request",
  "debug_event",
  "debug_mode",
  "logs",
  "status",
  "error_message",
  "widget_error",
  "last_runtime_error",
  "widget_logs",
  "retry_count",
  "frontend_ready",
  "contract",
]);

function deny(key) {
  throw new Error(`vibe_widget: '${key}' is not an input or output of this widget`);
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

// An unpopulated traitlets.Dict arrives as {}, which is truthy; only a fully
// shaped contract switches on the allowlist.
export function isUsableContract(contract) {
  return (
    !!contract &&
    typeof contract === "object" &&
    Array.isArray(contract.inputs) &&
    Array.isArray(contract.outputs) &&
    Array.isArray(contract.actions)
  );
}

export function createModelFacade(model, rawContract) {
  const contract = isUsableContract(rawContract) ? rawContract : null;
  let canRead;
  let canWrite;

  if (contract) {
    const readable = new Set(["data", "action_event"]);
    asList(contract.inputs).forEach((name) => readable.add(name));
    asList(contract.outputs).forEach((name) => readable.add(name));
    if (model.get("theme") !== undefined) readable.add("theme");
    const writable = new Set(asList(contract.outputs));
    canRead = (key) => readable.has(key);
    canWrite = (key) => writable.has(key);
  } else {
    // Legacy cached widgets carry no contract; fall back to the internal denylist.
    canRead = (key) => !INTERNAL_KEYS.has(key);
    canWrite = canRead;
  }

  // Backbone hands the model itself to change handlers; substitute the facade so
  // the raw model never escapes. One wrapper per handler keeps `off` working.
  const wrappers = new Map();

  // Widgets keep internal state in model.set("n_points", ...) even when nothing is
  // declared. Those keys live here instead: readable back, never synced to Python.
  // ponytail: a local value shadows a declared input of the same name; declare it
  // as an output if Python has to see it.
  const localState = new Map();
  const warned = new Set();

  function setLocal(key, value) {
    if (INTERNAL_KEYS.has(key)) deny(key);
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(
        `vibe_widget: '${key}' is not a declared output; kept in the widget, not synced to Python`
      );
    }
    localState.set(key, value);
  }

  const facade = {
    get(key) {
      if (localState.has(key)) return localState.get(key);
      if (!canRead(key)) deny(key);
      return model.get(key);
    },
    set(key, value) {
      if (key && typeof key === "object") {
        // Validate first: an internal key still rejects the whole object write.
        Object.keys(key).forEach((name) => {
          if (INTERNAL_KEYS.has(name) && !canWrite(name)) deny(name);
        });
        Object.keys(key).forEach((name) => {
          if (canWrite(name)) model.set(name, key[name]);
          else setLocal(name, key[name]);
        });
        return;
      }
      if (!canWrite(key)) {
        setLocal(key, value);
        return;
      }
      model.set(key, value);
    },
    save_changes() {
      return model.save_changes();
    },
    on(eventName, handler) {
      const key = eventKey(eventName);
      if (!canRead(key)) deny(key);
      let wrapper = wrappers.get(handler);
      if (!wrapper) {
        wrapper = (_model, ...rest) => handler(facade, ...rest);
        wrappers.set(handler, wrapper);
      }
      return model.on(eventName, wrapper);
    },
    off(eventName, handler) {
      const wrapper = wrappers.get(handler) || handler;
      wrappers.delete(handler);
      return model.off(eventName, wrapper);
    },
  };

  function eventKey(eventName) {
    const name = String(eventName || "");
    if (!name.startsWith("change:")) deny(name);
    return name.slice("change:".length);
  }

  // Test handle: number of live handler wrappers. Harmless to guests.
  Object.defineProperty(facade, "__wrapperCount", {
    get() {
      return wrappers.size;
    },
  });

  Object.defineProperty(facade, "changed", {
    get() {
      const changed = model.changed || {};
      const visible = {};
      Object.keys(changed).forEach((key) => {
        if (canRead(key)) visible[key] = changed[key];
      });
      return visible;
    },
  });

  return facade;
}
