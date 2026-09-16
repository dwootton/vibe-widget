import * as d3 from "https://esm.sh/d3@7";

export const ThresholdSlider = ({ value, onChange, min = 0, max = 0.5, step = 0.01 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", fontFamily: "'Fira Code', monospace" }}>
    <span style={{ color: "#4a453e", letterSpacing: "0.02em" }}>hide arcs below:</span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{
        accentColor: "#d95338",
        cursor: "pointer",
        width: "120px"
      }}
    />
    <span style={{ fontWeight: 600, color: "#1a1816", width: "38px" }}>{value.toFixed(2)}</span>
  </div>
);

export const TopKeysBadge = ({ queryToken, queryPos, topKeys, tokens }) => {
  if (queryPos === null) {
    return (
      <div style={{
        fontFamily: "'Fira Code', monospace",
        fontSize: "12px",
        color: "#8c8273",
        fontStyle: "italic",
        minHeight: "26px",
        display: "flex",
        alignItems: "center"
      }}>
        Hover a query token or matrix row to isolate arcs & view top keys
      </div>
    );
  }

  const qName = tokens[queryPos]?.token || `tok_${queryPos}`;

  return (
    <div style={{
      fontFamily: "'Fira Code', monospace",
      fontSize: "12px",
      minHeight: "26px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      flexWrap: "wrap",
      color: "#2e2a25"
    }}>
      <span>
        Query <strong style={{ color: "#d95338", backgroundColor: "#faebe7", padding: "2px 6px", borderRadius: "3px" }}>
          {qName} <span style={{ opacity: 0.65, fontSize: "10px" }}>[{queryPos}]</span>
        </strong> top keys:
      </span>
      {topKeys.length === 0 ? (
        <span style={{ color: "#8c8273" }}>None above threshold</span>
      ) : (
        topKeys.map((item, idx) => {
          const kName = tokens[item.k]?.token || `k${item.k}`;
          return (
            <span
              key={idx}
              style={{
                backgroundColor: "#f2ece1",
                padding: "2px 6px",
                borderRadius: "3px",
                border: "1px solid #e2d9cb"
              }}
            >
              <strong style={{ color: "#1f3b4d" }}>{kName}</strong>{" "}
              <span style={{ fontSize: "10px", color: "#6e6659" }}>[{item.k}]</span>:{" "}
              <span style={{ fontWeight: 600, color: "#d95338" }}>{item.w.toFixed(3)}</span>
            </span>
          );
        })
      )}
    </div>
  );
};

export default function Widget({ model, React }) {
  // Sync inputs from model
  const [headInput, setHeadInput] = React.useState(() => model.get("head"));
  const [toksData, setToksData] = React.useState(() => model.get("toks") || []);
  const [allData, setAllData] = React.useState(() => model.get("data") || []);
  const [threshold, setThreshold] = React.useState(0.05);
  const [hoveredQ, setHoveredQ] = React.useState(null);
  const [hoveredK, setHoveredK] = React.useState(null);

  // Keep a ref to hovered state for non-destructive pointer events if needed
  const hoverRef = React.useRef({ q: null, k: null });

  React.useEffect(() => {
    const handleHead = () => setHeadInput(model.get("head"));
    const handleToks = () => setToksData(model.get("toks") || []);
    const handleData = () => setAllData(model.get("data") || []);

    model.on("change:head", handleHead);
    model.on("change:toks", handleToks);
    model.on("change:data", handleData);

    return () => {
      model.off("change:head", handleHead);
      model.off("change:toks", handleToks);
      model.off("change:data", handleData);
    };
  }, [model]);

  // Normalize tokens array (pos: 0..14)
  const tokens = React.useMemo(() => {
    let arr = [];
    if (Array.isArray(toksData)) {
      arr = toksData;
    } else if (toksData && typeof toksData === "object") {
      if (toksData.pos && toksData.token) {
        const p = Array.isArray(toksData.pos) ? toksData.pos : Object.values(toksData.pos);
        const t = Array.isArray(toksData.token) ? toksData.token : Object.values(toksData.token);
        arr = p.map((pos, idx) => ({ pos, token: t[idx] }));
      }
    }
    const res = [];
    for (let i = 0; i < 15; i++) {
      const match = arr.find((item) => Number(item.pos) === i);
      res.push({
        pos: i,
        token: match ? String(match.token) : `t${i}`
      });
    }
    return res;
  }, [toksData]);

  // Determine active layer & head
  const { activeLayer, activeHead } = React.useMemo(() => {
    let l = 0;
    let h = 0;
    if (headInput && typeof headInput === "object") {
      if ("layer" in headInput) l = Number(headInput.layer);
      if ("head" in headInput) h = Number(headInput.head);
    }
    return { activeLayer: l, activeHead: h };
  }, [headInput]);

  // Filter attention records for this layer and head
  const headData = React.useMemo(() => {
    let list = [];
    if (Array.isArray(allData)) {
      list = allData;
    } else if (allData && typeof allData === "object" && allData.layer) {
      const layers = Array.isArray(allData.layer) ? allData.layer : Object.values(allData.layer);
      const heads = Array.isArray(allData.head) ? allData.head : Object.values(allData.head);
      const qs = Array.isArray(allData.q) ? allData.q : Object.values(allData.q);
      const ks = Array.isArray(allData.k) ? allData.k : Object.values(allData.k);
      const ws = Array.isArray(allData.w) ? allData.w : Object.values(allData.w);
      list = layers.map((layer, idx) => ({
        layer,
        head: heads[idx],
        q: qs[idx],
        k: ks[idx],
        w: ws[idx]
      }));
    }

    const filtered = list.filter(
      (d) => Number(d.layer) === activeLayer && Number(d.head) === activeHead
    );

    // Build 15x15 matrix mapping
    const matrix = Array.from({ length: 15 }, () => Array(15).fill(0));
    filtered.forEach((d) => {
      const q = Number(d.q);
      const k = Number(d.k);
      const w = Number(d.w);
      if (q >= 0 && q < 15 && k >= 0 && k < 15) {
        matrix[q][k] = w;
      }
    });

    return { filtered, matrix };
  }, [allData, activeLayer, activeHead]);

  // Compute pattern classification heuristic
  const patternName = React.useMemo(() => {
    const { matrix } = headData;
    let diagSum = 0;
    let prevSum = 0;
    let firstColSum = 0;
    let totalSum = 0;

    for (let q = 0; q < 15; q++) {
      for (let k = 0; k < 15; k++) {
        const w = matrix[q][k];
        totalSum += w;
        if (q === k) diagSum += w;
        if (q === k + 1) prevSum += w;
        if (k === 0) firstColSum += w;
      }
    }
    if (totalSum === 0) return "sparse / uninitialized";
    if (diagSum / totalSum > 0.45) return "self-attention";
    if (prevSum / totalSum > 0.35) return "previous-token";
    if (firstColSum / totalSum > 0.45) return "delimiter / start-token";
    if (totalSum / 225 > 0.08) return "diffuse / global";
    return "directed pattern";
  }, [headData]);

  // Compute top-3 keys for active query
  const topKeys = React.useMemo(() => {
    if (hoveredQ === null) return [];
    const row = headData.matrix[hoveredQ] || [];
    return row
      .map((w, k) => ({ k, w }))
      .filter((item) => item.w >= threshold)
      .sort((a, b) => b.w - a.w)
      .slice(0, 3);
  }, [hoveredQ, headData, threshold]);

  // Arc diagram dimensions
  const arcWidth = 560;
  const arcHeight = 310;
  const arcMargin = { top: 35, right: 30, bottom: 45, left: 30 };
  const plotWidth = arcWidth - arcMargin.left - arcMargin.right;
  const topY = 48;
  const bottomY = 228;
  const colStep = plotWidth / 14;

  const getX = (pos) => arcMargin.left + pos * colStep;

  // Matrix dimensions
  const matrixSize = 250;
  const cellSize = matrixSize / 15;

  return (
    <div
      style={{
        backgroundColor: "#fdfbf7",
        color: "#1a1816",
        padding: "24px 28px",
        borderRadius: "10px",
        border: "1px solid #ebd9c8",
        boxShadow: "0 6px 24px rgba(40, 30, 20, 0.05)",
        maxWidth: "960px",
        margin: "0 auto",
        boxSizing: "border-box",
        fontFamily: "'Fira Code', 'Pitch', monospace"
      }}
    >
      {/* Editorial Header */}
      <div
        style={{
          borderBottom: "2px solid #221f1d",
          paddingBottom: "14px",
          marginBottom: "18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: "12px"
        }}
      >
        <div>
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#a04a32",
              fontWeight: 700,
              marginBottom: "4px"
            }}
          >
            Internal Attention Anatomy
          </div>
          <h2
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              margin: 0,
              fontSize: "24px",
              fontWeight: 700,
              color: "#1a1816"
            }}
          >
            layer {activeLayer} · head {activeHead} ·{" "}
            <span style={{ fontStyle: "italic", fontWeight: 400, color: "#d95338" }}>
              {patternName}
            </span>
          </h2>
        </div>
        <ThresholdSlider value={threshold} onChange={setThreshold} />
      </div>

      {/* Top Keys Status Bar */}
      <div
        style={{
          backgroundColor: "#f5f0e6",
          border: "1px solid #e8decb",
          borderRadius: "6px",
          padding: "6px 14px",
          marginBottom: "20px"
        }}
      >
        <TopKeysBadge
          queryToken={hoveredQ !== null ? tokens[hoveredQ]?.token : null}
          queryPos={hoveredQ}
          topKeys={topKeys}
          tokens={tokens}
        />
      </div>

      {/* Main Dual-Panel Layout */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: "28px",
          alignItems: "flex-start"
        }}
      >
        {/* Left Panel: Token Arcs */}
        <div style={{ flex: "1 1 540px", minWidth: "320px" }}>
          <div
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#6e6659",
              fontWeight: 600,
              marginBottom: "8px",
              display: "flex",
              justifyContent: "space-between"
            }}
          >
            <span>Bipartite Token Flow (Query ➔ Key)</span>
            <span style={{ fontSize: "10px", opacity: 0.8 }}>15 tokens</span>
          </div>

          <svg
            viewBox={`0 0 ${arcWidth} ${arcHeight}`}
            style={{
              width: "100%",
              height: "auto",
              backgroundColor: "#fbf8f2",
              borderRadius: "6px",
              border: "1px solid #ebd9c8"
            }}
          >
            <defs>
              <linearGradient id="arcGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#d95338" />
                <stop offset="100%" stopColor="#1f3b4d" />
              </linearGradient>
            </defs>

            {/* Row labels */}
            <text
              x={arcMargin.left - 14}
              y={topY + 4}
              textAnchor="end"
              style={{
                fontFamily: "'Fira Code', monospace",
                fontSize: "10px",
                fontWeight: 700,
                fill: "#d95338"
              }}
            >
              Q:
            </text>
            <text
              x={arcMargin.left - 14}
              y={bottomY + 4}
              textAnchor="end"
              style={{
                fontFamily: "'Fira Code', monospace",
                fontSize: "10px",
                fontWeight: 700,
                fill: "#1f3b4d"
              }}
            >
              K:
            </text>

            {/* Attention Arcs (Cubic Bezier) */}
            <g>
              {headData.filtered
                .filter((d) => d.w >= threshold)
                .map((d, idx) => {
                  const q = Number(d.q);
                  const k = Number(d.k);
                  const w = Number(d.w);
                  const x1 = getX(q);
                  const y1 = topY + 14;
                  const x2 = getX(k);
                  const y2 = bottomY - 14;

                  const isQHovered = hoveredQ === q;
                  const isIsolated = hoveredQ !== null && isQHovered;
                  const isDimmed = hoveredQ !== null && !isQHovered;
                  const isExactHover = hoveredQ === q && hoveredK === k;

                  // Cubic control points vertical flow
                  const cy1 = y1 + 65;
                  const cy2 = y2 - 65;
                  const pathData = `M ${x1} ${y1} C ${x1} ${cy1}, ${x2} ${cy2}, ${x2} ${y2}`;

                  const strokeWidth = Math.max(0.75, Math.min(6, w * 7));
                  let strokeOpacity = Math.max(0.12, Math.min(0.9, w * 1.3));
                  if (isIsolated) strokeOpacity = Math.min(1, strokeOpacity + 0.35);
                  if (isDimmed) strokeOpacity = 0.05;

                  let strokeColor = "url(#arcGrad)";
                  if (isExactHover) strokeColor = "#ff2e00";
                  else if (isIsolated) strokeColor = "#c23a1d";

                  return (
                    <path
                      key={`arc-${q}-${k}-${idx}`}
                      d={pathData}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isIsolated ? strokeWidth * 1.25 : strokeWidth}
                      strokeOpacity={strokeOpacity}
                      strokeLinecap="round"
                      style={{
                        transition: "stroke-opacity 250ms ease, stroke-width 250ms ease",
                        pointerEvents: "none"
                      }}
                    />
                  );
                })}
            </g>

            {/* Top Query Tokens Row */}
            <g>
              {tokens.map((t, idx) => {
                const x = getX(t.pos);
                const isHover = hoveredQ === t.pos;
                return (
                  <g
                    key={`q-tok-${idx}`}
                    onMouseEnter={() => {
                      setHoveredQ(t.pos);
                      hoverRef.current.q = t.pos;
                    }}
                    onMouseLeave={() => {
                      setHoveredQ(null);
                      hoverRef.current.q = null;
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Background pill */}
                    <rect
                      x={x - 14}
                      y={topY - 14}
                      width={28}
                      height={26}
                      rx={5}
                      fill={isHover ? "#d95338" : "#fff"}
                      stroke={isHover ? "#a0311a" : "#dacdbf"}
                      strokeWidth={isHover ? 1.5 : 1}
                      style={{ transition: "all 150ms ease" }}
                    />
                    {/* Position sub-index */}
                    <text
                      x={x}
                      y={topY - 18}
                      textAnchor="middle"
                      style={{
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "8.5px",
                        fill: isHover ? "#a0311a" : "#8c8273",
                        fontWeight: 600
                      }}
                    >
                      {t.pos}
                    </text>
                    {/* Token label */}
                    <text
                      x={x}
                      y={topY + 3}
                      textAnchor="middle"
                      style={{
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "10.5px",
                        fontWeight: isHover ? 700 : 500,
                        fill: isHover ? "#ffffff" : "#1a1816",
                        pointerEvents: "none"
                      }}
                    >
                      {t.token.length > 3 ? t.token.slice(0, 3) : t.token}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Bottom Key Tokens Row */}
            <g>
              {tokens.map((t, idx) => {
                const x = getX(t.pos);
                const isHover = hoveredK === t.pos;
                return (
                  <g
                    key={`k-tok-${idx}`}
                    onMouseEnter={() => {
                      setHoveredK(t.pos);
                      hoverRef.current.k = t.pos;
                    }}
                    onMouseLeave={() => {
                      setHoveredK(null);
                      hoverRef.current.k = null;
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x={x - 14}
                      y={bottomY - 12}
                      width={28}
                      height={26}
                      rx={5}
                      fill={isHover ? "#1f3b4d" : "#fff"}
                      stroke={isHover ? "#0e1f2b" : "#dacdbf"}
                      strokeWidth={isHover ? 1.5 : 1}
                      style={{ transition: "all 150ms ease" }}
                    />
                    <text
                      x={x}
                      y={bottomY + 5}
                      textAnchor="middle"
                      style={{
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "10.5px",
                        fontWeight: isHover ? 700 : 500,
                        fill: isHover ? "#ffffff" : "#1a1816",
                        pointerEvents: "none"
                      }}
                    >
                      {t.token.length > 3 ? t.token.slice(0, 3) : t.token}
                    </text>
                    {/* Key position indicator below */}
                    <text
                      x={x}
                      y={bottomY + 25}
                      textAnchor="middle"
                      style={{
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "8.5px",
                        fill: isHover ? "#1f3b4d" : "#8c8273",
                        fontWeight: 600
                      }}
                    >
                      {t.pos}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Right Panel: 15x15 Matrix */}
        <div style={{ flex: "0 0 310px" }}>
          <div
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#6e6659",
              fontWeight: 600,
              marginBottom: "8px",
              display: "flex",
              justifyContent: "space-between"
            }}
          >
            <span>Attention Matrix (Q × K)</span>
            <span style={{ fontSize: "10px", opacity: 0.8 }}>15 × 15</span>
          </div>

          <div
            style={{
              backgroundColor: "#fbf8f2",
              padding: "16px",
              borderRadius: "6px",
              border: "1px solid #ebd9c8",
              display: "inline-block"
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(15, ${cellSize}px)`,
                gridTemplateRows: `repeat(15, ${cellSize}px)`,
                gap: "1px",
                backgroundColor: "#e8decb",
                border: "1px solid #d2c3ae"
              }}
            >
              {Array.from({ length: 15 }).map((_, q) =>
                Array.from({ length: 15 }).map((__, k) => {
                  const weight = headData.matrix[q][k] || 0;
                  const isQActive = hoveredQ === q;
                  const isKActive = hoveredK === k;
                  const isCellHovered = hoveredQ === q && hoveredK === k;
                  const isVisibleArc = weight >= threshold;

                  // High-contrast warm ink palette
                  let bg = "#ffffff";
                  if (weight > 0.001) {
                    const t = Math.min(1, weight);
                    const interpolator = d3.interpolateRgb("#f7ede2", "#b83b1d");
                    bg = interpolator(Math.pow(t, 0.7));
                  }

                  let outline = "none";
                  let zIndex = 1;
                  if (isCellHovered) {
                    outline = "2px solid #000";
                    zIndex = 10;
                  } else if (isQActive && isVisibleArc) {
                    outline = "1px solid #d95338";
                    zIndex = 5;
                  } else if (isKActive && isVisibleArc) {
                    outline = "1px solid #1f3b4d";
                    zIndex = 5;
                  }

                  return (
                    <div
                      key={`cell-${q}-${k}`}
                      onMouseEnter={() => {
                        setHoveredQ(q);
                        setHoveredK(k);
                        hoverRef.current.q = q;
                        hoverRef.current.k = k;
                      }}
                      onMouseLeave={() => {
                        setHoveredQ(null);
                        setHoveredK(null);
                        hoverRef.current.q = null;
                        hoverRef.current.k = null;
                      }}
                      title={`Q: ${tokens[q]?.token} (${q}) ➔ K: ${tokens[k]?.token} (${k})\nWeight: ${weight.toFixed(4)}`}
                      style={{
                        backgroundColor: bg,
                        outline,
                        zIndex,
                        position: "relative",
                        cursor: "crosshair",
                        opacity: hoveredQ !== null && !isQActive ? 0.35 : 1,
                        transition: "opacity 120ms ease"
                      }}
                    />
                  );
                })
              )}
            </div>

            {/* Matrix Axis Labels */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "8px",
                fontSize: "10px",
                color: "#6e6659"
              }}
            >
              <span>← Keys (0..14) →</span>
              <span>↓ Queries (0..14)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}