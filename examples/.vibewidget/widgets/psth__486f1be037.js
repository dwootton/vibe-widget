import * as d3 from "https://esm.sh/d3@7";

function parseDataFrame(df) {
  if (!df) return [];
  if (Array.isArray(df)) return df;
  if (typeof df === "object") {
    // Check if it's columnar or records or index-based
    const keys = Object.keys(df);
    if (keys.length === 0) return [];
    // If it has columnar arrays or dict of objects
    const firstVal = df[keys[0]];
    if (Array.isArray(firstVal)) {
      const len = firstVal.length;
      const rows = [];
      for (let i = 0; i < len; i++) {
        const row = {};
        for (const k of keys) {
          row[k] = df[k][i];
        }
        rows.push(row);
      }
      return rows;
    } else if (typeof firstVal === "object" && firstVal !== null) {
      return Object.values(df);
    }
  }
  return [];
}

export const RateHistogram = ({
  React,
  spikesData,
  stimData,
  windowVal,
  neuronsVal,
  width = 640,
  height = 280,
}) => {
  const containerRef = React.useRef(null);

  // Compute stats and binning
  const processed = React.useMemo(() => {
    if (!neuronsVal || !Array.isArray(neuronsVal) || neuronsVal.length === 0) {
      return { emptyReason: "pick neurons on the raster" };
    }

    // Window defaults to full range or [0, 20] if not provided
    let t0 = 0;
    let t1 = 20;
    if (Array.isArray(windowVal) && windowVal.length >= 2 && windowVal[0] != null && windowVal[1] != null) {
      t0 = Math.min(windowVal[0], windowVal[1]);
      t1 = Math.max(windowVal[0], windowVal[1]);
    } else {
      // derive from data if possible
      if (spikesData && spikesData.length > 0) {
        t0 = d3.min(spikesData, (d) => d.t) ?? 0;
        t1 = d3.max(spikesData, (d) => d.t) ?? 20;
      }
    }
    if (t1 <= t0) t1 = t0 + 1;

    const binSize = 0.02; // 20 ms
    const nBins = Math.max(1, Math.ceil((t1 - t0) / binSize));
    const binEdges = new Float64Array(nBins + 1);
    for (let i = 0; i <= nBins; i++) {
      binEdges[i] = t0 + i * binSize;
    }

    const neuronSet = new Set(neuronsVal.map(Number));
    const neuronList = Array.from(neuronSet);
    const nNeurons = neuronList.length;

    // Filter spikes in window for selected neurons
    const neuronSpikeBins = new Map();
    neuronList.forEach((nid) => {
      neuronSpikeBins.set(nid, new Float64Array(nBins));
    });

    for (let i = 0; i < spikesData.length; i++) {
      const sp = spikesData[i];
      const nid = Number(sp.neuron);
      const t = Number(sp.t);
      if (neuronSet.has(nid) && t >= t0 && t < t1) {
        const b = Math.floor((t - t0) / binSize);
        if (b >= 0 && b < nBins) {
          neuronSpikeBins.get(nid)[b] += 1;
        }
      }
    }

    // Convert counts to firing rate (Hz = spikes per second)
    // binSize is 0.02 s, so rate = count / 0.02 = count * 50
    const perNeuronCurves = [];
    const meanCurve = [];

    const sumBins = new Float64Array(nBins);
    neuronList.forEach((nid) => {
      const counts = neuronSpikeBins.get(nid);
      const points = [];
      for (let b = 0; b < nBins; b++) {
        const rate = counts[b] / binSize;
        points.push({ t: t0 + (b + 0.5) * binSize, rate });
        sumBins[b] += rate;
      }
      perNeuronCurves.push({ neuron: nid, points });
    });

    for (let b = 0; b < nBins; b++) {
      meanCurve.push({
        t: t0 + (b + 0.5) * binSize,
        rate: sumBins[b] / nNeurons,
      });
    }

    // Stimulus onsets and 0-150ms strips
    const stimList = [];
    for (let i = 0; i < stimData.length; i++) {
      const onset = Number(stimData[i].onset);
      if (!isNaN(onset)) {
        // Strip is [onset, onset + 0.150]
        const stripStart = onset;
        const stripEnd = onset + 0.15;
        // Keep if overlaps window [t0, t1]
        if (stripEnd >= t0 && stripStart <= t1) {
          stimList.push({ onset, stripStart, stripEnd });
        }
      }
    }

    // Mean rate inside the strips vs outside them
    // Compute total spikes inside stim strips vs outside within [t0, t1]
    let totalInsideDuration = 0;
    let totalInsideSpikes = 0;
    let totalOutsideSpikes = 0;

    // Union of strips inside [t0, t1] to handle overlaps precisely
    const intervals = [];
    stimData.forEach((s) => {
      const o = Number(s.onset);
      if (!isNaN(o)) {
        const s0 = Math.max(t0, o);
        const s1 = Math.min(t1, o + 0.15);
        if (s1 > s0) {
          intervals.push([s0, s1]);
        }
      }
    });

    // Merge intervals
    intervals.sort((a, b) => a[0] - b[0]);
    const mergedIntervals = [];
    for (const cur of intervals) {
      if (!mergedIntervals.length) {
        mergedIntervals.push(cur);
      } else {
        const prev = mergedIntervals[mergedIntervals.length - 1];
        if (cur[0] <= prev[1]) {
          prev[1] = Math.max(prev[1], cur[1]);
        } else {
          mergedIntervals.push(cur);
        }
      }
    }

    for (const [s0, s1] of mergedIntervals) {
      totalInsideDuration += s1 - s0;
    }
    const totalOutsideDuration = Math.max(0, (t1 - t0) - totalInsideDuration);

    const isInsideStrip = (t) => {
      for (const [s0, s1] of mergedIntervals) {
        if (t >= s0 && t < s1) return true;
      }
      return false;
    };

    for (let i = 0; i < spikesData.length; i++) {
      const sp = spikesData[i];
      const nid = Number(sp.neuron);
      const t = Number(sp.t);
      if (neuronSet.has(nid) && t >= t0 && t < t1) {
        if (isInsideStrip(t)) {
          totalInsideSpikes++;
        } else {
          totalOutsideSpikes++;
        }
      }
    }

    let lockedRatio = null;
    let insideRate = 0;
    let outsideRate = 0;

    if (totalInsideDuration > 0 && nNeurons > 0) {
      insideRate = totalInsideSpikes / (totalInsideDuration * nNeurons);
    }
    if (totalOutsideDuration > 0 && nNeurons > 0) {
      outsideRate = totalOutsideSpikes / (totalOutsideDuration * nNeurons);
    }

    if (outsideRate > 0) {
      lockedRatio = (insideRate / outsideRate).toFixed(1);
    } else if (insideRate > 0) {
      lockedRatio = "∞";
    }

    // Determine max rate for y-scale
    let maxRate = 0;
    perNeuronCurves.forEach((c) => {
      c.points.forEach((p) => {
        if (p.rate > maxRate) maxRate = p.rate;
      });
    });
    if (maxRate === 0) maxRate = 10;
    // Round up maxRate nicely
    maxRate = Math.ceil(maxRate * 1.1);

    return {
      emptyReason: null,
      t0,
      t1,
      binSize,
      stimList,
      perNeuronCurves,
      meanCurve,
      maxRate,
      lockedRatio,
      insideRate,
      outsideRate,
      nNeurons,
    };
  }, [spikesData, stimData, windowVal, neuronsVal]);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const container = d3.select(containerRef.current);
    container.selectAll("*").remove();

    if (processed.emptyReason) return;

    const margin = { top: 20, right: 24, bottom: 28, left: 44 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = container
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("style", "display: block; font-family: system-ui, -apple-system, Inter, sans-serif;");

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scaleLinear()
      .domain([processed.t0, processed.t1])
      .range([0, w]);

    const yScale = d3
      .scaleLinear()
      .domain([0, processed.maxRate])
      .nice()
      .range([h, 0]);

    // Gridlines (subtle hairlines)
    const yTicks = yScale.ticks(4);
    g.append("g")
      .selectAll("line.grid")
      .data(yTicks)
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("x2", w)
      .attr("y1", (d) => yScale(d))
      .attr("y2", (d) => yScale(d))
      .attr("stroke", "#d9d9d9")
      .attr("stroke-width", 1);

    // Stimulus shaded strips (0-150 ms)
    processed.stimList.forEach((s) => {
      const xStart = xScale(Math.max(processed.t0, s.stripStart));
      const xEnd = xScale(Math.min(processed.t1, s.stripEnd));
      const stripWidth = Math.max(0, xEnd - xStart);
      if (stripWidth > 0) {
        g.append("rect")
          .attr("x", xStart)
          .attr("y", 0)
          .attr("width", stripWidth)
          .attr("height", h)
          .attr("fill", "#111111")
          .attr("opacity", 0.08);
      }

      // Stimulus onset dashed vertical line
      if (s.onset >= processed.t0 && s.onset <= processed.t1) {
        const xPos = xScale(s.onset);
        g.append("line")
          .attr("x1", xPos)
          .attr("x2", xPos)
          .attr("y1", 0)
          .attr("y2", h)
          .attr("stroke", "#111111")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "3,3");
      }
    });

    const lineGen = d3
      .line()
      .x((d) => xScale(d.t))
      .y((d) => yScale(d.rate));

    // Thin grey lines for individual neurons
    const linesGroup = g.append("g");
    processed.perNeuronCurves.forEach((c) => {
      linesGroup
        .append("path")
        .datum(c.points)
        .attr("fill", "none")
        .attr("stroke", "#777777")
        .attr("stroke-width", 1)
        .attr("opacity", 0.45)
        .attr("d", lineGen);
    });

    // Thick line for mean
    g.append("path")
      .datum(processed.meanCurve)
      .attr("fill", "none")
      .attr("stroke", "#111111")
      .attr("stroke-width", 2)
      .attr("d", lineGen);

    // X Axis hairline & ticks
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(Math.max(3, Math.floor(w / 80)))
      .tickSize(4)
      .tickFormat((d) => `${d}s`);

    const gx = g
      .append("g")
      .attr("transform", `translate(0,${h})`)
      .call(xAxis);

    gx.select(".domain").attr("stroke", "#d9d9d9");
    gx.selectAll(".tick line").attr("stroke", "#d9d9d9");
    gx.selectAll(".tick text")
      .attr("fill", "#777777")
      .attr("font-size", 11)
      .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace");

    // Y Axis hairline & ticks
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(4)
      .tickSize(4)
      .tickFormat((d) => `${d}`);

    const gy = g.append("g").call(yAxis);
    gy.select(".domain").attr("stroke", "#d9d9d9");
    gy.selectAll(".tick line").attr("stroke", "#d9d9d9");
    gy.selectAll(".tick text")
      .attr("fill", "#777777")
      .attr("font-size", 11)
      .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace");

    // Y Axis unit indicator
    g.append("text")
      .attr("x", 4)
      .attr("y", -8)
      .attr("fill", "#777777")
      .attr("font-size", 11)
      .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace")
      .text("spikes/s");

    // Top-right locked ratio badge
    if (processed.lockedRatio !== null) {
      const badgeText = `locked ×${processed.lockedRatio}`;
      g.append("text")
        .attr("x", w)
        .attr("y", -8)
        .attr("text-anchor", "end")
        .attr("fill", "#111111")
        .attr("font-size", 12)
        .attr("font-weight", 600)
        .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace")
        .text(badgeText);
    }

    return () => {
      svg.remove();
    };
  }, [processed, width, height]);

  if (processed.emptyReason) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#777777",
          fontSize: 13,
          fontFamily: "system-ui, -apple-system, Inter, sans-serif",
          background: "#ffffff",
          border: "1px dashed #d9d9d9",
          boxSizing: "border-box",
        }}
      >
        {processed.emptyReason}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        background: "#ffffff",
        boxSizing: "border-box",
      }}
    />
  );
};

export default function Widget({ model, React }) {
  const [windowVal, setWindowVal] = React.useState(() => model.get("window"));
  const [neuronsVal, setNeuronsVal] = React.useState(() => model.get("neurons"));
  const [dataVal, setDataVal] = React.useState(() => parseDataFrame(model.get("data")));
  const [stimVal, setStimVal] = React.useState(() => parseDataFrame(model.get("stim")));
  const [containerWidth, setContainerWidth] = React.useState(620);
  const shellRef = React.useRef(null);

  React.useEffect(() => {
    const onWindowChange = () => setWindowVal(model.get("window"));
    const onNeuronsChange = () => setNeuronsVal(model.get("neurons"));
    const onDataChange = () => setDataVal(parseDataFrame(model.get("data")));
    const onStimChange = () => setStimVal(parseDataFrame(model.get("stim")));

    model.on("change:window", onWindowChange);
    model.on("change:neurons", onNeuronsChange);
    model.on("change:data", onDataChange);
    model.on("change:stim", onStimChange);

    return () => {
      model.off("change:window", onWindowChange);
      model.off("change:neurons", onNeuronsChange);
      model.off("change:data", onDataChange);
      model.off("change:stim", onStimChange);
    };
  }, [model]);

  React.useEffect(() => {
    if (!shellRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const measured = entry.contentRect.width;
        if (measured > 100) {
          setContainerWidth(measured);
        }
      }
    });
    observer.observe(shellRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={shellRef}
      style={{
        padding: 12,
        background: "#ffffff",
        color: "#111111",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <RateHistogram
        React={React}
        spikesData={dataVal}
        stimData={stimVal}
        windowVal={windowVal}
        neuronsVal={neuronsVal}
        width={containerWidth}
        height={260}
      />
    </div>
  );
}