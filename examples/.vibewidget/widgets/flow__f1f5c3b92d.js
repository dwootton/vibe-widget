import * as d3 from "https://esm.sh/d3@7";

// Helper to normalize tabular data if sent as records or dict of arrays
function normalizeData(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    const keys = Object.keys(raw);
    if (keys.length === 0) return [];
    const n = Array.isArray(raw[keys[0]]) ? raw[keys[0]].length : 0;
    const rows = [];
    for (let i = 0; i < n; i++) {
      const row = {};
      for (const k of keys) {
        row[k] = raw[k][i];
      }
      rows.push(row);
    }
    return rows;
  }
  return [];
}

export const GenerationList = ({ generations, pinned, React }) => {
  if (!generations || generations.length === 0) {
    return (
      <div style={{
        padding: "16px 20px",
        color: "#6b7280",
        fontStyle: "italic",
        fontSize: "14px",
        fontFamily: "'Courier New', Courier, monospace",
        background: "rgba(244, 240, 230, 0.5)",
        borderRadius: "8px",
        border: "1px dashed #d1cfc7",
        marginTop: "14px"
      }}>
        No generations match all pinned spans.
      </div>
    );
  }

  const pinnedSet = new Set(
    (pinned || []).map((p) => `${p.step}:${p.text}`)
  );

  return (
    <div style={{
      marginTop: "18px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      maxHeight: "260px",
      overflowY: "auto",
      paddingRight: "8px"
    }}>
      {generations.map((genObj) => {
        const id = genObj.gen;
        const spans = [];
        for (let s = 0; s <= 9; s++) {
          const val = genObj[`s${s}`];
          if (val !== undefined && val !== null) {
            spans.push({ step: s, text: String(val) });
          }
        }

        return (
          <div
            key={id}
            style={{
              padding: "10px 14px",
              background: "#ffffff",
              border: "1px solid #e5e2da",
              borderRadius: "6px",
              fontSize: "13px",
              fontFamily: "'Courier New', Courier, monospace",
              lineHeight: 1.6,
              color: "#1f242e",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
            }}
          >
            <span style={{
              display: "inline-block",
              fontSize: "11px",
              fontWeight: 700,
              color: "#7b7267",
              marginRight: "10px",
              letterSpacing: "0.5px",
              textTransform: "uppercase"
            }}>
              #{id + 1}
            </span>
            {spans.map((sp, idx) => {
              const isPinned = pinnedSet.has(`${sp.step}:${sp.text}`);
              return (
                <span
                  key={idx}
                  style={{
                    backgroundColor: isPinned ? "#ffedd5" : "transparent",
                    color: isPinned ? "#c2410c" : "#1f242e",
                    fontWeight: isPinned ? 700 : 400,
                    padding: isPinned ? "2px 5px" : "0 2px",
                    borderRadius: isPinned ? "4px" : "0",
                    border: isPinned ? "1px solid #fdba74" : "none",
                    margin: "0 2px"
                  }}
                >
                  {sp.text}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default function Widget({ model, React }) {
  // Retrieve raw inputs
  const rawNodes = model.get("data");
  const rawLinks = model.get("links");
  const rawGens = model.get("gens");

  const [tick, setTick] = React.useState(0);
  const [pinned, setPinned] = React.useState([]);

  // Refs
  const svgRef = React.useRef(null);
  const hoverRef = React.useRef(null); // active hover target: {step, text}
  const pinnedRef = React.useRef([]);
  pinnedRef.current = pinned;

  // Subscribe to changes from Python model
  React.useEffect(() => {
    const onChange = () => setTick((t) => t + 1);
    model.on("change:data", onChange);
    model.on("change:links", onChange);
    model.on("change:gens", onChange);
    return () => {
      model.off("change:data", onChange);
      model.off("change:links", onChange);
      model.off("change:gens", onChange);
    };
  }, [model]);

  // Parse and normalize data
  const nodes = React.useMemo(() => {
    const list = normalizeData(rawNodes);
    return list.map((d) => ({
      step: Number(d.step),
      text: String(d.text),
      n: Number(d.n)
    }));
  }, [rawNodes, tick]);

  const links = React.useMemo(() => {
    const list = normalizeData(rawLinks);
    return list.map((d) => ({
      step: Number(d.step),
      source: String(d.source),
      target: String(d.target),
      n: Number(d.n)
    }));
  }, [rawLinks, tick]);

  const gens = React.useMemo(() => {
    return normalizeData(rawGens);
  }, [rawGens, tick]);

  // Compute passing generation IDs based on pinned spans
  const passingGenIds = React.useMemo(() => {
    if (!pinned || pinned.length === 0) {
      return gens.map((g) => Number(g.gen));
    }
    return gens
      .filter((g) => {
        return pinned.every((p) => {
          const val = g[`s${p.step}`];
          return val !== undefined && String(val) === p.text;
        });
      })
      .map((g) => Number(g.gen));
  }, [gens, pinned]);

  // Sync outputs to Python model
  React.useEffect(() => {
    model.set("pinned", pinned);
    model.set("gen_ids", passingGenIds);
    model.save_changes();
  }, [pinned, passingGenIds, model]);

  // Initialize outputs immediately on mount
  React.useEffect(() => {
    model.set({
      pinned: [],
      gen_ids: gens.map((g) => Number(g.gen))
    });
    model.save_changes();
  }, [model]);

  // Fast lookup tables for styling and hover/pin tracing
  const meta = React.useMemo(() => {
    // Map node key -> array of gen IDs
    const nodeGens = new Map();
    // Map link key -> array of gen IDs
    const linkGens = new Map();

    gens.forEach((g) => {
      const gid = Number(g.gen);
      for (let s = 0; s <= 9; s++) {
        const val = g[`s${s}`];
        if (val !== undefined && val !== null) {
          const nKey = `${s}:::${String(val)}`;
          if (!nodeGens.has(nKey)) nodeGens.set(nKey, []);
          nodeGens.get(nKey).push(gid);
        }
      }
      for (let s = 0; s < 9; s++) {
        const sVal = g[`s${s}`];
        const tVal = g[`s${s + 1}`];
        if (sVal !== undefined && tVal !== undefined) {
          const lKey = `${s}:::${String(sVal)}:::${String(tVal)}`;
          if (!linkGens.has(lKey)) linkGens.set(lKey, []);
          linkGens.get(lKey).push(gid);
        }
      }
    });

    return { nodeGens, linkGens };
  }, [gens]);

  // Imperative visual state updater (smooth highlight/fade without recreating SVG)
  const updateVisualHighlights = React.useCallback(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const activeHover = hoverRef.current;
    const currentPinned = pinnedRef.current;

    const hasHover = activeHover !== null;
    const hasPins = currentPinned.length > 0;

    // Determine relevant gens for hover
    let hoverGenSet = null;
    if (hasHover) {
      const key = `${activeHover.step}:::${activeHover.text}`;
      const gList = meta.nodeGens.get(key) || [];
      hoverGenSet = new Set(gList);
    }

    // Determine relevant gens for pins
    let pinGenSet = null;
    if (hasPins) {
      pinGenSet = new Set(passingGenIds);
    }

    // Update Ribbons / Links
    svg.selectAll(".flow-ribbon").each(function () {
      const ribbon = d3.select(this);
      const lKey = ribbon.attr("data-link-key");
      const lGenList = meta.linkGens.get(lKey) || [];

      let isHoverActive = false;
      if (hasHover && hoverGenSet) {
        isHoverActive = lGenList.some((gid) => hoverGenSet.has(gid));
      }

      let isPinActive = false;
      if (hasPins && pinGenSet) {
        isPinActive = lGenList.some((gid) => pinGenSet.has(gid));
      }

      if (hasHover) {
        if (isHoverActive) {
          ribbon
            .style("stroke", "#1e293b")
            .style("stroke-opacity", 0.85);
        } else {
          ribbon
            .style("stroke", "#94a3b8")
            .style("stroke-opacity", 0.08);
        }
      } else if (hasPins) {
        if (isPinActive) {
          ribbon
            .style("stroke", "#ea580c")
            .style("stroke-opacity", 0.7);
        } else {
          ribbon
            .style("stroke", "#94a3b8")
            .style("stroke-opacity", 0.12);
        }
      } else {
        // default resting state
        ribbon
          .style("stroke", "#93c5fd")
          .style("stroke-opacity", 0.42);
      }
    });

    // Update Nodes / Spans
    const pinnedKeySet = new Set(
      currentPinned.map((p) => `${p.step}:::${p.text}`)
    );

    svg.selectAll(".node-group").each(function () {
      const gNode = d3.select(this);
      const nKey = gNode.attr("data-node-key");
      const nGenList = meta.nodeGens.get(nKey) || [];

      const isThisPinned = pinnedKeySet.has(nKey);

      let isHoverActive = false;
      if (hasHover && hoverGenSet) {
        isHoverActive = nGenList.some((gid) => hoverGenSet.has(gid));
      }

      let isPinActive = false;
      if (hasPins && pinGenSet) {
        isPinActive = nGenList.some((gid) => pinGenSet.has(gid));
      }

      const textEl = gNode.select("text");
      const bgPill = gNode.select(".node-pill");

      if (isThisPinned) {
        textEl
          .style("fill", "#c2410c")
          .style("font-weight", "800")
          .style("opacity", 1);
        bgPill
          .style("fill", "#ffedd5")
          .style("stroke", "#ea580c")
          .style("stroke-width", "1.5px")
          .style("opacity", 1);
      } else if (hasHover) {
        if (isHoverActive) {
          textEl
            .style("fill", "#0f172a")
            .style("font-weight", "600")
            .style("opacity", 1);
          bgPill
            .style("fill", "#f1f5f9")
            .style("stroke", "#cbd5e1")
            .style("stroke-width", "1px")
            .style("opacity", 0.9);
        } else {
          textEl
            .style("fill", "#64748b")
            .style("font-weight", "400")
            .style("opacity", 0.2);
          bgPill.style("opacity", 0);
        }
      } else if (hasPins) {
        if (isPinActive) {
          textEl
            .style("fill", "#1e293b")
            .style("font-weight", "600")
            .style("opacity", 1);
          bgPill
            .style("fill", "#f8fafc")
            .style("stroke", "#e2e8f0")
            .style("stroke-width", "1px")
            .style("opacity", 0.6);
        } else {
          textEl
            .style("fill", "#94a3b8")
            .style("font-weight", "400")
            .style("opacity", 0.25);
          bgPill.style("opacity", 0);
        }
      } else {
        // Resting
        textEl
          .style("fill", "#1e293b")
          .style("font-weight", "500")
          .style("opacity", 0.9);
        bgPill.style("opacity", 0);
      }
    });
  }, [meta, passingGenIds]);

  // Toggle pin on click
  const handleNodeClick = React.useCallback((step, text) => {
    setPinned((prev) => {
      const exists = prev.some((p) => p.step === step && p.text === text);
      if (exists) {
        return prev.filter((p) => !(p.step === step && p.text === text));
      } else {
        return [...prev, { step, text }];
      }
    });
  }, []);

  // Update visuals whenever pinned items or passing gens change
  React.useEffect(() => {
    updateVisualHighlights();
  }, [pinned, passingGenIds, updateVisualHighlights]);

  // Main diagram construction effect - builds SVG layout
  React.useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Responsive sizing parameters
    const width = 1180;
    const height = 440;
    const margin = { top: 40, right: 60, bottom: 30, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Steps range from 0 to 9
    const steps = Array.from(new Set(nodes.map((d) => d.step))).sort(
      (a, b) => a - b
    );
    const stepCount = steps.length || 10;
    const colStep = innerWidth / (stepCount - 1);

    // Font size scale: largest ~26px, smallest ~11px
    const minN = d3.min(nodes, (d) => d.n) || 1;
    const maxN = d3.max(nodes, (d) => d.n) || 24;
    const fontScale = d3
      .scaleSqrt()
      .domain([minN, maxN])
      .range([11, 26]);

    // Stroke width scale proportional to link n
    const minLinkN = d3.min(links, (d) => d.n) || 1;
    const maxLinkN = d3.max(links, (d) => d.n) || 16;
    const strokeScale = d3
      .scaleLinear()
      .domain([minLinkN, maxLinkN])
      .range([1.5, 14]);

    // Group nodes by step and position with most common at vertical center
    // and rarer ones fanning above and below
    const nodeCoords = new Map(); // key -> { x, y, fontSize, n, text, step }

    steps.forEach((stepIdx) => {
      const colNodes = nodes
        .filter((d) => d.step === stepIdx)
        .sort((a, b) => b.n - a.n); // Descending by frequency

      const colX = margin.left + stepIdx * colStep;
      const centerY = margin.top + innerHeight / 2;

      // Arrange nodes: 0 at center, 1 above, 2 below, 3 above, 4 below...
      const arranged = [];
      let up = true;
      let aboveOffset = 0;
      let belowOffset = 0;

      colNodes.forEach((node, i) => {
        const fs = fontScale(node.n);
        const itemSpacing = fs + 8;
        let y = centerY;

        if (i === 0) {
          y = centerY;
        } else if (up) {
          aboveOffset += itemSpacing;
          y = centerY - aboveOffset;
          up = false;
        } else {
          belowOffset += itemSpacing;
          y = centerY + belowOffset;
          up = true;
        }

        const key = `${stepIdx}:::${node.text}`;
        const record = {
          x: colX,
          y,
          fontSize: fs,
          n: node.n,
          text: node.text,
          step: stepIdx
        };
        arranged.push(record);
        nodeCoords.set(key, record);
      });
    });

    // Create main groups
    const gLinks = svg.append("g").attr("class", "links-layer");
    const gNodes = svg.append("g").attr("class", "nodes-layer");

    // Draw smooth ribbons between source and target
    links.forEach((l) => {
      const srcKey = `${l.step}:::${l.source}`;
      const tgtKey = `${l.step + 1}:::${l.target}`;
      const sPos = nodeCoords.get(srcKey);
      const tPos = nodeCoords.get(tgtKey);

      if (!sPos || !tPos) return;

      const linkKey = `${l.step}:::${l.source}:::${l.target}`;
      const sw = strokeScale(l.n);

      // Smooth horizontal cubic bezier curve
      const dx = (tPos.x - sPos.x) * 0.52;
      const pathD = `M ${sPos.x} ${sPos.y} C ${sPos.x + dx} ${sPos.y}, ${tPos.x - dx} ${tPos.y}, ${tPos.x} ${tPos.y}`;

      gLinks
        .append("path")
        .attr("class", "flow-ribbon")
        .attr("data-link-key", linkKey)
        .attr("d", pathD)
        .attr("fill", "none")
        .attr("stroke-linecap", "round")
        .style("stroke-width", `${sw}px`)
        .style("stroke", "#93c5fd")
        .style("stroke-opacity", 0.42)
        .style("transition", "stroke 0.25s ease, stroke-opacity 0.25s ease");
    });

    // Draw nodes
    nodeCoords.forEach((node, key) => {
      const nodeG = gNodes
        .append("g")
        .attr("class", "node-group")
        .attr("data-node-key", key)
        .attr("transform", `translate(${node.x}, ${node.y})`)
        .style("cursor", "pointer");

      // Approximate text width for background pill
      const approxCharWidth = node.fontSize * 0.62;
      const pillWidth = Math.max(34, node.text.length * approxCharWidth + 12);
      const pillHeight = node.fontSize + 8;

      const pill = nodeG
        .append("rect")
        .attr("class", "node-pill")
        .attr("x", -pillWidth / 2)
        .attr("y", -pillHeight / 2)
        .attr("width", pillWidth)
        .attr("height", pillHeight)
        .attr("rx", 4)
        .attr("ry", 4)
        .style("fill", "#ffffff")
        .style("opacity", 0)
        .style("transition", "all 0.2s ease");

      const txt = nodeG
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .text(node.text)
        .style("font-family", "'Courier New', Courier, monospace")
        .style("font-size", `${node.fontSize}px`)
        .style("fill", "#1e293b")
        .style("user-select", "none")
        .style("transition", "fill 0.2s ease, opacity 0.2s ease");

      // Tooltip: 'n of 24 generations'
      nodeG.append("title").text(`${node.n} of 24 generations`);

      // Event handlers
      nodeG.on("pointerenter", () => {
        hoverRef.current = { step: node.step, text: node.text };
        updateVisualHighlights();
      });

      nodeG.on("pointerleave", () => {
        hoverRef.current = null;
        updateVisualHighlights();
      });

      nodeG.on("click", (evt) => {
        evt.stopPropagation();
        handleNodeClick(node.step, node.text);
      });
    });

    // Initial highlight pass
    updateVisualHighlights();

    return () => {
      svg.selectAll("*").remove();
    };
  }, [nodes, links, handleNodeClick, updateVisualHighlights]);

  // Filtered generations list for display
  const matchingGenerations = React.useMemo(() => {
    if (!pinned || pinned.length === 0) return [];
    return gens.filter((g) => {
      return pinned.every((p) => {
        const val = g[`s${p.step}`];
        return val !== undefined && String(val) === p.text;
      });
    });
  }, [gens, pinned]);

  const hasPins = pinned.length > 0;

  return (
    <section
      style={{
        width: "100%",
        maxWidth: "1220px",
        margin: "0 auto",
        backgroundColor: "#fdfbf7",
        color: "#1e293b",
        fontFamily: "'Courier New', Courier, monospace",
        padding: "24px 28px",
        boxSizing: "border-box",
        borderRadius: "10px",
        border: "1px solid #e9e5dc",
        boxShadow: "0 4px 16px rgba(0,0,0,0.03)"
      }}
    >
      {/* Title & Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        borderBottom: "1px solid #e2ddd3",
        paddingBottom: "14px",
        marginBottom: "16px"
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: "24px",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontWeight: 700,
            color: "#18181b",
            letterSpacing: "-0.5px"
          }}>
            Prompt Consistency Flow
          </h2>
          <div style={{
            fontSize: "13px",
            color: "#78716c",
            marginTop: "4px"
          }}>
            Trace token span divergence across 24 parallel completions.
          </div>
        </div>

        {/* Pin status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {hasPins && (
            <button
              onClick={() => setPinned([])}
              style={{
                background: "none",
                border: "1px solid #d6d3cd",
                padding: "3px 10px",
                borderRadius: "4px",
                fontSize: "12px",
                fontFamily: "inherit",
                cursor: "pointer",
                color: "#78716c",
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => (e.target.style.color = "#ea580c")}
              onMouseLeave={(e) => (e.target.style.color = "#78716c")}
            >
              Clear pins
            </button>
          )}
          <span style={{
            fontSize: "12px",
            fontWeight: 600,
            color: hasPins ? "#ea580c" : "#a8a29e",
            textTransform: "uppercase",
            letterSpacing: "0.5px"
          }}>
            {hasPins
              ? `${pinned.length} pinned span${pinned.length > 1 ? "s" : ""} • ${passingGenIds.length} match${passingGenIds.length === 1 ? "" : "es"}`
              : "0 pinned"}
          </span>
        </div>
      </div>

      {/* SVG Canvas for Flow Visualization */}
      <div style={{
        overflowX: "auto",
        background: "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.7) 0%, rgba(253,251,247,0) 100%)",
        borderRadius: "8px",
        border: "1px solid #f0ede6"
      }}>
        <svg
          ref={svgRef}
          viewBox="0 0 1180 440"
          style={{
            display: "block",
            width: "100%",
            height: "auto",
            minWidth: "860px"
          }}
        />
      </div>

      {/* Under-diagram Section */}
      <div style={{ marginTop: "20px" }}>
        {!hasPins ? (
          <div style={{
            padding: "16px",
            textAlign: "center",
            color: "#78716c",
            fontSize: "13px",
            background: "rgba(245, 242, 234, 0.45)",
            border: "1px dashed #dcd8ce",
            borderRadius: "6px",
            letterSpacing: "0.3px"
          }}>
            hover to trace, click to pin
          </div>
        ) : (
          <div>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span style={{
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: "#57534e"
              }}>
                Filtered Generations ({matchingGenerations.length} of 24)
              </span>
            </div>

            <GenerationList
              generations={matchingGenerations}
              pinned={pinned}
              React={React}
            />
          </div>
        )}
      </div>
    </section>
  );
}