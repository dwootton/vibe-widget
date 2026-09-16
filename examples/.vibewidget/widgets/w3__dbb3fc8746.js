import * as d3 from "https://esm.sh/d3@7";

// Helper to calculate standard deviation of residuals
function getResidSd(rows) {
  if (!rows || rows.length === 0) return 0.05;
  const resids = rows.map(d => d.resid != null ? d.resid : (d.frac - d.pred));
  const mean = d3.mean(resids) || 0;
  const devSq = d3.sum(resids, r => Math.pow(r - mean, 2));
  return Math.sqrt(devSq / Math.max(1, resids.length - 1)) || 0.05;
}

export const QueryDisplay = ({ region, delta, count }) => {
  const queryStr = `SELECT s.year, s.frac, c.co2_ppm \nFROM sept s JOIN co2 c ON s.year = c.year \nWHERE region = '${region}' AND ABS(frac - pred) > ${delta.toFixed(3)}   -- ${count} rows`;
  return (
    <div style={{
      marginTop: 20,
      padding: "12px 18px",
      backgroundColor: "#20222b",
      color: "#e2e8f0",
      borderRadius: "6px",
      fontFamily: "'Fira Code', 'Pitch', monospace",
      fontSize: "12.5px",
      lineHeight: 1.5,
      boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3)",
      whiteSpace: "pre-wrap",
      position: "relative",
      border: "1px solid #334155"
    }}>
      <div style={{
        fontSize: "10px",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#94a3b8",
        marginBottom: "4px"
      }}>
        Live SQL Residual Filter
      </div>
      <code>{queryStr}</code>
    </div>
  );
};

export const ResidualsList = ({ outsideYears, onHoverYear }) => {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      padding: "0 8px 0 16px",
      fontFamily: "'Fira Code', monospace"
    }}>
      <div style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontWeight: 700,
        fontSize: "15px",
        color: "#1e293b",
        marginBottom: "4px",
        borderBottom: "2px solid #e2e8f0",
        paddingBottom: "6px"
      }}>
        Outlier Years ({outsideYears.length})
      </div>
      <div style={{
        fontSize: "11px",
        color: "#64748b",
        marginBottom: "8px",
        fontStyle: "italic"
      }}>
        Sorted by |resid|, descending
      </div>
      <div style={{
        overflowY: "auto",
        maxHeight: "360px",
        paddingRight: "6px"
      }}>
        {outsideYears.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic", padding: "12px 0" }}>
            No points outside current residual band.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {outsideYears.map(item => (
              <div
                key={item.year}
                onMouseEnter={() => onHoverYear && onHoverYear(item.year)}
                onMouseLeave={() => onHoverYear && onHoverYear(null)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "5px 10px",
                  backgroundColor: "#fff",
                  borderRadius: "4px",
                  borderLeft: "3.5px solid #ea580c",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  fontSize: "12px",
                  transition: "transform 0.15s ease",
                  cursor: "default"
                }}
              >
                <span style={{ fontWeight: 600, color: "#0f172a" }}>{item.year}</span>
                <span style={{ color: "#c2410c", fontWeight: 500 }}>
                  {item.resid > 0 ? "+" : ""}{item.resid.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function Widget({ model, React }) {
  const [data, setData] = React.useState(() => model.get("data") || []);
  const [selectedRegion, setSelectedRegion] = React.useState("Barents");
  const [bandState, setBandState] = React.useState({ lo: -0.06, hi: 0.06 });
  const [outsideList, setOutsideList] = React.useState([]);
  const [hoveredYear, setHoveredYear] = React.useState(null);

  const containerRef = React.useRef(null);
  const plotGroupRef = React.useRef(null);
  const bandRef = React.useRef({ lo: -0.06, hi: 0.06 });
  const scalesRef = React.useRef({ x: null, y: null, regionData: [] });

  // Sync data updates from python model
  React.useEffect(() => {
    const handleDataChange = () => {
      setData(model.get("data") || []);
    };
    model.on("change:data", handleDataChange);
    return () => {
      model.off("change:data", handleDataChange);
    };
  }, [model]);

  // Extract regions
  const regions = React.useMemo(() => {
    const set = new Set(data.map(d => d.region));
    const arr = Array.from(set).filter(Boolean).sort();
    return arr.length > 0 ? arr : ["Barents"];
  }, [data]);

  // Region rows sorted by co2_ppm
  const regionRows = React.useMemo(() => {
    return data
      .filter(d => d.region === selectedRegion)
      .map(d => ({
        ...d,
        residVal: d.resid != null ? d.resid : (d.frac - d.pred)
      }))
      .sort((a, b) => a.co2_ppm - b.co2_ppm);
  }, [data, selectedRegion]);

  // Sync band when region changes or on mount
  React.useEffect(() => {
    if (regionRows.length === 0) return;
    const sd = getResidSd(regionRows);
    const initialBand = { lo: -sd, hi: sd };
    bandRef.current = initialBand;
    setBandState(initialBand);

    const outside = regionRows
      .filter(d => d.residVal < initialBand.lo || d.residVal > initialBand.hi)
      .sort((a, b) => Math.abs(b.residVal) - Math.abs(a.residVal));

    setOutsideList(outside.map(d => ({ year: d.year, resid: d.residVal })));

    // Emit initial traits
    model.set("band", initialBand);
    model.set("outside", outside.map(d => d.year));
    model.save_changes();
  }, [selectedRegion, regionRows.length]);

  // Highlight points when hovered from outside list or chart
  React.useEffect(() => {
    if (!plotGroupRef.current) return;
    d3.select(plotGroupRef.current)
      .selectAll(".data-dot")
      .attr("stroke", d => d.year === hoveredYear ? "#000" : "#ffffff")
      .attr("stroke-width", d => d.year === hoveredYear ? 2.5 : 1)
      .attr("r", d => d.year === hoveredYear ? 6.5 : 4.5);
  }, [hoveredYear]);

  // Main Chart construction (data / region changes only, gestures are imperative)
  React.useEffect(() => {
    if (!containerRef.current || regionRows.length === 0) return;

    const container = containerRef.current;
    d3.select(container).selectAll("svg").remove();

    const width = 580;
    const height = 380;
    const margin = { top: 25, right: 25, bottom: 50, left: 55 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height)
      .style("overflow", "visible")
      .style("font-family", "'Fira Code', monospace");

    // Definitions for styling
    const defs = svg.append("defs");
    const clipId = `plot-clip-${Math.random().toString(36).slice(2, 9)}`;
    defs.append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    plotGroupRef.current = g.node();

    // Scales
    const xExt = d3.extent(regionRows, d => d.co2_ppm);
    const xPadding = (xExt[1] - xExt[0]) * 0.05 || 2;
    const xScale = d3.scaleLinear()
      .domain([xExt[0] - xPadding, xExt[1] + xPadding])
      .range([0, innerWidth]);

    const yMin = Math.min(0, d3.min(regionRows, d => Math.min(d.frac, d.pred)) || 0);
    const yMax = Math.max(1, d3.max(regionRows, d => Math.max(d.frac, d.pred)) || 1);
    const yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([innerHeight, 0])
      .nice();

    scalesRef.current = { x: xScale, y: yScale, regionData: regionRows };

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(6).tickFormat(d3.format(".0f"));
    const yAxis = d3.axisLeft(yScale).ticks(6).tickFormat(d3.format(".2f"));

    // Gridlines
    g.append("g")
      .attr("class", "grid")
      .attr("stroke-opacity", 0.08)
      .call(d3.axisLeft(yScale).ticks(6).tickSize(-innerWidth).tickFormat(""));

    // Axis groups
    const gX = g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis);
    gX.select(".domain").attr("stroke", "#94a3b8");
    gX.selectAll("text").attr("fill", "#475569").attr("font-size", "11px");

    const gY = g.append("g").call(yAxis);
    gY.select(".domain").attr("stroke", "#94a3b8");
    gY.selectAll("text").attr("fill", "#475569").attr("font-size", "11px");

    // Axis Labels
    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 40)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .attr("font-size", "12px")
      .attr("font-weight", 600)
      .text("Atmospheric CO₂ (ppm)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .attr("font-size", "12px")
      .attr("font-weight", 600)
      .text("Sea Ice Fraction (Sept)");

    // Clinned chart layer
    const chartContent = g.append("g").attr("clip-path", `url(#${clipId})`);

    // Band area
    const bandAreaPath = chartContent.append("path")
      .attr("class", "band-area")
      .attr("fill", "#0284c7")
      .attr("fill-opacity", 0.12);

    // Band edges (hi and lo)
    const hiEdgeLine = chartContent.append("path")
      .attr("class", "band-edge-hi")
      .attr("stroke", "#0284c7")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4 3");

    const loEdgeLine = chartContent.append("path")
      .attr("class", "band-edge-lo")
      .attr("stroke", "#0284c7")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4 3");

    // Fitted line
    const lineGen = d3.line()
      .x(d => xScale(d.co2_ppm))
      .y(d => yScale(d.pred));

    chartContent.append("path")
      .datum(regionRows)
      .attr("fill", "none")
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 2)
      .attr("d", lineGen);

    // Draggable hit areas
    const hiDragHit = chartContent.append("path")
      .attr("class", "band-hit-hi")
      .attr("stroke", "transparent")
      .attr("stroke-width", 16)
      .attr("fill", "none")
      .style("cursor", "ns-resize");

    const loDragHit = chartContent.append("path")
      .attr("class", "band-hit-lo")
      .attr("stroke", "transparent")
      .attr("stroke-width", 16)
      .attr("fill", "none")
      .style("cursor", "ns-resize");

    // Hover tooltip overlay
    const tooltip = d3.select(container)
      .append("div")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background", "rgba(15, 23, 42, 0.9)")
      .style("color", "#fff")
      .style("padding", "6px 10px")
      .style("border-radius", "4px")
      .style("font-size", "11px")
      .style("pointer-events", "none")
      .style("z-index", "10")
      .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.1)");

    // Dots
    const dotsGroup = chartContent.append("g").attr("class", "dots-layer");
    const dots = dotsGroup.selectAll(".data-dot")
      .data(regionRows)
      .enter()
      .append("circle")
      .attr("class", "data-dot")
      .attr("cx", d => xScale(d.co2_ppm))
      .attr("cy", d => yScale(d.frac))
      .attr("r", 4.5)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseenter", (evt, d) => {
        setHoveredYear(d.year);
        tooltip
          .style("visibility", "visible")
          .html(`<strong>${d.year}</strong><br/>Frac: ${d.frac.toFixed(3)}<br/>CO₂: ${d.co2_ppm.toFixed(1)} ppm<br/>Resid: ${d.residVal.toFixed(3)}`);
      })
      .on("mousemove", (evt) => {
        const bounds = container.getBoundingClientRect();
        tooltip
          .style("top", `${evt.clientY - bounds.top - 42}px`)
          .style("left", `${evt.clientX - bounds.left + 12}px`);
      })
      .on("mouseleave", () => {
        setHoveredYear(null);
        tooltip.style("visibility", "hidden");
      });

    // Function to update marks imperatively without destroying SVG
    function updateBandVisuals(currentBand) {
      const areaGen = d3.area()
        .x(d => xScale(d.co2_ppm))
        .y0(d => yScale(d.pred + currentBand.lo))
        .y1(d => yScale(d.pred + currentBand.hi));

      const hiLineGen = d3.line()
        .x(d => xScale(d.co2_ppm))
        .y(d => yScale(d.pred + currentBand.hi));

      const loLineGen = d3.line()
        .x(d => xScale(d.co2_ppm))
        .y(d => yScale(d.pred + currentBand.lo));

      bandAreaPath.attr("d", areaGen(regionRows));
      hiEdgeLine.attr("d", hiLineGen(regionRows));
      loEdgeLine.attr("d", loLineGen(regionRows));
      hiDragHit.attr("d", hiLineGen(regionRows));
      loDragHit.attr("d", loLineGen(regionRows));

      dots.attr("fill", d => {
        const isOutside = d.residVal < currentBand.lo || d.residVal > currentBand.hi;
        return isOutside ? "#ea580c" : "#cbd5e1";
      });
    }

    // Initial visual draw
    updateBandVisuals(bandRef.current);

    // Drag behavior setup
    let dragStartBand = { ...bandRef.current };
    let dragStartY = 0;

    function applyDrag(edge, event) {
      const [, currentY] = d3.pointer(event, g.node());
      const deltaFrac = yScale.invert(currentY) - yScale.invert(dragStartY);
      const isShift = event.sourceEvent && event.sourceEvent.shiftKey;

      let nextBand = { ...dragStartBand };
      if (isShift) {
        // Shift+drag moves both band edges together
        nextBand.lo = dragStartBand.lo + deltaFrac;
        nextBand.hi = dragStartBand.hi + deltaFrac;
      } else if (edge === "hi") {
        nextBand.hi = Math.max(dragStartBand.hi + deltaFrac, nextBand.lo + 0.002);
      } else if (edge === "lo") {
        nextBand.lo = Math.min(dragStartBand.lo + deltaFrac, nextBand.hi - 0.002);
      }

      bandRef.current = nextBand;
      updateBandVisuals(nextBand);

      const outside = regionRows
        .filter(d => d.residVal < nextBand.lo || d.residVal > nextBand.hi)
        .sort((a, b) => Math.abs(b.residVal) - Math.abs(a.residVal));

      setBandState({ ...nextBand });
      setOutsideList(outside.map(d => ({ year: d.year, resid: d.residVal })));

      // Sync trait state
      model.set("band", { lo: nextBand.lo, hi: nextBand.hi });
      model.set("outside", outside.map(d => d.year));
      model.save_changes();
    }

    const hiDrag = d3.drag()
      .on("start", (event) => {
        dragStartBand = { ...bandRef.current };
        const [, y] = d3.pointer(event, g.node());
        dragStartY = y;
      })
      .on("drag", (event) => applyDrag("hi", event));

    const loDrag = d3.drag()
      .on("start", (event) => {
        dragStartBand = { ...bandRef.current };
        const [, y] = d3.pointer(event, g.node());
        dragStartY = y;
      })
      .on("drag", (event) => applyDrag("lo", event));

    hiDragHit.call(hiDrag);
    loDragHit.call(loDrag);

    return () => {
      tooltip.remove();
      svg.remove();
    };
  }, [regionRows]);

  // Compute live absolute threshold for SQL clause
  const deltaVal = Math.max(Math.abs(bandState.lo), Math.abs(bandState.hi));

  return (
    <div style={{
      backgroundColor: "#fdfbf7",
      color: "#1e293b",
      padding: "24px 30px",
      borderRadius: "12px",
      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)",
      border: "1px solid #f1ece1",
      maxWidth: "960px",
      margin: "0 auto",
      boxSizing: "border-box"
    }}>
      {/* Header bar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        borderBottom: "1px solid #e7dfd5",
        paddingBottom: "16px",
        marginBottom: "20px"
      }}>
        <div>
          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 800,
            fontSize: "24px",
            margin: "0 0 6px 0",
            color: "#0f172a",
            letterSpacing: "-0.01em"
          }}>
            Sea Ice vs CO₂ Residual Envelope
          </h2>
          <div style={{
            fontSize: "13px",
            color: "#64748b",
            fontFamily: "'Fira Code', monospace"
          }}>
            Drag parallel edges to filter anomalies · <kbd style={{ background: "#e2e8f0", padding: "1px 5px", borderRadius: "3px" }}>Shift+Drag</kbd> to translate band
          </div>
        </div>

        {/* Region Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "#475569",
            textTransform: "uppercase",
            letterSpacing: "0.05em"
          }}>
            Region
          </label>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            style={{
              padding: "6px 12px",
              fontFamily: "'Fira Code', monospace",
              fontSize: "13px",
              fontWeight: 600,
              backgroundColor: "#fff",
              border: "1.5px solid #cbd5e1",
              borderRadius: "6px",
              color: "#0f172a",
              cursor: "pointer",
              outline: "none"
            }}
          >
            {regions.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main visualization grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 240px",
        gap: "20px",
        alignItems: "start"
      }}>
        <div style={{ position: "relative" }} ref={containerRef} />
        <ResidualsList outsideYears={outsideList} onHoverYear={setHoveredYear} />
      </div>

      {/* Live query expression below chart */}
      <QueryDisplay region={selectedRegion} delta={deltaVal} count={outsideList.length} />
    </div>
  );
}