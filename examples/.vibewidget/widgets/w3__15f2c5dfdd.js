import * as d3 from "https://esm.sh/d3@7";

const PAPER = "#ffffff";
const INK = "#111111";
const GREY = "#777777";
const HAIR = "#d9d9d9";
const FAINT = "#f2f2f2";
const ACCENT = "#d9480f";
const FONT = "system-ui, -apple-system, Inter, Helvetica, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace";

export const RegionSelect = ({ React, regions, value, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{
      font: `400 12px ${FONT}`,
      color: INK,
      background: PAPER,
      border: `1px solid ${HAIR}`,
      borderRadius: 0,
      padding: "3px 6px",
      outline: "none",
    }}
  >
    {regions.map((r) => (
      <option key={r} value={r}>
        {r}
      </option>
    ))}
  </select>
);

export const OutsideList = ({ React, rows }) => (
  <div style={{ minWidth: 118 }}>
    <div
      style={{
        font: `400 11px ${FONT}`,
        color: GREY,
        display: "flex",
        justifyContent: "space-between",
        paddingBottom: 4,
        borderBottom: `1px solid ${HAIR}`,
      }}
    >
      <span>year</span>
      <span>resid</span>
    </div>
    <div style={{ maxHeight: 344, overflowY: "auto" }}>
      {rows.map((r) => (
        <div
          key={r.year}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "3px 0",
            borderBottom: `1px solid ${FAINT}`,
            font: `400 12px ${MONO}`,
            fontVariantNumeric: "tabular-nums",
            color: INK,
          }}
        >
          <span>{r.year}</span>
          <span style={{ textAlign: "right", color: ACCENT }}>
            {r.resid >= 0 ? "+" : "\u2212"}
            {Math.abs(r.resid).toFixed(3)}
          </span>
        </div>
      ))}
    </div>
  </div>
);

export const QueryLine = ({ React, region, half, n }) => (
  <div
    style={{
      font: `400 12px ${MONO}`,
      fontVariantNumeric: "tabular-nums",
      color: INK,
      lineHeight: 1.55,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    }}
  >
    {`SELECT s.year, s.frac, c.co2_ppm FROM sept s JOIN co2 c ON s.year = c.year WHERE region = '${region}' AND ABS(frac - pred) > ${half.toFixed(
      3
    )}`}
    <span style={{ color: GREY }}>{`   -- ${n} row${n === 1 ? "" : "s"}`}</span>
  </div>
);

export default function Widget({ model, React }) {
  const raw = model.get("data") || [];
  const rows = React.useMemo(
    () =>
      (Array.isArray(raw) ? raw : []).map((d) => ({
        region: String(d.region),
        year: +d.year,
        frac: +d.frac,
        co2_ppm: +d.co2_ppm,
        pred: +d.pred,
        resid: +d.resid,
      })),
    [raw]
  );

  const regions = React.useMemo(
    () => Array.from(new Set(rows.map((d) => d.region))).sort(d3.ascending),
    [rows]
  );

  const [region, setRegion] = React.useState("Barents");
  React.useEffect(() => {
    if (regions.length && !regions.includes(region)) setRegion(regions[0]);
  }, [regions, region]);

  const series = React.useMemo(() => {
    const s = rows.filter((d) => d.region === region);
    s.sort((a, b) => a.co2_ppm - b.co2_ppm);
    return s;
  }, [rows, region]);

  const sd = React.useMemo(() => {
    if (series.length < 2) return 0.05;
    const m = d3.mean(series, (d) => d.resid) || 0;
    const v =
      d3.sum(series, (d) => (d.resid - m) * (d.resid - m)) / series.length;
    return Math.sqrt(v) || 0.05;
  }, [series]);

  const [band, setBand] = React.useState({ lo: -0.05, hi: 0.05 });
  React.useEffect(() => {
    setBand({ lo: -sd, hi: sd });
  }, [sd]);

  const bandRef = React.useRef(band);
  bandRef.current = band;

  const [hover, setHover] = React.useState(null);

  const outsideRows = React.useMemo(() => {
    const o = series.filter((d) => d.resid > band.hi || d.resid < band.lo);
    o.sort((a, b) => Math.abs(b.resid) - Math.abs(a.resid));
    return o;
  }, [series, band]);

  React.useEffect(() => {
    model.set("outside", outsideRows.map((d) => d.year));
    model.set("band", { lo: band.lo, hi: band.hi });
    model.save_changes();
  }, [outsideRows, band, model]);

  const [, forceTick] = React.useState(0);
  React.useEffect(() => {
    const h = () => forceTick((t) => t + 1);
    model.on("change:data", h);
    return () => model.off("change:data", h);
  }, [model]);

  const wrapRef = React.useRef(null);
  const apiRef = React.useRef(null);

  const W = 560;
  const H = 400;
  const M = { top: 14, right: 16, bottom: 56, left: 54 };

  React.useEffect(() => {
    const node = wrapRef.current;
    if (!node || series.length === 0) return;

    const iw = W - M.left - M.right;
    const ih = H - M.top - M.bottom;

    const svg = d3
      .select(node)
      .append("svg")
      .attr("width", W)
      .attr("height", H)
      .style("display", "block")
      .style("touch-action", "none");

    const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

    const xExt = d3.extent(series, (d) => d.co2_ppm);
    const xPad = (xExt[1] - xExt[0]) * 0.04 || 1;
    const x = d3
      .scaleLinear()
      .domain([xExt[0] - xPad, xExt[1] + xPad])
      .range([0, iw]);

    const initHalf = sd;
    const yVals = [];
    series.forEach((d) => {
      yVals.push(d.frac, d.pred + initHalf * 1.35, d.pred - initHalf * 1.35);
    });
    const yExt = d3.extent(yVals);
    const yPad = (yExt[1] - yExt[0]) * 0.06 || 0.01;
    const y = d3
      .scaleLinear()
      .domain([yExt[0] - yPad, yExt[1] + yPad])
      .range([ih, 0]);

    // axes
    const xAxis = d3.axisBottom(x).ticks(6).tickSizeOuter(0).tickPadding(6);
    const yAxis = d3.axisLeft(y).ticks(6).tickSizeOuter(0).tickPadding(6);

    const gx = g.append("g").attr("transform", `translate(0,${ih})`).call(xAxis);
    const gy = g.append("g").call(yAxis);

    [gx, gy].forEach((sel) => {
      sel.selectAll("path.domain").attr("stroke", HAIR).attr("stroke-width", 1);
      sel.selectAll("line").attr("stroke", HAIR).attr("stroke-width", 1);
      sel
        .selectAll("text")
        .attr("fill", INK)
        .style("font", `400 11px ${FONT}`)
        .style("font-variant-numeric", "tabular-nums");
    });

    g.append("text")
      .attr("x", iw / 2)
      .attr("y", ih + 34)
      .attr("text-anchor", "middle")
      .attr("fill", GREY)
      .style("font", `400 11px ${FONT}`)
      .text("co2 ppm");

    g.append("text")
      .attr("transform", `rotate(-90)`)
      .attr("x", -ih / 2)
      .attr("y", -38)
      .attr("text-anchor", "middle")
      .attr("fill", GREY)
      .style("font", `400 11px ${FONT}`)
      .text("frac (september)");

    // band area (between edges)
    const areaGen = d3
      .area()
      .x((d) => x(d.co2_ppm))
      .y0((d) => y(d.pred + bandRef.current.hi))
      .y1((d) => y(d.pred + bandRef.current.lo));

    const bandPath = g
      .append("path")
      .attr("fill", INK)
      .attr("fill-opacity", 0.07)
      .attr("stroke", "none");

    const lineGen = d3
      .line()
      .x((d) => x(d.co2_ppm))
      .y((d) => y(d.pred));

    const edgeGen = (off) =>
      d3
        .line()
        .x((d) => x(d.co2_ppm))
        .y((d) => y(d.pred + off))(series);

    // fitted line
    g.append("path")
      .datum(series)
      .attr("fill", "none")
      .attr("stroke", INK)
      .attr("stroke-width", 1.5)
      .attr("d", lineGen);

    const edgeHi = g
      .append("path")
      .attr("fill", "none")
      .attr("stroke", INK)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3 3");

    const edgeLo = g
      .append("path")
      .attr("fill", "none")
      .attr("stroke", INK)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3 3");

    const dots = g
      .append("g")
      .selectAll("circle")
      .data(series)
      .join("circle")
      .attr("cx", (d) => x(d.co2_ppm))
      .attr("cy", (d) => y(d.frac))
      .attr("r", 3.2)
      .attr("stroke", "none");

    // hover layer
    const label = g
      .append("g")
      .style("pointer-events", "none")
      .style("display", "none");
    const labelText = label
      .append("text")
      .attr("fill", INK)
      .style("font", `400 12px ${MONO}`)
      .style("font-variant-numeric", "tabular-nums")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.9em");

    dots
      .style("cursor", "default")
      .on("pointerenter", function (ev, d) {
        d3.select(this).attr("r", 4.6);
        labelText.text(String(d.year));
        label
          .attr("transform", `translate(${x(d.co2_ppm)},${y(d.frac)})`)
          .style("display", null);
        setHover(d.year);
      })
      .on("pointerleave", function () {
        d3.select(this).attr("r", 3.2);
        label.style("display", "none");
        setHover(null);
      });

    // handle groups (positioned at mid x)
    const midIdx = Math.floor(series.length / 2);
    const midD = series[midIdx];
    const midX = x(midD.co2_ppm);

    function mkHandle(which) {
      const grp = g.append("g").style("cursor", "ns-resize");
      grp
        .append("rect")
        .attr("x", -10)
        .attr("y", -10)
        .attr("width", 20)
        .attr("height", 20)
        .attr("fill", "transparent");
      grp
        .append("circle")
        .attr("r", 3.5)
        .attr("fill", INK)
        .attr("stroke", PAPER)
        .attr("stroke-width", 1.5);
      grp.attr("data-which", which);
      return grp;
    }
    const hHi = mkHandle("hi");
    const hLo = mkHandle("lo");

    // wide invisible hit areas along each edge for dragging anywhere on it
    const hitHi = g
      .append("path")
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 16)
      .style("cursor", "ns-resize");
    const hitLo = g
      .append("path")
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 16)
      .style("cursor", "ns-resize");

    function render() {
      const b = bandRef.current;
      bandPath.datum(series).attr("d", areaGen);
      const dHi = edgeGen(b.hi);
      const dLo = edgeGen(b.lo);
      edgeHi.attr("d", dHi);
      edgeLo.attr("d", dLo);
      hitHi.attr("d", dHi);
      hitLo.attr("d", dLo);
      hHi.attr("transform", `translate(${midX},${y(midD.pred + b.hi)})`);
      hLo.attr("transform", `translate(${midX},${y(midD.pred + b.lo)})`);
      dots
        .attr("fill", (d) =>
          d.resid > b.hi || d.resid < b.lo ? ACCENT : "#cfcfcf"
        )
        .attr("stroke", (d) =>
          d.resid > b.hi || d.resid < b.lo ? ACCENT : "none"
        )
        .attr("stroke-width", 1);
    }

    // interpolate pred at a given co2 value (for pointer -> resid conversion)
    const predAt = (cx) => {
      if (cx <= series[0].co2_ppm) return series[0].pred;
      const last = series[series.length - 1];
      if (cx >= last.co2_ppm) return last.pred;
      for (let i = 1; i < series.length; i++) {
        const a = series[i - 1];
        const b = series[i];
        if (cx <= b.co2_ppm) {
          const t = (cx - a.co2_ppm) / (b.co2_ppm - a.co2_ppm || 1);
          return a.pred + t * (b.pred - a.pred);
        }
      }
      return last.pred;
    };

    let drag = null;

    function residFromPointer(ev) {
      const [px, py] = d3.pointer(ev, g.node());
      const cx = x.invert(px);
      const fv = y.invert(py);
      return fv - predAt(cx);
    }

    function startDrag(which) {
      return function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (node.firstChild) svg.node().focus?.();
        const r0 = residFromPointer(ev);
        const b = bandRef.current;
        drag = {
          which,
          shift: !!ev.shiftKey,
          r0,
          lo0: b.lo,
          hi0: b.hi,
          off: which === "hi" ? b.hi - r0 : b.lo - r0,
        };
        svg.node().setPointerCapture?.(ev.pointerId);
      };
    }

    function onMove(ev) {
      if (!drag) return;
      ev.preventDefault();
      const r = residFromPointer(ev);
      let lo = drag.lo0;
      let hi = drag.hi0;
      if (drag.shift) {
        const dr = r - drag.r0;
        lo = drag.lo0 + dr;
        hi = drag.hi0 + dr;
      } else if (drag.which === "hi") {
        hi = r + drag.off;
      } else {
        lo = r + drag.off;
      }
      if (hi < lo) {
        const t = hi;
        hi = lo;
        lo = t;
      }
      bandRef.current = { lo, hi };
      render();
      apiRef.current.commit(bandRef.current);
    }

    function endDrag(ev) {
      if (!drag) return;
      drag = null;
      try {
        svg.node().releasePointerCapture?.(ev.pointerId);
      } catch (e) {}
      apiRef.current.commit(bandRef.current);
    }

    hHi.on("pointerdown", startDrag("hi"));
    hitHi.on("pointerdown", startDrag("hi"));
    hLo.on("pointerdown", startDrag("lo"));
    hitLo.on("pointerdown", startDrag("lo"));

    svg.on("pointermove", onMove);
    svg.on("pointerup", endDrag);
    svg.on("pointercancel", endDrag);

    bandRef.current = { lo: -sd, hi: sd };
    render();

    apiRef.current = { render, setBand: (b) => { bandRef.current = b; render(); } };

    return () => {
      svg.on("pointermove", null).on("pointerup", null).on("pointercancel", null);
      apiRef.current = null;
      svg.remove();
    };
  }, [series, sd]);

  // bridge imperative drag -> react state (throttled via rAF)
  const commitRef = React.useRef(null);
  React.useEffect(() => {
    let raf = 0;
    let pending = null;
    const commit = (b) => {
      pending = { lo: b.lo, hi: b.hi };
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (pending) setBand(pending);
      });
    };
    commitRef.current = commit;
    if (apiRef.current) apiRef.current.commit = commit;
    return () => {
      if (raf) cancelAnimationFrame(raf);
      commitRef.current = null;
    };
  }, [series, sd]);

  React.useEffect(() => {
    if (apiRef.current && commitRef.current) {
      apiRef.current.commit = commitRef.current;
    }
  });

  const half = Math.max(Math.abs(band.hi), Math.abs(band.lo));

  return (
    <div
      style={{
        padding: 12,
        background: PAPER,
        color: INK,
        font: `400 12px ${FONT}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              paddingBottom: 8,
              minHeight: 26,
            }}
          >
            <RegionSelect
              React={React}
              regions={regions}
              value={region}
              onChange={setRegion}
            />
            <span
              style={{
                font: `400 12px ${MONO}`,
                fontVariantNumeric: "tabular-nums",
                color: GREY,
              }}
            >
              {`lo ${band.lo >= 0 ? "+" : "\u2212"}${Math.abs(band.lo).toFixed(
                3
              )}  hi ${band.hi >= 0 ? "+" : "\u2212"}${Math.abs(
                band.hi
              ).toFixed(3)}`}
            </span>
            {hover !== null && (
              <span
                style={{
                  font: `600 13px ${MONO}`,
                  fontVariantNumeric: "tabular-nums",
                  color: ACCENT,
                }}
              >
                {hover}
              </span>
            )}
          </div>
          <div ref={wrapRef} />
        </div>

        <div
          style={{
            borderLeft: `1px solid ${HAIR}`,
            paddingLeft: 14,
            alignSelf: "stretch",
            paddingTop: 34,
          }}
        >
          <OutsideList React={React} rows={outsideRows} />
        </div>
      </div>

      <div style={{ height: 28 }} />
      <QueryLine
        React={React}
        region={region}
        half={half}
        n={outsideRows.length}
      />
    </div>
  );
}