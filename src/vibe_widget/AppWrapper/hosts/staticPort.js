// Static (read-mostly) transport: hydrates a model from an embedded JSON
// snapshot with no host process behind it at all - the mode a rendered
// Quarto document or a plain `vw_html()` export uses.
//
// `sendSet` only updates the in-page model (already applied optimistically
// by `hostModel.js`); there is nothing to persist it to. `sendCustom`
// answers the three known custom-message types with an explicit "not
// available" reply instead of silently doing nothing, because the frontend
// (`modelActions.js`) awaits a correlated reply by `request_id` for each of
// them - leaving it unanswered would hang a promise (a stuck save dialog, a
// spinner that never resolves) rather than surfacing a clear message.
export function createStaticPort({ snapshot, sessionId = "static-session" }) {
  const snapshotHandlers = new Set();
  const customHandlers = new Set();

  function emitCustom(content) {
    for (const handler of customHandlers) handler(content);
  }

  // Deferred so callers can register `onSnapshot` before it fires, exactly
  // like the live port's asynchronous handshake.
  queueMicrotask(() => {
    for (const handler of snapshotHandlers) handler(snapshot || {});
  });

  return {
    sessionId,
    onSnapshot(handler) {
      snapshotHandlers.add(handler);
    },
    onPatch() {
      // A static export never produces patches of its own; nothing to
      // subscribe to, so this is intentionally a no-op registration.
    },
    onCustom(handler) {
      customHandlers.add(handler);
    },
    onClosed() {
      // No connection exists to close/reconnect in static mode.
    },
    sendSet() {
      // Handled entirely client-side by hostModel's optimistic apply.
    },
    sendCustom(content) {
      const type = content && content.type;
      const requestId = content && content.request_id;
      queueMicrotask(() => {
        if (type === "request_editor_bundle") {
          emitCustom({ type: "editor_bundle_error", error: "Editing is not available in a static export." });
        } else if (type === "save_widget") {
          emitCustom({
            type: "save_widget_result",
            request_id: requestId,
            success: false,
            error: "Saving is not available in a static export.",
          });
        } else if (type === "remote_call") {
          emitCustom({
            type: "remote_call_result",
            id: content.id,
            success: false,
            error: "Remote calls are not available in a static export.",
          });
        }
      });
    },
    close() {
      // Nothing to tear down.
    },
  };
}
