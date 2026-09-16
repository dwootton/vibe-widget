import * as d3 from "https://esm.sh/d3@7";

// Helper: Calculate Pareto-optimal indices (minimizing cost, mass, drag)
function computeParetoMask(records) {
  const n = records.length;
  const isPareto = new Uint8Array(n).fill(1);
  for (let i = 0; i < n; i++) {
    const ci = records[i].cost;
    const mi = records[i].mass;
    const di = records[i].drag;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const cj = records[j].cost;
      const mj = records[j].mass;
      const dj = records[j].drag;
      // j dominates i if j is <= i in all three and < in at least one
      if (cj <= ci && mj <= mi && dj <= di && (cj < ci || mj < mi || dj < di)) {
        isPareto[i] = 0;
        break;
      }
    }
  }
  return isPareto;
}

// Convert barycentric coordinates to Cartesian inside triangle
function baryToCart(w1, w2, w3, p1, p2, p3) {
  return [
    w1 * p1[0] + w2 * p2[0] + w3 * p3[0],
    w1 * p1[1] + w2 * p2[1] + w3 * p3[1],
  ];
}

// Project point (px, py) to triangle with vertices A, B, C; returns valid barycentric weights summing to 1
function cartToBary(px, py, A, B, C) {
  const det = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
  let wA = ((B[1] - C[1]) * (px - C[0]) + (C[0] - B[0]) * (py - C[1])) / det;
  let wB = ((C[1] - A[1]) * (px - C[0]) + (A[0] - C[0]) * (py - C[1])) / det;
  let wC = 1 - wA - wB;

  // Clamp to simplex if outside
  if (wA >= 0 && wB >= 0 && wC >= 0) {
    return [wA, wB, wC];
  }
  wA = Math.max(0, wA);
  wB = Math.max(0, wB);
  wC = Math.max(0, wC);
  const sum = wA + wB + wC;
  if (sum === 0) return [1 / 3, 1 / 3, 1 / 3];
  return [wA / sum, wB / sum, wC / sum];
}

export const TriangleWeights = ({
  weights,
  onWeightsChange,
  hoveredCorner,
  setHoveredCorner,
  React,
  size = 280,
}) => {
  const svgRef = React.useRef(null);
  const pad = 36;
  const h = (size - 2 * pad) * (Math.sqrt(3) / 2);
  const cx = size / 2;
  const topY = pad;

  // Triangle vertices:
  // A = top (cost)
  // B = bottom-left (mass)
  // C = bottom-right (drag)
  const A = [cx, topY];
  const side = (size - 2 * pad);
  const B = [cx - side / 2, topY + h];
  const C = [cx + side / 2, topY + h];

  const [pX, pY] = baryToCart(weights.cost, weights.mass, weights.drag, A, B, C);

  const handlePointer = (e) => {
    if (!svgRef.current) return;
    const pt = d3.pointer(e, svgRef.current);
    const [wA, wB, wC] = cartToBary(pt[0], pt[1], A, B, C);
    onWeightsChange({ cost: wA, mass: wB, drag: wC });
  };

  const isDraggingRef = React.useRef(false);

  const onPointerDown = (e) => {
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePointer(e);
  };

  const onPointerMove = (e) => {
    if (isDraggingRef.current) {
      handlePointer(e);
    }
  };

  const onPointerUp = (e) => {
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  const costPct = (weights.cost * 100).toFixed(0);
  const massPct = (weights.mass * 100).toFixed(0);
  const dragPct = (weights.drag * 100).toFixed(0);

  return (
    <div style={{ position: "relative", width: size, height: size, userSelect: "none" }}>
      <svg
        ref={svgRef}
        width={size}
        height={size}
        style={{ overflow: "visible", cursor: "crosshair", display: "block" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Background triangle */}
        <polygon
          points={`${A[0]},${A[1]} ${B[0]},${B[1]} ${C[0]},${C[1]}`}
          fill="#fbfbfb"
          stroke="#d9d9d9"
          strokeWidth="1"
        />

        {/* Subtle grid lines from medians */}
        <line
          x1={A[0]}
          y1={A[1]}
          x2={(B[0] + C[0]) / 2}
          y2={(B[1] + C[1]) / 2}
          stroke="#f0f0f0"
          strokeWidth="1"
        />
        <line
          x1={B[0]}
          y1={B[1]}
          x2={(A[0] + C[0]) / 2}
          y2={(A[1] + C[1]) / 2}
          stroke="#f0f0f0"
          strokeWidth="1"
        />
        <line
          x1={C[0]}
          y1={C[1]}
          x2={(A[0] + B[0]) / 2}
          y2={(A[1] + B[1]) / 2}
          stroke="#f0f0f0"
          strokeWidth="1"
        />

        {/* Corner hit/hover regions */}
        <circle
          cx={A[0]}
          cy={A[1]}
          r={20}
          fill="transparent"
          onMouseEnter={() => setHoveredCorner("cost")}
        />
        <circle
          cx={B[0]}
          cy={B[1]}
          r={20}
          fill="transparent"
          onMouseEnter={() => setHoveredCorner("mass")}
        />
        <circle
          cx={C[0]}
          cy={C[1]}
          r={20}
          fill="transparent"
          onMouseEnter={() => setHoveredCorner("drag")}
        />

        {/* Projected rays from handle to vertices */}
        <line x1={pX} y1={pY} x2={A[0]} y2={A[1]} stroke="#e0e0e0" strokeWidth="1" strokeDasharray="2,2" />
        <line x1={pX} y1={pY} x2={B[0]} y2={B[1]} stroke="#e0e0e0" strokeWidth="1" strokeDasharray="2,2" />
        <line x1={pX} y1={pY} x2={C[0]} y2={C[1]} stroke="#e0e0e0" strokeWidth="1" strokeDasharray="2,2" />

        {/* Handle mark */}
        <circle cx={pX} cy={pY} r={8} fill="transparent" />
        <circle cx={pX} cy={pY} r={5} fill="#111111" stroke="#ffffff" strokeWidth="1.5" />

        {/* Corner Labels with percentages */}
        {/* Top: Cost */}
        <text
          x={A[0]}
          y={A[1] - 12}
          textAnchor="middle"
          fontSize="11"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill={hoveredCorner === "cost" ? "#d9480f" : "#111111"}
          fontWeight={hoveredCorner === "cost" ? "600" : "400"}
        >
          cost {costPct}%
        </text>

        {/* Bottom-left: Mass */}
        <text
          x={B[0]}
          y={B[1] + 16}
          textAnchor="middle"
          fontSize="11"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill={hoveredCorner === "mass" ? "#d9480f" : "#111111"}
          fontWeight={hoveredCorner === "mass" ? "600" : "400"}
        >
          mass {massPct}%
        </text>

        {/* Bottom-right: Drag */}
        <text
          x={C[0]}
          y={C[1] + 16}
          textAnchor="middle"
          fontSize="11"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill={hoveredCorner === "drag" ? "#d9480f" : "#111111"}
          fontWeight={hoveredCorner === "drag" ? "600" : "400"}
        >
          drag {dragPct}%
        </text>
      </svg>
    </div>
  );
};

export const RankedTable = ({ topItems }) => {
  return (
    <div style={{ marginTop: 12, width: 280, fontSize: 11, fontFamily: "system-ui, sans-serif" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "24px 44px 50px 50px 50px 1fr",
          borderBottom: "1px solid #111111",
          paddingBottom: 3,
          color: "#777777",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>#</span>
        <span>id</span>
        <span style={{ textAlign: "right" }}>cost</span>
        <span style={{ textAlign: "right" }}>mass</span>
        <span style={{ textAlign: "right" }}>drag</span>
        <span />
      </div>
      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        {topItems.map((item, idx) => (
          <div
            key={item.design}
            style={{
              display: "grid",
              gridTemplateColumns: "24px 44px 50px 50px 50px 1fr",
              borderBottom: "1px solid #f2f2f2",
              paddingTop: 3,
              paddingBottom: 3,
              alignItems: "center",
              fontVariantNumeric: "tabular-nums",
              color: "#111111",
            }}
          >
            <span style={{ color: "#d9480f", fontWeight: "600" }}>{idx + 1}</span>
            <span style={{ fontFamily: "ui-monospace, monospace" }}>{item.design}</span>
            <span style={{ textAlign: "right" }}>{item.cost.toFixed(1)}</span>
            <span style={{ textAlign: "right" }}>{item.mass.toFixed(1)}</span>
            <span style={{ textAlign: "right" }}>{item.drag.toFixed(3)}</span>
            <span />
          </div>
        ))}
      </div>
    </div>
  );
};

export const ScatterPlot = ({
  records,
  paretoMask,
  topSet,
  width = 540,
  height = 490,
  React,
}) => {
  const containerRef = React.useRef(null);

  // Bounds & Scales
  const margin = { top: 20, right: 24, bottom: 38, left: 42 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const costExtent = React.useMemo(() => d3.extent(records, (d) => d.cost), [records]);
  const massExtent = React.useMemo(() => d3.extent(records, (d) => d.mass), [records]);
  const dragExtent = React.useMemo(() => d3.extent(records, (d) => d.drag), [records]);

  const xScale = React.useMemo(
    () => d3.scaleLinear().domain(costExtent).range([0, innerW]).nice(),
    [costExtent, innerW]
  );
  const yScale = React.useMemo(
    () => d3.scaleLinear().domain(massExtent).range([innerH, 0]).nice(),
    [massExtent, innerH]
  );
  const rScale = React.useMemo(
    () => d3.scaleLinear().domain(dragExtent).range([2.5, 7.5]),
    [dragExtent]
  );

  // SVG rendering
  const svgRef = React.useRef(null);
  const gRef = React.useRef(null);

  React.useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const g = d3.select(gRef.current);
    g.selectAll(".axis").remove();

    // X Axis
    const xAxis = d3.axisBottom(xScale).ticks(6).tickSize(4).tickSizeOuter(0);
    g.append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0, ${innerH})`)
      .call(xAxis)
      .call((group) => {
        group.select(".domain").attr("stroke", "#d9d9d9");
        group.selectAll(".tick line").attr("stroke", "#d9d9d9");
        group
          .selectAll(".tick text")
          .attr("fill", "#777777")
          .attr("font-size", "11px")
          .attr("font-family", "system-ui, sans-serif");
      });

    // Y Axis
    const yAxis = d3.axisLeft(yScale).ticks(6).tickSize(4).tickSizeOuter(0);
    g.append("g")
      .attr("class", "axis y-axis")
      .call(yAxis)
      .call((group) => {
        group.select(".domain").attr("stroke", "#d9d9d9");
        group.selectAll(".tick line").attr("stroke", "#d9d9d9");
        group
          .selectAll(".tick text")
          .attr("fill", "#777777")
          .attr("font-size", "11px")
          .attr("font-family", "system-ui, sans-serif");
      });
  }, [xScale, yScale, innerH]);

  return (
    <div style={{ position: "relative", width, height }}>
      <svg ref={svgRef} width={width} height={height} style={{ display: "block" }}>
        <g ref={gRef} transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Axis Labels */}
          <text
            x={innerW}
            y={innerH + 32}
            textAnchor="end"
            fontSize="11"
            fill="#777777"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            cost
          </text>
          <text
            x={0}
            y={-8}
            textAnchor="start"
            fontSize="11"
            fill="#777777"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            mass
          </text>

          {/* Regular background dots */}
          {records.map((d, i) => {
            const isTop = topSet.has(d.design);
            if (isTop) return null; // Rendered in layer above
            const isPareto = paretoMask[i] === 1;
            const cx = xScale(d.cost);
            const cy = yScale(d.mass);
            const r = rScale(d.drag);

            return (
              <circle
                key={d.design}
                cx={cx}
                cy={cy}
                r={r}
                fill="#f0f0f0"
                stroke={isPareto ? "#111111" : "none"}
                strokeWidth={isPareto ? 1 : 0}
                opacity={0.85}
              />
            );
          })}

          {/* Top 10 highlighted dots */}
          {records.map((d, i) => {
            const rank = topSet.get(d.design);
            if (rank === undefined) return null;
            const isPareto = paretoMask[i] === 1;
            const cx = xScale(d.cost);
            const cy = yScale(d.mass);
            const r = Math.max(rScale(d.drag), 5);

            return (
              <g key={d.design}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="#d9480f"
                  stroke={isPareto ? "#111111" : "#ffffff"}
                  strokeWidth={isPareto ? 1.5 : 1}
                />
                <text
                  x={cx}
                  y={cy + 3.5}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9"
                  fontFamily="system-ui, sans-serif"
                  fontWeight="600"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {rank}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

export default function Widget({ model, React }) {
  // Read inputs from model
  const rawData = model.get("data");
  const records = React.useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    // DataFrame format in anywidget can be columns or records
    if (typeof rawData === "object") {
      const keys = Object.keys(rawData);
      if (keys.length > 0 && Array.isArray(rawData[keys[0]])) {
        const len = rawData[keys[0]].length;
        const out = new Array(len);
        for (let i = 0; i < len; i++) {
          out[i] = {
            cost: rawData.cost[i],
            mass: rawData.mass[i],
            drag: rawData.drag[i],
            design: rawData.design[i],
          };
        }
        return out;
      }
    }
    return [];
  }, [rawData]);

  // Compute Pareto Front once
  const paretoMask = React.useMemo(() => computeParetoMask(records), [records]);

  // Normalization bounds for scoring
  const bounds = React.useMemo(() => {
    if (!records.length) return { cMin: 0, cMax: 1, mMin: 0, mMax: 1, dMin: 0, dMax: 1 };
    let cMin = Infinity, cMax = -Infinity;
    let mMin = Infinity, mMax = -Infinity;
    let dMin = Infinity, dMax = -Infinity;
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (r.cost < cMin) cMin = r.cost;
      if (r.cost > cMax) cMax = r.cost;
      if (r.mass < mMin) mMin = r.mass;
      if (r.mass > mMax) mMax = r.mass;
      if (r.drag < dMin) dMin = r.drag;
      if (r.drag > dMax) dMax = r.drag;
    }
    return {
      cMin,
      cSpan: cMax - cMin || 1,
      mMin,
      mSpan: mMax - mMin || 1,
      dMin,
      dSpan: dMax - dMin || 1,
    };
  }, [records]);

  // Barycentric weights: cost, mass, drag (initially center: 1/3 each)
  const [weights, setWeights] = React.useState({
    cost: 1 / 3,
    mass: 1 / 3,
    drag: 1 / 3,
  });

  const [hoveredCorner, setHoveredCorner] = React.useState("cost");
  const containerRef = React.useRef(null);

  // Compute top 10 ranked designs based on weighted normalized score
  const { topItems, topSet } = React.useMemo(() => {
    if (!records.length) return { topItems: [], topSet: new Map() };
    const { cMin, cSpan, mMin, mSpan, dMin, dSpan } = bounds;
    const { cost: wc, mass: wm, drag: wd } = weights;

    const scored = records.map((r) => {
      const normC = (r.cost - cMin) / cSpan;
      const normM = (r.mass - mMin) / mSpan;
      const normD = (r.drag - dMin) / dSpan;
      const score = wc * normC + wm * normM + wd * normD;
      return { ...r, score };
    });

    scored.sort((a, b) => a.score - b.score);
    const top10 = scored.slice(0, 10);
    const map = new Map();
    top10.forEach((item, index) => {
      map.set(item.design, index + 1);
    });
    return { topItems: top10, topSet: map };
  }, [records, bounds, weights]);

  // Sync outputs to Python model
  React.useEffect(() => {
    const topIds = topItems.map((d) => d.design);
    model.set("weights", {
      cost: weights.cost,
      mass: weights.mass,
      drag: weights.drag,
    });
    model.set("top", topIds);
    model.save_changes();
  }, [weights, topItems, model]);

  // Keyboard navigation: Arrow keys nudge towards the last hovered corner
  const handleKeyDown = (e) => {
    const step = 0.04;
    let target = hoveredCorner || "cost";
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      setWeights((prev) => {
        let { cost, mass, drag } = prev;
        if (target === "cost") {
          cost = Math.min(1, cost + step);
          const rem = 1 - cost;
          const denom = mass + drag || 1;
          mass = (mass / denom) * rem;
          drag = (drag / denom) * rem;
        } else if (target === "mass") {
          mass = Math.min(1, mass + step);
          const rem = 1 - mass;
          const denom = cost + drag || 1;
          cost = (cost / denom) * rem;
          drag = (drag / denom) * rem;
        } else if (target === "drag") {
          drag = Math.min(1, drag + step);
          const rem = 1 - drag;
          const denom = cost + mass || 1;
          cost = (cost / denom) * rem;
          mass = (mass / denom) * rem;
        }
        return { cost, mass, drag };
      });
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        padding: 12,
        background: "#ffffff",
        outline: "none",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* Left panel: Triangle controller + Top 10 list */}
      <div
        style={{
          width: 290,
          marginRight: 24,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <TriangleWeights
          weights={weights}
          onWeightsChange={setWeights}
          hoveredCorner={hoveredCorner}
          setHoveredCorner={setHoveredCorner}
          React={React}
          size={280}
        />
        <RankedTable topItems={topItems} />
      </div>

      {/* Right panel: Cost vs Mass scatter plot */}
      <div style={{ flex: 1, minWidth: 440 }}>
        <ScatterPlot
          records={records}
          paretoMask={paretoMask}
          topSet={topSet}
          width={530}
          height={490}
          React={React}
        />
      </div>
    </div>
  );
}