import * as d3 from "https://esm.sh/d3@7";

// Helper: Calculate 3D Pareto optimal set (minimization: cost, mass, drag)
function computeParetoFlags(items) {
  const n = items.length;
  const isPareto = new Uint8Array(n);
  isPareto.fill(1);

  // Simple 2-nested loop for 2000 points is 4M ops, very fast in JS (~5-15ms)
  for (let i = 0; i < n; i++) {
    const ci = items[i].cost;
    const mi = items[i].mass;
    const di = items[i].drag;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const cj = items[j].cost;
      const mj = items[j].mass;
      const dj = items[j].drag;
      // j dominates i if j is <= i in all objectives and < in at least one
      if (cj <= ci && mj <= mi && dj <= di && (cj < ci || mj < mi || dj < di)) {
        isPareto[i] = 0;
        break;
      }
    }
  }
  return isPareto;
}

// Convert barycentric coordinates to 2D Cartesian coords for an equilateral triangle
function barycentricToCartesian(w1, w2, w3, p1, p2, p3) {
  return {
    x: w1 * p1.x + w2 * p2.x + w3 * p3.x,
    y: w1 * p1.y + w2 * p2.y + w3 * p3.y,
  };
}

// Clamp point inside equilateral triangle & get barycentric coordinates
function cartesianToBarycentric(px, py, p1, p2, p3) {
  const det = (p2.y - p3.y) * (p1.x - p3.x) + (p3.x - p2.x) * (p1.y - p3.y);
  let w1 = ((p2.y - p3.y) * (px - p3.x) + (p3.x - p2.x) * (py - p3.y)) / det;
  let w2 = ((p3.y - p1.y) * (px - p3.x) + (p1.x - p3.x) * (py - p3.y)) / det;
  let w3 = 1.0 - w1 - w2;

  // Projection / clamp to simplex: w_i >= 0, sum = 1
  if (w1 < 0 || w2 < 0 || w3 < 0) {
    w1 = Math.max(0, w1);
    w2 = Math.max(0, w2);
    w3 = Math.max(0, w3);
    const sum = w1 + w2 + w3 || 1e-6;
    w1 /= sum;
    w2 /= sum;
    w3 /= sum;
  }
  return { w1, w2, w3 };
}

export const TriangleWeightPicker = ({
  React,
  weights,
  onWeightsChange,
  lastHoveredCorner,
  setLastHoveredCorner,
  size = 280,
}) => {
  const svgRef = React.useRef(null);
  const isDraggingRef = React.useRef(false);

  // Triangle geometry:
  // p1: Cost (Top)
  // p2: Mass (Bottom Left)
  // p3: Drag (Bottom Right)
  const padding = 38;
  const h = size - padding * 2;
  const side = (2 * h) / Math.sqrt(3);
  const cx = size / 2;

  const p1 = { x: cx, y: padding };
  const p2 = { x: cx - side / 2, y: padding + h };
  const p3 = { x: cx + side / 2, y: padding + h };

  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePointerMove(e);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current && e.type !== "click") return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const { w1, w2, w3 } = cartesianToBarycentric(px, py, p1, p2, p3);
    onWeightsChange({ cost: w1, mass: w2, drag: w3 });
  };

  const handlePointerUp = (e) => {
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  const currentPt = barycentricToCartesian(weights.cost, weights.mass, weights.drag, p1, p2, p3);

  // Midlines/grid ticks
  const mid12 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const mid23 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
  const mid31 = { x: (p3.x + p1.x) / 2, y: (p3.y + p1.y) / 2 };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        userSelect: "none",
        position: "relative",
      }}
    >
      <svg
        ref={svgRef}
        width={size}
        height={size}
        style={{ cursor: "crosshair", overflow: "visible" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <defs>
          <radialGradient id="triGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e28743" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#e28743" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Triangle face */}
        <polygon
          points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
          fill="#f4ede2"
          stroke="#2d2a26"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Subtle grid guidelines */}
        <line x1={p1.x} y1={p1.y} x2={mid23.x} y2={mid23.y} stroke="#d5c8b5" strokeDasharray="3 3" />
        <line x1={p2.x} y1={p2.y} x2={mid31.x} y2={mid31.y} stroke="#d5c8b5" strokeDasharray="3 3" />
        <line x1={p3.x} y1={p3.y} x2={mid12.x} y2={mid12.y} stroke="#d5c8b5" strokeDasharray="3 3" />

        {/* Corner touch targets + hover detection */}
        <circle
          cx={p1.x}
          cy={p1.y}
          r={24}
          fill="transparent"
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setLastHoveredCorner("cost")}
          onClick={() => onWeightsChange({ cost: 1, mass: 0, drag: 0 })}
        />
        <circle
          cx={p2.x}
          cy={p2.y}
          r={24}
          fill="transparent"
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setLastHoveredCorner("mass")}
          onClick={() => onWeightsChange({ cost: 0, mass: 1, drag: 0 })}
        />
        <circle
          cx={p3.x}
          cy={p3.y}
          r={24}
          fill="transparent"
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setLastHoveredCorner("drag")}
          onClick={() => onWeightsChange({ cost: 0, mass: 0, drag: 1 })}
        />

        {/* Draggable weight handle */}
        <circle
          cx={currentPt.x}
          cy={currentPt.y}
          r={18}
          fill="url(#triGlow)"
          pointerEvents="none"
        />
        <circle
          cx={currentPt.x}
          cy={currentPt.y}
          r={8}
          fill="#d85a2b"
          stroke="#ffffff"
          strokeWidth="2.5"
          filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.25))"
          style={{ cursor: "grab" }}
        />

        {/* Corner 1: Cost (Top) */}
        <g
          transform={`translate(${p1.x}, ${p1.y - 12})`}
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setLastHoveredCorner("cost")}
        >
          <text
            textAnchor="middle"
            fill={lastHoveredCorner === "cost" ? "#d85a2b" : "#1f1d1a"}
            fontSize="12"
            fontWeight="700"
            fontFamily="'Playfair Display', Georgia, serif"
            letterSpacing="0.05em"
          >
            COST
          </text>
          <text
            y="14"
            textAnchor="middle"
            fill="#574f46"
            fontSize="11"
            fontFamily="'Fira Code', monospace"
            fontWeight="600"
          >
            {(weights.cost * 100).toFixed(0)}%
          </text>
        </g>

        {/* Corner 2: Mass (Bottom Left) */}
        <g
          transform={`translate(${p2.x - 14}, ${p2.y + 14})`}
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setLastHoveredCorner("mass")}
        >
          <text
            textAnchor="end"
            fill={lastHoveredCorner === "mass" ? "#d85a2b" : "#1f1d1a"}
            fontSize="12"
            fontWeight="700"
            fontFamily="'Playfair Display', Georgia, serif"
            letterSpacing="0.05em"
          >
            MASS
          </text>
          <text
            x="0"
            y="14"
            textAnchor="end"
            fill="#574f46"
            fontSize="11"
            fontFamily="'Fira Code', monospace"
            fontWeight="600"
          >
            {(weights.mass * 100).toFixed(0)}%
          </text>
        </g>

        {/* Corner 3: Drag (Bottom Right) */}
        <g
          transform={`translate(${p3.x + 14}, ${p3.y + 14})`}
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setLastHoveredCorner("drag")}
        >
          <text
            textAnchor="start"
            fill={lastHoveredCorner === "drag" ? "#d85a2b" : "#1f1d1a"}
            fontSize="12"
            fontWeight="700"
            fontFamily="'Playfair Display', Georgia, serif"
            letterSpacing="0.05em"
          >
            DRAG
          </text>
          <text
            x="0"
            y="14"
            textAnchor="start"
            fill="#574f46"
            fontSize="11"
            fontFamily="'Fira Code', monospace"
            fontWeight="600"
          >
            {(weights.drag * 100).toFixed(0)}%
          </text>
        </g>
      </svg>
    </div>
  );
};

export const TopTenTable = ({ React, topItems, hoveredId, setHoveredId }) => {
  return (
    <div
      style={{
        width: "100%",
        marginTop: 10,
        backgroundColor: "#ffffff",
        border: "1px solid #e5ded3",
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          backgroundColor: "#f7f2ea",
          borderBottom: "1px solid #e5ded3",
        }}
      >
        <span
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: "700",
            fontSize: "13px",
            color: "#24201c",
            letterSpacing: "0.04em",
          }}
        >
          Ranked Top 10 Candidates
        </span>
        <span
          style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: "10px",
            color: "#7e756a",
          }}
        >
          Score: min Σ wᵢ · x̃ᵢ
        </span>
      </div>
      <div style={{ maxHeight: 185, overflowY: "auto", fontSize: "11px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr
              style={{
                borderBottom: "1px solid #ece4d8",
                color: "#7e756a",
                fontFamily: "'Fira Code', monospace",
                fontSize: "10px",
                textTransform: "uppercase",
              }}
            >
              <th style={{ padding: "6px 8px", width: 28 }}>#</th>
              <th style={{ padding: "6px 8px" }}>Design</th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>Cost</th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>Mass</th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>Drag</th>
              <th style={{ padding: "6px 8px", textAlign: "center" }}>Pareto</th>
            </tr>
          </thead>
          <tbody>
            {topItems.map((item, idx) => {
              const isHov = hoveredId === item.design;
              return (
                <tr
                  key={item.design}
                  onMouseEnter={() => setHoveredId(item.design)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    backgroundColor: isHov ? "#fff4eb" : idx % 2 === 0 ? "#ffffff" : "#faf7f2",
                    cursor: "pointer",
                    transition: "background-color 120ms ease",
                    borderBottom: "1px solid #f0e9df",
                  }}
                >
                  <td
                    style={{
                      padding: "5px 8px",
                      fontWeight: "700",
                      color: "#d85a2b",
                      fontFamily: "'Fira Code', monospace",
                    }}
                  >
                    {idx + 1}
                  </td>
                  <td
                    style={{
                      padding: "5px 8px",
                      fontWeight: "600",
                      fontFamily: "'Fira Code', monospace",
                      color: "#1c1917",
                    }}
                  >
                    {item.design}
                  </td>
                  <td
                    style={{
                      padding: "5px 8px",
                      textAlign: "right",
                      fontFamily: "'Fira Code', monospace",
                      color: "#38332c",
                    }}
                  >
                    {item.cost.toFixed(1)}
                  </td>
                  <td
                    style={{
                      padding: "5px 8px",
                      textAlign: "right",
                      fontFamily: "'Fira Code', monospace",
                      color: "#38332c",
                    }}
                  >
                    {item.mass.toFixed(1)}
                  </td>
                  <td
                    style={{
                      padding: "5px 8px",
                      textAlign: "right",
                      fontFamily: "'Fira Code', monospace",
                      color: "#38332c",
                    }}
                  >
                    {item.drag.toFixed(3)}
                  </td>
                  <td style={{ padding: "5px 8px", textAlign: "center" }}>
                    {item.isPareto ? (
                      <span
                        style={{
                          display: "inline-block",
                          padding: "1px 6px",
                          borderRadius: 4,
                          fontSize: "9px",
                          fontWeight: "700",
                          backgroundColor: "#e8f5e9",
                          color: "#1b5e20",
                          border: "1px solid #a5d6a7",
                        }}
                      >
                        YES
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: "9px",
                          color: "#9e9589",
                        }}
                      >
                        –
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const ScatterPlot = ({
  React,
  data,
  paretoFlags,
  topItems,
  hoveredId,
  setHoveredId,
  width = 540,
  height = 510,
}) => {
  const containerRef = React.useRef(null);
  const elementsRef = React.useRef({});

  const margin = { top: 25, right: 30, bottom: 45, left: 52 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Scales
  const scales = React.useMemo(() => {
    if (!data || data.length === 0) return null;
    const costExt = d3.extent(data, (d) => d.cost);
    const massExt = d3.extent(data, (d) => d.mass);
    const dragExt = d3.extent(data, (d) => d.drag);

    const x = d3
      .scaleLinear()
      .domain([Math.floor(costExt[0] * 0.9), Math.ceil(costExt[1] * 1.05)])
      .range([0, innerWidth]);

    const y = d3
      .scaleLinear()
      .domain([Math.floor(massExt[0] * 0.9), Math.ceil(massExt[1] * 1.05)])
      .range([innerHeight, 0]);

    // Drag maps to dot size (radius 2.5 to 8.5)
    const r = d3.scaleSqrt().domain(dragExt).range([2.5, 8.5]);

    return { x, y, r };
  }, [data, innerWidth, innerHeight]);

  // Initial SVG and axis construction (run once or when data layout changes)
  React.useEffect(() => {
    if (!containerRef.current || !scales || !data) return;

    const el = d3.select(containerRef.current);
    el.selectAll("*").remove();

    const svg = el
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("display", "block");

    // Gridlines background
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xAxis = d3
      .axisBottom(scales.x)
      .ticks(7)
      .tickSize(-innerHeight)
      .tickPadding(8);

    const yAxis = d3
      .axisLeft(scales.y)
      .ticks(7)
      .tickSize(-innerWidth)
      .tickPadding(8);

    // Axes groups
    const xG = g
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis);

    const yG = g.append("g").attr("class", "y-axis").call(yAxis);

    // Style axes & gridlines
    [xG, yG].forEach((axisG) => {
      axisG.select(".domain").attr("stroke", "#d0c7ba");
      axisG.selectAll(".tick line").attr("stroke", "#ece5da").attr("stroke-dasharray", "2 2");
      axisG
        .selectAll(".tick text")
        .attr("fill", "#6d6457")
        .attr("font-size", "10px")
        .attr("font-family", "'Fira Code', monospace");
    });

    // Axis Labels
    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 38)
      .attr("text-anchor", "middle")
      .attr("fill", "#2d2a26")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("font-family", "'Playfair Display', Georgia, serif")
      .text("Cost (minimize →)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -38)
      .attr("text-anchor", "middle")
      .attr("fill", "#2d2a26")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("font-family", "'Playfair Display', Georgia, serif")
      .text("Mass (minimize ↑)");

    // Layer 1: Background points (2000 points)
    const pointsGroup = g.append("g").attr("class", "bg-points");

    // Draw non-top points
    const pointElements = pointsGroup
      .selectAll("circle")
      .data(data, (d) => d.design)
      .join("circle")
      .attr("cx", (d) => scales.x(d.cost))
      .attr("cy", (d) => scales.y(d.mass))
      .attr("r", (d) => scales.r(d.drag))
      .attr("fill", "#dcd6cc")
      .attr("fill-opacity", 0.65)
      .attr("stroke", (d, i) => (paretoFlags && paretoFlags[i] ? "#1b5e20" : "none"))
      .attr("stroke-width", (d, i) => (paretoFlags && paretoFlags[i] ? 1.5 : 0))
      .style("cursor", "pointer")
      .on("mouseenter", (e, d) => setHoveredId(d.design))
      .on("mouseleave", () => setHoveredId(null));

    // Layer 2: Overlay for Top 10 items (filled orange, with rank number badges)
    const topOverlayGroup = g.append("g").attr("class", "top-overlay");

    // Save refs for fast imperativ updates
    elementsRef.current = {
      svg,
      pointElements,
      topOverlayGroup,
      scales,
    };

    return () => {
      svg.remove();
    };
  }, [data, paretoFlags, scales, width, height]);

  // Imperatively update top-10 highlights & hover without rebuilding the 2000-node DOM
  React.useEffect(() => {
    const { topOverlayGroup, pointElements } = elementsRef.current;
    if (!topOverlayGroup || !scales) return;

    const topMap = new Map();
    topItems.forEach((item, idx) => {
      topMap.set(item.design, idx + 1);
    });

    // Dim or highlight base points
    if (pointElements) {
      pointElements
        .attr("fill", (d) => (topMap.has(d.design) ? "none" : "#dcd6cc"))
        .attr("fill-opacity", (d) => (topMap.has(d.design) ? 0 : 0.6));
    }

    // Bind Top 10 to topOverlayGroup
    const badges = topOverlayGroup
      .selectAll("g.top-badge")
      .data(topItems, (d) => d.design)
      .join(
        (enter) => {
          const badge = enter.append("g").attr("class", "top-badge");
          // Outer halo
          badge
            .append("circle")
            .attr("class", "halo")
            .attr("fill", "#d85a2b")
            .attr("fill-opacity", 0.2);

          // Main disc
          badge
            .append("circle")
            .attr("class", "main-disc")
            .attr("fill", "#d85a2b")
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 1.8);

          // Rank label
          badge
            .append("text")
            .attr("class", "rank-text")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("fill", "#ffffff")
            .attr("font-size", "9px")
            .attr("font-weight", "800")
            .attr("font-family", "'Fira Code', monospace");

          return badge;
        },
        (update) => update,
        (exit) => exit.remove()
      )
      .style("cursor", "pointer")
      .on("mouseenter", (e, d) => setHoveredId(d.design))
      .on("mouseleave", () => setHoveredId(null));

    // Update positions & sizes
    badges.each(function (d, i) {
      const gNode = d3.select(this);
      const cx = scales.x(d.cost);
      const cy = scales.y(d.mass);
      const r = Math.max(scales.r(d.drag) + 4, 10);
      const isHovered = hoveredId === d.design;

      gNode.attr("transform", `translate(${cx},${cy})`);

      gNode
        .select(".halo")
        .attr("r", isHovered ? r + 6 : r + 3)
        .attr("stroke", d.isPareto ? "#1b5e20" : "none")
        .attr("stroke-width", d.isPareto ? 2 : 0);

      gNode
        .select(".main-disc")
        .attr("r", r)
        .attr("fill", isHovered ? "#b84218" : "#d85a2b");

      gNode.select(".rank-text").text(i + 1);
    });
  }, [topItems, hoveredId, scales]);

  return (
    <div
      ref={containerRef}
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 8,
        border: "1px solid #e5ded3",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        position: "relative",
      }}
    />
  );
};

export default function ParetoExplorerWidget({ model, React }) {
  // Read immutable input data
  const rawData = model.get("data") || [];

  // Parse & normalize data once
  const parsedData = React.useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    // Could be list of objects or columnar dictionary
    if (Array.isArray(rawData)) {
      return rawData.map((d) => ({
        cost: +d.cost,
        mass: +d.mass,
        drag: +d.drag,
        design: String(d.design),
      }));
    }
    // Object of arrays format
    if (rawData.cost && Array.isArray(rawData.cost)) {
      const arr = [];
      const len = rawData.cost.length;
      for (let i = 0; i < len; i++) {
        arr.push({
          cost: +rawData.cost[i],
          mass: +rawData.mass[i],
          drag: +rawData.drag[i],
          design: String(rawData.design ? rawData.design[i] : `D${i}`),
        });
      }
      return arr;
    }
    return [];
  }, [rawData]);

  // Precompute min/max bounds for normalisation: score = sum(w_i * (x_i - min) / (max - min))
  const dataBounds = React.useMemo(() => {
    if (parsedData.length === 0) return null;
    const cExt = d3.extent(parsedData, (d) => d.cost);
    const mExt = d3.extent(parsedData, (d) => d.mass);
    const dExt = d3.extent(parsedData, (d) => d.drag);
    return {
      cMin: cExt[0],
      cSpan: cExt[1] - cExt[0] || 1,
      mMin: mExt[0],
      mSpan: mExt[1] - mExt[0] || 1,
      dMin: dExt[0],
      dSpan: dExt[1] - dExt[0] || 1,
    };
  }, [parsedData]);

  // Precompute 3D Pareto optimal flags
  const paretoFlags = React.useMemo(() => {
    if (parsedData.length === 0) return null;
    return computeParetoFlags(parsedData);
  }, [parsedData]);

  // Barycentric weights: start at the centre {cost: 1/3, mass: 1/3, drag: 1/3}
  const [weights, setWeights] = React.useState({
    cost: 1 / 3,
    mass: 1 / 3,
    drag: 1 / 3,
  });

  const [lastHoveredCorner, setLastHoveredCorner] = React.useState("cost");
  const [hoveredDesignId, setHoveredDesignId] = React.useState(null);

  // Focusable container ref for keyboard navigation
  const rootRef = React.useRef(null);

  // Compute Top 10 ranked designs by weighted normalised score
  const topTenItems = React.useMemo(() => {
    if (parsedData.length === 0 || !dataBounds) return [];
    const { cMin, cSpan, mMin, mSpan, dMin, dSpan } = dataBounds;
    const wc = weights.cost;
    const wm = weights.mass;
    const wd = weights.drag;

    // Map each item to score
    const scored = parsedData.map((d, idx) => {
      const normCost = (d.cost - cMin) / cSpan;
      const normMass = (d.mass - mMin) / mSpan;
      const normDrag = (d.drag - dMin) / dSpan;
      const score = wc * normCost + wm * normMass + wd * normDrag;
      return {
        ...d,
        score,
        isPareto: paretoFlags ? Boolean(paretoFlags[idx]) : false,
      };
    });

    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, 10);
  }, [parsedData, dataBounds, paretoFlags, weights]);

  // Synchronize outputs to Python model
  React.useEffect(() => {
    const topIds = topTenItems.map((d) => d.design);
    model.set("weights", {
      cost: Number(weights.cost.toFixed(4)),
      mass: Number(weights.mass.toFixed(4)),
      drag: Number(weights.drag.toFixed(4)),
    });
    model.set("top", topIds);
    model.save_changes();
  }, [weights, topTenItems, model]);

  // Keyboard navigation: arrow keys nudge point toward last-hovered corner
  const handleKeyDown = (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      const step = 0.04;
      // Nudge towards target corner
      const target = lastHoveredCorner; // "cost", "mass", or "drag"
      setWeights((prev) => {
        let { cost, mass, drag } = prev;
        if (target === "cost") {
          cost = Math.min(1, cost + step);
          const remainder = 1 - cost;
          const currentSumOther = mass + drag || 1;
          mass = (mass / currentSumOther) * remainder;
          drag = (drag / currentSumOther) * remainder;
        } else if (target === "mass") {
          mass = Math.min(1, mass + step);
          const remainder = 1 - mass;
          const currentSumOther = cost + drag || 1;
          cost = (cost / currentSumOther) * remainder;
          drag = (drag / currentSumOther) * remainder;
        } else {
          drag = Math.min(1, drag + step);
          const remainder = 1 - drag;
          const currentSumOther = cost + mass || 1;
          cost = (cost / currentSumOther) * remainder;
          mass = (mass / currentSumOther) * remainder;
        }
        return { cost, mass, drag };
      });
    }
  };

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        backgroundColor: "#fdfbf7",
        color: "#22201d",
        padding: "20px 24px",
        borderRadius: 12,
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxSizing: "border-box",
        outline: "none",
        maxWidth: 960,
        margin: "0 auto",
      }}
    >
      {/* Header story element */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 16,
          borderBottom: "1px solid #ede5d8",
          paddingBottom: 12,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: "700",
              fontFamily: "'Playfair Display', Georgia, serif",
              color: "#1c1917",
              letterSpacing: "-0.01em",
            }}
          >
            Pareto Frontier Explorer
          </h2>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: "12px",
              color: "#6b6256",
            }}
          >
            Minimising 3 objectives across 2,000 design candidates. Drag triangle weights to
            re-rank.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            fontSize: "11px",
            fontFamily: "'Fira Code', monospace",
            color: "#6b6256",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                border: "2px solid #1b5e20",
                display: "inline-block",
              }}
            />
            <span>Pareto frontier</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: "#d85a2b",
                display: "inline-block",
              }}
            />
            <span>Top 10 candidates</span>
          </div>
        </div>
      </div>

      {/* Main Layout: Left controls & table | Right scatter */}
      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        {/* Left Column: Ternary simplex + Top 10 list */}
        <div style={{ width: 330, flexShrink: 0 }}>
          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "12px 14px 8px 14px",
              borderRadius: 8,
              border: "1px solid #e5ded3",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontWeight: "700",
                  fontSize: "13px",
                  color: "#24201c",
                }}
              >
                Objective Weight Simplex
              </span>
              <span
                style={{
                  fontSize: "10px",
                  color: "#847a6e",
                  fontFamily: "'Fira Code', monospace",
                }}
              >
                Hover + Arrow keys
              </span>
            </div>

            <TriangleWeightPicker
              React={React}
              weights={weights}
              onWeightsChange={setWeights}
              lastHoveredCorner={lastHoveredCorner}
              setLastHoveredCorner={setLastHoveredCorner}
              size={290}
            />
          </div>

          <TopTenTable
            React={React}
            topItems={topTenItems}
            hoveredId={hoveredDesignId}
            setHoveredId={setHoveredDesignId}
          />
        </div>

        {/* Right Column: Scatter Plot Cost vs Mass with Drag as dot radius */}
        <div style={{ flex: "1 1 500px", minWidth: 320 }}>
          <ScatterPlot
            React={React}
            data={parsedData}
            paretoFlags={paretoFlags}
            topItems={topTenItems}
            hoveredId={hoveredDesignId}
            setHoveredId={setHoveredDesignId}
            width={550}
            height={510}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 6,
              fontSize: "11px",
              color: "#7e756a",
              fontFamily: "'Fira Code', monospace",
              padding: "0 4px",
            }}
          >
            <span>Dot diameter encodes Drag (larger = higher drag)</span>
            <span>Green stroke = non-dominated 3D Pareto optimal</span>
          </div>
        </div>
      </div>
    </div>
  );
}