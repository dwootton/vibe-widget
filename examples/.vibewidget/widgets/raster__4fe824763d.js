import * as d3 from "https://esm.sh/d3@7";

// Helper to normalize tabular data formats from AnyWidget / pandas
function normalizeData(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    const keys = Object.keys(raw);
    if (keys.length === 0) return [];
    const firstCol = raw[keys[0]];
    if (Array.isArray(firstCol)) {
      const len = firstCol.length;
      const res = new Array(len);
      for (let i = 0; i < len; i++) {
        const item = {};
        for (const k of keys) {
          item[k] = raw[k][i];
        }
        res[i] = item;
      }
      return res;
    }
  }
  return [];
}

export const Header = ({ windowRange, selectedCount, totalNeurons, spikeCountInWindow }) => (
  <div style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottom: "2px solid #23201d",
    paddingBottom: 10,
    marginBottom: 14
  }}>
    <div>
      <div style={{
        fontFamily: "'Playfair Display', Georgia, 'Tiempos Headline', serif",
        fontSize: 22,
        fontWeight: 700,
        color: "#1c1917",
        letterSpacing: "-0.02em"
      }}>
        Cortical Dynamics &bull; Ensemble Spike Raster
      </div>
      <div style={{
        fontFamily: "'Fira Code', 'Pitch', monospace",
        fontSize: 11,
        color: "#6b6257",
        marginTop: 3
      }}>
        60 Neurons across 20.0s recording | Stimulus onsets marked at S1–S5
      </div>
    </div>
    <div style={{
      display: "flex",
      gap: 16,
      alignItems: "baseline",
      fontFamily: "'Fira Code', 'Pitch', monospace",
      fontSize: 11,
      color: "#2a2622"
    }}>
      <div style={{ background: "#f0ece1", padding: "4px 8px", borderRadius: 4, border: "1px solid #dcd3c3" }}>
        <span style={{ color: "#786d5e" }}>Window: </span>
        <strong>{windowRange[0].toFixed(2)}s – {windowRange[1].toFixed(2)}s</strong>
        <span style={{ color: "#b45309", marginLeft: 6 }}>({(windowRange[1] - windowRange[0]).toFixed(2)}s)</span>
      </div>
      <div style={{ background: "#f0ece1", padding: "4px 8px", borderRadius: 4, border: "1px solid #dcd3c3" }}>
        <span style={{ color: "#786d5e" }}>Active / Total: </span>
        <strong>{selectedCount} / {totalNeurons}</strong>
      </div>
      <div style={{ background: "#f0ece1", padding: "4px 8px", borderRadius: 4, border: "1px solid #dcd3c3" }}>
        <span style={{ color: "#786d5e" }}>Spikes in Window: </span>
        <strong style={{ color: "#047857" }}>{spikeCountInWindow}</strong>
      </div>
    </div>
  </div>
);

export const ControlBar = ({ onSelectAll, onSelectNone, onSelectEveryThird, onShiftWindow, windowRange }) => (
  <div style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
    fontFamily: "'Fira Code', monospace",
    fontSize: 11
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: "#786d5e", fontWeight: 600 }}>Neuron Selection:</span>
      <button
        onClick={onSelectAll}
        style={{
          background: "#f4f0e6",
          border: "1px solid #c9beaa",
          padding: "3px 9px",
          borderRadius: 3,
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 600,
          color: "#2b2621"
        }}
      >
        All
      </button>
      <button
        onClick={onSelectNone}
        style={{
          background: "#f4f0e6",
          border: "1px solid #c9beaa",
          padding: "3px 9px",
          borderRadius: 3,
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 600,
          color: "#2b2621"
        }}
      >
        None
      </button>
      <button
        onClick={onSelectEveryThird}
        style={{
          background: "#f4f0e6",
          border: "1px solid #c9beaa",
          padding: "3px 9px",
          borderRadius: 3,
          cursor: "pointer",
          fontSize: 11,
          color: "#4a4237"
        }}
      >
        1/3rd Pattern
      </button>
      <span style={{ color: "#a89f91", marginLeft: 4 }}>
        (Click label to toggle, Shift+Click for range)
      </span>
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: "#786d5e" }}>Nudge Window (&plusmn;100ms):</span>
      <button
        onClick={() => onShiftWindow(-0.1)}
        title="Shift left 100ms (or focus raster & press Left Arrow)"
        style={{
          background: "#f4f0e6",
          border: "1px solid #c9beaa",
          padding: "3px 8px",
          borderRadius: 3,
          cursor: "pointer",
          fontSize: 11,
          fontWeight: "bold"
        }}
      >
        &larr; -100ms
      </button>
      <button
        onClick={() => onShiftWindow(0.1)}
        title="Shift right 100ms (or focus raster & press Right Arrow)"
        style={{
          background: "#f4f0e6",
          border: "1px solid #c9beaa",
          padding: "3px 8px",
          borderRadius: 3,
          cursor: "pointer",
          fontSize: 11,
          fontWeight: "bold"
        }}
      >
        +100ms &rarr;
      </button>
    </div>
  </div>
);

export default function Widget({ model, React }) {
  // Input traits
  const [dataRaw, setDataRaw] = React.useState(() => model.get("data"));
  const [stimRaw, setStimRaw] = React.useState(() => model.get("stim"));

  // Primary interactive state
  // Default window: [2.2, 3.2]
  const [windowRange, setWindowRange] = React.useState([2.2, 3.2]);
  // Default selection: every third neuron (0, 3, 6, ..., 57)
  const [selectedNeurons, setSelectedNeurons] = React.useState(() => {
    const s = new Set();
    for (let i = 0; i < 60; i += 3) s.add(i);
    return s;
  });

  const lastClickedNeuronRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const svgRef = React.useRef(null);

  // Sync inputs dynamically
  React.useEffect(() => {
    const handleDataChange = () => setDataRaw(model.get("data"));
    const handleStimChange = () => setStimRaw(model.get("stim"));
    model.on("change:data", handleDataChange);
    model.on("change:stim", handleStimChange);
    return () => {
      model.off("change:data", handleDataChange);
      model.off("change:stim", handleStimChange);
    };
  }, [model]);

  // Synchronize outputs to Python
  React.useEffect(() => {
    model.set("window", [windowRange[0], windowRange[1]]);
    const sortedNeurons = Array.from(selectedNeurons).sort((a, b) => a - b);
    model.set("neurons", sortedNeurons);
    model.save_changes();
  }, [windowRange, selectedNeurons, model]);

  // Normalize parsed data
  const spikes = React.useMemo(() => {
    const list = normalizeData(dataRaw);
    return list.map(d => ({ neuron: +d.neuron, t: +d.t }));
  }, [dataRaw]);

  const stims = React.useMemo(() => {
    const list = normalizeData(stimRaw);
    return list.map(d => ({ onset: +d.onset }));
  }, [stimRaw]);

  // Count spikes inside selected window across selected neurons
  const spikeCountInWindow = React.useMemo(() => {
    let count = 0;
    const [w0, w1] = windowRange;
    for (let i = 0; i < spikes.length; i++) {
      const s = spikes[i];
      if (s.t >= w0 && s.t <= w1 && selectedNeurons.has(s.neuron)) {
        count++;
      }
    }
    return count;
  }, [spikes, windowRange, selectedNeurons]);

  // Layout geometry
  const width = 860;
  const height = 480;
  const margin = { top: 28, right: 36, bottom: 42, left: 68 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const numNeurons = 60;
  const rowHeight = plotHeight / numNeurons;

  // Scales
  const xScale = React.useMemo(() => {
    return d3.scaleLinear().domain([0, 20]).range([0, plotWidth]);
  }, [plotWidth]);

  // Draw spikes on canvas whenever spikes, windowRange, or selectedNeurons change
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Retina display support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = plotWidth * dpr;
    canvas.height = plotHeight * dpr;
    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, plotWidth, plotHeight);

    // Subtle alternating row guide strips
    for (let n = 0; n < numNeurons; n++) {
      const y = n * rowHeight;
      const isSelected = selectedNeurons.has(n);
      if (isSelected) {
        ctx.fillStyle = "rgba(224, 214, 196, 0.45)";
        ctx.fillRect(0, y, plotWidth, rowHeight);
      } else if (n % 2 === 1) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.015)";
        ctx.fillRect(0, y, plotWidth, rowHeight);
      }
    }

    const [t0, t1] = windowRange;

    // Draw spikes
    // Ticks outside window: softer; inside window: deep rich ink
    for (let i = 0; i < spikes.length; i++) {
      const s = spikes[i];
      if (s.neuron < 0 || s.neuron >= numNeurons) continue;
      const x = xScale(s.t);
      if (x < 0 || x > plotWidth) continue;

      const y = s.neuron * rowHeight;
      const inWindow = s.t >= t0 && s.t <= t1;
      const isSelectedNeuron = selectedNeurons.has(s.neuron);

      if (inWindow) {
        if (isSelectedNeuron) {
          // Dark crisp ink for active neuron in active time
          ctx.fillStyle = "#0f172a";
        } else {
          // In window but unselected neuron
          ctx.fillStyle = "rgba(40, 32, 24, 0.55)";
        }
      } else {
        if (isSelectedNeuron) {
          // Selected neuron, outside window
          ctx.fillStyle = "rgba(80, 68, 54, 0.4)";
        } else {
          // Unselected neuron, outside window
          ctx.fillStyle = "rgba(145, 135, 122, 0.22)";
        }
      }

      // 1px tick
      ctx.fillRect(Math.round(x), y + 0.5, 1, Math.max(1, rowHeight - 1));
    }
  }, [spikes, windowRange, selectedNeurons, plotWidth, plotHeight, rowHeight, xScale]);

  // Keep live references for SVG interactive overlay
  const windowRef = React.useRef(windowRange);
  windowRef.current = windowRange;

  const selectedRef = React.useRef(selectedNeurons);
  selectedRef.current = selectedNeurons;

  // Render SVG interactive layer: stimuli markers, window shade & handles, labels & axis
  React.useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    // Defs for gradients & patterns
    const defs = svg.append("defs");

    // Clip path for plot area
    defs.append("clipPath")
      .attr("id", "plot-clip")
      .append("rect")
      .attr("width", plotWidth)
      .attr("height", plotHeight);

    const mainG = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Group for window shading (clipped to plot)
    const windowLayer = mainG.append("g").attr("clip-path", "url(#plot-clip)");

    // Window shade rect
    const shadeRect = windowLayer.append("rect")
      .attr("class", "window-shade")
      .attr("y", 0)
      .attr("height", plotHeight)
      .attr("fill", "rgba(245, 158, 11, 0.12)")
      .attr("stroke", "rgba(180, 83, 9, 0.45)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    // Stimulus onsets layer
    const stimG = mainG.append("g").attr("class", "stimuli");
    stims.forEach((st, idx) => {
      const sx = xScale(st.onset);
      if (sx >= 0 && sx <= plotWidth) {
        const stimGroup = stimG.append("g")
          .attr("transform", `translate(${sx}, 0)`);

        // Vertical dashed line
        stimGroup.append("line")
          .attr("y1", 0)
          .attr("y2", plotHeight)
          .attr("stroke", "#dc2626")
          .attr("stroke-width", 1.2)
          .attr("stroke-dasharray", "4,3")
          .attr("opacity", 0.85);

        // Flag at top
        const flag = stimGroup.append("g")
          .attr("transform", "translate(0, -18)");

        flag.append("polygon")
          .attr("points", "0,0 24,0 18,7 24,14 0,14")
          .attr("fill", "#dc2626");

        flag.append("text")
          .attr("x", 8)
          .attr("y", 10.5)
          .attr("fill", "#ffffff")
          .attr("font-size", "9px")
          .attr("font-family", "'Fira Code', monospace")
          .attr("font-weight", "bold")
          .text(`S${idx + 1}`);

        // Small onset time tag
        stimGroup.append("text")
          .attr("x", 3)
          .attr("y", plotHeight - 4)
          .attr("fill", "#991b1b")
          .attr("font-size", "9px")
          .attr("font-family", "'Fira Code', monospace")
          .text(`${st.onset}s`);
      }
    });

    // Time Axis at bottom
    const xAxis = d3.axisBottom(xScale)
      .ticks(10)
      .tickFormat(d => `${d}s`)
      .tickSizeOuter(0);

    const axisG = mainG.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${plotHeight})`)
      .call(xAxis);

    axisG.select(".domain")
      .attr("stroke", "#44403c")
      .attr("stroke-width", 1.2);

    axisG.selectAll(".tick line")
      .attr("stroke", "#a8a29e");

    axisG.selectAll(".tick text")
      .attr("fill", "#292524")
      .attr("font-family", "'Fira Code', monospace")
      .attr("font-size", "10px");

    // Axis Title
    mainG.append("text")
      .attr("x", plotWidth / 2)
      .attr("y", plotHeight + 34)
      .attr("text-anchor", "middle")
      .attr("font-family", "'Fira Code', monospace")
      .attr("font-size", "11px")
      .attr("fill", "#44403c")
      .text("Time (seconds) &bull; Drag axis or plot to adjust time window");

    // Neuron Row Labels on Left (0 at top, 59 at bottom)
    const labelGroup = mainG.append("g").attr("class", "neuron-labels");

    for (let n = 0; n < numNeurons; n++) {
      const y = n * rowHeight;
      const isSelected = selectedRef.current.has(n);

      const rowG = labelGroup.append("g")
        .attr("transform", `translate(0, ${y})`)
        .attr("cursor", "pointer")
        .style("user-select", "none");

      // Label background highlight
      rowG.append("rect")
        .attr("x", -margin.left + 8)
        .attr("y", 0)
        .attr("width", margin.left - 12)
        .attr("height", rowHeight)
        .attr("fill", isSelected ? "#e7e0d3" : "transparent")
        .attr("rx", 2);

      // Only show text for every 5th neuron to avoid visual clutter, plus 0 and 59
      if (n % 5 === 0 || n === 59) {
        rowG.append("text")
          .attr("x", -10)
          .attr("y", rowHeight * 0.72)
          .attr("text-anchor", "end")
          .attr("font-family", "'Fira Code', monospace")
          .attr("font-size", numNeurons > 40 ? "9px" : "10px")
          .attr("font-weight", isSelected ? "700" : "400")
          .attr("fill", isSelected ? "#1c1917" : "#857c70")
          .text(`N${n}`);
      }

      // Small indicator pip on hover / select
      rowG.append("rect")
        .attr("x", -4)
        .attr("y", 1)
        .attr("width", 2.5)
        .attr("height", Math.max(1, rowHeight - 2))
        .attr("fill", isSelected ? "#b45309" : "transparent");

      // Click handler with Shift+click support
      rowG.on("click", (evt) => {
        evt.stopPropagation();
        const currentSet = new Set(selectedRef.current);
        const last = lastClickedNeuronRef.current;

        if (evt.shiftKey && last !== null) {
          const start = Math.min(last, n);
          const end = Math.max(last, n);
          for (let k = start; k <= end; k++) {
            currentSet.add(k);
          }
        } else {
          if (currentSet.has(n)) {
            currentSet.delete(n);
          } else {
            currentSet.add(n);
          }
          lastClickedNeuronRef.current = n;
        }

        setSelectedNeurons(currentSet);
      });
    }

    // Top Label for neuron axis
    mainG.append("text")
      .attr("x", - margin.left + 8)
      .attr("y", -10)
      .attr("font-family", "'Fira Code', monospace")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .attr("fill", "#60584d")
      .text("NEURON");

    // Interactive overlay for the time window
    const overlay = mainG.append("g").attr("class", "window-interactive");

    const leftHandle = overlay.append("g").attr("cursor", "ew-resize");
    const rightHandle = overlay.append("g").attr("cursor", "ew-resize");
    const bodyHit = overlay.append("rect").attr("cursor", "grab").attr("fill", "transparent");

    // Visual boundary accents for the window
    leftHandle.append("line")
      .attr("y1", 0)
      .attr("y2", plotHeight)
      .attr("stroke", "#b45309")
      .attr("stroke-width", 2);

    // Grab pill on left
    leftHandle.append("rect")
      .attr("x", -4)
      .attr("y", plotHeight / 2 - 14)
      .attr("width", 8)
      .attr("height", 28)
      .attr("rx", 3)
      .attr("fill", "#d97706")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1);

    // Transparent wide hit area (16px)
    leftHandle.append("rect")
      .attr("x", -8)
      .attr("y", 0)
      .attr("width", 16)
      .attr("height", plotHeight)
      .attr("fill", "transparent");

    rightHandle.append("line")
      .attr("y1", 0)
      .attr("y2", plotHeight)
      .attr("stroke", "#b45309")
      .attr("stroke-width", 2);

    rightHandle.append("rect")
      .attr("x", -4)
      .attr("y", plotHeight / 2 - 14)
      .attr("width", 8)
      .attr("height", 28)
      .attr("rx", 3)
      .attr("fill", "#d97706")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1);

    rightHandle.append("rect")
      .attr("x", -8)
      .attr("y", 0)
      .attr("width", 16)
      .attr("height", plotHeight)
      .attr("fill", "transparent");

    // Position updates
    function updateWindowPositions(t0, t1) {
      const x0 = Math.max(0, Math.min(plotWidth, xScale(t0)));
      const x1 = Math.max(0, Math.min(plotWidth, xScale(t1)));
      const left = Math.min(x0, x1);
      const right = Math.max(x0, x1);
      const w = right - left;

      shadeRect.attr("x", left).attr("width", w);
      leftHandle.attr("transform", `translate(${left}, 0)`);
      rightHandle.attr("transform", `translate(${right}, 0)`);
      bodyHit.attr("x", left + 4).attr("y", 0).attr("width", Math.max(0, w - 8)).attr("height", plotHeight);
    }

    updateWindowPositions(windowRef.current[0], windowRef.current[1]);

    // Drag behavior for Left handle
    const dragLeft = d3.drag()
      .on("start", (evt) => {
        containerRef.current?.focus();
      })
      .on("drag", (evt) => {
        const [px] = d3.pointer(evt, mainG.node());
        let newT0 = xScale.invert(px);
        newT0 = Math.max(0, Math.min(windowRef.current[1] - 0.05, newT0));
        const updated = [newT0, windowRef.current[1]];
        windowRef.current = updated;
        updateWindowPositions(updated[0], updated[1]);
        setWindowRange(updated);
      });

    // Drag behavior for Right handle
    const dragRight = d3.drag()
      .on("start", (evt) => {
        containerRef.current?.focus();
      })
      .on("drag", (evt) => {
        const [px] = d3.pointer(evt, mainG.node());
        let newT1 = xScale.invert(px);
        newT1 = Math.max(windowRef.current[0] + 0.05, Math.min(20, newT1));
        const updated = [windowRef.current[0], newT1];
        windowRef.current = updated;
        updateWindowPositions(updated[0], updated[1]);
        setWindowRange(updated);
      });

    // Drag behavior for Window body (moving window)
    let bodyDragStartOffset = 0;
    const dragBody = d3.drag()
      .on("start", (evt) => {
        containerRef.current?.focus();
        const [px] = d3.pointer(evt, mainG.node());
        const tPointer = xScale.invert(px);
        bodyDragStartOffset = tPointer - windowRef.current[0];
      })
      .on("drag", (evt) => {
        const [px] = d3.pointer(evt, mainG.node());
        const tPointer = xScale.invert(px);
        const duration = windowRef.current[1] - windowRef.current[0];
        let newT0 = tPointer - bodyDragStartOffset;
        let newT1 = newT0 + duration;

        if (newT0 < 0) {
          newT0 = 0;
          newT1 = duration;
        } else if (newT1 > 20) {
          newT1 = 20;
          newT0 = 20 - duration;
        }

        const updated = [newT0, newT1];
        windowRef.current = updated;
        updateWindowPositions(updated[0], updated[1]);
        setWindowRange(updated);
      });

    leftHandle.call(dragLeft);
    rightHandle.call(dragRight);
    bodyHit.call(dragBody);

    // Drag on background or time axis to create a new window
    // Background hit area (underneath handles and body)
    const bgHit = mainG.insert("rect", ":first-child")
      .attr("width", plotWidth)
      .attr("height", plotHeight + margin.bottom)
      .attr("fill", "transparent")
      .attr("cursor", "crosshair");

    let createOrigin = null;
    const dragCreate = d3.drag()
      .on("start", (evt) => {
        containerRef.current?.focus();
        const [px] = d3.pointer(evt, mainG.node());
        const t = Math.max(0, Math.min(20, xScale.invert(px)));
        createOrigin = t;
        const updated = [t, t];
        windowRef.current = updated;
        updateWindowPositions(t, t);
      })
      .on("drag", (evt) => {
        if (createOrigin === null) return;
        const [px] = d3.pointer(evt, mainG.node());
        const currentT = Math.max(0, Math.min(20, xScale.invert(px)));
        const t0 = Math.min(createOrigin, currentT);
        const t1 = Math.max(createOrigin, currentT);
        const updated = [t0, t1];
        windowRef.current = updated;
        updateWindowPositions(t0, t1);
      })
      .on("end", () => {
        if (!windowRef.current) return;
        let [t0, t1] = windowRef.current;
        // Enforce minimal 100ms width
        if (t1 - t0 < 0.1) {
          t1 = Math.min(20, t0 + 0.5);
          t0 = Math.max(0, t1 - 0.5);
        }
        const updated = [t0, t1];
        windowRef.current = updated;
        updateWindowPositions(t0, t1);
        setWindowRange(updated);
        createOrigin = null;
      });

    bgHit.call(dragCreate);

    return () => {
      svg.selectAll("*").remove();
    };
  }, [xScale, plotWidth, plotHeight, numNeurons, rowHeight, stims]);

  // Handle arrow keys for 100ms nudges
  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      shiftWindow(-0.1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      shiftWindow(0.1);
    }
  };

  const shiftWindow = (delta) => {
    setWindowRange(([t0, t1]) => {
      const dur = t1 - t0;
      let newT0 = t0 + delta;
      let newT1 = t1 + delta;
      if (newT0 < 0) {
        newT0 = 0;
        newT1 = dur;
      } else if (newT1 > 20) {
        newT1 = 20;
        newT0 = 20 - dur;
      }
      return [Number(newT0.toFixed(3)), Number(newT1.toFixed(3))];
    });
  };

  const selectAll = () => {
    const s = new Set();
    for (let i = 0; i < numNeurons; i++) s.add(i);
    setSelectedNeurons(s);
  };

  const selectNone = () => {
    setSelectedNeurons(new Set());
  };

  const selectEveryThird = () => {
    const s = new Set();
    for (let i = 0; i < numNeurons; i += 3) s.add(i);
    setSelectedNeurons(s);
  };

  return (
    <section
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        outline: "none",
        background: "#fdfbf7",
        padding: "20px 24px",
        borderRadius: 8,
        border: "1px solid #e7dfd3",
        color: "#262320",
        boxShadow: "0 4px 18px rgba(0,0,0,0.04)",
        maxWidth: 908,
        boxSizing: "border-box",
        margin: "0 auto",
        userSelect: "none"
      }}
    >
      <Header
        windowRange={windowRange}
        selectedCount={selectedNeurons.size}
        totalNeurons={numNeurons}
        spikeCountInWindow={spikeCountInWindow}
      />

      <ControlBar
        onSelectAll={selectAll}
        onSelectNone={selectNone}
        onSelectEveryThird={selectEveryThird}
        onShiftWindow={shiftWindow}
        windowRange={windowRange}
      />

      {/* Stacked Canvas and SVG */}
      <div
        style={{
          position: "relative",
          width,
          height,
          background: "#ffffff",
          borderRadius: 6,
          border: "1px solid #dfd8cc",
          overflow: "hidden"
        }}
      >
        {/* Spike Raster Canvas */}
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: margin.top,
            left: margin.left,
            width: plotWidth,
            height: plotHeight,
            pointerEvents: "none"
          }}
        />

        {/* Interactive SVG Overlay */}
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            overflow: "visible"
          }}
        />
      </div>

      <div style={{
        marginTop: 10,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: "'Fira Code', monospace",
        fontSize: 10,
        color: "#8a8174"
      }}>
        <div>
          &bull; Use <strong>&larr; / &rarr;</strong> arrow keys to shift time window by 100ms when focused.
        </div>
        <div>
          Shaded window highlights spikes in deep ink &bull; Drag handles to resize &bull; Drag body to translate
        </div>
      </div>
    </section>
  );
}