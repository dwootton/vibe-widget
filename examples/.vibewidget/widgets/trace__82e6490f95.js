import * as d3 from "https://esm.sh/d3@7";

// Standalone Event List Component
export const EventList = ({
  events = [],
  activeEventIndex,
  onSelectEvent,
  onDeleteEvent,
  React,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
        background: "rgba(255, 255, 255, 0.7)",
        backdropFilter: "blur(6px)",
        borderRadius: "8px",
        border: "1px solid rgba(220, 215, 205, 0.8)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid rgba(220, 215, 205, 0.6)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#faf7f2",
        }}
      >
        <span
          style={{
            fontFamily: "serif",
            fontWeight: 700,
            fontSize: "14px",
            color: "#2a2825",
            letterSpacing: "0.02em",
          }}
        >
          Markers ({events.length})
        </span>
        <span
          style={{
            fontSize: "11px",
            color: "#7e786e",
            fontFamily: "monospace",
          }}
        >
          [Del] removes
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "6px 8px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {events.length === 0 ? (
          <div
            style={{
              padding: "24px 12px",
              textAlign: "center",
              color: "#9c9488",
              fontSize: "12px",
              fontStyle: "italic",
              fontFamily: "serif",
            }}
          >
            Double-click detail canvas to place markers
          </div>
        ) : (
          events.map((ev, idx) => {
            const isSelected = activeEventIndex === idx;
            return (
              <div
                key={ev.id || idx}
                onClick={() => onSelectEvent(idx)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  background: isSelected ? "#2a2825" : "rgba(255,255,255,0.6)",
                  color: isSelected ? "#fcfbf7" : "#2a2825",
                  border: isSelected
                    ? "1px solid #111"
                    : "1px solid rgba(230, 225, 218, 0.8)",
                  transition: "all 0.15s ease",
                  boxShadow: isSelected
                    ? "0 2px 6px rgba(0,0,0,0.12)"
                    : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      fontSize: "10px",
                      fontWeight: 600,
                      background: isSelected ? "#d9534f" : "#e4ded4",
                      color: isSelected ? "#fff" : "#4a453f",
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span>{ev.time.toFixed(3)}s</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      color: isSelected ? "#f3b582" : "#995220",
                    }}
                  >
                    {ev.val !== undefined ? `${ev.val.toFixed(2)}` : ""}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteEvent(idx);
                    }}
                    title="Remove marker"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "0 4px",
                      color: isSelected ? "#e09f9f" : "#a89b91",
                      fontSize: "14px",
                      lineHeight: "1",
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default function SignalOverviewDetail({ model, React }) {
  // Extract inputs
  const rawData = model.get("data");
  
  // Extract signal values into Float32Array
  const signalArray = React.useMemo(() => {
    if (!rawData) return new Float32Array(0);
    if (Array.isArray(rawData)) {
      const arr = new Float32Array(rawData.length);
      for (let i = 0; i < rawData.length; i++) {
        arr[i] = rawData[i]?.v ?? rawData[i] ?? 0;
      }
      return arr;
    }
    if (rawData.v && (Array.isArray(rawData.v) || ArrayBuffer.isView(rawData.v))) {
      return new Float32Array(rawData.v);
    }
    return new Float32Array(0);
  }, [rawData]);

  const totalSamples = signalArray.length;
  const sampleRate = 1000;
  const duration = totalSamples > 0 ? (totalSamples - 1) / sampleRate : 200;

  // Window state [t0, t1] in seconds
  const [windowRange, setWindowRange] = React.useState([0, 2]);
  const [events, setEvents] = React.useState([]);
  const [activeEventIndex, setActiveEventIndex] = React.useState(null);

  const containerRef = React.useRef(null);
  const overviewCanvasRef = React.useRef(null);
  const detailCanvasRef = React.useRef(null);
  const rootRef = React.useRef(null);

  // Sync state to ref for native event handlers
  const windowRef = React.useRef(windowRange);
  windowRef.current = windowRange;

  const eventsRef = React.useRef(events);
  eventsRef.current = events;

  const activeEventRef = React.useRef(activeEventIndex);
  activeEventRef.current = activeEventIndex;

  // Layout dimensions
  const [dimensions, setDimensions] = React.useState({ width: 680 });

  // Initialize and push model outputs
  React.useEffect(() => {
    model.set("window", [0, 2]);
    model.set("events", []);
    model.save_changes();
  }, []);

  const updateWindow = React.useCallback((newWin) => {
    let [w0, w1] = newWin;
    const minSpan = 0.05; // 50ms min window
    let span = Math.max(minSpan, w1 - w0);
    
    if (w0 < 0) {
      w0 = 0;
      w1 = w0 + span;
    }
    if (w1 > duration) {
      w1 = duration;
      w0 = Math.max(0, w1 - span);
    }
    const validated = [w0, w1];
    setWindowRange(validated);
    model.set("window", validated);
    model.save_changes();
  }, [duration, model]);

  const updateEvents = React.useCallback((newEvents) => {
    setEvents(newEvents);
    model.set("events", newEvents.map((e) => e.time));
    model.save_changes();
  }, [model]);

  // Handle ResizeObserver
  React.useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 100) {
          setDimensions({ width: w });
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Listen for trait changes from Python
  React.useEffect(() => {
    const handleWindowChange = () => {
      const remoteWin = model.get("window");
      if (
        remoteWin &&
        remoteWin.length === 2 &&
        (remoteWin[0] !== windowRef.current[0] || remoteWin[1] !== windowRef.current[1])
      ) {
        setWindowRange(remoteWin);
      }
    };
    const handleEventsChange = () => {
      const remoteEvents = model.get("events");
      if (Array.isArray(remoteEvents)) {
        // rebuild events if array of floats
        const evs = remoteEvents.map((t, idx) => {
          const sampleIdx = Math.max(0, Math.min(totalSamples - 1, Math.round(t * sampleRate)));
          return { id: idx + "_" + t, time: t, val: signalArray[sampleIdx] ?? 0 };
        });
        setEvents(evs);
      }
    };

    model.on("change:window", handleWindowChange);
    model.on("change:events", handleEventsChange);
    return () => {
      model.off("change:window", handleWindowChange);
      model.off("change:events", handleEventsChange);
    };
  }, [model, signalArray, totalSamples, sampleRate]);

  // Overview Envelope Calculation
  const overviewEnvelope = React.useMemo(() => {
    const w = Math.max(10, Math.floor(dimensions.width));
    if (totalSamples === 0) return { mins: new Float32Array(w), maxs: new Float32Array(w) };
    const mins = new Float32Array(w);
    const maxs = new Float32Array(w);
    const samplesPerPixel = totalSamples / w;

    for (let px = 0; px < w; px++) {
      const start = Math.floor(px * samplesPerPixel);
      const end = Math.min(totalSamples, Math.ceil((px + 1) * samplesPerPixel));
      let minVal = Infinity;
      let maxVal = -Infinity;
      for (let i = start; i < end; i++) {
        const v = signalArray[i];
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
      if (minVal === Infinity) {
        minVal = 0;
        maxVal = 0;
      }
      mins[px] = minVal;
      maxs[px] = maxVal;
    }
    return { mins, maxs, width: w };
  }, [signalArray, dimensions.width, totalSamples]);

  // Render Overview Canvas
  React.useEffect(() => {
    const canvas = overviewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (totalSamples === 0) return;

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#fbf9f5");
    bgGrad.addColorStop(1, "#f3eee5");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Gridlines for overview
    ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Global min/max
    let globalMin = -5.1;
    let globalMax = 5.1;
    const valRange = globalMax - globalMin || 1;

    // Draw min/max envelope
    const { mins, maxs } = overviewEnvelope;
    ctx.fillStyle = "rgba(74, 93, 110, 0.4)";
    ctx.strokeStyle = "#324353";
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const yMax = height - ((maxs[x] - globalMin) / valRange) * height;
      if (x === 0) ctx.moveTo(x, yMax);
      else ctx.lineTo(x, yMax);
    }
    for (let x = width - 1; x >= 0; x--) {
      const yMin = height - ((mins[x] - globalMin) / valRange) * height;
      ctx.lineTo(x, yMin);
    }
    ctx.closePath();
    ctx.fill();

    // Overview window highlight
    const [w0, w1] = windowRange;
    const x0 = (w0 / duration) * width;
    const x1 = (w1 / duration) * width;

    // Shaded mask outside window
    ctx.fillStyle = "rgba(235, 230, 220, 0.55)";
    ctx.fillRect(0, 0, Math.max(0, x0), height);
    ctx.fillRect(x1, 0, Math.max(0, width - x1), height);

    // Window selection fill & border
    ctx.fillStyle = "rgba(227, 98, 63, 0.12)";
    ctx.fillRect(x0, 0, Math.max(1, x1 - x0), height);

    ctx.strokeStyle = "#c84e2a";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0, 0.5, Math.max(1, x1 - x0), height - 1);

    // Window edge handles
    ctx.fillStyle = "#c84e2a";
    const handleW = 3;
    ctx.fillRect(x0 - handleW / 2, 0, handleW, height);
    ctx.fillRect(x1 - handleW / 2, 0, handleW, height);

    // Event ticks on overview
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const evX = (ev.time / duration) * width;
      const isSelected = activeEventIndex === i;

      ctx.strokeStyle = isSelected ? "#e63946" : "rgba(30, 30, 30, 0.7)";
      ctx.lineWidth = isSelected ? 2 : 1.2;
      ctx.beginPath();
      ctx.moveTo(evX, 0);
      ctx.lineTo(evX, height);
      ctx.stroke();

      // Top triangle marker
      ctx.fillStyle = isSelected ? "#e63946" : "#444";
      ctx.beginPath();
      ctx.moveTo(evX - 3, 0);
      ctx.lineTo(evX + 3, 0);
      ctx.lineTo(evX, 5);
      ctx.closePath();
      ctx.fill();
    }
  }, [overviewEnvelope, windowRange, events, activeEventIndex, duration, totalSamples]);

  // Detail Canvas Rendering
  React.useEffect(() => {
    const canvas = detailCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (totalSamples === 0) return;

    const [w0, w1] = windowRange;
    const i0 = Math.max(0, Math.floor(w0 * sampleRate));
    const i1 = Math.min(totalSamples - 1, Math.ceil(w1 * sampleRate));

    // Dynamic Y fitting for window data
    let localMin = Infinity;
    let localMax = -Infinity;
    for (let i = i0; i <= i1; i++) {
      const v = signalArray[i];
      if (v < localMin) localMin = v;
      if (v > localMax) localMax = v;
    }

    if (localMin === Infinity || localMax === -Infinity) {
      localMin = -1;
      localMax = 1;
    }
    const margin = (localMax - localMin) * 0.12 || 0.5;
    const yMin = localMin - margin;
    const yMax = localMax + margin;
    const yRange = yMax - yMin;

    const padLeft = 46;
    const padRight = 14;
    const padTop = 14;
    const padBottom = 26;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Background
    ctx.fillStyle = "#fdfcf9";
    ctx.fillRect(0, 0, width, height);

    // Plot area background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(padLeft, padTop, plotW, plotH);

    // Gridlines & Y-axis labels
    ctx.font = "10px 'SF Mono', Monaco, Consolas, monospace";
    ctx.fillStyle = "#7a7469";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const yTicks = d3.ticks(yMin, yMax, 6);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
    ctx.lineWidth = 1;

    for (const tick of yTicks) {
      const py = padTop + plotH - ((tick - yMin) / yRange) * plotH;
      if (py < padTop || py > padTop + plotH) continue;
      ctx.beginPath();
      ctx.moveTo(padLeft, py);
      ctx.lineTo(padLeft + plotW, py);
      ctx.stroke();
      ctx.fillText(tick.toFixed(2), padLeft - 6, py);
    }

    // Zero-line if present in range
    if (yMin <= 0 && yMax >= 0) {
      const py0 = padTop + plotH - ((0 - yMin) / yRange) * plotH;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
      ctx.beginPath();
      ctx.moveTo(padLeft, py0);
      ctx.lineTo(padLeft + plotW, py0);
      ctx.stroke();
    }

    // X-axis time ticks
    const xTicks = d3.ticks(w0, w1, 8);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const xt of xTicks) {
      const px = padLeft + ((xt - w0) / (w1 - w0)) * plotW;
      if (px < padLeft || px > padLeft + plotW) continue;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
      ctx.beginPath();
      ctx.moveTo(px, padTop);
      ctx.lineTo(px, padTop + plotH);
      ctx.stroke();
      ctx.fillText(xt.toFixed(3) + "s", px, padTop + plotH + 6);
    }

    // Raw samples inside window
    ctx.save();
    ctx.beginPath();
    ctx.rect(padLeft, padTop, plotW, plotH);
    ctx.clip();

    ctx.strokeStyle = "#1b384f";
    ctx.lineWidth = 1.3;
    ctx.lineJoin = "round";
    ctx.beginPath();

    const span = w1 - w0 || 1;
    let started = false;
    for (let i = i0; i <= i1; i++) {
      const t = i / sampleRate;
      const v = signalArray[i];
      const px = padLeft + ((t - w0) / span) * plotW;
      const py = padTop + plotH - ((v - yMin) / yRange) * plotH;

      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    // Sample points dots if zoomed closely (less than 200 samples visible)
    if (i1 - i0 < 200) {
      ctx.fillStyle = "#c84e2a";
      for (let i = i0; i <= i1; i++) {
        const t = i / sampleRate;
        const v = signalArray[i];
        const px = padLeft + ((t - w0) / span) * plotW;
        const py = padTop + plotH - ((v - yMin) / yRange) * plotH;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Render Event Markers in Detail view
    events.forEach((ev, idx) => {
      if (ev.time >= w0 && ev.time <= w1) {
        const px = padLeft + ((ev.time - w0) / span) * plotW;
        const isSelected = activeEventIndex === idx;

        ctx.strokeStyle = isSelected ? "#dc3545" : "#55524e";
        ctx.lineWidth = isSelected ? 2 : 1.2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(px, padTop);
        ctx.lineTo(px, padTop + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Marker badge at top
        ctx.fillStyle = isSelected ? "#dc3545" : "#3e3b38";
        ctx.beginPath();
        ctx.arc(px, padTop + 9, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(idx + 1), px, padTop + 9);
      }
    });

    ctx.restore();

    // Border around plot area
    ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeft, padTop, plotW, plotH);
  }, [windowRange, events, activeEventIndex, signalArray, totalSamples, sampleRate]);

  // Overview Drag / Scrub / Resize interaction
  React.useEffect(() => {
    const canvas = overviewCanvasRef.current;
    if (!canvas) return;

    let dragMode = null; // 'move' | 'left' | 'right' | null
    let startX = 0;
    let startW0 = 0;
    let startW1 = 0;

    const getMode = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const w = canvas.width;
      const [w0, w1] = windowRef.current;
      const x0 = (w0 / duration) * w;
      const x1 = (w1 / duration) * w;
      const hitMargin = 8;

      if (Math.abs(x - x0) <= hitMargin) return "left";
      if (Math.abs(x - x1) <= hitMargin) return "right";
      if (x >= x0 && x <= x1) return "move";
      return null;
    };

    const handlePointerDown = (e) => {
      if (rootRef.current) rootRef.current.focus();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      startX = x;
      const [w0, w1] = windowRef.current;
      startW0 = w0;
      startW1 = w1;

      let mode = getMode(e);
      if (!mode) {
        // Clicked outside: center window at click point
        const clickedTime = (x / canvas.width) * duration;
        const currentSpan = w1 - w0;
        const half = currentSpan / 2;
        updateWindow([clickedTime - half, clickedTime + half]);
        mode = "move";
        startW0 = clickedTime - half;
        startW1 = clickedTime + half;
      }
      dragMode = mode;
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    };

    const handlePointerMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;

      if (!dragMode) {
        const mode = getMode(e);
        if (mode === "left" || mode === "right") {
          canvas.style.cursor = "ew-resize";
        } else if (mode === "move") {
          canvas.style.cursor = "grab";
        } else {
          canvas.style.cursor = "pointer";
        }
        return;
      }

      canvas.style.cursor = dragMode === "move" ? "grabbing" : "ew-resize";
      const dxPixels = x - startX;
      const dt = (dxPixels / canvas.width) * duration;

      if (dragMode === "move") {
        updateWindow([startW0 + dt, startW1 + dt]);
      } else if (dragMode === "left") {
        const newW0 = Math.min(startW1 - 0.05, startW0 + dt);
        updateWindow([newW0, startW1]);
      } else if (dragMode === "right") {
        const newW1 = Math.max(startW0 + 0.05, startW1 + dt);
        updateWindow([startW0, newW1]);
      }
    };

    const handlePointerUp = (e) => {
      dragMode = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [duration, updateWindow]);

  // Detail double-click to drop marker & single-click to select marker
  React.useEffect(() => {
    const canvas = detailCanvasRef.current;
    if (!canvas) return;

    const handleDblClick = (e) => {
      if (rootRef.current) rootRef.current.focus();
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const padLeft = 46;
      const padRight = 14;
      const plotW = canvas.width - padLeft - padRight;
      if (clickX < padLeft || clickX > padLeft + plotW) return;

      const [w0, w1] = windowRef.current;
      const t = w0 + ((clickX - padLeft) / plotW) * (w1 - w0);

      // Search local peak in a ±15 sample vicinity
      const centerIdx = Math.max(0, Math.min(totalSamples - 1, Math.round(t * sampleRate)));
      let bestIdx = centerIdx;
      let maxAbs = Math.abs(signalArray[centerIdx] || 0);

      const rad = 15;
      for (let i = Math.max(0, centerIdx - rad); i <= Math.min(totalSamples - 1, centerIdx + rad); i++) {
        const absVal = Math.abs(signalArray[i]);
        if (absVal > maxAbs) {
          maxAbs = absVal;
          bestIdx = i;
        }
      }

      const peakTime = bestIdx / sampleRate;
      const peakVal = signalArray[bestIdx];

      const newEv = {
        id: Date.now() + "_" + Math.random(),
        time: peakTime,
        val: peakVal,
      };

      const nextEvents = [...eventsRef.current, newEv].sort((a, b) => a.time - b.time);
      updateEvents(nextEvents);
      setActiveEventIndex(nextEvents.findIndex((e) => e.id === newEv.id));
    };

    const handleClick = (e) => {
      if (rootRef.current) rootRef.current.focus();
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const padLeft = 46;
      const padRight = 14;
      const plotW = canvas.width - padLeft - padRight;
      if (clickX < padLeft || clickX > padLeft + plotW) return;

      const [w0, w1] = windowRef.current;
      const clickTime = w0 + ((clickX - padLeft) / plotW) * (w1 - w0);

      // Check if clicked near an existing event (within 10 pixels)
      const pxPerSec = plotW / (w1 - w0);
      let foundIdx = null;
      eventsRef.current.forEach((ev, idx) => {
        if (Math.abs(ev.time - clickTime) * pxPerSec <= 10) {
          foundIdx = idx;
        }
      });
      setActiveEventIndex(foundIdx);
    };

    canvas.addEventListener("dblclick", handleDblClick);
    canvas.addEventListener("click", handleClick);
    return () => {
      canvas.removeEventListener("dblclick", handleDblClick);
      canvas.removeEventListener("click", handleClick);
    };
  }, [totalSamples, sampleRate, signalArray, updateEvents]);

  // Keyboard navigation: left/right arrows, shift+arrows, Delete to remove event
  const handleKeyDown = (e) => {
    const [w0, w1] = windowRef.current;
    const span = w1 - w0;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const step = e.shiftKey ? span * 0.1 : span;
      updateWindow([w0 - step, w1 - step]);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const step = e.shiftKey ? span * 0.1 : span;
      updateWindow([w0 + step, w1 + step]);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if (activeEventRef.current !== null && activeEventRef.current !== undefined) {
        e.preventDefault();
        const next = eventsRef.current.filter((_, idx) => idx !== activeEventRef.current);
        updateEvents(next);
        setActiveEventIndex(null);
      }
    }
  };

  const jumpToEvent = (idx) => {
    setActiveEventIndex(idx);
    const target = events[idx];
    if (!target) return;
    const [w0, w1] = windowRange;
    const span = w1 - w0;
    const half = span / 2;
    updateWindow([target.time - half, target.time + half]);
  };

  const deleteEventByIndex = (idx) => {
    const next = events.filter((_, i) => i !== idx);
    updateEvents(next);
    if (activeEventIndex === idx) {
      setActiveEventIndex(null);
    } else if (activeEventIndex > idx) {
      setActiveEventIndex(activeEventIndex - 1);
    }
  };

  const canvasWidth = Math.max(300, dimensions.width);

  return (
    <section
      ref={rootRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        width: "100%",
        boxSizing: "border-box",
        background: "#fdfbf7",
        color: "#2a2825",
        padding: "20px 24px",
        outline: "none",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* Title & Metadata Strip */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "14px",
          borderBottom: "1px solid rgba(215, 208, 196, 0.7)",
          paddingBottom: "10px",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontFamily: "Georgia, 'Tiempos Headline', 'Playfair Display', serif",
              fontWeight: 700,
              fontSize: "20px",
              letterSpacing: "-0.01em",
              color: "#1d1a16",
            }}
          >
            Signal Inspector
          </h2>
          <div
            style={{
              fontSize: "12px",
              color: "#7e786e",
              marginTop: "2px",
              fontFamily: "monospace",
            }}
          >
            200k samples @ 1000 Hz · span: {duration.toFixed(1)}s
          </div>
        </div>

        <div
          style={{
            fontFamily: "monospace",
            fontSize: "12px",
            color: "#4f4940",
            background: "#efebe2",
            padding: "4px 10px",
            borderRadius: "4px",
          }}
        >
          Window: [{windowRange[0].toFixed(3)}s – {windowRange[1].toFixed(3)}s] (
          {(windowRange[1] - windowRange[0]).toFixed(3)}s)
        </div>
      </div>

      {/* Main Grid: Visualizations on Left, Marker Sidebar on Right */}
      <div
        ref={containerRef}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 220px",
          gap: "18px",
          alignItems: "start",
        }}
      >
        {/* Left Column: Overview + Detail */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
          {/* Top strip: Overview Envelope */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "8px",
              border: "1px solid rgba(220, 215, 205, 0.8)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 12px",
                background: "#f7f4ee",
                fontSize: "11px",
                color: "#6c665d",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              <span>Overview [0.0s – {duration.toFixed(1)}s]</span>
              <span>Drag body to scrub · Drag edges to scale</span>
            </div>
            <canvas
              ref={overviewCanvasRef}
              width={canvasWidth}
              height={90}
              style={{
                display: "block",
                width: "100%",
                height: "90px",
                touchAction: "none",
                userSelect: "none",
              }}
            />
          </div>

          {/* Bottom canvas: Detail raw samples */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "8px",
              border: "1px solid rgba(220, 215, 205, 0.8)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 12px",
                background: "#f7f4ee",
                fontSize: "11px",
                color: "#6c665d",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              <span>Detail Window View</span>
              <span>Double-click to drop peak marker</span>
            </div>
            <canvas
              ref={detailCanvasRef}
              width={canvasWidth}
              height={300}
              style={{
                display: "block",
                width: "100%",
                height: "300px",
                touchAction: "none",
                cursor: "crosshair",
              }}
            />
          </div>
        </div>

        {/* Right Column: Events / Markers List */}
        <div style={{ height: "432px" }}>
          <EventList
            events={events}
            activeEventIndex={activeEventIndex}
            onSelectEvent={jumpToEvent}
            onDeleteEvent={deleteEventByIndex}
            React={React}
          />
        </div>
      </div>

      {/* Narrative Footer & Shortcuts Hint */}
      <div
        style={{
          marginTop: "14px",
          paddingTop: "8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "11px",
          color: "#8c8579",
          borderTop: "1px solid rgba(230, 225, 218, 0.6)",
        }}
      >
        <div>
          <strong style={{ color: "#4f4940" }}>Controls:</strong> [← / →] step window · [Shift + ← / →] step tenth · [Del] remove active marker
        </div>
        <div>Total Signal Length: {totalSamples.toLocaleString()} samples</div>
      </div>
    </section>
  );
}