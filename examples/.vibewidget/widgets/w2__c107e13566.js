import * as d3 from "https://esm.sh/d3@7";

const MONTHS = [
  { val: 1, name: "January" },
  { val: 2, name: "February" },
  { val: 3, name: "March" },
  { val: 4, name: "April" },
  { val: 5, name: "May" },
  { val: 6, name: "June" },
  { val: 7, name: "July" },
  { val: 8, name: "August" },
  { val: 9, name: "September" },
  { val: 10, name: "October" },
  { val: 11, name: "November" },
  { val: 12, name: "December" }
];

export const MonthPicker = ({ selectedMonth, onChange }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: "sans-serif" }}>
    <label htmlFor="month-select" style={{ fontWeight: 600, color: "#332a24", letterSpacing: "0.02em" }}>
      Month:
    </label>
    <select
      id="month-select"
      value={selectedMonth}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        padding: "4px 10px",
        borderRadius: 4,
        border: "1px solid #c8bfb4",
        background: "#ffffff",
        color: "#221d18",
        fontSize: 13,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: "pointer",
        outline: "none"
      }}
    >
      {MONTHS.map((m) => (
        <option key={m.val} value={m.val}>
          {m.name}
        </option>
      ))}
    </select>
  </div>
);

export const ModeToggle = ({ mode, onChange }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      background: "#eae2d5",
      padding: 3,
      borderRadius: 6,
      border: "1px solid #d5cbbe",
      fontFamily: "sans-serif",
      fontSize: 12
    }}
  >
    <button
      type="button"
      onClick={() => onChange("shared")}
      style={{
        border: "none",
        padding: "4px 12px",
        borderRadius: 4,
        background: mode === "shared" ? "#ffffff" : "transparent",
        color: mode === "shared" ? "#1d1916" : "#6e6459",
        fontWeight: mode === "shared" ? 600 : 500,
        boxShadow: mode === "shared" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
        cursor: "pointer",
        transition: "all 0.15s ease"
      }}
    >
      Shared
    </button>
    <button
      type="button"
      onClick={() => onChange("per-panel")}
      style={{
        border: "none",
        padding: "4px 12px",
        borderRadius: 4,
        background: mode === "per-panel" ? "#ffffff" : "transparent",
        color: mode === "per-panel" ? "#1d1916" : "#6e6459",
        fontWeight: mode === "per-panel" ? 600 : 500,
        boxShadow: mode === "per-panel" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
        cursor: "pointer",
        transition: "all 0.15s ease"
      }}
    >
      Per Panel
    </button>
  </div>
);

export const RegionPanel = ({
  region,
  data,
  threshold,
  onThresholdDrag,
  onThresholdDragEnd,
  isShared,
  React
}) => {
  const containerRef = React.useRef(null);
  const elementsRef = React.useRef({});
  const thresholdRef = React.useRef(threshold);
  thresholdRef.current = threshold;

  const width = 176;
  const height = 110;
  const margin = { top: 22, right: 8, bottom: 18, left: 24 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const years = React.useMemo(() => d3.range(1979, 2027), []);
  const yearDataMap = React.useMemo(() => {
    const map = new Map();
    for (const d of data) {
      if (d.year >= 1979 && d.year <= 2026) {
        map.set(d.year, d.frac != null ? d.frac : 0);
      }
    }
    return map;
  }, [data]);

  const panelData = React.useMemo(() => {
    return years.map((y) => ({
      year: y,
      frac: yearDataMap.has(y) ? yearDataMap.get(y) : null
    }));
  }, [years, yearDataMap]);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const container = d3.select(containerRef.current);
    container.selectAll("*").remove();

    const svg = container
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("display", "block")
      .style("background", "#ffffff")
      .style("border", "1px solid #e7ded4")
      .style("border-radius", "4px")
      .style("box-shadow", "0 1px 2px rgba(0,0,0,0.03)");

    const xScale = d3.scaleBand().domain(years).range([0, innerW]).padding(0.2);
    const yScale = d3.scaleLinear().domain([0, 1]).range([innerH, 0]).clamp(true);

    const titleText = svg
      .append("text")
      .attr("x", margin.left)
      .attr("y", 14)
      .attr("fill", "#2b231c")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("font-family", "Georgia, 'Tiempos Headline', serif");

    const plot = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    plot
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", innerH)
      .attr("y2", innerH)
      .attr("stroke", "#ded6cb")
      .attr("stroke-width", 1);

    plot
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke", "#eee7dd")
      .attr("stroke-dasharray", "2,2")
      .attr("stroke-width", 1);

    const yAxisG = svg.append("g").attr("transform", `translate(${margin.left - 3},${margin.top})`);
    [0, 0.5, 1].forEach((tickVal) => {
      yAxisG
        .append("text")
        .attr("x", 0)
        .attr("y", yScale(tickVal) + 3)
        .attr("text-anchor", "end")
        .attr("font-size", "8.5px")
        .attr("font-family", "'Fira Code', 'Pitch', monospace")
        .attr("fill", "#9e9183")
        .text(tickVal === 0.5 ? ".5" : String(tickVal));
    });

    const xAxisG = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top + innerH + 11})`);
    [1980, 2000, 2025].forEach((yr) => {
      xAxisG
        .append("text")
        .attr("x", (xScale(yr) || 0) + xScale.bandwidth() / 2)
        .attr("y", 0)
        .attr("text-anchor", "middle")
        .attr("font-size", "8px")
        .attr("font-family", "'Fira Code', 'Pitch', monospace")
        .attr("fill", "#9e9183")
        .text(yr);
    });

    const bars = plot
      .selectAll(".bar")
      .data(panelData)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => xScale(d.year))
      .attr("width", Math.max(1, xScale.bandwidth()))
      .attr("y", (d) => (d.frac != null ? yScale(d.frac) : innerH))
      .attr("height", (d) => (d.frac != null ? Math.max(0, innerH - yScale(d.frac)) : 0))
      .attr("rx", 0.5);

    const threshG = plot.append("g").attr("class", "threshold-g");

    const threshLine = threshG
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("stroke", "#d93829")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "3,2");

    const threshGrab = threshG
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("stroke", "transparent")
      .attr("stroke-width", 14)
      .style("cursor", "ns-resize");

    const updateVisuals = (tVal) => {
      const yPos = yScale(tVal);
      threshLine.attr("y1", yPos).attr("y2", yPos);
      threshGrab.attr("y1", yPos).attr("y2", yPos);

      let underCount = 0;
      let totalValid = 0;

      bars.each(function (d) {
        if (d.frac != null) {
          totalValid++;
          const isUnder = d.frac < tVal;
          if (isUnder) underCount++;
          d3.select(this).attr("fill", isUnder ? "#d93829" : "#487196");
        } else {
          d3.select(this).attr("fill", "transparent");
        }
      });

      titleText.text(`${region} · ${underCount} of ${totalValid} yrs under`);
    };

    const dragBehavior = d3
      .drag()
      .on("start", (event) => {
        event.sourceEvent?.stopPropagation?.();
      })
      .on("drag", function (event) {
        const coords = d3.pointer(event, plot.node());
        const rawY = coords[1];
        const val = Math.max(0, Math.min(1, yScale.invert(rawY)));
        const rounded = Math.round(val * 1000) / 1000;
        updateVisuals(rounded);
        if (onThresholdDrag) {
          onThresholdDrag(region, rounded);
        }
      })
      .on("end", function (event) {
        const coords = d3.pointer(event, plot.node());
        const rawY = coords[1];
        const val = Math.max(0, Math.min(1, yScale.invert(rawY)));
        const rounded = Math.round(val * 1000) / 1000;
        if (onThresholdDragEnd) {
          onThresholdDragEnd(region, rounded);
        }
      });

    threshGrab.call(dragBehavior);

    elementsRef.current = {
      updateVisuals,
      yScale
    };

    updateVisuals(thresholdRef.current);

    return () => {
      threshGrab.on(".drag", null);
      svg.remove();
    };
  }, [region, panelData]);

  React.useEffect(() => {
    if (elementsRef.current?.updateVisuals) {
      elementsRef.current.updateVisuals(threshold);
    }
  }, [threshold]);

  return <div ref={containerRef} style={{ width, height, userSelect: "none" }} />;
};

export const LiveQueryDisplay = ({ month, mode, sharedThreshold, thresholds, totalUnderCount }) => {
  const threshDisplay =
    mode === "shared"
      ? sharedThreshold.toFixed(2)
      : `<varies by panel>`;

  return (
    <div
      style={{
        background: "#1f1b18",
        color: "#f6ede2",
        padding: "14px 18px",
        borderRadius: 6,
        fontFamily: "'Fira Code', 'Pitch', monospace",
        fontSize: 12.5,
        lineHeight: 1.6,
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)",
        border: "1px solid #362f2a",
        marginTop: 18
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ color: "#d99b66", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 11 }}>
          Live SQL Inspector
        </span>
        <span style={{ color: "#a89b8d", fontSize: 11 }}>
          {mode === "shared" ? `Threshold = ${sharedThreshold.toFixed(3)}` : "Per-panel thresholds"}
        </span>
      </div>
      <div>
        <span style={{ color: "#e07a5f" }}>SELECT</span> region, year, <span style={{ color: "#81b29a" }}>AVG</span>(frac){" "}
        <span style={{ color: "#e07a5f" }}>FROM</span> ice <span style={{ color: "#e07a5f" }}>WHERE</span> month = {month}{" "}
        <span style={{ color: "#e07a5f" }}>GROUP BY</span> region, year{" "}
        <span style={{ color: "#e07a5f" }}>HAVING</span> <span style={{ color: "#81b29a" }}>AVG</span>(frac) &lt; {threshDisplay}{" "}
        <span style={{ color: "#8d8175" }}>-- {totalUnderCount} rows</span>
      </div>
    </div>
  );
};

export default function VisualizationWidget({ model, React }) {
  const rawData = model.get("data") || [];
  const [data, setData] = React.useState(rawData);
  const [month, setMonth] = React.useState(9);
  const [mode, setMode] = React.useState("shared");
  const [sharedThreshold, setSharedThreshold] = React.useState(0.15);
  const [thresholds, setThresholds] = React.useState({});

  const regions = React.useMemo(() => {
    const set = new Set();
    for (const d of data) {
      if (d.region) set.add(d.region);
    }
    const arr = Array.from(set);
    arr.sort();
    return arr;
  }, [data]);

  React.useEffect(() => {
    const handleDataChange = () => {
      setData(model.get("data") || []);
    };
    model.on("change:data", handleDataChange);
    return () => {
      model.off("change:data", handleDataChange);
    };
  }, [model]);

  React.useEffect(() => {
    if (regions.length === 0) return;
    setThresholds((prev) => {
      const next = { ...prev };
      let changed = false;
      regions.forEach((r) => {
        if (next[r] === undefined) {
          next[r] = sharedThreshold;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [regions, sharedThreshold]);

  const monthFilteredData = React.useMemo(() => {
    return data.filter((d) => d.month === month);
  }, [data, month]);

  const dataByRegion = React.useMemo(() => {
    const map = {};
    regions.forEach((r) => (map[r] = []));
    for (const d of monthFilteredData) {
      if (map[d.region]) {
        map[d.region].push(d);
      }
    }
    return map;
  }, [monthFilteredData, regions]);

  const syncModelOutputs = React.useCallback(
    (curThresholds, curMode, curSharedThresh) => {
      const underMap = {};
      regions.forEach((r) => {
        const tVal = curMode === "shared" ? curSharedThresh : (curThresholds[r] ?? curSharedThresh);
        const rows = dataByRegion[r] || [];
        const underYears = [];
        for (const d of rows) {
          if (d.year >= 1979 && d.year <= 2026 && d.frac != null && d.frac < tVal) {
            underYears.push(d.year);
          }
        }
        underYears.sort((a, b) => a - b);
        underMap[r] = underYears;
      });

      const effectiveThresholds = {};
      regions.forEach((r) => {
        effectiveThresholds[r] = curMode === "shared" ? curSharedThresh : (curThresholds[r] ?? curSharedThresh);
      });

      model.set("under", underMap);
      model.set("thresholds", effectiveThresholds);
      model.save_changes();
    },
    [regions, dataByRegion, model]
  );

  React.useEffect(() => {
    syncModelOutputs(thresholds, mode, sharedThreshold);
  }, [thresholds, mode, sharedThreshold, syncModelOutputs]);

  const handleModeChange = (newMode) => {
    if (newMode === "per-panel") {
      const initialized = {};
      regions.forEach((r) => {
        initialized[r] = sharedThreshold;
      });
      setThresholds(initialized);
    }
    setMode(newMode);
  };

  const handleThresholdDrag = (region, val) => {
    if (mode === "shared") {
      setSharedThreshold(val);
      setThresholds((prev) => {
        const next = {};
        regions.forEach((r) => (next[r] = val));
        return next;
      });
    } else {
      setThresholds((prev) => ({
        ...prev,
        [region]: val
      }));
    }
  };

  const handleThresholdDragEnd = (region, val) => {
    handleThresholdDrag(region, val);
  };

  const totalUnderCount = React.useMemo(() => {
    let count = 0;
    regions.forEach((r) => {
      const tVal = mode === "shared" ? sharedThreshold : (thresholds[r] ?? sharedThreshold);
      const rows = dataByRegion[r] || [];
      for (const d of rows) {
        if (d.year >= 1979 && d.year <= 2026 && d.frac != null && d.frac < tVal) {
          count++;
        }
      }
    });
    return count;
  }, [regions, dataByRegion, mode, sharedThreshold, thresholds]);

  return (
    <div
      style={{
        background: "#fbf9f5",
        color: "#28211b",
        padding: "20px 24px",
        borderRadius: 8,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        boxSizing: "border-box",
        maxWidth: 960,
        margin: "0 auto",
        border: "1px solid #ede3d7"
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          paddingBottom: 14,
          marginBottom: 16,
          borderBottom: "1px solid #e5dbcd"
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: "#1c1713",
              fontFamily: "Georgia, 'Tiempos Headline', serif",
              letterSpacing: "-0.01em"
            }}
          >
            Arctic Sea Ice Extent Fraction
          </h2>
          <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#6e6255" }}>
            14 regions, 1979–2026. Drag any red threshold line up/down to inspect low-ice years.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <ModeToggle mode={mode} onChange={handleModeChange} />
          <MonthPicker selectedMonth={month} onChange={setMonth} />
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 176px)",
          gap: "12px 10px",
          justifyContent: "center"
        }}
      >
        {regions.map((region) => {
          const tVal = mode === "shared" ? sharedThreshold : (thresholds[region] ?? sharedThreshold);
          return (
            <RegionPanel
              key={region}
              region={region}
              data={dataByRegion[region] || []}
              threshold={tVal}
              onThresholdDrag={handleThresholdDrag}
              onThresholdDragEnd={handleThresholdDragEnd}
              isShared={mode === "shared"}
              React={React}
            />
          );
        })}
      </div>

      <LiveQueryDisplay
        month={month}
        mode={mode}
        sharedThreshold={sharedThreshold}
        thresholds={thresholds}
        totalUnderCount={totalUnderCount}
      />
    </div>
  );
}