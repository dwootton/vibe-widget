import * as d3 from "https://esm.sh/d3@7";

export default function PaperEmbeddingWidget({ model, React }) {
  const containerRef = React.useRef(null);
  const tooltipRef = React.useRef(null);
  const [hoveredPaper, setHoveredPaper] = React.useState(null);

  // Constants
  const width = 800;
  const height = 500;
  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const baseColor = "#BDBDBD";
  const orangeGlow = "#FF9800";

  const getColor = (score) => {
    if (score > 0.8) return "#4FC3F7"; // High
    if (score > 0.5) return "#64B5F6"; // Medium
    if (score > 0.2) return "#90CAF9"; // Low
    return "#E3F2FD"; // Very low
  };

  React.useEffect(() => {
    if (!containerRef.current) return;

    const data = model.get("data") || [];
    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("width", "100%")
      .style("height", "auto")
      .style("background", "#f9f9f9")
      .style("border-radius", "8px");

    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 8])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    // Scales
    const xExtent = d3.extent(data, d => d.x);
    const yExtent = d3.extent(data, d => d.y);
    
    const xScale = d3.scaleLinear()
      .domain(xExtent)
      .range([margin.left, width - margin.right]);
      
    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([height - margin.bottom, margin.top]);

    // Draw nodes
    const nodes = g.selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y))
      .attr("r", 4)
      .attr("fill", baseColor)
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("mouseenter", (event, d) => {
        setHoveredPaper(d);
        d3.select(event.currentTarget)
          .transition().duration(200)
          .attr("r", 10)
          .attr("stroke-width", 2);
      })
      .on("mouseleave", (event, d) => {
        setHoveredPaper(null);
        const isTriggered = model.get("similarity_scores")?.length > 0;
        d3.select(event.currentTarget)
          .transition().duration(200)
          .attr("r", isTriggered ? 5 : 4)
          .attr("stroke-width", 0.5);
      });

    const runWaveAnimation = (scores) => {
      if (!scores || scores.length === 0) return;

      // Find max similarity point
      let maxIdx = 0;
      let maxVal = -1;
      scores.forEach((s, i) => {
        if (s > maxVal) {
          maxVal = s;
          maxIdx = i;
        }
      });

      const centerX = xScale(data[maxIdx].x);
      const centerY = yScale(data[maxIdx].y);

      // Reset all to gray first
      nodes.interrupt().attr("fill", baseColor).attr("r", 4);

      // Calculate distances from origin of wave
      nodes.each(function(d, i) {
        const dx = xScale(d.x) - centerX;
        const dy = yScale(d.y) - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const score = scores[i];
        
        // Stagger based on distance (2 seconds total expand)
        const delay = dist * 5; 

        d3.select(this)
          .transition()
          .delay(delay)
          .duration(600)
          .ease(d3.easeBackOut)
          .attr("fill", i === maxIdx ? orangeGlow : getColor(score))
          .attr("r", i === maxIdx ? 8 : 5)
          .attr("stroke", i === maxIdx ? "#E65100" : "#fff");
      });
    };

    const handleScoreChange = () => {
      const scores = model.get("similarity_scores");
      runWaveAnimation(scores);
    };

    model.on("change:similarity_scores", handleScoreChange);

    return () => {
      model.off("change:similarity_scores", handleScoreChange);
      svg.remove();
    };
  }, [model]);

  return (
    <div style={{ position: "relative", fontFamily: "system-ui" }}>
      <div ref={containerRef}></div>

      {hoveredPaper && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            width: "240px",
            background: "rgba(255, 255, 255, 0.95)",
            padding: "12px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            fontSize: "12px",
            pointerEvents: "none",
            border: "1px solid #eee",
            zIndex: 100,
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#333" }}>{hoveredPaper.title}</div>
          <div
            style={{
              color: "#666",
              fontSize: "11px",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
            }}
          >
            {hoveredPaper.abstract}
          </div>
          <div style={{ marginTop: "6px", fontSize: "10px", color: "#888" }}>
            Session: {hoveredPaper.session}
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "10px",
          fontSize: "10px",
          background: "white",
          padding: "5px",
          borderRadius: "4px",
          display: "flex",
          gap: "10px",
          border: "1px solid #ddd",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4FC3F7" }}></div> High
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#90CAF9" }}></div> Low
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: orangeGlow }}></div> Match
        </div>
      </div>
    </div>
  );
}
