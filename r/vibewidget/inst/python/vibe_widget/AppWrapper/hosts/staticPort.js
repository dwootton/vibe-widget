// Static (read-mostly) transport: hydrates a model from an embedded JSON
// snapshot with no host process behind it at all - the mode a rendered
// Quarto document or a plain `vw_html()` export uses.
//
// `sendSet` only updates the in-page model (already applied optimistically
// by `hostModel.js`); there is nothing to persist it to. `sendCustom`
// answers `save_widget` - the one custom message type the engine still
// handles (see `VibeWidget._handle_custom_msg`) - with an explicit
// "not available" reply instead of silently doing nothing, because the
// frontend awaits a correlated reply by `request_id`: leaving it unanswered
// would hang a promise (a stuck save dialog) rather than surfacing a clear
// message. Any other message type is ignored, matching the engine itself.
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
      if (type !== "save_widget") return;
      queueMicrotask(() => {
        emitCustom({
          type: "save_widget_result",
          request_id: requestId,
          success: false,
          error: "Saving is not available in a static export.",
        });
      });
    },
    close() {
      // Nothing to tear down.
    },
  };
}
