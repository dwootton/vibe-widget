import * as d3 from "https://esm.sh/d3@7";

export const ChartHeader = ({ count, total }) => (
  <div style={{ marginBottom: "12px", fontFamily: "sans-serif" }}>
    <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", color: "#1a1a1a" }}>
      Weather Condition Distribution
    </h3>
    <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
      Showing {count} of {total} selected records
    </p>
  </div>
);

export default function WeatherBarChart({ model, React }) {
  const [selectedIndices, setSelectedIndices] = React.useState(model.get("selected_indices") || []);
  const containerRef = React.useRef(null);
  const data = model.get("data") || [];

  React.useEffect(() => {
    const handleChange = () => {
      setSelectedIndices(model.get("selected_indices") || []);
    };
    model.on("change:selected_indices", handleChange);
    return () => model.off("change:selected_indices", handleChange);
  }, [model]);

  const processedData = React.useMemo(() => {
    if (!data.length) return [];
    
    const subset = selectedIndices.length > 0 
      ? selectedIndices.map(i => data[i]).filter(Boolean)
      : data;

    const counts = d3.rollup(
      subset,
      v => v.length,
      d => d.weather
    );

    return Array.from(counts, ([name, value]) => ({ name, value }))
      .sort((a, b) => d3.descending(a.value, b.value));
  }, [data, selectedIndices]);

  React.useEffect(() => {
    if (!containerRef.current) return;

    const margin = { top: 10, right: 30, bottom: 40, left: 80 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    d3.select(containerRef.current).selectAll("svg").remove();

    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain([0, d3.max(processedData, d => d.value) || 10])
      .range([0, width])
      .nice();

    const y = d3.scaleBand()
      .range([0, height])
      .domain(processedData.map(d => d.name))
      .padding(0.2);

    const colorScale = d3.scaleOrdinal()
      .domain(["sun", "fog", "drizzle", "rain", "snow"])
      .range(["#e7ba52", "#a7a7a7", "#aec7e8", "#1f77b4", "#9467bd"])
      .unknown("#ccc");

    // Axes
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5))
      .call(g => g.select(".domain").remove());

    svg.append("g")
      .call(d3.axisLeft(y))
      .call(g => g.select(".domain").remove())
      .selectAll("text")
      .style("font-size", "12px")
      .style("text-transform", "capitalize");

    // Bars
    svg.selectAll("rect")
      .data(processedData)
      .join("rect")
      .attr("y", d => y(d.name))
      .attr("x", 0)
      .attr("width", d => x(d.value))
      .attr("height", y.bandwidth())
      .attr("fill", d => colorScale(d.name))
      .attr("rx", 4);

    // Labels
    svg.selectAll(".label")
      .data(processedData)
      .join("text")
      .attr("class", "label")
      .attr("x", d => x(d.value) + 5)
      .attr("y", d => y(d.name) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .style("font-family", "sans-serif")
      .style("font-size", "11px")
      .style("font-weight", "600")
      .text(d => d.value);

    return () => {
      d3.select(containerRef.current).selectAll("svg").remove();
    };
  }, [processedData]);

  return (
    <div
      style={{
        padding: "20px",
        background: "#fff",
        borderRadius: "8px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        minHeight: "360px",
      }}
    >
      <ChartHeader count={selectedIndices.length || data.length} total={data.length} />
      <div ref={containerRef}></div>
      <style>
        {`.tick text { fill: #666; font-family: sans-serif; }
        .tick line { stroke: #eee; }`}
      </style>
    </div>
  );
}
