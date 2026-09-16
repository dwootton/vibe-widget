import * as d3 from "https://esm.sh/d3@7";

export const RegionSelect = ({ regions, selected, onChange, React }) => {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <label style={{ fontSize: 12, color: "#777777", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        region
      </label>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 12,
          color: "#111111",
          background: "#ffffff",
          border: "1px solid #d9d9d9",
          padding: "3px 8px",
          outline: "none",
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

export const OutlierList = ({ items, onHoverYear, React }) => {
  return (
    <div
      style={{
        width: 170,
        borderLeft: "1px solid #d9d9d9",
        paddingLeft: 12,
        height: 380,
        overflowY: "auto",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxSizing: "border-box"
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#777777",
          marginBottom: 8,
          display: "flex",
          justifyContent: "space-between"
        }}
      >
        <span>outside ({items.length})</span>
        <span>|resid|</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {items.map((d) => (
          <div
            key={d.year}
            onMouseEnter={() => onHoverYear && onHoverYear(d.year)}
            onMouseLeave={() => onHoverYear && onHoverYear(null)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
              color: "#111111",
              padding: "2px 4px",
              cursor: "default"
            }}
          >
            <span style={{ color: "#d9480f" }}>{d.year}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {Math.abs(d.resid).toFixed(4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const SqlSnippet = ({ region, delta, count }) => {
  const query = `SELECT s.year, s.frac, c.co2_ppm FROM sept s JOIN co2 c ON s.year = c.year WHERE region = '${region}' AND ABS(frac - pred) > ${delta.toFixed(3)}   -- ${count} rows`;
  return (
    <div
      style={{
        marginTop: 18,
        fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        fontSize: 11.5,
        color: "#111111",
        background: "#f2f2f2",
        padding: "8px 12px",
        whiteSpace: "pre-wrap",
        overflowX: "auto",
        borderLeft: "2px solid #111111"
      }}
    >
      {query}
    </div>
  );
};

export default function Widget({ model, React }) {
  const [dataVersion, setDataVersion] = React.useState(0);

  React.useEffect(() => {
    const handleDataChange = () => setDataVersion((v) => v + 1);
    model.on("change:data", handleDataChange);
    return () => model.off("change:data", handleDataChange);
  }, [model]);

  const rawData = React.useMemo(() => {
    const raw = model.get("data");
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "object") {
      const keys = Object.keys(raw);
      if (keys.length === 0) return [];
      const len = raw[keys[0]] ? (Array.isArray(raw[keys[0]]) ? raw[keys[0]].length : Object.keys(raw[keys[0]]).length) : 0;
      const rows = [];
      for (let i = 0; i < len; i++) {
        const row = {};
        for (const k of keys) {
          row[k] = raw[k][i] !== undefined ? raw[k][i] : raw[k][String(i)];
        }
        rows.push(row);
      }
      return rows;
    }
    return [];
  }, [model, dataVersion]);

  const regions = React.useMemo(() => {
    const set = new Set(rawData.map((d) => d.region).filter(Boolean));
    const list = Array.from(set).sort();
    return list.length ? list : ["Barents"];
  }, [rawData]);

  const [selectedRegion, setSelectedRegion] = React.useState(() => {
    return regions.includes("Barents") ? "Barents" : regions[0] || "Barents";
  });

  React.useEffect(() => {
    if (regions.length && !regions.includes(selectedRegion)) {
      setSelectedRegion(regions[0]);
    }
  }, [regions, selectedRegion]);

  const regionData = React.useMemo(() => {
    return rawData
      .filter((d) => d.region === selectedRegion)
      .map((d) => ({
        ...d,
        year: +d.year,
        frac: +d.frac,
        co2_ppm: +d.co2_ppm,
        pred: +d.pred,
        resid: +d.resid
      }))
      .sort((a, b) => a.co2_ppm - b.co2_ppm);
  }, [rawData, selectedRegion]);

  const initialBand = React.useMemo(() => {
    if (!regionData.length) return { lo: -0.05, hi: 0.05 };
    const resids = regionData.map((d) => d.resid);
    const mean = d3.mean(resids) || 0;
    const sd = d3.deviation(resids) || 0.05;
    return { lo: mean - sd, hi: mean + sd };
  }, [regionData]);

  const [band, setBand] = React.useState(initialBand);
  const [hoveredYear, setHoveredYear] = React.useState(null);

  React.useEffect(() => {
    setBand(initialBand);
  }, [initialBand]);

  const bandRef = React.useRef(band);
  bandRef.current = band;

  const outsideData = React.useMemo(() => {
    return regionData
      .filter((d) => d.resid < band.lo || d.resid > band.hi)
      .sort((a, b) => Math.abs(b.resid) - Math.abs(a.resid));
  }, [regionData, band]);

  React.useEffect(() => {
    const outsideYears = outsideData.map((d) => d.year);
    model.set("outside", outsideYears);
    model.set("band", { lo: band.lo, hi: band.hi });
    model.save_changes();
  }, [outsideData, band, model]);

  const chartContainerRef = React.useRef(null);
  const elementsRef = React.useRef({});
  const scalesRef = React.useRef({});

  const regionDataRef = React.useRef(regionData);
  regionDataRef.current = regionData;

  const updateVisualMarks = React.useCallback((currentBand) => {
    const { dotSelection, upperLine, lowerLine, bandArea, scales } = elementsRef.current;
    if (!dotSelection || !scales) return;
    const { x, y } = scales;
    const currentData = regionDataRef.current;

    dotSelection
      .attr("fill", (d) => (d.resid < currentBand.lo || d.resid > currentBand.hi ? "#d9480f" : "#d9d9d9"))
      .attr("stroke", (d) => (d.resid < currentBand.lo || d.resid > currentBand.hi ? "#d9480f" : "#777777"));

    const lineGen = (offset) =>
      d3
        .line()
        .x((d) => x(d.co2_ppm))
        .y((d) => y(d.pred + offset));

    const areaGen = d3
      .area()
      .x((d) => x(d.co2_ppm))
      .y0((d) => y(d.pred + currentBand.lo))
      .y1((d) => y(d.pred + currentBand.hi));

    if (upperLine) upperLine.attr("d", lineGen(currentBand.hi)(currentData));
    if (lowerLine) lowerLine.attr("d", lineGen(currentBand.lo)(currentData));
    if (bandArea) bandArea.attr("d", areaGen(currentData));
  }, []);

  React.useEffect(() => {
    updateVisualMarks(band);
  }, [band, updateVisualMarks]);

  React.useEffect(() => {
    const { dotSelection } = elementsRef.current;
    if (!dotSelection) return;
    dotSelection
      .attr("r", (d) => (d.year === hoveredYear ? 6 : 3.5))
      .attr("stroke-width", (d) => (d.year === hoveredYear ? 2 : 1));
  }, [hoveredYear]);

  React.useEffect(() => {
    if (!chartContainerRef.current || !regionData.length) return;

    const container = chartContainerRef.current;
    container.innerHTML = "";

    const margin = { top: 16, right: 24, bottom: 36, left: 56 };
    const width = 560;
    const height = 380;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("display", "block")
      .style("overflow", "visible");

    const xExtent = d3.extent(regionData, (d) => d.co2_ppm);
    const xPadding = ((xExtent[1] || 420) - (xExtent[0] || 340)) * 0.04 || 4;
    const x = d3
      .scaleLinear()
      .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
      .range([0, innerWidth]);

    const yExtent = d3.extent(regionData, (d) => d.frac);
    const yPad = ((yExtent[1] || 1) - (yExtent[0] || 0)) * 0.08 || 0.02;
    const y = d3
      .scaleLinear()
      .domain([yExtent[0] - yPad, yExtent[1] + yPad])
      .range([innerHeight, 0]);

    scalesRef.current = { x, y };

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xAxis = d3
      .axisBottom(x)
      .ticks(6)
      .tickFormat((d) => `${d}`);
    const yAxis = d3
      .axisLeft(y)
      .ticks(6)
      .tickFormat((d) => d.toFixed(2));

    const gx = g
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis);
    gx.select(".domain").attr("stroke", "#d9d9d9");
    gx.selectAll(".tick line").attr("stroke", "#d9d9d9");
    gx.selectAll(".tick text")
      .attr("fill", "#777777")
      .style("font-size", "11px")
      .style("font-family", "ui-monospace, SF Mono, Menlo, monospace");

    g.append("text")
      .attr("x", innerWidth)
      .attr("y", innerHeight + 30)
      .attr("text-anchor", "end")
      .attr("fill", "#777777")
      .style("font-size", "11px")
      .style("font-family", "system-ui, -apple-system, sans-serif")
      .text("co2_ppm");

    const gy = g.append("g").call(yAxis);
    gy.select(".domain").attr("stroke", "#d9d9d9");
    gy.selectAll(".tick line").attr("stroke", "#d9d9d9");
    gy.selectAll(".tick text")
      .attr("fill", "#777777")
      .style("font-size", "11px")
      .style("font-family", "ui-monospace, SF Mono, Menlo, monospace");

    g.append("text")
      .attr("x", 0)
      .attr("y", -6)
      .attr("text-anchor", "start")
      .attr("fill", "#777777")
      .style("font-size", "11px")
      .style("font-family", "system-ui, -apple-system, sans-serif")
      .text("frac (september)");

    const areaGen = d3
      .area()
      .x((d) => x(d.co2_ppm))
      .y0((d) => y(d.pred + bandRef.current.lo))
      .y1((d) => y(d.pred + bandRef.current.hi));

    const bandArea = g
      .append("path")
      .attr("fill", "#111111")
      .attr("fill-opacity", 0.05)
      .attr("d", areaGen(regionData));

    const predLineGen = d3
      .line()
      .x((d) => x(d.co2_ppm))
      .y((d) => y(d.pred));

    g.append("path")
      .datum(regionData)
      .attr("fill", "none")
      .attr("stroke", "#111111")
      .attr("stroke-width", 1.5)
      .attr("d", predLineGen);

    const upperLine = g
      .append("path")
      .datum(regionData)
      .attr("fill", "none")
      .attr("stroke", "#777777")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3 3");

    const lowerLine = g
      .append("path")
      .datum(regionData)
      .attr("fill", "none")
      .attr("stroke", "#777777")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3 3");

    const tooltip = g.append("g").style("display", "none").style("pointer-events", "none");
    const tipBg = tooltip
      .append("rect")
      .attr("fill", "#111111")
      .attr("rx", 2)
      .attr("ry", 2)
      .attr("height", 18);
    const tipText = tooltip
      .append("text")
      .attr("fill", "#ffffff")
      .attr("font-size", "11px")
      .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace")
      .attr("alignment-baseline", "middle")
      .attr("text-anchor", "middle");

    const dotSelection = g
      .selectAll("circle.dot")
      .data(regionData)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", (d) => x(d.co2_ppm))
      .attr("cy", (d) => y(d.frac))
      .attr("r", 3.5)
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseenter", (event, d) => {
        setHoveredYear(d.year);
        tooltip.style("display", null);
        tipText.text(`${d.year}`);
        const textWidth = tipText.node().getComputedTextLength();
        tipBg
          .attr("width", textWidth + 8)
          .attr("x", -textWidth / 2 - 4)
          .attr("y", -22);
        tipText.attr("x", 0).attr("y", -13);
        tooltip.attr("transform", `translate(${x(d.co2_ppm)},${y(d.frac)})`);
      })
      .on("mouseleave", () => {
        setHoveredYear(null);
        tooltip.style("display", "none");
      });

    const createDragHandler = (edgeType) => {
      let startBand = null;
      let startDist = 0;

      return d3
        .drag()
        .on("start", (event) => {
          startBand = { ...bandRef.current };
          const [, cy] = d3.pointer(event, g.node());
          const dataFrac = y.invert(cy);
          const midPred = d3.mean(regionDataRef.current, (d) => d.pred) || 0;
          startDist = dataFrac - midPred;
        })
        .on("drag", (event) => {
          const [, cy] = d3.pointer(event, g.node());
          const curFrac = y.invert(cy);
          const midPred = d3.mean(regionDataRef.current, (d) => d.pred) || 0;
          const currentOffset = curFrac - midPred;
          const isShift = event.sourceEvent && event.sourceEvent.shiftKey;

          let newBand = { ...startBand };
          if (isShift) {
            const delta = currentOffset - startDist;
            newBand = {
              lo: startBand.lo + delta,
              hi: startBand.hi + delta
            };
          } else if (edgeType === "upper") {
            const newHi = Math.max(0.001, currentOffset);
            newBand = { ...startBand, hi: newHi };
          } else {
            const newLo = Math.min(-0.001, currentOffset);
            newBand = { ...startBand, lo: newLo };
          }

          bandRef.current = newBand;
          updateVisualMarks(newBand);
        })
        .on("end", () => {
          setBand({ ...bandRef.current });
        });
    };

    const upperHit = g
      .append("path")
      .datum(regionData)
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 16)
      .style("cursor", "ns-resize")
      .call(createDragHandler("upper"));

    const lowerHit = g
      .append("path")
      .datum(regionData)
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 16)
      .style("cursor", "ns-resize")
      .call(createDragHandler("lower"));

    const updateHits = () => {
      const lineGen = (offset) =>
        d3
          .line()
          .x((d) => x(d.co2_ppm))
          .y((d) => y(d.pred + offset));
      upperHit.attr("d", lineGen(bandRef.current.hi)(regionData));
      lowerHit.attr("d", lineGen(bandRef.current.lo)(regionData));
    };

    elementsRef.current = {
      dotSelection,
      upperLine,
      lowerLine,
      bandArea,
      scales: { x, y },
      updateHits
    };

    updateVisualMarks(bandRef.current);
    updateHits();

    return () => {
      svg.remove();
    };
  }, [regionData, updateVisualMarks]);

  React.useEffect(() => {
    if (elementsRef.current.updateHits) {
      elementsRef.current.updateHits();
    }
  }, [band]);

  const maxThreshold = Math.max(Math.abs(band.lo), Math.abs(band.hi));

  return (
    <div
      style={{
        padding: 12,
        background: "#ffffff",
        color: "#111111",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        maxWidth: 800,
        boxSizing: "border-box"
      }}
    >
      <RegionSelect
        regions={regions}
        selected={selectedRegion}
        onChange={setSelectedRegion}
        React={React}
      />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div ref={chartContainerRef} style={{ width: 560, height: 380, flexShrink: 0 }} />
        <OutlierList
          items={outsideData}
          onHoverYear={setHoveredYear}
          React={React}
        />
      </div>
      <SqlSnippet
        region={selectedRegion}
        delta={maxThreshold}
        count={outsideData.length}
      />
    </div>
  );
}