import * as d3 from "https://esm.sh/d3@7";

export const SqlBox = ({ region, threshold, count }) => (
  <pre
    style={{
      fontFamily: "monospace",
      fontSize: 12,
      background: "#1e1e1e",
      color: "#e8e8e8",
      padding: "12px 14px",
      borderRadius: 6,
      overflowX: "auto",
      lineHeight: 1.5,
      margin: "12px 0 0 0",
    }}
  >
    {`SELECT s.year, s.frac, c.co2_ppm
FROM sept s JOIN co2 c ON s.year = c.year
WHERE region = '${region}' AND ABS(frac - pred) > ${threshold.toFixed(3)}   -- ${count} rows`}
  </pre>
);

export const OutsideList = ({ rows }) => (
  <div style={{ minWidth: 150 }}>
    <div
      style={{
        fontWeight: 700,
        fontSize: 13,
        marginBottom: 6,
        color: "#111",
      }}
    >
      Outside band ({rows.length})
    </div>
    <div style={{ fontSize: 12, color: "#222" }}>
      {rows.map((r) => (
        <div
          key={r.year}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "2px 4px",
            gap: 10,
            borderBottom: "1px solid #eee",
          }}
        >
          <span style={{ fontWeight: 600 }}>{r.year}</span>
          <span style={{ fontFamily: "monospace", color: "#b5651d" }}>
            {r.resid >= 0 ? "+" : ""}
            {r.resid.toFixed(3)}
          </span>
        </div>
      ))}
      {rows.length === 0 && (
        <div style={{ color: "#666", fontStyle: "italic" }}>none</div>
      )}
    </div>
  </div>
);

export default function Widget({ model, React }) {
  const allData = model.get("data") || [];
  const regions = React.useMemo(
    () => Array.from(new Set(allData.map((d) => d.region))).sort(),
    [allData]
  );

  const initialRegion = regions.includes("Barents") ? "Barents" : regions[0];
  const [region, setRegion] = React.useState(initialRegion);

  // band half-widths in resid units (from fitted line, positive above/below)
  const bandRef = React.useRef({ lo: 0, hi: 0 });
  const [bandState, setBandState] = React.useState({ lo: 0, hi: 0 });
  const [outsideRows, setOutsideRows] = React.useState([]);

  const svgRef = React.useRef(null);
  const chartApiRef = React.useRef(null);

  const width = 620;
  const height = 420;
  const margin = { top: 24, right: 24, bottom: 48, left: 60 };

  // region data + std of residuals
  const regionData = React.useMemo(() => {
    return allData
      .filter((d) => d.region === region)
      .slice()
      .sort((a, b) => a.co2_ppm - b.co2_ppm);
  }, [allData, region]);

  const sd = React.useMemo(() => {
    if (!regionData.length) return 0;
    const resids = regionData.map((d) => d.resid);
    const mean = d3.mean(resids);
    const v = d3.mean(resids.map((r) => (r - mean) * (r - mean)));
    return Math.sqrt(v);
  }, [regionData]);

  // helper to recompute outputs given band half-widths
  const recompute = React.useCallback(
    (lo, hi) => {
      const outside = regionData
        .filter((d) => d.resid > hi || d.resid < -lo)
        .map((d) => ({ year: d.year, resid: d.resid }))
        .sort((a, b) => Math.abs(b.resid) - Math.abs(a.resid));
      setOutsideRows(outside);
      const bandObj = { lo: -lo, hi: hi };
      model.set("outside", outside.map((d) => d.year));
      model.set("band", bandObj);
      model.save_changes();
      return outside;
    },
    [regionData, model]
  );

  // when region changes, reset band to ±1 sd
  React.useEffect(() => {
    const b = { lo: sd, hi: sd };
    bandRef.current = b;
    setBandState(b);
    recompute(b.lo, b.hi);
    // eslint-disable-next-line
  }, [region, sd]);

  // subscribe to data changes
  React.useEffect(() => {
    const handler = () => {
      const d = model.get("data") || [];
      const rs = Array.from(new Set(d.map((x) => x.region))).sort();
      if (!rs.includes(region) && rs.length) setRegion(rs[0]);
    };
    model.on("change:data", handler);
    return () => model.off("change:data", handler);
  }, [model, region]);

  // build chart (depends only on data + layout)
  React.useEffect(() => {
    if (!svgRef.current || !regionData.length) return;

    const root = d3.select(svgRef.current);
    root.selectAll("*").remove();

    const svg = root
      .attr("width", width)
      .attr("height", height)
      .style("background", "#fff");

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const iw = width - margin.left - margin.right;
    const ih = height - margin.top - margin.bottom;

    const xExt = d3.extent(regionData, (d) => d.co2_ppm);
    const yVals = regionData.flatMap((d) => [d.frac, d.pred]);
    const yExt = d3.extent(yVals);
    const xPad = (xExt[1] - xExt[0]) * 0.05 || 1;
    const yPad = (yExt[1] - yExt[0]) * 0.08 || 0.05;

    const x = d3
      .scaleLinear()
      .domain([xExt[0] - xPad, xExt[1] + xPad])
      .range([0, iw]);
    const y = d3
      .scaleLinear()
      .domain([yExt[0] - yPad, yExt[1] + yPad])
      .range([ih, 0]);

    // axes
    g.append("g")
      .attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(6))
      .selectAll("text")
      .style("font-size", "11px")
      .style("fill", "#222");
    g.append("g")
      .call(d3.axisLeft(y).ticks(6))
      .selectAll("text")
      .style("font-size", "11px")
      .style("fill", "#222");

    g.append("text")
      .attr("x", iw / 2)
      .attr("y", ih + 38)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#111")
      .text("CO₂ (ppm)");
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -ih / 2)
      .attr("y", -44)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#111")
      .text("September ice fraction");

    // fitted line through pred
    const lineGen = d3
      .line()
      .x((d) => x(d.co2_ppm))
      .y((d) => y(d.pred));
    g.append("path")
      .datum(regionData)
      .attr("fill", "none")
      .attr("stroke", "#333")
      .attr("stroke-width", 2)
      .attr("d", lineGen);

    // band area group (drawn first, behind dots)
    const bandArea = g.append("g").attr("class", "band-area");
    const upperArea = bandArea
      .append("path")
      .attr("fill", "#5b8def")
      .attr("opacity", 0.1);

    const upperLineG = g.append("g").attr("class", "edge-upper");
    const lowerLineG = g.append("g").attr("class", "edge-lower");

    function edgeVisual(sel) {
      sel
        .append("path")
        .attr("class", "vis")
        .attr("fill", "none")
        .attr("stroke", "#5b8def")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "6 4");
      sel
        .append("path")
        .attr("class", "hit")
        .attr("fill", "none")
        .attr("stroke", "transparent")
        .attr("stroke-width", 14)
        .style("cursor", "ns-resize");
      return sel;
    }
    edgeVisual(upperLineG);
    edgeVisual(lowerLineG);

    // dots
    const dots = g
      .append("g")
      .selectAll("circle")
      .data(regionData)
      .join("circle")
      .attr("cx", (d) => x(d.co2_ppm))
      .attr("cy", (d) => y(d.frac))
      .attr("r", 5)
      .attr("stroke", "#555")
      .attr("stroke-width", 0.6);

    // hover labels
    const tip = g
      .append("text")
      .attr("class", "hovertip")
      .style("font-size", "12px")
      .style("font-weight", "700")
      .style("fill", "#111")
      .style("pointer-events", "none")
      .style("display", "none");

    dots
      .on("mouseenter", function (event, d) {
        d3.select(this).attr("stroke", "#000").attr("stroke-width", 1.4);
        tip
          .style("display", null)
          .attr("x", x(d.co2_ppm) + 8)
          .attr("y", y(d.frac) - 8)
          .text(d.year);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("stroke", "#555").attr("stroke-width", 0.6);
        tip.style("display", "none");
      });

    // path builders for band edges (pred ± offset, parallel to fit)
    function edgePath(offset) {
      return d3
        .line()
        .x((d) => x(d.co2_ppm))
        .y((d) => y(d.pred + offset))(regionData);
    }

    function redraw() {
      const { lo, hi } = bandRef.current;
      upperLineG.selectAll("path").attr("d", edgePath(hi));
      lowerLineG.selectAll("path").attr("d", edgePath(-lo));
      // filled area between edges
      const areaGen = d3
        .area()
        .x((d) => x(d.co2_ppm))
        .y0((d) => y(d.pred - lo))
        .y1((d) => y(d.pred + hi))(regionData);
      upperArea.attr("d", areaGen);

      dots.attr("fill", (d) =>
        d.resid > hi || d.resid < -lo ? "#d2691e" : "#d3d3d3"
      );
    }

    // drag behaviour
    function makeDrag(which) {
      return d3
        .drag()
        .on("start", null)
        .on("drag", (event) => {
          const [, py] = d3.pointer(event, g.node());
          const dataY = y.invert(py);
          // offset relative to pred: find pred at nearest x? use resid-space:
          // we want the half-width. Approx using midline: treat drag as target resid.
          const targetResid = dataY - predAtPointer(event, g, x, regionData);
          const cur = { ...bandRef.current };
          if (event.sourceEvent && event.sourceEvent.shiftKey) {
            const mag = Math.max(0.001, Math.abs(targetResid));
            cur.lo = mag;
            cur.hi = mag;
          } else if (which === "upper") {
            cur.hi = Math.max(0.001, targetResid);
          } else {
            cur.lo = Math.max(0.001, -targetResid);
          }
          bandRef.current = cur;
          redraw();
          const outside = recompute(cur.lo, cur.hi);
          setBandState({ ...cur });
        });
    }

    function predAtPointer(event, gNode, xScale, dataArr) {
      const [px] = d3.pointer(event, gNode.node());
      const co2 = xScale.invert(px);
      // interpolate pred at co2
      let lo = dataArr[0],
        hi = dataArr[dataArr.length - 1];
      for (let i = 0; i < dataArr.length - 1; i++) {
        if (dataArr[i].co2_ppm <= co2 && dataArr[i + 1].co2_ppm >= co2) {
          lo = dataArr[i];
          hi = dataArr[i + 1];
          break;
        }
      }
      if (hi.co2_ppm === lo.co2_ppm) return lo.pred;
      const t = (co2 - lo.co2_ppm) / (hi.co2_ppm - lo.co2_ppm);
      return lo.pred + t * (hi.pred - lo.pred);
    }

    upperLineG.call(makeDrag("upper"));
    lowerLineG.call(makeDrag("lower"));

    redraw();

    chartApiRef.current = { redraw };

    return () => {
      root.selectAll("*").remove();
      chartApiRef.current = null;
    };
  }, [regionData, recompute]);

  // keep chart in sync when band reset externally (region change)
  React.useEffect(() => {
    if (chartApiRef.current) chartApiRef.current.redraw();
  }, [bandState]);

  const threshold = Math.min(bandState.lo, bandState.hi);

  return (
    <section
      style={{
        padding: 20,
        fontFamily: "system-ui, sans-serif",
        color: "#111",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>
          September ice fraction vs CO₂
        </h2>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Region:{" "}
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            style={{
              fontSize: 13,
              padding: "4px 8px",
              color: "#111",
              background: "#fff",
              border: "1px solid #888",
              borderRadius: 4,
            }}
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <svg ref={svgRef} />
        <div style={{ maxHeight: height, overflowY: "auto" }}>
          <OutsideList rows={outsideRows} />
          <div style={{ fontSize: 11, color: "#555", marginTop: 8 }}>
            drag an edge to resize · shift+drag moves both
          </div>
        </div>
      </div>

      <SqlBox region={region} threshold={threshold} count={outsideRows.length} />
    </section>
  );
}