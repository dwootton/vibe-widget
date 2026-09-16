import * as d3 from "https://esm.sh/d3@7";

export const RegionSelector = ({ regions, selectedRegion, onSelect }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
    <label
      htmlFor="region-select"
      style={{
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "14px",
        fontWeight: 600,
        color: "#1e293b",
        letterSpacing: "0.02em"
      }}
    >
      Region:
    </label>
    <select
      id="region-select"
      value={selectedRegion}
      onChange={(e) => onSelect(e.target.value)}
      style={{
        padding: "6px 14px",
        borderRadius: "6px",
        border: "1px solid #cbd5e1",
        backgroundColor: "#ffffff",
        color: "#0f172a",
        fontSize: "14px",
        fontFamily: "'Fira Code', Menlo, monospace",
        cursor: "pointer",
        outline: "none",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
      }}
    >
      {regions.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
    <span
      style={{
        fontSize: "12px",
        color: "#64748b",
        fontFamily: "system-ui, sans-serif",
        marginLeft: "auto"
      }}
    >
      Drag edge to widen/narrow · Shift+drag moves both
    </span>
  </div>
);

export const OutsideYearsList = ({ outsideItems, onHoverYear, hoveredYear }) => (
  <div
    style={{
      width: "190px",
      minWidth: "170px",
      borderLeft: "1px solid #e2e8f0",
      paddingLeft: "16px",
      display: "flex",
      flexDirection: "column",
      maxHeight: "380px"
    }}
  >
    <div
      style={{
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "13px",
        fontWeight: 700,
        color: "#0f172a",
        marginBottom: "4px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline"
      }}
    >
      <span>Outside Band</span>
      <span
        style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: "11px",
          color: "#ea580c",
          backgroundColor: "#ffedd5",
          padding: "1px 6px",
          borderRadius: "10px",
          fontWeight: 600
        }}
      >
        {outsideItems.length}
      </span>
    </div>
    <div
      style={{
        fontSize: "11px",
        color: "#64748b",
        marginBottom: "8px",
        fontFamily: "system-ui, sans-serif"
      }}
    >
      Sorted by |resid| ↓
    </div>
    <div
      style={{
        overflowY: "auto",
        flex: 1,
        paddingRight: "4px",
        display: "flex",
        flexDirection: "column",
        gap: "4px"
      }}
    >
      {outsideItems.length === 0 ? (
        <div style={{ color: "#94a3b8", fontSize: "12px", fontStyle: "italic", paddingTop: "8px" }}>
          None outside band
        </div>
      ) : (
        outsideItems.map((item) => {
          const isHovered = hoveredYear === item.year;
          return (
            <div
              key={item.year}
              onMouseEnter={() => onHoverYear(item.year)}
              onMouseLeave={() => onHoverYear(null)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "3px 6px",
                borderRadius: "4px",
                backgroundColor: isHovered ? "#fee2e2" : "#f8fafc",
                border: isHovered ? "1px solid #f87171" : "1px solid #e2e8f0",
                cursor: "pointer",
                transition: "all 0.15s ease",
                fontFamily: "'Fira Code', Menlo, monospace",
                fontSize: "12px"
              }}
            >
              <span style={{ fontWeight: 600, color: "#9a3412" }}>{item.year}</span>
              <span style={{ color: "#475569", fontSize: "11px" }}>
                {item.resid > 0 ? `+${item.resid.toFixed(3)}` : item.resid.toFixed(3)}
              </span>
            </div>
          );
        })
      )}
    </div>
  </div>
);

export const SqlQueryDisplay = ({ region, band, outsideCount }) => {
  const isSymmetric = Math.abs(Math.abs(band.hi) - Math.abs(band.lo)) < 0.002;
  const whereClause = isSymmetric
    ? `ABS(frac - pred) > ${Math.abs(band.hi).toFixed(3)}`
    : `(frac - pred > ${band.hi.toFixed(3)} OR frac - pred < ${band.lo.toFixed(3)})`;

  return (
    <div
      style={{
        marginTop: "16px",
        padding: "10px 14px",
        backgroundColor: "#1e293b",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        overflowX: "auto"
      }}
    >
      <code
        style={{
          fontFamily: "'Fira Code', 'JetBrains Mono', Menlo, monospace",
          fontSize: "12px",
          color: "#e2e8f0",
          whiteSpace: "pre",
          display: "block",
          lineHeight: "1.5"
        }}
      >
        <span style={{ color: "#93c5fd" }}>SELECT</span> s.year, s.frac, c.co2_ppm{" "}
        <span style={{ color: "#93c5fd" }}>FROM</span> sept s{" "}
        <span style={{ color: "#93c5fd" }}>JOIN</span> co2 c <span style={{ color: "#93c5fd" }}>ON</span> s.year = c.year{" "}
        <span style={{ color: "#93c5fd" }}>WHERE</span> region ={" "}
        <span style={{ color: "#86efac" }}>'{region}'</span>{" "}
        <span style={{ color: "#93c5fd" }}>AND</span> {whereClause}{"   "}
        <span style={{ color: "#94a3b8" }}>-- {outsideCount} rows</span>
      </code>
    </div>
  );
};

export const ScatterPlot = ({
  model,
  React,
  regionData,
  region,
  band,
  onBandChange,
  hoveredYear,
  onHoverYear
}) => {
  const containerRef = React.useRef(null);
  const bandRef = React.useRef(band);
  bandRef.current = band;

  React.useEffect(() => {
    if (!containerRef.current || !regionData || regionData.length === 0) return;

    const width = 560;
    const height = 370;
    const margin = { top: 20, right: 30, bottom: 45, left: 55 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const sortedData = [...regionData].sort((a, b) => a.co2_ppm - b.co2_ppm);

    // Compute regression line slope and intercept from pred vs co2_ppm
    const p1 = sortedData[0];
    const p2 = sortedData[sortedData.length - 1];
    const slope = (p2.pred - p1.pred) / (p2.co2_ppm - p1.co2_ppm || 1);
    const intercept = p1.pred - slope * p1.co2_ppm;
    const getPredAtCo2 = (co2) => slope * co2 + intercept;

    // Set up scales fitted to region data
    const xExtent = d3.extent(sortedData, (d) => d.co2_ppm);
    const xPad = (xExtent[1] - xExtent[0]) * 0.05 || 1;
    const xScale = d3
      .scaleLinear()
      .domain([xExtent[0] - xPad, xExtent[1] + xPad])
      .range([0, innerWidth]);

    const yExtent = d3.extent(sortedData, (d) => d.frac);
    const yPad = Math.max((yExtent[1] - yExtent[0]) * 0.12, 0.04);
    const yScale = d3
      .scaleLinear()
      .domain([yExtent[0] - yPad, yExtent[1] + yPad])
      .range([innerHeight, 0]);

    // Create SVG container
    const svg = d3
      .select(containerRef.current)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height)
      .style("display", "block")
      .style("user-select", "none");

    // Clip path for plot area
    const clipId = `clip-${Math.random().toString(36).substring(2, 9)}`;
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Axes
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(6)
      .tickFormat(d3.format(".0f"))
      .tickSizeOuter(0);
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(6)
      .tickFormat(d3.format(".2f"))
      .tickSizeOuter(0);

    // Subtle grid lines
    g.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(6)
          .tickSize(-innerHeight)
          .tickFormat("")
      )
      .attr("stroke-opacity", 0.06)
      .attr("stroke", "#0f172a");

    g.append("g")
      .attr("class", "grid")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(6)
          .tickSize(-innerWidth)
          .tickFormat("")
      )
      .attr("stroke-opacity", 0.06)
      .attr("stroke", "#0f172a");

    // Render X Axis
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr("color", "#64748b")
      .selectAll("text")
      .style("font-family", "'Fira Code', monospace")
      .style("font-size", "11px");

    // X Axis Label
    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 36)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .attr("font-family", "Georgia, 'Times New Roman', serif")
      .attr("font-size", "12px")
      .text("CO₂ (ppm)");

    // Render Y Axis
    g.append("g")
      .call(yAxis)
      .attr("color", "#64748b")
      .selectAll("text")
      .style("font-family", "'Fira Code', monospace")
      .style("font-size", "11px");

    // Y Axis Label
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .attr("font-family", "Georgia, 'Times New Roman', serif")
      .attr("font-size", "12px")
      .text("Sea Ice Fraction (September)");

    // Plot Content Group (Clipped)
    const plotContent = g.append("g").attr("clip-path", `url(#${clipId})`);

    // Band Area Path
    const bandArea = plotContent
      .append("path")
      .attr("fill", "#fed7aa")
      .attr("fill-opacity", 0.28);

    // Fitted Line Path
    const lineGen = d3
      .line()
      .x((d) => xScale(d.co2_ppm))
      .y((d) => yScale(d.pred));

    plotContent
      .append("path")
      .datum(sortedData)
      .attr("fill", "none")
      .attr("stroke", "#475569")
      .attr("stroke-width", 1.8)
      .attr("stroke-dasharray", "4 4")
      .attr("d", lineGen);

    // Draggable Upper & Lower Band Lines
    const upperLine = plotContent
      .append("path")
      .attr("fill", "none")
      .attr("stroke", "#c2410c")
      .attr("stroke-width", 1.8);

    const lowerLine = plotContent
      .append("path")
      .attr("fill", "none")
      .attr("stroke", "#c2410c")
      .attr("stroke-width", 1.8);

    // Transparent Drag Hit Areas (>= 12px)
    const upperHit = plotContent
      .append("path")
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 18)
      .style("cursor", "row-resize");

    const lowerHit = plotContent
      .append("path")
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 18)
      .style("cursor", "row-resize");

    // Dots Group
    const dotsG = plotContent.append("g");
    const dots = dotsG
      .selectAll("circle")
      .data(sortedData, (d) => d.year)
      .join("circle")
      .attr("cx", (d) => xScale(d.co2_ppm))
      .attr("cy", (d) => yScale(d.frac))
      .attr("r", 4.5)
      .attr("stroke-width", 1.2)
      .style("cursor", "pointer");

    // Tooltip / Dot Label
    const labelG = plotContent
      .append("g")
      .style("pointer-events", "none")
      .style("display", "none");

    const labelBg = labelG
      .append("rect")
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("fill", "#0f172a")
      .attr("fill-opacity", 0.92);

    const labelText = labelG
      .append("text")
      .attr("fill", "#f8fafc")
      .attr("font-family", "'Fira Code', monospace")
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em");

    const showTooltip = (d) => {
      onHoverYear(d.year);
      const cx = xScale(d.co2_ppm);
      const cy = yScale(d.frac);
      const text = `${d.year}: frac ${d.frac.toFixed(3)}`;
      labelText.text(text);
      const bbox = labelText.node().getBBox();
      const padX = 6;
      const padY = 3;
      labelBg
        .attr("x", bbox.x - padX)
        .attr("y", bbox.y - padY)
        .attr("width", bbox.width + padX * 2)
        .attr("height", bbox.height + padY * 2);

      const yOffset = cy < 30 ? 20 : -16;
      labelG.attr("transform", `translate(${cx}, ${cy + yOffset})`).style("display", null);
    };

    const hideTooltip = () => {
      onHoverYear(null);
      labelG.style("display", "none");
    };

    dots
      .on("mouseenter", (event, d) => showTooltip(d))
      .on("mouseleave", () => hideTooltip());

    // Update geometry function
    const updateGeometry = (curLo, curHi) => {
      // Area generator
      const areaGen = d3
        .area()
        .x((d) => xScale(d.co2_ppm))
        .y0((d) => yScale(d.pred + curLo))
        .y1((d) => yScale(d.pred + curHi));

      bandArea.datum(sortedData).attr("d", areaGen);

      // Line generator for upper
      const upperGen = d3
        .line()
        .x((d) => xScale(d.co2_ppm))
        .y((d) => yScale(d.pred + curHi));

      upperLine.datum(sortedData).attr("d", upperGen);
      upperHit.datum(sortedData).attr("d", upperGen);

      // Line generator for lower
      const lowerGen = d3
        .line()
        .x((d) => xScale(d.co2_ppm))
        .y((d) => yScale(d.pred + curLo));

      lowerLine.datum(sortedData).attr("d", lowerGen);
      lowerHit.datum(sortedData).attr("d", lowerGen);

      // Update dot styles
      dots
        .attr("fill", (d) =>
          d.resid > curHi || d.resid < curLo ? "#ea580c" : "#cbd5e1"
        )
        .attr("stroke", (d) =>
          d.resid > curHi || d.resid < curLo ? "#9a3412" : "#94a3b8"
        );
    };

    // Initial render of band marks
    updateGeometry(bandRef.current.lo, bandRef.current.hi);

    // Draggable behavior using Rule 14 & Rule 15
    let rafId = null;

    const dragUpper = d3
      .drag()
      .on("drag", (event) => {
        const [px, py] = d3.pointer(event.sourceEvent, g.node());
        const co2Val = xScale.invert(px);
        const fracVal = yScale.invert(py);
        const predVal = getPredAtCo2(co2Val);
        const residDiff = fracVal - predVal;
        const newHi = Math.max(0.005, residDiff);

        let newLo = bandRef.current.lo;
        if (event.sourceEvent && event.sourceEvent.shiftKey) {
          newLo = -newHi;
        }

        bandRef.current = { lo: newLo, hi: newHi };
        updateGeometry(newLo, newHi);

        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          onBandChange(bandRef.current);
        });
      })
      .on("end", () => {
        onBandChange(bandRef.current);
      });

    const dragLower = d3
      .drag()
      .on("drag", (event) => {
        const [px, py] = d3.pointer(event.sourceEvent, g.node());
        const co2Val = xScale.invert(px);
        const fracVal = yScale.invert(py);
        const predVal = getPredAtCo2(co2Val);
        const residDiff = fracVal - predVal;
        const newLo = Math.min(-0.005, residDiff);

        let newHi = bandRef.current.hi;
        if (event.sourceEvent && event.sourceEvent.shiftKey) {
          newHi = -newLo;
        }

        bandRef.current = { lo: newLo, hi: newHi };
        updateGeometry(newLo, newHi);

        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          onBandChange(bandRef.current);
        });
      })
      .on("end", () => {
        onBandChange(bandRef.current);
      });

    upperHit.call(dragUpper);
    lowerHit.call(dragLower);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      svg.remove();
    };
  }, [regionData, region]);

  // Synchronize hover state and external band adjustments
  React.useEffect(() => {
    if (!containerRef.current) return;
    const svg = d3.select(containerRef.current).select("svg");
    if (svg.empty()) return;

    svg
      .selectAll("circle")
      .transition()
      .duration(150)
      .attr("r", (d) => (d.year === hoveredYear ? 7 : 4.5))
      .attr("stroke-width", (d) => (d.year === hoveredYear ? 2.5 : 1.2))
      .attr("stroke", (d) =>
        d.year === hoveredYear
          ? "#1e293b"
          : d.resid > band.hi || d.resid < band.lo
          ? "#9a3412"
          : "#94a3b8"
      );
  }, [hoveredYear, band]);

  return <div ref={containerRef} style={{ width: "100%", height: "370px" }} />;
};

export default function Widget({ model, React }) {
  const rawData = model.get("data") || [];

  // Extract regions
  const regions = React.useMemo(() => {
    if (!Array.isArray(rawData)) return [];
    const set = new Set();
    for (let i = 0; i < rawData.length; i++) {
      if (rawData[i].region) set.add(rawData[i].region);
    }
    return Array.from(set).sort();
  }, [rawData]);

  const [selectedRegion, setSelectedRegion] = React.useState(() => {
    if (regions.includes("Barents")) return "Barents";
    return regions[0] || "";
  });

  // Filter data for selected region
  const regionData = React.useMemo(() => {
    if (!Array.isArray(rawData)) return [];
    return rawData.filter((d) => d.region === selectedRegion);
  }, [rawData, selectedRegion]);

  // Compute 1 SD of resid for initial band
  const defaultSd = React.useMemo(() => {
    if (!regionData || regionData.length === 0) return 0.061;
    const sd = d3.deviation(regionData, (d) => d.resid) || 0.061;
    return Math.round(sd * 1000) / 1000;
  }, [regionData]);

  // Band state (lo, hi in resid units)
  const [band, setBand] = React.useState({ lo: -0.061, hi: 0.061 });
  const [hoveredYear, setHoveredYear] = React.useState(null);

  // Reset band when region changes
  React.useEffect(() => {
    if (defaultSd > 0) {
      setBand({ lo: -defaultSd, hi: defaultSd });
    }
  }, [selectedRegion, defaultSd]);

  // Compute outside items sorted by |resid| descending
  const outsideItems = React.useMemo(() => {
    if (!regionData) return [];
    return regionData
      .filter((d) => d.resid > band.hi || d.resid < band.lo)
      .sort((a, b) => Math.abs(b.resid) - Math.abs(a.resid));
  }, [regionData, band]);

  const outsideYears = React.useMemo(() => outsideItems.map((d) => d.year), [outsideItems]);

  // Synchronize outputs to model
  React.useEffect(() => {
    model.set("outside", outsideYears);
    model.set("band", { lo: band.lo, hi: band.hi });
    model.save_changes();
  }, [outsideYears, band, model]);

  // Listen for data updates from model
  React.useEffect(() => {
    const handleDataChange = () => {
      // Re-trigger render if needed
    };
    model.on("change:data", handleDataChange);
    return () => {
      model.off("change:data", handleDataChange);
    };
  }, [model]);

  return (
    <div
      style={{
        backgroundColor: "#fdfbf7",
        padding: "20px 24px",
        borderRadius: "10px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#0f172a",
        maxWidth: "840px",
        margin: "0 auto",
        boxSizing: "border-box"
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h2
          style={{
            margin: "0 0 6px 0",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "22px",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "#0f172a"
          }}
        >
          Arctic Sea Ice Fraction vs CO₂
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            color: "#64748b",
            lineHeight: 1.4
          }}
        >
          Regression fit with interactive residual tolerance bands. Drag band edges to isolate anomalies.
        </p>
      </div>

      <RegionSelector
        regions={regions}
        selectedRegion={selectedRegion}
        onSelect={(r) => setSelectedRegion(r)}
      />

      <div
        style={{
          display: "flex",
          gap: "16px",
          alignItems: "flex-start",
          backgroundColor: "#ffffff",
          padding: "16px",
          borderRadius: "8px",
          border: "1px solid #e2e8f0"
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <ScatterPlot
            model={model}
            React={React}
            regionData={regionData}
            region={selectedRegion}
            band={band}
            onBandChange={(newBand) => setBand({ ...newBand })}
            hoveredYear={hoveredYear}
            onHoverYear={(yr) => setHoveredYear(yr)}
          />
        </div>

        <OutsideYearsList
          outsideItems={outsideItems}
          onHoverYear={(yr) => setHoveredYear(yr)}
          hoveredYear={hoveredYear}
        />
      </div>

      <SqlQueryDisplay
        region={selectedRegion}
        band={band}
        outsideCount={outsideYears.length}
      />
    </div>
  );
}