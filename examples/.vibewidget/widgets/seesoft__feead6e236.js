import * as d3 from "https://esm.sh/d3@7";

export const ColorLegend = ({ React, minDays = 0, maxDays = 304, interpolator }) => {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    for (let x = 0; x < width; x++) {
      const t = x / (width - 1);
      ctx.fillStyle = interpolator(t);
      ctx.fillRect(x, 0, 1, height);
    }
  }, [interpolator]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: "ui-monospace, SF Mono, Menlo, monospace", color: "#777777" }}>
      <span>{minDays}d (fresh)</span>
      <canvas
        ref={canvasRef}
        width={100}
        height={8}
        style={{ border: "1px solid #d9d9d9", display: "block" }}
      />
      <span>{maxDays}d (old)</span>
    </div>
  );
};

export const VerticalSlider = ({ React, min = 0, max = 304, value, onChange }) => {
  const trackRef = React.useRef(null);
  const isDraggingRef = React.useRef(false);

  const height = 320;
  // Slider goes from top (max or min?). "younger than N days": let top = max, bottom = min or vice versa.
  // Standard vertical slider: top is max (304d), bottom is 0d.
  const fraction = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const handleTop = (1 - fraction) * height;

  const updateFromY = (clientY) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const relY = Math.max(0, Math.min(height, clientY - rect.top));
    const newFrac = 1 - (relY / height);
    const newVal = Math.round(min + newFrac * (max - min));
    onChange(newVal);
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    updateFromY(e.clientY);

    const onPointerMove = (ev) => {
      if (!isDraggingRef.current) return;
      updateFromY(ev.clientY);
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 54, userSelect: "none" }}>
      <div style={{ fontSize: 11, fontFamily: "ui-monospace, SF Mono, Menlo, monospace", color: "#111111", marginBottom: 6, fontVariantNumeric: "tabular-nums" }}>
        {value}d
      </div>
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        style={{
          position: "relative",
          width: 24,
          height: height,
          cursor: "ns-resize",
          display: "flex",
          justifyContent: "center"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: "#d9d9d9"
          }}
        />
        <div
          style={{
            position: "absolute",
            top: handleTop,
            bottom: 0,
            width: 2,
            backgroundColor: "#111111"
          }}
        />
        <div
          style={{
            position: "absolute",
            top: handleTop - 5,
            left: "50%",
            transform: "translateX(-50%)",
            width: 10,
            height: 10,
            borderRadius: "50%",
            backgroundColor: "#111111",
            border: "1.5px solid #ffffff",
            boxSizing: "border-box"
          }}
        />
      </div>
      <div style={{ fontSize: 10, color: "#777777", marginTop: 6, textAlign: "center", lineHeight: 1.2 }}>
        age limit
      </div>
    </div>
  );
};

export default function Widget({ model, React }) {
  const [data, setData] = React.useState(() => model.get("data") || []);
  const [maxAge, setMaxAge] = React.useState(30);
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [hoveredLine, setHoveredLine] = React.useState(null);
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 });

  const canvasRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const parsedDataRef = React.useRef({ files: [], fileMap: new Map(), minAge: 0, maxAge: 304, totalLines: 0 });

  // Initialize outputs
  React.useEffect(() => {
    model.set("selected_file", null);
    model.set("max_age", 30);
    model.save_changes();

    const handleDataChange = () => {
      setData(model.get("data") || []);
    };
    model.on("change:data", handleDataChange);
    return () => {
      model.off("change:data", handleDataChange);
    };
  }, [model]);

  // Sync maxAge to output
  React.useEffect(() => {
    model.set("max_age", maxAge);
    model.save_changes();
  }, [maxAge, model]);

  // Sync selectedFile to output
  React.useEffect(() => {
    model.set("selected_file", selectedFile);
    model.save_changes();
  }, [selectedFile, model]);

  // Color interpolator: warm yellow (#fab005) -> deep blue (#183153)
  const colorScale = React.useMemo(() => {
    return d3.interpolateRgb("#fab005", "#183153");
  }, []);

  // Process data
  const processed = React.useMemo(() => {
    let raw = data;
    if (!raw) raw = [];
    if (!Array.isArray(raw)) {
      if (typeof raw === "object") {
        if (raw.columns && raw.data) {
          const cols = raw.columns;
          raw = raw.data.map(row => {
            const obj = {};
            cols.forEach((col, i) => { obj[col] = row[i]; });
            return obj;
          });
        } else {
          const keys = Object.keys(raw);
          const len = raw[keys[0]] ? Object.keys(raw[keys[0]]).length : 0;
          const rows = [];
          for (let i = 0; i < len; i++) {
            const row = {};
            keys.forEach(k => { row[k] = raw[k][i]; });
            rows.push(row);
          }
          raw = rows;
        }
      }
    }

    const groups = new Map();
    let minA = Infinity;
    let maxA = -Infinity;
    let total = 0;

    for (let i = 0; i < raw.length; i++) {
      const d = raw[i];
      const fn = d.file || "";
      let arr = groups.get(fn);
      if (!arr) {
        arr = [];
        groups.set(fn, arr);
      }
      const age = Number(d.age_days ?? 0);
      if (age < minA) minA = age;
      if (age > maxA) maxA = age;
      arr.push({
        file: fn,
        line_no: Number(d.line_no ?? 0),
        line_len: Number(d.line_len ?? 0),
        author: String(d.author ?? ""),
        age_days: age,
        churn_90d: Number(d.churn_90d ?? 0)
      });
      total++;
    }

    if (minA === Infinity) minA = 0;
    if (maxA === -Infinity) maxA = 304;

    const sortedFileNames = Array.from(groups.keys()).sort();
    const files = sortedFileNames.map(name => {
      const lines = groups.get(name);
      lines.sort((a, b) => a.line_no - b.line_no);
      return {
        name,
        lines,
        maxLines: lines.length
      };
    });

    const res = { files, minAge: minA, maxAge: maxA, totalLines: total };
    parsedDataRef.current = res;
    return res;
  }, [data]);

  // Layout geometry calculations
  const layout = React.useMemo(() => {
    const fileCount = processed.files.length || 1;
    const colWidth = 22; // width of each file column
    const colGap = 6;
    const headerHeight = 110; // vertical text at top
    const canvasPaddingLeft = 10;
    const canvasPaddingBottom = 16;
    const maxLinesCount = processed.files.reduce((m, f) => Math.max(m, f.lines.length), 0);
    const contentHeight = Math.max(300, maxLinesCount); // 1px tall per line
    const totalCanvasWidth = canvasPaddingLeft + fileCount * (colWidth + colGap);
    const totalCanvasHeight = headerHeight + contentHeight + canvasPaddingBottom;

    return {
      colWidth,
      colGap,
      headerHeight,
      canvasPaddingLeft,
      canvasPaddingBottom,
      contentHeight,
      totalCanvasWidth,
      totalCanvasHeight
    };
  }, [processed]);

  // Recompute k (lines younger than maxAge) and m (files containing at least one line younger)
  const stats = React.useMemo(() => {
    let k = 0;
    let m = 0;
    processed.files.forEach(f => {
      let fileHasYoung = false;
      for (let i = 0; i < f.lines.length; i++) {
        if (f.lines[i].age_days <= maxAge) {
          k++;
          fileHasYoung = true;
        }
      }
      if (fileHasYoung) m++;
    });
    return { k, m, totalLines: processed.totalLines, totalFiles: processed.files.length };
  }, [processed, maxAge]);

  // Redraw canvas whenever layout, maxAge, or selectedFile changes
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    canvas.width = layout.totalCanvasWidth * dpr;
    canvas.height = layout.totalCanvasHeight * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, layout.totalCanvasWidth, layout.totalCanvasHeight);

    const { colWidth, colGap, headerHeight, canvasPaddingLeft } = layout;
    const ageSpan = (processed.maxAge - processed.minAge) || 1;

    processed.files.forEach((fileObj, idx) => {
      const colX = canvasPaddingLeft + idx * (colWidth + colGap);
      const isSelected = fileObj.name === selectedFile;

      // Draw vertical file name
      ctx.save();
      ctx.translate(colX + colWidth / 2, headerHeight - 8);
      ctx.rotate(-Math.PI / 2);
      ctx.font = isSelected ? "600 11px system-ui, -apple-system, sans-serif" : "400 11px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = isSelected ? "#d9480f" : "#111111";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      // Truncate file name if very long
      let displayName = fileObj.name;
      if (displayName.length > 18) {
        displayName = displayName.slice(0, 16) + "…";
      }
      ctx.fillText(displayName, 0, 0);
      ctx.restore();

      // Column background placeholder hairline
      const colHeight = fileObj.lines.length;
      ctx.fillStyle = "#f8f8f8";
      ctx.fillRect(colX, headerHeight, colWidth, colHeight);

      // Draw line bars
      const lines = fileObj.lines;
      for (let l = 0; l < lines.length; l++) {
        const line = lines[l];
        const y = headerHeight + l;
        // bar length: line_len capped at colWidth. Assuming 80 char width maps to colWidth
        const barWidth = Math.max(1, Math.min(colWidth, Math.round((line.line_len / 80) * colWidth)));

        if (line.age_days <= maxAge) {
          const t = Math.max(0, Math.min(1, (line.age_days - processed.minAge) / ageSpan));
          ctx.fillStyle = colorScale(t);
        } else {
          ctx.fillStyle = "#e5e5e5";
        }
        ctx.fillRect(colX, y, barWidth, 1);
      }

      // Column outline if selected
      if (isSelected) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#d9480f";
        ctx.strokeRect(colX - 1.5, headerHeight - 1.5, colWidth + 3, colHeight + 3);
      } else {
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#ebebeb";
        ctx.strokeRect(colX - 0.5, headerHeight - 0.5, colWidth + 1, colHeight + 1);
      }
    });
  }, [layout, processed, maxAge, selectedFile, colorScale]);

  // Pointer event handlers on canvas
  const handlePointerMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { colWidth, colGap, headerHeight, canvasPaddingLeft } = layout;

    // Check which column
    const relativeX = mouseX - canvasPaddingLeft;
    if (relativeX < 0) {
      setHoveredLine(null);
      return;
    }

    const colIndex = Math.floor(relativeX / (colWidth + colGap));
    const offsetInCol = relativeX % (colWidth + colGap);

    if (colIndex >= 0 && colIndex < processed.files.length && offsetInCol <= colWidth) {
      const fileObj = processed.files[colIndex];
      const lineIndex = Math.floor(mouseY - headerHeight);

      if (lineIndex >= 0 && lineIndex < fileObj.lines.length) {
        setHoveredLine(fileObj.lines[lineIndex]);
        setTooltipPos({ x: e.clientX, y: e.clientY });
        return;
      }
    }
    setHoveredLine(null);
  };

  const handlePointerLeave = () => {
    setHoveredLine(null);
  };

  const handleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const { colWidth, colGap, canvasPaddingLeft } = layout;

    const relativeX = mouseX - canvasPaddingLeft;
    if (relativeX < 0) return;

    const colIndex = Math.floor(relativeX / (colWidth + colGap));
    const offsetInCol = relativeX % (colWidth + colGap);

    if (colIndex >= 0 && colIndex < processed.files.length && offsetInCol <= colWidth) {
      const clickedFile = processed.files[colIndex].name;
      setSelectedFile(prev => (prev === clickedFile ? null : clickedFile));
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: 520,
        backgroundColor: "#ffffff",
        color: "#111111",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        boxSizing: "border-box",
        overflow: "hidden"
      }}
    >
      {/* Top status bar: Terse badge + Legend */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 14px",
          borderBottom: "1px solid #d9d9d9",
          backgroundColor: "#ffffff",
          zIndex: 10,
          flexShrink: 0
        }}
      >
        <div style={{ fontSize: 12, fontFamily: "ui-monospace, SF Mono, Menlo, monospace", color: "#111111", fontVariantNumeric: "tabular-nums" }}>
          <span>{stats.k.toLocaleString()} of {stats.totalLines.toLocaleString()} lines younger than {maxAge} days · {stats.m} files</span>
          {selectedFile && (
            <span style={{ marginLeft: 12, color: "#d9480f" }}>
              [{selectedFile}]
            </span>
          )}
        </div>
        <ColorLegend React={React} minDays={processed.minAge} maxDays={processed.maxAge} interpolator={colorScale} />
      </div>

      {/* Main visualization area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {/* Scrollable canvas container */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            backgroundColor: "#ffffff",
            padding: 10
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: layout.totalCanvasWidth,
              height: layout.totalCanvasHeight,
              cursor: "pointer",
              display: "block"
            }}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onClick={handleClick}
          />
        </div>

        {/* Vertical slider on the right */}
        <div
          style={{
            width: 72,
            borderLeft: "1px solid #d9d9d9",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 24,
            paddingBottom: 16,
            backgroundColor: "#ffffff",
            flexShrink: 0
          }}
        >
          <VerticalSlider
            React={React}
            min={processed.minAge}
            max={processed.maxAge}
            value={maxAge}
            onChange={setMaxAge}
          />
        </div>
      </div>

      {/* Tooltip */}
      {hoveredLine && (
        <div
          style={{
            position: "fixed",
            left: Math.min(window.innerWidth - 240, tooltipPos.x + 14),
            top: Math.max(10, tooltipPos.y - 28),
            backgroundColor: "#111111",
            color: "#ffffff",
            padding: "4px 8px",
            fontSize: 11,
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            pointerEvents: "none",
            zIndex: 1000,
            whiteSpace: "nowrap",
            boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {hoveredLine.file}:{hoveredLine.line_no} · {hoveredLine.author} · {hoveredLine.age_days}d · {hoveredLine.churn_90d} commits
        </div>
      )}
    </div>
  );
}