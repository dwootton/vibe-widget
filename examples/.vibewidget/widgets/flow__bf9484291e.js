import * as d3 from "https://esm.sh/d3@7";

function parseDataFrame(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "object") {
    // Check if columnar
    const keys = Object.keys(val);
    if (keys.length === 0) return [];
    if (Array.isArray(val[keys[0]])) {
      const len = val[keys[0]].length;
      const rows = [];
      for (let i = 0; i < len; i++) {
        const row = {};
        for (const k of keys) row[k] = val[k][i];
        rows.push(row);
      }
      return rows;
    }
  }
  return [];
}

export const ConsistencyDiagram = ({
  model,
  React,
  nodesData,
  linksData,
  gensData,
  pinned,
  setPinned,
  hoveredNode,
  setHoveredNode,
}) => {
  const containerRef = React.useRef(null);
  const tooltipRef = React.useRef(null);

  // Compute layout and rendering data
  const layout = React.useMemo(() => {
    if (!nodesData.length) return null;

    // Steps
    const steps = Array.from(new Set(nodesData.map((d) => Number(d.step)))).sort((a, b) => a - b);
    const nExtent = d3.extent(nodesData, (d) => Number(d.n));
    const minN = nExtent[0] || 1;
    const maxN = nExtent[1] || 24;

    // Font size scale
    const fontScale = (n) => {
      if (maxN === minN) return 14;
      return 10 + ((n - minN) / (maxN - minN)) * 12; // 10px to 22px
    };

    // Group nodes by step
    const nodesByStep = new Map();
    steps.forEach((s) => nodesByStep.set(s, []));
    nodesData.forEach((d) => {
      const s = Number(d.step);
      if (nodesByStep.has(s)) {
        nodesByStep.get(s).push({
          step: s,
          text: String(d.text),
          n: Number(d.n),
          fontSize: fontScale(Number(d.n)),
        });
      }
    });

    // Estimate monospace width: ~0.60 * fontSize * text.length
    const colWidths = new Map();
    steps.forEach((s) => {
      const list = nodesByStep.get(s) || [];
      let maxW = 40;
      list.forEach((item) => {
        const estW = item.text.length * (item.fontSize * 0.62) + 16;
        if (estW > maxW) maxW = estW;
      });
      colWidths.set(s, Math.ceil(maxW));
    });

    // Column X positions (each column as wide as longest text + 48px gap)
    const gap = 48;
    const colX = new Map();
    let currentX = 24;
    steps.forEach((s) => {
      colX.set(s, currentX);
      currentX += colWidths.get(s) + gap;
    });
    const totalWidth = Math.max(currentX + 24, 760);

    // Height calculation and vertical positioning
    // "in each column the spans are stacked with the most common at the vertical centre and rarer ones fanning above and below with at least 6px between them"
    // Find column with most vertical space requirement
    let maxColH = 340;
    steps.forEach((s) => {
      const list = nodesByStep.get(s) || [];
      const h = list.reduce((acc, it) => acc + it.fontSize + 12, 0);
      if (h > maxColH) maxColH = h;
    });
    const totalHeight = Math.max(380, maxColH + 80);
    const centerY = totalHeight / 2;

    const nodePositions = new Map(); // key: `${step}:::${text}` -> {x, y, w, h, step, text, n, fontSize}

    steps.forEach((s) => {
      const list = (nodesByStep.get(s) || []).slice();
      // Sort descending by n so most common is first
      list.sort((a, b) => b.n - a.n);

      if (list.length === 0) return;

      // Fan out: item 0 at center, item 1 above, item 2 below, item 3 above, item 4 below, etc.
      // Order of placement in list: above list, center, below list
      const above = [];
      const below = [];
      const centerItem = list[0];

      for (let i = 1; i < list.length; i++) {
        if (i % 2 === 1) {
          above.unshift(list[i]); // rarer ones further up
        } else {
          below.push(list[i]); // rarer ones further down
        }
      }

      const ordered = [...above, centerItem, ...below];
      const minGap = 8;

      // Heights of items
      const itemHeights = ordered.map((it) => it.fontSize + 6);
      const totalSpanH =
        itemHeights.reduce((a, b) => a + b, 0) + (ordered.length - 1) * minGap;
      let startY = centerY - totalSpanH / 2;

      ordered.forEach((it, idx) => {
        const itemH = itemHeights[idx];
        const y = startY + itemH / 2;
        const x = colX.get(s);
        nodePositions.set(`${s}:::${it.text}`, {
          ...it,
          x,
          y,
          width: colWidths.get(s),
          height: itemH,
        });
        startY += itemH + minGap;
      });
    });

    // Links layout
    // link n max
    const maxLinkN = d3.max(linksData, (d) => Number(d.n)) || 1;
    const strokeScale = (n) => {
      return Math.max(1.2, (Number(n) / maxLinkN) * 14);
    };

    const linksList = linksData.map((d) => {
      const s = Number(d.step);
      const sourceKey = `${s}:::${d.source}`;
      const targetKey = `${s + 1}:::${d.target}`;
      const sPos = nodePositions.get(sourceKey);
      const tPos = nodePositions.get(targetKey);
      return {
        step: s,
        source: String(d.source),
        target: String(d.target),
        n: Number(d.n),
        sourcePos: sPos,
        targetPos: tPos,
        width: strokeScale(d.n),
      };
    });

    return {
      steps,
      colX,
      colWidths,
      totalWidth,
      totalHeight,
      nodePositions,
      linksList,
    };
  }, [nodesData, linksData]);

  // Which generations pass through hover/pin
  // Map generation id -> path of {step, text}
  const genPaths = React.useMemo(() => {
    return gensData.map((g) => {
      const stepVals = {};
      for (let s = 0; s <= 9; s++) {
        if (g[`s${s}`] !== undefined) {
          stepVals[s] = String(g[`s${s}`]);
        }
      }
      return {
        gen: Number(g.gen),
        stepVals,
        text: String(g.text || ""),
      };
    });
  }, [gensData]);

  // Determine active/highlighted links and nodes based on hover & pin
  const activeGenIds = React.useMemo(() => {
    // If hovering a span: find all gen_ids containing hovered span
    if (hoveredNode) {
      const { step, text } = hoveredNode;
      const matchingGens = new Set();
      genPaths.forEach((g) => {
        if (g.stepVals[step] === text) {
          matchingGens.add(g.gen);
        }
      });
      return matchingGens;
    }
    // If pinned spans exist: find gens passing ALL pinned spans
    if (pinned.length > 0) {
      const matchingGens = new Set();
      genPaths.forEach((g) => {
        const passesAll = pinned.every((p) => g.stepVals[p.step] === p.text);
        if (passesAll) matchingGens.add(g.gen);
      });
      return matchingGens;
    }
    return null; // nothing active -> default state
  }, [hoveredNode, pinned, genPaths]);

  // Ribbon generator
  const ribbonPath = (sX, sY, tX, tY) => {
    const dx = tX - sX;
    const cx1 = sX + dx * 0.45;
    const cx2 = tX - dx * 0.45;
    return `M ${sX} ${sY} C ${cx1} ${sY}, ${cx2} ${tY}, ${tX} ${tY}`;
  };

  if (!layout) return null;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        overflowX: "auto",
        overflowY: "hidden",
        background: "#ffffff",
        borderBottom: "1px solid #d9d9d9",
      }}
    >
      <svg
        width={layout.totalWidth}
        height={layout.totalHeight}
        style={{ display: "block", userSelect: "none" }}
      >
        {/* Links layer */}
        <g>
          {layout.linksList.map((l, i) => {
            if (!l.sourcePos || !l.targetPos) return null;
            const sx = l.sourcePos.x + l.sourcePos.width;
            const sy = l.sourcePos.y;
            const tx = l.targetPos.x;
            const ty = l.targetPos.y;

            // Check if this link belongs to active generations
            let isHighlighted = false;
            let isFaded = false;

            if (activeGenIds !== null) {
              // Check if any active gen uses this link
              const usedByActive = genPaths.some(
                (g) =>
                  activeGenIds.has(g.gen) &&
                  g.stepVals[l.step] === l.source &&
                  g.stepVals[l.step + 1] === l.target
              );
              if (usedByActive) {
                isHighlighted = true;
              } else {
                isFaded = true;
              }
            }

            const strokeColor = isHighlighted
              ? "#111111"
              : isFaded
              ? "rgba(180, 195, 208, 0.15)"
              : "rgba(168, 185, 201, 0.45)";

            const strokeOpacity = isHighlighted ? 0.85 : isFaded ? 0.15 : 0.6;
            const strokeW = isHighlighted ? Math.max(l.width, 2) : l.width;

            return (
              <path
                key={`link-${i}`}
                d={ribbonPath(sx, sy, tx, ty)}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeW}
                strokeLinecap="round"
                opacity={strokeOpacity}
                style={{ transition: "stroke 100ms, opacity 100ms" }}
              />
            );
          })}
        </g>

        {/* Nodes layer */}
        <g>
          {Array.from(layout.nodePositions.values()).map((node) => {
            const isPinned = pinned.some(
              (p) => p.step === node.step && p.text === node.text
            );
            const isHovered =
              hoveredNode &&
              hoveredNode.step === node.step &&
              hoveredNode.text === node.text;

            let isDimmed = false;
            if (activeGenIds !== null) {
              const nodeGensPass = genPaths.some(
                (g) =>
                  activeGenIds.has(g.gen) &&
                  g.stepVals[node.step] === node.text
              );
              if (!nodeGensPass) isDimmed = true;
            }

            const textColor = isPinned
              ? "#d9480f"
              : isHovered
              ? "#111111"
              : isDimmed
              ? "#aaaaaa"
              : "#222222";

            const fontWeight = isPinned ? 700 : 400;

            return (
              <g
                key={`node-${node.step}-${node.text}`}
                transform={`translate(${node.x}, ${node.y})`}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => {
                  setHoveredNode({ step: node.step, text: node.text });
                  if (tooltipRef.current) {
                    tooltipRef.current.style.display = "block";
                    tooltipRef.current.innerText = `${node.n} of 24 generations`;
                    tooltipRef.current.style.left = `${node.x}px`;
                    tooltipRef.current.style.top = `${Math.max(
                      8,
                      node.y - node.fontSize - 14
                    )}px`;
                  }
                }}
                onMouseLeave={() => {
                  setHoveredNode(null);
                  if (tooltipRef.current) {
                    tooltipRef.current.style.display = "none";
                  }
                }}
                onClick={() => {
                  setPinned((prev) => {
                    const exists = prev.some(
                      (p) => p.step === node.step && p.text === node.text
                    );
                    if (exists) {
                      return prev.filter(
                        (p) => !(p.step === node.step && p.text === node.text)
                      );
                    } else {
                      return [...prev, { step: node.step, text: node.text }];
                    }
                  });
                }}
              >
                {/* Hit area */}
                <rect
                  x={-4}
                  y={-node.height / 2 - 2}
                  width={node.width + 8}
                  height={node.height + 4}
                  fill="transparent"
                />
                <text
                  x={0}
                  y={0}
                  alignmentBaseline="central"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                  fontSize={node.fontSize}
                  fontWeight={fontWeight}
                  fill={textColor}
                  style={{
                    letterSpacing: "-0.2px",
                    transition: "fill 100ms",
                  }}
                >
                  {node.text}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{
          display: "none",
          position: "absolute",
          pointerEvents: "none",
          background: "#111111",
          color: "#ffffff",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, Helvetica, sans-serif",
          fontSize: "11px",
          fontWeight: 400,
          padding: "3px 6px",
          borderRadius: "0px",
          whiteSpace: "nowrap",
          zIndex: 10,
          lineHeight: "13px",
        }}
      />
    </div>
  );
};

export const GenerationList = ({ gens, pinned }) => {
  if (pinned.length === 0) {
    return (
      <div
        style={{
          padding: "12px 16px",
          fontSize: "12px",
          color: "#777777",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, Helvetica, sans-serif",
        }}
      >
        hover to trace, click to pin
      </div>
    );
  }

  // Highlight pinned spans inside full text
  return (
    <div
      style={{
        padding: "10px 16px",
        maxHeight: "220px",
        overflowY: "auto",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
        fontSize: "12px",
        lineHeight: "1.6",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontFamily: "system-ui, sans-serif",
          color: "#777777",
          marginBottom: "6px",
          textTransform: "lowercase",
        }}
      >
        {gens.length} matching {gens.length === 1 ? "generation" : "generations"}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {gens.map((g) => {
            const rawText = g.text || "";
            // Find occurrences of pinned span texts to highlight
            // Gather tokens to highlight
            const highlightTexts = pinned.map((p) => p.text);

            return (
              <tr
                key={g.gen}
                style={{
                  borderBottom: "1px solid #f2f2f2",
                }}
              >
                <td
                  style={{
                    width: "36px",
                    color: "#777777",
                    verticalAlign: "top",
                    padding: "4px 8px 4px 0",
                    userSelect: "none",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  #{g.gen}
                </td>
                <td
                  style={{
                    padding: "4px 0",
                    color: "#111111",
                    wordBreak: "break-word",
                  }}
                >
                  <HighlightedText text={rawText} highlights={highlightTexts} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const HighlightedText = ({ text, highlights }) => {
  if (!highlights || highlights.length === 0) return <span>{text}</span>;

  // Escape special regex characters
  const escaped = highlights
    .map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .filter((h) => h.length > 0)
    .sort((a, b) => b.length - a.length);

  if (escaped.length === 0) return <span>{text}</span>;

  const regex = new RegExp(`(${escaped.join("|")})`, "g");
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) => {
        const isMatch = highlights.includes(part);
        if (isMatch) {
          return (
            <span
              key={i}
              style={{
                color: "#d9480f",
                fontWeight: 600,
                borderBottom: "1.5px solid #d9480f",
              }}
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

export default function ConsistencyFlowWidget({ model, React }) {
  const [nodes, setNodes] = React.useState(() => parseDataFrame(model.get("data")));
  const [links, setLinks] = React.useState(() => parseDataFrame(model.get("links")));
  const [gens, setGens] = React.useState(() => parseDataFrame(model.get("gens")));

  const [pinned, setPinned] = React.useState([]);
  const [hoveredNode, setHoveredNode] = React.useState(null);

  // Subscribe to changes in inputs
  React.useEffect(() => {
    const handleDataChange = () => setNodes(parseDataFrame(model.get("data")));
    const handleLinksChange = () => setLinks(parseDataFrame(model.get("links")));
    const handleGensChange = () => setGens(parseDataFrame(model.get("gens")));

    model.on("change:data", handleDataChange);
    model.on("change:links", handleLinksChange);
    model.on("change:gens", handleGensChange);

    return () => {
      model.off("change:data", handleDataChange);
      model.off("change:links", handleLinksChange);
      model.off("change:gens", handleGensChange);
    };
  }, [model]);

  // Compute gen_ids passing all pins
  const matchingGens = React.useMemo(() => {
    if (pinned.length === 0) return gens;
    return gens.filter((g) => {
      return pinned.every((p) => {
        const val = g[`s${p.step}`];
        return String(val) === String(p.text);
      });
    });
  }, [gens, pinned]);

  const matchingGenIds = React.useMemo(() => {
    return matchingGens.map((g) => Number(g.gen));
  }, [matchingGens]);

  // Sync outputs to Python model
  React.useEffect(() => {
    model.set("pinned", pinned);
    model.set("gen_ids", matchingGenIds);
    model.save_changes();
  }, [pinned, matchingGenIds, model]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        color: "#111111",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        border: "1px solid #d9d9d9",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      <ConsistencyDiagram
        model={model}
        React={React}
        nodesData={nodes}
        linksData={links}
        gensData={gens}
        pinned={pinned}
        setPinned={setPinned}
        hoveredNode={hoveredNode}
        setHoveredNode={setHoveredNode}
      />
      <GenerationList gens={matchingGens} pinned={pinned} />
    </div>
  );
}