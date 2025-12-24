import * as d3 from 'd3';

export const Legend = ({ html, colorScale, weatherTypes }) => {
  return html`
    <div style=${{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px', fontSize: '12px', fontFamily: 'sans-serif' }}>
      ${weatherTypes.map(type => html`
        <div style=${{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style=${{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: colorScale(type) }}></div>
          <span style=${{ textTransform: 'capitalize', color: '#444' }}>${type}</span>
        </div>
      `)}
    </div>
  `;
};

export default function WeatherVisualization({ model, html, React }) {
  const containerRef = React.useRef(null);
  const [hovered, setHovered] = React.useState(null);
  const data = model.get("data") || [];

  // Initialize exports
  React.useEffect(() => {
    if (!model.get("selected_indices")) {
      model.set("selected_indices", []);
      model.save_changes();
    }
  }, []);

  const weatherColors = d3.scaleOrdinal()
    .domain(["sun", "fog", "drizzle", "rain", "snow"])
    .range(["#eab308", "#94a3b8", "#7dd3fc", "#3b82f6", "#6366f1"]);

  const weatherTypes = ["sun", "fog", "drizzle", "rain", "snow"];

  React.useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr("style", "max-width: 100%; height: auto; font-family: sans-serif;");

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const parseDate = d3.timeParse("%Y-%m-%d");
    const formattedData = data.map((d, i) => ({
      ...d,
      index: i,
      date: parseDate(d.date)
    }));

    const x = d3.scaleTime()
      .domain(d3.extent(formattedData, d => d.date))
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([d3.min(formattedData, d => d.temp_min) - 2, d3.max(formattedData, d => d.temp_max) + 2])
      .range([height, 0]);

    const r = d3.scaleSqrt()
      .domain([0, d3.max(formattedData, d => d.precipitation)])
      .range([2, 15]);

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(8))
      .call(g => g.select(".domain").remove())
      .attr("color", "#666");

    g.append("g")
      .call(d3.axisLeft(y))
      .call(g => g.select(".domain").remove())
      .attr("color", "#666")
      .append("text")
      .attr("x", -margin.left)
      .attr("y", -10)
      .attr("fill", "currentColor")
      .attr("text-anchor", "start")
      .text("Temperature (°C)");

    // Grid lines
    g.append("g")
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.1)
      .call(g => g.append("g")
        .selectAll("line")
        .data(y.ticks())
        .join("line")
          .attr("y1", d => y(d))
          .attr("y2", d => y(d))
          .attr("x2", width));

    const brush = d3.brush()
      .extent([[0, 0], [width, height]])
      .on("start brush end", brushed);

    const brushGroup = g.append("g").call(brush);

    const dots = g.append("g")
      .selectAll("circle")
      .data(formattedData)
      .join("circle")
        .attr("cx", d => x(d.date))
        .attr("cy", d => y(d.temp_max))
        .attr("r", d => r(d.precipitation))
        .attr("fill", d => weatherColors(d.weather))
        .attr("fill-opacity", 0.7)
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .on("mouseenter", (event, d) => setHovered(d))
        .on("mouseleave", () => setHovered(null));

    function brushed({ selection }) {
      let selectedIndices = [];
      if (selection) {
        const [[x0, y0], [x1, y1]] = selection;
        dots.each(function(d) {
          const isSelected = x0 <= x(d.date) && x(d.date) <= x1 && y0 <= y(d.temp_max) && y(d.temp_max) <= y1;
          d3.select(this).attr("stroke", isSelected ? "#000" : "#fff")
            .attr("stroke-width", isSelected ? 1.5 : 0.5)
            .attr("fill-opacity", isSelected ? 1 : 0.4);
          if (isSelected) selectedIndices.push(d.index);
        });
      } else {
        dots.attr("stroke", "#fff").attr("stroke-width", 0.5).attr("fill-opacity", 0.7);
      }
      model.set("selected_indices", selectedIndices);
      model.save_changes();
    }

    return () => {
      svg.remove();
    };
  }, [data, d3]);

  if (!d3 || !weatherColors) {
    return html`<div style=${{ padding: '20px', textAlign: 'center', color: '#666' }}>Loading D3...</div>`;
  }

  return html`
    <div style=${{ 
      background: '#ffffff', 
      padding: '20px', 
      borderRadius: '8px', 
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', 
      border: '1px solid #e5e7eb'
    }}>
      <header style=${{ marginBottom: '16px' }}>
        <h2 style=${{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600', color: '#111827' }}>
          Seattle Weather Trends
        </h2>
        <p style=${{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
          Max Temp vs Time. Size represents precipitation. Brush to select.
        </p>
      </header>
      
      <${Legend} html=${html} colorScale=${weatherColors} weatherTypes=${weatherTypes} />
      
      <div ref=${containerRef} style=${{ width: '100%', position: 'relative' }}></div>
      
      <div style=${{ height: '24px', marginTop: '8px' }}>
        ${hovered && html`
          <div style=${{ fontSize: '13px', color: '#374151', display: 'flex', gap: '16px' }}>
            <span><strong>Date:</strong> ${hovered.date.toLocaleDateString()}</span>
            <span><strong>Max Temp:</strong> ${hovered.temp_max}°C</span>
            <span><strong>Precip:</strong> ${hovered.precipitation}mm</span>
            <span style=${{ textTransform: 'capitalize' }}><strong>Weather:</strong> ${hovered.weather}</span>
          </div>
        `}
      </div>
    </div>
  `;
}