import * as d3 from "https://esm.sh/d3@7";

export const WindowControls = ({ React, windowRange, selectedCount, totalNeurons, onAll, onNone, onShiftLeft, onShiftRight }) => {
  const [t0, t1] = windowRange;
  const duration = (t1 - t0).toFixed(2);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        paddingBottom: 8,
        borderBottom: "1px solid #d9d9d9",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 12,
        color: "#111111",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#777777" }}>window</span>
        <span style={{ fontFamily: "ui-monospace, SF Mono, Menlo, monospace", fontVariantNumeric: "tabular-nums" }}>
          {t0.toFixed(2)}–{t1.toFixed(2)}s
        </span>
        <span style={{ color: "#777777", fontFamily: "ui-monospace, SF Mono, Menlo, monospace" }}>
          ({duration}s)
        </span>
        <button
          type="button"
          onClick={onShiftLeft}
          title="shift left 100ms"
          style={{
            background: "#ffffff",
            border: "1px solid #d9d9d9",
            borderRadius: 0,
            padding: "2px 6px",
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "inherit",
            color: "#111111",
          }}
        >
          ←
        </button>
        <button
          type="button"
          onClick={onShiftRight}
          title="shift right 100ms"
          style={{
            background: "#ffffff",
            border: "1px solid #d9d9d9",
            borderRadius: 0,
            padding: "2px 6px",
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "inherit",
            color: "#111111",
          }}
        >
          →
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#777777" }}>neurons</span>
        <span style={{ fontFamily: "ui-monospace, SF Mono, Menlo, monospace", fontVariantNumeric: "tabular-nums" }}>
          {selectedCount}/{totalNeurons}
        </span>
        <button
          type="button"
          onClick={onAll}
          style={{
            background: "#ffffff",
            border: "1px solid #d9d9d9",
            borderRadius: 0,
            padding: "2px 8px",
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "inherit",
            color: "#111111",
          }}
        >
          all
        </button>
        <button
          type="button"
          onClick={onNone}
          style={{
            background: "#ffffff",
            border: "1px solid #d9d9d9",
            borderRadius: 0,
            padding: "2px 8px",
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "inherit",
            color: "#111111",
          }}
        >
          none
        </button>
      </div>
    </div>
  );
};

export default function Widget({ model, React }) {
  const [dataVersion, setDataVersion] = React.useState(0);
  const containerRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const svgRef = React.useRef(null);
  const wrapperRef = React.useRef(null);

  const initialNeurons = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < 60; i += 3) arr.push(i);
    return arr;
  }, []);

  const [selectedNeurons, setSelectedNeurons] = React.useState(initialNeurons);
  const [timeWindow, setTimeWindow] = React.useState([2.2, 3.2]);
  const lastClickedNeuronRef = React.useRef(0);

  const selectedNeuronsRef = React.useRef(selectedNeurons);
  selectedNeuronsRef.current = selectedNeurons;

  const timeWindowRef = React.useRef(timeWindow);
  timeWindowRef.current = timeWindow;

  React.useEffect(() => {
    const handleStim = () => setDataVersion((v) => v + 1);
    const handleData = () => setDataVersion((v) => v + 1);
    model.on("change:stim", handleStim);
    model.on("change:data", handleData);
    return () => {
      model.off("change:stim", handleStim);
      model.off("change:data", handleData);
    };
  }, [model]);

  React.useEffect(() => {
    model.set("window", timeWindow);
    model.set("neurons", selectedNeurons);
    model.save_changes();
  }, [model, timeWindow, selectedNeurons]);

  const rawData = model.get("data");
  const rawStim = model.get("stim");

  const spikes = React.useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    if (rawData.neuron && rawData.t) {
      const nList = rawData.neuron;
      const tList = rawData.t;
      const len = Array.isArray(nList) ? nList.length : Object.keys(nList).length;
      const out = new Array(len);
      for (let i = 0; i < len; i++) {
        out[i] = { neuron: nList[i], t: tList[i] };
      }
      return out;
    }
    return [];
  }, [rawData, dataVersion]);

  const stims = React.useMemo(() => {
    if (!rawStim) return [];
    if (Array.isArray(rawStim)) {
      return rawStim.map((d) => (typeof d === "number" ? d : d.onset));
    }
    if (rawStim.onset) {
      const o = rawStim.onset;
      return Object.values(o);
    }
    return [];
  }, [rawStim, dataVersion]);

  const numNeurons = 60;
  const tMin = 0;
  const tMax = 20;

  const width = 720;
  const height = 480;
  const margin = { top: 24, right: 24, bottom: 32, left: 44 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const xScale = React.useMemo(() => {
    return d3.scaleLinear().domain([tMin, tMax]).range([0, plotWidth]);
  }, [plotWidth]);

  const rowHeight = plotHeight / numNeurons;

  const renderRaster = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, plotWidth, plotHeight);

    const [w0, w1] = timeWindowRef.current;
    const selSet = new Set(selectedNeuronsRef.current);

    // Subtle row band highlights for selected neurons
    for (let n = 0; n < numNeurons; n++) {
      if (selSet.has(n)) {
        ctx.fillStyle = "rgba(217, 72, 15, 0.08)";
        ctx.fillRect(0, n * rowHeight, plotWidth, rowHeight);
      }
    }

    const t0 = Math.min(w0, w1);
    const t1 = Math.max(w0, w1);

    for (let i = 0; i < spikes.length; i++) {
      const sp = spikes[i];
      const neuron = sp.neuron;
      if (neuron < 0 || neuron >= numNeurons) continue;
      const t = sp.t;
      if (t < tMin || t > tMax) continue;

      const x = Math.round(xScale(t));
      const y = Math.floor(neuron * rowHeight);
      const isInside = t >= t0 && t <= t1;
      const isSelectedRow = selSet.has(neuron);

      if (isInside) {
        ctx.fillStyle = isSelectedRow ? "#d9480f" : "#111111";
      } else {
        ctx.fillStyle = isSelectedRow ? "rgba(217, 72, 15, 0.6)" : "#888888";
      }
      ctx.fillRect(x, y + 0.5, 1, Math.max(1, rowHeight - 1));
    }
    ctx.restore();
  }, [spikes, xScale, plotWidth, plotHeight, rowHeight]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = plotWidth * dpr;
    canvas.height = plotHeight * dpr;
    canvas.style.width = `${plotWidth}px`;
    canvas.style.height = `${plotHeight}px`;
    renderRaster();
  }, [plotWidth, plotHeight, renderRaster]);

  React.useEffect(() => {
    renderRaster();
  }, [selectedNeurons, timeWindow, renderRaster]);

  const updateWindowOverlay = React.useCallback((t0, t1) => {
    if (!svgRef.current) return;
    const g = d3.select(svgRef.current).select(".overlay-group");
    const minT = Math.max(tMin, Math.min(t0, t1));
    const maxT = Math.min(tMax, Math.max(t0, t1));
    const x0 = xScale(minT);
    const x1 = xScale(maxT);
    const w = Math.max(0, x1 - x0);

    g.select(".window-shade")
      .attr("x", x0)
      .attr("width", w);

    g.select(".handle-left")
      .attr("x1", x0)
      .attr("x2", x0);

    g.select(".handle-right")
      .attr("x1", x1)
      .attr("x2", x1);

    g.select(".hit-left")
      .attr("x", x0 - 6)
      .attr("width", 12);

    g.select(".hit-right")
      .attr("x", x1 - 6)
      .attr("width", 12);

    g.select(".hit-body")
      .attr("x", x0)
      .attr("width", w);

    g.select(".handle-left-dot")
      .attr("cx", x0);

    g.select(".handle-right-dot")
      .attr("cx", x1);

    g.select(".axis-callout-left")
      .attr("transform", `translate(${x0}, ${plotHeight + 14})`)
      .text(minT.toFixed(2));

    g.select(".axis-callout-right")
      .attr("transform", `translate(${x1}, ${plotHeight + 14})`)
      .text(maxT.toFixed(2));
  }, [xScale, plotHeight]);

  React.useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const rootG = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Axis scales
    const xAxis = d3.axisBottom(xScale).ticks(10).tickFormat((d) => `${d}s`).tickSize(4);
    const yAxisG = rootG.append("g").attr("class", "y-axis");

    // Y ticks every 10 neurons
    for (let n = 0; n <= numNeurons; n += 10) {
      const y = n * rowHeight;
      yAxisG
        .append("text")
        .attr("x", -8)
        .attr("y", y + (n === 0 ? 6 : n === 60 ? -2 : 3))
        .attr("text-anchor", "end")
        .attr("font-size", "10px")
        .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace")
        .attr("fill", "#777777")
        .text(n === 60 ? "59" : n);
    }

    const xAxisG = rootG
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${plotHeight})`)
      .call(xAxis);

    xAxisG.selectAll("text")
      .attr("font-size", "10px")
      .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace")
      .attr("fill", "#777777");
    xAxisG.selectAll("line").attr("stroke", "#d9d9d9");
    xAxisG.select(".domain").attr("stroke", "#d9d9d9");

    // Clickable neuron row labels strip on left
    const labelGroup = rootG.append("g").attr("class", "row-strip");
    for (let n = 0; n < numNeurons; n++) {
      const y = n * rowHeight;
      labelGroup
        .append("rect")
        .attr("class", `row-target row-${n}`)
        .attr("x", -margin.left)
        .attr("y", y)
        .attr("width", margin.left)
        .attr("height", rowHeight)
        .attr("fill", "transparent")
        .attr("cursor", "pointer")
        .on("click", (event) => {
          event.stopPropagation();
          const isShift = event.shiftKey;
          const last = lastClickedNeuronRef.current;
          lastClickedNeuronRef.current = n;
          setSelectedNeurons((prev) => {
            const set = new Set(prev);
            if (isShift) {
              const start = Math.min(last, n);
              const end = Math.max(last, n);
              for (let i = start; i <= end; i++) set.add(i);
              return Array.from(set).sort((a, b) => a - b);
            }
            if (set.has(n)) set.delete(n);
            else set.add(n);
            return Array.from(set).sort((a, b) => a - b);
          });
        });
    }

    // Stimulus onset vertical dashed lines + flag
    const stimGroup = rootG.append("g").attr("class", "stim-group");
    stims.forEach((onset) => {
      if (onset < tMin || onset > tMax) return;
      const sx = xScale(onset);
      stimGroup
        .append("line")
        .attr("x1", sx)
        .attr("x2", sx)
        .attr("y1", 0)
        .attr("y2", plotHeight)
        .attr("stroke", "#111111")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3 3");

      // Small flag triangle at top
      stimGroup
        .append("path")
        .attr("d", `M ${sx} 0 L ${sx + 6} 4 L ${sx} 8 Z`)
        .attr("fill", "#111111");

      stimGroup
        .append("text")
        .attr("x", sx + 2)
        .attr("y", -6)
        .attr("font-size", "9px")
        .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace")
        .attr("fill", "#777777")
        .text(`${onset}s`);
    });

    // Time window overlay & gestures
    const overlayG = rootG.append("g").attr("class", "overlay-group");

    // Shading rectangle inside window
    overlayG
      .append("rect")
      .attr("class", "window-shade")
      .attr("y", 0)
      .attr("height", plotHeight)
      .attr("fill", "#111111")
      .attr("opacity", 0.08)
      .attr("pointer-events", "none");

    // Left border
    overlayG
      .append("line")
      .attr("class", "handle-left")
      .attr("y1", 0)
      .attr("y2", plotHeight)
      .attr("stroke", "#111111")
      .attr("stroke-width", 1.5)
      .attr("pointer-events", "none");

    // Right border
    overlayG
      .append("line")
      .attr("class", "handle-right")
      .attr("y1", 0)
      .attr("y2", plotHeight)
      .attr("stroke", "#111111")
      .attr("stroke-width", 1.5)
      .attr("pointer-events", "none");

    // Handle dots at bottom
    overlayG
      .append("circle")
      .attr("class", "handle-left-dot")
      .attr("cy", plotHeight)
      .attr("r", 3.5)
      .attr("fill", "#111111")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.5)
      .attr("pointer-events", "none");

    overlayG
      .append("circle")
      .attr("class", "handle-right-dot")
      .attr("cy", plotHeight)
      .attr("r", 3.5)
      .attr("fill", "#111111")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.5)
      .attr("pointer-events", "none");

    // Callout numbers below axis
    overlayG
      .append("text")
      .attr("class", "axis-callout-left")
      .attr("font-size", "10px")
      .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace")
      .attr("fill", "#111111")
      .attr("font-weight", "600")
      .attr("text-anchor", "middle")
      .attr("pointer-events", "none");

    overlayG
      .append("text")
      .attr("class", "axis-callout-right")
      .attr("font-size", "10px")
      .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace")
      .attr("fill", "#111111")
      .attr("font-weight", "600")
      .attr("text-anchor", "middle")
      .attr("pointer-events", "none");

    // Drag hit-test elements
    const hitBody = overlayG
      .append("rect")
      .attr("class", "hit-body")
      .attr("y", 0)
      .attr("height", plotHeight)
      .attr("fill", "transparent")
      .attr("cursor", "grab");

    const hitLeft = overlayG
      .append("rect")
      .attr("class", "hit-left")
      .attr("y", 0)
      .attr("height", plotHeight)
      .attr("fill", "transparent")
      .attr("cursor", "ew-resize");

    const hitRight = overlayG
      .append("rect")
      .attr("class", "hit-right")
      .attr("y", 0)
      .attr("height", plotHeight)
      .attr("fill", "transparent")
      .attr("cursor", "ew-resize");

    // Global background catch-all for creating new window or shifting focus
    const bgHit = rootG
      .insert("rect", ":first-child")
      .attr("class", "bg-hit")
      .attr("x", 0)
      .attr("y", -margin.top)
      .attr("width", plotWidth)
      .attr("height", height)
      .attr("fill", "transparent")
      .attr("cursor", "crosshair");

    // Focus widget on click for keyboard control
    const ensureFocus = () => {
      if (wrapperRef.current) wrapperRef.current.focus();
    };

    // DRAG BEHAVIOR: Edge Left
    const dragLeft = d3.drag()
      .on("start", (event) => {
        event.sourceEvent.preventDefault();
        ensureFocus();
      })
      .on("drag", (event) => {
        const [px] = d3.pointer(event, rootG.node());
        const rawT = xScale.invert(px);
        const clampedT = Math.max(tMin, Math.min(tMax, rawT));
        const currentT1 = timeWindowRef.current[1];
        const next = [clampedT, currentT1];
        timeWindowRef.current = next;
        updateWindowOverlay(next[0], next[1]);
        renderRaster();
      })
      .on("end", () => {
        const [w0, w1] = timeWindowRef.current;
        const norm = [Math.min(w0, w1), Math.max(w0, w1)];
        setTimeWindow(norm);
      });
    hitLeft.call(dragLeft);

    // DRAG BEHAVIOR: Edge Right
    const dragRight = d3.drag()
      .on("start", (event) => {
        event.sourceEvent.preventDefault();
        ensureFocus();
      })
      .on("drag", (event) => {
        const [px] = d3.pointer(event, rootG.node());
        const rawT = xScale.invert(px);
        const clampedT = Math.max(tMin, Math.min(tMax, rawT));
        const currentT0 = timeWindowRef.current[0];
        const next = [currentT0, clampedT];
        timeWindowRef.current = next;
        updateWindowOverlay(next[0], next[1]);
        renderRaster();
      })
      .on("end", () => {
        const [w0, w1] = timeWindowRef.current;
        const norm = [Math.min(w0, w1), Math.max(w0, w1)];
        setTimeWindow(norm);
      });
    hitRight.call(dragRight);

    // DRAG BEHAVIOR: Body Move
    let bodyDragOffset = 0;
    const dragBody = d3.drag()
      .on("start", (event) => {
        event.sourceEvent.preventDefault();
        ensureFocus();
        hitBody.attr("cursor", "grabbing");
        const [px] = d3.pointer(event, rootG.node());
        const pointerT = xScale.invert(px);
        bodyDragOffset = pointerT - timeWindowRef.current[0];
      })
      .on("drag", (event) => {
        const [px] = d3.pointer(event, rootG.node());
        const pointerT = xScale.invert(px);
        const dur = timeWindowRef.current[1] - timeWindowRef.current[0];
        let next0 = pointerT - bodyDragOffset;
        let next1 = next0 + dur;
        if (next0 < tMin) {
          next0 = tMin;
          next1 = tMin + dur;
        }
        if (next1 > tMax) {
          next1 = tMax;
          next0 = tMax - dur;
        }
        timeWindowRef.current = [next0, next1];
        updateWindowOverlay(next0, next1);
        renderRaster();
      })
      .on("end", () => {
        hitBody.attr("cursor", "grab");
        setTimeWindow([...timeWindowRef.current]);
      });
    hitBody.call(dragBody);

    // DRAG BEHAVIOR: Background create new window
    let createOriginT = 0;
    const dragCreate = d3.drag()
      .on("start", (event) => {
        event.sourceEvent.preventDefault();
        ensureFocus();
        const [px] = d3.pointer(event, rootG.node());
        createOriginT = Math.max(tMin, Math.min(tMax, xScale.invert(px)));
        timeWindowRef.current = [createOriginT, createOriginT];
        updateWindowOverlay(createOriginT, createOriginT);
        renderRaster();
      })
      .on("drag", (event) => {
        const [px] = d3.pointer(event, rootG.node());
        const currT = Math.max(tMin, Math.min(tMax, xScale.invert(px)));
        const t0 = Math.min(createOriginT, currT);
        const t1 = Math.max(createOriginT, currT);
        timeWindowRef.current = [t0, t1];
        updateWindowOverlay(t0, t1);
        renderRaster();
      })
      .on("end", () => {
        let [w0, w1] = timeWindowRef.current;
        if (Math.abs(w1 - w0) < 0.05) {
          w1 = Math.min(tMax, w0 + 1.0);
          timeWindowRef.current = [w0, w1];
          updateWindowOverlay(w0, w1);
          renderRaster();
        }
        setTimeWindow([w0, w1]);
      });
    bgHit.call(dragCreate);

    updateWindowOverlay(timeWindowRef.current[0], timeWindowRef.current[1]);

    return () => {
      svg.selectAll("*").remove();
    };
  }, [xScale, plotHeight, plotWidth, numNeurons, rowHeight, stims, updateWindowOverlay, renderRaster]);

  React.useEffect(() => {
    updateWindowOverlay(timeWindow[0], timeWindow[1]);
  }, [timeWindow, updateWindowOverlay]);

  // Arrow key handling to shift window 100 ms
  const handleKeyDown = (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const shift = event.key === "ArrowLeft" ? -0.1 : 0.1;
      const [t0, t1] = timeWindowRef.current;
      const dur = t1 - t0;
      let n0 = t0 + shift;
      let n1 = t1 + shift;
      if (n0 < tMin) {
        n0 = tMin;
        n1 = tMin + dur;
      }
      if (n1 > tMax) {
        n1 = tMax;
        n0 = tMax - dur;
      }
      const updated = [Number(n0.toFixed(3)), Number(n1.toFixed(3))];
      timeWindowRef.current = updated;
      setTimeWindow(updated);
      updateWindowOverlay(updated[0], updated[1]);
      renderRaster();
    }
  };

  const handleShift = (dir) => {
    const shift = dir * 0.1;
    const [t0, t1] = timeWindowRef.current;
    const dur = t1 - t0;
    let n0 = t0 + shift;
    let n1 = t1 + shift;
    if (n0 < tMin) {
      n0 = tMin;
      n1 = tMin + dur;
    }
    if (n1 > tMax) {
      n1 = tMax;
      n0 = tMax - dur;
    }
    const updated = [Number(n0.toFixed(3)), Number(n1.toFixed(3))];
    timeWindowRef.current = updated;
    setTimeWindow(updated);
    updateWindowOverlay(updated[0], updated[1]);
    renderRaster();
  };

  const handleSelectAll = () => {
    const all = Array.from({ length: numNeurons }, (_, i) => i);
    setSelectedNeurons(all);
  };

  const handleSelectNone = () => {
    setSelectedNeurons([]);
  };

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        outline: "none",
        width: width,
        boxSizing: "border-box",
        padding: 12,
        background: "#ffffff",
        userSelect: "none",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <WindowControls
        React={React}
        windowRange={timeWindow}
        selectedCount={selectedNeurons.length}
        totalNeurons={numNeurons}
        onAll={handleSelectAll}
        onNone={handleSelectNone}
        onShiftLeft={() => handleShift(-1)}
        onShiftRight={() => handleShift(1)}
      />

      <div
        ref={containerRef}
        style={{
          position: "relative",
          width,
          height,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            left: margin.left,
            top: margin.top,
            pointerEvents: "none",
          }}
        />
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            display: "block",
          }}
        />
      </div>
    </div>
  );
}