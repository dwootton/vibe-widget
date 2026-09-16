import * as d3 from "https://esm.sh/d3@7";

const NUMERIC_COLS = [
  { key: "enrolled", label: "Enrolled", unit: "", color: "#2B5C8F" },
  { key: "screen_fail_pct", label: "Screen Fail %", unit: "%", color: "#C05621" },
  { key: "deviations", label: "Deviations", unit: "", color: "#9B2C2C" },
  { key: "open_queries", label: "Open Queries", unit: "", color: "#D69E2E" },
  { key: "query_age_days", label: "Query Age", unit: "d", color: "#805AD5" },
  { key: "dropout_pct", label: "Dropout %", unit: "%", color: "#319795" },
  { key: "days_since_visit", label: "Days Since Visit", unit: "d", color: "#4A5568" },
];

const COUNTRY_COLORS = {
  US: "#2B6CB0",
  PL: "#E53E3E",
  DE: "#D69E2E",
  FR: "#319795",
  ES: "#DD6B20",
  IT: "#805AD5",
  GB: "#38A169",
  JP: "#D53F8C",
};

export const CountryLegend = ({ React }) => {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", fontSize: "11px", fontFamily: "ui-monospace, 'Fira Code', monospace" }}>
      <span style={{ fontWeight: 600, color: "#4a453e", marginRight: "4px" }}>Countries:</span>
      {Object.entries(COUNTRY_COLORS).map(([code, color]) => (
        <span key={code} style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#f3ede3", padding: "2px 6px", borderRadius: "3px", border: "1px solid #e2d9cd" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "1px", backgroundColor: color, display: "inline-block" }} />
          <strong style={{ color: "#2d2925" }}>{code}</strong>
        </span>
      ))}
    </div>
  );
};

export const TooltipOverlay = ({ tooltip }) => {
  if (!tooltip || !tooltip.visible || !tooltip.record) return null;
  const { x, y, record, rowIndex } = tooltip;

  return (
    <div
      style={{
        position: "fixed",
        left: Math.min(window.innerWidth - 240, Math.max(12, x + 16)),
        top: Math.max(12, y - 24),
        pointerEvents: "none",
        zIndex: 9999,
        background: "rgba(253, 251, 247, 0.97)",
        backdropFilter: "blur(6px)",
        border: "1px solid #d5cbbe",
        boxShadow: "0 8px 24px rgba(45, 41, 37, 0.18)",
        borderRadius: "6px",
        padding: "10px 12px",
        fontSize: "11px",
        fontFamily: "ui-monospace, 'Fira Code', monospace",
        color: "#22201d",
        minWidth: "210px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e7ded2", paddingBottom: "4px", marginBottom: "6px" }}>
        <span style={{ fontWeight: 700, fontSize: "13px", fontFamily: "Georgia, 'Tiempos Headline', serif", color: "#1a1816" }}>
          Site {record.site}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: COUNTRY_COLORS[record.country] || "#888", color: "#fff", padding: "1px 6px", borderRadius: "3px", fontSize: "10px", fontWeight: 700 }}>
          {record.country}
        </span>
      </div>
      <div style={{ color: "#736b63", fontSize: "10px", marginBottom: "6px" }}>
        Row index: #{rowIndex + 1}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: "3px", columnGap: "8px" }}>
        {NUMERIC_COLS.map((col) => (
          <React.Fragment key={col.key}>
            <span style={{ color: "#544e47" }}>{col.label}:</span>
            <span style={{ fontWeight: 600, textAlign: "right", color: col.color }}>
              {typeof record[col.key] === "number" ? record[col.key].toFixed(col.unit === "%" ? 1 : (col.key === "query_age_days" || col.key === "days_since_visit" ? 0 : 0)) : record[col.key]}
              {col.unit}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default function TableLensWidget({ model, React }) {
  const [rawData, setRawData] = React.useState(() => model.get("data") || []);
  const [sortCol, setSortCol] = React.useState(null);
  const [sortDir, setSortDir] = React.useState("desc");
  const [focusRange, setFocusRange] = React.useState({ start: 0, count: 12 });
  const [tooltip, setTooltip] = React.useState({ visible: false, x: 0, y: 0, record: null, rowIndex: -1 });

  const canvasRef = React.useRef(null);
  const axisCanvasRef = React.useRef(null);
  const tableContainerRef = React.useRef(null);
  const widgetRootRef = React.useRef(null);

  // Sync data updates from Python model
  React.useEffect(() => {
    const handleDataChange = () => {
      setRawData(model.get("data") || []);
    };
    model.on("change:data", handleDataChange);
    return () => {
      model.off("change:data", handleDataChange);
    };
  }, [model]);

  // Max values for numeric column bars
  const maxValues = React.useMemo(() => {
    const maxes = {};
    NUMERIC_COLS.forEach((col) => {
      let max = 0;
      for (let i = 0; i < rawData.length; i++) {
        const val = rawData[i][col.key];
        if (typeof val === "number" && val > max) max = val;
      }
      maxes[col.key] = max || 1;
    });
    return maxes;
  }, [rawData]);

  // Sorted data array
  const sortedData = React.useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    const copy = [...rawData];
    if (!sortCol) return copy;
    copy.sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (sortDir === "asc") {
        return va > vb ? 1 : -1;
      }
      return va < vb ? 1 : -1;
    });
    return copy;
  }, [rawData, sortCol, sortDir]);

  // Sync outputs to Python model
  React.useEffect(() => {
    const focusSites = [];
    const { start, count } = focusRange;
    const end = Math.min(sortedData.length, start + count);
    for (let i = start; i < end; i++) {
      if (sortedData[i]) focusSites.push(sortedData[i].site);
    }
    model.set("focus_rows", focusSites);
    model.set("sort_col", sortCol || "");
    model.save_changes();
  }, [sortedData, focusRange, sortCol, model]);

  // Dimensions layout
  const ROW_COMPRESSED_H = 1;
  const ROW_EXPANDED_H = 20;
  const AXIS_WIDTH = 58;
  const COUNTRY_STRIP_W = 10;
  const SITE_COL_W = 70;
  const NUM_COLS_COUNT = NUMERIC_COLS.length;
  const TOTAL_DATA_WIDTH = 700;
  const NUM_COL_W = Math.floor((TOTAL_DATA_WIDTH - SITE_COL_W - COUNTRY_STRIP_W) / NUM_COLS_COUNT);
  const TOTAL_TABLE_W = AXIS_WIDTH + COUNTRY_STRIP_W + SITE_COL_W + (NUM_COL_W * NUM_COLS_COUNT);

  const totalRowCount = sortedData.length;
  const focusStart = Math.max(0, Math.min(focusRange.start, Math.max(0, totalRowCount - 1)));
  const focusCount = Math.max(1, Math.min(focusRange.count, totalRowCount - focusStart));
  const focusEnd = focusStart + focusCount;

  // Geometry: vertical heights
  const topRowsCount = focusStart;
  const topH = topRowsCount * ROW_COMPRESSED_H;
  const focusH = focusCount * ROW_EXPANDED_H;
  const bottomRowsCount = Math.max(0, totalRowCount - focusEnd);
  const bottomH = bottomRowsCount * ROW_COMPRESSED_H;
  const totalContentHeight = topH + focusH + bottomH;

  // Render canvas layers
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || totalRowCount === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = TOTAL_TABLE_W - AXIS_WIDTH;
    const ch = totalContentHeight;

    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cw, ch);

    // Background
    ctx.fillStyle = "#faf7f2";
    ctx.fillRect(0, 0, cw, ch);

    // Render 1px compressed rows: top region
    const renderCompressedBlock = (startIdx, endIdx, yOffset) => {
      for (let i = startIdx; i < endIdx; i++) {
        const row = sortedData[i];
        if (!row) continue;
        const y = yOffset + (i - startIdx) * ROW_COMPRESSED_H;

        // Country strip
        ctx.fillStyle = COUNTRY_COLORS[row.country] || "#bbb";
        ctx.fillRect(0, y, COUNTRY_STRIP_W, ROW_COMPRESSED_H);

        // Site background
        ctx.fillStyle = i % 2 === 0 ? "#f4ede3" : "#ede5da";
        ctx.fillRect(COUNTRY_STRIP_W, y, SITE_COL_W, ROW_COMPRESSED_H);

        // Numeric bars
        let colX = COUNTRY_STRIP_W + SITE_COL_W;
        for (let c = 0; c < NUM_COLS_COUNT; c++) {
          const col = NUMERIC_COLS[c];
          const val = row[col.key] || 0;
          const max = maxValues[col.key] || 1;
          const barW = Math.max(0, Math.min(NUM_COL_W - 4, (val / max) * (NUM_COL_W - 6)));

          // Track background
          ctx.fillStyle = c % 2 === 0 ? "#faf7f2" : "#f5f0e6";
          ctx.fillRect(colX, y, NUM_COL_W, ROW_COMPRESSED_H);

          // Bar
          ctx.fillStyle = col.color;
          ctx.fillRect(colX + 2, y, barW, ROW_COMPRESSED_H);

          colX += NUM_COL_W;
        }
      }
    };

    if (topRowsCount > 0) {
      renderCompressedBlock(0, topRowsCount, 0);
    }
    if (bottomRowsCount > 0) {
      renderCompressedBlock(focusEnd, totalRowCount, topH + focusH);
    }

    // Grid vertical lines across all tracks
    ctx.strokeStyle = "#e8e0d4";
    ctx.lineWidth = 1;
    let sepX = COUNTRY_STRIP_W;
    ctx.beginPath();
    ctx.moveTo(sepX, 0);
    ctx.lineTo(sepX, ch);
    ctx.stroke();

    sepX += SITE_COL_W;
    for (let c = 0; c <= NUM_COLS_COUNT; c++) {
      ctx.beginPath();
      ctx.moveTo(sepX, 0);
      ctx.lineTo(sepX, ch);
      ctx.stroke();
      sepX += NUM_COL_W;
    }

    ctx.restore();
  }, [sortedData, totalRowCount, topRowsCount, focusEnd, topH, focusH, bottomRowsCount, totalContentHeight, maxValues, TOTAL_TABLE_W, NUM_COL_W]);

  // Render left axis overview canvas
  React.useEffect(() => {
    const axisCanvas = axisCanvasRef.current;
    if (!axisCanvas || totalRowCount === 0) return;
    const ctx = axisCanvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = AXIS_WIDTH;
    const ch = totalContentHeight;

    axisCanvas.width = cw * dpr;
    axisCanvas.height = ch * dpr;
    axisCanvas.style.width = `${cw}px`;
    axisCanvas.style.height = `${ch}px`;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cw, ch);

    ctx.fillStyle = "#f3ede3";
    ctx.fillRect(0, 0, cw, ch);

    // Draw row number markers along the compressed heights
    ctx.font = "9px ui-monospace, 'Fira Code', monospace";
    ctx.fillStyle = "#8a7e70";
    ctx.textAlign = "right";

    // Tick markers every 500 rows
    for (let r = 0; r < totalRowCount; r += 500) {
      let y = 0;
      if (r < focusStart) {
        y = r * ROW_COMPRESSED_H;
      } else if (r < focusEnd) {
        y = topH + (r - focusStart) * ROW_EXPANDED_H;
      } else {
        y = topH + focusH + (r - focusEnd) * ROW_COMPRESSED_H;
      }
      ctx.fillText(`${r + 1}`, cw - 8, y + 8);
      ctx.fillStyle = "#d0c6b7";
      ctx.fillRect(cw - 5, y, 5, 1);
      ctx.fillStyle = "#8a7e70";
    }

    // Active focus region indicator on the axis
    ctx.fillStyle = "rgba(43, 92, 143, 0.15)";
    ctx.fillRect(0, topH, cw, focusH);

    ctx.strokeStyle = "#2B5C8F";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, topH, cw - 2, focusH);

    ctx.restore();
  }, [totalRowCount, focusStart, focusEnd, topH, focusH, totalContentHeight]);

  // Pointer drag interactions on the axis lens handle
  const dragStateRef = React.useRef({
    isDragging: false,
    mode: null, // "move" | "top" | "bottom" | "create"
    startY: 0,
    initialStart: 0,
    initialCount: 0,
  });

  const getRowIndexFromY = React.useCallback((clientRelativeY) => {
    if (clientRelativeY < topH) {
      return Math.floor(clientRelativeY / ROW_COMPRESSED_H);
    }
    if (clientRelativeY < topH + focusH) {
      const offsetInFocus = clientRelativeY - topH;
      return focusStart + Math.floor(offsetInFocus / ROW_EXPANDED_H);
    }
    const offsetInBottom = clientRelativeY - (topH + focusH);
    return focusEnd + Math.floor(offsetInBottom / ROW_COMPRESSED_H);
  }, [topH, focusH, focusStart, focusEnd]);

  const handleAxisPointerDown = (e) => {
    e.preventDefault();
    if (widgetRootRef.current) {
      widgetRootRef.current.focus();
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;

    const topEdgeY = topH;
    const bottomEdgeY = topH + focusH;

    let mode = "create";
    if (Math.abs(y - topEdgeY) <= 8) {
      mode = "top";
    } else if (Math.abs(y - bottomEdgeY) <= 8) {
      mode = "bottom";
    } else if (y > topEdgeY && y < bottomEdgeY) {
      mode = "move";
    }

    if (mode === "create") {
      const clickRow = Math.max(0, Math.min(totalRowCount - 1, getRowIndexFromY(y)));
      setFocusRange({ start: Math.max(0, clickRow - 6), count: 12 });
      dragStateRef.current = {
        isDragging: true,
        mode: "move",
        startY: e.clientY,
        initialStart: Math.max(0, clickRow - 6),
        initialCount: 12,
      };
    } else {
      dragStateRef.current = {
        isDragging: true,
        mode,
        startY: e.clientY,
        initialStart: focusStart,
        initialCount: focusCount,
      };
    }

    const onPointerMove = (moveEvent) => {
      if (!dragStateRef.current.isDragging) return;
      const { mode, startY, initialStart, initialCount } = dragStateRef.current;
      const deltaY = moveEvent.clientY - startY;

      if (mode === "move") {
        // Approximate row shift: 1px per row in compressed regions
        const rowDelta = Math.round(deltaY / 3);
        const newStart = Math.max(0, Math.min(totalRowCount - initialCount, initialStart + rowDelta));
        setFocusRange({ start: newStart, count: initialCount });
      } else if (mode === "top") {
        const rowDelta = Math.round(deltaY / 3);
        const newStart = Math.max(0, Math.min(initialStart + initialCount - 2, initialStart + rowDelta));
        const newCount = initialCount + (initialStart - newStart);
        setFocusRange({ start: newStart, count: Math.max(2, newCount) });
      } else if (mode === "bottom") {
        const rowDelta = Math.round(deltaY / 3);
        const newCount = Math.max(2, Math.min(totalRowCount - initialStart, initialCount + rowDelta));
        setFocusRange({ start: initialStart, count: newCount });
      }
    };

    const onPointerUp = () => {
      dragStateRef.current.isDragging = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Keyboard navigation: up/down arrow keys move focus range
  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusRange((prev) => ({
        ...prev,
        start: Math.min(totalRowCount - prev.count, prev.start + 1),
      }));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusRange((prev) => ({
        ...prev,
        start: Math.max(0, prev.start - 1),
      }));
    } else if (e.key === "PageDown") {
      e.preventDefault();
      setFocusRange((prev) => ({
        ...prev,
        start: Math.min(totalRowCount - prev.count, prev.start + 10),
      }));
    } else if (e.key === "PageUp") {
      e.preventDefault();
      setFocusRange((prev) => ({
        ...prev,
        start: Math.max(0, prev.start - 10),
      }));
    }
  };

  // Hover detection for 1px canvas rows
  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;

    // Check if inside expanded focus (that has DOM elements, canvas is covered)
    if (y >= topH && y < topH + focusH) {
      setTooltip((t) => (t.visible ? { ...t, visible: false } : t));
      return;
    }

    const rowIndex = getRowIndexFromY(y);
    if (rowIndex >= 0 && rowIndex < totalRowCount) {
      const record = sortedData[rowIndex];
      if (record) {
        setTooltip({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          record,
          rowIndex,
        });
      }
    }
  };

  const handleCanvasMouseLeave = () => {
    setTooltip((t) => (t.visible ? { ...t, visible: false } : t));
  };

  // Header column click sorting
  const handleHeaderClick = (colKey) => {
    if (sortCol === colKey) {
      if (sortDir === "desc") {
        setSortDir("asc");
      } else {
        setSortCol(null);
        setSortDir("desc");
      }
    } else {
      setSortCol(colKey);
      setSortDir("desc");
    }
  };

  // Render expanded row items inside focus window
  const expandedRows = [];
  for (let i = focusStart; i < focusEnd; i++) {
    const row = sortedData[i];
    if (!row) continue;
    expandedRows.push(
      <div
        key={`focus-row-${row.site}-${i}`}
        style={{
          display: "flex",
          height: `${ROW_EXPANDED_H}px`,
          alignItems: "center",
          backgroundColor: i % 2 === 0 ? "#ffffff" : "#fbf9f5",
          borderBottom: "1px solid #ebd8c0",
          fontSize: "11px",
          fontFamily: "ui-monospace, 'Fira Code', monospace",
          boxSizing: "border-box",
        }}
      >
        {/* Country color indicator + text */}
        <div
          style={{
            width: `${COUNTRY_STRIP_W}px`,
            height: "100%",
            backgroundColor: COUNTRY_COLORS[row.country] || "#bbb",
            flexShrink: 0,
          }}
          title={row.country}
        />
        {/* Site column */}
        <div
          style={{
            width: `${SITE_COL_W}px`,
            padding: "0 6px",
            fontWeight: 700,
            color: "#1c1917",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{row.site}</span>
          <span style={{ fontSize: "9px", color: "#78716c", fontWeight: 500 }}>{row.country}</span>
        </div>

        {/* 7 numeric columns with track + proportional bar + text value */}
        {NUMERIC_COLS.map((col) => {
          const val = row[col.key] || 0;
          const max = maxValues[col.key] || 1;
          const pct = Math.min(100, Math.max(0, (val / max) * 100));

          return (
            <div
              key={col.key}
              style={{
                width: `${NUM_COL_W}px`,
                height: "100%",
                position: "relative",
                padding: "2px 4px",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                borderLeft: "1px solid #efe6da",
                flexShrink: 0,
              }}
            >
              {/* Horizontal bar track inside cell */}
              <div
                style={{
                  position: "absolute",
                  left: "3px",
                  top: "3px",
                  bottom: "3px",
                  width: `${pct}%`,
                  maxWidth: "calc(100% - 6px)",
                  backgroundColor: `${col.color}25`,
                  borderRight: `2px solid ${col.color}`,
                  borderRadius: "2px",
                  pointerEvents: "none",
                }}
              />
              <span
                style={{
                  position: "relative",
                  zIndex: 2,
                  color: "#292524",
                  fontSize: "11px",
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {typeof val === "number" ? (col.unit === "%" ? val.toFixed(1) : val) : val}
                <span style={{ fontSize: "9px", color: "#8c827a", marginLeft: "1px" }}>{col.unit}</span>
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      ref={widgetRootRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        outline: "none",
        background: "#fdfbf7",
        color: "#262320",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        padding: "16px",
        borderRadius: "12px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Header & Storytelling Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px", marginBottom: "12px", borderBottom: "2px solid #eedecb", paddingBottom: "12px" }}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "22px", fontFamily: "Georgia, 'Tiempos Headline', serif", fontWeight: 700, color: "#1c1917", letterSpacing: "-0.01em" }}>
            Clinical Site Table Lens
          </h2>
          <p style={{ margin: 0, fontSize: "12px", color: "#6e665d" }}>
            Surveying {totalRowCount.toLocaleString()} sites. Drag the axis lens to zoom in and expand rows to readable inspect mode.
          </p>
        </div>
        <CountryLegend React={React} />
      </div>

      {/* Interactive Controls & Status Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", fontSize: "11px", fontFamily: "ui-monospace, 'Fira Code', monospace", color: "#665e55" }}>
        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
          <span>
            Focus: <strong style={{ color: "#2B5C8F" }}>#{focusStart + 1}–#{Math.min(totalRowCount, focusStart + focusCount)}</strong> ({focusCount} rows)
          </span>
          <span style={{ color: "#b3a696" }}>|</span>
          <span>
            Sorted by: <strong style={{ color: "#9B2C2C" }}>{sortCol ? `${sortCol} (${sortDir.toUpperCase()})` : "Natural Order"}</strong>
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={() => setFocusRange({ start: 0, count: 12 })}
            style={{
              background: "#ede5da",
              border: "1px solid #d5cbbe",
              borderRadius: "4px",
              padding: "3px 8px",
              fontSize: "11px",
              cursor: "pointer",
              color: "#38332d",
              fontWeight: 500,
            }}
          >
            Reset Lens (Top 12)
          </button>
          <button
            onClick={() => {
              setSortCol(null);
              setSortDir("desc");
            }}
            style={{
              background: "#ede5da",
              border: "1px solid #d5cbbe",
              borderRadius: "4px",
              padding: "3px 8px",
              fontSize: "11px",
              cursor: "pointer",
              color: "#38332d",
              fontWeight: 500,
            }}
          >
            Clear Sort
          </button>
        </div>
      </div>

      {/* Main Table Lens Container */}
      <div
        ref={tableContainerRef}
        style={{
          border: "1px solid #dfd4c4",
          borderRadius: "6px",
          background: "#faf7f2",
          overflow: "hidden",
          width: "100%",
          maxWidth: `${TOTAL_TABLE_W}px`,
        }}
      >
        {/* Table Column Headers */}
        <div
          style={{
            display: "flex",
            background: "#f2ece2",
            borderBottom: "2px solid #dfd4c4",
            height: "36px",
            alignItems: "stretch",
            userSelect: "none",
          }}
        >
          {/* Axis label header */}
          <div
            style={{
              width: `${AXIS_WIDTH}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              fontWeight: 700,
              color: "#7a7065",
              borderRight: "1px solid #dfd4c4",
              flexShrink: 0,
            }}
          >
            LENS
          </div>

          {/* Country column header */}
          <div
            onClick={() => handleHeaderClick("country")}
            style={{
              width: `${COUNTRY_STRIP_W}px`,
              cursor: "pointer",
              backgroundColor: sortCol === "country" ? "#ded4c3" : "transparent",
              borderRight: "1px solid #dfd4c4",
              flexShrink: 0,
            }}
            title="Sort by Country"
          />

          {/* Site column header */}
          <div
            onClick={() => handleHeaderClick("site")}
            style={{
              width: `${SITE_COL_W}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 8px",
              fontSize: "11px",
              fontWeight: 700,
              color: "#332f2a",
              cursor: "pointer",
              backgroundColor: sortCol === "site" ? "#e4dacb" : "transparent",
              borderRight: "1px solid #dfd4c4",
              flexShrink: 0,
            }}
            title="Sort by Site ID"
          >
            <span>SITE</span>
            {sortCol === "site" && <span style={{ fontSize: "10px" }}>{sortDir === "asc" ? "▲" : "▼"}</span>}
          </div>

          {/* Numeric Columns Headers */}
          {NUMERIC_COLS.map((col) => {
            const isSorted = sortCol === col.key;
            return (
              <div
                key={col.key}
                onClick={() => handleHeaderClick(col.key)}
                style={{
                  width: `${NUM_COL_W}px`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 6px",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  color: isSorted ? col.color : "#403a34",
                  cursor: "pointer",
                  backgroundColor: isSorted ? "#e5dbcc" : "transparent",
                  borderRight: "1px solid #dfd4c4",
                  flexShrink: 0,
                  transition: "background 0.15s ease",
                }}
                title={`Sort by ${col.label}`}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {col.label}
                </span>
                {isSorted && (
                  <span style={{ fontSize: "11px", marginLeft: "2px", color: col.color }}>
                    {sortDir === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Scrollable Viewport */}
        <div
          style={{
            position: "relative",
            height: "460px",
            overflowY: "auto",
            overflowX: "hidden",
            display: "flex",
          }}
        >
          {/* Left Axis interactive column */}
          <div
            style={{
              position: "relative",
              width: `${AXIS_WIDTH}px`,
              height: `${totalContentHeight}px`,
              borderRight: "1px solid #dfd4c4",
              flexShrink: 0,
              cursor: "ns-resize",
              userSelect: "none",
            }}
            onPointerDown={handleAxisPointerDown}
          >
            <canvas ref={axisCanvasRef} style={{ display: "block" }} />

            {/* Draggable interactive handle overlay */}
            <div
              style={{
                position: "absolute",
                top: `${topH}px`,
                left: 0,
                width: `${AXIS_WIDTH}px`,
                height: `${focusH}px`,
                border: "2px solid #2B5C8F",
                background: "rgba(43, 92, 143, 0.08)",
                boxSizing: "border-box",
                cursor: "grab",
              }}
            >
              {/* Top resize handle edge */}
              <div
                style={{
                  position: "absolute",
                  top: "-5px",
                  left: 0,
                  right: 0,
                  height: "10px",
                  cursor: "ns-resize",
                }}
              />
              {/* Grip lines visual */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  pointerEvents: "none",
                }}
              >
                <div style={{ width: "16px", height: "2px", background: "#2B5C8F" }} />
                <div style={{ width: "16px", height: "2px", background: "#2B5C8F" }} />
              </div>
              {/* Bottom resize handle edge */}
              <div
                style={{
                  position: "absolute",
                  bottom: "-5px",
                  left: 0,
                  right: 0,
                  height: "10px",
                  cursor: "ns-resize",
                }}
              />
            </div>
          </div>

          {/* Right Data canvas + expanded rows container */}
          <div
            style={{
              position: "relative",
              width: `${TOTAL_TABLE_W - AXIS_WIDTH}px`,
              height: `${totalContentHeight}px`,
              flexShrink: 0,
            }}
          >
            {/* Background 1px rows canvas */}
            <canvas
              ref={canvasRef}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                display: "block",
                cursor: "crosshair",
              }}
            />

            {/* Expanded readable rows inside focus aperture */}
            <div
              style={{
                position: "absolute",
                top: `${topH}px`,
                left: 0,
                width: `${TOTAL_TABLE_W - AXIS_WIDTH}px`,
                height: `${focusH}px`,
                boxShadow: "0 0 12px rgba(43, 92, 143, 0.25)",
                zIndex: 10,
                pointerEvents: "auto",
              }}
            >
              {expandedRows}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Hover Tooltip for 1px Rows */}
      <TooltipOverlay tooltip={tooltip} />
    </div>
  );
}