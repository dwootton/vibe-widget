// Mirrors `vibe_widget/hosts/protocol.py`: the `vibe.host/1` envelope and
// method names. Kept as plain constants/helpers (no validation duplicated
// here) - the host is authoritative for validating inbound packets; the
// frontend only needs to *build* well-formed ones and *read* the ones it
// receives.

export const PROTOCOL = "vibe.host/1";

export const METHODS = Object.freeze({
  HELLO: "client.hello",
  SNAPSHOT: "state.snapshot",
  PATCH: "state.patch",
  SET: "state.set",
  CUSTOM_SEND: "custom.send",
  CUSTOM_MSG: "custom.msg",
  DISCONNECTED: "session.disconnected",
  CLOSE: "vibe.close",
});

export function packet({ session, sender, senderSequence, rpc }) {
  return { protocol: PROTOCOL, session, sender, senderSequence, rpc };
}

export function request(method, params, id) {
  return { jsonrpc: "2.0", method, params: params || {}, id };
}

export function notification(method, params) {
  return { jsonrpc: "2.0", method, params: params || {} };
}

let _idCounter = 0;
export function nextRequestId() {
  _idCounter += 1;
  return `frontend-${_idCounter}`;
}
