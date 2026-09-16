import * as d3 from "https://esm.sh/d3@7";

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"
];

function normalizeData(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    const keys = Object.keys(raw);
    if (keys.length === 0) return [];
    const firstKey = keys[0];
    const len = Array.isArray(raw[firstKey])
      ? raw[firstKey].length
      : Object.keys(raw[firstKey]).length;
    const out = new Array(len);
    for (let i = 0; i < len; i++) {
      const row = {};
      for (const k of keys) {
        row[k] = Array.isArray(raw[k]) ? raw[k][i] : raw[k][i];
      }
      out[i] = row;
    }
    return out;
  }
  return [];
}

export const MonthPicker = ({ value, onChange }) => {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <label htmlFor="ice-month-select" style={{ fontSize: 11, color: "#777777", textTransform: "lowercase" }}>
        month
      </label>
      <select
        id="ice-month-select"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 11,
          fontWeight: 400,
          color: "#111111",
          background: "#ffffff",
          border: "1px solid #d9d9d9",
          borderRadius: 0,
          padding: "2px 6px",
          outline: "none",
          cursor: "pointer"
        }}
      >
        {MONTH_NAMES.map((name, i) => (
          <option key={i + 1} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
};

export const ModeToggle = ({ mode, onToggle }) => {
  const isShared = mode === "shared";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid #d9d9d9" }}>
      <button
        type="button"
        onClick={() => onToggle("shared")}
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 11,
          padding: "2px 8px",
          border: "none",
          borderRight: "1px solid #d9d9d9",
          background: isShared ? "#111111" : "#ffffff",
          color: isShared ? "#ffffff" : "#111111",
          cursor: "pointer",
          outline: "none"
        }}
      >
        shared
      </button>
      <button
        type="button"
        onClick={() => onToggle("per-panel")}
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 11,
          padding: "2px 8px",
          border: "none",
          background: !isShared ? "#111111" : "#ffffff",
          color: !isShared ? "#ffffff" : "#111111",
          cursor: "pointer",
          outline: "none"
        }}
      >
        per panel
      </button>
    </div>
  );
};

export const SmallMultiplesGrid = ({
  model,
  React,
  data,
  month,
  mode,
  thresholds,
  onThresholdChange
}) => {
  const containerRef = React.useRef(null);
  const modeRef = React.useRef(mode);
  const thresholdsRef = React.useRef(thresholds);
  const onThresholdChangeRef = React.useRef(onThresholdChange);
  const chartInstancesRef = React.useRef(new Map());

  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  React.useEffect(() => {
    thresholdsRef.current = thresholds;
    chartInstancesRef.current.forEach((inst, region) => {
      const th = thresholds[region] !== undefined ? thresholds[region] : 0.15;
      inst.updateThreshold(th, false);
    });
  }, [thresholds]);

  React.useEffect(() => {
    onThresholdChangeRef.current = onThresholdChange;
  }, [onThresholdChange]);

  const monthData = React.useMemo(() => {
    return data.filter((d) => Number(d.month) === Number(month) && Number(d.year) >= 1979);
  }, [data, month]);

  const regions = React.useMemo(() => {
    const set = new Set();
    for (const d of data) {
      if (d.region) set.add(d.region);
    }
    const arr = Array.from(set);
    arr.sort((a, b) => a.localeCompare(b));
    return arr;
  }, [data]);

  const grouped = React.useMemo(() => {
    const map = new Map();
    for (const r of regions) {
      map.set(r, []);
    }
    for (const d of monthData) {
      if (map.has(d.region)) {
        map.get(d.region).push(d);
      }
    }
    for (const [r, rows] of map.entries()) {
      rows.sort((a, b) => Number(a.year) - Number(b.year));
    }
    return map;
  }, [regions, monthData]);

  React.useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    root.innerHTML = "";
    chartInstancesRef.current.clear();

    const minYear = 1979;
    const maxYear = 2026;
    const width = 168;
    const height = 96;
    const margin = { top: 18, right: 8, bottom: 16, left: 24 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const xScale = d3
      .scaleBand()
      .domain(d3.range(minYear, maxYear + 1))
      .range([0, innerWidth])
      .paddingInner(0.2);

    const yScale = d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]);

    regions.forEach((region) => {
      const rows = grouped.get(region) || [];
      const totalCount = rows.length;
      const initialTh =
        thresholdsRef.current[region] !== undefined ? thresholdsRef.current[region] : 0.15;

      const card = document.createElement("div");
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.boxSizing = "border-box";
      card.style.border = "1px solid #f2f2f2";
      card.style.padding = "4px 4px 6px 4px";
      card.style.background = "#ffffff";
      root.appendChild(card);

      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.justifyContent = "space-between";
      header.style.alignItems = "baseline";
      header.style.padding = "0 4px 2px 4px";
      header.style.fontFamily = "system-ui, -apple-system, sans-serif";
      header.style.fontSize = "11px";
      header.style.lineHeight = "14px";
      header.style.whiteSpace = "nowrap";
      header.style.overflow = "hidden";
      header.style.textOverflow = "ellipsis";
      card.appendChild(header);

      const titleSpan = document.createElement("span");
      titleSpan.style.color = "#111111";
      titleSpan.style.fontWeight = "600";
      titleSpan.textContent = region;
      header.appendChild(titleSpan);

      const metaSpan = document.createElement("span");
      metaSpan.style.color = "#777777";
      metaSpan.style.fontFamily = "system-ui, -apple-system, sans-serif";
      metaSpan.style.fontSize = "11px";
      metaSpan.style.fontVariantNumeric = "tabular-nums";
      metaSpan.style.marginLeft = "4px";
      header.appendChild(metaSpan);

      const svg = d3
        .select(card)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .style("display", "block")
        .style("overflow", "visible");

      const g = svg
        .append("g")
        .attr("class", "plot-group")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Baseline at 0
      g.append("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", innerHeight)
        .attr("y2", innerHeight)
        .attr("stroke", "#d9d9d9")
        .attr("stroke-width", 1);

      // Top line at 1
      g.append("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", "#f2f2f2")
        .attr("stroke-width", 1);

      // Y axis labels (0 and 1)
      g.append("text")
        .attr("x", -4)
        .attr("y", innerHeight)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "ideographic")
        .attr("fill", "#777777")
        .attr("font-size", 9)
        .attr("font-family", "system-ui, -apple-system, sans-serif")
        .text("0");

      g.append("text")
        .attr("x", -4)
        .attr("y", 3)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "hanging")
        .attr("fill", "#777777")
        .attr("font-size", 9)
        .attr("font-family", "system-ui, -apple-system, sans-serif")
        .text("1");

      // X axis tick years: 1980 and 2025
      const y1980 = xScale(1980);
      if (y1980 !== undefined) {
        g.append("text")
          .attr("x", y1980)
          .attr("y", innerHeight + 11)
          .attr("text-anchor", "start")
          .attr("fill", "#777777")
          .attr("font-size", 9)
          .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace")
          .text("'80");
      }
      const y2025 = xScale(2025);
      if (y2025 !== undefined) {
        g.append("text")
          .attr("x", y2025 + xScale.bandwidth())
          .attr("y", innerHeight + 11)
          .attr("text-anchor", "end")
          .attr("fill", "#777777")
          .attr("font-size", 9)
          .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace")
          .text("'25");
      }

      // Thin bars
      const barElements = g
        .append("g")
        .attr("class", "bars")
        .selectAll("rect")
        .data(rows)
        .join("rect")
        .attr("x", (d) => xScale(Number(d.year)) || 0)
        .attr("y", (d) => yScale(Math.max(0, Math.min(1, Number(d.frac)))))
        .attr("width", Math.max(1, xScale.bandwidth()))
        .attr("height", (d) => innerHeight - yScale(Math.max(0, Math.min(1, Number(d.frac)))))
        .attr("fill", "#111111");

      // Horizontal threshold line group
      const threshGroup = g.append("g").attr("class", "threshold-line-group");

      const visibleLine = threshGroup
        .append("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("stroke", "#d9480f")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "3 2");

      // Label showing current threshold value on right side
      const threshValueText = threshGroup
        .append("text")
        .attr("x", innerWidth + 2)
        .attr("dominant-baseline", "middle")
        .attr("fill", "#d9480f")
        .attr("font-size", 9)
        .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace")
        .attr("font-weight", "600");

      // 14px invisible grab area
      const hitLine = threshGroup
        .append("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("stroke", "transparent")
        .attr("stroke-width", 14)
        .style("cursor", "ns-resize")
        .style("pointer-events", "stroke");

      let currentTh = initialTh;

      const updateThreshold = (th, notify = false) => {
        currentTh = Math.max(0, Math.min(1, th));
        const py = yScale(currentTh);
        visibleLine.attr("y1", py).attr("y2", py);
        hitLine.attr("y1", py).attr("y2", py);
        threshValueText.attr("y", py).text(currentTh.toFixed(2));

        let underCount = 0;
        barElements.each(function (d) {
          const val = Number(d.frac);
          const isUnder = val < currentTh;
          if (isUnder) underCount++;
          d3.select(this).attr("fill", isUnder ? "#c92a2a" : "#111111");
        });

        metaSpan.textContent = `· ${underCount} of ${totalCount} years under`;

        if (notify && onThresholdChangeRef.current) {
          onThresholdChangeRef.current(region, currentTh);
        }
      };

      const drag = d3
        .drag()
        .on("drag", function (event) {
          const [, pointerY] = d3.pointer(event, g.node());
          const newTh = Math.max(0, Math.min(1, yScale.invert(pointerY)));
          if (modeRef.current === "shared") {
            chartInstancesRef.current.forEach((inst) => {
              inst.updateThreshold(newTh, false);
            });
            if (onThresholdChangeRef.current) {
              onThresholdChangeRef.current(null, newTh);
            }
          } else {
            updateThreshold(newTh, true);
          }
        });

      hitLine.call(drag);

      // Initialize visuals
      updateThreshold(initialTh, false);

      chartInstancesRef.current.set(region, {
        updateThreshold,
        getThreshold: () => currentTh
      });
    });

    return () => {
      chartInstancesRef.current.clear();
      if (root) root.innerHTML = "";
    };
  }, [grouped, regions]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: 8,
        width: "100%",
        boxSizing: "border-box"
      }}
    />
  );
};

export const MonospaceQuery = ({ month, mode, thresholds, count }) => {
  const isShared = mode === "shared";
  const sampleTh = thresholds[Object.keys(thresholds)[0]] !== undefined
    ? thresholds[Object.keys(thresholds)[0]]
    : 0.15;

  let queryText = "";
  if (isShared) {
    queryText = `SELECT region, year, AVG(frac) FROM ice WHERE month = ${month} GROUP BY region, year HAVING AVG(frac) < ${sampleTh.toFixed(2)}   -- ${count} rows`;
  } else {
    queryText = `SELECT region, year, AVG(frac) FROM ice WHERE month = ${month} GROUP BY region, year HAVING AVG(frac) < threshold(region)   -- ${count} rows`;
  }

  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 8,
        borderTop: "1px solid #d9d9d9",
        fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        fontSize: 11,
        color: "#111111",
        lineHeight: "16px",
        overflowX: "auto",
        whiteSpace: "pre"
      }}
    >
      {queryText}
    </div>
  );
};

export default function VisualizationWidget({ model, React }) {
  const rawData = model.get("data") || [];
  const data = React.useMemo(() => normalizeData(rawData), [rawData]);

  const [month, setMonth] = React.useState(9);
  const [mode, setMode] = React.useState("shared");

  const regions = React.useMemo(() => {
    const set = new Set();
    for (const d of data) {
      if (d.region) set.add(d.region);
    }
    const arr = Array.from(set);
    arr.sort((a, b) => a.localeCompare(b));
    return arr;
  }, [data]);

  const [thresholds, setThresholds] = React.useState(() => {
    const init = {};
    return init;
  });

  const [sharedTh, setSharedTh] = React.useState(0.15);

  React.useEffect(() => {
    if (regions.length > 0) {
      setThresholds((prev) => {
        const next = { ...prev };
        let changed = false;
        regions.forEach((r) => {
          if (next[r] === undefined) {
            next[r] = sharedTh;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [regions, sharedTh]);

  const handleModeChange = (nextMode) => {
    if (nextMode === mode) return;
    if (nextMode === "per-panel") {
      setThresholds((prev) => {
        const next = {};
        regions.forEach((r) => {
          next[r] = prev[r] !== undefined ? prev[r] : sharedTh;
        });
        return next;
      });
    } else {
      setThresholds(() => {
        const next = {};
        regions.forEach((r) => {
          next[r] = sharedTh;
        });
        return next;
      });
    }
    setMode(nextMode);
  };

  const handleThresholdChange = React.useCallback(
    (targetRegion, newTh) => {
      if (targetRegion === null) {
        setSharedTh(newTh);
        setThresholds((prev) => {
          const next = {};
          regions.forEach((r) => {
            next[r] = newTh;
          });
          return next;
        });
      } else {
        setThresholds((prev) => ({
          ...prev,
          [targetRegion]: newTh
        }));
      }
    },
    [regions]
  );

  const underMap = React.useMemo(() => {
    const res = {};
    regions.forEach((r) => {
      res[r] = [];
    });
    const mData = data.filter((d) => Number(d.month) === Number(month) && Number(d.year) >= 1979);
    for (const d of mData) {
      const th = thresholds[d.region] !== undefined ? thresholds[d.region] : sharedTh;
      if (Number(d.frac) < th) {
        if (!res[d.region]) res[d.region] = [];
        res[d.region].push(Number(d.year));
      }
    }
    for (const r of regions) {
      if (res[r]) res[r].sort((a, b) => a - b);
    }
    return res;
  }, [data, month, regions, thresholds, sharedTh]);

  const totalUnderCount = React.useMemo(() => {
    let count = 0;
    for (const r of Object.keys(underMap)) {
      count += underMap[r].length;
    }
    return count;
  }, [underMap]);

  React.useEffect(() => {
    const cleanThresholds = {};
    regions.forEach((r) => {
      cleanThresholds[r] = thresholds[r] !== undefined ? thresholds[r] : sharedTh;
    });

    model.set("under", underMap);
    model.set("thresholds", cleanThresholds);
    model.save_changes();
  }, [underMap, thresholds, sharedTh, regions, model]);

  React.useEffect(() => {
    const onDataChange = () => {};
    model.on("change:data", onDataChange);
    return () => {
      model.off("change:data", onDataChange);
    };
  }, [model]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 960,
        margin: "0 auto",
        padding: 12,
        boxSizing: "border-box",
        background: "#ffffff",
        color: "#111111",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ModeToggle mode={mode} onToggle={handleModeChange} />
          <span style={{ fontSize: 11, color: "#777777", fontVariantNumeric: "tabular-nums" }}>
            {mode === "shared"
              ? `threshold: ${sharedTh.toFixed(2)}`
              : "thresholds: independent"}
          </span>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <SmallMultiplesGrid
        model={model}
        React={React}
        data={data}
        month={month}
        mode={mode}
        thresholds={thresholds}
        onThresholdChange={handleThresholdChange}
      />

      <MonospaceQuery
        month={month}
        mode={mode}
        thresholds={thresholds}
        count={totalUnderCount}
      />
    </div>
  );
}