import * as d3 from "https://esm.sh/d3@7";

// Helper to normalize DataFrame into array of records
function toRecords(df) {
  if (!df) return [];
  if (Array.isArray(df)) return df;
  if (typeof df === "object") {
    const keys = Object.keys(df);
    if (keys.length === 0) return [];
    if (Array.isArray(df[keys[0]])) {
      const len = df[keys[0]].length;
      const records = new Array(len);
      for (let i = 0; i < len; i++) {
        const row = {};
        for (let j = 0; j < keys.length; j++) {
          row[keys[j]] = df[keys[j]][i];
        }
        records[i] = row;
      }
      return records;
    }
  }
  return [];
}

const PATTERN_CONFIG = {
  prev: {
    label: "prev",
    title: "Previous Token",
    desc: "Attends to immediate predecessor (k = q - 1)",
    color: "#047857",
    bg: "#ecfdf5",
    border: "#a7f3d0",
  },
  bos: {
    label: "bos",
    title: "Beginning of Sequence",
    desc: "Attends to start token (k = 0)",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  induction: {
    label: "induction",
    title: "Induction Head",
    desc: "Attends to token after prior match [A][B]...[A] -> [B]",
    color: "#6d28d9",
    bg: "#f5f3ff",
    border: "#ddd6fe",
  },
  mixed: {
    label: "mixed",
    title: "Mixed / Diffuse",
    desc: "Distributed or specialized attention weights",
    color: "#475569",
    bg: "#f1f5f9",
    border: "#cbd5e1",
  },
};

// Reusable Pattern Badge
export const PatternChip = ({ pattern, count = null, isSelected = false, onClick = null }) => {
  const conf = PATTERN_CONFIG[pattern] || PATTERN_CONFIG.mixed;
  const style = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: count !== null ? "3px 8px" : "1px 5px",
    borderRadius: "9999px",
    fontSize: count !== null ? "11px" : "9.5px",
    fontWeight: 600,
    fontFamily: "'Fira Code', Menlo, monospace",
    color: conf.color,
    backgroundColor: conf.bg,
    border: `1px solid ${isSelected ? conf.color : conf.border}`,
    boxShadow: isSelected ? `0 0 0 1px ${conf.color}` : "none",
    cursor: onClick ? "pointer" : "default",
    transition: "all 0.15s ease",
    userSelect: "none",
    lineHeight: 1.2,
  };

  return (
    <span style={style} onClick={onClick}>
      <span>{conf.label}</span>
      {count !== null && (
        <span style={{ opacity: 0.75, fontWeight: 500 }}>({count})</span>
      )}
    </span>
  );
};

// Standalone Mini Heatmap Canvas
export const MiniHeatmap = ({ matrix, size = 56 }) => {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const imgData = ctx.createImageData(15, 15);
    const d = imgData.data;

    // Fill background (masked causal upper triangle with light off-white)
    for (let i = 0; i < 15 * 15 * 4; i += 4) {
      d[i] = 248;
      d[i + 1] = 250;
      d[i + 2] = 252;
      d[i + 3] = 255;
    }

    const blues = d3.interpolateBlues;
    for (let q = 0; q < 15; q++) {
      for (let k = 0; k <= q; k++) {
        const val = matrix ? (matrix[q * 15 + k] || 0) : 0;
        // Map 0 -> white (#fff), 1 -> dark blue (#08306b)
        const c = d3.rgb(blues(Math.min(1, Math.max(0, val))));
        const idx = (q * 15 + k) * 4;
        d[idx] = c.r;
        d[idx + 1] = c.g;
        d[idx + 2] = c.b;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [matrix]);

  return (
    <canvas
      ref={canvasRef}
      width={15}
      height={15}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        imageRendering: "pixelated",
        borderRadius: "3px",
        border: "1px solid #cbd5e1",
        display: "block",
        background: "#ffffff",
      }}
    />
  );
};

// Standalone Attention Head Cell
export const AttentionCell = ({
  layer,
  head,
  headData,
  isSelected,
  isFaded,
  onClick,
}) => {
  const isBelow = isFaded;
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "5px 4px 6px 4px",
        backgroundColor: isSelected ? "#fff7ed" : "#ffffff",
        borderRadius: "6px",
        cursor: "pointer",
        position: "relative",
        border: isSelected ? "2.5px solid #ea580c" : "1px solid #e2e8f0",
        boxShadow: isSelected
          ? "0 0 0 2px rgba(234, 88, 12, 0.35), 0 4px 10px rgba(234, 88, 12, 0.15)"
          : "0 1px 2px rgba(0, 0, 0, 0.04)",
        opacity: isBelow ? 0.18 : 1,
        filter: isBelow ? "grayscale(70%)" : "none",
        transition: "opacity 0.25s ease, filter 0.25s ease, transform 0.15s ease, border 0.15s ease",
        transform: isSelected ? "scale(1.02)" : "scale(1)",
        zIndex: isSelected ? 5 : 1,
        userSelect: "none",
      }}
      title={`Layer ${layer}, Head ${head} | Pattern: ${headData?.pattern} | Mass on prev: ${(headData?.prevMass ?? 0).toFixed(3)}`}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          padding: "0 2px 3px 2px",
        }}
      >
        <span
          style={{
            fontFamily: "'Fira Code', Menlo, monospace",
            fontSize: "9px",
            fontWeight: 700,
            color: isSelected ? "#c2410c" : "#475569",
          }}
        >
          L{layer}·H{head}
        </span>
        <PatternChip pattern={headData?.pattern || "mixed"} />
      </div>

      <MiniHeatmap matrix={headData?.matrix} size={58} />

      <div
        style={{
          marginTop: "3px",
          fontSize: "8.5px",
          fontFamily: "'Fira Code', Menlo, monospace",
          color: isSelected ? "#9a3412" : "#64748b",
          fontWeight: 600,
        }}
      >
        prev: {(headData?.prevMass ?? 0).toFixed(2)}
      </div>
    </div>
  );
};

// Standalone Slider Control
export const SliderControl = ({
  value,
  onChange,
  activeCount,
  totalCount,
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        flexWrap: "wrap",
        padding: "10px 16px",
        backgroundColor: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "13px",
          fontWeight: 600,
          color: "#1e293b",
          fontFamily: "'Fira Code', Menlo, monospace",
        }}
      >
        <span>mass on previous token ≥</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={value}
          onInput={(e) => onChange(parseFloat(e.target.value))}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            width: "170px",
            cursor: "pointer",
            accentColor: "#ea580c",
          }}
        />
        <span
          style={{
            display: "inline-block",
            minWidth: "38px",
            padding: "2px 6px",
            backgroundColor: "#fff7ed",
            color: "#c2410c",
            borderRadius: "4px",
            border: "1px solid #fdba74",
            fontSize: "12px",
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          {value.toFixed(2)}
        </span>
      </label>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          color: "#475569",
          fontFamily: "'Fira Code', Menlo, monospace",
        }}
      >
        <span>
          Active heads:{" "}
          <strong style={{ color: activeCount > 0 ? "#0f172a" : "#dc2626" }}>
            {activeCount}
          </strong>{" "}
          / {totalCount}
        </span>
        {value > 0 && (
          <button
            onClick={() => onChange(0)}
            style={{
              padding: "2px 8px",
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              borderRadius: "4px",
              fontSize: "11px",
              cursor: "pointer",
              color: "#334155",
            }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
};

// Standalone Detail Inspector View for the Selected Head
export const HeadDetailView = ({
  headInfo,
  tokens,
  headData,
  indTargetsByQ,
}) => {
  const [hoveredCell, setHoveredCell] = React.useState(null);

  if (!headData) {
    return (
      <div style={{ padding: "24px", color: "#64748b", fontStyle: "italic" }}>
        No head selected.
      </div>
    );
  }

  const { layer, head } = headInfo;
  const matrix = headData.matrix || new Float32Array(225);
  const patternConf = PATTERN_CONFIG[headData.pattern] || PATTERN_CONFIG.mixed;

  const cellSize = 18;
  const labelMargin = 72;
  const svgSize = labelMargin + 15 * cellSize;

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        padding: "16px 20px",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.04)",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      {/* Title & Pattern Badge */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #f1f5f9",
          paddingBottom: "10px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "#0f172a",
              fontFamily: "'Playfair Display', Georgia, serif",
              letterSpacing: "0.2px",
            }}
          >
            Layer {layer} · Head {head}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "#64748b",
              marginTop: "2px",
            }}
          >
            {patternConf.desc}
          </div>
        </div>
        <PatternChip pattern={headData.pattern} />
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "8px",
        }}
      >
        <div
          style={{
            padding: "8px 10px",
            borderRadius: "6px",
            backgroundColor: "#ecfdf5",
            border: "1px solid #a7f3d0",
          }}
        >
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#065f46" }}>
            PREV MASS (k=q-1)
          </div>
          <div
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "#047857",
              fontFamily: "'Fira Code', Menlo, monospace",
            }}
          >
            {(headData.prevMass * 100).toFixed(1)}%
          </div>
        </div>

        <div
          style={{
            padding: "8px 10px",
            borderRadius: "6px",
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
          }}
        >
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#92400e" }}>
            BOS MASS (k=0)
          </div>
          <div
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "#b45309",
              fontFamily: "'Fira Code', Menlo, monospace",
            }}
          >
            {(headData.bosMass * 100).toFixed(1)}%
          </div>
        </div>

        <div
          style={{
            padding: "8px 10px",
            borderRadius: "6px",
            backgroundColor: "#f5f3ff",
            border: "1px solid #ddd6fe",
          }}
        >
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#5b21b6" }}>
            INDUCTION MASS
          </div>
          <div
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "#6d28d9",
              fontFamily: "'Fira Code', Menlo, monospace",
            }}
          >
            {(headData.indMass * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* 15x15 Heatmap SVG */}
      <div style={{ position: "relative", overflowX: "auto" }}>
        <svg
          width={svgSize + 10}
          height={svgSize + 10}
          style={{ display: "block", margin: "0 auto" }}
        >
          {/* Key labels on Top */}
          {tokens.map((tok, k) => (
            <text
              key={`k-${k}`}
              x={labelMargin + k * cellSize + cellSize / 2}
              y={labelMargin - 6}
              textAnchor="middle"
              style={{
                fontSize: "9px",
                fontFamily: "'Fira Code', Menlo, monospace",
                fill: "#475569",
                userSelect: "none",
              }}
            >
              {tok}
            </text>
          ))}

          {/* Query labels on Left */}
          {tokens.map((tok, q) => (
            <text
              key={`q-${q}`}
              x={labelMargin - 8}
              y={labelMargin + q * cellSize + cellSize / 2 + 3}
              textAnchor="end"
              style={{
                fontSize: "9px",
                fontFamily: "'Fira Code', Menlo, monospace",
                fill: "#475569",
                userSelect: "none",
              }}
            >
              {tok}
            </text>
          ))}

          {/* Matrix Cells */}
          <g transform={`translate(${labelMargin}, ${labelMargin})`}>
            {Array.from({ length: 15 }).map((_, q) =>
              Array.from({ length: 15 }).map((_, k) => {
                if (k > q) {
                  // Causal masked upper triangle
                  return (
                    <rect
                      key={`${q}-${k}`}
                      x={k * cellSize}
                      y={q * cellSize}
                      width={cellSize - 1}
                      height={cellSize - 1}
                      fill="#f8fafc"
                      stroke="#f1f5f9"
                      strokeWidth={0.5}
                    />
                  );
                }

                const w = matrix[q * 15 + k] || 0;
                const isHovered =
                  hoveredCell && hoveredCell.q === q && hoveredCell.k === k;
                const isPrev = k === q - 1;
                const isBos = k === 0;
                const isInd =
                  indTargetsByQ[q] && indTargetsByQ[q].includes(k);

                return (
                  <rect
                    key={`${q}-${k}`}
                    x={k * cellSize}
                    y={q * cellSize}
                    width={cellSize - 1}
                    height={cellSize - 1}
                    fill={d3.interpolateBlues(Math.min(1, Math.max(0, w)))}
                    stroke={
                      isHovered
                        ? "#ea580c"
                        : isInd
                        ? "#8b5cf6"
                        : isPrev
                        ? "#10b981"
                        : isBos
                        ? "#f59e0b"
                        : "#ffffff"
                    }
                    strokeWidth={isHovered ? 2 : isInd || isPrev || isBos ? 1.2 : 0.5}
                    style={{ cursor: "crosshair", transition: "stroke 0.1s" }}
                    onMouseEnter={() =>
                      setHoveredCell({
                        q,
                        k,
                        w,
                        qTok: tokens[q],
                        kTok: tokens[k],
                        isPrev,
                        isBos,
                        isInd,
                      })
                    }
                    onMouseLeave={() => setHoveredCell(null)}
                  />
                );
              })
            )}
          </g>
        </svg>

        {/* Hover Readout Bar */}
        <div
          style={{
            minHeight: "26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 8px",
            backgroundColor: "#f8fafc",
            borderRadius: "4px",
            border: "1px solid #e2e8f0",
            fontSize: "11px",
            fontFamily: "'Fira Code', Menlo, monospace",
            color: "#334155",
            marginTop: "6px",
          }}
        >
          {hoveredCell ? (
            <>
              <div>
                q[{hoveredCell.q}]: <strong>"{hoveredCell.qTok}"</strong> → k[{hoveredCell.k}]: <strong>"{hoveredCell.kTok}"</strong>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                {hoveredCell.isPrev && <span style={{ color: "#047857", fontWeight: 700 }}>[prev]</span>}
                {hoveredCell.isBos && <span style={{ color: "#b45309", fontWeight: 700 }}>[bos]</span>}
                {hoveredCell.isInd && <span style={{ color: "#6d28d9", fontWeight: 700 }}>[induction]</span>}
                <span>
                  w = <strong>{hoveredCell.w.toFixed(4)}</strong>
                </span>
              </div>
            </>
          ) : (
            <span style={{ color: "#94a3b8" }}>
              Hover any cell in the heatmap to inspect exact attention weight
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// Main Export Component
export default function AttentionGridWidget({ model, React }) {
  // 1. Inputs state from Python traits
  const [toksRecords, setToksRecords] = React.useState(() =>
    toRecords(model.get("toks"))
  );
  const [dataRecords, setDataRecords] = React.useState(() =>
    toRecords(model.get("data"))
  );

  // Filter slider state
  const [prevThreshold, setPrevThreshold] = React.useState(0);

  // Selected cell output state - prompt specifies: "start with layer 1 head 3 selected"
  const [selectedHead, setSelectedHead] = React.useState({ layer: 1, head: 3 });

  // Filter chip selection state (optional pattern filtering: null | 'prev' | 'bos' | 'induction' | 'mixed')
  const [patternFilter, setPatternFilter] = React.useState(null);

  // 2. Subscribe to trait changes
  React.useEffect(() => {
    const handleToksChange = () => setToksRecords(toRecords(model.get("toks")));
    const handleDataChange = () => setDataRecords(toRecords(model.get("data")));

    model.on("change:toks", handleToksChange);
    model.on("change:data", handleDataChange);

    return () => {
      model.off("change:toks", handleToksChange);
      model.off("change:data", handleDataChange);
    };
  }, [model]);

  // 3. Sync selected output trait
  React.useEffect(() => {
    model.set("head", selectedHead);
    model.save_changes();
  }, [selectedHead, model]);

  // 4. Parse token strings
  const tokens = React.useMemo(() => {
    const arr = new Array(15).fill("");
    toksRecords.forEach((r) => {
      if (r.pos !== undefined && r.pos < 15) {
        arr[r.pos] = r.token !== undefined ? String(r.token) : "";
      }
    });
    return arr;
  }, [toksRecords]);

  // 5. Precompute induction targets for each query position q:
  // "on the token after the previous occurrence of the same token"
  const indTargetsByQ = React.useMemo(() => {
    const map = {};
    for (let q = 0; q < 15; q++) {
      const targets = [];
      const curTok = tokens[q];
      if (curTok) {
        for (let p = 0; p < q - 1; p++) {
          if (tokens[p] === curTok) {
            targets.push(p + 1);
          }
        }
      }
      map[q] = targets;
    }
    return map;
  }, [tokens]);

  // 6. Compute head attention matrices and dominant patterns:
  // 6 layers (rows) x 8 heads (columns) = 48 heads
  const headsData = React.useMemo(() => {
    // headsMap[layer][head]
    const map = {};
    for (let l = 0; l < 6; l++) {
      map[l] = {};
      for (let h = 0; h < 8; h++) {
        map[l][h] = {
          matrix: new Float32Array(225),
          prevMass: 0,
          bosMass: 0,
          indMass: 0,
          pattern: "mixed",
        };
      }
    }

    // Populate matrix values
    dataRecords.forEach((r) => {
      const l = r.layer;
      const h = r.head;
      const q = r.q;
      const k = r.k;
      const w = Number(r.w) || 0;
      if (
        l >= 0 &&
        l < 6 &&
        h >= 0 &&
        h < 8 &&
        q >= 0 &&
        q < 15 &&
        k >= 0 &&
        k <= q
      ) {
        map[l][h].matrix[q * 15 + k] = w;
      }
    });

    // Compute dominant pattern for each head
    for (let l = 0; l < 6; l++) {
      for (let h = 0; h < 8; h++) {
        const item = map[l][h];
        const mat = item.matrix;

        // prevMass: average w where k = q - 1 (queries 1..14)
        let sumPrev = 0;
        let countPrev = 0;
        for (let q = 1; q < 15; q++) {
          sumPrev += mat[q * 15 + (q - 1)];
          countPrev++;
        }
        item.prevMass = countPrev > 0 ? sumPrev / countPrev : 0;

        // bosMass: average w where k = 0 (queries 1..14)
        let sumBos = 0;
        let countBos = 0;
        for (let q = 1; q < 15; q++) {
          sumBos += mat[q * 15 + 0];
          countBos++;
        }
        item.bosMass = countBos > 0 ? sumBos / countBos : 0;

        // indMass: average w on token after previous occurrence of same token
        let sumInd = 0;
        let countInd = 0;
        for (let q = 1; q < 15; q++) {
          const targets = indTargetsByQ[q];
          if (targets && targets.length > 0) {
            for (let t = 0; t < targets.length; t++) {
              sumInd += mat[q * 15 + targets[t]];
            }
            countInd += targets.length;
          }
        }
        item.indMass = countInd > 0 ? sumInd / countInd : 0;

        // Determine dominant pattern: 'prev' if most mass sits on k=q-1, 'bos' if on k=0, 'induction' if on induction target, else 'mixed'
        const maxVal = Math.max(item.prevMass, item.bosMass, item.indMass);
        if (maxVal >= 0.22) {
          if (maxVal === item.prevMass) item.pattern = "prev";
          else if (maxVal === item.bosMass) item.pattern = "bos";
          else if (maxVal === item.indMass) item.pattern = "induction";
        } else {
          item.pattern = "mixed";
        }
      }
    }

    return map;
  }, [dataRecords, indTargetsByQ]);

  // Pattern counts for summary chips
  const patternCounts = React.useMemo(() => {
    const counts = { prev: 0, bos: 0, induction: 0, mixed: 0 };
    for (let l = 0; l < 6; l++) {
      for (let h = 0; h < 8; h++) {
        const p = headsData[l]?.[h]?.pattern || "mixed";
        counts[p] = (counts[p] || 0) + 1;
      }
    }
    return counts;
  }, [headsData]);

  // Active count based on slider threshold
  const activeCount = React.useMemo(() => {
    let count = 0;
    for (let l = 0; l < 6; l++) {
      for (let h = 0; h < 8; h++) {
        if ((headsData[l]?.[h]?.prevMass ?? 0) >= prevThreshold) {
          count++;
        }
      }
    }
    return count;
  }, [headsData, prevThreshold]);

  const selectedHeadData = headsData[selectedHead.layer]?.[selectedHead.head];

  return (
    <div
      style={{
        backgroundColor: "#fdfbf7",
        minHeight: "560px",
        padding: "20px 24px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#1e293b",
        boxSizing: "border-box",
      }}
    >
      {/* Header Narrative */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
          <h1
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "24px",
              fontWeight: 800,
              margin: 0,
              color: "#0f172a",
              letterSpacing: "-0.3px",
            }}
          >
            Attention Head Landscape
          </h1>
          <span
            style={{
              fontSize: "12px",
              fontFamily: "'Fira Code', Menlo, monospace",
              color: "#64748b",
            }}
          >
            6 Layers × 8 Heads (15×15 Causal Heatmaps)
          </span>
        </div>
        <p
          style={{
            margin: "4px 0 0 0",
            fontSize: "13px",
            color: "#475569",
            maxWidth: "760px",
            lineHeight: 1.4,
          }}
        >
          Each small cell renders attention weights <em>w</em> (queries as rows, keys as columns).
          Cells are classified by dominant behavior: <strong>prev</strong> (diagonal predecessor),{" "}
          <strong>bos</strong> (start token), <strong>induction</strong> (repetition copy), or <strong>mixed</strong>.
        </p>
      </div>

      {/* Top Controls Bar: Slider + Pattern Filters */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <SliderControl
          value={prevThreshold}
          onChange={setPrevThreshold}
          activeCount={activeCount}
          totalCount={48}
        />

        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <span
            style={{
              fontSize: "11px",
              color: "#64748b",
              fontWeight: 600,
              fontFamily: "'Fira Code', Menlo, monospace",
              marginRight: "4px",
            }}
          >
            Filter:
          </span>
          {["prev", "bos", "induction", "mixed"].map((p) => (
            <PatternChip
              key={p}
              pattern={p}
              count={patternCounts[p]}
              isSelected={patternFilter === p}
              onClick={() =>
                setPatternFilter((curr) => (curr === p ? null : p))
              }
            />
          ))}
        </div>
      </div>

      {/* Main Content Layout: Grid on Left, Deep Dive Inspector on Right */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(540px, 1.4fr) minmax(360px, 1fr)",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* Grid Container */}
        <div
          style={{
            backgroundColor: "#f8fafc",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            padding: "12px 14px 14px 14px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
            overflowX: "auto",
          }}
        >
          {/* Column Headers (Heads 0 to 7) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "36px repeat(8, 1fr)",
              gap: "6px",
              marginBottom: "6px",
              textAlign: "center",
            }}
          >
            <div />
            {Array.from({ length: 8 }).map((_, h) => (
              <div
                key={`col-${h}`}
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  fontFamily: "'Fira Code', Menlo, monospace",
                  color: "#475569",
                  padding: "2px 0",
                }}
              >
                H{h}
              </div>
            ))}
          </div>

          {/* 6 Layers as Rows */}
          {Array.from({ length: 6 }).map((_, l) => (
            <div
              key={`layer-${l}`}
              style={{
                display: "grid",
                gridTemplateColumns: "36px repeat(8, 1fr)",
                gap: "6px",
                marginBottom: "6px",
                alignItems: "center",
              }}
            >
              {/* Row Header (Layer l) */}
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  fontFamily: "'Fira Code', Menlo, monospace",
                  color: "#334155",
                  textAlign: "center",
                }}
              >
                L{l}
              </div>

              {/* 8 Head Cells */}
              {Array.from({ length: 8 }).map((_, h) => {
                const cellData = headsData[l]?.[h];
                const isSelected =
                  selectedHead.layer === l && selectedHead.head === h;
                const isBelowSlider =
                  (cellData?.prevMass ?? 0) < prevThreshold;
                const matchesPattern =
                  patternFilter === null || cellData?.pattern === patternFilter;
                const isFaded = isBelowSlider || !matchesPattern;

                return (
                  <AttentionCell
                    key={`head-${l}-${h}`}
                    layer={l}
                    head={h}
                    headData={cellData}
                    isSelected={isSelected}
                    isFaded={isFaded}
                    onClick={() => setSelectedHead({ layer: l, head: h })}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Selected Head Deep-Dive Panel */}
        <HeadDetailView
          headInfo={selectedHead}
          tokens={tokens}
          headData={selectedHeadData}
          indTargetsByQ={indTargetsByQ}
        />
      </div>
    </div>
  );
}