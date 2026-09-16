import * as d3 from "https://esm.sh/d3@7";

// Helper: continuous color scale from fresh (warm yellow) to old (deep blue)
const createAgeColorScale = (minAge, maxAge) => {
  return d3.scaleSequential()
    .domain([minAge, maxAge])
    .interpolator(d3.interpolateRgbBasis(["#e5a93b", "#e06c53", "#9b4d82", "#413b7b", "#1a2456"]));
};

export const ColorLegend = ({ minAge, maxAge, width = 160, height = 10 }) => {
  const canvasRef = (node) => {
    if (!node) return;
    const ctx = node.getContext("2d");
    const colorScale = createAgeColorScale(minAge, maxAge);
    for (let x = 0; x < width; x++) {
      const t = x / (width - 1);
      const age = minAge + t * (maxAge - minAge);
      ctx.fillStyle = colorScale(age);
      ctx.fillRect(x, 0, 1, height);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, fontFamily: "monospace", color: "#2d3748" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Fresh ({minAge}d)</span>
        <span>Old ({maxAge}d)</span>
      </div>
      <canvas ref={canvasRef} width={width} height={height} style={{ borderRadius: 3, border: "1px solid rgba(0,0,0,0.15)" }} />
    </div>
  );
};

export const VerticalAgeSlider = ({ value, min, max, onChange, height = 320 }) => {
  const containerRef = (node) => {
    if (!node) return;
  };

  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min || 1)) * 100));

  const handlePointerDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const update = (clientY) => {
      // Invert: top is max age, bottom is min age (or top is 0 / fresh, bottom is old)
      // Standard: top = 0d (fresh), bottom = maxAge
      const clampY = Math.max(0, Math.min(rect.height, clientY - rect.top));
      const ratio = clampY / rect.height;
      const newVal = Math.round(min + ratio * (max - min));
      onChange(Math.max(min, Math.min(max, newVal)));
    };
    update(e.clientY);

    const onMove = (ev) => update(ev.clientY);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 44, userSelect: "none" }}>
      <div style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 600, color: "#4a5568", marginBottom: 6, textAlign: "center", lineHeight: 1.1 }}>
        ≤{value}d
      </div>
      <div
        onPointerDown={handlePointerDown}
        style={{
          position: "relative",
          width: 24,
          height: height,
          cursor: "ns-resize",
          display: "flex",
          justifyContent: "center",
          touchAction: "none"
        }}
      >
        <div style={{ position: "absolute", left: 10, width: 4, height: "100%", background: "#e2e8f0", borderRadius: 2 }} />
        <div
          style={{
            position: "absolute",
            left: 10,
            top: 0,
            width: 4,
            height: `${pct}%`,
            background: "#413b7b",
            borderRadius: 2
          }}
        />
        <div
          style={{
            position: "absolute",
            top: `calc(${pct}% - 8px)`,
            left: 3,
            width: 18,
            height: 16,
            borderRadius: 4,
            background: "#1a2456",
            border: "2px solid #ffffff",
            boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div style={{ width: 8, height: 2, background: "#fdfbf7", borderRadius: 1 }} />
        </div>
      </div>
      <div style={{ fontSize: 9, fontFamily: "monospace", color: "#718096", marginTop: 6 }}>
        {max}d
      </div>
    </div>
  );
};

export const TooltipOverlay = ({ tooltip }) => {
  if (!tooltip) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: tooltip.x + 14,
        top: tooltip.y - 12,
        pointerEvents: "none",
        zIndex: 9999,
        background: "rgba(24, 28, 38, 0.94)",
        color: "#fdfbf7",
        padding: "7px 11px",
        borderRadius: 5,
        fontSize: 11,
        fontFamily: "'Fira Code', 'Pitch', monospace",
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        lineHeight: 1.45,
        maxWidth: 320,
        wordBreak: "break-all"
      }}
    >
      <div style={{ fontWeight: 700, color: "#fed766", marginBottom: 2 }}>
        {tooltip.file}:{tooltip.line_no}
      </div>
      <div>
        <span style={{ color: "#a0aec0" }}>author:</span> {tooltip.author}
      </div>
      <div>
        <span style={{ color: "#a0aec0" }}>age:</span> {tooltip.age_days}d ·{" "}
        <span style={{ color: "#a0aec0" }}>churn:</span> {tooltip.churn_90d} commits
      </div>
      <div>
        <span style={{ color: "#a0aec0" }}>length:</span> {tooltip.line_len} chars
      </div>
    </div>
  );
};

export default function SeeSoftWidget({ model, React }) {
  // Safe extraction of inputs
  const rawData = model.get("data");
  
  // Normalize records
  const records = React.useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    if (typeof rawData === "object") {
      const keys = Object.keys(rawData);
      if (keys.length === 0) return [];
      const firstCol = rawData[keys[0]];
      if (Array.isArray(firstCol)) {
        const count = firstCol.length;
        const res = new Array(count);
        for (let i = 0; i < count; i++) {
          const row = {};
          for (const k of keys) {
            row[k] = rawData[k][i];
          }
          res[i] = row;
        }
        return res;
      }
    }
    return [];
  }, [rawData]);

  const [selectedFile, setSelectedFile] = React.useState(null);
  const [maxAge, setMaxAge] = React.useState(30);
  const [tooltip, setTooltip] = React.useState(null);

  // Stats calculation
  const stats = React.useMemo(() => {
    let minAge = 0;
    let maxAgeVal = 303;
    let maxLen = 80;

    if (records.length > 0) {
      const ages = records.map((d) => d.age_days ?? 0);
      minAge = Math.min(...ages);
      maxAgeVal = Math.max(...ages);
      const lens = records.map((d) => d.line_len ?? 0);
      maxLen = Math.max(10, Math.max(...lens));
    }
    return { minAge, maxAgeVal, maxLen };
  }, [records]);

  // Group files sorted alphabetically
  const fileGroups = React.useMemo(() => {
    const map = new Map();
    for (const r of records) {
      const fn = r.file || "unknown";
      if (!map.has(fn)) {
        map.set(fn, []);
      }
      map.get(fn).push(r);
    }
    // Sort lines inside files by line_no ascending
    const sortedEntries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return sortedEntries.map(([file, lines]) => {
      lines.sort((a, b) => (a.line_no || 0) - (b.line_no || 0));
      return { file, lines, count: lines.length };
    });
  }, [records]);

  // Initialize outputs
  React.useEffect(() => {
    model.set({
      selected_file: null,
      max_age: 30
    });
    model.save_changes();
  }, []);

  // Update outputs
  const handleSelectFile = (file) => {
    const next = selectedFile === file ? null : file;
    setSelectedFile(next);
    model.set("selected_file", next);
    model.save_changes();
  };

  const handleAgeChange = (val) => {
    setMaxAge(val);
    model.set("max_age", val);
    model.save_changes();
  };

  // Sync with external trait changes if any
  React.useEffect(() => {
    const onFileChange = () => {
      const val = model.get("selected_file");
      if (val !== undefined && val !== selectedFile) {
        setSelectedFile(val);
      }
    };
    const onMaxAgeChange = () => {
      const val = model.get("max_age");
      if (val !== undefined && val !== maxAge) {
        setMaxAge(val);
      }
    };
    model.on("change:selected_file", onFileChange);
    model.on("change:max_age", onMaxAgeChange);
    return () => {
      model.off("change:selected_file", onFileChange);
      model.off("change:max_age", onMaxAgeChange);
    };
  }, [selectedFile, maxAge]);

  // Layout parameters
  const headerHeight = 115;
  const colWidth = 26; // thin column width
  const colGap = 4;
  const canvasRef = React.useRef(null);
  const scrollContainerRef = React.useRef(null);

  // Maximum lines in a single file determines canvas height
  const maxLinesInAnyFile = React.useMemo(() => {
    let m = 0;
    for (const fg of fileGroups) {
      if (fg.lines.length > m) m = fg.lines.length;
    }
    return Math.max(m, 350);
  }, [fileGroups]);

  const canvasHeight = headerHeight + maxLinesInAnyFile + 20;
  const canvasWidth = Math.max(600, fileGroups.length * (colWidth + colGap) + 40);

  // Cache color mapping function
  const colorScale = React.useMemo(() => {
    return createAgeColorScale(stats.minAge, stats.maxAgeVal);
  }, [stats.minAge, stats.maxAgeVal]);

  // Pre-calculate line coordinate layout for fast hit-testing
  const layout = React.useMemo(() => {
    const list = [];
    let startX = 20;
    fileGroups.forEach((fg) => {
      const x = startX;
      list.push({
        file: fg.file,
        x,
        y: headerHeight,
        w: colWidth,
        h: fg.lines.length,
        lines: fg.lines
      });
      startX += colWidth + colGap;
    });
    return list;
  }, [fileGroups, headerHeight, colWidth, colGap]);

  // Canvas drawing effect
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Retina support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#fdfbf7";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw columns
    layout.forEach((col) => {
      const isSelected = selectedFile === col.file;

      // File label at the top (vertical rotated)
      ctx.save();
      ctx.translate(col.x + colWidth / 2 + 1, headerHeight - 10);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = isSelected ? "bold 10px 'Fira Code', monospace" : "9.5px 'Fira Code', monospace";
      ctx.fillStyle = isSelected ? "#1a2456" : "#4a5568";
      // Truncate if too long
      const displayName = col.file.length > 20 ? "..." + col.file.slice(-17) : col.file;
      ctx.fillText(displayName, 0, 0);
      ctx.restore();

      // Column background placeholder
      ctx.fillStyle = "#f1ece4";
      ctx.fillRect(col.x, col.y, col.w, col.h);

      // Render 1px bars
      const scaleLen = col.w / Math.min(120, stats.maxLen || 80);
      const lines = col.lines;
      for (let i = 0; i < lines.length; i++) {
        const item = lines[i];
        const barLen = Math.max(2, Math.min(col.w, (item.line_len || 1) * scaleLen));
        const isYoung = (item.age_days ?? 0) <= maxAge;

        if (isYoung) {
          ctx.fillStyle = colorScale(item.age_days ?? 0);
        } else {
          // Faded to light grey
          ctx.fillStyle = "#d1d5db";
        }
        ctx.fillRect(col.x, col.y + i, barLen, 1);
      }

      // Column boundary / Selected outline
      if (isSelected) {
        ctx.strokeStyle = "#1a2456";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(col.x - 1.5, col.y - 1.5, col.w + 3, col.h + 3);
      } else {
        ctx.strokeStyle = "rgba(0,0,0,0.06)";
        ctx.lineWidth = 1;
        ctx.strokeRect(col.x, col.y, col.w, col.h);
      }
    });
  }, [layout, selectedFile, maxAge, canvasWidth, canvasHeight, colorScale, stats.maxLen]);

  // Pointer interaction on canvas
  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Check hit test
    for (const col of layout) {
      if (mx >= col.x && mx <= col.x + col.w) {
        if (my >= col.y && my < col.y + col.h) {
          const lineIdx = Math.floor(my - col.y);
          const lineData = col.lines[lineIdx];
          if (lineData) {
            setTooltip({
              x: e.clientX,
              y: e.clientY,
              file: col.file,
              line_no: lineData.line_no,
              author: lineData.author,
              age_days: lineData.age_days,
              churn_90d: lineData.churn_90d,
              line_len: lineData.line_len
            });
            return;
          }
        }
      }
    }
    setTooltip(null);
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (const col of layout) {
      // Allow clicking either the header name or the column body
      if (mx >= col.x - 2 && mx <= col.x + col.w + 2) {
        if (my >= 0 && my <= col.y + col.h + 10) {
          handleSelectFile(col.file);
          return;
        }
      }
    }
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  // Summary counts for badge
  const youngLinesCount = React.useMemo(() => {
    let count = 0;
    for (const r of records) {
      if ((r.age_days ?? 0) <= maxAge) count++;
    }
    return count;
  }, [records, maxAge]);

  return (
    <div
      style={{
        background: "#fdfbf7",
        color: "#1a2456",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        padding: "16px 20px",
        borderRadius: 8,
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxSizing: "border-box",
        width: "100%",
        maxHeight: 640
      }}
    >
      {/* Header bar with typography & metadata */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e2dcd2", paddingBottom: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 700, color: "#111827", letterSpacing: -0.2 }}>
            Codebase Chronicle
          </h2>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
            SeeSoft line-by-line age visualization & churn analysis
          </div>
        </div>

        {/* Badge & Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              background: "#ede7dd",
              border: "1px solid #d8cfc0",
              padding: "4px 10px",
              borderRadius: 14,
              fontSize: 11,
              fontFamily: "'Fira Code', monospace",
              color: "#2d3748"
            }}
          >
            <strong style={{ color: "#000" }}>{youngLinesCount.toLocaleString()}</strong> of {records.length.toLocaleString()} lines younger than{" "}
            <strong>{maxAge}d</strong> · <strong>{fileGroups.length}</strong> files
          </div>

          <ColorLegend minAge={stats.minAge} maxAge={stats.maxAgeVal} />
        </div>
      </div>

      {/* Main View Area: Scrollable Canvas + Vertical Age Slider */}
      <div style={{ display: "flex", flex: 1, position: "relative", minHeight: 0, overflow: "hidden", gap: 12 }}>
        {/* Scrollable Viewport */}
        <div
          ref={scrollContainerRef}
          style={{
            flex: 1,
            overflow: "auto",
            background: "#faf7f2",
            borderRadius: 6,
            border: "1px solid #e7dfd5",
            position: "relative"
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleCanvasClick}
            style={{
              display: "block",
              width: canvasWidth,
              height: canvasHeight,
              cursor: "pointer"
            }}
          />
        </div>

        {/* Vertical Draggable Slider Panel */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "8px 6px",
            background: "#f4efe6",
            borderRadius: 6,
            border: "1px solid #e2dacd"
          }}
        >
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, color: "#718096", marginBottom: 6 }}>
            Threshold
          </span>
          <VerticalAgeSlider
            value={maxAge}
            min={stats.minAge}
            max={stats.maxAgeVal}
            onChange={handleAgeChange}
            height={340}
          />
        </div>
      </div>

      {/* Active File / Status Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#718096", fontFamily: "monospace" }}>
        <span>
          {selectedFile ? (
            <span>
              Selected: <strong style={{ color: "#1a2456" }}>{selectedFile}</strong> (Click again to deselect)
            </span>
          ) : (
            "Click any column to isolate file"
          )}
        </span>
        <span>Drag right slider to filter active freshness</span>
      </div>

      <TooltipOverlay tooltip={tooltip} />
    </div>
  );
}