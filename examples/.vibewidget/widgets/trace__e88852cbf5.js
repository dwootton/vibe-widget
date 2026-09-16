import * as d3 from "https://esm.sh/d3@7";

export const OverviewStrip = ({ React, signal, windowRange, onWindowChange, events, selectedEventId, width, height = 90 }) => {
  const canvasRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const isDraggingRef = React.useRef(null);

  const totalSamples = signal ? signal.length : 0;
  const totalDuration = totalSamples > 0 ? (totalSamples - 1) / 1000 : 200;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !signal || signal.length === 0 || width <= 0) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Compute global min / max for overview y-scale
    let gMin = -5.0;
    let gMax = 5.0;

    const padTop = 10;
    const padBottom = 16;
    const plotH = height - padTop - padBottom;
    const midY = padTop + plotH / 2;

    // Draw baseline
    ctx.strokeStyle = "#e8e8e8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // Envelope per pixel column
    const step = signal.length / width;
    ctx.fillStyle = "#111111";

    for (let x = 0; x < width; x++) {
      const startIdx = Math.floor(x * step);
      const endIdx = Math.min(signal.length, Math.floor((x + 1) * step));
      let minVal = Infinity;
      let maxVal = -Infinity;
      for (let i = startIdx; i < endIdx; i++) {
        const val = signal[i];
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
      if (minVal === Infinity) {
        minVal = 0;
        maxVal = 0;
      }
      const y1 = padTop + plotH * (1 - (maxVal - gMin) / (gMax - gMin));
      const y2 = padTop + plotH * (1 - (minVal - gMin) / (gMax - gMin));
      const barH = Math.max(1, y2 - y1);
      ctx.fillRect(x, y1, 1, barH);
    }

    // Border line bottom
    ctx.strokeStyle = "#d9d9d9";
    ctx.beginPath();
    ctx.moveTo(0, height - 0.5);
    ctx.lineTo(width, height - 0.5);
    ctx.stroke();
  }, [signal, width, height]);

  // Window handles and overlay
  const tScale = React.useMemo(() => {
    return d3.scaleLinear().domain([0, totalDuration]).range([0, width]);
  }, [totalDuration, width]);

  const x0 = Math.max(0, Math.min(width, tScale(windowRange[0])));
  const x1 = Math.max(0, Math.min(width, tScale(windowRange[1])));
  const boxW = Math.max(2, x1 - x0);

  const handlePointerDown = (type, e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const initRange = [...windowRange];
    isDraggingRef.current = { type, startX, initRange };

    const handlePointerMove = (moveEvt) => {
      if (!isDraggingRef.current) return;
      const { type: dragType, startX: sX, initRange: iRange } = isDraggingRef.current;
      const dx = moveEvt.clientX - sX;
      const dt = tScale.invert(dx) - tScale.invert(0);

      let newT0 = iRange[0];
      let newT1 = iRange[1];
      const minSpan = 0.05;

      if (dragType === "body") {
        const span = iRange[1] - iRange[0];
        newT0 = iRange[0] + dt;
        newT1 = iRange[1] + dt;
        if (newT0 < 0) {
          newT0 = 0;
          newT1 = span;
        }
        if (newT1 > totalDuration) {
          newT1 = totalDuration;
          newT0 = Math.max(0, totalDuration - span);
        }
      } else if (dragType === "left") {
        newT0 = Math.max(0, Math.min(iRange[1] - minSpan, iRange[0] + dt));
      } else if (dragType === "right") {
        newT1 = Math.min(totalDuration, Math.max(iRange[0] + minSpan, iRange[1] + dt));
      }

      onWindowChange([newT0, newT1]);
    };

    const handlePointerUp = () => {
      isDraggingRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: height,
        userSelect: "none",
        backgroundColor: "#ffffff",
        overflow: "hidden"
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: width,
          height: height,
          display: "block"
        }}
      />
      {/* Event ticks on overview */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: width,
          height: height,
          pointerEvents: "none"
        }}
      >
        {events.map((ev) => {
          const ex = tScale(ev.time);
          const isSel = ev.id === selectedEventId;
          return (
            <line
              key={ev.id}
              x1={ex}
              x2={ex}
              y1={2}
              y2={height - 2}
              stroke={isSel ? "#d9480f" : "#111111"}
              strokeWidth={isSel ? 2 : 1}
            />
          );
        })}
      </svg>
      {/* Dimmed backdrop outside active window */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: Math.max(0, x0),
          height: height,
          backgroundColor: "rgba(255, 255, 255, 0.72)",
          pointerEvents: "none"
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: x1,
          width: Math.max(0, width - x1),
          height: height,
          backgroundColor: "rgba(255, 255, 255, 0.72)",
          pointerEvents: "none"
        }}
      />
      {/* Draggable body */}
      <div
        onPointerDown={(e) => handlePointerDown("body", e)}
        style={{
          position: "absolute",
          top: 0,
          left: x0,
          width: boxW,
          height: height,
          cursor: "grab",
          borderTop: "1px solid #111111",
          borderBottom: "1px solid #111111",
          boxSizing: "border-box",
          backgroundColor: "rgba(17, 17, 17, 0.06)"
        }}
      />
      {/* Left handle */}
      <div
        onPointerDown={(e) => handlePointerDown("left", e)}
        style={{
          position: "absolute",
          top: 0,
          left: Math.max(0, x0 - 8),
          width: 16,
          height: height,
          cursor: "ew-resize",
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <div style={{ width: 2, height: "100%", backgroundColor: "#111111" }} />
      </div>
      {/* Right handle */}
      <div
        onPointerDown={(e) => handlePointerDown("right", e)}
        style={{
          position: "absolute",
          top: 0,
          left: Math.max(0, x1 - 8),
          width: 16,
          height: height,
          cursor: "ew-resize",
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <div style={{ width: 2, height: "100%", backgroundColor: "#111111" }} />
      </div>
      {/* Time indicators on handle caps */}
      <div
        style={{
          position: "absolute",
          top: 2,
          left: Math.max(2, x0 + 4),
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
          fontSize: 10,
          color: "#777777",
          pointerEvents: "none",
          fontVariantNumeric: "tabular-nums"
        }}
      >
        {windowRange[0].toFixed(2)}s
      </div>
      <div
        style={{
          position: "absolute",
          top: 2,
          right: Math.max(2, width - x1 + 4),
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
          fontSize: 10,
          color: "#777777",
          pointerEvents: "none",
          fontVariantNumeric: "tabular-nums"
        }}
      >
        {windowRange[1].toFixed(2)}s
      </div>
    </div>
  );
};

export const DetailView = ({
  React,
  signal,
  windowRange,
  events,
  selectedEventId,
  onSelectEvent,
  onAddEvent,
  width,
  height = 300
}) => {
  const canvasRef = React.useRef(null);
  const containerRef = React.useRef(null);

  const padLeft = 46;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 26;
  const plotW = Math.max(10, width - padLeft - padRight);
  const plotH = Math.max(10, height - padTop - padBottom);

  const [t0, t1] = windowRange;

  const sliceData = React.useMemo(() => {
    if (!signal || signal.length === 0) return { samples: [], yMin: -1, yMax: 1, s0: 0, s1: 0 };
    const s0 = Math.max(0, Math.floor(t0 * 1000));
    const s1 = Math.min(signal.length - 1, Math.ceil(t1 * 1000));
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let i = s0; i <= s1; i++) {
      const v = signal[i];
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }
    if (yMin === Infinity) {
      yMin = -1;
      yMax = 1;
    }
    if (yMax === yMin) {
      yMin -= 0.1;
      yMax += 0.1;
    }
    // 5% margin
    const pad = (yMax - yMin) * 0.05 || 0.1;
    return { s0, s1, yMin: yMin - pad, yMax: yMax + pad };
  }, [signal, t0, t1]);

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !signal || signal.length === 0 || width <= 0 || height <= 0) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const { s0, s1, yMin, yMax } = sliceData;

    // Scales
    const xScale = (t) => padLeft + ((t - t0) / (t1 - t0)) * plotW;
    const yScale = (v) => padTop + (1 - (v - yMin) / (yMax - yMin)) * plotH;

    // Horizontal grid & labels
    const yTicks = d3.ticks(yMin, yMax, 5);
    ctx.strokeStyle = "#f2f2f2";
    ctx.lineWidth = 1;
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#777777";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    yTicks.forEach((yt) => {
      const y = yScale(yt);
      if (y >= padTop && y <= padTop + plotH) {
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(padLeft + plotW, y);
        ctx.stroke();
        ctx.fillText(yt.toFixed(2), padLeft - 6, y);
      }
    });

    // Zero line if within domain
    if (yMin < 0 && yMax > 0) {
      const yZero = yScale(0);
      ctx.strokeStyle = "#d9d9d9";
      ctx.beginPath();
      ctx.moveTo(padLeft, yZero);
      ctx.lineTo(padLeft + plotW, yZero);
      ctx.stroke();
    }

    // Time ticks & labels
    const xTicks = d3.ticks(t0, t1, 6);
    ctx.strokeStyle = "#f2f2f2";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    xTicks.forEach((xt) => {
      const x = xScale(xt);
      if (x >= padLeft && x <= padLeft + plotW) {
        ctx.beginPath();
        ctx.moveTo(x, padTop);
        ctx.lineTo(x, padTop + plotH);
        ctx.stroke();
        ctx.fillText(xt.toFixed(3) + "s", x, padTop + plotH + 6);
      }
    });

    // Plot signal line
    ctx.save();
    ctx.beginPath();
    ctx.rect(padLeft, padTop, plotW, plotH);
    ctx.clip();

    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 1.25;
    ctx.lineJoin = "round";
    ctx.beginPath();

    for (let i = s0; i <= s1; i++) {
      const t = i / 1000;
      const x = xScale(t);
      const y = yScale(signal[i]);
      if (i === s0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // If points are sparse enough (< 100 samples), show vertex dots
    if (s1 - s0 < 100) {
      ctx.fillStyle = "#111111";
      for (let i = s0; i <= s1; i++) {
        const t = i / 1000;
        const x = xScale(t);
        const y = yScale(signal[i]);
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // Bounding hairline
    ctx.strokeStyle = "#d9d9d9";
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeft - 0.5, padTop - 0.5, plotW, plotH);
  }, [signal, sliceData, t0, t1, width, height, plotW, plotH]);

  const handleDoubleClick = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < padLeft || clickX > padLeft + plotW) return;
    const clickedT = t0 + ((clickX - padLeft) / plotW) * (t1 - t0);
    onAddEvent(clickedT);
  };

  return (
    <div
      ref={containerRef}
      onDoubleClick={handleDoubleClick}
      style={{
        position: "relative",
        width: "100%",
        height: height,
        userSelect: "none",
        backgroundColor: "#ffffff",
        overflow: "hidden"
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: width,
          height: height,
          display: "block"
        }}
      />
      {/* Overlay markers */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: width,
          height: height,
          pointerEvents: "none"
        }}
      >
        {events.map((ev) => {
          if (ev.time < t0 || ev.time > t1) return null;
          const x = padLeft + ((ev.time - t0) / (t1 - t0)) * plotW;
          const isSel = ev.id === selectedEventId;
          return (
            <g key={ev.id} style={{ pointerEvents: "auto", cursor: "pointer" }} onClick={() => onSelectEvent(ev.id)}>
              <line
                x1={x}
                x2={x}
                y1={padTop}
                y2={padTop + plotH}
                stroke={isSel ? "#d9480f" : "#111111"}
                strokeWidth={isSel ? 2 : 1}
                strokeDasharray={isSel ? undefined : "3 3"}
              />
              <circle
                cx={x}
                cy={padTop + 6}
                r={isSel ? 4.5 : 3.5}
                fill={isSel ? "#d9480f" : "#111111"}
                stroke="#ffffff"
                strokeWidth={1.5}
              />
              <text
                x={x + 5}
                y={padTop + 14}
                fontFamily="system-ui, -apple-system, sans-serif"
                fontSize={11}
                fontWeight={isSel ? 600 : 400}
                fill={isSel ? "#d9480f" : "#111111"}
              >
                {ev.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const EventList = ({ React, events, selectedId, onSelect, onDelete }) => {
  return (
    <div
      style={{
        width: 170,
        height: "100%",
        borderLeft: "1px solid #d9d9d9",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        boxSizing: "border-box"
      }}
    >
      <div
        style={{
          padding: "8px 10px",
          borderBottom: "1px solid #d9d9d9",
          fontSize: 11,
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#777777",
          display: "flex",
          justifyContent: "space-between"
        }}
      >
        <span>events ({events.length})</span>
        {selectedId !== null && (
          <span
            onClick={() => onDelete(selectedId)}
            style={{
              cursor: "pointer",
              color: "#c92a2a"
            }}
          >
            remove
          </span>
        )}
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
          fontSize: 11
        }}
      >
        {events.length === 0 ? (
          <div style={{ padding: "12px 10px", color: "#777777", fontStyle: "italic" }}>none</div>
        ) : (
          events.map((ev) => {
            const isSel = ev.id === selectedId;
            return (
              <div
                key={ev.id}
                onClick={() => onSelect(ev.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderBottom: "1px solid #f2f2f2",
                  cursor: "pointer",
                  backgroundColor: isSel ? "#111111" : "transparent",
                  color: isSel ? "#ffffff" : "#111111"
                }}
              >
                <span style={{ fontWeight: 600 }}>{ev.label}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{ev.time.toFixed(3)}s</span>
                <span
                  style={{
                    color: isSel ? "#ffffff" : "#777777",
                    fontVariantNumeric: "tabular-nums"
                  }}
                >
                  {ev.val.toFixed(2)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default function Widget({ model, React }) {
  const containerRef = React.useRef(null);
  const [dimensions, setDimensions] = React.useState({ width: 680, height: 420 });

  // Read data
  const rawData = model.get("data");
  const signal = React.useMemo(() => {
    if (!rawData) return new Float32Array(0);
    if (rawData.v && (Array.isArray(rawData.v) || ArrayBuffer.isView(rawData.v))) {
      return rawData.v;
    }
    if (Array.isArray(rawData)) {
      if (typeof rawData[0] === "number") return Float32Array.from(rawData);
      if (rawData[0] && typeof rawData[0].v === "number") {
        const arr = new Float32Array(rawData.length);
        for (let i = 0; i < rawData.length; i++) arr[i] = rawData[i].v;
        return arr;
      }
    }
    return new Float32Array(0);
  }, [rawData]);

  const totalDuration = signal.length > 0 ? (signal.length - 1) / 1000 : 200;

  // Window state
  const [windowRange, setWindowRange] = React.useState([0, 2]);
  const [events, setEvents] = React.useState([]);
  const [selectedEventId, setSelectedEventId] = React.useState(null);
  const nextIdRef = React.useRef(1);

  // Sync initial outputs
  React.useEffect(() => {
    model.set("window", [0, 2]);
    model.set("events", []);
    model.save_changes();
  }, []);

  // Sync window changes
  React.useEffect(() => {
    model.set("window", windowRange);
    model.save_changes();
  }, [windowRange]);

  // Sync event changes
  React.useEffect(() => {
    const times = events.map((e) => e.time);
    model.set("events", times);
    model.save_changes();
  }, [events]);

  // ResizeObserver for container
  React.useLayoutEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Arrow key navigation
  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const span = windowRange[1] - windowRange[0];
      const step = e.shiftKey ? span * 0.1 : span;
      const delta = e.key === "ArrowLeft" ? -step : step;
      let newT0 = windowRange[0] + delta;
      let newT1 = windowRange[1] + delta;
      if (newT0 < 0) {
        newT0 = 0;
        newT1 = span;
      }
      if (newT1 > totalDuration) {
        newT1 = totalDuration;
        newT0 = Math.max(0, totalDuration - span);
      }
      setWindowRange([newT0, newT1]);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedEventId !== null) {
        setEvents((prev) => prev.filter((ev) => ev.id !== selectedEventId));
        setSelectedEventId(null);
      }
    }
  };

  const handleAddEvent = (time) => {
    const idx = Math.max(0, Math.min(signal.length - 1, Math.round(time * 1000)));
    // Local peak search around click (+/- 25 samples = 25ms)
    let peakVal = signal[idx] || 0;
    let peakIdx = idx;
    const start = Math.max(0, idx - 25);
    const end = Math.min(signal.length - 1, idx + 25);
    let maxAbs = Math.abs(peakVal);
    for (let i = start; i <= end; i++) {
      const v = signal[i];
      if (Math.abs(v) > maxAbs) {
        maxAbs = Math.abs(v);
        peakVal = v;
        peakIdx = i;
      }
    }
    const peakTime = peakIdx / 1000;
    const newId = nextIdRef.current++;
    const newEvent = {
      id: newId,
      label: `#${newId}`,
      time: peakTime,
      val: peakVal
    };
    setEvents((prev) => [...prev, newEvent].sort((a, b) => a.time - b.time));
    setSelectedEventId(newId);
  };

  const handleSelectEvent = (id) => {
    setSelectedEventId(id);
    const ev = events.find((item) => item.id === id);
    if (ev) {
      const span = windowRange[1] - windowRange[0];
      let newT0 = ev.time - span / 2;
      let newT1 = ev.time + span / 2;
      if (newT0 < 0) {
        newT0 = 0;
        newT1 = span;
      }
      if (newT1 > totalDuration) {
        newT1 = totalDuration;
        newT0 = Math.max(0, totalDuration - span);
      }
      setWindowRange([newT0, newT1]);
    }
  };

  const handleDeleteEvent = (id) => {
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
    if (selectedEventId === id) setSelectedEventId(null);
  };

  const leftPlotWidth = Math.max(100, dimensions.width - 170);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={() => {
        if (containerRef.current) containerRef.current.focus();
      }}
      style={{
        outline: "none",
        width: "100%",
        height: 420,
        backgroundColor: "#ffffff",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "row",
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif"
      }}
    >
      <div
        style={{
          width: leftPlotWidth,
          height: "100%",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <OverviewStrip
          React={React}
          signal={signal}
          windowRange={windowRange}
          onWindowChange={setWindowRange}
          events={events}
          selectedEventId={selectedEventId}
          width={leftPlotWidth}
          height={90}
        />
        <DetailView
          React={React}
          signal={signal}
          windowRange={windowRange}
          events={events}
          selectedEventId={selectedEventId}
          onSelectEvent={handleSelectEvent}
          onAddEvent={handleAddEvent}
          width={leftPlotWidth}
          height={Math.max(200, dimensions.height - 90)}
        />
      </div>
      <EventList
        React={React}
        events={events}
        selectedId={selectedEventId}
        onSelect={handleSelectEvent}
        onDelete={handleDeleteEvent}
      />
    </div>
  );
}