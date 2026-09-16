import * as d3 from "https://esm.sh/d3@7";

export const ColorLegend = ({ React, width = 200 }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref.current) return;
    const h = 14;
    const svg = d3.select(ref.current).append("svg")
      .attr("width", width).attr("height", 44);
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id", "legendGrad");
    grad.attr("x1", "0%").attr("x2", "100%");
    for (let i = 0; i <= 10; i++) {
      grad.append("stop").attr("offset", `${i * 10}%`)
        .attr("stop-color", d3.interpolateBlues(i / 10));
    }
    svg.append("rect").attr("x", 0).attr("y", 4).attr("width", width - 40)
      .attr("height", h).attr("fill", "url(#legendGrad)")
      .attr("stroke", "#333");
    const sc = d3.scaleLinear().domain([0, 1]).range([0, width - 40]);
    const ax = d3.axisBottom(sc).ticks(5).tickSize(3);
    svg.append("g").attr("transform", `translate(0,${4 + h})`).call(ax)
      .call(g => g.selectAll("text").attr("fill", "#222").style("font-size", "9px"))
      .call(g => g.selectAll("line,path").attr("stroke", "#333"));
    // hatched swatch
    const hp = defs.append("pattern").attr("id", "legendHatch")
      .attr("width", 6).attr("height", 6).attr("patternUnits", "userSpaceOnUse");
    hp.append("rect").attr("width", 6).attr("height", 6).attr("fill", "#fff");
    hp.append("path").attr("d", "M0,6 l6,-6 M-1,1 l2,-2 M5,7 l2,-2")
      .attr("stroke", "#999").attr("stroke-width", 1);
    svg.append("rect").attr("x", width - 34).attr("y", 4).attr("width", 14)
      .attr("height", 14).attr("fill", "url(#legendHatch)").attr("stroke", "#333");
    svg.append("text").attr("x", width - 16).attr("y", 15).attr("fill", "#222")
      .style("font-size", "9px").text("n/a");
    return () => svg.remove();
  }, [width]);
  return <div ref={ref} />;
};

export default function Widget({ model, React }) {
  const raw = model.get("data") || [];
  const rows = React.useMemo(() => {
    if (Array.isArray(raw)) return raw;
    // handle dict-of-columns
    if (raw && raw.region) {
      const keys = Object.keys(raw);
      const n = raw[keys[0]].length;
      const out = [];
      for (let i = 0; i < n; i++) {
        const o = {};
        keys.forEach(k => (o[k] = raw[k][i]));
        out.push(o);
      }
      return out;
    }
    return [];
  }, [raw]);

  const regions = React.useMemo(
    () => Array.from(new Set(rows.map(d => d.region))).sort(),
    [rows]
  );

  const YEAR_LO = 1979, YEAR_HI = 2026;
  const years = React.useMemo(() => {
    const a = [];
    for (let y = YEAR_LO; y <= YEAR_HI; y++) a.push(y);
    return a;
  }, []);
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const [region, setRegion] = React.useState(
    regions.includes("Barents") ? "Barents" : (regions[0] || "")
  );

  // lookup for current region: key = year*100+month -> frac
  const lookup = React.useMemo(() => {
    const m = new Map();
    for (const d of rows) {
      if (d.region !== region) continue;
      if (d.year < YEAR_LO || d.year > YEAR_HI) continue;
      m.set(d.year * 100 + d.month, d.frac);
    }
    return m;
  }, [rows, region]);

  const containerRef = React.useRef(null);

  // layout
  const margin = { top: 46, right: 20, bottom: 30, left: 46 };
  const cellW = 15, cellH = 26;
  const plotW = years.length * cellW;
  const plotH = months.length * cellH;
  const width = margin.left + plotW + margin.right;
  const height = margin.top + plotH + margin.bottom;

  // brush selection in cell/data space: inclusive year/month ranges
  const [sel, setSel] = React.useState({
    year_lo: 2005, year_hi: 2015, month_lo: 6, month_hi: 9,
  });
  const selRef = React.useRef(sel);
  selRef.current = sel;

  // compute avg for a selection
  const computeAvg = React.useCallback((s) => {
    let sum = 0, cnt = 0;
    for (let y = s.year_lo; y <= s.year_hi; y++) {
      for (let mo = s.month_lo; mo <= s.month_hi; mo++) {
        const v = lookup.get(y * 100 + mo);
        if (v != null && !Number.isNaN(v)) { sum += v; cnt++; }
      }
    }
    return { avg: cnt ? sum / cnt : null, count: cnt };
  }, [lookup]);

  const stat = React.useMemo(() => computeAvg(sel), [computeAvg, sel]);

  // sync outputs
  React.useEffect(() => {
    const where = {
      region,
      month_lo: sel.month_lo, month_hi: sel.month_hi,
      year_lo: sel.year_lo, year_hi: sel.year_hi,
    };
    model.set("where", where);
    model.set("avg_frac", stat.avg);
    model.save_changes();
  }, [region, sel, stat.avg, model]);

  // scales (band-like via index)
  const xOf = React.useCallback((y) => (y - YEAR_LO) * cellW, []);
  const yOf = React.useCallback((mo) => (mo - 1) * cellH, []);

  // Build static chart: depends ONLY on lookup/layout, not on sel.
  React.useEffect(() => {
    if (!containerRef.current) return;
    const root = d3.select(containerRef.current);
    root.selectAll("*").remove();

    const svg = root.append("svg")
      .attr("width", width).attr("height", height)
      .attr("tabindex", 0)
      .style("outline", "none")
      .style("font-family", "system-ui, sans-serif");

    const defs = svg.append("defs");
    const hatch = defs.append("pattern").attr("id", "hatchMissing")
      .attr("width", 6).attr("height", 6).attr("patternUnits", "userSpaceOnUse");
    hatch.append("rect").attr("width", 6).attr("height", 6).attr("fill", "#f2f2f2");
    hatch.append("path").attr("d", "M0,6 l6,-6 M-1,1 l2,-2 M5,7 l2,-2")
      .attr("stroke", "#bbb").attr("stroke-width", 1);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // cells
    for (const y of years) {
      for (const mo of months) {
        const v = lookup.get(y * 100 + mo);
        const missing = v == null || Number.isNaN(v);
        g.append("rect")
          .attr("x", xOf(y)).attr("y", yOf(mo))
          .attr("width", cellW).attr("height", cellH)
          .attr("fill", missing ? "url(#hatchMissing)" : d3.interpolateBlues(v))
          .attr("stroke", "#fff").attr("stroke-width", 0.5)
          .append("title")
          .text(`${y}-${String(mo).padStart(2, "0")}: ${missing ? "n/a" : v.toFixed(3)}`);
      }
    }

    // x axis (years, every 5)
    const xAxisG = g.append("g").attr("transform", `translate(0,${plotH})`);
    years.forEach(y => {
      if (y % 5 === 0) {
        xAxisG.append("text")
          .attr("x", xOf(y) + cellW / 2).attr("y", 16)
          .attr("text-anchor", "middle").attr("fill", "#222")
          .style("font-size", "10px").text(y);
        xAxisG.append("line")
          .attr("x1", xOf(y) + cellW / 2).attr("x2", xOf(y) + cellW / 2)
          .attr("y1", 0).attr("y2", 4).attr("stroke", "#555");
      }
    });

    // y axis (months, Jan at top)
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    months.forEach(mo => {
      g.append("text")
        .attr("x", -6).attr("y", yOf(mo) + cellH / 2 + 3)
        .attr("text-anchor", "end").attr("fill", "#222")
        .style("font-size", "10px").text(monthNames[mo - 1]);
    });

    // --- brush layer ---
    const brushLayer = g.append("g").attr("class", "brush-layer");
    const brushRect = brushLayer.append("rect")
      .attr("fill", "rgba(255,140,0,0.10)")
      .attr("stroke", "#ff7f0e").attr("stroke-width", 2)
      .style("cursor", "move");
    // edge hit areas
    const edges = {};
    ["l", "r", "t", "b"].forEach(e => {
      edges[e] = brushLayer.append("rect")
        .attr("fill", "transparent")
        .style("cursor", (e === "l" || e === "r") ? "ew-resize" : "ns-resize");
    });
    const labelBg = brushLayer.append("rect")
      .attr("fill", "#ff7f0e").attr("rx", 2);
    const label = brushLayer.append("text")
      .attr("fill", "#fff").style("font-size", "10px")
      .style("font-weight", "600").attr("text-anchor", "start");

    // draw brush from selRef
    function drawBrush() {
      const s = selRef.current;
      const x = xOf(s.year_lo);
      const w = (s.year_hi - s.year_lo + 1) * cellW;
      const yy = yOf(s.month_lo);
      const h = (s.month_hi - s.month_lo + 1) * cellH;
      brushRect.attr("x", x).attr("y", yy).attr("width", w).attr("height", h);
      const HIT = 8;
      edges.l.attr("x", x - HIT / 2).attr("y", yy).attr("width", HIT).attr("height", h);
      edges.r.attr("x", x + w - HIT / 2).attr("y", yy).attr("width", HIT).attr("height", h);
      edges.t.attr("x", x).attr("y", yy - HIT / 2).attr("width", w).attr("height", HIT);
      edges.b.attr("x", x).attr("y", yy + h - HIT / 2).attr("width", w).attr("height", HIT);

      const st = computeAvg(s);
      const txt = st.avg == null
        ? `avg n/a · ${st.count} cells`
        : `avg ${st.avg.toFixed(2)} · ${st.count} cells`;
      label.attr("x", x + 4).attr("y", yy - 6).text(txt);
      const tw = txt.length * 6 + 8;
      labelBg.attr("x", x + 1).attr("y", yy - 16).attr("width", tw).attr("height", 13);
      // keep label on top
      labelBg.raise();
      label.raise();
    }
    drawBrush();

    // pointer -> cell indices
    function cellAt(event) {
      const [px, py] = d3.pointer(event, g.node());
      let yi = Math.floor(px / cellW);
      let mi = Math.floor(py / cellH);
      yi = Math.max(0, Math.min(years.length - 1, yi));
      mi = Math.max(0, Math.min(months.length - 1, mi));
      return { year: YEAR_LO + yi, month: 1 + mi };
    }

    const gesture = { mode: null, start: null, orig: null };

    function commit(s) {
      selRef.current = s;
      drawBrush();
      setSel({ ...s });
    }

    // dragging via d3.drag on an overlay covering the plot
    const overlay = g.append("rect")
      .attr("x", 0).attr("y", 0).attr("width", plotW).attr("height", plotH)
      .attr("fill", "transparent")
      .style("pointer-events", "all")
      .lower(); // behind brush so brush edges get events first? we want overlay to catch new-brush
    // Actually keep overlay below brush marks: raise brush layer.
    brushLayer.raise();

    function within(s, yr, mo) {
      return yr >= s.year_lo && yr <= s.year_hi && mo >= s.month_lo && mo <= s.month_hi;
    }

    const drag = d3.drag()
      .on("start", (event) => {
        svg.node().focus();
        const c = cellAt(event);
        const s = selRef.current;
        const target = event.sourceEvent && event.sourceEvent.target;
        let mode = null;
        if (target === edges.l.node()) mode = "resize-l";
        else if (target === edges.r.node()) mode = "resize-r";
        else if (target === edges.t.node()) mode = "resize-t";
        else if (target === edges.b.node()) mode = "resize-b";
        else if (target === brushRect.node() || within(s, c.year, c.month)) mode = "move";
        else mode = "new";
        gesture.mode = mode;
        gesture.start = c;
        gesture.orig = { ...s };
        if (mode === "new") {
          commit({ year_lo: c.year, year_hi: c.year, month_lo: c.month, month_hi: c.month });
        }
      })
      .on("drag", (event) => {
        const c = cellAt(event);
        const o = gesture.orig;
        let s = { ...selRef.current };
        if (gesture.mode === "new") {
          s.year_lo = Math.min(gesture.start.year, c.year);
          s.year_hi = Math.max(gesture.start.year, c.year);
          s.month_lo = Math.min(gesture.start.month, c.month);
          s.month_hi = Math.max(gesture.start.month, c.month);
        } else if (gesture.mode === "move") {
          const dy = c.year - gesture.start.year;
          const dm = c.month - gesture.start.month;
          let ylo = o.year_lo + dy, yhi = o.year_hi + dy;
          let mlo = o.month_lo + dm, mhi = o.month_hi + dm;
          if (ylo < YEAR_LO) { yhi += YEAR_LO - ylo; ylo = YEAR_LO; }
          if (yhi > YEAR_HI) { ylo -= yhi - YEAR_HI; yhi = YEAR_HI; }
          if (mlo < 1) { mhi += 1 - mlo; mlo = 1; }
          if (mhi > 12) { mlo -= mhi - 12; mhi = 12; }
          s = { year_lo: ylo, year_hi: yhi, month_lo: mlo, month_hi: mhi };
        } else if (gesture.mode === "resize-l") {
          s.year_lo = Math.min(c.year, o.year_hi);
          s.year_hi = Math.max(c.year, o.year_hi);
        } else if (gesture.mode === "resize-r") {
          s.year_hi = Math.max(c.year, o.year_lo);
          s.year_lo = Math.min(c.year, o.year_lo);
        } else if (gesture.mode === "resize-t") {
          s.month_lo = Math.min(c.month, o.month_hi);
          s.month_hi = Math.max(c.month, o.month_hi);
        } else if (gesture.mode === "resize-b") {
          s.month_hi = Math.max(c.month, o.month_lo);
          s.month_lo = Math.min(c.month, o.month_lo);
        }
        commit(s);
      })
      .on("end", () => { gesture.mode = null; });

    overlay.call(drag);
    brushRect.call(drag);
    Object.values(edges).forEach(e => e.call(drag));

    // keyboard
    function onKey(event) {
      let s = { ...selRef.current };
      let handled = true;
      if (event.key === "ArrowLeft") {
        if (s.year_lo > YEAR_LO) { s.year_lo--; s.year_hi--; }
      } else if (event.key === "ArrowRight") {
        if (s.year_hi < YEAR_HI) { s.year_lo++; s.year_hi++; }
      } else if (event.key === "ArrowUp") {
        if (s.month_lo > 1) { s.month_lo--; s.month_hi--; }
      } else if (event.key === "ArrowDown") {
        if (s.month_hi < 12) { s.month_lo++; s.month_hi++; }
      } else handled = false;
      if (handled) { event.preventDefault(); commit(s); }
    }
    svg.on("keydown", onKey);

    return () => {
      svg.on("keydown", null);
      root.selectAll("*").remove();
    };
  }, [lookup, width, height, plotW, plotH, xOf, yOf, computeAvg, years]);

  const sql = React.useMemo(() => {
    const avgTxt = stat.avg == null ? "n/a" : stat.avg.toFixed(2);
    return `SELECT AVG(frac) FROM ice WHERE region = '${region}'\n  AND month BETWEEN ${sel.month_lo} AND ${sel.month_hi}\n  AND year BETWEEN ${sel.year_lo} AND ${sel.year_hi}   -- ${avgTxt}`;
  }, [region, sel, stat.avg]);

  return (
    <section style={{ padding: 16, fontFamily: "system-ui, sans-serif", color: "#111", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 16, color: "#111" }}>Sea-ice fraction heatmap</h2>
        <label style={{ fontSize: 13, color: "#111" }}>
          Region:{" "}
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            style={{
              fontSize: 13, padding: "3px 6px", color: "#111",
              background: "#fff", border: "1px solid #555", borderRadius: 4,
            }}
          >
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <ColorLegend React={React} width={200} />
      </div>

      <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>
        Drag to draw a window · drag body to move · drag an edge to resize · arrow keys shift (click chart first)
      </div>

      <div ref={containerRef} style={{ overflowX: "auto", border: "1px solid #eee" }} />

      <pre style={{
        marginTop: 12, padding: "10px 12px", background: "#0f172a", color: "#e2e8f0",
        fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 12,
        borderRadius: 6, whiteSpace: "pre-wrap", lineHeight: 1.5,
      }}>
        {sql}
      </pre>
    </section>
  );
}