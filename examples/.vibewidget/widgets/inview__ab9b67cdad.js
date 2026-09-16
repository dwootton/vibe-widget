import * as d3 from "https://esm.sh/d3@7";

function formatBp(bp) {
  if (bp == null || isNaN(bp)) return "—";
  if (bp >= 1e6) {
    return (bp / 1e6).toFixed(2) + " Mb";
  }
  if (bp >= 1e3) {
    return (bp / 1e3).toFixed(1) + " kb";
  }
  return bp.toLocaleString() + " bp";
}

function formatSpan(start, end) {
  if (start == null || end == null) return "whole genome";
  if (start >= 1e6 && end >= 1e6) {
    return `${(start / 1e6).toFixed(2)}–${(end / 1e6).toFixed(2)} Mb`;
  }
  if (start >= 1e3 && end >= 1e3) {
    return `${(start / 1e3).toFixed(1)}–${(end / 1e3).toFixed(1)} kb`;
  }
  return `${start.toLocaleString()}–${end.toLocaleString()} bp`;
}

export const Header = ({ start, end, level, levelName }) => {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        paddingBottom: "8px",
        borderBottom: "1px solid #d9d9d9",
        marginBottom: "12px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <div style={{ display: "flex", gap: "10px", alignItems: "baseline" }}>
        <span
          style={{
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: "13px",
            fontWeight: 600,
            color: "#111111",
          }}
        >
          {formatSpan(start, end)}
        </span>
        {start != null && end != null && (
          <span style={{ fontSize: "11px", color: "#777777" }}>
            {(Math.max(0, end - start)).toLocaleString()} bp
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: "6px", alignItems: "baseline" }}>
        <span
          style={{
            fontSize: "11px",
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            color: "#777777",
          }}
        >
          L{level}
        </span>
        <span
          style={{
            fontSize: "12px",
            color: "#111111",
            textTransform: "lowercase",
          }}
        >
          {levelName}
        </span>
      </div>
    </header>
  );
};

export const Level1Histogram = ({ variants, geneCount, React }) => {
  const containerRef = React.useRef(null);
  const n = variants.length;

  React.useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    el.innerHTML = "";

    const width = el.clientWidth || 500;
    const height = 240;
    const margin = { top: 16, right: 16, bottom: 28, left: 38 };

    const svg = d3
      .select(el)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("display", "block");

    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    if (n === 0) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#777777")
        .attr("font-size", 12)
        .text("no variants in view");
      return () => svg.remove();
    }

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, 1]).range([0, innerW]);

    const bins = d3
      .bin()
      .value((d) => d.af)
      .domain([0, 1])
      .thresholds(20)(variants);

    const maxCount = d3.max(bins, (d) => d.length) || 1;
    const y = d3.scaleLinear().domain([0, maxCount]).range([innerH, 0]).nice();

    // Subtle horizontal gridlines
    const yTicks = y.ticks(5);
    g.append("g")
      .selectAll("line")
      .data(yTicks)
      .join("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d))
      .attr("stroke", "#f2f2f2")
      .attr("stroke-width", 1);

    // Bars
    g.selectAll("rect")
      .data(bins)
      .join("rect")
      .attr("x", (d) => x(d.x0) + 0.5)
      .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0) - 1))
      .attr("y", (d) => y(d.length))
      .attr("height", (d) => innerH - y(d.length))
      .attr("fill", "#111111");

    // X-axis
    const xAxis = d3
      .axisBottom(x)
      .ticks(5)
      .tickSize(3)
      .tickFormat(d3.format(".1f"));
    const gx = g
      .append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(xAxis);
    gx.select(".domain").attr("stroke", "#d9d9d9");
    gx.selectAll(".tick line").attr("stroke", "#d9d9d9");
    gx.selectAll(".tick text")
      .attr("fill", "#777777")
      .attr("font-size", 11)
      .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace");

    // Y-axis
    const yAxis = d3.axisLeft(y).ticks(5).tickSize(3).tickFormat(d3.format("~s"));
    const gy = g.append("g").call(yAxis);
    gy.select(".domain").attr("stroke", "#d9d9d9");
    gy.selectAll(".tick line").attr("stroke", "#d9d9d9");
    gy.selectAll(".tick text")
      .attr("fill", "#777777")
      .attr("font-size", 11)
      .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace");

    return () => svg.remove();
  }, [variants, n]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div
        style={{
          fontSize: "12px",
          color: "#111111",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {variants.length} variants · {geneCount} genes in view
      </div>
      <div ref={containerRef} style={{ width: "100%", height: 240 }} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "11px",
          color: "#777777",
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
          paddingLeft: "38px",
          paddingRight: "16px",
        }}
      >
        <span>allele frequency (0.0 – 1.0)</span>
        <span>count</span>
      </div>
    </div>
  );
};

export const Level2GenesTable = ({ genesInView, variants }) => {
  // Compute variant counts and mean af per gene
  const rows = React.useMemo(() => {
    return genesInView
      .map((g) => {
        const inside = variants.filter(
          (v) => v.pos >= g.start && v.pos <= g.end
        );
        const count = inside.length;
        const meanAf =
          count > 0 ? inside.reduce((s, v) => s + v.af, 0) / count : 0;
        const len = g.end - g.start + 1;
        return {
          gene: g.gene,
          length: len,
          count,
          meanAf,
          strand: g.strand,
        };
      })
      .sort((a, b) => b.count - a.count || b.length - a.length)
      .slice(0, 40);
  }, [genesInView, variants]);

  if (rows.length === 0) {
    return (
      <div style={{ fontSize: "12px", color: "#777777", padding: "16px 0" }}>
        no genes in view
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", maxHeight: "460px", overflowY: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "12px",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: "1px solid #d9d9d9",
              color: "#777777",
              fontSize: "11px",
              textAlign: "left",
            }}
          >
            <th style={{ padding: "6px 8px 6px 0", fontWeight: 400 }}>gene</th>
            <th style={{ padding: "6px 8px", fontWeight: 400, textAlign: "right" }}>
              length
            </th>
            <th style={{ padding: "6px 8px", fontWeight: 400, textAlign: "right" }}>
              variants
            </th>
            <th style={{ padding: "6px 0 6px 8px", fontWeight: 400, textAlign: "right" }}>
              mean af
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.gene}
              style={{
                borderBottom: "1px solid #f2f2f2",
                color: "#111111",
              }}
            >
              <td
                style={{
                  padding: "5px 8px 5px 0",
                  fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                  fontWeight: 600,
                }}
              >
                {r.gene}
                <span
                  style={{
                    marginLeft: "4px",
                    fontWeight: 400,
                    color: "#777777",
                    fontSize: "10px",
                  }}
                >
                  {r.strand}
                </span>
              </td>
              <td
                style={{
                  padding: "5px 8px",
                  textAlign: "right",
                  fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                }}
              >
                {r.length.toLocaleString()} bp
              </td>
              <td
                style={{
                  padding: "5px 8px",
                  textAlign: "right",
                  fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                  fontWeight: r.count > 0 ? 600 : 400,
                }}
              >
                {r.count}
              </td>
              <td
                style={{
                  padding: "5px 0 5px 8px",
                  textAlign: "right",
                  fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                }}
              >
                {r.count > 0 ? r.meanAf.toFixed(4) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const Level3VariantsTable = ({ variants, genes }) => {
  const rows = React.useMemo(() => {
    return [...variants]
      .sort((a, b) => a.pos - b.pos)
      .map((v) => {
        const gene = genes.find((g) => v.pos >= g.start && v.pos <= g.end);
        return {
          ...v,
          geneName: gene ? gene.gene : "intergenic",
          isIntergenic: !gene,
        };
      });
  }, [variants, genes]);

  if (rows.length === 0) {
    return (
      <div style={{ fontSize: "12px", color: "#777777", padding: "16px 0" }}>
        no variants in view
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", maxHeight: "460px", overflowY: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "12px",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: "1px solid #d9d9d9",
              color: "#777777",
              fontSize: "11px",
              textAlign: "left",
            }}
          >
            <th style={{ padding: "6px 8px 6px 0", fontWeight: 400 }}>pos</th>
            <th style={{ padding: "6px 8px", fontWeight: 400 }}>change</th>
            <th
              style={{
                padding: "6px 8px",
                fontWeight: 400,
                textAlign: "left",
                width: "140px",
              }}
            >
              af
            </th>
            <th style={{ padding: "6px 0 6px 8px", fontWeight: 400, textAlign: "right" }}>
              gene
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const barWidth = Math.max(1, Math.round(r.af * 64));
            return (
              <tr
                key={i}
                style={{
                  borderBottom: "1px solid #f2f2f2",
                  color: "#111111",
                }}
              >
                <td
                  style={{
                    padding: "5px 8px 5px 0",
                    fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                  }}
                >
                  {r.pos.toLocaleString()}
                </td>
                <td
                  style={{
                    padding: "5px 8px",
                    fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                    fontWeight: 600,
                  }}
                >
                  {r.ref}&gt;{r.alt}
                </td>
                <td style={{ padding: "5px 8px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                      fontSize: "11px",
                    }}
                  >
                    <div
                      style={{
                        width: "64px",
                        height: "5px",
                        background: "#f2f2f2",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          width: `${barWidth}px`,
                          height: "5px",
                          background: "#111111",
                        }}
                      />
                    </div>
                    <span>{r.af.toFixed(4)}</span>
                  </div>
                </td>
                <td
                  style={{
                    padding: "5px 0 5px 8px",
                    textAlign: "right",
                    fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                    color: r.isIntergenic ? "#777777" : "#111111",
                  }}
                >
                  {r.geneName}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const Level4BaseDetails = ({
  variants,
  start,
  end,
  genes,
}) => {
  const baseCount =
    start != null && end != null ? Math.max(0, end - start + 1) : null;
  const sorted = React.useMemo(() => {
    return [...variants].sort((a, b) => a.pos - b.pos);
  }, [variants]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontSize: "12px",
          color: "#111111",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>{sorted.length} variants in view</span>
        {baseCount != null && (
          <span
            style={{
              fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
              color: "#777777",
            }}
          >
            {baseCount.toLocaleString()} bases in view
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div style={{ fontSize: "12px", color: "#777777", padding: "16px 0" }}>
          no variants in this base range
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            maxHeight: "440px",
            overflowY: "auto",
            paddingRight: "4px",
          }}
        >
          {sorted.map((v, i) => {
            const gene = genes.find((g) => v.pos >= g.start && v.pos <= g.end);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 8px",
                  background: "#ffffff",
                  border: "1px solid #d9d9d9",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "12px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                      fontSize: "12px",
                      color: "#777777",
                    }}
                  >
                    pos {v.pos.toLocaleString()}
                  </span>
                  <span
                    style={{
                      fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#111111",
                    }}
                  >
                    {v.ref}&gt;{v.alt}
                  </span>
                  {gene && (
                    <span
                      style={{
                        fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                        fontSize: "11px",
                        color: "#777777",
                      }}
                    >
                      {gene.gene} ({gene.strand})
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                    fontSize: "12px",
                    color: "#111111",
                  }}
                >
                  <span style={{ color: "#777777", fontSize: "11px" }}>af</span>
                  <span>{v.af.toFixed(4)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default function Widget({ model, React }) {
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
    model.on("change:view", handleUpdate);
    model.on("change:level", handleUpdate);
    model.on("change:data", handleUpdate);
    model.on("change:genes", handleUpdate);

    return () => {
      model.off("change:view", handleUpdate);
      model.off("change:level", handleUpdate);
      model.off("change:data", handleUpdate);
      model.off("change:genes", handleUpdate);
    };
  }, [model]);

  // Read traits safely
  const rawView = model.get("view");
  const rawLevel = model.get("level");
  const rawData = model.get("data");
  const rawGenes = model.get("genes");

  // Normalize inputs
  const allVariants = React.useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    // Handle columnar dict format if passed as pandas JSON
    if (rawData.pos && Array.isArray(rawData.pos)) {
      return rawData.pos.map((p, i) => ({
        pos: p,
        af: rawData.af ? rawData.af[i] : 0,
        ref: rawData.ref ? rawData.ref[i] : "",
        alt: rawData.alt ? rawData.alt[i] : "",
      }));
    }
    return [];
  }, [rawData]);

  const allGenes = React.useMemo(() => {
    if (!rawGenes) return [];
    if (Array.isArray(rawGenes)) return rawGenes;
    if (rawGenes.gene && Array.isArray(rawGenes.gene)) {
      return rawGenes.gene.map((g, i) => ({
        gene: g,
        start: rawGenes.start[i],
        end: rawGenes.end[i],
        strand: rawGenes.strand[i],
      }));
    }
    return [];
  }, [rawGenes]);

  // View bounds [start, end]
  let start = null;
  let end = null;
  if (Array.isArray(rawView) && rawView.length >= 2) {
    start = rawView[0];
    end = rawView[1];
  } else if (rawView && typeof rawView === "object" && rawView.start != null) {
    start = rawView.start;
    end = rawView.end;
  }

  // Level 1..4 (default level 1 if None)
  let level = 1;
  if (typeof rawLevel === "number" && rawLevel >= 1 && rawLevel <= 4) {
    level = Math.floor(rawLevel);
  }

  const levelNames = {
    1: "allele frequency spectrum",
    2: "genes by variant count",
    3: "variants by coordinate",
    4: "base resolution variants",
  };

  // Filter data to view
  const variantsInView = React.useMemo(() => {
    if (start == null || end == null) return allVariants;
    const s = Math.min(start, end);
    const e = Math.max(start, end);
    return allVariants.filter((v) => v.pos >= s && v.pos <= e);
  }, [allVariants, start, end]);

  const genesInView = React.useMemo(() => {
    if (start == null || end == null) return allGenes;
    const s = Math.min(start, end);
    const e = Math.max(start, end);
    // overlap: gene.end >= s && gene.start <= e
    return allGenes.filter((g) => g.end >= s && g.start <= e);
  }, [allGenes, start, end]);

  return (
    <div
      style={{
        background: "#ffffff",
        color: "#111111",
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
        padding: "12px",
        boxSizing: "border-box",
        width: "100%",
        minHeight: "340px",
        maxHeight: "560px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Header
        start={start}
        end={end}
        level={level}
        levelName={levelNames[level] || "overview"}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        {level === 1 && (
          <Level1Histogram
            variants={variantsInView}
            geneCount={genesInView.length}
            React={React}
          />
        )}
        {level === 2 && (
          <Level2GenesTable
            genesInView={genesInView}
            variants={variantsInView}
          />
        )}
        {level === 3 && (
          <Level3VariantsTable
            variants={variantsInView}
            genes={allGenes}
          />
        )}
        {level === 4 && (
          <Level4BaseDetails
            variants={variantsInView}
            start={start}
            end={end}
            genes={allGenes}
          />
        )}
      </div>
    </div>
  );
}