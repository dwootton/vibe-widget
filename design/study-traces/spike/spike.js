// rrweb scoping spike: how much of the notebook does a recording capture,
// and does mounting a widget into a same-origin iframe keep it working?
//
// mode "document": rrweb runs on the notebook page (optionally with blockSelector)
// mode "iframe":   rrweb runs inside an iframe; the widget is rendered into it
//                  from the parent realm (the way SandboxedRunner would do it)

const RRWEB = "https://cdn.jsdelivr.net/npm/rrweb@2.0.0-alpha.4/dist/rrweb.min.js";
const D3 = "https://esm.sh/d3@7.9.0";

function loadScript(doc, src) {
  const win = doc.defaultView;
  if (win.rrweb) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = doc.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    doc.head.appendChild(s);
  });
}

function copyThemeVars(fromDoc, toDoc) {
  const cs = fromDoc.defaultView.getComputedStyle(fromDoc.documentElement);
  for (let i = 0; i < cs.length; i++) {
    const name = cs[i];
    if (name.startsWith("--jp")) {
      toDoc.documentElement.style.setProperty(name, cs.getPropertyValue(name));
    }
  }
  toDoc.body.style.background = "var(--jp-layout-color0, white)";
}

function buildContent(host, d3) {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const root = doc.createElement("div");
  root.className = "vw-spike-root";
  root.style.cssText =
    "font:13px var(--jp-ui-font-family, sans-serif);color:var(--jp-ui-font-color1,#222);padding:8px;position:relative";
  host.appendChild(root);

  const title = doc.createElement("p");
  title.textContent = "Widget text: cohort A has 120 patients";
  title.style.margin = "0 0 6px";
  root.appendChild(title);

  const input = doc.createElement("input");
  input.placeholder = "type a note";
  input.className = "vw-spike-input";
  root.appendChild(input);

  const status = doc.createElement("div");
  status.className = "vw-spike-status";
  status.textContent = "selected: 0 · last key: none";
  root.appendChild(status);

  const W = 320, H = 200;
  const pts = d3.range(40).map((i) => ({ i, x: 10 + ((i * 37) % 300), y: 10 + ((i * 53) % 180) }));
  const svg = d3.select(root).append("svg").attr("width", W).attr("height", H)
    .style("border", "1px solid var(--jp-border-color1,#ccc)");
  let selected = 0;
  let lastKey = "none";
  const render = () => { status.textContent = `selected: ${selected} · last key: ${lastKey}`; };

  const brush = d3.brush().extent([[0, 0], [W, H]]).on("brush end", ({ selection }) => {
    selected = 0;
    dots.attr("fill", (d) => {
      const on = selection && d.x >= selection[0][0] && d.x <= selection[1][0]
        && d.y >= selection[0][1] && d.y <= selection[1][1];
      if (on) selected++;
      return on ? "#d85a30" : "#378add";
    });
    render();
  });
  svg.append("g").attr("class", "brush").call(brush);

  // Tooltip the way generated code often does it: global `document`.
  const naiveTip = document.createElement("div");
  naiveTip.textContent = "naive tooltip (global document)";
  naiveTip.style.cssText = "position:fixed;display:none;background:#fcebeb;color:#791f1f;padding:2px 6px;font:12px sans-serif;pointer-events:none;z-index:9999";
  document.body.appendChild(naiveTip);
  // Tooltip scoped to the widget's own document.
  const scopedTip = doc.createElement("div");
  scopedTip.textContent = "scoped tooltip (ownerDocument)";
  scopedTip.style.cssText = "position:absolute;display:none;background:#e1f5ee;color:#085041;padding:2px 6px;font:12px sans-serif;pointer-events:none";
  root.appendChild(scopedTip);

  const dots = svg.append("g").selectAll("circle").data(pts).join("circle")
    .attr("class", "vw-spike-dot")
    .attr("cx", (d) => d.x).attr("cy", (d) => d.y).attr("r", 6).attr("fill", "#378add")
    .style("cursor", "grab")
    .on("mouseenter", (event) => {
      naiveTip.style.display = "block";
      naiveTip.style.left = event.clientX + 12 + "px";
      naiveTip.style.top = event.clientY + 12 + "px";
      const [mx, my] = d3.pointer(event, root);
      scopedTip.style.display = "block";
      scopedTip.style.left = mx + 12 + "px";
      scopedTip.style.top = my + 24 + "px";
    })
    .on("mouseleave", () => { naiveTip.style.display = "none"; scopedTip.style.display = "none"; })
    .call(d3.drag().on("drag", function (event, d) {
      d.x = event.x; d.y = event.y;
      d3.select(this).attr("cx", d.x).attr("cy", d.y);
    }));

  const canvas = doc.createElement("canvas");
  canvas.width = 320; canvas.height = 60;
  canvas.style.cssText = "display:block;margin-top:6px;border:1px solid var(--jp-border-color1,#ccc)";
  root.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  let t = 0, raf;
  const tick = () => {
    t += 1;
    ctx.clearRect(0, 0, 320, 60);
    ctx.fillStyle = "#1d9e75";
    ctx.beginPath();
    ctx.arc(20 + ((t * 2) % 280), 30, 10, 0, Math.PI * 2);
    ctx.fill();
    raf = win.requestAnimationFrame(tick);
  };
  tick();

  const onKey = (e) => { lastKey = e.key; render(); };
  win.addEventListener("keydown", onKey);

  return () => {
    win.cancelAnimationFrame(raf);
    win.removeEventListener("keydown", onKey);
    naiveTip.remove();
  };
}

async function render({ model, el }) {
  const d3 = await import(D3);
  const mode = model.get("mode");
  const blockSelector = model.get("block_selector") || undefined;

  const bar = document.createElement("div");
  bar.style.cssText = "font:12px sans-serif;margin-bottom:4px;display:flex;gap:8px;align-items:center";
  const label = document.createElement("span");
  label.textContent = `mode=${mode}${blockSelector ? " +block" : ""} · recording…`;
  const stopBtn = document.createElement("button");
  stopBtn.textContent = "Stop & save";
  stopBtn.className = "vw-spike-stop";
  bar.append(label, stopBtn);
  el.appendChild(bar);

  const events = [];
  const opts = {
    emit: (e) => events.push(e),
    recordCanvas: true,
    sampling: { canvas: 2, mousemove: 50 },
    dataURLOptions: { type: "image/webp", quality: 0.6 },
  };
  if (blockSelector) opts.blockSelector = blockSelector;

  let stopRecord, cleanup, measure = {};
  if (mode === "iframe") {
    const iframe = document.createElement("iframe");
    iframe.className = "vw-spike-frame";
    iframe.style.cssText = "width:100%;border:0;display:block;height:320px";
    iframe.srcdoc = "<!doctype html><html><head><meta charset='utf-8'></head><body style='margin:0'></body></html>";
    const loaded = new Promise((r) => iframe.addEventListener("load", r, { once: true }));
    el.appendChild(iframe);
    await loaded;
    const idoc = iframe.contentDocument;
    copyThemeVars(document, idoc);
    await loadScript(idoc, RRWEB);
    cleanup = buildContent(idoc.body, d3);
    const ro = new ResizeObserver(() => {
      iframe.style.height = idoc.documentElement.scrollHeight + "px";
    });
    ro.observe(idoc.body);
    measure.themeVarsCopied = idoc.documentElement.style.length;
    stopRecord = iframe.contentWindow.rrweb.record(opts);
  } else {
    await loadScript(document, RRWEB);
    const host = document.createElement("div");
    el.appendChild(host);
    cleanup = buildContent(host, d3);
    stopRecord = window.rrweb.record(opts);
  }

  stopBtn.addEventListener("click", () => {
    if (stopRecord) stopRecord();
    stopRecord = null;
    label.textContent = `mode=${mode}${blockSelector ? " +block" : ""} · stopped, ${events.length} events`;
    model.set("events", JSON.stringify(events));
    model.set("measure", measure);
    model.save_changes();
  });

  return () => {
    if (stopRecord) stopRecord();
    if (cleanup) cleanup();
  };
}

export default { render };
