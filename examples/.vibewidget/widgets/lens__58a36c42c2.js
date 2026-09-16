import * as d3 from "https://esm.sh/d3@7";

const FH = 18;          // focus row height
const MAXK = 250;       // max focus rows
const W_AXIS = 22;
const X_STRIP = 26;
const W_STRIP = 8;
const X_SITE = 40;
const X_COUNTRY = 86;
const TRACK_X = 134;
const HEAD_H = 24;

const INK = "#111111";
const GREY = "#777777";
const HAIR = "#d9d9d9";
const FAINT = "#f2f2f2";
const ACCENT = "#d9480f";
const BAR_DIM = "#9a9a9a";

const FONT = "system-ui, -apple-system, Inter, Helvetica, sans-serif";

const COLS = [
  { k: "enrolled", label: "enrolled" },
  { k: "screen_fail_pct", label: "screen fail %" },
  { k: "deviations", label: "deviations" },
  { k: "open_queries", label: "open queries" },
  { k: "query_age_days", label: "query age" },
  { k: "dropout_pct", label: "dropout %" },
  { k: "days_since_visit", label: "days since visit" },
];

const PALETTE = [
  "#4c6b8a", "#8a6d4c", "#4f7f5f", "#8a4c5f",
  "#665f8a", "#8a854c", "#3f7f80", "#6e6e6e",
];

const fmt = (v) => (v == null || Number.isNaN(v) ? "" : Number.isInteger(v) ? String(v) : v.toFixed(1));

function rowTop(i, f) {
  const k = f.end - f.start;
  if (i < f.start) return i;
  if (i < f.end) return f.start + (i - f.start) * FH;
  return f.start + k * FH + (i - f.end);
}

function yToRow(y, f, n) {
  const k = f.end - f.start;
  let i;
  if (y < f.start) i = Math.floor(y);
  else if (y < f.start + k * FH) i = f.start + Math.floor((y - f.start) / FH);
  else i = Math.floor(y - k * FH + k);
  return Math.max(0, Math.min(n - 1, i));
}

function normalize(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const keys = Object.keys(raw);
    if (!keys.length) return [];
    const first = raw[keys[0]];
    if (Array.isArray(first)) {
      const n = first.length;
      const out = new Array(n);
      for (let i = 0; i < n; i++) {
        const o = {};
        for (const k of keys) o[k] = raw[k][i];
        out[i] = o;
      }
      return out;
    }
  }
  return [];
}

export const CountryLegend = ({ React, items = [] }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontFamily: FONT, fontSize: 11, color: INK }}>
    {items.map((it) => (
      <span key={it.code} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 8, height: 8, background: it.color, display: "inline-block" }} />
        {it.code}
      </span>
    ))}
  </div>
);

export const TableLens = ({ model, React, height = 540 }) => {
  const [version, setVersion] = React.useState(0);
  const rows = React.useMemo(() => normalize(model.get("data")), [model, version]);

  const [sortCol, setSortCol] = React.useState("");
  const [sortDir, setSortDir] = React.useState("desc");
  const [focus, setFocus] = React.useState({ start: 0, end: 12 });
  const [hover, setHover] = React.useState(null);
  const [W, setW] = React.useState(880);

  const wrapRef = React.useRef(null);
  const scrollRef = React.useRef(null);
  const plotRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const axisRef = React.useRef(null);
  const rowsRef = React.useRef(rows);
  const focusRef = React.useRef(focus);
  const drawRef = React.useRef(null);
  const rafRef = React.useRef(0);

  // ---- input subscription -------------------------------------------------
  React.useEffect(() => {
    const h = () => setVersion((v) => v + 1);
    model.on("change:data", h);
    return () => model.off("change:data", h);
  }, [model]);

  // ---- measure -----------------------------------------------------------
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.floor(e.contentRect.width);
        if (w > 0) setW(Math.max(760, w));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- derived -----------------------------------------------------------
  const maxes = React.useMemo(() => {
    const m = {};
    for (const c of COLS) {
      let mx = 0;
      for (let i = 0; i < rows.length; i++) {
        const v = +rows[i][c.k];
        if (v > mx) mx = v;
      }
      m[c.k] = mx || 1;
    }
    return m;
  }, [rows]);

  const countries = React.useMemo(() => {
    const s = Array.from(new Set(rows.map((r) => r.country))).sort();
    const map = new Map();
    s.forEach((c, i) => map.set(c, PALETTE[i % PALETTE.length]));
    return map;
  }, [rows]);

  const sorted = React.useMemo(() => {
    if (!sortCol) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    const arr = rows.slice();
    arr.sort((a, b) => {
      const x = a[sortCol], y = b[sortCol];
      if (typeof x === "string" || typeof y === "string") {
        const sx = String(x), sy = String(y);
        return dir * (sx < sy ? -1 : sx > sy ? 1 : 0);
      }
      return dir * ((+x) - (+y));
    });
    return arr;
  }, [rows, sortCol, sortDir]);

  const trackW = (W - TRACK_X - 6) / COLS.length;

  const scheduleDraw = React.useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (drawRef.current) drawRef.current();
    });
  }, []);

  React.useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // ---- outputs -----------------------------------------------------------
  React.useEffect(() => {
    const sites = [];
    for (let i = focus.start; i < focus.end && i < sorted.length; i++) sites.push(sorted[i].site);
    model.set("focus_rows", sites);
    model.set("sort_col", sortCol || "");
    model.save_changes();
  }, [model, focus, sorted, sortCol]);

  // ---- canvas painter (depends only on data / layout) --------------------
  React.useEffect(() => {
    rowsRef.current = sorted;
    const cv = canvasRef.current;
    if (!cv) return;

    const draw = () => {
      const data = rowsRef.current;
      const n = data.length;
      const f = focusRef.current;
      if (!n) return;
      const k = Math.max(0, f.end - f.start);
      const h = n - k + k * FH;
      const dpr = W * h > 4.2e6 ? 1 : Math.min(2, window.devicePixelRatio || 1);
      const pw = Math.round(W * dpr), ph = Math.round(h * dpr);
      if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
      cv.style.width = W + "px";
      cv.style.height = h + "px";
      const ctx = cv.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, h);

      // row axis
      ctx.fillStyle = FAINT;
      ctx.fillRect(0, 0, W_AXIS, h);
      const fTop = rowTop(f.start, f);
      const fBot = fTop + k * FH;
      ctx.fillStyle = ACCENT;
      ctx.fillRect(0, fTop, W_AXIS, Math.max(2, fBot - fTop));

      // country strips, grouped by colour
      for (const [code, color] of countries) {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          if (data[i].country !== code) continue;
          const y = rowTop(i, f);
          const hh = i >= f.start && i < f.end ? FH - 1 : 1;
          ctx.rect(X_STRIP, y, W_STRIP, hh);
        }
        ctx.fill();
      }

      // bars
      for (let ci = 0; ci < COLS.length; ci++) {
        const col = COLS[ci];
        const mx = maxes[col.k];
        const x = TRACK_X + ci * trackW;
        const bw = trackW - 14;
        const isSort = sortCol === col.k;

        ctx.fillStyle = isSort ? ACCENT : BAR_DIM;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          if (i >= f.start && i < f.end) continue;
          const v = +data[i][col.k];
          const len = Math.max(0.6, (v / mx) * bw);
          ctx.rect(x, rowTop(i, f), len, 1);
        }
        ctx.fill();

        ctx.fillStyle = isSort ? ACCENT : INK;
        ctx.beginPath();
        for (let i = f.start; i < f.end && i < n; i++) {
          const v = +data[i][col.k];
          const len = Math.max(0.8, (v / mx) * bw);
          ctx.rect(x, rowTop(i, f) + 11, len, 5);
        }
        ctx.fill();
      }

      // focus row text + hairlines
      if (k > 0) {
        ctx.font = "12px " + FONT;
        ctx.textBaseline = "alphabetic";
        for (let i = f.start; i < f.end && i < n; i++) {
          const r = data[i];
          const y = rowTop(i, f);
          ctx.fillStyle = HAIR;
          ctx.fillRect(X_SITE, y + FH - 1, W - X_SITE - 6, 1);
          ctx.fillStyle = INK;
          ctx.textAlign = "left";
          ctx.fillText(String(r.site), X_SITE, y + 9);
          ctx.fillStyle = GREY;
          ctx.fillText(String(r.country), X_COUNTRY, y + 9);
          ctx.textAlign = "right";
          for (let ci = 0; ci < COLS.length; ci++) {
            const col = COLS[ci];
            ctx.fillStyle = sortCol === col.k ? ACCENT : INK;
            ctx.fillText(fmt(+r[col.k]), TRACK_X + ci * trackW + trackW - 14, y + 9);
          }
        }
        ctx.fillStyle = ACCENT;
        ctx.fillRect(0, fTop, W, 1);
        ctx.fillRect(0, fBot - 1, W, 1);
      }
    };

    drawRef.current = draw;
    draw();
    return () => { drawRef.current = null; };
  }, [sorted, W, trackW, sortCol, maxes, countries]);

  // focus commits only trigger a repaint, never a rebuild
  React.useEffect(() => {
    focusRef.current = focus;
    scheduleDraw();
  }, [focus, scheduleDraw]);

  const setRange = React.useCallback((a, b) => {
    const n = rowsRef.current.length;
    if (!n) return;
    let k = Math.max(1, Math.min(MAXK, Math.min(n, b - a)));
    const s = Math.max(0, Math.min(n - k, a));
    const cur = focusRef.current;
    if (cur.start === s && cur.end === s + k) return;
    focusRef.current = { start: s, end: s + k };
    setFocus(focusRef.current);
    scheduleDraw();
  }, [scheduleDraw]);

  const ensureVisible = React.useCallback(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const f = focusRef.current;
    const top = rowTop(f.start, f) + HEAD_H;
    const bot = top + (f.end - f.start) * FH;
    if (top - HEAD_H < sc.scrollTop) sc.scrollTop = Math.max(0, top - HEAD_H - 24);
    else if (bot > sc.scrollTop + sc.clientHeight) sc.scrollTop = bot - sc.clientHeight + 24;
  }, []);

  // ---- axis gesture ------------------------------------------------------
  React.useEffect(() => {
    const el = axisRef.current;
    if (!el) return;

    const localY = (clientY) => {
      const r = canvasRef.current.getBoundingClientRect();
      return clientY - r.top;
    };

    const zoneAt = (y, f) => {
      const k = f.end - f.start;
      const top = rowTop(f.start, f);
      const bot = top + k * FH;
      if (y >= top - 6 && y <= top + 6) return "resize-top";
      if (y >= bot - 6 && y <= bot + 6) return "resize-bot";
      if (y > top && y < bot) return "move";
      return "new";
    };

    const onDown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      el.focus();
      const n = rowsRef.current.length;
      if (!n) return;
      const base = { ...focusRef.current };
      const y0 = localY(e.clientY);
      const mode = zoneAt(y0, base);
      const anchor = yToRow(y0, base, n);
      if (mode === "new") setRange(anchor, anchor + 1);

      const onMove = (ev) => {
        const y = localY(ev.clientY);
        const row = yToRow(y, base, n);
        if (mode === "new") setRange(Math.min(anchor, row), Math.max(anchor, row) + 1);
        else if (mode === "move") {
          const d = row - anchor;
          setRange(base.start + d, base.end + d);
        } else if (mode === "resize-top") setRange(Math.min(row, base.end - 1), base.end);
        else setRange(base.start, Math.max(row + 1, base.start + 1));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    const onHover = (e) => {
      const z = zoneAt(localY(e.clientY), focusRef.current);
      el.style.cursor = z === "move" ? "grab" : z === "new" ? "crosshair" : "ns-resize";
    };

    el.addEventListener("mousedown", onDown);
    el.addEventListener("mousemove", onHover);
    return () => {
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("mousemove", onHover);
    };
  }, [setRange]);

  const onKeyDown = React.useCallback((e) => {
    const f = focusRef.current;
    const k = f.end - f.start;
    if (e.key === "ArrowDown") { e.preventDefault(); setRange(f.start + 1, f.start + 1 + k); ensureVisible(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setRange(f.start - 1, f.start - 1 + k); ensureVisible(); }
  }, [setRange, ensureVisible]);

  // ---- hover tooltip -----------------------------------------------------
  const onPlotMove = React.useCallback((e) => {
    const cv = canvasRef.current, wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const data = rowsRef.current;
    if (!data.length || x < W_AXIS) { setHover(null); return; }
    const f = focusRef.current;
    const idx = yToRow(y, f, data.length);
    if (idx >= f.start && idx < f.end) { setHover(null); return; }
    const wr = wrap.getBoundingClientRect();
    setHover({
      idx,
      rec: data[idx],
      lineY: rowTop(idx, f),
      tx: Math.min(e.clientX - wr.left + 14, wr.width - 210),
      ty: Math.min(Math.max(e.clientY - wr.top - 10, 4), Math.max(4, wr.height - 190)),
    });
  }, []);

  const onSort = (key) => {
    if (sortCol === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortCol(key); setSortDir("desc"); }
  };

  const headCell = (key, label, left, width, align) => {
    const active = sortCol === key;
    return (
      <div
        key={key}
        onClick={() => onSort(key)}
        title=""
        style={{
          position: "absolute", left, width, top: 0, height: HEAD_H,
          display: "flex", alignItems: "center", justifyContent: align === "right" ? "flex-end" : "flex-start",
          gap: 4, fontFamily: FONT, fontSize: 11, lineHeight: "11px",
          color: active ? ACCENT : INK, fontWeight: active ? 600 : 400,
          cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", overflow: "hidden",
        }}
      >
        <span>{label}</span>
        <span style={{ fontSize: 10 }}>{active ? (sortDir === "desc" ? "↓" : "↑") : ""}</span>
      </div>
    );
  };

  const legendItems = React.useMemo(
    () => Array.from(countries, ([code, color]) => ({ code, color })),
    [countries]
  );

  const shown = Math.min(focus.end, sorted.length);
  const n = sorted.length;

  return (
    <div ref={wrapRef} style={{ position: "relative", padding: 12, background: "#ffffff", fontFamily: FONT, color: INK }}>
      <div
        ref={scrollRef}
        style={{ height, overflow: "auto", position: "relative", borderTop: `1px solid ${HAIR}`, borderBottom: `1px solid ${HAIR}` }}
      >
        <div style={{ width: W, position: "relative" }}>
          <div
            style={{
              position: "sticky", top: 0, zIndex: 3, height: HEAD_H, width: W,
              background: "#ffffff", borderBottom: `1px solid ${HAIR}`,
            }}
          >
            {headCell("site", "site", X_SITE, 44, "left")}
            {headCell("country", "country", X_COUNTRY, 44, "left")}
            {COLS.map((c, i) =>
              headCell(c.k, c.label, TRACK_X + i * trackW, trackW - 12, "left")
            )}
          </div>

          <div ref={plotRef} style={{ position: "relative" }} onMouseMove={onPlotMove} onMouseLeave={() => setHover(null)}>
            <canvas ref={canvasRef} style={{ display: "block" }} />
            <div
              ref={axisRef}
              tabIndex={0}
              onKeyDown={onKeyDown}
              style={{
                position: "absolute", left: 0, top: 0, bottom: 0, width: W_AXIS,
                zIndex: 2, outline: "none", cursor: "crosshair",
              }}
            />
            {hover && (
              <div
                style={{
                  position: "absolute", left: W_AXIS, top: hover.lineY, width: W - W_AXIS,
                  height: 1, background: ACCENT, pointerEvents: "none", zIndex: 1,
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 8 }}>
        <div style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: INK }}>
          {n ? `rows ${focus.start + 1}–${shown} of ${n}` : "no rows"}
          {sortCol ? ` · ${sortCol} ${sortDir}` : ""}
        </div>
        <CountryLegend React={React} items={legendItems} />
      </div>

      {hover && (
        <div
          style={{
            position: "absolute", left: hover.tx, top: hover.ty, zIndex: 10,
            background: "#ffffff", border: `1px solid ${HAIR}`, padding: "6px 8px",
            pointerEvents: "none", fontSize: 11, minWidth: 176,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{hover.rec.site}</span>
            <span style={{ color: GREY }}>{hover.rec.country}</span>
          </div>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <tbody>
              {COLS.map((c) => (
                <tr key={c.k}>
                  <td style={{ padding: "1px 0", color: GREY, whiteSpace: "nowrap" }}>{c.label}</td>
                  <td
                    style={{
                      padding: "1px 0", textAlign: "right", color: INK,
                      fontVariantNumeric: "tabular-nums", paddingLeft: 12,
                    }}
                  >
                    {fmt(+hover.rec[c.k])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default function Widget({ model, React }) {
  return <TableLens model={model} React={React} height={540} />;
}