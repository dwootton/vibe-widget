import * as d3 from "https://esm.sh/d3@7";

const COLORS = {
  Confirmed: "#1565C0", // Dark Blue
  Deaths: "#C62828",    // Dark Red
  Recovered: "#2E7D32"  // Dark Green
};

export const ChartLegend = ({ keys, colors }) => (
  <div
    style={{
      display: "flex",
      gap: "16px",
      marginBottom: "12px",
      justifyContent: "center",
      fontSize: "14px",
      fontFamily: "sans-serif",
    }}
  >
    {keys.map((key) => (
      <div key={key} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span
          style={{
            width: "12px",
            height: "12px",
            backgroundColor: colors[key],
            borderRadius: "50%",
            display: "inline-block",
          }}
        ></span>
        <span style={{ color: "#333", fontWeight: "600" }}>{key}</span>
      </div>
    ))}
  </div>
);

export const Toggle = ({ label, checked, onChange }) => (
  <label
    style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "14px",
      cursor: "pointer",
      fontFamily: "sans-serif",
      color: "#333",
    }}
  >
    <input type="checkbox" checked={checked} onChange={onChange} style={{ cursor: "pointer" }} />
    {label}
  </label>
);

export default function Widget({ model, React }) {
  const rawData = model.get("data") || [];
  const containerRef = React.useRef(null);
  const [useLogScale, setUseLogScale] = React.useState(false);
  const [hoverData, setHoverData] = React.useState(null);

  // Parse data once
  const parsedData = React.useMemo(() => {
    const parseTime = d3.timeParse("%Y-%m-%d");
    return rawData.map(d => ({
      ...d,
      dateObj: parseTime(d.Date),
      Confirmed: +d.Confirmed,
      Deaths: +d.Deaths,
      Recovered: +d.Recovered
    })).sort((a, b) => a.dateObj - b.dateObj);
  }, [rawData]);

  React.useEffect(() => {
    if (!containerRef.current || parsedData.length === 0) return;

    const width = containerRef.current.clientWidth || 800;
    const height = 400;
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear previous chart
    const container = d3.select(containerRef.current);
    container.selectAll("*").remove();

    const svg = container.append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto; font-family: sans-serif;");

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleTime()
      .domain(d3.extent(parsedData, d => d.dateObj))
      .range([0, innerWidth]);

    const yMax = d3.max(parsedData, d => Math.max(d.Confirmed, d.Deaths, d.Recovered));
    
    // Log scale handling: Log(0) is -Infinity, so we clamp min value to 1
    const y = useLogScale
      ? d3.scaleLog().domain([1, yMax]).range([innerHeight, 0]).nice()
      : d3.scaleLinear().domain([0, yMax]).range([innerHeight, 0]).nice();

    // Axes
    const xAxis = d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0);
    const yAxis = d3.axisLeft(y).ticks(height / 40, useLogScale ? "~s" : "s");

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .call(g => g.select(".domain").attr("stroke", "#666"))
      .call(g => g.selectAll(".tick line").attr("stroke", "#ccc"))
      .call(g => g.selectAll(".tick text").attr("fill", "#333"));

    g.append("g")
      .call(yAxis)
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#eee").attr("x2", innerWidth)) // grid lines
      .call(g => g.selectAll(".tick text").attr("fill", "#333"));

    // Lines
    const metrics = ["Confirmed", "Deaths", "Recovered"];
    
    metrics.forEach(metric => {
      const line = d3.line()
        .defined(d => !isNaN(d[metric]) && (useLogScale ? d[metric] > 0 : true))
        .x(d => x(d.dateObj))
        .y(d => y(Math.max(useLogScale ? 1 : 0, d[metric])));

      g.append("path")
        .datum(parsedData)
        .attr("fill", "none")
        .attr("stroke", COLORS[metric])
        .attr("stroke-width", 2.5)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("d", line);
    });

    // Hover Interaction (Overlay)
    const overlay = g.append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "transparent")
      .style("cursor", "crosshair");

    // Tooltip elements group
    const tooltipGroup = g.append("g")
      .style("pointer-events", "none")
      .style("opacity", 0);

    const tooltipLine = tooltipGroup.append("line")
      .attr("stroke", "#999")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 4");

    const highlightPoints = {};
    metrics.forEach(metric => {
      highlightPoints[metric] = tooltipGroup.append("circle")
        .attr("r", 5)
        .attr("fill", COLORS[metric])
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);
    });

    const bisect = d3.bisector(d => d.dateObj).center;

    overlay
      .on("mousemove", (event) => {
        const [mx] = d3.pointer(event);
        const dateVal = x.invert(mx);
        const index = bisect(parsedData, dateVal, 1);
        const a = parsedData[index - 1];
        const b = parsedData[index];
        const d = b && (dateVal - a.dateObj > b.dateObj - dateVal) ? b : a;

        if (d) {
          const xPos = x(d.dateObj);

          tooltipLine
            .attr("x1", xPos)
            .attr("x2", xPos)
            .attr("y1", 0)
            .attr("y2", innerHeight);

          metrics.forEach(metric => {
            const val = d[metric];
            // Only show point if it would be drawn on the line (handle log scale <= 0)
            if (val !== undefined && val !== null && (!useLogScale || val > 0)) {
              highlightPoints[metric]
                .attr("cx", xPos)
                .attr("cy", y(Math.max(useLogScale ? 1 : 0, val)))
                .style("display", null);
            } else {
              highlightPoints[metric].style("display", "none");
            }
          });

          tooltipGroup.style("opacity", 1);
          setHoverData(d);
        }
      })
      .on("mouseleave", () => {
        tooltipGroup.style("opacity", 0);
        setHoverData(null);
      });

    return () => {
      svg.remove();
    };
  }, [parsedData, useLogScale]);

  const formatDate = (date) => {
    if (!date) return "";
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatNum = (num) => new Intl.NumberFormat().format(num);

  return (
    <div
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        border: "1px solid #e0e0e0",
        borderRadius: "8px",
        padding: "20px",
        backgroundColor: "#fff",
        color: "#333",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>Global COVID-19 Trends</h2>
        <Toggle label="Log Scale" checked={useLogScale} onChange={(e) => setUseLogScale(e.target.checked)} />
      </div>

      <ChartLegend keys={["Confirmed", "Deaths", "Recovered"]} colors={COLORS} />

      <div style={{ position: "relative" }}>
        <div ref={containerRef} style={{ width: "100%", minHeight: "400px" }}></div>

        {hoverData && (
          <div
            style={{
              position: "absolute",
              top: "10px",
              left: "60px",
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              border: "1px solid #ddd",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              padding: "12px",
              borderRadius: "4px",
              pointerEvents: "none",
              fontSize: "13px",
              lineHeight: "1.6",
              zIndex: 10,
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                marginBottom: "4px",
                borderBottom: "1px solid #eee",
                paddingBottom: "4px",
              }}
            >
              {formatDate(hoverData.dateObj)}
            </div>
            <div style={{ color: COLORS.Confirmed }}>
              Confirmed: <strong>{formatNum(hoverData.Confirmed)}</strong>
            </div>
            <div style={{ color: COLORS.Deaths }}>
              Deaths: <strong>{formatNum(hoverData.Deaths)}</strong>
            </div>
            <div style={{ color: COLORS.Recovered }}>
              Recovered: <strong>{formatNum(hoverData.Recovered)}</strong>
            </div>
            <div style={{ marginTop: "4px", color: "#666", fontSize: "12px" }}>
              Active: {formatNum(hoverData.Active)}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: "12px", fontSize: "12px", color: "#777", textAlign: "right" }}>
        Data source: Global Summary
      </div>
    </div>
  );
}
