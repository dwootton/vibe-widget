import * as d3 from "https://esm.sh/d3@7";

export const ColorLegend = ({ React, min = 0, max = 1 }) => {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "11px", fontFamily: "ui-monospace, monospace", color: "#3a3a3a" }}>
      <span>0.0 (open water)</span>
      <div
        style={{
          width: 120,
          height: 12,
          borderRadius: 2,
          border: "1px solid #ccc",
          background: "linear-gradient(to right, #ffffff, #85b8e0, #19528e, #031e40)"
        }}
      />
      <span>1.0 (frozen)</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 12 }}>
        <div
          style={{
            width: 14,
            height: 12,
            border: "1px solid #ccc",
            background: "repeating-linear-gradient(45deg, #eee, #eee 2px, #ccc 2px, #ccc 4px)"
          }}
        />
        <span style={{ color: "#666" }}>missing</span>
      </div>
    </div>
  );
};

export const RegionSelect = ({ regions, selectedRegion, onChange }) => {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <label htmlFor="ice-region-select" style={{ fontSize: "12px", fontFamily: "ui-monospace, monospace", fontWeight: 600, color: "#1c2833", letterSpacing: "0.05em", textTransform: "uppercase" }}>
        Region:
      </label>
      <select
        id="ice-region-select"
        value={selectedRegion}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: "13px",
          fontWeight: 600,
          padding: "4px 10px",
          borderRadius: "4px",
          border: "1px solid #334155",
          background: "#ffffff",
          color: "#0f172a",
          cursor: "pointer"
        }}
      >
        {regions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </div>
  );
};

export default function VisualizationWidget({ model, React }) {
  const [data, setData] = React.useState(() => model.get("data") || []);
  const [selectedRegion, setSelectedRegion] = React.useState("Barents");

  const [brushState, setBrushState] = React.useState({
    year_lo: 2005,
    year_hi: 2015,
    month_lo: 6,
    month_hi: 9
  });

  const [computedAvg, setComputedAvg] = React.useState(null);
  const [computedCount, setComputedCount] = React.useState(0);

  const containerRef = React.useRef(null);
  const chartWrapperRef = React.useRef(null);
  const dataLookupRef = React.useRef(new Map());
  const brushStateRef = React.useRef(brushState);
  brushStateRef.current = brushState;

  const updateBrushOverlayRef = React.useRef(null);

  React.useEffect(() => {
    const handleDataChange = () => {
      setData(model.get("data") || []);
    };
    model.on("change:data", handleDataChange);
    return () => {
      model.off("change:data", handleDataChange);
    };
  }, [model]);

  const regions = React.useMemo(() => {
    const set = new Set();
    for (let i = 0; i < data.length; i++) {
      set.add(data[i].region);
    }
    const arr = Array.from(set).sort();
    return arr.length > 0 ? arr : ["Barents"];
  }, [data]);

  React.useEffect(() => {
    if (regions.length > 0 && !regions.includes(selectedRegion)) {
      if (regions.includes("Barents")) {
        setSelectedRegion("Barents");
      } else {
        setSelectedRegion(regions[0]);
      }
    }
  }, [regions, selectedRegion]);

  const years = React.useMemo(() => {
    const list = [];
    for (let y = 1979; y <= 2026; y++) list.push(y);
    return list;
  }, []);

  const months = React.useMemo(() => {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }, []);

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  React.useEffect(() => {
    const lookup = new Map();
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row.region === selectedRegion) {
        lookup.set(`${row.year}-${row.month}`, row.frac);
      }
    }
    dataLookupRef.current = lookup;

    const b = brushStateRef.current;
    let sum = 0;
    let count = 0;
    let validCount = 0;
    for (let y = b.year_lo; y <= b.year_hi; y++) {
      for (let m = b.month_lo; m <= b.month_hi; m++) {
        count++;
        const val = lookup.get(`${y}-${m}`);
        if (val !== undefined && val !== null && !isNaN(val)) {
          sum += val;
          validCount++;
        }
      }
    }
    const avg = validCount > 0 ? Number((sum / validCount).toFixed(2)) : 0;
    setComputedAvg(avg);
    setComputedCount(count);

    model.set("where", {
      region: selectedRegion,
      month_lo: b.month_lo,
      month_hi: b.month_hi,
      year_lo: b.year_lo,
      year_hi: b.year_hi
    });
    model.set("avg_frac", avg);
    model.save_changes();

    if (updateBrushOverlayRef.current) {
      updateBrushOverlayRef.current();
    }
  }, [data, selectedRegion, model]);

  React.useEffect(() => {
    const initialWhere = {
      region: selectedRegion,
      month_lo: brushState.month_lo,
      month_hi: brushState.month_hi,
      year_lo: brushState.year_lo,
      year_hi: brushState.year_hi
    };
    model.set("where", initialWhere);
    model.set("avg_frac", computedAvg !== null ? computedAvg : 0.42);
    model.save_changes();
  }, []);

  const colorScale = React.useMemo(() => {
    return d3.scaleSequential()
      .domain([0, 1])
      .interpolator(d3.interpolateRgbBasis(["#ffffff", "#b9d6ed", "#488bc2", "#13528f", "#041e3d"]));
  }, []);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const container = d3.select(containerRef.current);
    container.selectAll("*").remove();

    const margin = { top: 32, right: 30, bottom: 30, left: 45 };
    const totalWidth = 740;
    const totalHeight = 310;
    const width = totalWidth - margin.left - margin.right;
    const height = totalHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
      .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`)
      .attr("width", "100%")
      .attr("height", "100%")
      .style("display", "block")
      .style("overflow", "visible")
      .style("user-select", "none");

    const defs = svg.append("defs");
    const pattern = defs.append("pattern")
      .attr("id", "cell-hatch")
      .attr("width", 6)
      .attr("height", 6)
      .attr("patternTransform", "rotate(45 0 0)")
      .attr("patternUnits", "userSpaceOnUse");

    pattern.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", 6)
      .attr("stroke", "#cbd5e1")
      .attr("stroke-width", 1.8);

    const xScale = d3.scaleBand()
      .domain(years)
      .range([0, width])
      .paddingInner(0.08);

    const yScale = d3.scaleBand()
      .domain(months)
      .range([0, height])
      .paddingInner(0.08);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const cellWidth = xScale.bandwidth();
    const cellHeight = yScale.bandwidth();

    const cellsGroup = g.append("g").attr("class", "cells-layer");
    const lookup = dataLookupRef.current;

    for (const year of years) {
      for (const month of months) {
        const val = lookup.get(`${year}-${month}`);
        const x = xScale(year);
        const y = yScale(month);

        if (val === undefined || val === null || isNaN(val)) {
          cellsGroup.append("rect")
            .attr("x", x)
            .attr("y", y)
            .attr("width", cellWidth)
            .attr("height", cellHeight)
            .attr("fill", "url(#cell-hatch)")
            .attr("stroke", "#e2e8f0")
            .attr("stroke-width", 0.5);
        } else {
          cellsGroup.append("rect")
            .attr("x", x)
            .attr("y", y)
            .attr("width", cellWidth)
            .attr("height", cellHeight)
            .attr("fill", colorScale(val))
            .attr("stroke", "rgba(0,0,0,0.04)")
            .attr("stroke-width", 0.5);
        }
      }
    }

    const yAxis = g.append("g").attr("class", "y-axis");
    months.forEach((m) => {
      yAxis.append("text")
        .attr("x", -8)
        .attr("y", yScale(m) + cellHeight / 2)
        .attr("dy", "0.32em")
        .attr("text-anchor", "end")
        .attr("font-family", "ui-monospace, monospace")
        .attr("font-size", "10px")
        .attr("font-weight", "500")
        .attr("fill", "#475569")
        .text(monthNames[m - 1]);
    });

    const xAxis = g.append("g").attr("class", "x-axis");
    years.forEach((yr) => {
      if (yr % 5 === 0 || yr === 1979 || yr === 2026) {
        xAxis.append("text")
          .attr("x", xScale(yr) + cellWidth / 2)
          .attr("y", height + 16)
          .attr("text-anchor", "middle")
          .attr("font-family", "ui-monospace, monospace")
          .attr("font-size", "9px")
          .attr("font-weight", "500")
          .attr("fill", "#475569")
          .text(yr);
      }
    });

    const brushLayer = g.append("g").attr("class", "brush-layer");

    const brushRect = brushLayer.append("rect")
      .attr("fill", "rgba(30, 58, 138, 0.12)")
      .attr("stroke", "#1e3a8a")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "none")
      .attr("cursor", "move");

    const labelGroup = brushLayer.append("g").attr("cursor", "move");
    const labelBg = labelGroup.append("rect")
      .attr("fill", "#0f172a")
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("opacity", 0.95);

    const labelText = labelGroup.append("text")
      .attr("fill", "#ffffff")
      .attr("font-family", "ui-monospace, monospace")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central");

    const handles = {
      n: brushLayer.append("rect").attr("height", 8).attr("cursor", "ns-resize").attr("fill", "transparent"),
      s: brushLayer.append("rect").attr("height", 8).attr("cursor", "ns-resize").attr("fill", "transparent"),
      w: brushLayer.append("rect").attr("width", 8).attr("cursor", "ew-resize").attr("fill", "transparent"),
      e: brushLayer.append("rect").attr("width", 8).attr("cursor", "ew-resize").attr("fill", "transparent")
    };

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    const computeMetrics = (bs) => {
      const curLookup = dataLookupRef.current;
      let sum = 0;
      let count = 0;
      let valid = 0;
      for (let y = bs.year_lo; y <= bs.year_hi; y++) {
        for (let m = bs.month_lo; m <= bs.month_hi; m++) {
          count++;
          const val = curLookup.get(`${y}-${m}`);
          if (val !== undefined && val !== null && !isNaN(val)) {
            sum += val;
            valid++;
          }
        }
      }
      const avg = valid > 0 ? Number((sum / valid).toFixed(2)) : 0;
      return { avg, count };
    };

    const updateBrushVisuals = () => {
      const bs = brushStateRef.current;
      const x1 = xScale(bs.year_lo) || 0;
      const x2 = (xScale(bs.year_hi) || 0) + cellWidth;
      const y1 = yScale(bs.month_lo) || 0;
      const y2 = (yScale(bs.month_hi) || 0) + cellHeight;

      const bw = Math.max(0, x2 - x1);
      const bh = Math.max(0, y2 - y1);

      brushRect
        .attr("x", x1)
        .attr("y", y1)
        .attr("width", bw)
        .attr("height", bh);

      handles.n.attr("x", x1).attr("y", y1 - 4).attr("width", bw);
      handles.s.attr("x", x1).attr("y", y2 - 4).attr("width", bw);
      handles.w.attr("x", x1 - 4).attr("y", y1).attr("height", bh);
      handles.e.attr("x", x2 - 4).attr("y", y1).attr("height", bh);

      const metrics = computeMetrics(bs);
      const labelStr = `avg ${metrics.avg.toFixed(2)} · ${metrics.count} cells`;
      labelText.text(labelStr);

      const textNode = labelText.node();
      const bbox = textNode ? textNode.getBBox() : { width: 100, height: 16 };
      const padX = 8;
      const padY = 3;
      const bgW = bbox.width + padX * 2;
      const bgH = bbox.height + padY * 2;

      let lx = x1 + bw / 2;
      let ly = y1 - 12;
      if (ly < 10) {
        ly = y1 + 12;
      }

      labelGroup.attr("transform", `translate(${lx}, ${ly})`);
      labelBg
        .attr("x", -bgW / 2)
        .attr("y", -bgH / 2)
        .attr("width", bgW)
        .attr("height", bgH);
    };

    updateBrushOverlayRef.current = updateBrushVisuals;
    updateBrushVisuals();

    const commitBrushState = (next) => {
      brushStateRef.current = next;
      setBrushState(next);
      const metrics = computeMetrics(next);
      setComputedAvg(metrics.avg);
      setComputedCount(metrics.count);

      model.set("where", {
        region: selectedRegion,
        month_lo: next.month_lo,
        month_hi: next.month_hi,
        year_lo: next.year_lo,
        year_hi: next.year_hi
      });
      model.set("avg_frac", metrics.avg);
      model.save_changes();
      updateBrushVisuals();
    };

    const getYearFromX = (rawX) => {
      const step = xScale.step();
      const index = Math.floor(rawX / step);
      const clampedIndex = clamp(index, 0, years.length - 1);
      return years[clampedIndex];
    };

    const getMonthFromY = (rawY) => {
      const step = yScale.step();
      const index = Math.floor(rawY / step);
      const clampedIndex = clamp(index, 0, months.length - 1);
      return months[clampedIndex];
    };

    let activeDrag = null;

    const onPointerDown = (event, mode) => {
      event.preventDefault();
      if (chartWrapperRef.current) {
        chartWrapperRef.current.focus();
      }

      const [px, py] = d3.pointer(event, g.node());
      const curYear = getYearFromX(px);
      const curMonth = getMonthFromY(py);

      activeDrag = {
        mode,
        startX: px,
        startY: py,
        initial: { ...brushStateRef.current },
        startYear: curYear,
        startMonth: curMonth
      };

      if (mode === "create") {
        const next = {
          year_lo: curYear,
          year_hi: curYear,
          month_lo: curMonth,
          month_hi: curMonth
        };
        brushStateRef.current = next;
        updateBrushVisuals();
      }

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    };

    const onPointerMove = (event) => {
      if (!activeDrag) return;
      const [px, py] = d3.pointer(event, g.node());
      const curYear = getYearFromX(px);
      const curMonth = getMonthFromY(py);

      const init = activeDrag.initial;
      let next = { ...brushStateRef.current };

      if (activeDrag.mode === "create") {
        next = {
          year_lo: Math.min(activeDrag.startYear, curYear),
          year_hi: Math.max(activeDrag.startYear, curYear),
          month_lo: Math.min(activeDrag.startMonth, curMonth),
          month_hi: Math.max(activeDrag.startMonth, curMonth)
        };
      } else if (activeDrag.mode === "move") {
        const dYear = curYear - activeDrag.startYear;
        const dMonth = curMonth - activeDrag.startMonth;
        const spanY = init.year_hi - init.year_lo;
        const spanM = init.month_hi - init.month_lo;

        let nYLo = init.year_lo + dYear;
        let nYHi = init.year_hi + dYear;
        if (nYLo < 1979) {
          nYLo = 1979;
          nYHi = nYLo + spanY;
        }
        if (nYHi > 2026) {
          nYHi = 2026;
          nYLo = nYHi - spanY;
        }

        let nMLo = init.month_lo + dMonth;
        let nMHi = init.month_hi + dMonth;
        if (nMLo < 1) {
          nMLo = 1;
          nMHi = nMLo + spanM;
        }
        if (nMHi > 12) {
          nMHi = 12;
          nMLo = nMHi - spanM;
        }

        next = { year_lo: nYLo, year_hi: nYHi, month_lo: nMLo, month_hi: nMHi };
      } else if (activeDrag.mode === "w") {
        const boundY = Math.min(curYear, init.year_hi);
        next = { ...init, year_lo: boundY };
      } else if (activeDrag.mode === "e") {
        const boundY = Math.max(curYear, init.year_lo);
        next = { ...init, year_hi: boundY };
      } else if (activeDrag.mode === "n") {
        const boundM = Math.min(curMonth, init.month_hi);
        next = { ...init, month_lo: boundM };
      } else if (activeDrag.mode === "s") {
        const boundM = Math.max(curMonth, init.month_lo);
        next = { ...init, month_hi: boundM };
      }

      brushStateRef.current = next;
      updateBrushVisuals();
    };

    const onPointerUp = () => {
      if (!activeDrag) return;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      activeDrag = null;
      commitBrushState(brushStateRef.current);
    };

    const bgRect = g.insert("rect", ":first-child")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .attr("cursor", "crosshair");

    bgRect.on("pointerdown", (e) => onPointerDown(e, "create"));
    brushRect.on("pointerdown", (e) => onPointerDown(e, "move"));
    labelGroup.on("pointerdown", (e) => onPointerDown(e, "move"));
    handles.n.on("pointerdown", (e) => onPointerDown(e, "n"));
    handles.s.on("pointerdown", (e) => onPointerDown(e, "s"));
    handles.w.on("pointerdown", (e) => onPointerDown(e, "w"));
    handles.e.on("pointerdown", (e) => onPointerDown(e, "e"));

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      svg.remove();
    };
  }, [years, months, colorScale, selectedRegion]);

  const handleKeyDown = (e) => {
    let handled = false;
    const cur = { ...brushStateRef.current };

    if (e.key === "ArrowLeft") {
      if (cur.year_lo > 1979) {
        cur.year_lo -= 1;
        cur.year_hi -= 1;
        handled = true;
      }
    } else if (e.key === "ArrowRight") {
      if (cur.year_hi < 2026) {
        cur.year_lo += 1;
        cur.year_hi += 1;
        handled = true;
      }
    } else if (e.key === "ArrowUp") {
      if (cur.month_lo > 1) {
        cur.month_lo -= 1;
        cur.month_hi -= 1;
        handled = true;
      }
    } else if (e.key === "ArrowDown") {
      if (cur.month_hi < 12) {
        cur.month_lo += 1;
        cur.month_hi += 1;
        handled = true;
      }
    }

    if (handled) {
      e.preventDefault();
      brushStateRef.current = cur;
      setBrushState(cur);

      const curLookup = dataLookupRef.current;
      let sum = 0;
      let count = 0;
      let valid = 0;
      for (let y = cur.year_lo; y <= cur.year_hi; y++) {
        for (let m = cur.month_lo; m <= cur.month_hi; m++) {
          count++;
          const val = curLookup.get(`${y}-${m}`);
          if (val !== undefined && val !== null && !isNaN(val)) {
            sum += val;
            valid++;
          }
        }
      }
      const avg = valid > 0 ? Number((sum / valid).toFixed(2)) : 0;
      setComputedAvg(avg);
      setComputedCount(count);

      model.set("where", {
        region: selectedRegion,
        month_lo: cur.month_lo,
        month_hi: cur.month_hi,
        year_lo: cur.year_lo,
        year_hi: cur.year_hi
      });
      model.set("avg_frac", avg);
      model.save_changes();

      if (updateBrushOverlayRef.current) {
        updateBrushOverlayRef.current();
      }
    }
  };

  const sqlQuery = `SELECT AVG(frac) FROM ice WHERE region = '${selectedRegion}' AND month BETWEEN ${brushState.month_lo} AND ${brushState.month_hi} AND year BETWEEN ${brushState.year_lo} AND ${brushState.year_hi}   -- ${computedAvg !== null ? computedAvg.toFixed(2) : "0.00"}`;

  return (
    <div
      style={{
        background: "#fdfbf7",
        color: "#1c2833",
        padding: "24px 28px",
        fontFamily: "'Playfair Display', Georgia, serif",
        borderRadius: "8px",
        border: "1px solid #e7e2d9",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
        maxWidth: "840px",
        margin: "0 auto"
      }}
    >
      <header style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <span style={{ fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#64748b", fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
              Arctic Sea Ice Concentration
            </span>
            <h1 style={{ margin: "2px 0 0 0", fontSize: "24px", fontWeight: 800, color: "#091e36", letterSpacing: "-0.02em" }}>
              Regional Climatology &amp; Depletion
            </h1>
          </div>
          <RegionSelect regions={regions} selectedRegion={selectedRegion} onChange={setSelectedRegion} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
          <p style={{ margin: 0, fontSize: "12px", fontFamily: "ui-sans-serif, system-ui", color: "#475569", maxWidth: "480px", lineHeight: "1.4" }}>
            Drag to draw a query window. Drag inside to shift time, edges to resize. Arrow keys nudge window by month or year.
          </p>
          <ColorLegend React={React} />
        </div>
      </header>

      <div
        ref={chartWrapperRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{
          outline: "none",
          position: "relative",
          background: "#ffffff",
          padding: "10px 14px",
          borderRadius: "6px",
          border: "1px solid #e2e8f0",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)"
        }}
      >
        <div ref={containerRef} style={{ width: "100%", height: "310px" }} />
      </div>

      <footer style={{ marginTop: 16 }}>
        <div
          style={{
            background: "#0f172a",
            color: "#38bdf8",
            padding: "12px 16px",
            borderRadius: "6px",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "12px",
            lineHeight: 1.5,
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            border: "1px solid #1e293b"
          }}
        >
          <span style={{ color: "#94a3b8", userSelect: "none", marginRight: 8 }}>$</span>
          {sqlQuery}
        </div>
      </footer>
    </div>
  );
}