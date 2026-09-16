import * as d3 from "https://esm.sh/d3@7";

// Helper: parse data whether it's an array of objects or column-oriented dict
function parseData(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    const keys = Object.keys(raw);
    if (keys.length === 0) return [];
    const firstCol = raw[keys[0]];
    const length = Array.isArray(firstCol)
      ? firstCol.length
      : Object.keys(firstCol).length;
    const rows = [];
    for (let i = 0; i < length; i++) {
      const row = {};
      for (const k of keys) {
        row[k] = Array.isArray(raw[k]) ? raw[k][i] : raw[k][i] ?? raw[k][String(i)];
      }
      rows.push(row);
    }
    return rows;
  }
  return [];
}

export const RegionSelect = ({ regions, selected, onChange }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
    <label
      htmlFor="region-select"
      style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: "15px",
        fontStyle: "italic",
        color: "#2b2823",
        fontWeight: 600,
      }}
    >
      Region:
    </label>
    <select
      id="region-select"
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      style={{
        appearance: "none",
        WebkitAppearance: "none",
        backgroundColor: "#fffdf9",
        border: "1px solid #d4cdc5",
        borderRadius: "4px",
        padding: "6px 28px 6px 12px",
        fontFamily: "'Fira Code', 'Pitch', monospace",
        fontSize: "13px",
        color: "#1e1b18",
        fontWeight: 600,
        cursor: "pointer",
        backgroundImage:
          "url('data:image/svg+xml;utf8,<svg fill=\"%23333\" height=\"18\" viewBox=\"0 0 24 24\" width=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7 10l5 5 5-5z\"/></svg>')",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 6px center",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {regions.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  </div>
);

export const OutliersList = ({ outliers }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "#fffdfa",
      border: "1px solid #eae3d9",
      borderRadius: "6px",
      padding: "14px 16px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
      boxSizing: "border-box",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        borderBottom: "1px solid #eae3d9",
        paddingBottom: 8,
        marginBottom: 8,
      }}
    >
      <span
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "15px",
          fontWeight: 700,
          color: "#1f1d1a",
          letterSpacing: "0.2px",
        }}
      >
        Outliers ({outliers.length})
      </span>
      <span
        style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: "10px",
          color: "#c2410c",
          fontWeight: 600,
          textTransform: "uppercase",
        }}
      >
        sorted |resid|
      </span>
    </div>
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        maxHeight: "360px",
        paddingRight: 4,
      }}
    >
      {outliers.length === 0 ? (
        <div
          style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: "12px",
            color: "#8a8378",
            padding: "16px 0",
            fontStyle: "italic",
          }}
        >
          No years outside band
        </div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "'Fira Code', monospace",
            fontSize: "12px",
          }}
        >
          <thead>
            <tr style={{ color: "#7a7267", textAlign: "left" }}>
              <th style={{ padding: "4px 2px", fontWeight: 500 }}>Year</th>
              <th style={{ padding: "4px 2px", textAlign: "right", fontWeight: 500 }}>
                |Resid|
              </th>
              <th style={{ padding: "4px 2px", textAlign: "right", fontWeight: 500 }}>
                Frac
              </th>
            </tr>
          </thead>
          <tbody>
            {outliers.map((row) => (
              <tr
                key={row.year}
                style={{
                  borderTop: "1px dotted #f0eae1",
                }}
              >
                <td
                  style={{
                    padding: "5px 2px",
                    fontWeight: 700,
                    color: "#c2410c",
                  }}
                >
                  {row.year}
                </td>
                <td
                  style={{
                    padding: "5px 2px",
                    textAlign: "right",
                    color: "#2d2924",
                  }}
                >
                  {Math.abs(row.resid).toFixed(4)}
                </td>
                <td
                  style={{
                    padding: "5px 2px",
                    textAlign: "right",
                    color: "#6b6359",
                  }}
                >
                  {row.frac.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);

export const SqlBox = ({ region, hi, count }) => {
  const sql = `SELECT s.year, s.frac, c.co2_ppm\nFROM sept s\nJOIN co2 c ON s.year = c.year\nWHERE region = '${region}'\n  AND ABS(frac - pred) > ${hi.toFixed(
    3
  )}   -- ${count} row${count === 1 ? "" : "s"}`;

  return (
    <div
      style={{
        marginTop: 22,
        background: "#1e1d1a",
        borderRadius: "6px",
        padding: "14px 18px",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)",
        border: "1px solid #33302a",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "1px",
            color: "#e07a3c",
            fontWeight: 700,
          }}
        >
          LIVE SQL QUERY
        </span>
        <span
          style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: "11px",
            color: "#a8a29e",
          }}
        >
          matched: {count}
        </span>
      </div>
      <pre
        style={{
          margin: 0,
          fontFamily: "'Fira Code', 'Pitch', monospace",
          fontSize: "12.5px",
          lineHeight: "1.55",
          color: "#f5f3ef",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        <code>{sql}</code>
      </pre>
    </div>
  );
};

export default function Widget({ model, React }) {
  const [dataVersion, setDataVersion] = React.useState(0);
  const [region, setRegion] = React.useState("Barents");
  const [bandState, setBandState] = React.useState({ lo: -0.05, hi: 0.05 });
  const [outliersState, setOutliersState] = React.useState([]);

  const containerRef = React.useRef(null);
  const tooltipRef = React.useRef(null);
  const bandRef = React.useRef({ lo: -0.05, hi: 0.05 });
  const stateUpdateRef = React.useRef(null);

  // Subscribe to changes in model input trait "data"
  React.useEffect(() => {
    const handleDataChange = () => {
      setDataVersion((v) => v + 1);
    };
    if (model && model.on) {
      model.on("change:data", handleDataChange);
    }
    return () => {
      if (model && model.off) {
        model.off("change:data", handleDataChange);
      }
    };
  }, [model]);

  // Parse rows
  const allRows = React.useMemo(() => {
    return parseData(model ? model.get("data") : []);
  }, [dataVersion, model]);

  // Unique regions
  const regions = React.useMemo(() => {
    const set = new Set();
    allRows.forEach((d) => {
      if (d.region) set.add(d.region);
    });
    const arr = Array.from(set).sort();
    return arr.length > 0 ? arr : ["Barents"];
  }, [allRows]);

  // Rows for active region
  const regionRows = React.useMemo(() => {
    const filtered = allRows.filter((d) => d.region === region);
    return filtered.sort((a, b) => a.co2_ppm - b.co2_ppm);
  }, [allRows, region]);

  // Initial SD calculation for the region
  const defaultSd = React.useMemo(() => {
    if (!regionRows.length) return 0.05;
    const resids = regionRows.map((d) => Number(d.resid) || 0);
    const mean = d3.mean(resids) || 0;
    const variance = d3.variance(resids) || 0.0025;
    const sd = Math.sqrt(variance);
    return sd > 0.0001 ? sd : 0.05;
  }, [regionRows]);

  // Reset band to +/- 1 SD when region changes
  React.useEffect(() => {
    const initBand = { lo: -defaultSd, hi: defaultSd };
    bandRef.current = initBand;
    setBandState(initBand);

    // Initial output sync
    const outYears = regionRows
      .filter((d) => d.resid < initBand.lo || d.resid > initBand.hi)
      .sort((a, b) => Math.abs(b.resid) - Math.abs(a.resid));

    setOutliersState(outYears);

    if (model && model.set) {
      model.set("band", { lo: initBand.lo, hi: initBand.hi });
      model.set(
        "outside",
        outYears.map((d) => d.year)
      );
      if (model.save_changes) model.save_changes();
    }
  }, [region, defaultSd, regionRows, model]);

  // Bridge imperative updates from drag to React state & model
  stateUpdateRef.current = (newBand) => {
    bandRef.current = newBand;
    setBandState(newBand);

    const outYears = regionRows
      .filter((d) => d.resid < newBand.lo || d.resid > newBand.hi)
      .sort((a, b) => Math.abs(b.resid) - Math.abs(a.resid));

    setOutliersState(outYears);

    if (model && model.set) {
      model.set("band", { lo: newBand.lo, hi: newBand.hi });
      model.set(
        "outside",
        outYears.map((d) => d.year)
      );
      if (model.save_changes) model.save_changes();
    }
  };

  // Build / re-render Chart effect (ONLY depends on data/region, NOT drag state!)
  React.useEffect(() => {
    if (!containerRef.current || regionRows.length === 0) return;

    const container = containerRef.current;
    d3.select(container).selectAll("*").remove();

    const width = 640;
    const height = 400;
    const margin = { top: 24, right: 28, bottom: 52, left: 62 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3
      .select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height)
      .style("display", "block")
      .style("overflow", "visible");

    // Defs for styling
    const defs = svg.append("defs");
    const clip = defs
      .append("clipPath")
      .attr("id", "plot-clip")
      .append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight);

    // Scales fitted tightly to data of the shown region
    const xExtent = d3.extent(regionRows, (d) => d.co2_ppm);
    const xPad = (xExtent[1] - xExtent[0]) * 0.05 || 2;
    const xScale = d3
      .scaleLinear()
      .domain([xExtent[0] - xPad, xExtent[1] + xPad])
      .range([0, innerWidth]);

    const yExtent = d3.extent(regionRows, (d) => d.frac);
    const yPad = (yExtent[1] - yExtent[0]) * 0.08 || 0.05;
    const yScale = d3
      .scaleLinear()
      .domain([yExtent[0] - yPad, yExtent[1] + yPad])
      .range([innerHeight, 0]);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Subtle Gridlines
    const yTicks = yScale.ticks(6);
    g.append("g")
      .attr("class", "grid y-grid")
      .selectAll("line")
      .data(yTicks)
      .join("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", (d) => yScale(d))
      .attr("y2", (d) => yScale(d))
      .attr("stroke", "#eee7de")
      .attr("stroke-dasharray", "2,3");

    // Axes
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(7)
      .tickFormat(d3.format(".0f"));
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(6)
      .tickFormat(d3.format(".2f"));

    const gx = g
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis);
    gx.select(".domain").attr("stroke", "#c9c0b5");
    gx.selectAll(".tick line").attr("stroke", "#c9c0b5");
    gx.selectAll(".tick text")
      .attr("fill", "#544e45")
      .attr("font-family", "'Fira Code', monospace")
      .attr("font-size", "11px");

    // Clear space below x-axis
    gx.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", 40)
      .attr("fill", "#2b2823")
      .attr("font-family", "'Playfair Display', Georgia, serif")
      .attr("font-size", "13px")
      .attr("font-style", "italic")
      .attr("text-anchor", "middle")
      .text("Atmospheric CO₂ concentration (ppm)");

    const gy = g.append("g").call(yAxis);
    gy.select(".domain").attr("stroke", "#c9c0b5");
    gy.selectAll(".tick line").attr("stroke", "#c9c0b5");
    gy.selectAll(".tick text")
      .attr("fill", "#544e45")
      .attr("font-family", "'Fira Code', monospace")
      .attr("font-size", "11px");

    gy.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -44)
      .attr("fill", "#2b2823")
      .attr("font-family", "'Playfair Display', Georgia, serif")
      .attr("font-size", "13px")
      .attr("font-style", "italic")
      .attr("text-anchor", "middle")
      .text("Sea Ice Fraction (September)");

    // Plot contents group with clip path
    const plot = g.append("g").attr("clip-path", "url(#plot-clip)");

    // Band shaded polygon
    const bandArea = plot
      .append("polygon")
      .attr("fill", "#e2ded6")
      .attr("fill-opacity", 0.45)
      .attr("stroke", "none");

    // Fitted regression line through pred values
    const lineGenerator = d3
      .line()
      .x((d) => xScale(d.co2_ppm))
      .y((d) => yScale(d.pred));

    plot
      .append("path")
      .datum(regionRows)
      .attr("fill", "none")
      .attr("stroke", "#2b2823")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4,4")
      .attr("d", lineGenerator);

    // Draggable edges (upper and lower lines parallel to pred)
    const upperLine = plot
      .append("path")
      .attr("fill", "none")
      .attr("stroke", "#8d857a")
      .attr("stroke-width", 1.8);

    const lowerLine = plot
      .append("path")
      .attr("fill", "none")
      .attr("stroke", "#8d857a")
      .attr("stroke-width", 1.8);

    // Hit areas for dragging
    const upperHit = g
      .append("path")
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 18)
      .attr("cursor", "ns-resize");

    const lowerHit = g
      .append("path")
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 18)
      .attr("cursor", "ns-resize");

    // Band middle drag area (shift drag or body drag helper)
    const middleHit = g
      .append("path")
      .attr("fill", "transparent")
      .attr("cursor", "grab");

    // Scatter dots
    const dotsGroup = plot.append("g").attr("class", "dots");
    const dots = dotsGroup
      .selectAll("circle")
      .data(regionRows)
      .join("circle")
      .attr("cx", (d) => xScale(d.co2_ppm))
      .attr("cy", (d) => yScale(d.frac))
      .attr("r", 5)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.2)
      .attr("cursor", "pointer")
      .style("transition", "fill 200ms ease, r 150ms ease");

    // Tooltip handling
    const tooltip = d3.select(tooltipRef.current);
    dots
      .on("mouseenter", function (event, d) {
        d3.select(this)
          .attr("r", 7.5)
          .attr("stroke", "#1f1d1a")
          .attr("stroke-width", 1.8);
        const [px, py] = d3.pointer(event, container);
        tooltip
          .style("display", "block")
          .style("left", `${px + 14}px`)
          .style("top", `${py - 24}px`).html(`
            <div style="font-weight: 700; font-size: 13px; color: #1e1b18; font-family: 'Playfair Display', serif;">${d.year}</div>
            <div style="margin-top: 3px; font-family: 'Fira Code', monospace; font-size: 11px; color: #544e45;">
              CO₂: <b>${d.co2_ppm.toFixed(1)}</b> ppm<br/>
              Frac: <b>${d.frac.toFixed(3)}</b><br/>
              Pred: <b>${d.pred.toFixed(3)}</b><br/>
              Resid: <b style="color: ${
                Math.abs(d.resid) > bandRef.current.hi ? "#c2410c" : "#2b2823"
              };">${d.resid > 0 ? "+" : ""}${d.resid.toFixed(4)}</b>
            </div>
          `);
      })
      .on("mousemove", function (event) {
        const [px, py] = d3.pointer(event, container);
        tooltip.style("left", `${px + 14}px`).style("top", `${py - 24}px`);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("r", 5).attr("stroke", "#ffffff").attr("stroke-width", 1.2);
        tooltip.style("display", "none");
      });

    // Function to imperatively update the band geometry & dot colors
    function updateBandVisuals() {
      const curLo = bandRef.current.lo;
      const curHi = bandRef.current.hi;

      // Upper and lower paths
      const upperGen = d3
        .line()
        .x((d) => xScale(d.co2_ppm))
        .y((d) => yScale(d.pred + curHi));

      const lowerGen = d3
        .line()
        .x((d) => xScale(d.co2_ppm))
        .y((d) => yScale(d.pred + curLo));

      const upperD = upperGen(regionRows);
      const lowerD = lowerGen(regionRows);

      upperLine.attr("d", upperD);
      lowerLine.attr("d", lowerD);
      upperHit.attr("d", upperD);
      lowerHit.attr("d", lowerD);

      // Polygon points
      const topPts = regionRows.map((d) => [xScale(d.co2_ppm), yScale(d.pred + curHi)]);
      const botPts = regionRows
        .slice()
        .reverse()
        .map((d) => [xScale(d.co2_ppm), yScale(d.pred + curLo)]);
      const allPts = topPts.concat(botPts);
      bandArea.attr("points", allPts.map((p) => p.join(",")).join(" "));

      // Update dot fill colors
      dots.attr("fill", (d) => {
        const isOut = d.resid < curLo || d.resid > curHi;
        return isOut ? "#c2410c" : "#c5beb4"; // dark orange vs light grey
      });
    }

    // Initial render of band
    updateBandVisuals();

    // Drag handlers
    let startBand = null;
    let startY = 0;

    const dragUpper = d3
      .drag()
      .on("start", (event) => {
        startBand = { ...bandRef.current };
        const [, y] = d3.pointer(event, g.node());
        startY = y;
      })
      .on("drag", (event) => {
        const [, y] = d3.pointer(event, g.node());
        // Inverting dy in data units: y is inverted (y=0 is top)
        const deltaFrac = yScale.invert(startY) - yScale.invert(y);

        let newHi = startBand.hi + deltaFrac;
        let newLo = startBand.lo;

        if (event.sourceEvent.shiftKey) {
          // Shift+drag moves both together
          newLo = startBand.lo + deltaFrac;
        } else {
          // Narrow or widen
          if (newHi < 0.001) newHi = 0.001;
        }

        bandRef.current = { lo: newLo, hi: newHi };
        updateBandVisuals();
        if (stateUpdateRef.current) {
          stateUpdateRef.current(bandRef.current);
        }
      });

    const dragLower = d3
      .drag()
      .on("start", (event) => {
        startBand = { ...bandRef.current };
        const [, y] = d3.pointer(event, g.node());
        startY = y;
      })
      .on("drag", (event) => {
        const [, y] = d3.pointer(event, g.node());
        const deltaFrac = yScale.invert(startY) - yScale.invert(y);

        let newLo = startBand.lo + deltaFrac;
        let newHi = startBand.hi;

        if (event.sourceEvent.shiftKey) {
          // Shift+drag moves both together
          newHi = startBand.hi + deltaFrac;
        } else {
          if (newLo > -0.001) newLo = -0.001;
        }

        bandRef.current = { lo: newLo, hi: newHi };
        updateBandVisuals();
        if (stateUpdateRef.current) {
          stateUpdateRef.current(bandRef.current);
        }
      });

    upperHit.call(dragUpper);
    lowerHit.call(dragLower);

    return () => {
      d3.select(container).selectAll("*").remove();
    };
  }, [regionRows]);

  return (
    <div
      style={{
        background: "#fdfbf7",
        padding: "24px 28px",
        fontFamily: "'Playfair Display', Georgia, serif",
        color: "#2b2823",
        borderRadius: "8px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
        maxWidth: "960px",
        margin: "0 auto",
        position: "relative",
      }}
    >
      {/* Header section */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderBottom: "1px solid #eae3d9",
          paddingBottom: 14,
          marginBottom: 18,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 700,
              letterSpacing: "-0.3px",
              color: "#181715",
            }}
          >
            Arctic Ice Residual Band
          </h2>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: "13px",
              color: "#6e675d",
              fontStyle: "italic",
            }}
          >
            Drag the upper or lower edge to widen/narrow the band. Hold <b>Shift</b> to
            shift both together.
          </p>
        </div>
        <RegionSelect
          regions={regions}
          selected={region}
          onChange={(newR) => setRegion(newR)}
        />
      </div>

      {/* Main visualization grid: Plot (left) + Outlier List (right) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 240px",
          gap: "20px",
          alignItems: "stretch",
        }}
      >
        <div style={{ position: "relative" }}>
          {/* Legend badge overlay */}
          <div
            style={{
              display: "flex",
              gap: 14,
              marginBottom: 4,
              fontSize: "11px",
              fontFamily: "'Fira Code', monospace",
              color: "#665f55",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#c2410c",
                  display: "inline-block",
                }}
              />
              Outside band (|resid| &gt; {Math.abs(bandState.hi).toFixed(3)})
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#c5beb4",
                  display: "inline-block",
                }}
              />
              Inside band
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 14,
                  height: 0,
                  borderTop: "2px dashed #2b2823",
                  display: "inline-block",
                }}
              />
              Pred fit
            </span>
          </div>

          <div
            ref={containerRef}
            style={{
              width: "100%",
              minHeight: "400px",
              background: "#fffdf9",
              border: "1px solid #ede7df",
              borderRadius: "6px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
            }}
          />

          {/* Floating Hover Tooltip */}
          <div
            ref={tooltipRef}
            style={{
              position: "absolute",
              display: "none",
              pointerEvents: "none",
              zIndex: 999,
              background: "rgba(255, 253, 249, 0.97)",
              border: "1px solid #d4cdc5",
              boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
              padding: "8px 12px",
              borderRadius: "5px",
              minWidth: "120px",
            }}
          />
        </div>

        {/* Right side outlier list */}
        <div>
          <OutliersList outliers={outliersState} />
        </div>
      </div>

      {/* SQL block below chart with ample clear space */}
      <SqlBox region={region} hi={Math.abs(bandState.hi)} count={outliersState.length} />
    </div>
  );
}