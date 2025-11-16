import * as d3 from "https://esm.sh/d3@7";

function render({ model, el }) {
  const margin = { top: 20, right: 20, bottom: 50, left: 60 };
  const width = 600 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  function createScatterplot() {
    el.innerHTML = "";
    
    const data = model.get("data");
    
    const svg = d3.select(el)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .style("background", "#f9f9f9")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear()
      .domain([d3.min(data, d => d.height) - 10, d3.max(data, d => d.height) + 10])
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([d3.min(data, d => d.weight) - 10, d3.max(data, d => d.weight) + 10])
      .range([height, 0]);

    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .append("text")
      .attr("x", width / 2)
      .attr("y", 40)
      .attr("fill", "black")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .text("Height");

    svg.append("g")
      .call(yAxis)
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -45)
      .attr("fill", "black")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("text-anchor", "middle")
      .text("Weight");

    const tooltip = d3.select(el)
      .append("div")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "8px 12px")
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("opacity", 0);

    svg.selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", d => xScale(d.height))
      .attr("cy", d => yScale(d.weight))
      .attr("r", 0)
      .attr("fill", "#4682b4")
      .attr("stroke", "#2c5985")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .transition()
      .duration(800)
      .attr("r", 8);

    svg.selectAll("circle")
      .on("mouseover", function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", 12)
          .attr("fill", "#ff6347");
        
        tooltip
          .style("opacity", 1)
          .html(`Height: ${d.height}<br>Weight: ${d.weight}`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 20) + "px");
      })
      .on("mousemove", function(event) {
        tooltip
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 20) + "px");
      })
      .on("mouseout", function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", 8)
          .attr("fill", "#4682b4");
        
        tooltip.style("opacity", 0);
      });
  }

  createScatterplot();

  model.on("change:data", () => {
    createScatterplot();
  });
}

export default { render };