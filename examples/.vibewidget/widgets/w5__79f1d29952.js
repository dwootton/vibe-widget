import * as d3 from "https://esm.sh/d3@7";

export default function Widget({ model, React }) {
  const containerRef = React.useRef(null);
  const [thresholds, setThresholds] = React.useState([60]);
  const [lastTouchedIndex, setLastTouchedIndex] = React.useState(0);
  const [stats, setStats] = React.useState({ under65: { crossed: 0, medianVisit: 0 }, over65: { crossed: 0, medianVisit: 0 } });
  const [bandStats, setBandStats] = React.useState({ under65: [], over65: [] });
  const isDraggingRef = React.useRef(false);
  const panelGroupsRef = React.useRef({});

  const data = model.get("data") || [];

  const margin = { top: 40, right: 20, bottom: 40, left: 50 };
  const panelWidth = 300;
  const panelHeight = 360;
  const width = panelWidth * 2 + margin.left + margin.right + 40;
  const height = panelHeight + margin.top + margin.bottom;

  const computeStats = React.useCallback((patientsByGroup, thresh) => {
    const primaryThreshold = thresh[0];
    const newStats = { under65: { crossed: 0, medianVisit: 0 }, over65: { crossed: 0, medianVisit: 0 } };
    const crossedPatients = [];
    const crossingVisits = { under65: [], over65: [] };

    for (const [group, patients] of Object.entries(patientsByGroup)) {
      const groupKey = group === "under 65" ? "under65" : "over65";
      for (const [patientId, visits] of Object.entries(patients)) {
        const sortedVisits = visits.sort((a, b) => a.visit - b.visit);
        const firstEgfr = sortedVisits[0].egfr;
        const lastEgfr = sortedVisits[sortedVisits.length - 1].egfr;
        
        if (firstEgfr > primaryThreshold && lastEgfr < primaryThreshold) {
          newStats[groupKey].crossed++;
          crossedPatients.push(parseInt(patientId));
          const crossingVisit = sortedVisits.findIndex((v, i) => 
            i > 0 && sortedVisits[i - 1].egfr >= primaryThreshold && v.egfr < primaryThreshold
          );
          if (crossingVisit > 0) {
            crossingVisits[groupKey].push(crossingVisit);
          }
        }
      }
    }

    for (const groupKey of ["under65", "over65"]) {
      const visits = crossingVisits[groupKey].sort((a, b) => a - b);
      newStats[groupKey].medianVisit = visits.length > 0 
        ? visits[Math.floor(visits.length / 2)] 
        : 0;
    }

    return { stats: newStats, crossedPatients };
  }, []);

  const computeBandStats = React.useCallback((patientsByGroup, thresh) => {
    const sortedThresh = [...thresh].sort((a, b) => b - a);
    const bands = [];
    for (let i = 0; i <= sortedThresh.length; i++) {
      const upper = i === 0 ? 120 : sortedThresh[i - 1];
      const lower = i === sortedThresh.length ? 0 : sortedThresh[i];
      bands.push({ upper, lower });
    }

    const newBandStats = { under65: [], over65: [] };
    
    for (const [group, patients] of Object.entries(patientsByGroup)) {
      const groupKey = group === "under 65" ? "under65" : "over65";
      const bandCounts = bands.map(() => 0);
      
      for (const visits of Object.values(patients)) {
        const sortedVisits = visits.sort((a, b) => a.visit - b.visit);
        const lastEgfr = sortedVisits[sortedVisits.length - 1].egfr;
        
        for (let i = 0; i < bands.length; i++) {
          if (lastEgfr <= bands[i].upper && lastEgfr > bands[i].lower) {
            bandCounts[i]++;
            break;
          }
          if (i === bands.length - 1 && lastEgfr <= bands[i].lower) {
            bandCounts[i]++;
          }
        }
      }
      
      newBandStats[groupKey] = bands.map((band, i) => ({
        ...band,
        count: bandCounts[i]
      }));
    }

    return newBandStats;
  }, []);

  React.useEffect(() => {
    model.set("thresholds", thresholds);
    model.save_changes();
  }, [thresholds, model]);

  React.useEffect(() => {
    if (!containerRef.current || !data.length) return;

    d3.select(containerRef.current).selectAll("*").remove();

    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("user-select", "none");

    const patientsByGroup = {};
    data.forEach(d => {
      if (!patientsByGroup[d.age_group]) patientsByGroup[d.age_group] = {};
      if (!patientsByGroup[d.age_group][d.patient]) patientsByGroup[d.age_group][d.patient] = [];
      patientsByGroup[d.age_group][d.patient].push(d);
    });

    const xScale = d3.scaleLinear()
      .domain([0, 7])
      .range([0, panelWidth - margin.left - margin.right]);

    const yScale = d3.scaleLinear()
      .domain([0, 120])
      .range([panelHeight - margin.top - margin.bottom, 0]);

    const line = d3.line()
      .x(d => xScale(d.visit))
      .y(d => yScale(d.egfr));

    const groups = ["under 65", "65+"];
    const panels = {};

    groups.forEach((group, i) => {
      const panelX = margin.left + i * (panelWidth + 20);
      const panelG = svg.append("g")
        .attr("transform", `translate(${panelX}, ${margin.top})`);

      panels[group] = panelG;
      panelGroupsRef.current[group] = panelG.node();

      const plotG = panelG.append("g")
        .attr("class", "plot-area");

      plotG.append("g")
        .attr("transform", `translate(0, ${panelHeight - margin.top - margin.bottom})`)
        .call(d3.axisBottom(xScale).ticks(8).tickFormat(d => d))
        .selectAll("text")
        .style("font-size", "11px");

      plotG.append("g")
        .call(d3.axisLeft(yScale).ticks(6))
        .selectAll("text")
        .style("font-size", "11px");

      plotG.append("text")
        .attr("x", (panelWidth - margin.left - margin.right) / 2)
        .attr("y", panelHeight - margin.top - margin.bottom + 35)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#333")
        .text("Visit");

      if (i === 0) {
        plotG.append("text")
          .attr("transform", "rotate(-90)")
          .attr("x", -(panelHeight - margin.top - margin.bottom) / 2)
          .attr("y", -35)
          .attr("text-anchor", "middle")
          .style("font-size", "12px")
          .style("fill", "#333")
          .text("eGFR");
      }

      const patients = patientsByGroup[group] || {};
      const linesG = plotG.append("g").attr("class", "lines");

      Object.entries(patients).forEach(([patientId, visits]) => {
        const sortedVisits = visits.sort((a, b) => a.visit - b.visit);
        linesG.append("path")
          .datum(sortedVisits)
          .attr("class", `patient-line patient-${patientId}`)
          .attr("fill", "none")
          .attr("stroke", "#999")
          .attr("stroke-width", 1)
          .attr("stroke-opacity", 0.5)
          .attr("d", line);
      });

      panelG.append("text")
        .attr("class", "panel-header")
        .attr("x", (panelWidth - margin.left - margin.right) / 2)
        .attr("y", -15)
        .attr("text-anchor", "middle")
        .style("font-size", "13px")
        .style("font-weight", "bold")
        .style("fill", "#222");
    });

    const thresholdLinesG = svg.append("g").attr("class", "threshold-lines");

    const updateVisualization = (currentThresholds) => {
      const primaryThreshold = currentThresholds[0];
      const { stats: newStats, crossedPatients } = computeStats(patientsByGroup, currentThresholds);
      setStats(newStats);

      model.set("crossed", crossedPatients);
      model.save_changes();

      svg.selectAll(".patient-line")
        .attr("stroke", function() {
          const patientId = d3.select(this).attr("class").match(/patient-(\d+)/)?.[1];
          return crossedPatients.includes(parseInt(patientId)) ? "#ff7f0e" : "#999";
        })
        .attr("stroke-opacity", function() {
          const patientId = d3.select(this).attr("class").match(/patient-(\d+)/)?.[1];
          return crossedPatients.includes(parseInt(patientId)) ? 0.8 : 0.5;
        });

      thresholdLinesG.selectAll("*").remove();

      currentThresholds.forEach((thresh, threshIdx) => {
        groups.forEach((group, i) => {
          const panelX = margin.left + i * (panelWidth + 20);
          const yPos = yScale(thresh);

          thresholdLinesG.append("line")
            .attr("class", `threshold-line threshold-${threshIdx}`)
            .attr("x1", panelX)
            .attr("x2", panelX + panelWidth - margin.left - margin.right)
            .attr("y1", margin.top + yPos)
            .attr("y2", margin.top + yPos)
            .attr("stroke", threshIdx === 0 ? "#e41a1c" : "#377eb8")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,3");

          thresholdLinesG.append("rect")
            .attr("class", `threshold-grab threshold-grab-${threshIdx}`)
            .attr("x", panelX)
            .attr("width", panelWidth - margin.left - margin.right)
            .attr("y", margin.top + yPos - 7)
            .attr("height", 14)
            .attr("fill", "transparent")
            .attr("cursor", "ns-resize")
            .datum({ threshIdx, group });
        });
      });

      if (currentThresholds.length > 1) {
        const newBandStats = computeBandStats(patientsByGroup, currentThresholds);
        setBandStats(newBandStats);

        groups.forEach((group, i) => {
          const groupKey = group === "under 65" ? "under65" : "over65";
          const bandInfo = newBandStats[groupKey].map(b => `${b.count}`).join(" · ");
          panels[group].select(".panel-header")
            .text(`${group}: ${bandInfo} per band`);
        });
      } else {
        groups.forEach((group) => {
          const groupKey = group === "under 65" ? "under65" : "over65";
          panels[group].select(".panel-header")
            .text(`${group}: ${newStats[groupKey].crossed} crossed · median visit ${newStats[groupKey].medianVisit}`);
        });
      }

      const drag = d3.drag()
        .on("start", function(event) {
          isDraggingRef.current = true;
          svg.style("user-select", "none");
          document.body.style.userSelect = "none";
        })
        .on("drag", function(event) {
          const datum = d3.select(this).datum();
          const threshIdx = datum.threshIdx;
          const groupNode = panelGroupsRef.current[datum.group];
          const [, mouseY] = d3.pointer(event, groupNode);
          const newValue = Math.round(Math.max(0, Math.min(120, yScale.invert(mouseY))));
          
          setLastTouchedIndex(threshIdx);
          setThresholds(prev => {
            const updated = [...prev];
            updated[threshIdx] = newValue;
            return updated;
          });
        })
        .on("end", function() {
          isDraggingRef.current = false;
          svg.style("user-select", null);
          document.body.style.userSelect = null;
        });

      thresholdLinesG.selectAll(".threshold-grab").call(drag);
    };

    updateVisualization(thresholds);

    const handleClick = (event) => {
      if (!event.shiftKey || thresholds.length >= 2) return;
      
      const svgNode = svg.node();
      const [mouseX, mouseY] = d3.pointer(event, svgNode);
      
      let clickedGroup = null;
      groups.forEach((group, i) => {
        const panelX = margin.left + i * (panelWidth + 20);
        if (mouseX >= panelX && mouseX <= panelX + panelWidth - margin.left - margin.right) {
          if (mouseY >= margin.top && mouseY <= margin.top + panelHeight - margin.top - margin.bottom) {
            clickedGroup = group;
          }
        }
      });

      if (clickedGroup) {
        const groupNode = panelGroupsRef.current[clickedGroup];
        const [, localY] = d3.pointer(event, groupNode);
        const newValue = Math.round(Math.max(0, Math.min(120, yScale.invert(localY))));
        setThresholds(prev => [...prev, newValue]);
        setLastTouchedIndex(thresholds.length);
      }
    };

    svg.on("click", handleClick);

    const handleKeyDown = (event) => {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const delta = event.key === "ArrowUp" ? 1 : -1;
        setThresholds(prev => {
          const updated = [...prev];
          const idx = Math.min(lastTouchedIndex, updated.length - 1);
          updated[idx] = Math.max(0, Math.min(120, updated[idx] + delta));
          return updated;
        });
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      svg.remove();
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.userSelect = null;
    };
  }, [data]);

  React.useEffect(() => {
    if (!containerRef.current || !data.length) return;

    const svg = d3.select(containerRef.current).select("svg");
    if (svg.empty()) return;

    const patientsByGroup = {};
    data.forEach(d => {
      if (!patientsByGroup[d.age_group]) patientsByGroup[d.age_group] = {};
      if (!patientsByGroup[d.age_group][d.patient]) patientsByGroup[d.age_group][d.patient] = [];
      patientsByGroup[d.age_group][d.patient].push(d);
    });

    const yScale = d3.scaleLinear()
      .domain([0, 120])
      .range([panelHeight - margin.top - margin.bottom, 0]);

    const groups = ["under 65", "65+"];

    const { stats: newStats, crossedPatients } = computeStats(patientsByGroup, thresholds);
    setStats(newStats);

    model.set("crossed", crossedPatients);
    model.set("thresholds", thresholds);
    model.save_changes();

    svg.selectAll(".patient-line")
      .attr("stroke", function() {
        const patientId = d3.select(this).attr("class").match(/patient-(\d+)/)?.[1];
        return crossedPatients.includes(parseInt(patientId)) ? "#ff7f0e" : "#999";
      })
      .attr("stroke-opacity", function() {
        const patientId = d3.select(this).attr("class").match(/patient-(\d+)/)?.[1];
        return crossedPatients.includes(parseInt(patientId)) ? 0.8 : 0.5;
      });

    const thresholdLinesG = svg.select(".threshold-lines");
    thresholdLinesG.selectAll("*").remove();

    thresholds.forEach((thresh, threshIdx) => {
      groups.forEach((group, i) => {
        const panelX = margin.left + i * (panelWidth + 20);
        const yPos = yScale(thresh);

        thresholdLinesG.append("line")
          .attr("class", `threshold-line threshold-${threshIdx}`)
          .attr("x1", panelX)
          .attr("x2", panelX + panelWidth - margin.left - margin.right)
          .attr("y1", margin.top + yPos)
          .attr("y2", margin.top + yPos)
          .attr("stroke", threshIdx === 0 ? "#e41a1c" : "#377eb8")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "5,3");

        thresholdLinesG.append("rect")
          .attr("class", `threshold-grab threshold-grab-${threshIdx}`)
          .attr("x", panelX)
          .attr("width", panelWidth - margin.left - margin.right)
          .attr("y", margin.top + yPos - 7)
          .attr("height", 14)
          .attr("fill", "transparent")
          .attr("cursor", "ns-resize")
          .datum({ threshIdx, group });
      });
    });

    if (thresholds.length > 1) {
      const newBandStats = computeBandStats(patientsByGroup, thresholds);
      setBandStats(newBandStats);

      groups.forEach((group, i) => {
        const groupKey = group === "under 65" ? "under65" : "over65";
        const bandInfo = newBandStats[groupKey].map(b => `${b.count}`).join(" · ");
        svg.select(`g:nth-child(${i + 1}) .panel-header`)
          .text(`${group}: ${bandInfo} per band`);
      });
    } else {
      groups.forEach((group, i) => {
        const groupKey = group === "under 65" ? "under65" : "over65";
        svg.selectAll(".panel-header")
          .filter(function() {
            return d3.select(this.parentNode).attr("transform")?.includes(`${margin.left + i * (panelWidth + 20)}`);
          })
          .text(`${group}: ${newStats[groupKey].crossed} crossed · median visit ${newStats[groupKey].medianVisit}`);
      });
    }

    const drag = d3.drag()
      .on("start", function() {
        isDraggingRef.current = true;
        svg.style("user-select", "none");
        document.body.style.userSelect = "none";
      })
      .on("drag", function(event) {
        const datum = d3.select(this).datum();
        const threshIdx = datum.threshIdx;
        const groupNode = panelGroupsRef.current[datum.group];
        const [, mouseY] = d3.pointer(event, groupNode);
        const newValue = Math.round(Math.max(0, Math.min(120, yScale.invert(mouseY))));
        
        setLastTouchedIndex(threshIdx);
        setThresholds(prev => {
          const updated = [...prev];
          updated[threshIdx] = newValue;
          return updated;
        });
      })
      .on("end", function() {
        isDraggingRef.current = false;
        svg.style("user-select", null);
        document.body.style.userSelect = null;
      });

    thresholdLinesG.selectAll(".threshold-grab").call(drag);

  }, [thresholds, data, computeStats, computeBandStats, lastTouchedIndex, model]);

  React.useEffect(() => {
    model.set("crossed", []);
    model.set("thresholds", [60]);
    model.save_changes();
  }, [model]);

  React.useEffect(() => {
    const handler = () => {
      const newData = model.get("data");
    };
    model.on("change:data", handler);
    return () => model.off("change:data", handler);
  }, [model]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: 16 }}>
      <div style={{ marginBottom: 8, fontSize: 12, color: "#555" }}>
        <span style={{ marginRight: 16 }}>
          <strong>Thresholds:</strong> {thresholds.map((t, i) => (
            <span key={i} style={{ 
              color: i === 0 ? "#e41a1c" : "#377eb8",
              marginLeft: 8,
              fontWeight: i === lastTouchedIndex ? "bold" : "normal"
            }}>
              {t}
            </span>
          ))}
        </span>
        <span style={{ color: "#777" }}>
          (Shift+click to add threshold, ↑/↓ to nudge)
        </span>
      </div>
      <div ref={containerRef} />
    </div>
  );
}