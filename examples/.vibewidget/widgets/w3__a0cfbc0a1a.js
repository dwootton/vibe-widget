import * as d3 from "https://esm.sh/d3@7";

// Standalone Helper: Query Box
export const QueryPreview = ({ region, bandThreshold, count, React }) => {
  const threshStr = Number.isFinite(bandThreshold) ? Math.abs(bandThreshold).toFixed(3) : "0.061";
  return (
    <div
      style={{
        marginTop: "14px",
        padding: "12px 16px",
        backgroundColor: "#1c1917",
        borderRadius: "8px",
        border: "1px solid #292524",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)",
        fontFamily: "'Fira Code', 'Pitch', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: "12.5px",
        lineHeight: "1.6",
        color: "#e7e5e4",
        overflowX: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px"
      }}
    >
      <div style={{ whiteSpace: "pre", overflowX: "auto" }}>
        <span style={{ color: "#f472b6", fontWeight: "600" }}>SELECT</span>{" "}
        <span style={{ color: "#e2e8f0" }}>s.year, s.frac, c.co2_ppm</span>{" "}
        <span style={{ color: "#f472b6", fontWeight: "600" }}>FROM</span>{" "}
        <span style={{ color: "#38bdf8" }}>sept</span> s{" "}
        <span style={{ color: "#f472b6", fontWeight: "600" }}>JOIN</span>{" "}
        <span style={{ color: "#38bdf8" }}>co2</span> c{" "}
        <span style={{ color: "#f472b6", fontWeight: "600" }}>ON</span> s.year = c.year{" "}
        <span style={{ color: "#f472b6", fontWeight: "600" }}>WHERE</span> region ={" "}
        <span style={{ color: "#fbbf24" }}>'{region}'</span>{" "}
        <span style={{ color: "#f472b6", fontWeight: "600" }}>AND</span>{" "}
        <span style={{ color: "#a78bfa" }}>ABS</span>(frac - pred) &gt;{" "}
        <span style={{ color: "#34d399", fontWeight: "bold" }}>{threshStr}</span>
      </div>
      <div
        style={{
          color: "#a8a29e",
          whiteSpace: "nowrap",
          fontSize: "11.5px",
          fontStyle: "italic",
          paddingLeft: "8px",
          borderLeft: "1px solid #44403c"
        }}
      >
        -- {count} {count === 1 ? "row" : "rows"}
      </div>
    </div>
  );
};

// Standalone Helper: Outlier List Table
export const OutlierList = ({ outliers, onHoverYear, React }) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          borderBottom: "1.5px solid #1c1917",
          paddingBottom: "6px",
          marginBottom: "8px"
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: "#1c1917" }}>
          Outside Band
        </span>
        <span
          style={{
            fontSize: "11px",
            fontWeight: "600",
            backgroundColor: "#ea580c",
            color: "#ffffff",
            padding: "2px 7px",
            borderRadius: "10px"
          }}
        >
          {outliers.length}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingRight: "4px"
        }}
      >
        {outliers.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#78716c", fontStyle: "italic", padding: "16px 4px", textAlign: "center" }}>
            All years inside band
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ color: "#78716c", textAlign: "left", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th style={{ padding: "4px 2px" }}>Year</th>
                <th style={{ padding: "4px 2px", textAlign: "right" }}>|Resid|</th>
                <th style={{ padding: "4px 2px", textAlign: "right" }}>Frac</th>
              </tr>
            </thead>
            <tbody>
              {outliers.map((row) => (
                <tr
                  key={row.year}
                  onMouseEnter={() => onHoverYear && onHoverYear(row.year)}
                  onMouseLeave={() => onHoverYear && onHoverYear(null)}
                  style={{
                    borderBottom: "1px solid #f2ece4",
                    cursor: "pointer",
                    transition: "background-color 0.15s ease"
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#ffedd5")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <td style={{ padding: "5px 2px", fontWeight: "700", color: "#ea580c" }}>{row.year}</td>
                  <td
                    style={{
                      padding: "5px 2px",
                      textAlign: "right",
                      fontFamily: "'Fira Code', monospace",
                      color: "#1c1917",
                      fontWeight: "500"
                    }}
                  >
                    {Math.abs(row.resid).toFixed(3)}
                  </td>
                  <td
                    style={{
                      padding: "5px 2px",
                      textAlign: "right",
                      fontFamily: "'Fira Code', monospace",
                      color: "#57534e"
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
      <div style={{ marginTop: "6px", fontSize: "10.5px", color: "#78716c", fontStyle: "italic", textAlign: "right" }}>
        Sorted by |resid| desc
      </div>
    </div>
  );
};

export default function Widget({ model, React }) {
  const [data, setData] = React.useState(() => model.get("data") || []);
  const [regions, setRegions] = React.useState([]);
  const [selectedRegion, setSelectedRegion] = React.useState("Barents");
  const [hoveredYear, setHoveredYear] = React.useState(null);
  const [outlierList, setOutlierList] = React.useState([]);
  const [activeBand, setActiveBand] = React.useState({ lo: -0.061, hi: 0.061 });

  const containerRef = React.useRef(null);
  const svgRef = React.useRef(null);
  const bandRef = React.useRef({ lo: -0.061, hi: 0.061 });
  const scalesRef = React.useRef({ x: null, y: null, regionRows: [] });
  const hoveredYearRef = React.useRef(null);
  hoveredYearRef.current = hoveredYear;

  // Subscribe to data changes
  React.useEffect(() => {
    const handleDataChange = () => {
      setData(model.get("data") || []);
    };
    model.on("change:data", handleDataChange);
    return () => {
      model.off("change:data", handleDataChange);
    };
  }, [model]);

  // Derive region list
  React.useEffect(() => {
    if (!data || data.length === 0) return;
    const unique = Array.from(new Set(data.map((d) => d.region))).sort();
    setRegions(unique);
    if (!unique.includes(selectedRegion)) {
      if (unique.includes("Barents")) {
        setSelectedRegion("Barents");
      } else if (unique.length > 0) {
        setSelectedRegion(unique[0]);
      }
    }
  }, [data]);

  // Recalculate SD and default band when region changes
  React.useEffect(() => {
    if (!data || data.length === 0 || !selectedRegion) return;
    const regionRows = data.filter((d) => d.region === selectedRegion);
    if (regionRows.length === 0) return;

    const resids = regionRows.map((d) => d.resid);
    const sd = d3.deviation(resids) || 0.05;
    const newBand = { lo: -sd, hi: sd };
    bandRef.current = newBand;
    setActiveBand(newBand);

    const outsideYears = regionRows
      .filter((d) => d.resid < newBand.lo || d.resid > newBand.hi)
      .map((d) => d.year);

    const sortedOutliers = [...regionRows]
      .filter((d) => d.resid < newBand.lo || d.resid > newBand.hi)
      .sort((a, b) => Math.abs(b.resid) - Math.abs(a.resid));
    setOutlierList(sortedOutliers);

    model.set("band", newBand);
    model.set("outside", outsideYears);
    model.save_changes();
  }, [selectedRegion, data]);

  // Function to update visual styles of dots, bands, text without rebuilding SVG
  const updateVisuals = React.useCallback(
    (currentBand) => {
      const svg = d3.select(svgRef.current);
      if (svg.empty()) return;
      const { x, y, regionRows } = scalesRef.current;
      if (!x || !y || !regionRows || regionRows.length === 0) return;

      const sortedRows = [...regionRows].sort((a, b) => a.co2_ppm - b.co2_ppm);

      // Area generator for the band
      const areaGen = d3
        .area()
        .x((d) => x(d.co2_ppm))
        .y0((d) => y(d.pred + currentBand.lo))
        .y1((d) => y(d.pred + currentBand.hi));

      svg.select(".band-area").attr("d", areaGen(sortedRows));

      const lineLoGen = d3
        .line()
        .x((d) => x(d.co2_ppm))
        .y((d) => y(d.pred + currentBand.lo));

      const lineHiGen = d3
        .line()
        .x((d) => x(d.co2_ppm))
        .y((d) => y(d.pred + currentBand.hi));

      svg.select(".edge-line-lo").attr("d", lineLoGen(sortedRows));
      svg.select(".edge-hit-lo").attr("d", lineLoGen(sortedRows));

      svg.select(".edge-line-hi").attr("d", lineHiGen(sortedRows));
      svg.select(".edge-hit-hi").attr("d", lineHiGen(sortedRows));

      // Update dots
      const lo = currentBand.lo;
      const hi = currentBand.hi;

      svg
        .selectAll(".dot")
        .attr("fill", (d) => {
          const isOutside = d.resid < lo || d.resid > hi;
          return isOutside ? "#ea580c" : "#cbd5e1";
        })
        .attr("stroke", (d) => {
          const isOutside = d.resid < lo || d.resid > hi;
          return isOutside ? "#9a3412" : "#94a3b8";
        })
        .attr("stroke-width", (d) => (d.year === hoveredYearRef.current ? 2.5 : 1))
        .attr("r", (d) => (d.year === hoveredYearRef.current ? 6.5 : 4.5));
    },
    []
  );

  // Sync outlier list to python and state
  const syncOutliers = React.useCallback(
    (currentBand) => {
      const { regionRows } = scalesRef.current;
      if (!regionRows) return;
      const outsideYears = regionRows
        .filter((d) => d.resid < currentBand.lo || d.resid > currentBand.hi)
        .map((d) => d.year);

      const sortedOutliers = [...regionRows]
        .filter((d) => d.resid < currentBand.lo || d.resid > currentBand.hi)
        .sort((a, b) => Math.abs(b.resid) - Math.abs(a.resid));

      setOutlierList(sortedOutliers);
      setActiveBand({ ...currentBand });

      model.set("band", currentBand);
      model.set("outside", outsideYears);
      model.save_changes();
    },
    [model]
  );

  // Main Chart Rendering Effect (only depends on layout, data, selectedRegion)
  React.useEffect(() => {
    if (!containerRef.current) return;
    const regionRows = (data || []).filter((d) => d.region === selectedRegion);
    if (regionRows.length === 0) return;

    d3.select(containerRef.current).selectAll("*").remove();

    const width = 620;
    const height = 390;
    const margin = { top: 30, right: 35, bottom: 48, left: 56 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3
      .select(containerRef.current)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("style", "max-width: 100%; height: auto; overflow: visible;")
      .attr("tabindex", 0);

    svgRef.current = svg.node();

    // Subtle defs for drop shadows or gradients
    const defs = svg.append("defs");
    const clipId = `clip-${Math.random().toString(36).substr(2, 9)}`;
    defs
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight);

    // Scales
    const xExtent = d3.extent(regionRows, (d) => d.co2_ppm);
    const xPadding = (xExtent[1] - xExtent[0]) * 0.05 || 2;
    const x = d3
      .scaleLinear()
      .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
      .range([0, innerWidth]);

    const allYVals = regionRows.flatMap((d) => [d.frac, d.pred]);
    const yExtent = d3.extent(allYVals);
    const yPadding = (yExtent[1] - yExtent[0]) * 0.18 || 0.1;
    const y = d3
      .scaleLinear()
      .domain([Math.max(0, yExtent[0] - yPadding), Math.min(1.05, yExtent[1] + yPadding)])
      .range([innerHeight, 0])
      .nice();

    scalesRef.current = { x, y, regionRows };

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Grid lines
    const yGrid = d3.axisLeft(y).ticks(6).tickSize(-innerWidth).tickFormat("");
    g.append("g")
      .attr("class", "grid y-grid")
      .call(yGrid)
      .selectAll("line")
      .attr("stroke", "#e7e5e4")
      .attr("stroke-dasharray", "3,3");
    g.select(".y-grid .domain").remove();

    const xGrid = d3.axisBottom(x).ticks(6).tickSize(-innerHeight).tickFormat("");
    g.append("g")
      .attr("class", "grid x-grid")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xGrid)
      .selectAll("line")
      .attr("stroke", "#f1ece7")
      .attr("stroke-dasharray", "3,3");
    g.select(".x-grid .domain").remove();

    // Chart Area with Clip
    const chartArea = g.append("g").attr("clip-path", `url(#${clipId})`);

    const sortedRows = [...regionRows].sort((a, b) => a.co2_ppm - b.co2_ppm);

    // Band shaded polygon
    chartArea
      .append("path")
      .attr("class", "band-area")
      .attr("fill", "#ea580c")
      .attr("fill-opacity", 0.08)
      .style("pointer-events", "none");

    // Fitted central line
    const predLineGen = d3
      .line()
      .x((d) => x(d.co2_ppm))
      .y((d) => y(d.pred));

    chartArea
      .append("path")
      .datum(sortedRows)
      .attr("class", "pred-line")
      .attr("d", predLineGen)
      .attr("fill", "none")
      .attr("stroke", "#78716c")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,4")
      .style("pointer-events", "none");

    // Band edge lines & drag hit targets
    const edgesGroup = chartArea.append("g").attr("class", "edges-group");

    // Lower line & hit
    edgesGroup
      .append("path")
      .attr("class", "edge-line edge-line-lo")
      .attr("fill", "none")
      .attr("stroke", "#ea580c")
      .attr("stroke-width", 1.8)
      .attr("stroke-dasharray", "2,2")
      .style("pointer-events", "none");

    const hitLo = edgesGroup
      .append("path")
      .attr("class", "edge-hit edge-hit-lo")
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 16)
      .style("cursor", "ns-resize");

    // Upper line & hit
    edgesGroup
      .append("path")
      .attr("class", "edge-line edge-line-hi")
      .attr("fill", "none")
      .attr("stroke", "#ea580c")
      .attr("stroke-width", 1.8)
      .attr("stroke-dasharray", "2,2")
      .style("pointer-events", "none");

    const hitHi = edgesGroup
      .append("path")
      .attr("class", "edge-hit edge-hit-hi")
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 16)
      .style("cursor", "ns-resize");

    // Scatter dots
    const dotsGroup = chartArea.append("g").attr("class", "dots-group");
    const dots = dotsGroup
      .selectAll("circle")
      .data(regionRows, (d) => d.year)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", (d) => x(d.co2_ppm))
      .attr("cy", (d) => y(d.frac))
      .attr("r", 4.5)
      .attr("cursor", "pointer");

    // Hover tooltip / hover marker in chart
    const hoverGroup = g.append("g").attr("class", "hover-layer").style("pointer-events", "none");

    const tooltipBox = hoverGroup
      .append("g")
      .attr("class", "tooltip-box")
      .style("opacity", 0)
      .style("transition", "opacity 0.15s ease");

    tooltipBox
      .append("rect")
      .attr("rx", 5)
      .attr("ry", 5)
      .attr("fill", "#1c1917")
      .attr("fill-opacity", 0.94)
      .attr("stroke", "#44403c")
      .attr("stroke-width", 1)
      .attr("height", 50)
      .attr("width", 100);

    const ttYear = tooltipBox
      .append("text")
      .attr("x", 10)
      .attr("y", 18)
      .attr("fill", "#fbbf24")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .attr("font-family", "'Inter', sans-serif");

    const ttFrac = tooltipBox
      .append("text")
      .attr("x", 10)
      .attr("y", 33)
      .attr("fill", "#e7e5e4")
      .attr("font-size", "10.5px")
      .attr("font-family", "'Fira Code', monospace");

    const ttResid = tooltipBox
      .append("text")
      .attr("x", 10)
      .attr("y", 45)
      .attr("fill", "#cbd5e1")
      .attr("font-size", "10px")
      .attr("font-family", "'Fira Code', monospace");

    // Dot hover interactions
    dots
      .on("mouseenter", function (event, d) {
        setHoveredYear(d.year);
        d3.select(this).raise().attr("r", 7).attr("stroke", "#1c1917").attr("stroke-width", 2);

        tooltipBox.style("opacity", 1);
        const cx = x(d.co2_ppm);
        const cy = y(d.frac);
        const ttX = cx + 12 + 100 > innerWidth ? cx - 112 : cx + 12;
        const ttY = cy - 25 < 0 ? cy + 10 : cy - 25;

        tooltipBox.attr("transform", `translate(${ttX}, ${ttY})`);
        ttYear.text(`${d.year}`);
        ttFrac.text(`frac: ${d.frac.toFixed(3)} (co2: ${d.co2_ppm.toFixed(1)})`);
        ttResid.text(`resid: ${d.resid >= 0 ? "+" : ""}${d.resid.toFixed(3)}`);
      })
      .on("mouseleave", function () {
        setHoveredYear(null);
        tooltipBox.style("opacity", 0);
        updateVisuals(bandRef.current);
      });

    // Axes
    const xAxis = d3
      .axisBottom(x)
      .ticks(6)
      .tickFormat((v) => `${v} ppm`);
    const yAxis = d3
      .axisLeft(y)
      .ticks(6)
      .tickFormat((v) => d3.format(".0%")(v));

    g.append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .call((ax) => {
        ax.select(".domain").attr("stroke", "#a8a29e");
        ax.selectAll(".tick line").attr("stroke", "#a8a29e");
        ax.selectAll(".tick text")
          .attr("font-family", "'Fira Code', monospace")
          .attr("font-size", "11px")
          .attr("fill", "#44403c");
      });

    g.append("g")
      .attr("class", "axis y-axis")
      .call(yAxis)
      .call((ax) => {
        ax.select(".domain").attr("stroke", "#a8a29e");
        ax.selectAll(".tick line").attr("stroke", "#a8a29e");
        ax.selectAll(".tick text")
          .attr("font-family", "'Fira Code', monospace")
          .attr("font-size", "11px")
          .attr("fill", "#44403c");
      });

    // Axis Labels
    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 40)
      .attr("text-anchor", "middle")
      .attr("font-family", "'Inter', system-ui, sans-serif")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("letter-spacing", "0.03em")
      .attr("fill", "#292524")
      .text("CO₂ Concentration (ppm)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -42)
      .attr("text-anchor", "middle")
      .attr("font-family", "'Inter', system-ui, sans-serif")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("letter-spacing", "0.03em")
      .attr("fill", "#292524")
      .text("September Ice Cover Fraction");

    // Drag behavior for band edges
    let startBand = { lo: 0, hi: 0 };
    let startY = 0;

    const dragHandler = (whichEdge) =>
      d3
        .drag()
        .container(chartArea.node())
        .on("start", function (event) {
          event.sourceEvent && event.sourceEvent.preventDefault && event.sourceEvent.preventDefault();
          if (svg.node().focus) svg.node().focus();
          startBand = { ...bandRef.current };
          const coords = d3.pointer(event, chartArea.node());
          startY = y.invert(coords[1]);
        })
        .on("drag", function (event) {
          const coords = d3.pointer(event, chartArea.node());
          const currentYVal = y.invert(coords[1]);
          const deltaResidual = currentYVal - startY;

          let newLo = bandRef.current.lo;
          let newHi = bandRef.current.hi;

          const isShift = event.sourceEvent && event.sourceEvent.shiftKey;

          if (isShift) {
            // Shift drag moves both edges together
            newLo = startBand.lo + deltaResidual;
            newHi = startBand.hi + deltaResidual;
          } else {
            // Drag single edge
            if (whichEdge === "hi") {
              newHi = startBand.hi + deltaResidual;
              if (newHi < 0.005) newHi = 0.005; // prevent inversion
            } else {
              newLo = startBand.lo + deltaResidual;
              if (newLo > -0.005) newLo = -0.005;
            }
          }

          bandRef.current = { lo: newLo, hi: newHi };
          updateVisuals(bandRef.current);
          syncOutliers(bandRef.current);
        })
        .on("end", function () {
          syncOutliers(bandRef.current);
        });

    hitLo.call(dragHandler("lo"));
    hitHi.call(dragHandler("hi"));

    // Initial render of visuals
    updateVisuals(bandRef.current);

    return () => {
      svg.remove();
    };
  }, [selectedRegion, data, updateVisuals, syncOutliers]);

  // Synchronize hover state between table and SVG dots
  React.useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (svg.empty()) return;

    svg
      .selectAll(".dot")
      .filter((d) => d.year === hoveredYear)
      .raise()
      .attr("r", 7.5)
      .attr("stroke", "#1c1917")
      .attr("stroke-width", 2.5);

    svg
      .selectAll(".dot")
      .filter((d) => d.year !== hoveredYear)
      .attr("r", 4.5)
      .attr("stroke-width", 1);
  }, [hoveredYear]);

  // Fallback threshold for query display (average distance of edges)
  const currentThreshold = Math.abs(activeBand.hi - activeBand.lo) / 2 || 0.061;

  return (
    <div
      style={{
        backgroundColor: "#fdfbf7",
        minHeight: "560px",
        padding: "24px 28px",
        color: "#1c1917",
        fontFamily: "'Playfair Display', Georgia, serif",
        boxSizing: "border-box"
      }}
    >
      {/* Header section */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderBottom: "2px solid #1c1917",
          paddingBottom: "14px",
          marginBottom: "18px",
          flexWrap: "wrap",
          gap: "12px"
        }}
      >
        <div>
          <div
            style={{
              fontSize: "11px",
              fontFamily: "'Inter', sans-serif",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#ea580c",
              fontWeight: "700",
              marginBottom: "4px"
            }}
          >
            Arctic Sea Ice & Residual Sensitivity
          </div>
          <h1
            style={{
              fontSize: "26px",
              lineHeight: "1.15",
              margin: 0,
              fontWeight: "900",
              color: "#1c1917",
              letterSpacing: "-0.01em"
            }}
          >
            September Ice Fraction vs CO₂
          </h1>
        </div>

        {/* Region Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontFamily: "'Inter', sans-serif" }}>
          <label htmlFor="region-select" style={{ fontSize: "12px", fontWeight: "700", color: "#57534e" }}>
            REGION:
          </label>
          <select
            id="region-select"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            style={{
              backgroundColor: "#ffffff",
              border: "1.5px solid #1c1917",
              padding: "6px 12px",
              borderRadius: "4px",
              fontFamily: "'Inter', sans-serif",
              fontSize: "13px",
              fontWeight: "600",
              color: "#1c1917",
              cursor: "pointer",
              boxShadow: "2px 2px 0px #1c1917",
              outline: "none"
            }}
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main interactive area: Chart + Outlier table */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 220px",
          gap: "20px",
          alignItems: "stretch"
        }}
      >
        {/* Chart canvas */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            border: "1px solid #e7e5e4",
            padding: "12px 14px 8px 6px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            position: "relative"
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "12px",
              right: "20px",
              fontFamily: "'Inter', sans-serif",
              fontSize: "11px",
              color: "#78716c",
              backgroundColor: "#fdfbf7",
              padding: "4px 8px",
              borderRadius: "4px",
              border: "1px solid #e7e5e4"
            }}
          >
            Drag orange lines to widen/narrow · <strong>Shift+Drag</strong> to translate
          </div>
          <div ref={containerRef} style={{ width: "100%", height: "390px" }} />
        </div>

        {/* Sidebar: Outlier list */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            border: "1px solid #e7e5e4",
            padding: "14px 16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column"
          }}
        >
          <OutlierList outliers={outlierList} onHoverYear={setHoveredYear} React={React} />
        </div>
      </div>

      {/* Live query view */}
      <QueryPreview
        region={selectedRegion}
        bandThreshold={currentThreshold}
        count={outlierList.length}
        React={React}
      />
    </div>
  );
}