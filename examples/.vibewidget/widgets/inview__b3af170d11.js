import * as d3 from "https://esm.sh/d3@7";

function parseTable(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    const keys = Object.keys(raw);
    if (keys.length > 0 && Array.isArray(raw[keys[0]])) {
      const n = raw[keys[0]].length;
      const res = new Array(n);
      for (let i = 0; i < n; i++) {
        const item = {};
        for (let j = 0; j < keys.length; j++) {
          item[keys[j]] = raw[keys[j]][i];
        }
        res[i] = item;
      }
      return res;
    }
  }
  return [];
}

function formatSpan(start, end) {
  if (start >= 1e6 || end >= 1e6) {
    return `${(start / 1e6).toFixed(2)}–${(end / 1e6).toFixed(2)} Mb`;
  } else if (start >= 1e3 || end >= 1e3) {
    return `${(start / 1e3).toFixed(1)}–${(end / 1e3).toFixed(1)} kb`;
  }
  return `${Math.round(start)}–${Math.round(end)} bp`;
}

const LEVEL_NAMES = {
  1: "Allele Frequency Spectrum",
  2: "Gene Density & Loci",
  3: "Variant Ledger",
  4: "Base-Pair Resolution"
};

export const ViewHeader = ({ start, end, level }) => {
  const spanText = formatSpan(start, end);
  const baseCount = Math.max(0, Math.round(end - start + 1));
  const levelName = LEVEL_NAMES[level] || `Level ${level}`;

  return (
    <header
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "12px",
        paddingBottom: "14px",
        marginBottom: "16px",
        borderBottom: "2px solid #111827"
      }}
    >
      <div>
        <div
          style={{
            fontSize: "11px",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#854d0e",
            fontWeight: 700,
            marginBottom: "2px"
          }}
        >
          Genome Track · Level {level}
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "26px",
            fontWeight: 800,
            color: "#111827",
            letterSpacing: "-0.02em"
          }}
        >
          {spanText}
        </h1>
      </div>
      <div style={{ textAlign: "right" }}>
        <div
          style={{
            fontSize: "15px",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontWeight: 700,
            color: "#111827"
          }}
        >
          {levelName}
        </div>
        <div
          style={{
            fontSize: "12px",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
            color: "#4b5563"
          }}
        >
          {baseCount.toLocaleString()} bp window
        </div>
      </div>
    </header>
  );
};

export const HistogramLevel1 = ({ React, variants, genes, start, end }) => {
  const containerRef = React.useRef(null);
  const [hoveredBin, setHoveredBin] = React.useState(null);

  const nVariants = variants.length;
  const nGenes = genes.length;

  React.useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const width = 560;
    const height = 230;
    const margin = { top: 16, right: 24, bottom: 42, left: 48 };

    const svg = d3
      .select(containerRef.current)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("style", "width: 100%; height: auto; max-height: 250px; display: block; overflow: visible;");

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const afValues = variants.map((v) => Number(v.af) || 0);

    const x = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);

    const bins = d3
      .bin()
      .domain(x.domain())
      .thresholds(x.ticks(20))(afValues);

    const maxCount = d3.max(bins, (d) => d.length) || 1;
    const y = d3.scaleLinear().domain([0, maxCount]).nice().range([innerHeight, 0]);

    // Grid lines
    g.append("g")
      .attr("stroke", "#e5e7eb")
      .attr("stroke-dasharray", "2,2")
      .call(d3.axisLeft(y).ticks(4).tickSize(-innerWidth).tickFormat(""));

    // Axes
    const xAxis = d3.axisBottom(x).ticks(10).tickFormat(d3.format(".1f"));
    const yAxis = d3.axisLeft(y).ticks(4).tickFormat(d3.format("~s"));

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll("text")
      .attr("fill", "#374151")
      .attr("font-family", "'JetBrains Mono', monospace")
      .attr("font-size", "11px");

    g.append("g")
      .call(yAxis)
      .selectAll("text")
      .attr("fill", "#374151")
      .attr("font-family", "'JetBrains Mono', monospace")
      .attr("font-size", "11px");

    // X Axis Label
    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 34)
      .attr("text-anchor", "middle")
      .attr("fill", "#111827")
      .attr("font-family", "Georgia, serif")
      .attr("font-size", "12px")
      .attr("font-style", "italic")
      .text("Allele Frequency (AF)");

    // Y Axis Label
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -34)
      .attr("text-anchor", "middle")
      .attr("fill", "#111827")
      .attr("font-family", "Georgia, serif")
      .attr("font-size", "12px")
      .attr("font-style", "italic")
      .text("Variant Count");

    // Defs: gradient
    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "barGrad")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#c2410c");
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#ea580c");

    // Bars
    g.selectAll("rect")
      .data(bins)
      .join("rect")
      .attr("x", (d) => x(d.x0) + 1)
      .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0) - 2))
      .attr("y", (d) => y(d.length))
      .attr("height", (d) => innerHeight - y(d.length))
      .attr("fill", "url(#barGrad)")
      .attr("rx", 2)
      .style("cursor", "pointer")
      .on("mouseenter", (event, d) => {
        d3.select(event.currentTarget).attr("fill", "#9a3412");
        setHoveredBin({ x0: d.x0, x1: d.x1, count: d.length });
      })
      .on("mouseleave", (event) => {
        d3.select(event.currentTarget).attr("fill", "url(#barGrad)");
        setHoveredBin(null);
      });

    return () => {
      svg.remove();
    };
  }, [variants]);

  const meanAf = variants.length > 0
    ? (variants.reduce((acc, v) => acc + (Number(v.af) || 0), 0) / variants.length).toFixed(4)
    : "0.0000";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#fef3c7",
          border: "1px solid #fde68a",
          borderRadius: "6px",
          padding: "10px 16px"
        }}
      >
        <span
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "17px",
            fontWeight: 700,
            color: "#92400e"
          }}
        >
          {nVariants} variants · {nGenes} genes in view
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "12px",
            color: "#78350f"
          }}
        >
          Mean AF: <strong>{meanAf}</strong>
        </span>
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "16px 12px 10px 12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
        }}
      >
        <div ref={containerRef} />
        <div
          style={{
            minHeight: "22px",
            marginTop: "6px",
            textAlign: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "12px",
            color: "#4b5563"
          }}
        >
          {hoveredBin ? (
            <span>
              AF bin <strong>{hoveredBin.x0.toFixed(2)}–{hoveredBin.x1.toFixed(2)}</strong>:{" "}
              <strong style={{ color: "#c2410c" }}>{hoveredBin.count}</strong> variants
            </span>
          ) : (
            <span>Hover bars for exact bin distribution</span>
          )}
        </div>
      </div>
    </div>
  );
};

export const GeneTableLevel2 = ({ React, genesInView, allVariants }) => {
  const sortedVariants = React.useMemo(() => {
    return [...allVariants].sort((a, b) => (a.pos || 0) - (b.pos || 0));
  }, [allVariants]);

  const geneRows = React.useMemo(() => {
    return genesInView
      .map((g) => {
        const start = g.start;
        const end = g.end;
        const length = Math.max(0, end - start + 1);

        // Binary search variants inside gene
        let low = 0, high = sortedVariants.length;
        while (low < high) {
          const mid = (low + high) >> 1;
          if (sortedVariants[mid].pos < start) low = mid + 1;
          else high = mid;
        }
        let count = 0;
        let afSum = 0;
        for (let i = low; i < sortedVariants.length && sortedVariants[i].pos <= end; i++) {
          count++;
          afSum += Number(sortedVariants[i].af) || 0;
        }
        const meanAf = count > 0 ? afSum / count : 0;

        return {
          gene: g.gene,
          strand: g.strand || "+",
          start,
          end,
          length,
          variantsInside: count,
          meanAf
        };
      })
      .sort((a, b) => b.variantsInside - a.variantsInside || a.start - b.start)
      .slice(0, 40);
  }, [genesInView, sortedVariants]);

  const maxVariants = Math.max(1, d3.max(geneRows, (d) => d.variantsInside) || 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "12px",
          color: "#4b5563"
        }}
      >
        <span>
          Showing {geneRows.length} {geneRows.length === 1 ? "gene" : "genes"} in view (sorted by variants inside, max 40)
        </span>
        <span style={{ fontSize: "11px", color: "#6b7280" }}>
          Ranked by density
        </span>
      </div>

      <div
        style={{
          overflowY: "auto",
          maxHeight: "360px",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          background: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
            fontSize: "13px"
          }}
        >
          <thead>
            <tr
              style={{
                position: "sticky",
                top: 0,
                background: "#f3f4f6",
                borderBottom: "2px solid #d1d5db",
                color: "#111827",
                fontFamily: "Georgia, serif",
                fontSize: "13px",
                fontWeight: 700,
                zIndex: 2
              }}
            >
              <th style={{ padding: "10px 12px" }}>Gene</th>
              <th style={{ padding: "10px 12px" }}>Strand</th>
              <th style={{ padding: "10px 12px" }}>Length</th>
              <th style={{ padding: "10px 12px" }}>Variants Inside</th>
              <th style={{ padding: "10px 12px" }}>Mean AF</th>
            </tr>
          </thead>
          <tbody>
            {geneRows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: "32px",
                    textAlign: "center",
                    color: "#6b7280",
                    fontStyle: "italic"
                  }}
                >
                  No genes located in this genomic view window.
                </td>
              </tr>
            ) : (
              geneRows.map((r, i) => (
                <tr
                  key={r.gene}
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    background: i % 2 === 0 ? "#ffffff" : "#fafafa",
                    transition: "background 0.15s ease"
                  }}
                >
                  <td
                    style={{
                      padding: "8px 12px",
                      fontWeight: 700,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: "#111827"
                    }}
                  >
                    {r.gene}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 700,
                        background: r.strand === "+" ? "#e0f2fe" : "#fef3c7",
                        color: r.strand === "+" ? "#0369a1" : "#b45309"
                      }}
                    >
                      {r.strand}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "8px 12px",
                      fontFamily: "'JetBrains Mono', monospace",
                      color: "#374151"
                    }}
                  >
                    {r.length.toLocaleString()} bp
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontFamily: "'JetBrains Mono', monospace",
                          minWidth: "24px"
                        }}
                      >
                        {r.variantsInside}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          maxWidth: "100px",
                          height: "6px",
                          background: "#e5e7eb",
                          borderRadius: "3px",
                          overflow: "hidden"
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${(r.variantsInside / maxVariants) * 100}%`,
                            background: "#ea580c",
                            borderRadius: "3px"
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "8px 12px",
                      fontFamily: "'JetBrains Mono', monospace",
                      color: r.variantsInside > 0 ? "#0f766e" : "#9ca3af",
                      fontWeight: 600
                    }}
                  >
                    {r.variantsInside > 0 ? r.meanAf.toFixed(4) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const VariantTableLevel3 = ({ React, variantsInView, genes }) => {
  const rows = React.useMemo(() => {
    const sorted = [...variantsInView].sort((a, b) => (a.pos || 0) - (b.pos || 0));
    return sorted.map((v) => {
      const match = genes.find((g) => v.pos >= g.start && v.pos <= g.end);
      const geneName = match ? match.gene : "intergenic";
      return {
        ...v,
        geneName,
        afNum: Number(v.af) || 0
      };
    });
  }, [variantsInView, genes]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "12px",
          color: "#4b5563"
        }}
      >
        <span>
          {rows.length} {rows.length === 1 ? "variant" : "variants"} in view (sorted by position)
        </span>
        <span style={{ fontSize: "11px", color: "#6b7280" }}>AF bar range 0.0 – 1.0</span>
      </div>

      <div
        style={{
          overflowY: "auto",
          maxHeight: "360px",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          background: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
            fontSize: "13px"
          }}
        >
          <thead>
            <tr
              style={{
                position: "sticky",
                top: 0,
                background: "#f3f4f6",
                borderBottom: "2px solid #d1d5db",
                color: "#111827",
                fontFamily: "Georgia, serif",
                fontSize: "13px",
                fontWeight: 700,
                zIndex: 2
              }}
            >
              <th style={{ padding: "10px 12px" }}>Position (bp)</th>
              <th style={{ padding: "10px 12px" }}>Ref &gt; Alt</th>
              <th style={{ padding: "10px 12px" }}>Allele Frequency</th>
              <th style={{ padding: "10px 12px" }}>Location</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    padding: "32px",
                    textAlign: "center",
                    color: "#6b7280",
                    fontStyle: "italic"
                  }}
                >
                  No variants located in this genomic view window.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={`${r.pos}-${r.ref}-${r.alt}-${i}`}
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    background: i % 2 === 0 ? "#ffffff" : "#fafafa"
                  }}
                >
                  <td
                    style={{
                      padding: "8px 12px",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                      color: "#111827"
                    }}
                  >
                    {r.pos.toLocaleString()}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        fontSize: "12px"
                      }}
                    >
                      <span style={{ color: "#2563eb" }}>{r.ref}</span>
                      <span style={{ color: "#9ca3af" }}>&gt;</span>
                      <span style={{ color: "#dc2626" }}>{r.alt}</span>
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          minWidth: "48px",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#111827"
                        }}
                      >
                        {r.afNum.toFixed(4)}
                      </span>
                      <div
                        style={{
                          width: "80px",
                          height: "6px",
                          background: "#e5e7eb",
                          borderRadius: "3px",
                          overflow: "hidden"
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(100, Math.max(2, r.afNum * 100))}%`,
                            background: r.afNum > 0.05 ? "#ea580c" : "#3b82f6",
                            borderRadius: "3px"
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        fontFamily: "'JetBrains Mono', monospace",
                        background: r.geneName === "intergenic" ? "#f3f4f6" : "#ecfdf5",
                        color: r.geneName === "intergenic" ? "#6b7280" : "#065f46",
                        border: `1px solid ${r.geneName === "intergenic" ? "#e5e7eb" : "#a7f3d0"}`
                      }}
                    >
                      {r.geneName}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const BaseResolutionLevel4 = ({ React, variantsInView, start, end }) => {
  const baseCount = Math.max(0, Math.round(end - start + 1));
  const sorted = React.useMemo(() => {
    return [...variantsInView].sort((a, b) => (a.pos || 0) - (b.pos || 0));
  }, [variantsInView]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#ecfdf5",
          border: "1px solid #a7f3d0",
          borderRadius: "6px",
          padding: "10px 16px"
        }}
      >
        <span
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "17px",
            fontWeight: 700,
            color: "#065f46"
          }}
        >
          {baseCount.toLocaleString()} bases in view
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "12px",
            color: "#047857"
          }}
        >
          {sorted.length} {sorted.length === 1 ? "variant site" : "variant sites"}
        </span>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          background: "#ffffff",
          padding: "16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#6b7280",
            marginBottom: "12px"
          }}
        >
          Variants Written At Coordinate Positions
        </div>

        {sorted.length === 0 ? (
          <div
            style={{
              padding: "36px 12px",
              textAlign: "center",
              color: "#6b7280",
              fontStyle: "italic"
            }}
          >
            No variant sites inside this window ({formatSpan(start, end)}).
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              maxHeight: "310px",
              overflowY: "auto",
              paddingRight: "4px"
            }}
          >
            {sorted.map((v, idx) => {
              const afVal = Number(v.af) || 0;
              const offsetFromStart = v.pos - start;

              return (
                <div
                  key={`${v.pos}-${v.ref}-${v.alt}-${idx}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "13px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span
                      style={{
                        background: "#111827",
                        color: "#ffffff",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontWeight: 700,
                        fontSize: "13px",
                        letterSpacing: "0.05em"
                      }}
                    >
                      {v.ref}&gt;{v.alt}
                    </span>
                    <span style={{ color: "#111827", fontWeight: 700 }}>
                      pos {v.pos.toLocaleString()} bp
                    </span>
                    <span style={{ color: "#6b7280", fontSize: "11px" }}>
                      (+{offsetFromStart.toLocaleString()} bp)
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ color: "#4b5563", fontSize: "12px" }}>AF</span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: afVal > 0.05 ? "#c2410c" : "#2563eb",
                        background: afVal > 0.05 ? "#ffedd5" : "#dbeafe",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "12px"
                      }}
                    >
                      {afVal.toFixed(4)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default function Widget({ model, React }) {
  const [view, setView] = React.useState(() => model.get("view"));
  const [level, setLevel] = React.useState(() => model.get("level"));
  const [data, setData] = React.useState(() => model.get("data"));
  const [genes, setGenes] = React.useState(() => model.get("genes"));

  React.useEffect(() => {
    const handleView = () => setView(model.get("view"));
    const handleLevel = () => setLevel(model.get("level"));
    const handleData = () => setData(model.get("data"));
    const handleGenes = () => setGenes(model.get("genes"));

    model.on("change:view", handleView);
    model.on("change:level", handleLevel);
    model.on("change:data", handleData);
    model.on("change:genes", handleGenes);

    return () => {
      if (model.off) {
        model.off("change:view", handleView);
        model.off("change:level", handleLevel);
        model.off("change:data", handleData);
        model.off("change:genes", handleGenes);
      }
    };
  }, [model]);

  const parsedVariants = React.useMemo(() => parseTable(data), [data]);
  const parsedGenes = React.useMemo(() => parseTable(genes), [genes]);

  // Fallback defaults if view or level not provided
  const [start, end] = React.useMemo(() => {
    if (Array.isArray(view) && view.length === 2 && view[0] !== null && view[1] !== null) {
      return [Math.min(view[0], view[1]), Math.max(view[0], view[1])];
    }
    // Default view around locus with variants & genes
    return [24000000, 26000000];
  }, [view]);

  const currentLevel = React.useMemo(() => {
    if (level === null || level === undefined) return 1;
    const num = Math.round(Number(level));
    return Math.max(1, Math.min(4, isNaN(num) ? 1 : num));
  }, [level]);

  // Filter items in view
  const variantsInView = React.useMemo(() => {
    return parsedVariants.filter((v) => v.pos >= start && v.pos <= end);
  }, [parsedVariants, start, end]);

  const genesInView = React.useMemo(() => {
    return parsedGenes.filter((g) => g.start <= end && g.end >= start);
  }, [parsedGenes, start, end]);

  return (
    <section
      style={{
        background: "#fdfbf7",
        color: "#111827",
        padding: "24px 28px",
        borderRadius: "10px",
        border: "1px solid #e7dfcf",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.05)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxSizing: "border-box",
        maxWidth: "840px",
        margin: "0 auto"
      }}
    >
      <ViewHeader start={start} end={end} level={currentLevel} />

      {currentLevel === 1 && (
        <HistogramLevel1
          React={React}
          variants={variantsInView}
          genes={genesInView}
          start={start}
          end={end}
        />
      )}

      {currentLevel === 2 && (
        <GeneTableLevel2
          React={React}
          genesInView={genesInView}
          allVariants={parsedVariants}
        />
      )}

      {currentLevel === 3 && (
        <VariantTableLevel3
          React={React}
          variantsInView={variantsInView}
          genes={parsedGenes}
        />
      )}

      {currentLevel === 4 && (
        <BaseResolutionLevel4
          React={React}
          variantsInView={variantsInView}
          start={start}
          end={end}
        />
      )}
    </section>
  );
}