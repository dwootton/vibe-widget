import * as d3 from "https://esm.sh/d3@7";

function render({ model, el }) {
  const data = model.get("data");
  
  const container = document.createElement("div");
  container.style.cssText = `
    font-family: Arial, sans-serif;
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    box-shadow: 0 8px 16px rgba(0,0,0,0.2);
  `;
  
  const title = document.createElement("h2");
  title.textContent = "Height & Weight Pictograph";
  title.style.cssText = `
    color: white;
    text-align: center;
    margin-bottom: 30px;
    font-size: 24px;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
  `;
  container.appendChild(title);
  
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const width = 800;
  const height = 500;
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.style.cssText = `
    background: white;
    border-radius: 8px;
    display: block;
    margin: 0 auto;
  `;
  
  const margin = { top: 40, right: 40, bottom: 60, left: 80 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("transform", `translate(${margin.left},${margin.top})`);
  svg.appendChild(g);
  
  const heightScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.height)])
    .range([chartHeight, 0]);
  
  const weightScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.weight)])
    .range([0, chartWidth]);
  
  const colorScale = d3.scaleSequential(d3.interpolateViridis)
    .domain([0, data.length - 1]);
  
  data.forEach((d, i) => {
    const x = (i / data.length) * chartWidth + chartWidth / (data.length * 2);
    const y = heightScale(d.height);
    
    const personGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    personGroup.setAttribute("transform", `translate(${x},${y})`);
    personGroup.style.cursor = "pointer";
    
    const scale = Math.min(0.8, d.weight / 100);
    const figureScale = 0.3 + scale * 0.4;
    
    const head = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    head.setAttribute("cx", "0");
    head.setAttribute("cy", "-35");
    head.setAttribute("r", 15 * figureScale);
    head.setAttribute("fill", colorScale(i));
    head.setAttribute("stroke", "#333");
    head.setAttribute("stroke-width", "2");
    
    const body = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    body.setAttribute("x", -10 * figureScale);
    body.setAttribute("y", -20);
    body.setAttribute("width", 20 * figureScale);
    body.setAttribute("height", 30 * figureScale);
    body.setAttribute("fill", colorScale(i));
    body.setAttribute("stroke", "#333");
    body.setAttribute("stroke-width", "2");
    body.setAttribute("rx", "5");
    
    const leftLeg = document.createElementNS("http://www.w3.org/2000/svg", "line");
    leftLeg.setAttribute("x1", -5 * figureScale);
    leftLeg.setAttribute("y1", 10 * figureScale);
    leftLeg.setAttribute("x2", -8 * figureScale);
    leftLeg.setAttribute("y2", 30 * figureScale);
    leftLeg.setAttribute("stroke", colorScale(i));
    leftLeg.setAttribute("stroke-width", "4");
    leftLeg.setAttribute("stroke-linecap", "round");
    
    const rightLeg = document.createElementNS("http://www.w3.org/2000/svg", "line");
    rightLeg.setAttribute("x1", 5 * figureScale);
    rightLeg.setAttribute("y1", 10 * figureScale);
    rightLeg.setAttribute("x2", 8 * figureScale);
    rightLeg.setAttribute("y2", 30 * figureScale);
    rightLeg.setAttribute("stroke", colorScale(i));
    rightLeg.setAttribute("stroke-width", "4");
    rightLeg.setAttribute("stroke-linecap", "round");
    
    const leftArm = document.createElementNS("http://www.w3.org/2000/svg", "line");
    leftArm.setAttribute("x1", -10 * figureScale);
    leftArm.setAttribute("y1", -15);
    leftArm.setAttribute("x2", -18 * figureScale);
    leftArm.setAttribute("y2", 5);
    leftArm.setAttribute("stroke", colorScale(i));
    leftArm.setAttribute("stroke-width", "4");
    leftArm.setAttribute("stroke-linecap", "round");
    
    const rightArm = document.createElementNS("http://www.w3.org/2000/svg", "line");
    rightArm.setAttribute("x1", 10 * figureScale);
    rightArm.setAttribute("y1", -15);
    rightArm.setAttribute("x2", 18 * figureScale);
    rightArm.setAttribute("y2", 5);
    rightArm.setAttribute("stroke", colorScale(i));
    rightArm.setAttribute("stroke-width", "4");
    rightArm.setAttribute("stroke-linecap", "round");
    
    personGroup.appendChild(body);
    personGroup.appendChild(leftLeg);
    personGroup.appendChild(rightLeg);
    personGroup.appendChild(leftArm);
    personGroup.appendChild(rightArm);
    personGroup.appendChild(head);
    
    const tooltip = document.createElementNS("http://www.w3.org/2000/svg", "text");
    tooltip.setAttribute("x", "0");
    tooltip.setAttribute("y", "50");
    tooltip.setAttribute("text-anchor", "middle");
    tooltip.setAttribute("fill", "#333");
    tooltip.setAttribute("font-size", "12");
    tooltip.setAttribute("font-weight", "bold");
    tooltip.setAttribute("opacity", "0");
    tooltip.textContent = `H:${d.height}cm W:${d.weight}kg`;
    personGroup.appendChild(tooltip);
    
    personGroup.addEventListener("mouseenter", () => {
      tooltip.setAttribute("opacity", "1");
      personGroup.style.filter = "drop-shadow(0 0 8px rgba(0,0,0,0.5))";
    });
    
    personGroup.addEventListener("mouseleave", () => {
      tooltip.setAttribute("opacity", "0");
      personGroup.style.filter = "none";
    });
    
    g.appendChild(personGroup);
  });
  
  const heightAxis = d3.axisLeft(heightScale).ticks(5);
  const heightAxisG = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.appendChild(heightAxisG);
  d3.select(heightAxisG).call(heightAxis);
  
  const heightLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  heightLabel.setAttribute("transform", "rotate(-90)");
  heightLabel.setAttribute("x", -chartHeight / 2);
  heightLabel.setAttribute("y", -60);
  heightLabel.setAttribute("text-anchor", "middle");
  heightLabel.setAttribute("fill", "#333");
  heightLabel.setAttribute("font-size", "14");
  heightLabel.setAttribute("font-weight", "bold");
  heightLabel.textContent = "Height (cm)";
  g.appendChild(heightLabel);
  
  const bottomAxis = d3.axisBottom(d3.scaleLinear().domain([1, data.length]).range([0, chartWidth])).ticks(data.length);
  const bottomAxisG = document.createElementNS("http://www.w3.org/2000/svg", "g");
  bottomAxisG.setAttribute("transform", `translate(0,${chartHeight})`);
  g.appendChild(bottomAxisG);
  d3.select(bottomAxisG).call(bottomAxis);
  
  const personLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  personLabel.setAttribute("x", chartWidth / 2);
  personLabel.setAttribute("y", chartHeight + 45);
  personLabel.setAttribute("text-anchor", "middle");
  personLabel.setAttribute("fill", "#333");
  personLabel.setAttribute("font-size", "14");
  personLabel.setAttribute("font-weight", "bold");
  personLabel.textContent = "Person";
  g.appendChild(personLabel);
  
  container.appendChild(svg);
  el.appendChild(container);
  
  model.on("change:data", () => {
    el.innerHTML = "";
    render({ model, el });
  });
}

export default { render };