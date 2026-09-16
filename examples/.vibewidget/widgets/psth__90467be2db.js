import * as d3 from "https://esm.sh/d3@7";

// Helper to normalize tabular data formats (records array or column-oriented dict)
function normalizeRows(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    const keys = Object.keys(raw);
    if (keys.length === 0) return [];
    const firstCol = raw[keys[0]];
    if (Array.isArray(firstCol)) {
      const len = firstCol.length;
      const rows = new Array(len);
      for (let i = 0; i < len; i++) {
        const row = {};
        for (const k of keys) {
          row[k] = raw[k][i];
        }
        rows[i] = row;
      }
      return rows;
    }
  }
  return [];
}

export const StatsBadge = ({ ratio, insideRate, outsideRate, neuronCount }) => {
  const isLocking = ratio !== null && ratio !== undefined && !Number.isNaN(ratio) && Number.isFinite(ratio);
  const ratioText = isLocking ? `locked ×${ratio.toFixed(1)}` : "locked —";
  const inText = insideRate !== null && !Number.isNaN(insideRate) ? `${insideRate.toFixed(1)} Hz` : "—";
  const outText = outsideRate !== null && !Number.isNaN(outsideRate) ? `${outsideRate.toFixed(1)} Hz` : "—";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
        fontFamily: "'Fira Code', 'Pitch', monospace",
        fontSize: "12px",
        color: "#2b2823",
      }}
    >
      <span
        style={{
          background: "linear-gradient(135deg, #e87a5d, #b83b26)",
          color: "#fff",
          padding: "3px 9px",
          borderRadius: "14px",
          fontWeight: 600,
          letterSpacing: "0.02em",
          boxShadow: "0 2px 6px rgba(184, 59, 38, 0.25)",
        }}
      >
        {ratioText}
      </span>
      <span style={{ color: "#78716c" }}>
        stim: <strong style={{ color: "#b83b26" }}>{inText}</strong>
      </span>
      <span style={{ color: "#78716c" }}>
        baseline: <strong style={{ color: "#2b2823" }}>{outText}</strong>
      </span>
      <span
        style={{
          marginLeft: "auto",
          color: "#8a8175",
          fontSize: "11px",
        }}
      >
        {neuronCount} {neuronCount === 1 ? "neuron" : "neurons"} selected
      </span>
    </div>
  );
};

export const EmptyState = () => (
  <div
    style={{
      height: 320,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      border: "1px dashed #d6cebe",
      borderRadius: "8px",
      backgroundColor: "rgba(247, 243, 235, 0.6)",
      color: "#6e6659",
      fontFamily: "'Playfair Display', Georgia, serif",
      fontStyle: "italic",
      fontSize: "18px",
      letterSpacing: "0.01em",
      padding: "24px",
      textAlign: "center",
    }}
  >
    <div style={{ fontSize: "28px", marginBottom: "8px", opacity: 0.7 }}>∿</div>
    pick neurons on the raster
    <span
      style={{
        fontFamily: "'Fira Code', monospace",
        fontStyle: "normal",
        fontSize: "11px",
        color: "#9e9484",
        marginTop: "8px",
      }}
    >
      Awaiting selection to compute 20 ms binned firing rates
    </span>
  </div>
);

export const FiringRatePlot = ({
  React,
  spikes,
  stims,
  windowRange,
  selectedNeurons,
  width = 640,
  height = 320,
}) => {
  const containerRef = React.useRef(null);
  const [stats, setStats] = React.useState({ ratio: null, insideRate: null, outsideRate: null });

  React.useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = "";

    const t0 = windowRange ? windowRange[0] : 0;
    const t1 = windowRange ? windowRange[1] : 20;

    if (t1 <= t0) return;

    const binSize = 0.02; // 20 ms
    const nBins = Math.max(1, Math.ceil((t1 - t0) / binSize));
    const binEdges = new Float64Array(nBins + 1);
    for (let i = 0; i <= nBins; i++) {
      binEdges[i] = t0 + i * binSize;
    }

    const neuronSet = new Set(selectedNeurons.map((d) => Number(d)));

    // Stimulus windows: 0 to 150 ms after each onset
    const stimStrips = stims
      .map((s) => ({
        start: s,
        end: s + 0.15,
      }))
      .filter((s) => s.end >= t0 && s.start <= t1);

    // Filter relevant spikes
    const relevantSpikes = spikes.filter(
      (s) => neuronSet.has(Number(s.neuron)) && s.t >= t0 && s.t <= t1
    );

    // Count inside vs outside stimulus strips
    // Calculate total duration inside vs outside window
    let totalInsideTime = 0;
    stimStrips.forEach((strip) => {
      const c0 = Math.max(t0, strip.start);
      const c1 = Math.min(t1, strip.end);
      if (c1 > c0) totalInsideTime += c1 - c0;
    });
    const totalOutsideTime = Math.max(0.0001, t1 - t0 - totalInsideTime);
    const nSelected = neuronSet.size;

    let spikesInside = 0;
    let spikesOutside = 0;

    const isInsideStrip = (t) => {
      for (let i = 0; i < stimStrips.length; i++) {
        if (t >= stimStrips[i].start && t < stimStrips[i].end) return true;
      }
      return false;
    };

    relevantSpikes.forEach((s) => {
      if (isInsideStrip(s.t)) {
        spikesInside++;
      } else {
        spikesOutside++;
      }
    });

    const insideRate =
      totalInsideTime > 0 && nSelected > 0
        ? spikesInside / (totalInsideTime * nSelected)
        : 0;
    const outsideRate =
      totalOutsideTime > 0 && nSelected > 0
        ? spikesOutside / (totalOutsideTime * nSelected)
        : 0;
    const ratio = outsideRate > 0 ? insideRate / outsideRate : (insideRate > 0 ? Infinity : 1.0);

    setStats({ ratio, insideRate, outsideRate });

    // Compute binned firing rates per neuron
    // bins[neuronId][binIndex] = count / binSize (Hz)
    const neuronBins = new Map();
    neuronSet.forEach((nid) => {
      neuronBins.set(nid, new Float64Array(nBins));
    });

    relevantSpikes.forEach((s) => {
      const bIdx = Math.floor((s.t - t0) / binSize);
      if (bIdx >= 0 && bIdx < nBins) {
        const arr = neuronBins.get(Number(s.neuron));
        if (arr) arr[bIdx]++;
      }
    });

    // Convert counts to rate in Hz (count / binSize)
    const perNeuronCurves = [];
    const meanCurve = new Array(nBins);
    for (let b = 0; b < nBins; b++) {
      const midT = t0 + (b + 0.5) * binSize;
      let sumRate = 0;
      neuronBins.forEach((arr) => {
        sumRate += arr[b] / binSize;
      });
      meanCurve[b] = {
        t: midT,
        rate: nSelected > 0 ? sumRate / nSelected : 0,
      };
    }

    neuronBins.forEach((arr) => {
      const curve = new Array(nBins);
      for (let b = 0; b < nBins; b++) {
        curve[b] = {
          t: t0 + (b + 0.5) * binSize,
          rate: arr[b] / binSize,
        };
      }
      perNeuronCurves.push(curve);
    });

    // Layout
    const margin = { top: 20, right: 32, bottom: 44, left: 56 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    const svg = d3
      .select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height)
      .style("display", "block")
      .style("overflow", "visible");

    // Scales
    const xScale = d3.scaleLinear().domain([t0, t1]).range([0, plotWidth]);

    let maxRate = d3.max(meanCurve, (d) => d.rate) || 10;
    perNeuronCurves.forEach((curve) => {
      const cMax = d3.max(curve, (d) => d.rate) || 0;
      if (cMax > maxRate) maxRate = cMax;
    });
    // Add 10% breathing room
    maxRate = Math.max(10, Math.ceil(maxRate * 1.15));

    const yScale = d3.scaleLinear().domain([0, maxRate]).range([plotHeight, 0]).nice();

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Stimulus shaded strips (0-150 ms)
    stimStrips.forEach((strip) => {
      const xStart = Math.max(0, xScale(strip.start));
      const xEnd = Math.min(plotWidth, xScale(strip.end));
      const stripW = Math.max(0, xEnd - xStart);
      if (stripW > 0) {
        g.append("rect")
          .attr("x", xStart)
          .attr("y", 0)
          .attr("width", stripW)
          .attr("height", plotHeight)
          .attr("fill", "#b83b26")
          .attr("fill-opacity", 0.12)
          .attr("pointer-events", "none");
      }
    });

    // Stimulus onset dashed lines
    stims.forEach((onset) => {
      if (onset >= t0 && onset <= t1) {
        const xPos = xScale(onset);
        g.append("line")
          .attr("x1", xPos)
          .attr("x2", xPos)
          .attr("y1", 0)
          .attr("y2", plotHeight)
          .attr("stroke", "#b83b26")
          .attr("stroke-width", 1.5)
          .attr("stroke-dasharray", "4,3")
          .attr("stroke-opacity", 0.85);

        // Small tag at top of line
        g.append("text")
          .attr("x", xPos + 3)
          .attr("y", 11)
          .attr("fill", "#b83b26")
          .attr("font-family", "'Fira Code', monospace")
          .attr("font-size", 9)
          .attr("font-weight", "600")
          .text("STIM");
      }
    });

    // Grid lines (horizontal)
    const yTicks = yScale.ticks(5);
    g.append("g")
      .selectAll("line.grid")
      .data(yTicks)
      .join("line")
      .attr("class", "grid")
      .attr("x1", 0)
      .attr("x2", plotWidth)
      .attr("y1", (d) => yScale(d))
      .attr("y2", (d) => yScale(d))
      .attr("stroke", "#e7dfd3")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2,4");

    // Line generator
    const lineGen = d3
      .line()
      .x((d) => xScale(d.t))
      .y((d) => yScale(d.rate))
      .curve(d3.curveMonotoneX);

    // Individual neuron lines (thin grey)
    perNeuronCurves.forEach((curve) => {
      g.append("path")
        .datum(curve)
        .attr("fill", "none")
        .attr("stroke", "#8d8579")
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.32)
        .attr("d", lineGen);
    });

    // Population mean line (thick, deep ink / indigo)
    g.append("path")
      .datum(meanCurve)
      .attr("fill", "none")
      .attr("stroke", "#1e1e24")
      .attr("stroke-width", 2.75)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .attr("d", lineGen);

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(Math.min(10, Math.floor(plotWidth / 70)))
      .tickFormat((d) => `${d}s`);

    const gx = g
      .append("g")
      .attr("transform", `translate(0,${plotHeight})`)
      .call(xAxis);

    gx.select(".domain").attr("stroke", "#b5ab99");
    gx.selectAll(".tick line").attr("stroke", "#b5ab99");
    gx.selectAll(".tick text")
      .attr("fill", "#575249")
      .attr("font-family", "'Fira Code', monospace")
      .attr("font-size", 10);

    // Y Axis
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat((d) => `${d}`);
    const gy = g.append("g").call(yAxis);

    gy.select(".domain").attr("stroke", "#b5ab99");
    gy.selectAll(".tick line").attr("stroke", "#b5ab99");
    gy.selectAll(".tick text")
      .attr("fill", "#575249")
      .attr("font-family", "'Fira Code', monospace")
      .attr("font-size", 10);

    // Axis label
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -plotHeight / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .attr("fill", "#666055")
      .attr("font-family", "'Fira Code', monospace")
      .attr("font-size", 10)
      .attr("letter-spacing", "0.04em")
      .text("RATE (spikes/s)");

    g.append("text")
      .attr("x", plotWidth)
      .attr("y", plotHeight + 36)
      .attr("text-anchor", "end")
      .attr("fill", "#666055")
      .attr("font-family", "'Fira Code', monospace")
      .attr("font-size", 10)
      .text("time window");

    return () => {
      svg.remove();
    };
  }, [spikes, stims, windowRange, selectedNeurons, width, height]);

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <StatsBadge
          ratio={stats.ratio}
          insideRate={stats.insideRate}
          outsideRate={stats.outsideRate}
          neuronCount={selectedNeurons.length}
        />
      </div>
      <div ref={containerRef} style={{ width: "100%", height }} />
    </div>
  );
};

export default function Widget({ model, React }) {
  // Read inputs reactively
  const [windowVal, setWindowVal] = React.useState(() => model.get("window"));
  const [neuronsVal, setNeuronsVal] = React.useState(() => model.get("neurons"));
  const [stimVal, setStimVal] = React.useState(() => model.get("stim"));
  const [dataVal, setDataVal] = React.useState(() => model.get("data"));

  React.useEffect(() => {
    const onWindowChange = () => setWindowVal(model.get("window"));
    const onNeuronsChange = () => setNeuronsVal(model.get("neurons"));
    const onStimChange = () => setStimVal(model.get("stim"));
    const onDataChange = () => setDataVal(model.get("data"));

    model.on("change:window", onWindowChange);
    model.on("change:neurons", onNeuronsChange);
    model.on("change:stim", onStimChange);
    model.on("change:data", onDataChange);

    return () => {
      model.off("change:window", onWindowChange);
      model.off("change:neurons", onNeuronsChange);
      model.off("change:stim", onStimChange);
      model.off("change:data", onDataChange);
    };
  }, [model]);

  // Normalize data and stim lists
  const spikes = React.useMemo(() => normalizeRows(dataVal), [dataVal]);

  const stims = React.useMemo(() => {
    const rows = normalizeRows(stimVal);
    return rows
      .map((r) => (typeof r.onset === "number" ? r.onset : Number(r.onset)))
      .filter((v) => !Number.isNaN(v));
  }, [stimVal]);

  // Check if valid neurons are selected
  const hasNeurons =
    Array.isArray(neuronsVal) && neuronsVal.length > 0;

  // Window bounds fallback to spike range or [0, 20]
  const currentWindow = React.useMemo(() => {
    if (Array.isArray(windowVal) && windowVal.length >= 2) {
      return [Number(windowVal[0]), Number(windowVal[1])];
    }
    return [0, 20];
  }, [windowVal]);

  return (
    <section
      style={{
        background: "#fdfbf7",
        color: "#24211e",
        padding: "24px 28px",
        borderRadius: "12px",
        border: "1px solid #ede7db",
        fontFamily: "'Playfair Display', Georgia, serif",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
        maxWidth: "840px",
        margin: "0 auto",
      }}
    >
      {/* Editorial Header */}
      <header
        style={{
          borderBottom: "1px solid #ede7db",
          paddingBottom: "14px",
          marginBottom: "18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div>
          <span
            style={{
              fontFamily: "'Fira Code', monospace",
              textTransform: "uppercase",
              fontSize: "10px",
              letterSpacing: "0.14em",
              color: "#998f80",
              display: "block",
              marginBottom: "2px",
            }}
          >
            Temporal Response · 20ms Binned
          </span>
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: 700,
              color: "#1c1917",
              letterSpacing: "-0.01em",
            }}
          >
            Stimulus-Locked Firing Rate
          </h2>
        </div>

        <div
          style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: "11px",
            color: "#78716c",
            display: "flex",
            gap: "14px",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: 14,
                height: 3,
                backgroundColor: "#1e1e24",
                borderRadius: 2,
                display: "inline-block",
              }}
            />
            Mean Rate
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: 14,
                height: 1,
                backgroundColor: "#8d8579",
                display: "inline-block",
              }}
            />
            Individual Neurons
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: 12,
                height: 10,
                backgroundColor: "#b83b26",
                opacity: 0.25,
                borderRadius: 1,
                display: "inline-block",
              }}
            />
            0–150ms Post-Stim
          </span>
        </div>
      </header>

      {/* Main visualization content */}
      {!hasNeurons ? (
        <EmptyState />
      ) : (
        <FiringRatePlot
          React={React}
          spikes={spikes}
          stims={stims}
          windowRange={currentWindow}
          selectedNeurons={neuronsVal}
          width={760}
          height={320}
        />
      )}
    </section>
  );
}