// A minimal AnyWidget-model-compatible object backed by a `vibe.host/1`
// transport port (see wsPort.js / staticPort.js), instead of a Jupyter comm.
//
// This implements exactly the surface AppWrapper.js and its hooks actually
// use: `get`, `set`, `save_changes`, `on`, `off`, `send`, `close`, the
// `change:<trait>` / `msg:custom` / `comm:close` events, and the small
// `model.comm.on/off("close", ...)` shim AppWrapper.js reaches for directly.
// The behavioral shape mirrors `ui-tests/contract/testHarness.mjs`'s
// `createMockModel` - the smallest correct spec of this interface already
// proven against the real frontend - plus a real transport underneath.
export function createHostModel(port) {
  const state = {};
  const listeners = new Map(); // event name -> Set<handler>
  let pending = {}; // staged `set()` calls not yet flushed by `save_changes()`

  function emit(event, payload) {
    const handlers = listeners.get(event);
    if (!handlers) return;
    for (const handler of [...handlers]) {
      try {
        handler(payload);
      } catch (err) {
        // A misbehaving listener must not break state delivery to every
        // other listener (or the transport's own read loop).
        console.error(`[vibewidget-host] listener for "${event}" threw`, err);
      }
    }
  }

  function applyIncoming(changes) {
    for (const [key, value] of Object.entries(changes)) {
      const old = state[key];
      state[key] = value;
      emit(`change:${key}`, { name: key, old, new: value });
    }
  }

  const commHandlers = new Set();

  const model = {
    get(key) {
      return state[key];
    },

    set(key, value) {
      if (typeof key === "object" && key !== null) {
        Object.assign(pending, key);
        return;
      }
      pending[key] = value;
    },

    save_changes() {
      const changes = pending;
      pending = {};
      if (Object.keys(changes).length === 0) return;
      // Apply optimistically so the sender's own UI feels responsive
      // immediately; the host is the source of truth, and any divergence
      // (e.g. the host rejects the write) is corrected by the next patch.
      applyIncoming(changes);
      port.sendSet(changes);
    },

    send(content, _callbacks, _buffers) {
      port.sendCustom(content);
    },

    on(event, handler) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(handler);
    },

    off(event, handler) {
      const set = listeners.get(event);
      if (!set) return;
      if (handler) {
        set.delete(handler);
        if (set.size === 0) listeners.delete(event);
      } else {
        listeners.delete(event);
      }
    },

    close() {
      port.close();
    },

    // Ad-hoc properties AppWrapper.js touches directly (tracing + the
    // legacy `model.comm.on("close", ...)` path). `comm` is a thin shim so
    // that code keeps working unmodified.
    model_id: port.sessionId,
    comm: {
      on(event, handler) {
        if (event !== "close") return;
        commHandlers.add(handler);
      },
      off(event, handler) {
        if (event !== "close") return;
        commHandlers.delete(handler);
      },
    },
  };

  port.onSnapshot((snapshot) => applyIncoming(snapshot));
  port.onPatch((changes) => applyIncoming(changes));
  port.onCustom((content) => emit("msg:custom", content));
  port.onClosed(() => {
    emit("comm:close", {});
    for (const handler of [...commHandlers]) {
      try {
        handler();
      } catch (err) {
        console.error("[vibewidget-host] comm close handler threw", err);
      }
    }
  });

  return model;
}
