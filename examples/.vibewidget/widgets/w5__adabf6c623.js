import * as d3 from "https://esm.sh/d3@7";

function normalizeData(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    if (Array.isArray(raw.patient)) {
      return raw.patient.map((_, i) => ({
        patient: raw.patient[i],
        visit: raw.visit[i],
        egfr: raw.egfr[i],
        age_group: raw.age_group[i],
      }));
    }
    const keys = Object.keys(raw.patient || {});
    return keys.map((k) => ({
      patient: raw.patient[k],
      visit: raw.visit[k],
      egfr: raw.egfr[k],
      age_group: raw.age_group[k],
    }));
  }
  return [];
}

export const FacetedEgfrChart = ({ model, React, width = 720, height = 380 }) => {
  const containerRef = React.useRef(null);
  const rootDivRef = React.useRef(null);

  const [rawInput, setRawInput] = React.useState(() => model.get("data") || []);
  React.useEffect(() => {
    const handleDataChange = () => setRawInput(model.get("data") || []);
    model.on("change:data", handleDataChange);
    return () => model.off("change:data", handleDataChange);
  }, [model]);

  const parsedData = React.useMemo(() => normalizeData(rawInput), [rawInput]);

  const patientMap = React.useMemo(() => {
    const map = new Map();
    for (const d of parsedData) {
      if (!map.has(d.patient)) {
        map.set(d.patient, {
          patient: d.patient,
          age_group: d.age_group,
          visits: [],
        });
      }
      map.get(d.patient).visits.push({
        visit: Number(d.visit),
        egfr: Number(d.egfr),
      });
    }
    for (const p of map.values()) {
      p.visits.sort((a, b) => a.visit - b.visit);
      p.firstEgfr = p.visits[0]?.egfr ?? 0;
      p.lastEgfr = p.visits[p.visits.length - 1]?.egfr ?? 0;
    }
    return map;
  }, [parsedData]);

  const patientsList = React.useMemo(() => Array.from(patientMap.values()), [patientMap]);

  // Thresholds state: starts at [60]
  const [thresholds, setThresholds] = React.useState([60]);
  const [activeThresholdIdx, setActiveThresholdIdx] = React.useState(0);

  const thresholdsRef = React.useRef(thresholds);
  thresholdsRef.current = thresholds;
  const activeIdxRef = React.useRef(activeThresholdIdx);
  activeIdxRef.current = activeThresholdIdx;

  // Imperative update refs
  const updateVisualsRef = React.useRef(null);

  // Sync outputs
  React.useEffect(() => {
    const primaryThreshold = thresholds[0] ?? 60;
    const crossedIds = patientsList
      .filter((p) => p.firstEgfr > primaryThreshold && p.lastEgfr < primaryThreshold)
      .map((p) => p.patient);

    model.set("thresholds", thresholds.map((t) => Math.round(t * 10) / 10));
    model.set("crossed", crossedIds);
    model.save_changes();
  }, [thresholds, patientsList, model]);

  // Build static chart skeleton once when data/width/height changes
  React.useEffect(() => {
    if (!containerRef.current) return;
    const root = d3.select(containerRef.current);
    root.selectAll("*").remove();

    const panels = ["under 65", "65+"];
    const margin = { top: 28, right: 16, bottom: 28, left: 34 };
    const panelGap = 32;
    const availableWidth = width - margin.left - margin.right - panelGap;
    const panelWidth = Math.max(120, availableWidth / 2);
    const plotHeight = height - margin.top - margin.bottom;

    const svg = root
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("display", "block")
      .style("font-family", "system-ui, -apple-system, Inter, Helvetica, sans-serif")
      .style("user-select", "none");

    const maxVisit = d3.max(parsedData, (d) => d.visit) ?? 7;
    const xScale = d3.scaleLinear().domain([0, maxVisit]).range([0, panelWidth]);
    const yScale = d3.scaleLinear().domain([0, 120]).range([plotHeight, 0]).clamp(true);

    const lineGen = d3
      .line()
      .x((d) => xScale(d.visit))
      .y((d) => yScale(d.egfr));

    const panelContainers = [];

    panels.forEach((group, idx) => {
      const offsetX = margin.left + idx * (panelWidth + panelGap);
      const panelG = svg
        .append("g")
        .attr("transform", `translate(${offsetX}, ${margin.top})`);

      // Header text
      const headerText = panelG
        .append("text")
        .attr("x", 0)
        .attr("y", -10)
        .attr("fill", "#111111")
        .attr("font-size", 11)
        .attr("font-weight", 400)
        .style("font-variant-numeric", "tabular-nums");

      // Gridlines & Axis
      const yTicks = [0, 30, 60, 90, 120];
      const yAxisG = panelG.append("g").attr("class", "y-axis");

      yTicks.forEach((t) => {
        const yPos = yScale(t);
        yAxisG
          .append("line")
          .attr("x1", 0)
          .attr("x2", panelWidth)
          .attr("y1", yPos)
          .attr("y2", yPos)
          .attr("stroke", "#f0f0f0")
          .attr("stroke-width", 1);

        if (idx === 0) {
          yAxisG
            .append("text")
            .attr("x", -6)
            .attr("y", yPos + 3.5)
            .attr("text-anchor", "end")
            .attr("fill", "#777777")
            .attr("font-size", 10)
            .style("font-variant-numeric", "tabular-nums")
            .text(t);
        }
      });

      // Bottom X axis
      const xTicks = d3.range(0, maxVisit + 1);
      const xAxisG = panelG
        .append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${plotHeight})`);

      xAxisG
        .append("line")
        .attr("x1", 0)
        .attr("x2", panelWidth)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", "#d9d9d9")
        .attr("stroke-width", 1);

      xTicks.forEach((v) => {
        const xPos = xScale(v);
        xAxisG
          .append("line")
          .attr("x1", xPos)
          .attr("x2", xPos)
          .attr("y1", 0)
          .attr("y2", 4)
          .attr("stroke", "#d9d9d9")
          .attr("stroke-width", 1);

        xAxisG
          .append("text")
          .attr("x", xPos)
          .attr("y", 15)
          .attr("text-anchor", "middle")
          .attr("fill", "#777777")
          .attr("font-size", 10)
          .style("font-variant-numeric", "tabular-nums")
          .text(v);
      });

      // Group patients in this age_group
      const groupPatients = patientsList.filter((p) => p.age_group === group);

      const pathsG = panelG.append("g").attr("class", "patient-lines");
      const pathElements = pathsG
        .selectAll("path")
        .data(groupPatients, (d) => d.patient)
        .join("path")
        .attr("d", (d) => lineGen(d.visits))
        .attr("fill", "none")
        .attr("stroke", "#cccccc")
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.75);

      // Thresholds layer
      const thresholdG = panelG.append("g").attr("class", "threshold-layer");

      // Shift-click background hit area to add second threshold
      const bgHitArea = panelG
        .insert("rect", ":first-child")
        .attr("width", panelWidth)
        .attr("height", plotHeight)
        .attr("fill", "transparent")
        .style("cursor", "crosshair");

      bgHitArea.on("click", (event) => {
        if (!event.shiftKey) return;
        const [, pointerY] = d3.pointer(event, panelG.node());
        const clickedEgfr = Math.round(d3.scaleLinear().domain([0, 120]).range([plotHeight, 0]).invert(pointerY));
        const clamped = Math.max(0, Math.min(120, clickedEgfr));

        const cur = thresholdsRef.current;
        if (cur.length < 2) {
          const next = [...cur, clamped];
          setThresholds(next);
          setActiveThresholdIdx(next.length - 1);
        } else {
          // Replace closest threshold or toggle
          const dist0 = Math.abs(cur[0] - clamped);
          const dist1 = Math.abs(cur[1] - clamped);
          const replaceIdx = dist0 <= dist1 ? 0 : 1;
          const next = [...cur];
          next[replaceIdx] = clamped;
          setThresholds(next);
          setActiveThresholdIdx(replaceIdx);
        }
        if (rootDivRef.current) rootDivRef.current.focus();
      });

      panelContainers.push({
        group,
        panelG,
        panelWidth,
        headerText,
        pathElements,
        thresholdG,
        groupPatients,
      });
    });

    // Imperative update function called on threshold changes or drags
    function updateVisuals(currThresholds, activeIdx) {
      const isTwo = currThresholds.length > 1;
      const primary = currThresholds[0];
      const sortedT = [...currThresholds].sort((a, b) => a - b);

      panelContainers.forEach(({ group, headerText, pathElements, thresholdG, groupPatients, panelG, panelWidth }) => {
        // 1. Patient lines coloring
        let crossedCount = 0;
        const crossingVisits = [];

        pathElements.each(function (p) {
          const crossed = p.firstEgfr > primary && p.lastEgfr < primary;
          if (crossed) {
            crossedCount++;
            const firstBelow = p.visits.find((v) => v.egfr < primary);
            if (firstBelow) crossingVisits.push(firstBelow.visit);
            d3.select(this)
              .attr("stroke", "#d9480f")
              .attr("stroke-width", 1.5)
              .attr("stroke-opacity", 0.95);
          } else {
            d3.select(this)
              .attr("stroke", "#c4c4c4")
              .attr("stroke-width", 1)
              .attr("stroke-opacity", 0.55);
          }
        });

        // 2. Header text
        if (!isTwo) {
          crossingVisits.sort((a, b) => a - b);
          let medVisitText = "–";
          if (crossingVisits.length > 0) {
            const mid = Math.floor(crossingVisits.length / 2);
            const med =
              crossingVisits.length % 2 !== 0
                ? crossingVisits[mid]
                : (crossingVisits[mid - 1] + crossingVisits[mid]) / 2;
            medVisitText = med.toString();
          }
          headerText.text(
            `${group} · ${crossedCount} crossed · median crossing visit ${medVisitText}`
          );
        } else {
          // Band counts based on last visit
          const tLow = sortedT[0];
          const tHigh = sortedT[1];
          let b1 = 0;
          let b2 = 0;
          let b3 = 0;
          groupPatients.forEach((p) => {
            const val = p.lastEgfr;
            if (val < tLow) b1++;
            else if (val <= tHigh) b2++;
            else b3++;
          });
          headerText.text(
            `${group} · <${Math.round(tLow)}: ${b1} · ${Math.round(tLow)}–${Math.round(tHigh)}: ${b2} · >${Math.round(tHigh)}: ${b3}`
          );
        }

        // 3. Threshold lines & handles
        const tSelection = thresholdG
          .selectAll("g.thresh-item")
          .data(currThresholds, (_, i) => i);

        tSelection.exit().remove();

        const tEnter = tSelection
          .enter()
          .append("g")
          .attr("class", "thresh-item");

        // Guideline line
        tEnter
          .append("line")
          .attr("class", "guide-line")
          .attr("x1", 0)
          .attr("x2", panelWidth)
          .attr("stroke-dasharray", "3,3");

        // Value text label
        tEnter
          .append("text")
          .attr("class", "thresh-label")
          .attr("x", panelWidth - 4)
          .attr("text-anchor", "end")
          .attr("font-size", 10)
          .attr("font-weight", 600)
          .style("font-variant-numeric", "tabular-nums");

        // Invisible grab area ~14px
        const grabArea = tEnter
          .append("line")
          .attr("class", "grab-area")
          .attr("x1", 0)
          .attr("x2", panelWidth)
          .attr("stroke", "transparent")
          .attr("stroke-width", 14)
          .style("cursor", "ns-resize");

        // Handle dot on the right side
        tEnter
          .append("circle")
          .attr("class", "thresh-handle")
          .attr("cx", panelWidth - 36)
          .attr("r", 3.5)
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 1.5)
          .style("cursor", "ns-resize");

        const tMerged = tEnter.merge(tSelection);

        tMerged.each(function (val, tIdx) {
          const itemG = d3.select(this);
          const yPos = yScale(val);
          const isActive = tIdx === activeIdx;
          const strokeColor = isActive ? "#111111" : "#777777";

          itemG.select(".guide-line")
            .attr("y1", yPos)
            .attr("y2", yPos)
            .attr("stroke", strokeColor)
            .attr("stroke-width", isActive ? 1.5 : 1);

          itemG.select(".grab-area")
            .attr("y1", yPos)
            .attr("y2", yPos);

          itemG.select(".thresh-handle")
            .attr("cy", yPos)
            .attr("fill", strokeColor);

          itemG.select(".thresh-label")
            .attr("y", yPos - 4)
            .attr("fill", strokeColor)
            .text(Math.round(val));

          // Drag behavior
          const drag = d3
            .drag()
            .on("start", (event) => {
              if (rootDivRef.current) rootDivRef.current.focus();
              activeIdxRef.current = tIdx;
              setActiveThresholdIdx(tIdx);
            })
            .on("drag", (event) => {
              // Read pointer y relative to the panel group
              const [, pointerY] = d3.pointer(event.sourceEvent || event, panelG.node());
              const inverted = yScale.invert(pointerY);
              const clamped = Math.max(0, Math.min(120, Math.round(inverted * 10) / 10));

              const updated = [...thresholdsRef.current];
              updated[tIdx] = clamped;
              thresholdsRef.current = updated;

              updateVisuals(updated, tIdx);
            })
            .on("end", () => {
              setThresholds([...thresholdsRef.current]);
            });

          itemG.select(".grab-area").call(drag);
          itemG.select(".thresh-handle").call(drag);
        });
      });
    }

    updateVisualsRef.current = updateVisuals;
    updateVisuals(thresholdsRef.current, activeIdxRef.current);

    return () => {
      svg.remove();
    };
  }, [parsedData, width, height, patientsList]);

  // Imperatively re-run visuals whenever thresholds or active index changes
  React.useEffect(() => {
    if (updateVisualsRef.current) {
      updateVisualsRef.current(thresholds, activeThresholdIdx);
    }
  }, [thresholds, activeThresholdIdx]);

  // Keyboard navigation: up/down arrows nudge active threshold by 1
  const handleKeyDown = (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const delta = e.key === "ArrowUp" ? 1 : -1;
      setThresholds((prev) => {
        const next = [...prev];
        const idx = activeIdxRef.current;
        if (next[idx] !== undefined) {
          next[idx] = Math.max(0, Math.min(120, Math.round(next[idx] + delta)));
        }
        return next;
      });
    } else if (e.key === "Backspace" || e.key === "Delete") {
      // Allow removing secondary threshold
      if (thresholdsRef.current.length > 1) {
        e.preventDefault();
        const removeIdx = activeIdxRef.current;
        const next = thresholdsRef.current.filter((_, i) => i !== removeIdx);
        setThresholds(next);
        setActiveThresholdIdx(0);
      }
    }
  };

  return (
    <div
      ref={rootDivRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        outline: "none",
        width,
        height,
        background: "#ffffff",
        position: "relative",
      }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default function Widget({ model, React }) {
  // Initialize outputs immediately
  React.useEffect(() => {
    const raw = model.get("data") || [];
    const parsed = normalizeData(raw);
    const map = new Map();
    for (const d of parsed) {
      if (!map.has(d.patient)) {
        map.set(d.patient, { visits: [] });
      }
      map.get(d.patient).visits.push({ visit: Number(d.visit), egfr: Number(d.egfr) });
    }
    const initialCrossed = [];
    for (const [pid, p] of map.entries()) {
      p.visits.sort((a, b) => a.visit - b.visit);
      const f = p.visits[0]?.egfr ?? 0;
      const l = p.visits[p.visits.length - 1]?.egfr ?? 0;
      if (f > 60 && l < 60) {
        initialCrossed.push(pid);
      }
    }
    model.set("thresholds", [60]);
    model.set("crossed", initialCrossed);
    model.save_changes();
  }, [model]);

  return (
    <div
      style={{
        background: "#ffffff",
        padding: 12,
        boxSizing: "border-box",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
      }}
    >
      <FacetedEgfrChart model={model} React={React} width={700} height={360} />
    </div>
  );
}