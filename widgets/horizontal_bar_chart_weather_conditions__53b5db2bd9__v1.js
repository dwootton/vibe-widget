import * as d3 from "https://esm.sh/d3@7";

export const Tooltip = ({ data }) => {
  if (!data) return <div style={{ height: "20px" }} />;
  return (
    <div
      style={{
        padding: "8px 12px",
        background: "#1e1e1e",
        color: "white",
        borderRadius: "4px",
        fontSize: "12px",
        marginBottom: "10px",
        borderLeft: `4px solid ${data.color}`,
      }}
    >
      <strong>{data.weather.toUpperCase()}</strong>: {data.count} records
    </div>
  );
};

export default function WeatherBarChart({ model, React }) {
  const containerRef = React.useRef(null);
  const [hovered, setHovered] = React.useState(null);
  const [selection, setSelection] = React.useState(model.get("selected_indices") || []);

  // Process data: aggregate counts of weather conditions
  const processedData = React.useMemo(() => {
    const rawData = model.get("data") || [];
    const counts = d3.rollup(rawData, v => v.length, d => d.weather);
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10)
      .domain(Array.from(counts.keys()));

    return Array.from(counts, ([weather, count]) => ({
      weather,
      count,
      color: colorScale(weather)
    })).sort((a, b) => b.count - a.count);
  }, [model.get("data")]);

  // Sync with external selection trait
  React.useEffect(() => {
    const handleChange = () => {
      setSelection(model.get("selected_indices") || []);
    };
    model.on("change:selected_indices", handleChange);
    return () => model.off("change:selected_indices", handleChange);
  }, [model]);

  React.useEffect(() => {
    if (!containerRef.current || processedData.length === 0) return;

    const margin = { top: 20, right: 30, bottom: 40, left: 80 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    // Clear previous SVG
    d3.select(containerRef.current).selectAll("svg").remove();

    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain([0, d3.max(processedData, d => d.count)])
      .range([0, width]);

    const y = d3.scaleBand()
      .domain(processedData.map(d => d.weather))
      .range([0, height])
      .padding(0.2);

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
      .style("font-weight", "500");

    // Bars
    const bars = svg.selectAll(".bar")
      .data(processedData)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("y", d => y(d.weather))
      .attr("x", 0)
      .attr("height", y.bandwidth())
      .attr("width", d => x(d.count))
      .attr("fill", d => d.color)
      .attr("rx", 4)
      .style("cursor", "pointer")
      .style("transition", "opacity 0.2s ease")
      .on("mouseenter", (event, d) => {
        setHovered(d);
        d3.select(event.currentTarget).style("opacity", 0.8);
      })
      .on("mouseleave", (event) => {
        setHovered(null);
        d3.select(event.currentTarget).style("opacity", 1);
      })
      .on("click", (event, d) => {
        // Example interaction: filter original data indices by weather
        const allData = model.get("data") || [];
        const indices = allData
          .map((item, idx) => item.weather === d.weather ? idx : -1)
          .filter(idx => idx !== -1);
        
        model.set("selected_indices", indices);
        model.save_changes();
      });

    // Bar Labels
    svg.selectAll(".label")
      .data(processedData)
      .enter()
      .append("text")
      .attr("x", d => x(d.count) + 5)
      .attr("y", d => y(d.weather) + y.bandwidth() / 2)
      .attr("dy", ".35em")
      .style("font-size", "11px")
      .style("fill", "#666")
      .text(d => d.count);

    return () => {
      d3.select(containerRef.current).selectAll("svg").remove();
    };
  }, [processedData]);

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: "20px",
        background: "#fff",
        borderRadius: "8px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        maxWidth: "640px",
      }}
    >
      <h3 style={{ margin: "0 0 16px 0", color: "#333" }}>
        Weather Conditions Distribution
      </h3>

      <Tooltip data={hovered} />

      <div ref={containerRef}></div>

      <div
        style={{
          marginTop: "12px",
          fontSize: "11px",
          color: "#888",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Click bars to filter global selection</span>
        {selection.length > 0 && (
          <button
            onClick={() => {
              model.set("selected_indices", []);
              model.save_changes();
            }}
            style={{
              padding: "4px 8px",
              cursor: "pointer",
              background: "#f0f0f0",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          >
            Clear Selection ({selection.length})
          </button>
        )}
      </div>
    </div>
  );
}
