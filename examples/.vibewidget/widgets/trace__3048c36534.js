import * as d3 from "https://esm.sh/d3@7";

// Helper to extract flat Float32Array from Pandas DataFrame representation
function extractSignal(data) {
  if (!data) return new Float32Array(0);
  if (data instanceof Float32Array) return data;
  if (Array.isArray(data)) {
    if (data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
      const arr = new Float32Array(data.length);
      for (let i = 0; i < data.length; i++) {
        arr[i] = data[i].v !== undefined ? data[i].v : 0;
      }
      return arr;
    }
    return new Float32Array(data);
  }
  if (typeof data === "object") {
    // Column format: { v: [...] } or { v: { '0': ..., '1': ... } }
    if (data.v) {
      if (Array.isArray(data.v) || data.v instanceof Float32Array) {
        return new Float32Array(data.v);
      }
      if (typeof data.v === "object") {
        const values = Object.values(data.v);
        return new Float32Array(values);
      }
    }
  }
  return new Float32Array(0);
}

// Standalone Event Marker Item
export const EventItem = ({ event, index, isSelected, onSelect, onDelete }) => {
  return (
    <div
      onClick={() => onSelect(event)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 10px",
        marginBottom: 6,
        borderRadius: 6,
        cursor: "pointer",
        backgroundColor: isSelected ? "#2d2a2e" : "rgba(255,255,255,0.7)",
        color: isSelected ? "#fdfbf7" : "#2d2a2e",
        border: isSelected ? "1px solid #2d2a2e" : "1px solid #e2ddd3",
        boxShadow: isSelected ? "0 2px 6px rgba(0,0,0,0.15)" : "none",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        fontSize: "12px",
        fontFamily: "'Fira Code', 'Pitch', monospace",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-block",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: isSelected ? "#e76f51" : "#2a9d8f",
            color: "#fff",
            fontSize: "10px",
            lineHeight: "18px",
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          {index + 1}
        </span>
        <span>{event.time.toFixed(3)}s</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ opacity: 0.85, fontSize: "11px" }}>
          pk: {event.peak.toFixed(2)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(event);
          }}
          title="Delete marker"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: isSelected ? "#f28e2b" : "#999",
            fontWeight: "bold",
            padding: "0 4px",
            fontSize: "14px",
            lineHeight: "1",
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default function Widget({ model, React }) {
  // Model state extraction
  const [dataVersion, setDataVersion] = React.useState(0);
  React.useEffect(() => {
    const handler = () => setDataVersion((v) => v + 1);
    model.on("change:data", handler);
    return () => model.off("change:data", handler);
  }, [model]);

  // Read data
  const rawData = model.get("data");
  const signal = React.useMemo(() => extractSignal(rawData), [rawData, dataVersion]);
  const totalSamples = signal.length || 200000;
  const sampleRate = 1000;
  const duration = totalSamples / sampleRate;

  // React state
  const [windowRange, setWindowRange] = React.useState([0, Math.min(2.0, duration || 2.0)]);
  const [events, setEvents] = React.useState([]); // array of { id, time, peak }
  const [selectedEventId, setSelectedEventId] = React.useState(null);

  // Sync state to Python traits on mount and change
  const windowRef = React.useRef(windowRange);
  windowRef.current = windowRange;

  const eventsRef = React.useRef(events);
  eventsRef.current = events;

  // Initialize and update output traits
  React.useEffect(() => {
    model.set("window", windowRange);
    model.set("events", events.map((e) => e.time));
    model.save_changes();
  }, [windowRange, events, model]);

  // Layout refs
  const rootRef = React.useRef(null);
  const overviewCanvasRef = React.useRef(null);
  const detailCanvasRef = React.useRef(null);
  const detailContainerRef = React.useRef(null);
  const overviewContainerRef = React.useRef(null);

  // Active interaction tracking refs
  const dragRef = React.useRef({
    type: null, // "pan", "left", "right"
    startX: 0,
    startWindow: [0, 2],
    active: false,
  });

  // Focus root for keyboard handling
  const focusWidget = () => {
    if (rootRef.current) {
      rootRef.current.focus();
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    const cur = windowRef.current;
    const wWidth = cur[1] - cur[0];
    const step = e.shiftKey ? wWidth * 0.1 : wWidth;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const n0 = Math.max(0, cur[0] - step);
      const n1 = n0 + wWidth;
      setWindowRange([n0, n1]);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const n1 = Math.min(duration, cur[1] + step);
      const n0 = Math.max(0, n1 - wWidth);
      setWindowRange([n0, n1]);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedEventId !== null) {
        e.preventDefault();
        setEvents((prev) => prev.filter((ev) => ev.id !== selectedEventId));
        setSelectedEventId(null);
      }
    }
  };

  // Precompute Overview Min/Max envelope buckets when signal changes
  const overviewBucketsRef = React.useRef(null);
  React.useEffect(() => {
    if (!signal || signal.length === 0) return;
    const bucketsCount = 2000;
    const step = signal.length / bucketsCount;
    const mins = new Float32Array(bucketsCount);
    const maxs = new Float32Array(bucketsCount);

    let gMin = Infinity;
    let gMax = -Infinity;

    for (let i = 0; i < bucketsCount; i++) {
      let startIdx = Math.floor(i * step);
      let endIdx = Math.min(signal.length, Math.floor((i + 1) * step));
      let minVal = signal[startIdx];
      let maxVal = signal[startIdx];
      for (let j = startIdx + 1; j < endIdx; j++) {
        const val = signal[j];
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
      mins[i] = minVal;
      maxs[i] = maxVal;
      if (minVal < gMin) gMin = minVal;
      if (maxVal > gMax) gMax = maxVal;
    }
    overviewBucketsRef.current = { mins, maxs, count: bucketsCount, gMin, gMax };
  }, [signal]);

  // Overview rendering function
  const renderOverview = React.useCallback(() => {
    const canvas = overviewCanvasRef.current;
    const container = overviewContainerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width) || 700;
    const height = Math.floor(rect.height) || 90;
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Background tint
    ctx.fillStyle = "#f5f0e6";
    ctx.fillRect(0, 0, width, height);

    const b = overviewBucketsRef.current;
    const yMin = b ? b.gMin : -5;
    const yMax = b ? b.gMax : 5;
    const yRange = (yMax - yMin) || 1;

    // Draw baseline
    const zeroY = height - ((0 - yMin) / yRange) * (height - 16) - 8;
    ctx.strokeStyle = "rgba(45, 42, 46, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(width, zeroY);
    ctx.stroke();

    // Draw Min/Max Envelope
    if (b) {
      ctx.fillStyle = "rgba(42, 157, 143, 0.65)";
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const bIdx = Math.floor((x / width) * b.count);
        const mn = b.mins[bIdx];
        const mx = b.maxs[bIdx];
        const pyTop = height - ((mx - yMin) / yRange) * (height - 18) - 9;
        const pyBottom = height - ((mn - yMin) / yRange) * (height - 18) - 9;
        ctx.rect(x, pyTop, 1, Math.max(1, pyBottom - pyTop));
      }
      ctx.fill();
    }

    // Draw Event Ticks
    eventsRef.current.forEach((ev, idx) => {
      const ex = (ev.time / duration) * width;
      const isSelected = ev.id === selectedEventId;
      ctx.fillStyle = isSelected ? "#e76f51" : "#264653";
      ctx.fillRect(ex - 1.5, 0, 3, height);
      // Small tick circle at top
      ctx.beginPath();
      ctx.arc(ex, 8, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Window / Brush Overlay
    const [w0, w1] = windowRef.current;
    const wx0 = Math.max(0, (w0 / duration) * width);
    const wx1 = Math.min(width, (w1 / duration) * width);
    const wWidth = Math.max(2, wx1 - wx0);

    // Dim out-of-window areas
    ctx.fillStyle = "rgba(45, 42, 46, 0.28)";
    ctx.fillRect(0, 0, wx0, height);
    ctx.fillRect(wx1, 0, width - wx1, height);

    // Window frame
    ctx.strokeStyle = "#e76f51";
    ctx.lineWidth = 2;
    ctx.strokeRect(wx0, 1, wWidth, height - 2);

    // Window background accent
    ctx.fillStyle = "rgba(231, 111, 81, 0.08)";
    ctx.fillRect(wx0, 1, wWidth, height - 2);

    // Grippers on handles
    const handleWidth = 6;
    ctx.fillStyle = "#e76f51";
    // Left handle
    ctx.fillRect(wx0 - 2, height / 2 - 12, 4, 24);
    // Right handle
    ctx.fillRect(wx1 - 2, height / 2 - 12, 4, 24);

    ctx.restore();
  }, [duration, selectedEventId]);

  // Detail rendering function
  const renderDetail = React.useCallback(() => {
    const canvas = detailCanvasRef.current;
    const container = detailContainerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width) || 700;
    const height = Math.floor(rect.height) || 300;
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const padLeft = 56;
    const padRight = 24;
    const padTop = 20;
    const padBottom = 36;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Draw Plot Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(padLeft, padTop, plotW, plotH);
    ctx.strokeStyle = "#e2ddd3";
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeft, padTop, plotW, plotH);

    const [t0, t1] = windowRef.current;
    const s0 = Math.max(0, Math.floor(t0 * sampleRate));
    const s1 = Math.min(totalSamples - 1, Math.ceil(t1 * sampleRate));
    const count = s1 - s0 + 1;

    // Find local y min & max
    let yMin = 0;
    let yMax = 0;
    if (signal && count > 0) {
      yMin = signal[s0];
      yMax = signal[s0];
      for (let i = s0; i <= s1; i++) {
        const v = signal[i];
        if (v < yMin) yMin = v;
        if (v > yMax) yMax = v;
      }
    }
    // Add margin to Y axis
    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    } else {
      const yPad = (yMax - yMin) * 0.1;
      yMin -= yPad;
      yMax += yPad;
    }

    // Scales
    const xScale = (t) => padLeft + ((t - t0) / (t1 - t0)) * plotW;
    const yScale = (v) => padTop + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    // Gridlines and Y Axis Ticks
    const yTicks = d3.ticks(yMin, yMax, 6);
    ctx.font = "10px 'Fira Code', 'Pitch', monospace";
    ctx.fillStyle = "#5c5855";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    yTicks.forEach((tick) => {
      const y = yScale(tick);
      if (y >= padTop && y <= padTop + plotH) {
        ctx.strokeStyle = tick === 0 ? "rgba(45, 42, 46, 0.4)" : "#ede8df";
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(padLeft + plotW, y);
        ctx.stroke();

        ctx.fillText(tick.toFixed(2), padLeft - 8, y);
      }
    });

    // Time Axis Ticks (X Axis)
    const xTicks = d3.ticks(t0, t1, 8);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    xTicks.forEach((tick) => {
      const x = xScale(tick);
      if (x >= padLeft && x <= padLeft + plotW) {
        ctx.strokeStyle = "#ede8df";
        ctx.beginPath();
        ctx.moveTo(x, padTop);
        ctx.lineTo(x, padTop + plotH);
        ctx.stroke();

        ctx.fillText(`${tick.toFixed(3)}s`, x, padTop + plotH + 8);
      }
    });

    // Draw raw samples clip
    ctx.save();
    ctx.beginPath();
    ctx.rect(padLeft, padTop, plotW, plotH);
    ctx.clip();

    if (signal && count > 0) {
      ctx.strokeStyle = "#2b5c8f";
      ctx.lineWidth = 1.25;
      ctx.beginPath();

      let started = false;
      for (let i = s0; i <= s1; i++) {
        const t = i / sampleRate;
        const x = xScale(t);
        const y = yScale(signal[i]);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // If zoomed in enough, draw sample points
      if (count <= 250) {
        ctx.fillStyle = "#e76f51";
        for (let i = s0; i <= s1; i++) {
          const t = i / sampleRate;
          const x = xScale(t);
          const y = yScale(signal[i]);
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw Event Markers in detail view
    eventsRef.current.forEach((ev, idx) => {
      if (ev.time >= t0 && ev.time <= t1) {
        const x = xScale(ev.time);
        const isSelected = ev.id === selectedEventId;

        ctx.strokeStyle = isSelected ? "#e76f51" : "#2a9d8f";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x, padTop);
        ctx.lineTo(x, padTop + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Number pill badge at top of line
        const badgeColor = isSelected ? "#e76f51" : "#2a9d8f";
        ctx.fillStyle = badgeColor;
        ctx.beginPath();
        ctx.roundRect(x - 10, padTop + 4, 20, 16, 4);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px 'Fira Code', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${idx + 1}`, x, padTop + 12);
      }
    });

    ctx.restore(); // restore clip

    // Y Axis unit label
    ctx.save();
    ctx.translate(14, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.fillStyle = "#2d2a2e";
    ctx.fillText("Voltage (v)", 0, 0);
    ctx.restore();

    ctx.restore();
  }, [signal, totalSamples, sampleRate, selectedEventId]);

  // LayoutEffect: sizing & immediate first paint on mount & resize
  React.useLayoutEffect(() => {
    let animId;
    const updateSize = () => {
      renderOverview();
      renderDetail();
    };

    updateSize();

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(animId);
      animId = requestAnimationFrame(updateSize);
    });

    if (rootRef.current) ro.observe(rootRef.current);
    if (detailContainerRef.current) ro.observe(detailContainerRef.current);
    if (overviewContainerRef.current) ro.observe(overviewContainerRef.current);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(animId);
    };
  }, [renderOverview, renderDetail]);

  // Re-render canvases when window or events change
  React.useEffect(() => {
    renderOverview();
    renderDetail();
  }, [windowRange, events, selectedEventId, renderOverview, renderDetail]);

  // Double-click in Detail view to add marker
  const handleDetailDoubleClick = (e) => {
    focusWidget();
    const container = detailContainerRef.current;
    if (!container || !signal) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padLeft = 56;
    const padRight = 24;
    const plotW = rect.width - padLeft - padRight;

    if (mouseX < padLeft || mouseX > padLeft + plotW) return;

    const [t0, t1] = windowRef.current;
    const clickTime = t0 + ((mouseX - padLeft) / plotW) * (t1 - t0);

    // Compute local peak in neighborhood (+- 25 samples)
    const centerSample = Math.round(clickTime * sampleRate);
    const searchRadius = 25;
    const minS = Math.max(0, centerSample - searchRadius);
    const maxS = Math.min(signal.length - 1, centerSample + searchRadius);

    let maxAbs = -Infinity;
    let peakVal = 0;
    let peakTime = clickTime;

    for (let s = minS; s <= maxS; s++) {
      const val = signal[s];
      if (Math.abs(val) > maxAbs) {
        maxAbs = Math.abs(val);
        peakVal = val;
        peakTime = s / sampleRate;
      }
    }

    const newMarker = {
      id: "ev_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      time: peakTime,
      peak: peakVal,
    };

    setEvents((prev) => [...prev, newMarker]);
    setSelectedEventId(newMarker.id);
  };

  // Overview Drag Interactions (pan & resize handles)
  const handleOverviewPointerDown = (e) => {
    focusWidget();
    const container = overviewContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const [w0, w1] = windowRef.current;
    const wx0 = (w0 / duration) * width;
    const wx1 = (w1 / duration) * width;

    const hitThreshold = 10;
    let type = null;

    if (Math.abs(clickX - wx0) <= hitThreshold) {
      type = "left";
    } else if (Math.abs(clickX - wx1) <= hitThreshold) {
      type = "right";
    } else if (clickX > wx0 && clickX < wx1) {
      type = "pan";
    } else {
      // Click outside centers window around click
      const clickTime = (clickX / width) * duration;
      const wSpan = w1 - w0;
      let newW0 = Math.max(0, clickTime - wSpan / 2);
      let newW1 = newW0 + wSpan;
      if (newW1 > duration) {
        newW1 = duration;
        newW0 = Math.max(0, newW1 - wSpan);
      }
      setWindowRange([newW0, newW1]);
      type = "pan";
    }

    dragRef.current = {
      type,
      startX: e.clientX,
      startWindow: [...windowRef.current],
      active: true,
    };

    const handlePointerMove = (moveEv) => {
      if (!dragRef.current.active) return;
      const dx = moveEv.clientX - dragRef.current.startX;
      const dt = (dx / width) * duration;
      const [sw0, sw1] = dragRef.current.startWindow;
      const minSpan = 0.01;

      if (dragRef.current.type === "pan") {
        let nw0 = sw0 + dt;
        let nw1 = sw1 + dt;
        const span = sw1 - sw0;
        if (nw0 < 0) {
          nw0 = 0;
          nw1 = span;
        }
        if (nw1 > duration) {
          nw1 = duration;
          nw0 = Math.max(0, duration - span);
        }
        setWindowRange([nw0, nw1]);
      } else if (dragRef.current.type === "left") {
        let nw0 = Math.max(0, Math.min(sw1 - minSpan, sw0 + dt));
        setWindowRange([nw0, sw1]);
      } else if (dragRef.current.type === "right") {
        let nw1 = Math.min(duration, Math.max(sw0 + minSpan, sw1 + dt));
        setWindowRange([sw0, nw1]);
      }
    };

    const handlePointerUp = () => {
      dragRef.current.active = false;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  // Jump window to an event
  const jumpToEvent = (ev) => {
    setSelectedEventId(ev.id);
    const span = windowRange[1] - windowRange[0];
    let nw0 = Math.max(0, ev.time - span / 2);
    let nw1 = nw0 + span;
    if (nw1 > duration) {
      nw1 = duration;
      nw0 = Math.max(0, nw1 - span);
    }
    setWindowRange([nw0, nw1]);
    focusWidget();
  };

  const deleteEvent = (ev) => {
    setEvents((prev) => prev.filter((item) => item.id !== ev.id));
    if (selectedEventId === ev.id) {
      setSelectedEventId(null);
    }
    focusWidget();
  };

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        outline: "none",
        backgroundColor: "#fdfbf7",
        color: "#2d2a2e",
        fontFamily: "'Playfair Display', Georgia, serif",
        padding: "20px 24px",
        borderRadius: 10,
        boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
        boxSizing: "border-box",
        maxWidth: 1080,
        margin: "0 auto",
      }}
    >
      {/* Header story text */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
              letterSpacing: "-0.01em",
              fontWeight: 700,
              color: "#1f1d1f",
            }}
          >
            Signal Observatory
          </h2>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: "12px",
              fontFamily: "system-ui, sans-serif",
              color: "#6c6660",
            }}
          >
            200,000 samples @ 1,000 Hz (200.0s recording). Scrub or drag edges to zoom. Double-click in detail to mark events.
          </p>
        </div>
        <div
          style={{
            fontSize: "11px",
            fontFamily: "'Fira Code', monospace",
            background: "#efeae1",
            padding: "4px 8px",
            borderRadius: 4,
            color: "#4a453f",
          }}
        >
          window: {windowRange[0].toFixed(3)}s – {windowRange[1].toFixed(3)}s ({(windowRange[1] - windowRange[0]).toFixed(3)}s)
        </div>
      </div>

      {/* Main Grid: Overview + Detail on left, Events list on right */}
      <div style={{ display: "flex", gap: 20 }}>
        {/* Left Visualizations */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top Overview Canvas */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "11px",
                fontFamily: "system-ui, sans-serif",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#7e7871",
                marginBottom: 4,
              }}
            >
              <span>Whole Recording Envelope</span>
              <span>0.000s → {duration.toFixed(1)}s</span>
            </div>
            <div
              ref={overviewContainerRef}
              onPointerDown={handleOverviewPointerDown}
              style={{
                height: 90,
                width: "100%",
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid #d9d2c5",
                cursor: "ew-resize",
                position: "relative",
              }}
            >
              <canvas
                ref={overviewCanvasRef}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </div>
          </div>

          {/* Bottom Detail Canvas */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "11px",
                fontFamily: "system-ui, sans-serif",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#7e7871",
                marginBottom: 4,
              }}
            >
              <span>Window Detail (All Raw Samples)</span>
              <span>
                Use ← / → to step, Shift + ← / → to scrub fine, DblClick to mark
              </span>
            </div>
            <div
              ref={detailContainerRef}
              onDoubleClick={handleDetailDoubleClick}
              onClick={focusWidget}
              style={{
                height: 300,
                width: "100%",
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid #d9d2c5",
                background: "#ffffff",
                cursor: "crosshair",
              }}
            >
              <canvas
                ref={detailCanvasRef}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </div>
          </div>
        </div>

        {/* Right Event Markers Panel */}
        <div
          style={{
            width: 220,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            borderLeft: "1px solid #e2ddd3",
            paddingLeft: 16,
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontFamily: "system-ui, sans-serif",
              fontWeight: "600",
              color: "#2d2a2e",
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Events ({events.length})</span>
            {events.length > 0 && (
              <span
                style={{
                  fontSize: "10px",
                  color: "#999",
                  fontWeight: "normal",
                }}
              >
                Del to remove
              </span>
            )}
          </div>

          <div
            style={{
              flex: 1,
              maxHeight: 390,
              overflowY: "auto",
              paddingRight: 4,
            }}
          >
            {events.length === 0 ? (
              <div
                style={{
                  padding: "24px 8px",
                  textAlign: "center",
                  fontSize: "12px",
                  fontFamily: "system-ui, sans-serif",
                  color: "#9e968c",
                  fontStyle: "italic",
                }}
              >
                Double-click on the detail chart to place peak markers.
              </div>
            ) : (
              events.map((ev, idx) => (
                <EventItem
                  key={ev.id}
                  event={ev}
                  index={idx}
                  isSelected={ev.id === selectedEventId}
                  onSelect={jumpToEvent}
                  onDelete={deleteEvent}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}