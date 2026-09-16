import * as d3 from "https://esm.sh/d3@7";

// Helper: parse or normalize data from model
function parseData(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    // Pandas split/records/columns format
    if (Array.isArray(raw.data) && Array.isArray(raw.columns)) {
      return raw.data.map((row) => {
        const obj = {};
        raw.columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj;
      });
    }
    // Record-like key-value { col: [vals...] }
    const keys = Object.keys(raw);
    if (keys.length > 0 && Array.isArray(raw[keys[0]])) {
      const len = raw[keys[0]].length;
      const list = [];
      for (let i = 0; i < len; i++) {
        const item = {};
        keys.forEach((k) => {
          item[k] = raw[k][i];
        });
        list.push(item);
      }
      return list;
    }
  }
  return [];
}

// Standalone Color Legend Component
export const ColorLegend = ({ React, minDays = 0, maxDays = 300, interpolator }) => {
  const gradientRef = React.useRef(null);
  const colorScale = interpolator || d3.interpolateRgbBasis(["#e8a838", "#d96b43", "#7a4b8c", "#243b6b"]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, fontFamily: "monospace", color: "#3a342d" }}>
      <span style={{ fontWeight: 600 }}>0d (fresh)</span>
      <div
        style={{
          width: 140,
          height: 10,
          borderRadius: 3,
          background: `linear-gradient(to right, ${colorScale(0)}, ${colorScale(0.33)}, ${colorScale(0.66)}, ${colorScale(1.0)})`,
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)"
        }}
      />
      <span style={{ fontWeight: 600 }}>{maxDays}d (legacy)</span>
    </div>
  );
};

// Standalone Vertical Slider Component
export const VerticalAgeSlider = ({ React, value, min = 0, max = 300, onChange }) => {
  const trackHeight = 320;
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const handleTop = trackHeight - pct * trackHeight;

  const handlePointerDown = (e) => {
    e.preventDefault();
    const track = e.currentTarget.parentElement;
    const rect = track.getBoundingClientRect();

    const update = (clientY) => {
      const clampedY = Math.max(rect.top, Math.min(rect.bottom, clientY));
      const newPct = (rect.bottom - clampedY) / rect.height;
      const newVal = Math.round(min + newPct * (max - min));
      onChange(Math.max(min, Math.min(max, newVal)));
    };

    update(e.clientY);

    const onMove = (moveEvent) => update(moveEvent.clientY);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 64, userSelect: "none" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#7a6e60", marginBottom: 6, textAlign: "center" }}>
        Threshold
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "#221c17", marginBottom: 8 }}>
        &le; {value}d
      </div>

      <div
        style={{
          position: "relative",
          width: 24,
          height: trackHeight,
          cursor: "pointer",
          display: "flex",
          justifyContent: "center"
        }}
        onPointerDown={handlePointerDown}
      >
        {/* Track groove */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 6,
            borderRadius: 3,
            backgroundColor: "#e8e1d5",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.15)"
          }}
        />
        {/* Active fill */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            top: handleTop,
            width: 6,
            borderRadius: "0 0 3px 3px",
            backgroundColor: "#d96b43"
          }}
        />
        {/* Draggable thumb */}
        <div
          style={{
            position: "absolute",
            top: handleTop - 11,
            left: 1,
            width: 22,
            height: 22,
            borderRadius: "50%",
            backgroundColor: "#fdfbf7",
            border: "2.5px solid #d96b43",
            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
            cursor: "grab"
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: 9, fontFamily: "monospace", color: "#8a7e70", marginTop: 6, padding: "0 4px" }}>
        <span>0d</span>
        <span>{max}d</span>
      </div>
    </div>
  );
};

export default function Widget({ model, React }) {
  const [data, setData] = React.useState(() => parseData(model.get("data")));
  const [maxAge, setMaxAge] = React.useState(30);
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [hoverInfo, setHoverInfo] = React.useState(null);

  const containerRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const overlayCanvasRef = React.useRef(null);

  // Sync initial outputs
  React.useEffect(() => {
    model.set("selected_file", null);
    model.set("max_age", 30);
    model.save_changes();

    const handleDataChange = () => {
      setData(parseData(model.get("data")));
    };

    model.on("change:data", handleDataChange);
    return () => {
      model.off("change:data", handleDataChange);
    };
  }, []);

  // Update output on maxAge change
  React.useEffect(() => {
    model.set("max_age", maxAge);
    model.save_changes();
  }, [maxAge]);

  // Update output on selectedFile change
  React.useEffect(() => {
    model.set("selected_file", selectedFile);
    model.save_changes();
  }, [selectedFile]);

  // Process data into grouped files
  const { files, globalMaxLen, globalMaxAge, totalLines, filesList } = React.useMemo(() => {
    if (!data || data.length === 0) {
      return { files: new Map(), globalMaxLen: 100, globalMaxAge: 300, totalLines: 0, filesList: [] };
    }

    let mLen = 1;
    let mAge = 1;
    const grouped = new Map();

    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      if (!grouped.has(d.file)) {
        grouped.set(d.file, []);
      }
      grouped.get(d.file).push(d);
      if (d.line_len > mLen) mLen = d.line_len;
      if (d.age_days > mAge) mAge = d.age_days;
    }

    // Sort files alphabetically by path
    const sortedFileNames = Array.from(grouped.keys()).sort();

    // Sort lines inside each file by line_no
    sortedFileNames.forEach((f) => {
      grouped.get(f).sort((a, b) => a.line_no - b.line_no);
    });

    return {
      files: grouped,
      globalMaxLen: Math.max(mLen, 80),
      globalMaxAge: Math.max(mAge, 300),
      totalLines: data.length,
      filesList: sortedFileNames
    };
  }, [data]);

  // Derived metrics for current threshold
  const { youngerLinesCount, youngerFilesCount } = React.useMemo(() => {
    let k = 0;
    const activeFiles = new Set();
    if (!data) return { youngerLinesCount: 0, youngerFilesCount: 0 };
    for (let i = 0; i < data.length; i++) {
      if (data[i].age_days <= maxAge) {
        k++;
        activeFiles.add(data[i].file);
      }
    }
    return { youngerLinesCount: k, youngerFilesCount: activeFiles.size };
  }, [data, maxAge]);

  // Continuous color interpolator: warm yellow -> orange -> magenta/purple -> deep indigo blue
  const colorScale = React.useMemo(() => {
    const basis = d3.interpolateRgbBasis(["#f4c343", "#e07038", "#8b3d88", "#1d2b56"]);
    return (age) => {
      const t = Math.max(0, Math.min(1, age / (globalMaxAge || 300)));
      return basis(t);
    };
  }, [globalMaxAge]);

  // Layout parameters
  const headerHeight = 130;
  const colWidth = 24;
  const colGap = 5;
  const paddingX = 16;
  const maxLinesInAnyFile = React.useMemo(() => {
    let maxL = 0;
    files.forEach((lines) => {
      if (lines.length > maxL) maxL = lines.length;
    });
    return Math.max(maxL, 400);
  }, [files]);

  const chartHeight = maxLinesInAnyFile + 40;
  const totalChartWidth = Math.max(600, paddingX * 2 + filesList.length * (colWidth + colGap));

  // Store layout geometry for hit testing
  const layoutRef = React.useRef([]);
  React.useEffect(() => {
    const layout = [];
    filesList.forEach((filename, idx) => {
      const x = paddingX + idx * (colWidth + colGap);
      const lines = files.get(filename) || [];
      layout.push({
        file: filename,
        x,
        y: headerHeight,
        width: colWidth,
        height: lines.length,
        lines
      });
    });
    layoutRef.current = layout;
  }, [filesList, files]);

  // Canvas drawing effect: depends on maxAge, files, selectedFile
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = totalChartWidth * dpr;
    canvas.height = (headerHeight + chartHeight) * dpr;
    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = "#fdfbf7";
    ctx.fillRect(0, 0, totalChartWidth, headerHeight + chartHeight);

    // Draw each column
    layoutRef.current.forEach((col) => {
      const isSelected = selectedFile === col.file;

      // Draw column background track
      ctx.fillStyle = isSelected ? "rgba(224, 112, 56, 0.08)" : "#f3eee5";
      ctx.fillRect(col.x, col.y, col.width, col.height);

      // Render line bars
      for (let i = 0; i < col.lines.length; i++) {
        const item = col.lines[i];
        const barWidth = Math.max(2, Math.min(col.width, Math.round((item.line_len / 120) * col.width)));
        const y = col.y + i;

        if (item.age_days <= maxAge) {
          ctx.fillStyle = colorScale(item.age_days);
        } else {
          // Faded older code
          ctx.fillStyle = "#ded8ce";
        }
        ctx.fillRect(col.x, y, barWidth, 1);
      }

      // Column outline
      if (isSelected) {
        ctx.strokeStyle = "#d96b43";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(col.x - 1, col.y - 1, col.width + 2, col.height + 2);
      } else {
        ctx.strokeStyle = "rgba(0,0,0,0.06)";
        ctx.lineWidth = 1;
        ctx.strokeRect(col.x, col.y, col.width, col.height);
      }

      // Vertical text for file name
      ctx.save();
      ctx.translate(col.x + col.width / 2, headerHeight - 10);
      ctx.rotate(-Math.PI / 2);
      ctx.font = isSelected ? "bold 11px monospace" : "10px monospace";
      ctx.fillStyle = isSelected ? "#a33e14" : "#4a4237";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      // Truncate name if long
      let displayName = col.file;
      if (displayName.length > 20) {
        displayName = "…" + displayName.slice(-18);
      }
      ctx.fillText(displayName, 0, 0);
      ctx.restore();
    });
  }, [filesList, files, maxAge, selectedFile, totalChartWidth, chartHeight]);

  // Pointer interactions on canvas
  const handlePointerMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current ? containerRef.current.scrollLeft : 0;
    const scrollTop = containerRef.current ? containerRef.current.scrollTop : 0;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check hit test
    for (const col of layoutRef.current) {
      if (mouseX >= col.x && mouseX <= col.x + col.width) {
        if (mouseY >= col.y && mouseY < col.y + col.height) {
          const lineIdx = Math.floor(mouseY - col.y);
          if (lineIdx >= 0 && lineIdx < col.lines.length) {
            const line = col.lines[lineIdx];
            setHoverInfo({
              file: col.file,
              line_no: line.line_no,
              author: line.author,
              age_days: line.age_days,
              churn_90d: line.churn_90d,
              line_len: line.line_len,
              clientX: e.clientX,
              clientY: e.clientY
            });
            return;
          }
        }
      }
    }
    setHoverInfo(null);
  };

  const handlePointerLeave = () => {
    setHoverInfo(null);
  };

  const handleClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check hit test for column
    for (const col of layoutRef.current) {
      if (mouseX >= col.x - 2 && mouseX <= col.x + col.width + 2) {
        if (mouseY >= col.y - 30 && mouseY <= col.y + col.height + 10) {
          if (selectedFile === col.file) {
            setSelectedFile(null);
          } else {
            setSelectedFile(col.file);
          }
          return;
        }
      }
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#fdfbf7",
        fontFamily: "'Playfair Display', Georgia, serif",
        color: "#241f1a",
        padding: "20px 24px",
        borderRadius: 8,
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        maxWidth: "100%",
        boxSizing: "border-box",
        position: "relative"
      }}
    >
      {/* Editorial Header */}
      <div style={{ borderBottom: "2px solid #241f1a", paddingBottom: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "#1a1612" }}>
              Codebase Stratigraphy
            </h1>
            <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#6e6457", fontStyle: "italic", fontFamily: "Georgia, serif" }}>
              SeeSoft code age distribution across files · Every line encoded as a 1px strand
            </p>
          </div>

          <ColorLegend React={React} maxDays={globalMaxAge} interpolator={d3.interpolateRgbBasis(["#f4c343", "#e07038", "#8b3d88", "#1d2b56"])} />
        </div>

        {/* Narrative Badge and Filter Stats */}
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 12px",
              borderRadius: 20,
              backgroundColor: "#ece6da",
              fontSize: 12,
              fontFamily: "monospace",
              color: "#332c24",
              fontWeight: 600
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#d96b43"
              }}
            />
            {youngerLinesCount.toLocaleString()} of {totalLines.toLocaleString()} lines younger than {maxAge} days &middot; {youngerFilesCount} files
          </div>

          {selectedFile && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "3px 10px",
                borderRadius: 4,
                backgroundColor: "#fae7de",
                border: "1px solid #d96b43",
                fontSize: 12,
                fontFamily: "monospace",
                color: "#993b16"
              }}
            >
              <span>Selected: <strong>{selectedFile}</strong></span>
              <button
                onClick={() => setSelectedFile(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#993b16",
                  padding: 0
                }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main interactive area: Chart Viewport + Right Slider */}
      <div style={{ display: "flex", gap: 16, position: "relative" }}>
        {/* Scrollable SeeSoft Column View */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflowX: "auto",
            overflowY: "auto",
            maxHeight: 520,
            border: "1px solid #e5dfd3",
            backgroundColor: "#fdfbf7",
            borderRadius: 4,
            cursor: "crosshair"
          }}
        >
          <canvas
            ref={canvasRef}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onClick={handleClick}
            style={{
              display: "block",
              width: totalChartWidth,
              height: headerHeight + chartHeight
            }}
          />
        </div>

        {/* Vertical Threshold Slider Container */}
        <div
          style={{
            padding: "16px 12px",
            backgroundColor: "#f7f2e9",
            borderRadius: 6,
            border: "1px solid #e5ded2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <VerticalAgeSlider
            React={React}
            value={maxAge}
            min={0}
            max={globalMaxAge || 300}
            onChange={(val) => setMaxAge(val)}
          />
        </div>
      </div>

      {/* Hover Floating Tooltip */}
      {hoverInfo && (
        <div
          style={{
            position: "fixed",
            left: Math.min(window.innerWidth - 240, hoverInfo.clientX + 14),
            top: hoverInfo.clientY + 14,
            backgroundColor: "rgba(24, 21, 18, 0.94)",
            color: "#fdfbf7",
            padding: "8px 12px",
            borderRadius: 4,
            fontSize: 11,
            fontFamily: "monospace",
            lineHeight: 1.5,
            pointerEvents: "none",
            zIndex: 9999,
            boxShadow: "0 4px 14px rgba(0,0,0,0.3)"
          }}
        >
          <div style={{ fontWeight: 700, color: "#f4c343", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 3, marginBottom: 4 }}>
            {hoverInfo.file}:{hoverInfo.line_no}
          </div>
          <div>Author: <span style={{ color: "#fff" }}>{hoverInfo.author}</span></div>
          <div>Age: <span style={{ color: "#fff" }}>{hoverInfo.age_days}d</span> {hoverInfo.age_days <= maxAge ? "✨ Active" : "💤 Legacy"}</div>
          <div>Churn (90d): <span style={{ color: "#fff" }}>{hoverInfo.churn_90d} commits</span></div>
          <div>Length: <span style={{ color: "#bbb" }}>{hoverInfo.line_len} chars</span></div>
        </div>
      )}

      {/* Footer Notes */}
      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8a7e70", fontFamily: "Georgia, serif" }}>
        <span>Click any column to lock file focus &middot; Drag vertical bar to filter code by age</span>
        <span>{filesList.length} files total</span>
      </div>
    </div>
  );
}