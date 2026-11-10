const PLAYER_JS = "https://cdn.jsdelivr.net/npm/rrweb-player@1.0.0-alpha.4/dist/index.js";
const PLAYER_CSS = "https://cdn.jsdelivr.net/npm/rrweb-player@1.0.0-alpha.4/dist/style.css";

function ensurePlayer() {
  if (window.rrwebPlayer) return Promise.resolve();
  if (!document.querySelector(`link[href="${PLAYER_CSS}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = PLAYER_CSS;
    document.head.appendChild(link);
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PLAYER_JS;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function render({ model, el }) {
  const events = JSON.parse(model.get("events") || "[]");
  if (events.length < 2) {
    el.textContent = "Not enough events to replay.";
    return;
  }
  await ensurePlayer();
  const target = document.createElement("div");
  target.className = "vw-replay";
  el.appendChild(target);
  const Player = window.rrwebPlayer.default || window.rrwebPlayer;
  new Player({ target, props: { events, width: 560, height: 360, autoPlay: false, UNSAFE_replayCanvas: true } });
}

export default { render };
