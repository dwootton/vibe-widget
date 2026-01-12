import * as d3 from "https://esm.sh/d3@7";

export const Legend = ({ items }) => {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "20px",
        justifyContent: "center",
        marginBottom: "16px",
        fontFamily: "sans-serif",
        fontSize: "14px",
      }}
    >
      {items.map((item) => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "12px",
              height: "12px",
              backgroundColor: item.color,
              display: "inline-block",
              borderRadius: "2px",
            }}
          ></span>
          <span style={{ color: "#374151", fontWeight: "600" }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export default function Widget({ model, React }) {
  const rawData = model.get("data") || [];
  const containerRef = React.useRef(null);

  // Memoize processed data to avoid recalculation on every render
  const parsedData = React.useMemo(() => {
    const parseTime = d3.timeParse("%Y-%m-%d");
    return rawData.map(d => ({
      ...d,
      DateObj: parseTime(d.Date),
      Confirmed: +d.Confirmed,
      Deaths: +d.Deaths,
      Recovered: +d.Recovered
    })).filter(d => d.DateObj !== null).sort((a, b) => a.DateObj - b.DateObj);
  }, [rawData]);

  React.useEffect(() => {
    if (!containerRef.current || parsedData.length === 0) return;

    // Dimensions
    const width = 640;
    const height = 400;
    const margin = { top: 20, right: 30, bottom: 30, left: 60 };

    // Clear previous SVG
    const container = d3.select(containerRef.current);
    container.selectAll("*").remove();

    const svg = container
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto; display: block;");

    // Scales
    const x = d3.scaleTime()
      .domain(d3.extent(parsedData, d => d.DateObj))
      .range([margin.left, width - margin.right]);

    const yMax = d3.max(parsedData, d => Math.max(d.Confirmed, d.Recovered, d.Deaths));
    const y = d3.scaleLinear()
      .domain([0, yMax])
      .nice()
      .range([height - margin.bottom, margin.top]);

    // Axes
    const xAxis = g => g
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0))
      .call(g => g.select(".domain").attr("stroke", "#9ca3af"))
      .call(g => g.selectAll(".tick text").attr("fill", "#4b5563"));

    const yAxis = g => g
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(height / 40, "s"))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").clone()
        .attr("x2", width - margin.left - margin.right)
        .attr("stroke", "#e5e7eb")
        .attr("stroke-opacity", 0.5)) // Grid lines
      .call(g => g.selectAll(".tick text").attr("fill", "#4b5563"))
      .call(g => g.append("text")
        .attr("x", -margin.left)
        .attr("y", 10)
        .attr("fill", "#111827")
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .text("Cases"));

    svg.append("g").call(xAxis);
    svg.append("g").call(yAxis);

    // Line Generators
    const lineGenerator = (key) => d3.line()
      .defined(d => !isNaN(d[key]))
      .x(d => x(d.DateObj))
      .y(d => y(d[key]));

    const series = [
      { key: "Confirmed", color: "#2563eb" }, // Blue
      { key: "Recovered", color: "#16a34a" }, // Green
      { key: "Deaths", color: "#dc2626" }     // Red
    ];

    // Draw Lines
    series.forEach(({ key, color }) => {
      svg.append("path")
        .datum(parsedData)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 2.5)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("d", lineGenerator(key));
    });

    // Cleanup
    return () => {
      container.selectAll("*").remove();
    };
  }, [parsedData]);

  const legendItems = [
    { label: "Confirmed", color: "#2563eb" },
    { label: "Recovered", color: "#16a34a" },
    { label: "Deaths", color: "#dc2626" }
  ];

  return (
    <section
      style={{ padding: "24px", fontFamily: "system-ui, -apple-system, sans-serif", backgroundColor: "#ffffff" }}
    >
      <h2
        style={{
          margin: "0 0 20px",
          textAlign: "center",
          color: "#111827",
          fontSize: "20px",
          fontWeight: "700",
        }}
      >
        Global COVID-19 Trends
      </h2>

      <Legend items={legendItems} />

      <div ref={containerRef} style={{ position: "relative", height: "400px", width: "100%" }}></div>

      <div
        style={{
          marginTop: "12px",
          textAlign: "right",
          fontSize: "12px",
          color: "#6b7280",
        }}
      >
        Source: Data Repository
      </div>
    </section>
  );
}
