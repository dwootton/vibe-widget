import * as d3 from "https://esm.sh/d3@7";

const NUMERIC_COLS = [
  { key: "enrolled", label: "enrolled", format: (v) => `${Math.round(v)}` },
  { key: "screen_fail_pct", label: "screen fail %", format: (v) => `${v.toFixed(1)}%` },
  { key: "deviations", label: "deviations", format: (v) => `${Math.round(v)}` },
  { key: "open_queries", label: "open queries", format: (v) => `${Math.round(v)}` },
  { key: "query_age_days", label: "query age d", format: (v) => `${Math.round(v)}d` },
  { key: "dropout_pct", label: "dropout %", format: (v) => `${v.toFixed(1)}%` },
  { key: "days_since_visit", label: "days visit", format: (v) => `${Math.round(v)}d` }
];

const COUNTRY_PALETTE = {
  US: "#1f77b4",
  PL: "#e377c2",
  DE: "#2ca02c",
  FR: "#ff7f0e",
  GB: "#9467bd",
  IT: "#8c564b",
  ES: "#bcbd22",
  JP: "#17becf"
};

const getCountryColor = (c) => COUNTRY_PALETTE[c] || "#777777";

export const TableLensHeader = ({
  columns,
  sortCol,
  sortDir,
  onSort,
  colWidths,
  siteColWidth,
  countryColWidth,
  axisWidth
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        borderBottom: "1px solid #d9d9d9",
        background: "#ffffff",
        height: 28,
        fontSize: 11,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#111111",
        userSelect: "none"
      }}
    >
      <div
        style={{
          width: axisWidth,
          flexShrink: 0,
          borderRight: "1px solid #d9d9d9",
          padding: "0 4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          color: "#777777",
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
          fontSize: 10
        }}
      >
        #
      </div>
      <div
        onClick={() => onSort("site")}
        style={{
          width: siteColWidth,
          flexShrink: 0,
          borderRight: "1px solid #d9d9d9",
          padding: "0 6px",
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          fontWeight: sortCol === "site" ? 600 : 400
        }}
      >
        <span>site</span>
        {sortCol === "site" && (
          <span style={{ marginLeft: 3, fontSize: 9 }}>{sortDir === "asc" ? "▲" : "▼"}</span>
        )}
      </div>
      <div
        onClick={() => onSort("country")}
        style={{
          width: countryColWidth,
          flexShrink: 0,
          borderRight: "1px solid #d9d9d9",
          padding: "0 4px",
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          fontWeight: sortCol === "country" ? 600 : 400
        }}
      >
        <span>cc</span>
        {sortCol === "country" && (
          <span style={{ marginLeft: 2, fontSize: 9 }}>{sortDir === "asc" ? "▲" : "▼"}</span>
        )}
      </div>
      {columns.map((c) => {
        const isSorted = sortCol === c.key;
        return (
          <div
            key={c.key}
            onClick={() => onSort(c.key)}
            style={{
              width: colWidths,
              flexShrink: 0,
              borderRight: "1px solid #d9d9d9",
              padding: "0 6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              fontWeight: isSorted ? 600 : 400
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.label}
            </span>
            {isSorted && (
              <span style={{ marginLeft: 2, fontSize: 9, flexShrink: 0 }}>
                {sortDir === "asc" ? "▲" : "▼"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const TableLensTooltip = ({ visible, x, y, row }) => {
  if (!visible || !row) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x + 12,
        top: Math.max(8, y - 24),
        background: "#ffffff",
        border: "1px solid #111111",
        padding: "6px 8px",
        pointerEvents: "none",
        zIndex: 100,
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 11,
        color: "#111111",
        lineHeight: 1.35,
        boxShadow: "0 2px 6px rgba(0,0,0,0.08)"
      }}
    >
      <div style={{ fontWeight: 600, borderBottom: "1px solid #d9d9d9", paddingBottom: 2, marginBottom: 4 }}>
        {row.site} ({row.country})
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "2px 8px", fontFamily: "ui-monospace, SF Mono, Menlo, monospace" }}>
        <span>enrolled:</span><span style={{ textAlign: "right" }}>{row.enrolled}</span>
        <span>screen fail:</span><span style={{ textAlign: "right" }}>{Number(row.screen_fail_pct).toFixed(1)}%</span>
        <span>deviations:</span><span style={{ textAlign: "right" }}>{row.deviations}</span>
        <span>queries:</span><span style={{ textAlign: "right" }}>{row.open_queries}</span>
        <span>query age:</span><span style={{ textAlign: "right" }}>{Number(row.query_age_days).toFixed(0)}d</span>
        <span>dropout:</span><span style={{ textAlign: "right" }}>{Number(row.dropout_pct).toFixed(1)}%</span>
        <span>days visit:</span><span style={{ textAlign: "right" }}>{Number(row.days_since_visit).toFixed(0)}d</span>
      </div>
    </div>
  );
};

export default function VisualizationWidget({ model, React }) {
  const [data, setData] = React.useState(() => model?.get("data") || []);
  const [sortCol, setSortCol] = React.useState("enrolled");
  const [sortDir, setSortDir] = React.useState("desc");
  const [focusStart, setFocusStart] = React.useState(0);
  const [focusCount, setFocusCount] = React.useState(12);

  const [hoverRow, setHoverRow] = React.useState(null);
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0, visible: false });

  const containerRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const axisSvgRef = React.useRef(null);
  const overlayRef = React.useRef(null);

  const liveStateRef = React.useRef({
    focusStart: 0,
    focusCount: 12,
    totalRows: 4000,
    isInteracting: false
  });

  React.useEffect(() => {
    liveStateRef.current.focusStart = focusStart;
    liveStateRef.current.focusCount = focusCount;
  }, [focusStart, focusCount]);

  React.useEffect(() => {
    const handler = () => {
      setData(model.get("data") || []);
    };
    model?.on("change:data", handler);
    return () => model?.off("change:data", handler);
  }, [model]);

  // Max values for numeric tracks
  const columnMaxes = React.useMemo(() => {
    const maxes = {};
    NUMERIC_COLS.forEach((c) => {
      maxes[c.key] = d3.max(data, (d) => Number(d[c.key]) || 0) || 1;
    });
    return maxes;
  }, [data]);

  // Sorted data array
  const sortedData = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    const arr = [...data];
    arr.sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (typeof va === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va - vb) : (vb - va);
    });
    return arr;
  }, [data, sortCol, sortDir]);

  const totalRows = sortedData.length;
  liveStateRef.current.totalRows = totalRows;

  // Sync outputs
  React.useEffect(() => {
    if (!model) return;
    const clampedStart = Math.max(0, Math.min(focusStart, Math.max(0, totalRows - 1)));
    const clampedEnd = Math.min(totalRows, clampedStart + focusCount);
    const sites = [];
    for (let i = clampedStart; i < clampedEnd; i++) {
      if (sortedData[i]) sites.push(sortedData[i].site);
    }
    model.set("focus_rows", sites);
    model.set("sort_col", sortCol);
    model.save_changes();
  }, [focusStart, focusCount, sortedData, sortCol, model, totalRows]);

  // Dimensions
  const AXIS_WIDTH = 38;
  const SITE_WIDTH = 58;
  const COUNTRY_WIDTH = 28;
  const TRACK_WIDTH = 84;
  const FOCUSED_ROW_H = 18;
  const COMPRESSED_ROW_H = 1;

  const totalContentWidth = AXIS_WIDTH + SITE_WIDTH + COUNTRY_WIDTH + TRACK_WIDTH * NUMERIC_COLS.length;
  const totalContentHeight = totalRows > 0 ? (totalRows - focusCount) * COMPRESSED_ROW_H + focusCount * FOCUSED_ROW_H : 400;

  // Geometry coordinate mapper
  const getRowY = React.useCallback((idx, fStart, fCount) => {
    if (idx < fStart) {
      return idx * COMPRESSED_ROW_H;
    }
    if (idx < fStart + fCount) {
      return fStart * COMPRESSED_ROW_H + (idx - fStart) * FOCUSED_ROW_H;
    }
    return fStart * COMPRESSED_ROW_H + fCount * FOCUSED_ROW_H + (idx - (fStart + fCount)) * COMPRESSED_ROW_H;
  }, []);

  const getIdxFromY = React.useCallback((y, fStart, fCount, total) => {
    const focusTopY = fStart * COMPRESSED_ROW_H;
    const focusBottomY = focusTopY + fCount * FOCUSED_ROW_H;
    if (y < focusTopY) {
      return Math.max(0, Math.min(total - 1, Math.floor(y / COMPRESSED_ROW_H)));
    }
    if (y < focusBottomY) {
      const offset = y - focusTopY;
      return Math.max(0, Math.min(total - 1, fStart + Math.floor(offset / FOCUSED_ROW_H)));
    }
    const offset = y - focusBottomY;
    return Math.max(0, Math.min(total - 1, fStart + fCount + Math.floor(offset / COMPRESSED_ROW_H)));
  }, []);

  // Sorting action
  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "site" || col === "country" ? "asc" : "desc");
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusStart((prev) => Math.max(0, prev - 1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusStart((prev) => Math.min(Math.max(0, totalRows - focusCount), prev + 1));
    }
  };

  // Draw canvas (both compressed and focused row bars/strips)
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || totalRows === 0) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    const dpr = window.devicePixelRatio || 1;

    canvas.width = (totalContentWidth - AXIS_WIDTH) * dpr;
    canvas.height = totalContentHeight * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, totalContentWidth - AXIS_WIDTH, totalContentHeight);

    const fStart = focusStart;
    const fEnd = focusStart + focusCount;
    const xBase = 0;
    const xSite = xBase;
    const xCountry = xSite + SITE_WIDTH;
    const xTracks = xCountry + COUNTRY_WIDTH;

    // Draw grid tracks lines
    ctx.strokeStyle = "#f2f2f2";
    ctx.lineWidth = 1;
    NUMERIC_COLS.forEach((_, i) => {
      const colX = xTracks + i * TRACK_WIDTH;
      ctx.beginPath();
      ctx.moveTo(colX, 0);
      ctx.lineTo(colX, totalContentHeight);
      ctx.stroke();
    });

    // 1. Draw all rows
    for (let i = 0; i < totalRows; i++) {
      const row = sortedData[i];
      const isFocused = i >= fStart && i < fEnd;
      const y = getRowY(i, fStart, fCount);
      const rowH = isFocused ? FOCUSED_ROW_H : COMPRESSED_ROW_H;

      // Country color strip
      ctx.fillStyle = getCountryColor(row.country);
      if (isFocused) {
        ctx.fillRect(xCountry + 2, y + 2, COUNTRY_WIDTH - 4, rowH - 4);
      } else {
        ctx.fillRect(xCountry, y, COUNTRY_WIDTH - 1, COMPRESSED_ROW_H);
      }

      // Numeric tracks
      NUMERIC_COLS.forEach((col, cIdx) => {
        const trackX = xTracks + cIdx * TRACK_WIDTH;
        const val = Number(row[col.key]) || 0;
        const maxVal = columnMaxes[col.key] || 1;
        const ratio = Math.max(0, Math.min(1, val / maxVal));
        const barWidth = Math.max(ratio > 0 ? 1 : 0, ratio * (TRACK_WIDTH - 8));

        if (isFocused) {
          // Draw subtle background track bar
          ctx.fillStyle = "#f2f2f2";
          ctx.fillRect(trackX + 4, y + 3, TRACK_WIDTH - 8, rowH - 6);
          // Value bar
          ctx.fillStyle = "#111111";
          ctx.fillRect(trackX + 4, y + 3, barWidth, rowH - 6);
        } else {
          ctx.fillStyle = "#111111";
          ctx.fillRect(trackX + 4, y, barWidth, COMPRESSED_ROW_H);
        }
      });
    }

    // 2. Focused area borders
    const focusTopY = fStart * COMPRESSED_ROW_H;
    const focusHeight = fCount * FOCUSED_ROW_H;
    ctx.strokeStyle = "#d9480f";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.5, focusTopY + 0.5, totalContentWidth - AXIS_WIDTH - 1, focusHeight - 1);

    // Separators between focused rows
    ctx.strokeStyle = "#e9ecef";
    ctx.lineWidth = 1;
    for (let i = 1; i < fCount; i++) {
      const lineY = focusTopY + i * FOCUSED_ROW_H;
      ctx.beginPath();
      ctx.moveTo(0, lineY + 0.5);
      ctx.lineTo(totalContentWidth - AXIS_WIDTH, lineY + 0.5);
      ctx.stroke();
    }
  }, [sortedData, focusStart, focusCount, columnMaxes, totalRows, totalContentHeight, totalContentWidth, getRowY]);

  // Setup Left Row Axis Drag / Brush / Resize
  React.useEffect(() => {
    const axisSvg = d3.select(axisSvgRef.current);
    if (!axisSvg.node()) return;

    axisSvg.selectAll("*").remove();

    // Background bar
    axisSvg
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", AXIS_WIDTH)
      .attr("height", totalContentHeight)
      .attr("fill", "#fafafa");

    // Right border
    axisSvg
      .append("line")
      .attr("x1", AXIS_WIDTH - 0.5)
      .attr("x2", AXIS_WIDTH - 0.5)
      .attr("y1", 0)
      .attr("y2", totalContentHeight)
      .attr("stroke", "#d9d9d9");

    const fStart = focusStart;
    const fCount = focusCount;
    const focusTopY = fStart * COMPRESSED_ROW_H;
    const focusHeight = fCount * FOCUSED_ROW_H;

    // Focus range background in axis
    axisSvg
      .append("rect")
      .attr("x", 1)
      .attr("y", focusTopY)
      .attr("width", AXIS_WIDTH - 2)
      .attr("height", focusHeight)
      .attr("fill", "#fff3ed")
      .attr("stroke", "#d9480f")
      .attr("stroke-width", 1.5);

    // Row numbers in focused axis
    for (let i = 0; i < fCount; i++) {
      const rowIdx = fStart + i;
      if (rowIdx >= totalRows) break;
      const textY = focusTopY + i * FOCUSED_ROW_H + 13;
      axisSvg
        .append("text")
        .attr("x", AXIS_WIDTH - 6)
        .attr("y", textY)
        .attr("text-anchor", "end")
        .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace")
        .attr("font-size", "10px")
        .attr("fill", "#d9480f")
        .attr("pointer-events", "none")
        .text(rowIdx + 1);
    }

    // Interactive Drag / Resize Handles on Axis
    // Top resize edge handle
    const topHandle = axisSvg
      .append("rect")
      .attr("x", 0)
      .attr("y", Math.max(0, focusTopY - 6))
      .attr("width", AXIS_WIDTH)
      .attr("height", 12)
      .attr("fill", "transparent")
      .attr("cursor", "ns-resize");

    // Bottom resize edge handle
    const bottomHandle = axisSvg
      .append("rect")
      .attr("x", 0)
      .attr("y", focusTopY + focusHeight - 6)
      .attr("width", AXIS_WIDTH)
      .attr("height", 12)
      .attr("fill", "transparent")
      .attr("cursor", "ns-resize");

    // Body drag handle
    const bodyHandle = axisSvg
      .append("rect")
      .attr("x", 0)
      .attr("y", focusTopY + 6)
      .attr("width", AXIS_WIDTH)
      .attr("height", Math.max(0, focusHeight - 12))
      .attr("fill", "transparent")
      .attr("cursor", "grab");

    // Axis background hit area (to drag new focus range)
    const bgArea = axisSvg
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", AXIS_WIDTH)
      .attr("height", totalContentHeight)
      .attr("fill", "transparent")
      .lower(); // under handles

    let dragStartY = 0;
    let initialStart = fStart;
    let initialCount = fCount;

    // Body slide drag
    const bodyDrag = d3.drag()
      .on("start", (event) => {
        containerRef.current?.focus();
        dragStartY = event.y;
        initialStart = liveStateRef.current.focusStart;
      })
      .on("drag", (event) => {
        const dy = event.y - dragStartY;
        // 1 row per 1px (or FOCUSED_ROW_H if dragging inside, but direct row translation is smoothest based on pixel dy)
        const rowDelta = Math.round(dy / COMPRESSED_ROW_H);
        const newStart = Math.max(0, Math.min(totalRows - liveStateRef.current.focusCount, initialStart + rowDelta));
        setFocusStart(newStart);
      });

    bodyHandle.call(bodyDrag);

    // Top edge resize
    const topDrag = d3.drag()
      .on("start", (event) => {
        containerRef.current?.focus();
        dragStartY = event.y;
        initialStart = liveStateRef.current.focusStart;
        initialCount = liveStateRef.current.focusCount;
      })
      .on("drag", (event) => {
        const dy = event.y - dragStartY;
        const rowDelta = Math.round(dy / COMPRESSED_ROW_H);
        let newStart = initialStart + rowDelta;
        let newCount = initialCount - rowDelta;
        if (newCount < 3) {
          newStart = initialStart + initialCount - 3;
          newCount = 3;
        }
        if (newStart < 0) {
          newCount += newStart;
          newStart = 0;
        }
        setFocusStart(Math.max(0, newStart));
        setFocusCount(Math.min(50, Math.max(3, newCount)));
      });

    topHandle.call(topDrag);

    // Bottom edge resize
    const bottomDrag = d3.drag()
      .on("start", (event) => {
        containerRef.current?.focus();
        dragStartY = event.y;
        initialCount = liveStateRef.current.focusCount;
      })
      .on("drag", (event) => {
        const dy = event.y - dragStartY;
        const rowDelta = Math.round(dy / COMPRESSED_ROW_H);
        const newCount = Math.min(50, Math.max(3, initialCount + rowDelta));
        setFocusCount(Math.min(totalRows - liveStateRef.current.focusStart, newCount));
      });

    bottomHandle.call(bottomDrag);

    // Drag outside on background to set a brand new focus range
    const bgDrag = d3.drag()
      .on("start", (event) => {
        containerRef.current?.focus();
        const clickedIdx = getIdxFromY(event.y, liveStateRef.current.focusStart, liveStateRef.current.focusCount, totalRows);
        dragStartY = event.y;
        initialStart = clickedIdx;
        setFocusStart(clickedIdx);
        setFocusCount(1);
      })
      .on("drag", (event) => {
        const currentIdx = getIdxFromY(event.y, liveStateRef.current.focusStart, liveStateRef.current.focusCount, totalRows);
        const minIdx = Math.min(initialStart, currentIdx);
        const maxIdx = Math.max(initialStart, currentIdx);
        const count = Math.max(3, maxIdx - minIdx + 1);
        setFocusStart(Math.max(0, Math.min(totalRows - count, minIdx)));
        setFocusCount(Math.min(50, count));
      });

    bgArea.call(bgDrag);

  }, [focusStart, focusCount, totalRows, totalContentHeight, getIdxFromY]);

  // Hover over canvas for 1px row tooltip
  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || totalRows === 0) return;
    const rect = canvas.getBoundingClientRect();
    const my = e.clientY - rect.top;
    const mx = e.clientX - rect.left;

    const rowIdx = getIdxFromY(my, focusStart, focusCount, totalRows);
    if (rowIdx >= 0 && rowIdx < totalRows) {
      // If inside focus area, no tooltip needed because text values are already readable inline
      if (rowIdx >= focusStart && rowIdx < focusStart + focusCount) {
        setTooltipPos((prev) => ({ ...prev, visible: false }));
        setHoverRow(null);
      } else {
        setHoverRow(sortedData[rowIdx]);
        setTooltipPos({
          x: e.clientX - containerRef.current.getBoundingClientRect().left,
          y: e.clientY - containerRef.current.getBoundingClientRect().top,
          visible: true
        });
      }
    }
  };

  const handleCanvasMouseLeave = () => {
    setTooltipPos((prev) => ({ ...prev, visible: false }));
    setHoverRow(null);
  };

  // Slices for focused rows
  const focusedRows = React.useMemo(() => {
    return sortedData.slice(focusStart, focusStart + focusCount);
  }, [sortedData, focusStart, focusCount]);

  const focusTopOffset = focusStart * COMPRESSED_ROW_H;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        display: "flex",
        flexDirection: "column",
        height: 600,
        outline: "none",
        background: "#ffffff",
        position: "relative",
        boxSizing: "border-box",
        border: "1px solid #d9d9d9",
        overflow: "hidden"
      }}
    >
      {/* Sticky Table Lens Header */}
      <TableLensHeader
        columns={NUMERIC_COLS}
        sortCol={sortCol}
        sortDir={sortDir}
        onSort={handleSort}
        colWidths={TRACK_WIDTH}
        siteColWidth={SITE_WIDTH}
        countryColWidth={COUNTRY_WIDTH}
        axisWidth={AXIS_WIDTH}
      />

      {/* Scrollable lens body */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "auto",
          position: "relative",
          background: "#ffffff"
        }}
      >
        <div
          style={{
            position: "relative",
            width: totalContentWidth,
            height: totalContentHeight
          }}
        >
          {/* Left Axis SVG (handles & labels) */}
          <svg
            ref={axisSvgRef}
            width={AXIS_WIDTH}
            height={totalContentHeight}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              zIndex: 3,
              userSelect: "none"
            }}
          />

          {/* Compressed & overview canvas */}
          <canvas
            ref={canvasRef}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
            style={{
              position: "absolute",
              left: AXIS_WIDTH,
              top: 0,
              width: totalContentWidth - AXIS_WIDTH,
              height: totalContentHeight,
              cursor: "crosshair",
              zIndex: 1
            }}
          />

          {/* Focused Text Overlay (HTML elements for crisp text values) */}
          <div
            ref={overlayRef}
            style={{
              position: "absolute",
              left: AXIS_WIDTH,
              top: focusTopOffset,
              width: totalContentWidth - AXIS_WIDTH,
              height: focusCount * FOCUSED_ROW_H,
              pointerEvents: "none",
              zIndex: 2,
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 11
            }}
          >
            {focusedRows.map((r, i) => (
              <div
                key={r.site}
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: FOCUSED_ROW_H,
                  width: "100%",
                  color: "#111111",
                  boxSizing: "border-box"
                }}
              >
                {/* Site id */}
                <div
                  style={{
                    width: SITE_WIDTH,
                    flexShrink: 0,
                    padding: "0 6px",
                    fontWeight: 600,
                    fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                    whiteSpace: "nowrap",
                    overflow: "hidden"
                  }}
                >
                  {r.site}
                </div>

                {/* Country text badge */}
                <div
                  style={{
                    width: COUNTRY_WIDTH,
                    flexShrink: 0,
                    textAlign: "center",
                    fontSize: 9,
                    color: "#ffffff",
                    fontWeight: 600,
                    userSelect: "none"
                  }}
                >
                  {r.country}
                </div>

                {/* Numeric values superimposed on tracks */}
                {NUMERIC_COLS.map((col) => (
                  <div
                    key={col.key}
                    style={{
                      width: TRACK_WIDTH,
                      flexShrink: 0,
                      padding: "0 6px",
                      textAlign: "right",
                      fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                      fontSize: 10,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textShadow: "0 0 2px #ffffff"
                    }}
                  >
                    {col.format(r[col.key])}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row details Tooltip for 1px hovered rows */}
      <TableLensTooltip
        visible={tooltipPos.visible}
        x={tooltipPos.x}
        y={tooltipPos.y}
        row={hoverRow}
      />
    </div>
  );
}