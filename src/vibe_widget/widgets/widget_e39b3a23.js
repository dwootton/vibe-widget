import * as d3 from "https://esm.sh/d3@7";

function render({ model, el }) {
  const data = model.get("data");
  
  // Create container with atmospheric styling
  el.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Outfit:wght@400;500;600&display=swap');
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      .chart-container {
        width: 100%;
        height: 500px;
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
        padding: 40px 30px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        font-family: 'Outfit', sans-serif;
        position: relative;
        overflow: hidden;
      }
      
      .chart-container::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: 
          radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.08) 0%, transparent 50%);
        pointer-events: none;
      }
      
      .chart-header {
        position: relative;
        z-index: 1;
        margin-bottom: 10px;
      }
      
      .chart-title {
        font-family: 'Playfair Display', serif;
        font-size: 28px;
        font-weight: 700;
        background: linear-gradient(135deg, #e0e7ff 0%, #bfdbfe 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        letter-spacing: -0.5px;
      }
      
      .chart-subtitle {
        font-size: 12px;
        color: #94a3b8;
        font-weight: 500;
        margin-top: 4px;
        letter-spacing: 0.5px;
      }
      
      svg {
        width: 100%;
        height: 100%;
        position: relative;
        z-index: 2;
      }
      
      .bar-group {
        cursor: pointer;
      }
      
      .bar {
        fill: url(#barGradient);
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        filter: drop-shadow(0 4px 12px rgba(139, 92, 246, 0.15));
      }
      
      .bar:hover {
        filter: drop-shadow(0 8px 20px rgba(139, 92, 246, 0.4)) brightness(1.1);
        transform: translateY(-4px);
      }
      
      .bar-label {
        font-size: 13px;
        font-weight: 600;
        fill: #cbd5e1;
        text-anchor: middle;
        pointer-events: none;
      }
      
      .bar-value {
        font-size: 14px;
        font-weight: 700;
        fill: #e0e7ff;
        text-anchor: middle;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .bar-group:hover .bar-value {
        opacity: 1;
      }
      
      .axis-label {
        font-size: 11px;
        fill: #64748b;
        font-weight: 500;
      }
      
      .grid-line {
        stroke: #334155;
        stroke-dasharray: 4;
        opacity: 0.3;
        stroke-width: 1;
      }
    </style>
    
    <div class="chart-container">
      <div class="chart-header">
        <div class="chart-title">Data Overview</div>
        <div class="chart-subtitle">Interactive category visualization</div>
      </div>
      <svg id="barChart"></svg>
    </div>
  `;
  
  const svg = d3.select(el).select("#barChart");
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const width = el.querySelector(".chart-container").clientWidth - margin.left - margin.right;
  const height = el.querySelector(".chart-container").clientHeight - margin.top - margin.bottom - 80;
  
  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  
  // Add gradient definitions
  svg.append("defs").append("linearGradient")
    .attr("id", "barGradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "0%")
    .attr("y2", "100%")
    .selectAll("stop")
    .data([
      { offset: "0%", color: "#a78bfa" },
      { offset: "100%", color: "#3b82f6" }
    ])
    .enter()
    .append("stop")
    .attr("offset", d => d.offset)
    .attr("stop-color", d => d.color);
  
  const xScale = d3.scaleBand()
    .domain(data.map(d => d.category))
    .range([0, width])
    .padding(0.25);
  
  const maxValue = d3.max(data, d => d.value) * 1.1;
  const yScale = d3.scaleLinear()
    .domain([0, maxValue])
    .range([height, 0]);
  
  // Grid lines
  g.append("g")
    .attr("class", "grid")
    .selectAll("line")
    .data(yScale.ticks(5))
    .enter()
    .append("line")
    .attr("class", "grid-line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", d => yScale(d))
    .attr("y2", d => yScale(d));
  
  // Y axis
  g.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(yScale).ticks(5).tickSize(-width).tickFormat(d => d === 0 ? "" : d))
    .select(".domain").remove();
  
  g.selectAll(".y-axis .tick line")
    .attr("stroke", "none");
  
  g.selectAll(".y-axis .tick text")
    .attr("class", "axis-label")
    .attr("x", -8);
  
  // Bars with animation
  g.selectAll(".bar-group")
    .data(data)
    .enter()
    .append("g")
    .attr("class", "bar-group")
    .attr("transform", (d, i) => `translate(${xScale(d.category)},0)`)
    .style("opacity", 0)
    .transition()
    .duration(500)
    .delay((d, i) => i * 80)
    .style("opacity", 1)
    .on("end", function(d, i) {
      if (i === data.length - 1) {
        // All bars visible
      }
    })
    .append(function() { return this.parentNode; })
    .selectAll(".bar-group")
    .data(data)
    .enter()
    .append("g")
    .attr("class", "bar-group")
    .attr("transform", (d, i) => `translate(${xScale(d.category)},0)`)
    .each(function(d) {
      const group = d3.select(this);
      
      group.append("rect")
        .attr("class", "bar")
        .attr("x", 0)
        .attr("y", height)
        .attr("width", xScale.bandwidth())
        .attr("height", 0)
        .attr("rx", 4)
        .transition()
        .duration(500)
        .delay((_, i) => i * 80)
        .attr("y", yScale(d.value))
        .attr("height", height - yScale(d.value));
      
      group.append("text")
        .attr("class", "bar-value")
        .attr("x", xScale.bandwidth() / 2)
        .attr("y", yScale(d.value) - 8)
        .text(d.value);
      
      group.append("text")
        .attr("class", "bar-label")
        .attr("x", xScale.bandwidth() / 2)
        .attr("y", height + 20)
        .text(d.category);
    });
  
  // X axis line
  g.append("line")
    .attr("stroke", "#475569")
    .attr("stroke-width", 1.5)
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", height)
    .attr("y2", height);
  
  // Reactive updates
  model.on("change:data", () => {
    const newData = model.get("data");
    
    const newXScale = d3.scaleBand()
      .domain(newData.map(d => d.category))
      .range([0, width])
      .padding(0.25);
    
    const newMaxValue = d3.max(newData, d => d.value) * 1.1;
    const newYScale = d3.scaleLinear()
      .domain([0, newMaxValue])
      .range([height, 0]);
    
    g.selectAll(".bar-group").remove();
    
    g.selectAll(".bar-group")
      .data(newData)
      .enter()
      .append("g")
      .attr("class", "bar-group")
      .attr("transform", (d) => `translate(${newXScale(d.category)},0)`)
      .each(function(d) {
        const group = d3.select(this);
        
        group.append("rect")
          .attr("class", "bar")
          .attr("x", 0)
          .attr("y", newYScale(d.value))
          .attr("width", newXScale.bandwidth())
          .attr("height", height - newYScale(d.value))
          .attr("rx", 4);
        
        group.append("text")
          .attr("class", "bar-value")
          .attr("x", newXScale.bandwidth() / 2)
          .attr("y", newYScale(d.value) - 8)
          .text(d.value);
        
        group.append("text")
          .attr("class", "bar-label")
          .attr("x", newXScale.bandwidth() / 2)
          .attr("y", height + 20)
          .text(d.category);
      });
  });
}

export default { render };