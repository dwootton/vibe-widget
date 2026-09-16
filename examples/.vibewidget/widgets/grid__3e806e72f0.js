import * as d3 from "https://esm.sh/d3@7";

// Helper to determine induction target for query position q
function computeInductionTarget(q, toks) {
  if (!toks || toks.length === 0 || q <= 0) return -1;
  const currToken = toks[q]?.token ?? toks[q];
  for (let prevPos = q - 1; prevPos >= 0; prevPos--) {
    const t = toks[prevPos]?.token ?? toks[prevPos];
    if (t === currToken && prevPos + 1 <= q) {
      return prevPos + 1;
    }
  }
  return -1;
}

export const HeatmapCanvas = ({ grid, size = 52, isSelected = false, faded = false, onSelect, React }) => {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const N = 15;
    const cellSize = size / N;

    ctx.clearRect(0, 0, size, size);

    // Color interpolation: white #ffffff to dark blue #08306b
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (c > r) {
          ctx.fillStyle = "#fafafa";
          ctx.fillRect(c * cellSize, r * cellSize, cellSize + 0.5, cellSize + 0.5);
          continue;
        }
        const val = grid ? grid[r * N + c] || 0 : 0;
        const color = d3.interpolateBlues(Math.min(1, Math.max(0, val)));
        ctx.fillStyle = color;
        ctx.fillRect(c * cellSize, r * cellSize, cellSize + 0.5, cellSize + 0.5);
      }
    }
  }, [grid, size]);

  return (
    <div
      onClick={onSelect}
      style={{
        width: size,
        height: size,
        cursor: "pointer",
        position: "relative",
        boxSizing: "border-box",
        border: isSelected ? "2px solid #d9480f" : "1px solid #d9d9d9",
        opacity: faded ? 0.22 : 1.0,
        transition: "opacity 120ms ease, border 100ms ease",
        background: "#fff",
      }}
    >
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ display: "block", width: size, height: size }}
      />
    </div>
  );
};

export const PatternChip = ({ pattern, faded }) => {
  const colors = {
    prev: { text: "#0c8599", bg: "#e3fafc", border: "#99e9f2" },
    bos: { text: "#495057", bg: "#f1f3f5", border: "#ced4da" },
    induction: { text: "#2b8a3e", bg: "#ebfbee", border: "#b2f2bb" },
    mixed: { text: "#868e96", bg: "#f8f9fa", border: "#e9ecef" },
  };

  const c = colors[pattern] || colors.mixed;

  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "9px",
        fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        lineHeight: 1,
        padding: "2px 4px",
        border: `1px solid ${c.border}`,
        borderRadius: "2px",
        color: c.text,
        background: c.bg,
        opacity: faded ? 0.3 : 1,
        transition: "opacity 120ms ease",
        textAlign: "center",
      }}
    >
      {pattern}
    </span>
  );
};

export const HeadCell = ({
  layer,
  head,
  grid,
  pattern,
  prevMass,
  threshold,
  isSelected,
  onSelect,
  React,
}) => {
  const faded = prevMass < threshold;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        userSelect: "none",
      }}
    >
      <HeatmapCanvas
        grid={grid}
        size={54}
        isSelected={isSelected}
        faded={faded}
        onSelect={onSelect}
        React={React}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <PatternChip pattern={pattern} faded={faded} />
      </div>
    </div>
  );
};

export const SliderControl = ({ value, onChange, React }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 12,
        color: "#111111",
      }}
    >
      <label
        htmlFor="mass-threshold-slider"
        style={{ color: "#777777", whiteSpace: "nowrap" }}
      >
        mass on previous token ≥
      </label>
      <input
        id="mass-threshold-slider"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onInput={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: 140,
          cursor: "pointer",
          accentColor: "#111111",
        }}
      />
      <span
        style={{
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
          fontVariantNumeric: "tabular-nums",
          minWidth: 32,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {value.toFixed(2)}
      </span>
    </div>
  );
};

export default function Widget({ model, React }) {
  const [data, setData] = React.useState(() => model.get("data") || []);
  const [toks, setToks] = React.useState(() => model.get("toks") || []);
  const [threshold, setThreshold] = React.useState(0);
  const [selectedHead, setSelectedHead] = React.useState({ layer: 1, head: 3 });

  // Sync inputs on model change
  React.useEffect(() => {
    const handleDataChange = () => setData(model.get("data") || []);
    const handleToksChange = () => setToks(model.get("toks") || []);

    model.on("change:data", handleDataChange);
    model.on("change:toks", handleToksChange);

    return () => {
      model.off("change:data", handleDataChange);
      model.off("change:toks", handleToksChange);
    };
  }, [model]);

  // Sync output: head = {layer, head}
  React.useEffect(() => {
    model.set("head", selectedHead);
    model.save_changes();
  }, [selectedHead, model]);

  // Precompute token list in position order
  const tokenList = React.useMemo(() => {
    if (!toks || toks.length === 0) return [];
    if (Array.isArray(toks)) {
      const sorted = [...toks].sort((a, b) => a.pos - b.pos);
      return sorted.map((t) => t.token);
    }
    // Dict format fallback
    if (toks.pos && toks.token) {
      const res = [];
      for (let i = 0; i < toks.pos.length; i++) {
        res[toks.pos[i]] = toks.token[i];
      }
      return res;
    }
    return [];
  }, [toks]);

  // Precompute induction target per query position q
  const inductionTargets = React.useMemo(() => {
    const targets = new Array(15).fill(-1);
    for (let q = 0; q < 15; q++) {
      targets[q] = computeInductionTarget(q, tokenList);
    }
    return targets;
  }, [tokenList]);

  // Process data into 6x8 matrices & pattern classifications
  const headsData = React.useMemo(() => {
    const numLayers = 6;
    const numHeads = 8;
    const N = 15;

    // Allocate flat grids: 6 x 8 x 225
    const grids = Array.from({ length: numLayers }, () =>
      Array.from({ length: numHeads }, () => new Float32Array(N * N))
    );

    // Populate weights
    if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const l = row.layer;
        const h = row.head;
        const q = row.q;
        const k = row.k;
        if (l < numLayers && h < numHeads && q < N && k < N) {
          grids[l][h][q * N + k] = row.w;
        }
      }
    } else if (data && data.layer) {
      const len = data.layer.length || 0;
      for (let i = 0; i < len; i++) {
        const l = data.layer[i];
        const h = data.head[i];
        const q = data.q[i];
        const k = data.k[i];
        const w = data.w[i];
        if (l < numLayers && h < numHeads && q < N && k < N) {
          grids[l][h][q * N + k] = w;
        }
      }
    }

    // Compute metrics and dominant pattern for each head
    const result = Array.from({ length: numLayers }, () =>
      Array.from({ length: numHeads }, () => null)
    );

    for (let l = 0; l < numLayers; l++) {
      for (let h = 0; h < numHeads; h++) {
        const g = grids[l][h];
        let totalPrev = 0;
        let countPrev = 0;
        let totalBos = 0;
        let countBos = 0;
        let totalInd = 0;
        let countInd = 0;

        for (let q = 0; q < N; q++) {
          // BOS at k = 0 (valid for all q >= 0)
          totalBos += g[q * N + 0];
          countBos++;

          // Prev token at k = q - 1 (valid for q >= 1)
          if (q >= 1) {
            totalPrev += g[q * N + (q - 1)];
            countPrev++;
          }

          // Induction target (valid when target >= 0)
          const targetK = inductionTargets[q];
          if (targetK >= 0 && targetK <= q) {
            totalInd += g[q * N + targetK];
            countInd++;
          }
        }

        const avgPrev = countPrev > 0 ? totalPrev / countPrev : 0;
        const avgBos = countBos > 0 ? totalBos / countBos : 0;
        const avgInd = countInd > 0 ? totalInd / countInd : 0;

        let pattern = "mixed";
        const maxVal = Math.max(avgPrev, avgBos, avgInd);
        if (maxVal > 0.25) {
          if (avgPrev === maxVal) pattern = "prev";
          else if (avgBos === maxVal) pattern = "bos";
          else if (avgInd === maxVal) pattern = "induction";
        }

        result[l][h] = {
          grid: g,
          prevMass: avgPrev,
          pattern,
        };
      }
    }

    return result;
  }, [data, inductionTargets]);

  const layers = [0, 1, 2, 3, 4, 5];
  const heads = [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div
      style={{
        padding: 12,
        background: "#ffffff",
        color: "#111111",
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
        boxSizing: "border-box",
        minWidth: 540,
        maxWidth: 620,
      }}
    >
      {/* Top Controls Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: 10,
          marginBottom: 10,
          borderBottom: "1px solid #d9d9d9",
        }}
      >
        <SliderControl value={threshold} onChange={setThreshold} React={React} />
        <div
          style={{
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: 12,
            color: "#111111",
          }}
        >
          L{selectedHead.layer} H{selectedHead.head}
        </div>
      </div>

      {/* Grid Table */}
      <div style={{ display: "inline-block" }}>
        {/* Head Column Headers */}
        <div style={{ display: "flex", marginLeft: 28, marginBottom: 4 }}>
          {heads.map((h) => (
            <div
              key={h}
              style={{
                width: 54,
                marginRight: 6,
                textAlign: "center",
                fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                fontSize: 11,
                color: "#777777",
              }}
            >
              H{h}
            </div>
          ))}
        </div>

        {/* Rows by Layer */}
        {layers.map((l) => (
          <div
            key={l}
            style={{
              display: "flex",
              alignItems: "flex-start",
              marginBottom: 7,
            }}
          >
            {/* Layer Row Label */}
            <div
              style={{
                width: 24,
                marginRight: 4,
                paddingTop: 18,
                textAlign: "right",
                fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                fontSize: 11,
                color: "#777777",
              }}
            >
              L{l}
            </div>

            {/* Cells in Row */}
            <div style={{ display: "flex", gap: 6 }}>
              {heads.map((h) => {
                const cell = headsData[l]?.[h];
                const isSelected =
                  selectedHead.layer === l && selectedHead.head === h;
                return (
                  <HeadCell
                    key={`${l}-${h}`}
                    layer={l}
                    head={h}
                    grid={cell?.grid}
                    pattern={cell?.pattern || "mixed"}
                    prevMass={cell?.prevMass || 0}
                    threshold={threshold}
                    isSelected={isSelected}
                    onSelect={() => setSelectedHead({ layer: l, head: h })}
                    React={React}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}