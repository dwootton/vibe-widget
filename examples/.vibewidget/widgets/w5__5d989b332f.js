import * as d3 from "https://esm.sh/d3@7";

export const ThresholdLegend = ({ thresholds, onReset }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "12px",
        fontFamily: "'Fira Code', 'Courier New', monospace",
        color: "#475569",
        padding: "4px 8px",
        marginBottom: "8px",
        background: "#f1efe7",
        borderRadius: "6px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: 14, height: 3, backgroundColor: "#ea580c", borderRadius: 2 }} />
          <span>Crossed Cutoff</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: 14, height: 2, backgroundColor: "#94a3b8", borderRadius: 1 }} />
          <span>Stable / Uncrossed</span>
        </span>
        <span style={{ color: "#64748b" }}>
          {thresholds.length === 1
            ? "Shift+Click anywhere on chart to add 2nd threshold · Drag guideline or use ↑/↓ keys"
            : "Double-click a threshold to remove · Drag or use ↑/↓ keys to adjust"}
        </span>
      </div>
      {thresholds.length > 1 && (
        <button
          onClick={onReset}
          style={{
            background: "none",
            border: "1px solid #cbd5e1",
            borderRadius: "4px",
            padding: "2px 8px",
            fontSize: "11px",
            cursor: "pointer",
            fontFamily: "inherit",
            color: "#334155",
          }}
        >
          Reset to 1 Threshold
        </button>
      )}
    </div>
  );
};

export default function Widget({ model, React }) {
  const containerRef = React.useRef(null);
  const outerWrapperRef = React.useRef(null);

  // Raw data from model
  const [rawData, setRawData] = React.useState(() => model.get("data") || []);

  // Listen to data changes from Python
  React.useEffect(() => {
    const handleDataChange = () => {
      setRawData(model.get("data") || []);
    };
    model.on("change:data", handleDataChange);
    return () => {
      model.off("change:data", handleDataChange);
    };
  }, [model]);

  // Normalize dataframe
  const processedData = React.useMemo(() => {
    let rows = [];
    if (Array.isArray(rawData)) {
      rows = rawData;
    } else if (rawData && typeof rawData === "object") {
      const keys = Object.keys(rawData);
      if (keys.length > 0 && Array.isArray(rawData[keys[0]])) {
        const len = rawData[keys[0]].length;
        for (let i = 0; i < len; i++) {
          const row = {};
          for (const k of keys) {
            row[k] = rawData[k][i];
          }
          rows.push(row);
        }
      }
    }

    // Group by patient
    const patientMap = new Map();
    rows.forEach((r) => {
      const pid = r.patient;
      if (!patientMap.has(pid)) {
        patientMap.set(pid, {
          patient: pid,
          age_group: r.age_group,
          visits: [],
        });
      }
      patientMap.get(pid).visits.push({
        visit: +r.visit,
        egfr: +r.egfr,
      });
    });

    // Sort visits per patient
    const patients = Array.from(patientMap.values()).map((p) => {
      p.visits.sort((a, b) => a.visit - b.visit);
      p.firstEgfr = p.visits[0]?.egfr ?? null;
      p.lastEgfr = p.visits[p.visits.length - 1]?.egfr ?? null;
      return p;
    });

    return patients;
  }, [rawData]);

  // Keep live interactive state in refs to avoid SVG recreation on drag (Rule 14)
  const thresholdsRef = React.useRef([60]);
  const activeThreshIdxRef = React.useRef(0);
  const [, setRerenderCounter] = React.useState(0);

  // Keep references to update handlers imperatively
  const updateChartsRef = React.useRef(null);

  // Calculate crossing details and band counts
  const computeStats = React.useCallback(
    (thresholds) => {
      const tPrimary = thresholds[0];
      const isTwo = thresholds.length === 2;
      const tSorted = [...thresholds].sort((a, b) => a - b);
      const [tLow, tHigh] = tSorted;

      const results = {
        crossedIds: [],
        panels: {
          "under 65": { crossedCount: 0, crossingVisits: [], total: 0, bandLow: 0, bandMid: 0, bandHigh: 0 },
          "65+": { crossedCount: 0, crossingVisits: [], total: 0, bandLow: 0, bandMid: 0, bandHigh: 0 },
        },
      };

      processedData.forEach((p) => {
        const group = p.age_group;
        const panel = results.panels[group];
        if (!panel) return;
        panel.total += 1;

        // Primary threshold crossing
        const crossed = p.firstEgfr > tPrimary && p.lastEgfr < tPrimary;
        if (crossed) {
          results.crossedIds.push(p.patient);
          panel.crossedCount += 1;
          const crossVisit = p.visits.find((v) => v.egfr < tPrimary);
          if (crossVisit) {
            panel.crossingVisits.push(crossVisit.visit);
          }
        }

        // Band counts for 2 thresholds based on final visit
        if (isTwo) {
          if (p.lastEgfr < tLow) {
            panel.bandLow += 1;
          } else if (p.lastEgfr <= tHigh) {
            panel.bandMid += 1;
          } else {
            panel.bandHigh += 1;
          }
        }
      });

      return results;
    },
    [processedData]
  );

  // Sync state outputs with model
  const syncModelOutputs = React.useCallback(
    (thresholds) => {
      const stats = computeStats(thresholds);
      model.set("crossed", stats.crossedIds);
      model.set("thresholds", [...thresholds]);
      model.save_changes();
    },
    [computeStats, model]
  );

  // Initialize model outputs on mount
  React.useEffect(() => {
    syncModelOutputs(thresholdsRef.current);
  }, [syncModelOutputs]);

  // Main chart construction effect: runs ONLY when processedData changes (Rule 14)
  React.useEffect(() => {
    if (!containerRef.current || processedData.length === 0) return;

    const container = containerRef.current;
    container.innerHTML = "";

    const width = 840;
    const height = 360;
    const margin = { top: 40, right: 30, bottom: 42, left: 45 };
    const panelGap = 50;
    const panelWidth = (width - margin.left - margin.right - panelGap) / 2;
    const plotHeight = height - margin.top - margin.bottom;

    const svg = d3
      .select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("style", "width: 100%; height: auto; max-height: 440px; display: block; user-select: none;");

    const xScale = d3.scaleLinear().domain([0, 7]).range([0, panelWidth]);
    const yScale = d3.scaleLinear().domain([0, 120]).range([plotHeight, 0]).clamp(true);

    const lineGen = d3
      .line()
      .x((d) => xScale(d.visit))
      .y((d) => yScale(d.egfr))
      .curve(d3.curveMonotoneX);

    const ageGroups = ["under 65", "65+"];
    const panelGroups = {};
    const patientPaths = [];

    // Create defs for subtle glow/gradients
    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "orange-glow").attr("x", "-20%").attr("y", "-20%").attr("width", "140%").attr("height", "140%");
    filter.append("feDropShadow").attr("dx", 0).attr("dy", 1).attr("stdDeviation", 1.5).attr("flood-color", "#ea580c").attr("flood-opacity", 0.35);

    // Build faceted panels
    ageGroups.forEach((group, idx) => {
      const gX = margin.left + idx * (panelWidth + panelGap);
      const gY = margin.top;
      const g = svg.append("g").attr("class", `panel-${idx}`).attr("transform", `translate(${gX}, ${gY})`);

      // Panel background
      g.append("rect")
        .attr("width", panelWidth)
        .attr("height", plotHeight)
        .attr("fill", "#faf8f2")
        .attr("rx", 6)
        .attr("stroke", "#e5e0d3")
        .attr("stroke-width", 1);

      // Gridlines
      const yTicks = [20, 40, 60, 80, 100, 120];
      g.append("g")
        .attr("class", "grid")
        .selectAll("line")
        .data(yTicks)
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("x2", panelWidth)
        .attr("y1", (d) => yScale(d))
        .attr("y2", (d) => yScale(d))
        .attr("stroke", "#eeebe2")
        .attr("stroke-width", 1);

      // Bottom axes
      const xAxis = d3
        .axisBottom(xScale)
        .ticks(8)
        .tickFormat((d) => `V${d}`)
        .tickSize(4);

      g.append("g")
        .attr("transform", `translate(0, ${plotHeight})`)
        .call(xAxis)
        .call((sel) => sel.select(".domain").attr("stroke", "#cbd5e1"))
        .call((sel) => sel.selectAll(".tick line").attr("stroke", "#cbd5e1"))
        .call((sel) =>
          sel
            .selectAll(".tick text")
            .attr("fill", "#475569")
            .attr("font-family", "'Fira Code', monospace")
            .attr("font-size", "10px")
        );

      // Left axis on panel 0
      if (idx === 0) {
        const yAxis = d3.axisLeft(yScale).ticks(6).tickSize(4);
        g.append("g")
          .call(yAxis)
          .call((sel) => sel.select(".domain").attr("stroke", "#cbd5e1"))
          .call((sel) => sel.selectAll(".tick line").attr("stroke", "#cbd5e1"))
          .call((sel) =>
            sel
              .selectAll(".tick text")
              .attr("fill", "#475569")
              .attr("font-family", "'Fira Code', monospace")
              .attr("font-size", "10px")
          );

        // Y-axis Label
        g.append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", -32)
          .attr("x", -plotHeight / 2)
          .attr("text-anchor", "middle")
          .attr("fill", "#334155")
          .attr("font-family", "'Fira Code', monospace")
          .attr("font-size", "11px")
          .text("eGFR (mL/min/1.73m²)");
      }

      // Panel Header Title & Subheader
      const titleGroup = g.append("g").attr("class", "panel-header").attr("transform", "translate(0, -12)");

      titleGroup
        .append("text")
        .attr("class", "group-title")
        .attr("x", 0)
        .attr("y", -10)
        .attr("font-family", "'Playfair Display', Georgia, serif")
        .attr("font-weight", 700)
        .attr("font-size", "14px")
        .attr("fill", "#0f172a")
        .text(`Age Group: ${group}`);

      const headerStats = titleGroup
        .append("text")
        .attr("class", "stats-header")
        .attr("x", panelWidth)
        .attr("y", -10)
        .attr("text-anchor", "end")
        .attr("font-family", "'Fira Code', monospace")
        .attr("font-size", "11px")
        .attr("fill", "#334155");

      // Group for patient lines
      const linesGroup = g.append("g").attr("class", "patient-lines");
      const groupPatients = processedData.filter((p) => p.age_group === group);

      groupPatients.forEach((p) => {
        const path = linesGroup
          .append("path")
          .datum(p.visits)
          .attr("d", lineGen)
          .attr("fill", "none")
          .attr("stroke", "#94a3b8")
          .attr("stroke-width", 1.1)
          .attr("stroke-opacity", 0.45);

        patientPaths.push({
          patient: p,
          element: path,
        });
      });

      // Layer for guidelines inside panel
      const guidelinesGroup = g.append("g").attr("class", "guidelines-layer");

      panelGroups[group] = {
        groupNode: g.node(),
        headerStats,
        guidelinesGroup,
        panelWidth,
      };

      // Shift+Click handler on panel to add 2nd threshold
      g.on("click", (event) => {
        if (!event.shiftKey) return;
        event.stopPropagation();
        const coords = d3.pointer(event, g.node());
        const clickedEgfr = Math.round(yScale.invert(coords[1]));
        const clamped = Math.max(0, Math.min(120, clickedEgfr));

        if (thresholdsRef.current.length < 2) {
          thresholdsRef.current.push(clamped);
          activeThreshIdxRef.current = thresholdsRef.current.length - 1;
          syncModelOutputs(thresholdsRef.current);
          renderThresholdMarks();
          updateCharts();
          setRerenderCounter((c) => c + 1);
        }
      });
    });

    // Helper to calculate median
    const median = (arr) => {
      if (!arr || arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1);
    };

    // Imperative update function for patient lines and headers without rebuilding DOM
    const updateCharts = () => {
      const thresholds = thresholdsRef.current;
      const tPrimary = thresholds[0];
      const isTwo = thresholds.length === 2;
      const tSorted = [...thresholds].sort((a, b) => a - b);
      const [tLow, tHigh] = tSorted;

      // Update patient lines
      patientPaths.forEach(({ patient, element }) => {
        const crossed = patient.firstEgfr > tPrimary && patient.lastEgfr < tPrimary;
        if (crossed) {
          element
            .attr("stroke", "#ea580c")
            .attr("stroke-width", 2)
            .attr("stroke-opacity", 0.9)
            .attr("filter", "url(#orange-glow)")
            .raise();
        } else {
          element
            .attr("stroke", "#94a3b8")
            .attr("stroke-width", 1.1)
            .attr("stroke-opacity", 0.35)
            .attr("filter", null);
        }
      });

      // Update panel headers
      const stats = computeStats(thresholds);
      ageGroups.forEach((group) => {
        const pStats = stats.panels[group];
        const { headerStats } = panelGroups[group];
        if (!isTwo) {
          const med = median(pStats.crossingVisits);
          headerStats.text(`${pStats.crossedCount} crossed · median crossing visit ${med}`);
        } else {
          headerStats.text(
            `< ${tLow}: ${pStats.bandLow} · ${tLow}–${tHigh}: ${pStats.bandMid} · ≥ ${tHigh}: ${pStats.bandHigh}`
          );
        }
      });
    };

    // Render interactive draggable guideline thresholds
    const renderThresholdMarks = () => {
      ageGroups.forEach((group) => {
        const { guidelinesGroup, panelWidth, groupNode } = panelGroups[group];
        guidelinesGroup.selectAll(".threshold-item").remove();

        thresholdsRef.current.forEach((val, tIdx) => {
          const item = guidelinesGroup
            .append("g")
            .attr("class", `threshold-item threshold-${tIdx}`)
            .attr("transform", `translate(0, ${yScale(val)})`)
            .style("cursor", "ns-resize");

          // Wide invisible grab area (14px)
          const grabArea = item
            .append("rect")
            .attr("x", 0)
            .attr("y", -7)
            .attr("width", panelWidth)
            .attr("height", 14)
            .attr("fill", "transparent");

          // Visual guideline dashed line
          const visualLine = item
            .append("line")
            .attr("x1", 0)
            .attr("x2", panelWidth)
            .attr("y1", 0)
            .attr("y2", 0)
            .attr("stroke", tIdx === 0 ? "#ea580c" : "#2563eb")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", tIdx === 0 ? "5,3" : "3,3");

          // Guideline badge label
          const badge = item
            .append("g")
            .attr("transform", `translate(${panelWidth - 65}, -10)`);

          badge
            .append("rect")
            .attr("width", 65)
            .attr("height", 20)
            .attr("rx", 4)
            .attr("fill", tIdx === 0 ? "#ea580c" : "#2563eb")
            .attr("opacity", 0.9);

          const badgeText = badge
            .append("text")
            .attr("x", 32.5)
            .attr("y", 14)
            .attr("text-anchor", "middle")
            .attr("fill", "#ffffff")
            .attr("font-family", "'Fira Code', monospace")
            .attr("font-size", "10px")
            .attr("font-weight", "600")
            .text(`T${tIdx + 1}: ${Math.round(val)}`);

          // Double click on 2nd threshold to remove it
          if (tIdx > 0) {
            grabArea.on("dblclick", (e) => {
              e.stopPropagation();
              thresholdsRef.current.splice(tIdx, 1);
              activeThreshIdxRef.current = 0;
              syncModelOutputs(thresholdsRef.current);
              renderThresholdMarks();
              updateCharts();
              setRerenderCounter((c) => c + 1);
            });
          }

          // Drag behavior
          const dragBehavior = d3
            .drag()
            .on("start", (event) => {
              activeThreshIdxRef.current = tIdx;
              if (outerWrapperRef.current) {
                outerWrapperRef.current.focus();
              }
            })
            .on("drag", (event) => {
              // Read pointer position with d3.pointer on the panel's plot group (Rule 15)
              const coords = d3.pointer(event, groupNode);
              const newEgfr = Math.max(0, Math.min(120, yScale.invert(coords[1])));
              thresholdsRef.current[tIdx] = Math.round(newEgfr);

              // Update guidelines in both panels synchronously
              ageGroups.forEach((grp) => {
                const grpLines = panelGroups[grp].guidelinesGroup;
                const threshG = grpLines.select(`.threshold-${tIdx}`);
                threshG.attr("transform", `translate(0, ${yScale(thresholdsRef.current[tIdx])})`);
                threshG.select("text").text(`T${tIdx + 1}: ${Math.round(thresholdsRef.current[tIdx])}`);
              });

              updateCharts();
            })
            .on("end", () => {
              syncModelOutputs(thresholdsRef.current);
            });

          item.call(dragBehavior);
        });
      });
    };

    // Expose imperative update for keyboard nudges
    updateChartsRef.current = () => {
      renderThresholdMarks();
      updateCharts();
      syncModelOutputs(thresholdsRef.current);
    };

    // Initial render
    renderThresholdMarks();
    updateCharts();

    return () => {
      svg.remove();
    };
  }, [processedData, computeStats, syncModelOutputs]);

  // Keyboard navigation: up/down arrow keys nudge the last-touched threshold by 1 (Rule 16)
  const handleKeyDown = (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const delta = e.key === "ArrowUp" ? 1 : -1;
      const idx = activeThreshIdxRef.current || 0;
      const currentVal = thresholdsRef.current[idx];
      const newVal = Math.max(0, Math.min(120, currentVal + delta));
      if (newVal !== currentVal) {
        thresholdsRef.current[idx] = newVal;
        if (updateChartsRef.current) {
          updateChartsRef.current();
        }
      }
    }
  };

  const handleReset = () => {
    thresholdsRef.current = [thresholdsRef.current[0] ?? 60];
    activeThreshIdxRef.current = 0;
    if (updateChartsRef.current) {
      updateChartsRef.current();
    }
    setRerenderCounter((c) => c + 1);
  };

  return (
    <div
      ref={outerWrapperRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        outline: "none",
        backgroundColor: "#fdfbf7",
        color: "#1e293b",
        fontFamily: "'Playfair Display', Georgia, serif",
        padding: "20px 24px 16px 24px",
        borderRadius: "12px",
        border: "1px solid #e7e5df",
        boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
        maxWidth: "920px",
        margin: "0 auto",
      }}
    >
      <div style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "#0f172a",
            }}
          >
            Renal Function Trajectories & Cutoff Dynamics
          </h2>
          <span
            style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: "11px",
              color: "#64748b",
            }}
          >
            CKD Progression Cohort (N = {processedData.length})
          </span>
        </div>
        <p
          style={{
            margin: "4px 0 0 0",
            fontSize: "13px",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            color: "#64748b",
            lineHeight: "1.4",
          }}
        >
          Tracking individual patient eGFR over 8 visits. Patients who began above the primary threshold and progressed
          below it by their final visit are highlighted.
        </p>
      </div>

      <ThresholdLegend thresholds={thresholdsRef.current} onReset={handleReset} />

      <div
        ref={containerRef}
        style={{
          width: "100%",
          position: "relative",
          userSelect: "none",
        }}
      />
    </div>
  );
}