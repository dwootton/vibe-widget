// Live transport: a `vibe.host/1` WebSocket connection to
// `vibe_widget.hosts.server.LocalHostServer`. Reconnects with backoff and
// re-hydrates from a fresh `state.snapshot` on every (re)connect, so a
// transient network blip (or the host process restarting) degrades to a
// brief pause rather than a permanently broken page.
import { METHODS, PROTOCOL, notification, packet, request } from "./protocol.js";

const MAX_BACKOFF_MS = 8000;
const BASE_BACKOFF_MS = 250;

export function createWsPort({ url, sessionId, token }) {
  let ws = null;
  let closedByCaller = false;
  let senderSeq = 0;
  let attempt = 0;
  let reconnectTimer = null;

  const snapshotHandlers = new Set();
  const patchHandlers = new Set();
  const customHandlers = new Set();
  const closedHandlers = new Set();

  function nextSeq() {
    senderSeq += 1;
    return senderSeq;
  }

  function send(rpc) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(packet({ session: sessionId, sender: "frontend", senderSequence: nextSeq(), rpc })));
    return true;
  }

  function connect() {
    senderSeq = 0;
    ws = new WebSocket(url);
    ws.onopen = () => {
      attempt = 0;
      send(request(METHODS.HELLO, { clientId: "vibewidget-host-frontend", token }, "hello"));
    };
    ws.onmessage = (event) => {
      let value;
      try {
        value = JSON.parse(event.data);
      } catch {
        return;
      }
      handlePacket(value);
    };
    ws.onclose = () => {
      if (closedByCaller) return;
      for (const handler of closedHandlers) handler();
      scheduleReconnect();
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* already closing */
      }
    };
  }

  function scheduleReconnect() {
    if (closedByCaller) return;
    attempt += 1;
    const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempt - 1));
    reconnectTimer = setTimeout(connect, delay);
  }

  function handlePacket(value) {
    if (!value || value.protocol !== PROTOCOL || value.session !== sessionId) return;
    const rpc = value.rpc;
    if (!rpc || typeof rpc !== "object") return;

    if (rpc.error) {
      console.error("[vibewidget-host] host error", rpc.error);
      return;
    }
    if (rpc.id !== undefined && rpc.result !== undefined) {
      // client.hello's response - nothing further to do; state.snapshot
      // arrives as its own notification right after.
      return;
    }
    const { method, params } = rpc;
    if (method === METHODS.SNAPSHOT) {
      for (const handler of snapshotHandlers) handler(params.state || {});
    } else if (method === METHODS.PATCH) {
      for (const handler of patchHandlers) handler(params.changes || {});
    } else if (method === METHODS.CUSTOM_MSG) {
      for (const handler of customHandlers) handler(params.content);
    } else if (method === METHODS.DISCONNECTED) {
      for (const handler of closedHandlers) handler();
    }
  }

  connect();

  return {
    sessionId,
    onSnapshot(handler) {
      snapshotHandlers.add(handler);
    },
    onPatch(handler) {
      patchHandlers.add(handler);
    },
    onCustom(handler) {
      customHandlers.add(handler);
    },
    onClosed(handler) {
      closedHandlers.add(handler);
    },
    sendSet(changes) {
      send(notification(METHODS.SET, { changes }));
    },
    sendCustom(content) {
      send(notification(METHODS.CUSTOM_SEND, { content }));
    },
    close() {
      closedByCaller = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        send(notification(METHODS.CLOSE, {}));
      } catch {
        /* best effort */
      }
      try {
        ws?.close(1000, "client closed");
      } catch {
        /* already closed */
      }
    },
  };
}
