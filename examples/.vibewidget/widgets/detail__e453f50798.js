import * as d3 from "https://esm.sh/d3@7";

function classifyAttentionPattern(matrix, n) {
  if (!matrix || matrix.length === 0) return "sparse";
  let diagSum = 0;
  let prevSum = 0;
  let firstSum = 0;
  let totalSum = 0;

  for (let q = 0; q < n; q++) {
    for (let k = 0; k < n; k++) {
      const w = (matrix[q] && matrix[q][k]) || 0;
      totalSum += w;
      if (q === k) diagSum += w;
      if (k === q - 1) prevSum += w;
      if (k === 0) firstSum += w;
    }
  }

  if (totalSum === 0) return "inactive";
  const diagRatio = diagSum / totalSum;
  const prevRatio = prevSum / totalSum;
  const firstRatio = firstSum / totalSum;

  if (diagRatio > 0.45) return "diagonal (self)";
  if (prevRatio > 0.35) return "previous token";
  if (firstRatio > 0.4) return "first token";
  if (diagRatio > 0.25 && prevRatio > 0.2) return "local context";
  return "distributed";
}

export const ThresholdSlider = ({ value, onChange, min = 0, max = 0.5, step = 0.01 }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: "system-ui, sans-serif" }}>
    <span style={{ color: "#777777" }}>hide arcs below</span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{
        width: 100,
        height: 3,
        accentColor: "#111111",
        cursor: "pointer"
      }}
    />
    <span style={{ fontFamily: "ui-monospace, monospace", width: 34, textAlign: "right", color: "#111111", fontVariantNumeric: "tabular-nums" }}>
      {value.toFixed(2)}
    </span>
  </div>
);

export const AttentionArcs = ({
  tokens = [],
  weights = [],
  threshold = 0.05,
  hoveredQ = null,
  hoveredK = null,
  onHoverQ = () => {},
  onHoverK = () => {}
}) => {
  const width = 430;
  const height = 240;
  const paddingX = 28;
  const qY = 32;
  const kY = 196;

  const n = tokens.length || 15;
  const step = n > 1 ? (width - 2 * paddingX) / (n - 1) : 0;

  const arcs = [];
  weights.forEach((row, q) => {
    if (!row) return;
    row.forEach((w, k) => {
      if (w >= threshold) {
        arcs.push({ q, k, w });
      }
    });
  });

  return (
    <div style={{ position: "relative", width, height }}>
      <svg width={width} height={height} style={{ display: "block" }}>
        {/* Arcs */}
        <g>
          {arcs.map(({ q, k, w }) => {
            const x1 = paddingX + q * step;
            const x2 = paddingX + k * step;
            const midY = (qY + kY) / 2;
            const d = `M ${x1} ${qY + 8} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${kY - 8}`;

            const isQMatch = hoveredQ === q;
            const isKMatch = hoveredK === k;
            const isPairMatch = hoveredQ === q && hoveredK === k;
            const anyHover = hoveredQ !== null || hoveredK !== null;

            let stroke = "#111111";
            let opacity = Math.min(0.85, Math.max(0.12, w * 0.9));
            let strokeWidth = Math.max(0.75, Math.min(5.5, w * 5));

            if (anyHover) {
              if (hoveredQ !== null && hoveredK !== null) {
                if (isPairMatch) {
                  stroke = "#d9480f";
                  opacity = 0.95;
                  strokeWidth = Math.max(1.8, strokeWidth * 1.3);
                } else {
                  opacity = 0.04;
                }
              } else if (hoveredQ !== null) {
                if (isQMatch) {
                  stroke = "#d9480f";
                  opacity = Math.max(0.3, Math.min(0.95, w));
                  strokeWidth = Math.max(1.2, strokeWidth * 1.2);
                } else {
                  opacity = 0.04;
                }
              } else if (hoveredK !== null) {
                if (isKMatch) {
                  stroke = "#d9480f";
                  opacity = Math.max(0.3, Math.min(0.95, w));
                  strokeWidth = Math.max(1.2, strokeWidth * 1.2);
                } else {
                  opacity = 0.04;
                }
              }
            }

            return (
              <path
                key={`${q}-${k}`}
                d={d}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeOpacity={opacity}
              />
            );
          })}
        </g>

        {/* Query tokens (top row) */}
        <g>
          <text x={paddingX} y={qY - 14} fontSize={10} fill="#777777" fontFamily="system-ui, sans-serif">
            queries
          </text>
          {tokens.map((tok, i) => {
            const x = paddingX + i * step;
            const isHovered = hoveredQ === i;
            return (
              <g
                key={`q-${i}`}
                transform={`translate(${x}, ${qY})`}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => onHoverQ(i)}
                onMouseLeave={() => onHoverQ(null)}
              >
                <circle cx={0} cy={6} r={2.5} fill={isHovered ? "#d9480f" : "#111111"} />
                <rect x={-11} y={-16} width={22} height={24} fill="transparent" />
                <text
                  x={0}
                  y={-2}
                  textAnchor="middle"
                  fontFamily="ui-monospace, SF Mono, Menlo, monospace"
                  fontSize={11}
                  fontWeight={isHovered ? 600 : 400}
                  fill={isHovered ? "#d9480f" : "#111111"}
                >
                  {tok.token}
                </text>
              </g>
            );
          })}
        </g>

        {/* Key tokens (bottom row) */}
        <g>
          <text x={paddingX} y={kY + 28} fontSize={10} fill="#777777" fontFamily="system-ui, sans-serif">
            keys
          </text>
          {tokens.map((tok, i) => {
            const x = paddingX + i * step;
            const isHovered = hoveredK === i;
            return (
              <g
                key={`k-${i}`}
                transform={`translate(${x}, ${kY})`}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => onHoverK(i)}
                onMouseLeave={() => onHoverK(null)}
              >
                <circle cx={0} cy={-6} r={2.5} fill={isHovered ? "#d9480f" : "#111111"} />
                <rect x={-11} y={-8} width={22} height={24} fill="transparent" />
                <text
                  x={0}
                  y={14}
                  textAnchor="middle"
                  fontFamily="ui-monospace, SF Mono, Menlo, monospace"
                  fontSize={11}
                  fontWeight={isHovered ? 600 : 400}
                  fill={isHovered ? "#d9480f" : "#111111"}
                >
                  {tok.token}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

export const AttentionMatrix = ({
  tokens = [],
  weights = [],
  hoveredQ = null,
  hoveredK = null,
  onHoverCell = () => {},
  size = 210
}) => {
  const n = tokens.length || 15;
  const cellSize = size / n;

  return (
    <div style={{ display: "inline-block", position: "relative" }}>
      <svg width={size + 36} height={size + 36} style={{ display: "block" }}>
        <g transform="translate(24, 20)">
          {/* Axis Labels */}
          <text x={-6} y={-8} fontSize={9} fill="#777777" textAnchor="end" fontFamily="system-ui, sans-serif">
            q ↓ k →
          </text>

          {/* Background grid */}
          <rect x={0} y={0} width={size} height={size} fill="#ffffff" stroke="#d9d9d9" strokeWidth={1} />

          {/* Matrix Cells */}
          {weights.map((row, q) =>
            row.map((w, k) => {
              const isSelected = hoveredQ === q && hoveredK === k;
              const isQRow = hoveredQ === q;
              const isKCol = hoveredK === k;

              // Greyscale opacity by weight
              const alpha = Math.min(1, Math.max(0, w));
              const fill = isSelected ? "#d9480f" : `rgba(17, 17, 17, ${alpha})`;

              return (
                <rect
                  key={`${q}-${k}`}
                  x={k * cellSize}
                  y={q * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill={fill}
                  stroke={isSelected ? "#d9480f" : isQRow || isKCol ? "rgba(217, 72, 15, 0.4)" : "#ffffff"}
                  strokeWidth={isSelected ? 1.5 : isQRow || isKCol ? 0.8 : 0.4}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => onHoverCell(q, k)}
                  onMouseLeave={() => onHoverCell(null, null)}
                />
              );
            })
          )}

          {/* Token index markers */}
          {tokens.map((tok, i) => (
            <g key={`idx-${i}`}>
              {i % 2 === 0 && (
                <>
                  <text
                    x={i * cellSize + cellSize / 2}
                    y={-4}
                    textAnchor="middle"
                    fontSize={8}
                    fill={hoveredK === i ? "#d9480f" : "#777777"}
                    fontFamily="ui-monospace, monospace"
                  >
                    {tok.token.slice(0, 3)}
                  </text>
                  <text
                    x={-4}
                    y={i * cellSize + cellSize / 2 + 3}
                    textAnchor="end"
                    fontSize={8}
                    fill={hoveredQ === i ? "#d9480f" : "#777777"}
                    fontFamily="ui-monospace, monospace"
                  >
                    {tok.token.slice(0, 3)}
                  </text>
                </>
              )}
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
};

export default function Widget({ model, React }) {
  const [dataVersion, setDataVersion] = React.useState(0);
  const [threshold, setThreshold] = React.useState(0.05);
  const [hoveredQ, setHoveredQ] = React.useState(null);
  const [hoveredK, setHoveredK] = React.useState(null);

  React.useEffect(() => {
    const handleUpdate = () => setDataVersion((v) => v + 1);
    model.on("change:head", handleUpdate);
    model.on("change:toks", handleUpdate);
    model.on("change:data", handleUpdate);
    return () => {
      model.off("change:head", handleUpdate);
      model.off("change:toks", handleUpdate);
      model.off("change:data", handleUpdate);
    };
  }, [model]);

  // Extract raw inputs
  const rawToks = model.get("toks");
  const rawHead = model.get("head");
  const rawData = model.get("data");

  // Normalize tokens
  const tokens = React.useMemo(() => {
    let arr = [];
    if (Array.isArray(rawToks)) {
      arr = rawToks;
    } else if (rawToks && typeof rawToks === "object") {
      if (Array.isArray(rawToks.pos) && Array.isArray(rawToks.token)) {
        arr = rawToks.pos.map((p, i) => ({ pos: p, token: rawToks.token[i] }));
      } else {
        const keys = Object.keys(rawToks);
        if (keys.length > 0 && typeof rawToks[keys[0]] === "object") {
          arr = Object.values(rawToks);
        }
      }
    }
    return arr.sort((a, b) => a.pos - b.pos);
  }, [rawToks, dataVersion]);

  // Determine current active layer and head
  const activeHead = React.useMemo(() => {
    if (rawHead && typeof rawHead === "object" && rawHead.layer !== undefined && rawHead.head !== undefined) {
      return { layer: Number(rawHead.layer), head: Number(rawHead.head) };
    }
    return { layer: 0, head: 0 };
  }, [rawHead, dataVersion]);

  // Extract matrix for current head
  const matrix = React.useMemo(() => {
    const n = tokens.length || 15;
    const grid = Array.from({ length: n }, () => Array(n).fill(0));

    if (!rawData) return grid;

    let rows = [];
    if (Array.isArray(rawData)) {
      rows = rawData;
    } else if (typeof rawData === "object") {
      if (Array.isArray(rawData.layer)) {
        const len = rawData.layer.length;
        for (let i = 0; i < len; i++) {
          rows.push({
            layer: rawData.layer[i],
            head: rawData.head[i],
            q: rawData.q[i],
            k: rawData.k[i],
            w: rawData.w[i]
          });
        }
      } else {
        rows = Object.values(rawData);
      }
    }

    const { layer, head } = activeHead;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r && r.layer === layer && r.head === head) {
        const q = Number(r.q);
        const k = Number(r.k);
        const w = Number(r.w);
        if (q >= 0 && q < n && k >= 0 && k < n) {
          grid[q][k] = w;
        }
      }
    }

    return grid;
  }, [rawData, activeHead, tokens.length, dataVersion]);

  const pattern = React.useMemo(() => {
    return classifyAttentionPattern(matrix, tokens.length || 15);
  }, [matrix, tokens.length]);

  // Top 3 keys for hovered query
  const topKeys = React.useMemo(() => {
    if (hoveredQ === null || !matrix[hoveredQ]) return [];
    return matrix[hoveredQ]
      .map((w, k) => ({ k, w, token: tokens[k]?.token || `${k}` }))
      .sort((a, b) => b.w - a.w)
      .slice(0, 3);
  }, [hoveredQ, matrix, tokens]);

  return (
    <div
      style={{
        background: "#ffffff",
        color: "#111111",
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
        padding: 12,
        boxSizing: "border-box",
        minHeight: 330,
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}
    >
      {/* Top Bar / Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 8,
          borderBottom: "1px solid #d9d9d9"
        }}
      >
        <ThresholdSlider value={threshold} onChange={setThreshold} min={0} max={0.5} step={0.01} />

        <div style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: "#111111" }}>
          layer {activeHead.layer} · head {activeHead.head} · <span style={{ color: "#777777" }}>{pattern}</span>
        </div>
      </div>

      {/* Main visualization grid */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Left Side: Arcs & Top keys readout */}
        <div style={{ flex: "1 1 auto", minWidth: 430 }}>
          <AttentionArcs
            tokens={tokens}
            weights={matrix}
            threshold={threshold}
            hoveredQ={hoveredQ}
            hoveredK={hoveredK}
            onHoverQ={setHoveredQ}
            onHoverK={setHoveredK}
          />

          {/* Top 3 keys readout */}
          <div
            style={{
              marginTop: 4,
              minHeight: 24,
              fontSize: 11,
              fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "#777777"
            }}
          >
            {hoveredQ !== null ? (
              <>
                <span style={{ color: "#111111" }}>
                  q{hoveredQ} ({tokens[hoveredQ]?.token})
                </span>
                <span>top keys:</span>
                {topKeys.map((item, idx) => (
                  <span
                    key={idx}
                    style={{
                      color: hoveredK === item.k ? "#d9480f" : "#111111",
                      cursor: "pointer"
                    }}
                    onMouseEnter={() => setHoveredK(item.k)}
                    onMouseLeave={() => setHoveredK(null)}
                  >
                    k{item.k} <span style={{ color: "#777777" }}>({item.token})</span> {item.w.toFixed(3)}
                  </span>
                ))}
              </>
            ) : (
              <span style={{ color: "#777777" }}>hover a query token to isolate arcs and top keys</span>
            )}
          </div>
        </div>

        {/* Right Side: Matrix */}
        <div
          style={{
            borderLeft: "1px solid #d9d9d9",
            paddingLeft: 16,
            flex: "0 0 250px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}
        >
          <AttentionMatrix
            tokens={tokens}
            weights={matrix}
            hoveredQ={hoveredQ}
            hoveredK={hoveredK}
            onHoverCell={(q, k) => {
              setHoveredQ(q);
              setHoveredK(k);
            }}
            size={200}
          />

          <div
            style={{
              width: "100%",
              marginTop: 6,
              fontSize: 11,
              fontFamily: "ui-monospace, monospace",
              textAlign: "right",
              color: "#777777",
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {hoveredQ !== null && hoveredK !== null && matrix[hoveredQ] ? (
              <span>
                q{hoveredQ} → k{hoveredK}: <strong style={{ color: "#d9480f", fontWeight: 600 }}>{matrix[hoveredQ][hoveredK]?.toFixed(4)}</strong>
              </span>
            ) : (
              <span>15×15 attention</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}