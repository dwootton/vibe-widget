import * as d3 from "https://esm.sh/d3@7";

export const GenerationsList = ({ gens, pinned, passingIds, onSelectGen, activeGen }) => {
  const isPinnedMatch = (step, text) => {
    return pinned.some(p => p.step === step && p.text === text);
  };

  if (!pinned || pinned.length === 0) {
    return (
      <div style={{
        padding: "16px 20px",
        background: "rgba(244, 240, 232, 0.7)",
        borderRadius: "8px",
        border: "1px dashed #c8bead",
        color: "#6b6255",
        fontFamily: "'Fira Code', 'Courier New', monospace",
        fontSize: "13px",
        letterSpacing: "0.02em",
        textAlign: "center"
      }}>
        Hover a span to trace flow &bull; Click to pin filter (multiple combine with AND)
      </div>
    );
  }

  const passingGens = gens.filter(g => passingIds.includes(g.gen));

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      maxHeight: "220px",
      overflowY: "auto",
      paddingRight: "6px"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "12px",
        fontFamily: "'Fira Code', monospace",
        color: "#7a6e5d",
        borderBottom: "1px solid #e2dacd",
        paddingBottom: "4px"
      }}>
        <span>
          Showing <strong>{passingGens.length}</strong> of 24 generation{passingGens.length !== 1 ? "s" : ""} matching pinned criteria
        </span>
        <span style={{ fontSize: "11px", color: "#a59986" }}>
          Pins: {pinned.map(p => `s${p.step}: "${p.text}"`).join(", ")}
        </span>
      </div>
      {passingGens.map((g) => {
        const isHovered = activeGen === g.gen;
        return (
          <div
            key={g.gen}
            onMouseEnter={() => onSelectGen && onSelectGen(g.gen)}
            onMouseLeave={() => onSelectGen && onSelectGen(null)}
            style={{
              padding: "8px 12px",
              background: isHovered ? "#fff8f0" : "#ffffff",
              borderRadius: "6px",
              border: isHovered ? "1px solid #d97706" : "1px solid #e7dfd3",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              fontFamily: "'Fira Code', monospace",
              fontSize: "12px",
              lineHeight: "1.6",
              transition: "all 0.15s ease",
              cursor: "pointer"
            }}
          >
            <span style={{
              display: "inline-block",
              width: "54px",
              color: "#9e917f",
              fontWeight: "600",
              fontSize: "11px",
              userSelect: "none"
            }}>
              #{String(g.gen).padStart(2, "0")}
            </span>
            <span style={{ color: "#2d2820" }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((step) => {
                const val = g[`s${step}`];
                if (val === undefined || val === null) return null;
                const match = isPinnedMatch(step, val);
                return (
                  <span
                    key={step}
                    style={{
                      backgroundColor: match ? "#fed7aa" : "transparent",
                      color: match ? "#9a3412" : "inherit",
                      fontWeight: match ? "700" : "400",
                      padding: match ? "1px 4px" : "0 2px",
                      borderRadius: match ? "3px" : "0",
                      marginRight: "4px",
                      display: "inline-block"
                    }}
                  >
                    {val}
                  </span>
                );
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const ConsistencyDiagram = ({
  nodesData,
  linksData,
  gensData,
  pinned,
  onTogglePin,
  hoveredSpan,
  setHoveredSpan,
  activeGen,
  passingGenIds
}) => {
  const containerRef = d3.select(null);
  const svgRef = d3.select(null);
  const domRef = (el) => {
    if (el) {
      containerRef.current = el;
    }
  };

  return <div ref={domRef} style={{ width: "100%", overflowX: "auto" }} />;
};

export default function Widget({ model, React }) {
  const [dataVersion, setDataVersion] = React.useState(0);
  const [pinned, setPinned] = React.useState([]);
  const [hoveredSpan, setHoveredSpan] = React.useState(null);
  const [activeGen, setActiveGen] = React.useState(null);
  const [tooltip, setTooltip] = React.useState(null);

  const containerRef = React.useRef(null);
  const svgRef = React.useRef(null);
  const layoutRef = React.useRef(null);
  const pinnedRef = React.useRef(pinned);
  const hoveredRef = React.useRef(hoveredSpan);
  const activeGenRef = React.useRef(activeGen);

  pinnedRef.current = pinned;
  hoveredRef.current = hoveredSpan;
  activeGenRef.current = activeGen;

  const rawNodes = model.get("data") || [];
  const rawLinks = model.get("links") || [];
  const rawGens = model.get("gens") || [];

  const nodes = React.useMemo(() => {
    return Array.isArray(rawNodes) ? rawNodes : [];
  }, [rawNodes, dataVersion]);

  const links = React.useMemo(() => {
    return Array.isArray(rawLinks) ? rawLinks : [];
  }, [rawLinks, dataVersion]);

  const gens = React.useMemo(() => {
    return Array.isArray(rawGens) ? rawGens : [];
  }, [rawGens, dataVersion]);

  React.useEffect(() => {
    const handleUpdate = () => setDataVersion((v) => v + 1);
    model.on("change:data", handleUpdate);
    model.on("change:links", handleUpdate);
    model.on("change:gens", handleUpdate);

    model.set("pinned", []);
    model.set("gen_ids", Array.from({ length: 24 }, (_, i) => i));
    model.save_changes();

    return () => {
      model.off("change:data", handleUpdate);
      model.off("change:links", handleUpdate);
      model.off("change:gens", handleUpdate);
    };
  }, []);

  const passingGenIds = React.useMemo(() => {
    if (!gens.length) return [];
    if (!pinned || pinned.length === 0) {
      return gens.map((g) => g.gen);
    }
    return gens
      .filter((g) => {
        return pinned.every((p) => g[`s${p.step}`] === p.text);
      })
      .map((g) => g.gen);
  }, [gens, pinned]);

  React.useEffect(() => {
    model.set("pinned", pinned);
    model.set("gen_ids", passingGenIds);
    model.save_changes();
  }, [pinned, passingGenIds]);

  const togglePin = React.useCallback((step, text) => {
    setPinned((prev) => {
      const exists = prev.some((p) => p.step === step && p.text === text);
      if (exists) {
        return prev.filter((p) => !(p.step === step && p.text === text));
      } else {
        return [...prev, { step, text }];
      }
    });
  }, []);

  React.useEffect(() => {
    if (!containerRef.current || !nodes.length) return;

    const measureCanvas = document.createElement("canvas");
    const ctx = measureCanvas.getContext("2d");

    const fontScale = d3.scaleLinear()
      .domain([1, 24])
      .range([10.5, 21.5])
      .clamp(true);

    const stepsMap = d3.group(nodes, (d) => d.step);
    const stepKeys = Array.from(stepsMap.keys()).sort((a, b) => a - b);

    const colWidths = {};
    stepKeys.forEach((s) => {
      const colNodes = stepsMap.get(s);
      let maxTextW = 0;
      colNodes.forEach((node) => {
        const fs = fontScale(node.n);
        ctx.font = `500 ${fs}px 'Fira Code', monospace`;
        const metrics = ctx.measureText(node.text);
        if (metrics.width > maxTextW) {
          maxTextW = metrics.width;
        }
      });
      colWidths[s] = Math.max(maxTextW, 36);
    });

    const gap = 48;
    const paddingLeft = 32;
    const paddingTop = 36;
    const paddingBottom = 36;

    const colX = {};
    let curX = paddingLeft;
    stepKeys.forEach((s) => {
      colX[s] = curX;
      curX += colWidths[s] + gap;
    });

    const totalWidth = curX - gap + paddingLeft;

    let maxColHeight = 0;
    stepKeys.forEach((s) => {
      const colNodes = stepsMap.get(s);
      let colH = 0;
      colNodes.forEach((node) => {
        const fs = fontScale(node.n);
        colH += fs * 1.35 + 8;
      });
      if (colH > maxColHeight) maxColHeight = colH;
    });

    const totalHeight = Math.max(380, maxColHeight + paddingTop + paddingBottom + 40);
    const centerY = totalHeight / 2;

    const nodePositions = new Map();

    stepKeys.forEach((s) => {
      const rawColNodes = stepsMap.get(s);
      const colNodes = [...rawColNodes].sort((a, b) => b.n - a.n);

      const placed = [];
      colNodes.forEach((node, i) => {
        if (i === 0) {
          placed.push({ ...node, side: "center" });
        } else if (i % 2 === 1) {
          placed.push({ ...node, side: "top" });
        } else {
          placed.push({ ...node, side: "bottom" });
        }
      });

      const topNodes = placed.filter((d) => d.side === "top");
      const bottomNodes = placed.filter((d) => d.side === "bottom");
      const centerNode = placed.find((d) => d.side === "center");

      const fsCenter = fontScale(centerNode.n);
      const hCenter = fsCenter * 1.35;
      const centerPos = {
        step: s,
        text: centerNode.text,
        n: centerNode.n,
        fs: fsCenter,
        h: hCenter,
        y: centerY - hCenter / 2,
        x: colX[s],
        w: colWidths[s]
      };
      nodePositions.set(`${s}:${centerNode.text}`, centerPos);

      let currentTopEdge = centerY - hCenter / 2;
      topNodes.forEach((node) => {
        const fs = fontScale(node.n);
        const h = fs * 1.35;
        const y = currentTopEdge - 8 - h;
        currentTopEdge = y;
        nodePositions.set(`${s}:${node.text}`, {
          step: s,
          text: node.text,
          n: node.n,
          fs,
          h,
          y,
          x: colX[s],
          w: colWidths[s]
        });
      });

      let currentBottomEdge = centerY + hCenter / 2;
      bottomNodes.forEach((node) => {
        const fs = fontScale(node.n);
        const h = fs * 1.35;
        const y = currentBottomEdge + 8;
        currentBottomEdge = y + h;
        nodePositions.set(`${s}:${node.text}`, {
          step: s,
          text: node.text,
          n: node.n,
          fs,
          h,
          y,
          x: colX[s],
          w: colWidths[s]
        });
      });
    });

    const linkThicknessScale = d3.scaleLinear()
      .domain([1, 24])
      .range([1.4, 18])
      .clamp(true);

    const stepOutTotals = {};
    const stepInTotals = {};
    links.forEach((l) => {
      const srcKey = `${l.step}:${l.source}`;
      const tgtKey = `${l.step + 1}:${l.target}`;
      stepOutTotals[srcKey] = (stepOutTotals[srcKey] || 0) + l.n;
      stepInTotals[tgtKey] = (stepInTotals[tgtKey] || 0) + l.n;
    });

    const stepOutProgress = {};
    const stepInProgress = {};

    const ribbonData = links.map((link, idx) => {
      const srcKey = `${link.step}:${link.source}`;
      const tgtKey = `${link.step + 1}:${link.target}`;
      const srcPos = nodePositions.get(srcKey);
      const tgtPos = nodePositions.get(tgtKey);

      if (!srcPos || !tgtPos) return null;

      const totalOut = stepOutTotals[srcKey] || 1;
      const totalIn = stepInTotals[tgtKey] || 1;

      const outStart = stepOutProgress[srcKey] || 0;
      stepOutProgress[srcKey] = outStart + link.n;

      const inStart = stepInProgress[tgtKey] || 0;
      stepInProgress[tgtKey] = inStart + link.n;

      const srcY0 = srcPos.y + (outStart / totalOut) * srcPos.h;
      const srcY1 = srcPos.y + ((outStart + link.n) / totalOut) * srcPos.h;
      const tgtY0 = tgtPos.y + (inStart / totalIn) * tgtPos.h;
      const tgtY1 = tgtPos.y + ((inStart + link.n) / totalIn) * tgtPos.h;

      const x0 = srcPos.x + srcPos.w;
      const x1 = tgtPos.x;
      const xi = d3.interpolateNumber(x0, x1);
      const x2 = xi(0.48);
      const x3 = xi(0.52);

      const pathStr = `M ${x0} ${srcY0} C ${x2} ${srcY0}, ${x3} ${tgtY0}, ${x1} ${tgtY0} L ${x1} ${tgtY1} C ${x3} ${tgtY1}, ${x2} ${srcY1}, ${x0} ${srcY1} Z`;

      const gensWithLink = gens.filter(
        (g) => g[`s${link.step}`] === link.source && g[`s${link.step + 1}`] === link.target
      ).map((g) => g.gen);

      return {
        id: `ribbon-${idx}`,
        step: link.step,
        source: link.source,
        target: link.target,
        n: link.n,
        gens: gensWithLink,
        d: pathStr
      };
    }).filter(Boolean);

    const spanGensMap = new Map();
    nodes.forEach((nd) => {
      const list = gens.filter((g) => g[`s${nd.step}`] === nd.text).map((g) => g.gen);
      spanGensMap.set(`${nd.step}:${nd.text}`, new Set(list));
    });

    layoutRef.current = {
      totalWidth,
      totalHeight,
      nodePositions,
      ribbonData,
      spanGensMap,
      stepKeys,
      colX,
      colWidths
    };

    d3.select(containerRef.current).selectAll("*").remove();

    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr("width", totalWidth)
      .attr("height", totalHeight)
      .style("display", "block")
      .style("background", "transparent")
      .style("overflow", "visible");

    svgRef.current = svg;

    const defs = svg.append("defs");
    const filter = defs.append("filter")
      .attr("id", "pin-glow")
      .attr("x", "-20%")
      .attr("y", "-20%")
      .attr("width", "140%")
      .attr("height", "140%");
    filter.append("feDropShadow")
      .attr("dx", "0")
      .attr("dy", "1")
      .attr("stdDeviation", "2")
      .attr("flood-color", "#ea580c")
      .attr("flood-opacity", "0.25");

    const ribbonsGroup = svg.append("g").attr("class", "ribbons-layer");
    const nodesGroup = svg.append("g").attr("class", "nodes-layer");

    const ribbons = ribbonsGroup.selectAll("path.ribbon")
      .data(ribbonData, (d) => d.id)
      .enter()
      .append("path")
      .attr("class", "ribbon")
      .attr("d", (d) => d.d)
      .attr("fill", "#94a3b8")
      .attr("fill-opacity", 0.32)
      .attr("stroke", "#64748b")
      .attr("stroke-width", 0.5)
      .attr("stroke-opacity", 0.2)
      .style("transition", "fill-opacity 0.22s ease, fill 0.22s ease, stroke-opacity 0.22s ease");

    const nodeItems = Array.from(nodePositions.values());

    const nodeG = nodesGroup.selectAll("g.span-node")
      .data(nodeItems, (d) => `${d.step}:${d.text}`)
      .enter()
      .append("g")
      .attr("class", "span-node")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .style("cursor", "pointer");

    nodeG.append("rect")
      .attr("class", "span-bg")
      .attr("x", -4)
      .attr("y", -2)
      .attr("width", (d) => d.w + 8)
      .attr("height", (d) => d.h + 4)
      .attr("rx", 3)
      .attr("fill", "transparent")
      .attr("stroke", "transparent")
      .attr("stroke-width", 1.5);

    nodeG.append("text")
      .attr("class", "span-text")
      .attr("x", 0)
      .attr("y", (d) => d.h * 0.78)
      .attr("font-family", "'Fira Code', 'Pitch', monospace")
      .attr("font-size", (d) => `${d.fs}px`)
      .attr("font-weight", 500)
      .attr("fill", "#27272a")
      .text((d) => d.text);

    nodeG
      .on("mouseenter", function (event, d) {
        setHoveredSpan({ step: d.step, text: d.text });
        const bbox = event.currentTarget.getBoundingClientRect();
        const wrapperBox = containerRef.current.parentElement.getBoundingClientRect();
        setTooltip({
          x: bbox.left - wrapperBox.left + bbox.width / 2,
          y: bbox.top - wrapperBox.top - 8,
          text: `${d.n} of 24 generations`
        });
      })
      .on("mousemove", function (event, d) {
        const bbox = event.currentTarget.getBoundingClientRect();
        const wrapperBox = containerRef.current.parentElement.getBoundingClientRect();
        setTooltip((prev) => (prev ? {
          x: bbox.left - wrapperBox.left + bbox.width / 2,
          y: bbox.top - wrapperBox.top - 8,
          text: `${d.n} of 24 generations`
        } : null));
      })
      .on("mouseleave", function () {
        setHoveredSpan(null);
        setTooltip(null);
      })
      .on("click", function (event, d) {
        togglePin(d.step, d.text);
      });

    return () => {
      svg.remove();
    };
  }, [nodes, links, gens, togglePin]);

  React.useEffect(() => {
    if (!svgRef.current || !layoutRef.current) return;
    const { ribbonData, spanGensMap } = layoutRef.current;

    let targetGens = null;

    if (activeGen !== null && activeGen !== undefined) {
      targetGens = new Set([activeGen]);
    } else if (hoveredSpan) {
      const key = `${hoveredSpan.step}:${hoveredSpan.text}`;
      targetGens = spanGensMap.get(key) || new Set();
    } else if (pinned.length > 0) {
      targetGens = new Set(passingGenIds);
    }

    const isFiltering = targetGens !== null;

    svgRef.current.selectAll("path.ribbon")
      .each(function (d) {
        if (!isFiltering) {
          d3.select(this)
            .attr("fill", "#94a3b8")
            .attr("fill-opacity", 0.3)
            .attr("stroke", "#64748b")
            .attr("stroke-opacity", 0.2);
        } else {
          const hasCommon = d.gens.some((g) => targetGens.has(g));
          if (hasCommon) {
            d3.select(this)
              .attr("fill", "#1e293b")
              .attr("fill-opacity", 0.85)
              .attr("stroke", "#0f172a")
              .attr("stroke-opacity", 0.95)
              .raise();
          } else {
            d3.select(this)
              .attr("fill", "#cbd5e1")
              .attr("fill-opacity", 0.06)
              .attr("stroke", "transparent")
              .attr("stroke-opacity", 0);
          }
        }
      });

    svgRef.current.selectAll("g.span-node").each(function (d) {
      const g = d3.select(this);
      const isPinned = pinned.some((p) => p.step === d.step && p.text === d.text);
      const spanGens = spanGensMap.get(`${d.step}:${d.text}`) || new Set();

      let onActivePath = true;
      if (isFiltering && targetGens.size > 0) {
        let hasOverlap = false;
        for (const genId of targetGens) {
          if (spanGens.has(genId)) {
            hasOverlap = true;
            break;
          }
        }
        onActivePath = hasOverlap;
      }

      const textEl = g.select("text.span-text");
      const bgEl = g.select("rect.span-bg");

      if (isPinned) {
        textEl
          .attr("fill", "#ea580c")
          .attr("font-weight", 700)
          .attr("opacity", 1);
        bgEl
          .attr("fill", "#fff7ed")
          .attr("stroke", "#ea580c")
          .attr("stroke-width", 1.8)
          .attr("opacity", 1);
      } else if (isFiltering) {
        if (onActivePath) {
          textEl
            .attr("fill", "#0f172a")
            .attr("font-weight", 600)
            .attr("opacity", 1);
          bgEl
            .attr("fill", "#f8fafc")
            .attr("stroke", "#94a3b8")
            .attr("stroke-width", 1)
            .attr("opacity", 0.6);
        } else {
          textEl
            .attr("fill", "#94a3b8")
            .attr("font-weight", 400)
            .attr("opacity", 0.22);
          bgEl
            .attr("fill", "transparent")
            .attr("stroke", "transparent")
            .attr("opacity", 0);
        }
      } else {
        textEl
          .attr("fill", "#1e293b")
          .attr("font-weight", 500)
          .attr("opacity", 1);
        bgEl
          .attr("fill", "transparent")
          .attr("stroke", "transparent")
          .attr("opacity", 0);
      }
    });
  }, [hoveredSpan, pinned, activeGen, passingGenIds]);

  return (
    <div
      style={{
        background: "#fbf9f5",
        color: "#221d17",
        padding: "24px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxSizing: "border-box",
        minHeight: "560px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        position: "relative"
      }}
    >
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        borderBottom: "1px solid #e7dfd3",
        paddingBottom: "12px"
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: "22px",
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: "700",
            letterSpacing: "-0.01em",
            color: "#1c1917"
          }}>
            Generation Consistency Flow
          </h1>
          <p style={{
            margin: "4px 0 0 0",
            fontSize: "12px",
            color: "#78716c",
            fontFamily: "'Fira Code', monospace"
          }}>
            24 completions from one prompt &bull; step-by-step token divergence
          </p>
        </div>

        {pinned.length > 0 && (
          <button
            onClick={() => setPinned([])}
            style={{
              background: "#fed7aa",
              border: "1px solid #fdba74",
              color: "#9a3412",
              padding: "4px 10px",
              borderRadius: "4px",
              fontFamily: "'Fira Code', monospace",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.15s ease"
            }}
          >
            Clear Pins ({pinned.length})
          </button>
        )}
      </header>

      <div
        style={{
          position: "relative",
          background: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #ede7de",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          overflowX: "auto",
          overflowY: "hidden",
          minHeight: "380px"
        }}
      >
        <div ref={containerRef} />

        {tooltip && (
          <div
            style={{
              position: "absolute",
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`,
              transform: "translate(-50%, -100%)",
              background: "#1c1917",
              color: "#fbf9f5",
              fontSize: "11px",
              fontFamily: "'Fira Code', monospace",
              padding: "4px 8px",
              borderRadius: "4px",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              boxShadow: "0 4px 10px rgba(0,0,0,0.18)",
              zIndex: 100
            }}
          >
            {tooltip.text}
          </div>
        )}
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <h2 style={{
          margin: 0,
          fontSize: "13px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#857866",
          fontWeight: 700,
          fontFamily: "'Fira Code', monospace"
        }}>
          Traced Generations
        </h2>
        <GenerationsList
          gens={gens}
          pinned={pinned}
          passingIds={passingGenIds}
          activeGen={activeGen}
          onSelectGen={setActiveGen}
        />
      </section>
    </div>
  );
}