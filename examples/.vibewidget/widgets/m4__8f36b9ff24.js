import * as d3 from "https://esm.sh/d3@7";

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const DAY_IX = { Mo: 0, Tu: 1, We: 2, Th: 3, Fr: 4, Sa: 5, Su: 6 };
const INK = "#1f2430";
const MUTED = "#6b7280";
const FAINT = "#e4e4e1";
const ACCENT = "#b45309";
const GOOD = "#177245";
const BAD = "#a4232b";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const DWELL = 10;
const MODES = ["walk", "bike", "drive"];

function fmtHHMM(mins) {
  const m = (((Math.round(mins) % 1440) + 1440) % 1440);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function toRows(d) {
  if (!d) return [];
  if (Array.isArray(d)) return d;
  if (typeof d === "object") {
    const keys = Object.keys(d);
    if (!keys.length) return [];
    const first = d[keys[0]];
    if (Array.isArray(first)) {
      const out = [];
      for (let i = 0; i < first.length; i++) {
        const o = {};
        keys.forEach((k) => { o[k] = Array.isArray(d[k]) ? d[k][i] : undefined; });
        out.push(o);
      }
      return out;
    }
  }
  return [];
}

function parseDaySpec(spec) {
  const set = new Set();
  spec.split(",").forEach((tok) => {
    const t = tok.trim();
    if (!t) return;
    const rng = t.match(/^([A-Za-z]{2})\s*-\s*([A-Za-z]{2})$/);
    if (rng) {
      const a = DAY_IX[rng[1].slice(0, 1).toUpperCase() + rng[1].slice(1, 2).toLowerCase()];
      const b = DAY_IX[rng[2].slice(0, 1).toUpperCase() + rng[2].slice(1, 2).toLowerCase()];
      if (a == null || b == null) return;
      let i = a;
      for (let n = 0; n < 7; n++) { set.add(i); if (i === b) break; i = (i + 1) % 7; }
      return;
    }
    const one = DAY_IX[t.slice(0, 1).toUpperCase() + t.slice(1, 2).toLowerCase()];
    if (one != null) set.add(one);
  });
  return set;
}

function openState(hours, dayIdx, mins) {
  if (!hours || typeof hours !== "string") return "hours?";
  const h = hours.trim();
  if (!h) return "hours?";
  if (/24\s*\/\s*7/.test(h)) return "open";
  const at = (((Math.round(mins) % 1440) + 1440) % 1440);
  let parsedAny = false;
  for (const segRaw of h.split(";")) {
    const seg = segRaw.trim();
    if (!seg) continue;
    if (/off|closed/i.test(seg)) { parsedAny = true; continue; }
    const m = seg.match(/^([A-Za-z,\-\s]+?)?\s*((?:\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})(?:\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*)$/);
    if (!m) continue;
    const dayPart = (m[1] || "").trim();
    const days = dayPart ? parseDaySpec(dayPart) : new Set([0, 1, 2, 3, 4, 5, 6]);
    if (!days.size) continue;
    parsedAny = true;
    if (!days.has(dayIdx)) continue;
    for (const rngRaw of m[2].split(",")) {
      const mm = rngRaw.trim().match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
      if (!mm) continue;
      const a = +mm[1] * 60 + +mm[2];
      const b = +mm[3] * 60 + +mm[4];
      if (b <= a) { if (at >= a || at < b) return "open"; }
      else if (at >= a && at < b) return "open";
    }
  }
  return parsedAny ? "closed" : "hours?";
}

export const ModeSwitch = ({ React, mode, onChange, label = "mode" }) => {
  const ref = React.useRef(null);
  const key = (e) => {
    const i = MODES.indexOf(mode);
    let n = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = MODES[(i + 1) % 3];
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = MODES[(i + 2) % 3];
    if (!n) return;
    e.preventDefault();
    onChange && onChange(n);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <span style={{ fontFamily: SANS, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>{label}</span>
      <div
        ref={ref}
        role="radiogroup"
        tabIndex={0}
        onKeyDown={key}
        style={{ display: "inline-flex", border: `1px solid ${FAINT}`, borderRadius: 3, overflow: "hidden", outline: "none" }}
      >
        {MODES.map((m, i) => {
          const on = m === mode;
          return (
            <button
              key={m}
              role="radio"
              aria-checked={on}
              onClick={() => { if (ref.current) ref.current.focus(); onChange && onChange(m); }}
              style={{
                font: `${on ? 600 : 400} 12.5px ${SANS}`,
                padding: "5px 14px",
                background: on ? INK : "#fff",
                color: on ? "#fff" : INK,
                border: "none",
                borderLeft: i === 0 ? "none" : `1px solid ${FAINT}`,
                cursor: "pointer",
              }}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const DayRow = ({ React, day, onChange }) => (
  <div style={{ display: "flex", gap: 4, marginTop: 8, justifyContent: "center" }}>
    {DAYS.map((d, i) => {
      const on = i === day;
      return (
        <button
          key={d}
          onClick={() => onChange && onChange(i)}
          aria-pressed={on}
          style={{
            font: `${on ? 600 : 400} 11.5px ${MONO}`,
            width: 30,
            padding: "3px 0",
            background: on ? "#f1efe9" : "#fff",
            color: on ? INK : MUTED,
            border: `1px solid ${on ? INK : FAINT}`,
            borderRadius: 2,
            cursor: "pointer",
          }}
        >
          {d}
        </button>
      );
    })}
  </div>
);

export const VerdictLines = ({ React, leaveMin, targetName, thereMin, dwellMin, backTripMin, openLabel, backByMin }) => {
  const arrive = leaveMin + (thereMin || 0);
  const back = arrive + (dwellMin || 0) + (backTripMin || 0);
  const diff = Math.round((backByMin || 0) - back);
  const ok = diff >= 0;
  const line1 = `${fmtHHMM(leaveMin)} → ${String(targetName || "—").toLowerCase()} ${fmtHHMM(arrive)}, ${openLabel} · ${dwellMin} min · back ${fmtHHMM(back)}`;
  const line2 = `${Math.abs(diff)} min ${ok ? "before" : "after"} ${fmtHHMM(backByMin)}`;
  return (
    <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 12.5, lineHeight: 1.55, color: INK, whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>
      <div>{line1}</div>
      <div style={{ color: ok ? GOOD : BAD, fontWeight: 600 }}>{line2}</div>
    </div>
  );
};

export const DialClock = ({ React, leaveMin, backByMin, thereMin, dwellMin, backTripMin, onChange, size = 296 }) => {
  const hostRef = React.useRef(null);
  const L = React.useRef(null);
  const vals = React.useRef({});
  const [tick, setTick] = React.useState(0);
  vals.current = { leaveMin, backByMin, thereMin, dwellMin, backTripMin, onChange };

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return () => {};
    const cx = size / 2, cy = size / 2, R = size / 2 - 32;
    const angle = (t) => (t / 1440) * 2 * Math.PI;
    const posAt = (t, r) => {
      const a = angle(t) - Math.PI / 2;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };
    const svg = d3.select(host).append("svg").attr("width", size).attr("height", size).style("display", "block");
    const g = svg.append("g");

    g.append("circle").attr("cx", cx).attr("cy", cy).attr("r", R)
      .attr("fill", "none").attr("stroke", FAINT).attr("stroke-width", 1);

    for (let hh = 0; hh < 24; hh++) {
      const major = hh % 6 === 0;
      const p1 = posAt(hh * 60, R - (major ? 7 : 3));
      const p2 = posAt(hh * 60, R);
      g.append("line").attr("x1", p1[0]).attr("y1", p1[1]).attr("x2", p2[0]).attr("y2", p2[1])
        .attr("stroke", major ? MUTED : FAINT).attr("stroke-width", major ? 1 : 0.8);
      if (major) {
        const lp = posAt(hh * 60, R + 13);
        g.append("text").attr("x", lp[0]).attr("y", lp[1]).attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle").attr("font-family", MONO).attr("font-size", 9.5)
          .attr("fill", MUTED).text(String(hh).padStart(2, "0"));
      }
    }

    const arcGen = d3.arc().innerRadius(R - 19).outerRadius(R - 8);
    const tripArc = g.append("path").attr("transform", `translate(${cx},${cy})`)
      .attr("fill", ACCENT).attr("fill-opacity", 0.17).attr("stroke", ACCENT)
      .attr("stroke-opacity", 0.5).attr("stroke-width", 0.8).attr("pointer-events", "none");

    const arrTick = g.append("line").attr("stroke", ACCENT).attr("stroke-width", 1.4).attr("pointer-events", "none");
    const arrLbl = g.append("text").attr("font-family", MONO).attr("font-size", 9.5).attr("fill", ACCENT)
      .attr("text-anchor", "middle").attr("dominant-baseline", "middle").attr("pointer-events", "none");

    const backTick = g.append("circle").attr("r", 4.2).attr("fill", "none")
      .attr("stroke", ACCENT).attr("stroke-width", 1.6).attr("pointer-events", "none");

    const centerTxt = g.append("text").attr("x", cx).attr("y", cy - 4).attr("text-anchor", "middle")
      .attr("font-family", MONO).attr("font-size", 13).attr("fill", INK);
    g.append("text").attr("x", cx).attr("y", cy + 12).attr("text-anchor", "middle")
      .attr("font-family", SANS).attr("font-size", 9.5).attr("letter-spacing", ".09em")
      .attr("fill", MUTED).text("LEAVE → BACK");

    const mkHandle = (shape) => {
      const h = g.append("g").attr("tabindex", 0).style("cursor", "grab").style("outline", "none");
      h.append("circle").attr("r", 14).attr("fill", "transparent");
      if (shape === "leave") {
        h.append("circle").attr("r", 5.5).attr("fill", INK).attr("stroke", "#fff").attr("stroke-width", 1.2);
      } else {
        h.append("rect").attr("x", -4.6).attr("y", -4.6).attr("width", 9.2).attr("height", 9.2)
          .attr("transform", "rotate(45)").attr("fill", "#fff").attr("stroke", INK).attr("stroke-width", 1.6);
      }
      return h;
    };
    const leaveH = mkHandle("leave");
    const backByH = mkHandle("backby");
    const leaveLbl = g.append("text").attr("font-family", SANS).attr("font-size", 9.5).attr("fill", INK)
      .attr("text-anchor", "middle").attr("dominant-baseline", "middle").text("leave");
    const backByLbl = g.append("text").attr("font-family", SANS).attr("font-size", 9.5).attr("fill", INK)
      .attr("text-anchor", "middle").attr("dominant-baseline", "middle").text("back by");

    function draw(lv, bb) {
      const v = vals.current;
      const there = +v.thereMin || 0, dw = +v.dwellMin || 0, bt = +v.backTripMin || 0;
      const arrive = lv + there;
      const back = arrive + dw + bt;
      const span = Math.min(2 * Math.PI, Math.max(0.004, ((back - lv) / 1440) * 2 * Math.PI));
      tripArc.attr("d", arcGen({ startAngle: angle(lv), endAngle: angle(lv) + span }));
      const a1 = posAt(arrive, R - 24), a2 = posAt(arrive, R - 4);
      arrTick.attr("x1", a1[0]).attr("y1", a1[1]).attr("x2", a2[0]).attr("y2", a2[1]);
      const al = posAt(arrive, R - 36);
      arrLbl.attr("x", al[0]).attr("y", al[1]).text(fmtHHMM(arrive));
      const bp = posAt(back, R);
      backTick.attr("cx", bp[0]).attr("cy", bp[1]);
      const lp = posAt(lv, R), bbp = posAt(bb, R);
      leaveH.attr("transform", `translate(${lp[0]},${lp[1]})`);
      backByH.attr("transform", `translate(${bbp[0]},${bbp[1]})`);
      const ll = posAt(lv, R + 24), bl = posAt(bb, R + 24);
      leaveLbl.attr("x", ll[0]).attr("y", ll[1]);
      backByLbl.attr("x", bl[0]).attr("y", bl[1]);
      centerTxt.text(`${fmtHHMM(lv)} → ${fmtHHMM(back)}`);
    }

    const minsFrom = (ev) => {
      const [mx, my] = d3.pointer(ev, g.node());
      let a = Math.atan2(mx - cx, cy - my);
      let t = (a / (2 * Math.PI)) * 1440;
      if (t < 0) t += 1440;
      return ((Math.round(t / 5) * 5) % 1440 + 1440) % 1440;
    };

    const bind = (sel, kind) => {
      sel.call(
        d3.drag()
          .on("start", function () { const n = sel.node(); if (n && n.focus) n.focus(); })
          .on("drag", function (ev) {
            const t = minsFrom(ev);
            const v = vals.current;
            if (kind === "leave") draw(t, v.backByMin); else draw(v.leaveMin, t);
            if (v.onChange) v.onChange(kind, t);
          })
      );
      sel.on("keydown", function (ev) {
        let d = 0;
        if (ev.key === "ArrowRight" || ev.key === "ArrowUp") d = 5;
        if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") d = -5;
        if (ev.key === "PageUp") d = 30;
        if (ev.key === "PageDown") d = -30;
        if (!d) return;
        ev.preventDefault();
        const v = vals.current;
        const cur = kind === "leave" ? v.leaveMin : v.backByMin;
        const t = ((Math.round((cur + d) / 5) * 5) % 1440 + 1440) % 1440;
        if (kind === "leave") draw(t, v.backByMin); else draw(v.leaveMin, t);
        if (v.onChange) v.onChange(kind, t);
      });
    };
    bind(leaveH, "leave");
    bind(backByH, "backBy");

    L.current = { draw };
    draw(vals.current.leaveMin, vals.current.backByMin);
    setTick((t) => t + 1);
    return () => { svg.remove(); L.current = null; };
  }, [size]);

  React.useEffect(() => {
    if (L.current) L.current.draw(leaveMin, backByMin);
    return () => {};
  }, [leaveMin, backByMin, thereMin, dwellMin, backTripMin, tick]);

  return <div ref={hostRef} style={{ width: size, height: size, margin: "0 auto" }} />;
};

export const RegionTable = ({ React, rows, mode, onClear, onTarget, targetIdx }) => (
  <div style={{ marginTop: 14 }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
      <span style={{ fontFamily: SANS, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>
        lasso regions · {rows.length} shops
      </span>
      <button
        onClick={() => onClear && onClear()}
        style={{ font: `400 11.5px ${SANS}`, background: "#fff", color: INK, border: `1px solid ${FAINT}`, borderRadius: 2, padding: "2px 8px", cursor: "pointer" }}
      >
        clear
      </button>
    </div>
    {rows.length === 0 ? (
      <div style={{ fontFamily: SANS, fontSize: 12, color: MUTED }}>
        turn on lasso, then drag a loop on the map to collect shops.
      </div>
    ) : (
      <div style={{ maxHeight: 190, overflowY: "auto", border: `1px solid ${FAINT}` }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontFamily: MONO, fontSize: 11.5, color: INK }}>
          <thead>
            <tr style={{ textAlign: "left", color: MUTED, fontFamily: SANS, fontSize: 10.5, letterSpacing: ".06em" }}>
              <th style={{ padding: "4px 8px", fontWeight: 500 }}>#</th>
              <th style={{ padding: "4px 8px", fontWeight: 500 }}>SHOP</th>
              <th style={{ padding: "4px 8px", fontWeight: 500 }}>{mode.toUpperCase()}</th>
              <th style={{ padding: "4px 8px", fontWeight: 500 }}>ARRIVE</th>
              <th style={{ padding: "4px 8px", fontWeight: 500 }}>BACK</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.i}
                onClick={() => onTarget && onTarget(r.i)}
                style={{ borderTop: `1px solid ${FAINT}`, cursor: "pointer", background: r.i === targetIdx ? "#f6f2ea" : "transparent" }}
              >
                <td style={{ padding: "3px 8px", color: MUTED }}>{r.region}</td>
                <td style={{ padding: "3px 8px", whiteSpace: "normal", overflowWrap: "anywhere" }}>{String(r.name).toLowerCase()}</td>
                <td style={{ padding: "3px 8px" }}>{r.there} min</td>
                <td style={{ padding: "3px 8px" }}>{fmtHHMM(r.arrive)}</td>
                <td style={{ padding: "3px 8px", color: r.fits ? GOOD : BAD }}>{fmtHHMM(r.back)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export const ReachMap = ({
  React, model, mode, rows, hotel, targetIdx, onTarget, leaveMin, backByMin, dwellMin,
  radiusKm, onRadius, regions, onAddRegion, lassoActive, height = 452, inputTick = 0,
}) => {
  const hostRef = React.useRef(null);
  const L = React.useRef(null);
  const radRef = React.useRef(radiusKm);
  const cbRef = React.useRef({});
  const [w, setW] = React.useState(660);
  const [tick, setTick] = React.useState(0);
  radRef.current = radiusKm;
  cbRef.current = { onRadius, onAddRegion, onTarget };

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return () => {};
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0] && entries[0].contentRect ? entries[0].contentRect.width : 0;
      if (cw > 200) setW(Math.max(420, Math.min(900, Math.round(cw))));
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || !rows.length) return () => {};
    const reachAll = model.get("reach") || {};
    const bands = reachAll[mode];
    const coords = rows.map((d) => [+d.lon, +d.lat]).concat([[hotel[1], hotel[0]]]);
    const projection = d3.geoMercator().fitExtent([[30, 26], [w - 30, height - 26]], { type: "MultiPoint", coordinates: coords });
    const geoPath = d3.geoPath(projection);

    const svg = d3.select(host).append("svg").attr("width", w).attr("height", height).style("display", "block");
    svg.append("rect").attr("width", w).attr("height", height).attr("fill", "#fff");
    const g = svg.append("g");
    const gBands = g.append("g");
    const gRoute = g.append("g");
    const gCircle = g.append("g");
    const gLasso = g.append("g");
    const gPts = g.append("g");
    const gHotel = g.append("g");
    const gRouteLbl = g.append("g");
    const overlay = g.append("rect").attr("width", w).attr("height", height).attr("fill", "transparent").style("pointer-events", "none");

    const feats = bands && Array.isArray(bands.features) ? bands.features.slice() : [];
    feats.sort((a, b) => ((b.properties && b.properties.contour) || 0) - ((a.properties && a.properties.contour) || 0));
    gBands.selectAll("path").data(feats).join("path")
      .attr("d", geoPath)
      .attr("fill", (d) => (d.properties && (d.properties.fillColor || d.properties.fill)) || "#9aa1ad")
      .attr("fill-opacity", 0.13)
      .attr("stroke", (d) => (d.properties && d.properties.color) || "#9aa1ad")
      .attr("stroke-opacity", 0.4).attr("stroke-width", 0.7)
      .attr("pointer-events", "none");
    if (feats.length) {
      const cs = feats.map((f) => (f.properties && f.properties.contour) || 0).filter((c) => c).sort((a, b) => a - b);
      gBands.append("text").attr("x", 12).attr("y", height - 12)
        .attr("font-family", SANS).attr("font-size", 10.5).attr("fill", MUTED)
        .text(`${mode} reach · ${cs.join(" / ")} min`);
    }

    const hxy = projection([hotel[1], hotel[0]]);
    const hx = hxy[0], hy = hxy[1];
    const dLon = 1 / (111.32 * Math.cos((hotel[0] * Math.PI) / 180));
    const p2 = projection([hotel[1] + dLon, hotel[0]]);
    const pxPerKm = Math.max(0.5, Math.hypot(p2[0] - hx, p2[1] - hy));

    const circle = gCircle.append("circle").attr("cx", hx).attr("cy", hy).attr("fill", "none")
      .attr("stroke", INK).attr("stroke-opacity", 0.55).attr("stroke-width", 1).attr("stroke-dasharray", "3 3")
      .attr("pointer-events", "none");
    const countLine = gCircle.append("line").attr("x1", hx).attr("y1", hy).attr("stroke", INK)
      .attr("stroke-opacity", 0.5).attr("stroke-width", 1).attr("pointer-events", "none");
    const countLbl = gCircle.append("text").attr("text-anchor", "middle").attr("font-family", MONO)
      .attr("font-size", 10.5).attr("fill", INK).attr("paint-order", "stroke").attr("stroke", "#fff")
      .attr("stroke-width", 3).attr("stroke-linejoin", "round").attr("pointer-events", "none");
    const handle = gCircle.append("g").attr("tabindex", 0).style("cursor", "ew-resize").style("outline", "none");
    handle.append("circle").attr("r", 13).attr("fill", "transparent");
    handle.append("circle").attr("r", 5).attr("fill", "#fff").attr("stroke", INK).attr("stroke-width", 1.4);

    function drawCircle(km) {
      const r = Math.max(8, pxPerKm * km);
      circle.attr("r", r);
      countLine.attr("x2", hx + r).attr("y2", hy);
      handle.attr("transform", `translate(${hx + r},${hy})`);
      const n = rows.filter((d) => +d.km_from_hotel <= km).length;
      countLbl.attr("x", hx + r / 2).attr("y", hy - 7).text(`${n} of ${rows.length} ≤ ${km.toFixed(1)} km`);
    }

    handle.call(
      d3.drag()
        .on("start", function () { const n = handle.node(); if (n && n.focus) n.focus(); })
        .on("drag", function (ev) {
          const [mx, my] = d3.pointer(ev, g.node());
          const km = Math.max(0.3, Math.min(30, Math.hypot(mx - hx, my - hy) / pxPerKm));
          radRef.current = km;
          drawCircle(km);
        })
        .on("end", function () { if (cbRef.current.onRadius) cbRef.current.onRadius(radRef.current); })
    );
    handle.on("keydown", function (ev) {
      let d = 0;
      if (ev.key === "ArrowRight" || ev.key === "ArrowUp") d = 0.25;
      if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") d = -0.25;
      if (!d) return;
      ev.preventDefault();
      const km = Math.max(0.3, Math.min(30, radRef.current + d));
      radRef.current = km;
      drawCircle(km);
      if (cbRef.current.onRadius) cbRef.current.onRadius(km);
    });

    const node = gPts.selectAll("g.shop").data(rows.map((d, i) => ({ d, i })), (o) => o.d.osm_id).join("g")
      .attr("class", "shop")
      .attr("transform", (o) => { const p = projection([+o.d.lon, +o.d.lat]); return `translate(${p[0]},${p[1]})`; })
      .style("cursor", "pointer")
      .on("click", (ev, o) => { if (cbRef.current.onTarget) cbRef.current.onTarget(o.i); });
    node.append("circle").attr("class", "hit").attr("r", 9).attr("fill", "transparent");
    node.append("circle").attr("class", "rsel").attr("r", 6.5).attr("fill", "none").attr("stroke", MUTED).attr("stroke-width", 1).attr("opacity", 0);
    node.append("circle").attr("class", "dot").attr("r", 3)
      .attr("fill", (o) => (o.d.kolache ? ACCENT : "#4b5563")).attr("stroke", "#fff").attr("stroke-width", 0.8);
    node.append("circle").attr("class", "ring").attr("r", 8.5).attr("fill", "none").attr("stroke", ACCENT).attr("stroke-width", 1.5).attr("opacity", 0);
    node.append("text").attr("class", "alab").attr("x", 7).attr("y", -6).attr("font-family", MONO)
      .attr("font-size", 9.5).attr("fill", INK).attr("paint-order", "stroke").attr("stroke", "#fff")
      .attr("stroke-width", 2.6).attr("stroke-linejoin", "round").attr("pointer-events", "none");
    node.append("text").attr("class", "nlab").attr("x", 7).attr("y", 12).attr("font-family", SANS)
      .attr("font-size", 10.5).attr("font-weight", 600).attr("fill", INK).attr("paint-order", "stroke")
      .attr("stroke", "#fff").attr("stroke-width", 3).attr("stroke-linejoin", "round").attr("pointer-events", "none");

    gHotel.append("rect").attr("x", hx - 4).attr("y", hy - 4).attr("width", 8).attr("height", 8)
      .attr("fill", "#fff").attr("stroke", INK).attr("stroke-width", 1.6);
    gHotel.append("text").attr("x", hx).attr("y", hy + 16).attr("text-anchor", "middle")
      .attr("font-family", SANS).attr("font-size", 10).attr("fill", INK).attr("paint-order", "stroke")
      .attr("stroke", "#fff").attr("stroke-width", 3).attr("stroke-linejoin", "round").text("hotel");

    let tmp = null;
    let lpts = [];
    overlay.call(
      d3.drag()
        .on("start", function (ev) {
          lpts = [d3.pointer(ev, g.node())];
          tmp = gLasso.append("path").attr("fill", ACCENT).attr("fill-opacity", 0.06)
            .attr("stroke", INK).attr("stroke-width", 1).attr("stroke-dasharray", "2 3");
        })
        .on("drag", function (ev) {
          lpts.push(d3.pointer(ev, g.node()));
          if (tmp) tmp.attr("d", "M" + lpts.map((p) => `${p[0]},${p[1]}`).join("L") + "Z");
        })
        .on("end", function () {
          if (tmp) { tmp.remove(); tmp = null; }
          if (lpts.length < 4) { lpts = []; return; }
          const ids = rows.filter((d) => d3.polygonContains(lpts, projection([+d.lon, +d.lat]))).map((d) => d.osm_id);
          const lonlat = lpts.map((p) => projection.invert(p));
          lpts = [];
          if (cbRef.current.onAddRegion) cbRef.current.onAddRegion({ id: `${Date.now()}-${Math.random()}`, pts: lonlat, ids });
        })
    );

    L.current = { svg, g, gRoute, gRouteLbl, gLasso, gPts, overlay, projection, drawCircle, hxy: [hx, hy], pxPerKm };
    drawCircle(radRef.current);
    setTick((t) => t + 1);
    return () => { svg.remove(); L.current = null; };
  }, [rows, mode, w, height, inputTick, hotel]);

  React.useEffect(() => {
    if (L.current) L.current.drawCircle(radiusKm);
    return () => {};
  }, [radiusKm, tick]);

  React.useEffect(() => {
    const Lc = L.current;
    if (!Lc) return () => {};
    Lc.overlay.style("pointer-events", lassoActive ? "all" : "none").style("cursor", lassoActive ? "crosshair" : "default");
    return () => {};
  }, [lassoActive, tick]);

  React.useEffect(() => {
    const Lc = L.current;
    if (!Lc) return () => {};
    const mk = `${mode}_min`, bk = `${mode}_back`;
    Lc.gPts.selectAll("g.shop").each(function (o) {
      const s = d3.select(this);
      const there = +o.d[mk], bt = +o.d[bk];
      const backAt = leaveMin + (isFinite(there) ? there : 0) + dwellMin + (isFinite(bt) ? bt : 0);
      const fits = backAt <= backByMin;
      const isT = o.i === targetIdx;
      s.attr("opacity", fits ? 1 : 0.35);
      s.select("circle.ring").attr("opacity", isT ? 1 : 0);
      s.select("circle.dot").attr("r", isT ? 4.5 : 3);
      const show = isT || +o.d.km_from_hotel <= radiusKm;
      s.select("text.alab").text(show && isFinite(there) ? fmtHHMM(leaveMin + there) : "").attr("font-weight", isT ? 700 : 400);
      s.select("text.nlab").text(isT ? String(o.d.name) : "");
      if (isT) s.raise();
    });
    return () => {};
  }, [mode, leaveMin, backByMin, dwellMin, targetIdx, radiusKm, tick]);

  React.useEffect(() => {
    const Lc = L.current;
    if (!Lc) return () => {};
    const ids = new Set();
    regions.forEach((r) => (r.ids || []).forEach((i) => ids.add(i)));
    Lc.gLasso.selectAll("path.region").data(regions, (d) => d.id).join(
      (enter) => enter.append("path").attr("class", "region"),
      (update) => update,
      (exit) => exit.remove()
    )
      .attr("d", (r) => "M" + r.pts.map((p) => { const q = Lc.projection(p); return `${q[0]},${q[1]}`; }).join("L") + "Z")
      .attr("fill", ACCENT).attr("fill-opacity", 0.05).attr("stroke", MUTED)
      .attr("stroke-width", 1).attr("stroke-dasharray", "2 3").attr("pointer-events", "none");
    Lc.gPts.selectAll("g.shop").each(function (o) {
      d3.select(this).select("circle.rsel").attr("opacity", ids.has(o.d.osm_id) ? 1 : 0);
    });
    return () => {};
  }, [regions, tick]);

  React.useEffect(() => {
    const Lc = L.current;
    if (!Lc) return () => {};
    Lc.gRoute.selectAll("*").remove();
    Lc.gRouteLbl.selectAll("*").remove();
    const routesAll = model.get("routes") || {};
    const list = routesAll[mode] || [];
    const arr = list[targetIdx];
    const tRow = rows[targetIdx];
    if (!Array.isArray(arr) || arr.length < 2 || !tRow) return () => {};
    const pts = arr.map((p) => Lc.projection([+p[1], +p[0]])).filter((p) => p && isFinite(p[0]) && isFinite(p[1]));
    if (pts.length < 2) return () => {};
    const line = d3.line().x((p) => p[0]).y((p) => p[1])(pts);
    Lc.gRoute.append("path").attr("d", line).attr("fill", "none").attr("stroke", "#fff")
      .attr("stroke-width", 4).attr("stroke-opacity", 0.85).attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round").attr("pointer-events", "none");
    Lc.gRoute.append("path").attr("d", line).attr("fill", "none").attr("stroke", ACCENT)
      .attr("stroke-width", 2).attr("stroke-linejoin", "round").attr("stroke-linecap", "round")
      .attr("pointer-events", "none");

    let total = 0;
    const segs = [];
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      segs.push(d);
      total += d;
    }
    let acc = 0, idx = 0, frac = 0;
    for (let i = 0; i < segs.length; i++) {
      if (acc + segs[i] >= total / 2) { idx = i; frac = segs[i] ? (total / 2 - acc) / segs[i] : 0; break; }
      acc += segs[i];
    }
    const a = pts[idx], b = pts[idx + 1] || pts[idx];
    const mid = [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    let nx = -ty, ny = tx;
    const off = 17;
    let lx = mid[0] + nx * off, ly = mid[1] + ny * off;
    const hxy = Lc.hxy;
    if (Math.hypot(lx - hxy[0], ly - hxy[1]) < 36) { lx = mid[0] - nx * off; ly = mid[1] - ny * off; }
    lx = Math.max(34, Math.min(w - 34, lx));
    ly = Math.max(16, Math.min(height - 16, ly));

    const minsThere = +tRow[`${mode}_min`];
    const txt = Lc.gRouteLbl.append("text").attr("x", lx).attr("y", ly).attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle").attr("font-family", MONO).attr("font-size", 10.5)
      .attr("fill", INK).attr("pointer-events", "none")
      .text(`${isFinite(minsThere) ? minsThere : "?"} min`);
    const bb = txt.node().getBBox();
    Lc.gRouteLbl.insert("rect", "text")
      .attr("x", bb.x - 4).attr("y", bb.y - 2.5).attr("width", bb.width + 8).attr("height", bb.height + 5)
      .attr("rx", 2).attr("fill", "#fff").attr("fill-opacity", 0.93)
      .attr("stroke", FAINT).attr("stroke-width", 1).attr("pointer-events", "none");
    return () => {};
  }, [mode, targetIdx, rows, tick, inputTick]);

  return <div ref={hostRef} style={{ width: "100%", minHeight: height, border: `1px solid ${FAINT}` }} />;
};

export default function Widget({ model, React }) {
  const [inputTick, setInputTick] = React.useState(0);
  const [mode, setMode] = React.useState("bike");
  const [leaveMin, setLeaveMin] = React.useState(390);
  const [backByMin, setBackByMin] = React.useState(480);
  const [day, setDay] = React.useState(5);
  const [radiusKm, setRadiusKm] = React.useState(5);
  const [regions, setRegions] = React.useState([]);
  const [lassoActive, setLassoActive] = React.useState(false);
  const [targetIdx, setTargetIdx] = React.useState(0);

  React.useEffect(() => {
    const h = () => setInputTick((t) => t + 1);
    model.on("change:data", h);
    model.on("change:reach", h);
    model.on("change:routes", h);
    return () => {
      model.off("change:data", h);
      model.off("change:reach", h);
      model.off("change:routes", h);
    };
  }, [model]);

  const rows = React.useMemo(() => toRows(model.get("data")), [model, inputTick]);

  const hotel = React.useMemo(() => {
    const R = model.get("routes") || {};
    for (const k of ["bike", "walk", "drive"]) {
      const list = R[k];
      if (Array.isArray(list)) {
        for (const r of list) {
          if (Array.isArray(r) && r.length && Array.isArray(r[0])) return [+r[0][0], +r[0][1]];
        }
      }
    }
    return [29.75179, -95.35712];
  }, [model, inputTick]);

  const defaultTarget = React.useMemo(() => {
    const i = rows.findIndex((r) => /christy/i.test(String(r.name || "")));
    return i >= 0 ? i : 0;
  }, [rows]);

  React.useEffect(() => {
    setTargetIdx(defaultTarget);
    return () => {};
  }, [defaultTarget]);

  const target = rows[targetIdx] || null;
  const thereMin = target ? +target[`${mode}_min`] || 0 : 0;
  const backTripMin = target ? +target[`${mode}_back`] || 0 : 0;
  const arriveMin = leaveMin + thereMin;
  const backMin = arriveMin + DWELL + backTripMin;
  const makesIt = backMin <= backByMin;
  const openLabel = target ? openState(target.hours, day, arriveMin) : "hours?";

  React.useEffect(() => {
    model.set("mode", mode);
    model.set("back_hhmm", fmtHHMM(backMin));
    model.set("makes_it", !!makesIt);
    model.save_changes();
    return () => {};
  }, [model, mode, backMin, makesIt]);

  const onDial = React.useCallback((kind, value) => {
    if (kind === "leave") setLeaveMin(value);
    else setBackByMin(value);
  }, []);

  const onAddRegion = React.useCallback((r) => setRegions((prev) => prev.concat([r])), []);

  const regionRows = React.useMemo(() => {
    const map = new Map();
    regions.forEach((r, ri) => (r.ids || []).forEach((id) => { if (!map.has(id)) map.set(id, ri + 1); }));
    return rows
      .map((d, i) => ({ d, i }))
      .filter((o) => map.has(o.d.osm_id))
      .map((o) => {
        const there = +o.d[`${mode}_min`] || 0;
        const bt = +o.d[`${mode}_back`] || 0;
        const back = leaveMin + there + DWELL + bt;
        return { i: o.i, name: o.d.name, there, arrive: leaveMin + there, back, fits: back <= backByMin, region: map.get(o.d.osm_id) };
      })
      .sort((a, b) => a.back - b.back);
  }, [regions, rows, mode, leaveMin, backByMin]);

  return (
    <section style={{ padding: "18px 20px", background: "#fff", color: INK, fontFamily: SANS }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: `1px solid ${FAINT}`, paddingBottom: 8, marginBottom: 14 }}>
        <h2 style={{ margin: 0, font: `500 15px ${SANS}`, letterSpacing: ".01em" }}>donut run · reach & return</h2>
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: MUTED }}>
          {rows.length} shops · dwell {DWELL} min · back by {fmtHHMM(backByMin)}
        </span>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 460px", minWidth: 420 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <button
              onClick={() => setLassoActive((v) => !v)}
              aria-pressed={lassoActive}
              style={{
                font: `${lassoActive ? 600 : 400} 12px ${SANS}`,
                background: lassoActive ? INK : "#fff",
                color: lassoActive ? "#fff" : INK,
                border: `1px solid ${lassoActive ? INK : FAINT}`,
                borderRadius: 2, padding: "4px 12px", cursor: "pointer",
              }}
            >
              lasso {lassoActive ? "on" : "off"}
            </button>
            <span style={{ fontSize: 11.5, color: MUTED }}>
              click a shop to retarget · drag the rim handle to resize the circle
            </span>
          </div>
          <ReachMap
            React={React}
            model={model}
            mode={mode}
            rows={rows}
            hotel={hotel}
            targetIdx={targetIdx}
            onTarget={setTargetIdx}
            leaveMin={leaveMin}
            backByMin={backByMin}
            dwellMin={DWELL}
            radiusKm={radiusKm}
            onRadius={setRadiusKm}
            regions={regions}
            onAddRegion={onAddRegion}
            lassoActive={lassoActive}
            inputTick={inputTick}
          />
          <RegionTable
            React={React}
            rows={regionRows}
            mode={mode}
            onClear={() => setRegions([])}
            onTarget={setTargetIdx}
            targetIdx={targetIdx}
          />
        </div>

        <div style={{ flex: "0 0 320px", width: 320 }}>
          <ModeSwitch React={React} mode={mode} onChange={setMode} />
          <DialClock
            React={React}
            leaveMin={leaveMin}
            backByMin={backByMin}
            thereMin={thereMin}
            dwellMin={DWELL}
            backTripMin={backTripMin}
            onChange={onDial}
            size={296}
          />
          <DayRow React={React} day={day} onChange={setDay} />
          <VerdictLines
            React={React}
            leaveMin={leaveMin}
            targetName={target ? target.name : "—"}
            thereMin={thereMin}
            dwellMin={DWELL}
            backTripMin={backTripMin}
            openLabel={openLabel}
            backByMin={backByMin}
          />
          <div style={{ marginTop: 10, fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
            filled handle = leave · diamond = back by · hollow tick = return
          </div>
        </div>
      </div>
    </section>
  );
}