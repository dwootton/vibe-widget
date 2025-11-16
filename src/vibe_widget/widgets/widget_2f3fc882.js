import * as d3 from "https://esm.sh/d3@7";

function render({ model, el }) {
  const data = model.get("data");
  
  // Clear previous content
  el.innerHTML = '';
  
  // Set up container styling
  const container = document.createElement('div');
  container.style.cssText = 'padding: 20px; font-family: Arial, sans-serif;';
  el.appendChild(container);
  
  // Add title
  const title = document.createElement('h2');
  title.textContent = 'Height and Weight Pictograph';
  title.style.cssText = 'color: #333; margin-bottom: 20px; text-align: center;';
  container.appendChild(title);
  
  // Create SVG container
  const svgContainer = document.createElement('div');
  svgContainer.style.cssText = 'display: flex; gap: 40px; justify-content: center; flex-wrap: wrap;';
  container.appendChild(svgContainer);
  
  // Height visualization
  const heightDiv = document.createElement('div');
  heightDiv.style.cssText = 'display: flex; flex-direction: column; align-items: center;';
  
  const heightTitle = document.createElement('h3');
  heightTitle.textContent = 'Height (cm)';
  heightTitle.style.cssText = 'color: #4CAF50; margin-bottom: 15px;';
  heightDiv.appendChild(heightTitle);
  
  const heightSvg = d3.select(heightDiv)
    .append('svg')
    .attr('width', 300)
    .attr('height', 350)
    .style('background', '#f5f5f5')
    .style('border-radius', '8px')
    .style('box-shadow', '0 2px 8px rgba(0,0,0,0.1)');
  
  const heightMax = d3.max(data, d => d.height);
  const heightScale = d3.scaleLinear()
    .domain([0, heightMax])
    .range([250, 50]);
  
  heightSvg.selectAll('.height-bar')
    .data(data)
    .enter()
    .append('rect')
    .attr('class', 'height-bar')
    .attr('x', (d, i) => i * 90 + 20)
    .attr('y', d => heightScale(d.height))
    .attr('width', 50)
    .attr('height', d => 250 - heightScale(d.height))
    .attr('fill', '#4CAF50')
    .attr('rx', 4)
    .style('opacity', 0.8)
    .style('transition', 'opacity 0.3s')
    .on('mouseover', function() {
      d3.select(this).style('opacity', 1);
    })
    .on('mouseout', function() {
      d3.select(this).style('opacity', 0.8);
    });
  
  // Add height labels
  heightSvg.selectAll('.height-label')
    .data(data)
    .enter()
    .append('text')
    .attr('class', 'height-label')
    .attr('x', (d, i) => i * 90 + 45)
    .attr('y', d => heightScale(d.height) - 10)
    .attr('text-anchor', 'middle')
    .attr('fill', '#333')
    .attr('font-weight', 'bold')
    .attr('font-size', '12px')
    .text(d => d.height);
  
  // Add index labels
  heightSvg.selectAll('.height-index')
    .data(data)
    .enter()
    .append('text')
    .attr('x', (d, i) => i * 90 + 45)
    .attr('y', 285)
    .attr('text-anchor', 'middle')
    .attr('fill', '#666')
    .attr('font-size', '11px')
    .text((d, i) => `Person ${i + 1}`);
  
  svgContainer.appendChild(heightDiv);
  
  // Weight visualization
  const weightDiv = document.createElement('div');
  weightDiv.style.cssText = 'display: flex; flex-direction: column; align-items: center;';
  
  const weightTitle = document.createElement('h3');
  weightTitle.textContent = 'Weight (kg)';
  weightTitle.style.cssText = 'color: #2196F3; margin-bottom: 15px;';
  weightDiv.appendChild(weightTitle);
  
  const weightSvg = d3.select(weightDiv)
    .append('svg')
    .attr('width', 300)
    .attr('height', 350)
    .style('background', '#f5f5f5')
    .style('border-radius', '8px')
    .style('box-shadow', '0 2px 8px rgba(0,0,0,0.1)');
  
  const weightMax = d3.max(data, d => d.weight);
  const weightScale = d3.scaleLinear()
    .domain([0, weightMax])
    .range([250, 50]);
  
  weightSvg.selectAll('.weight-bar')
    .data(data)
    .enter()
    .append('circle')
    .attr('class', 'weight-bar')
    .attr('cx', (d, i) => i * 90 + 45)
    .attr('cy', d => weightScale(d.weight))
    .attr('r', d => Math.sqrt(d.weight) * 2)
    .attr('fill', '#2196F3')
    .style('opacity', 0.7)
    .style('transition', 'opacity 0.3s')
    .on('mouseover', function() {
      d3.select(this).style('opacity', 1);
    })
    .on('mouseout', function() {
      d3.select(this).style('opacity', 0.7);
    });
  
  // Add weight labels
  weightSvg.selectAll('.weight-label')
    .data(data)
    .enter()
    .append('text')
    .attr('x', (d, i) => i * 90 + 45)
    .attr('y', d => weightScale(d.weight) + 5)
    .attr('text-anchor', 'middle')
    .attr('fill', '#fff')
    .attr('font-weight', 'bold')
    .attr('font-size', '12px')
    .text(d => d.weight);
  
  // Add index labels
  weightSvg.selectAll('.weight-index')
    .data(data)
    .enter()
    .append('text')
    .attr('x', (d, i) => i * 90 + 45)
    .attr('y', 285)
    .attr('text-anchor', 'middle')
    .attr('fill', '#666')
    .attr('font-size', '11px')
    .text((d, i) => `Person ${i + 1}`);
  
  weightDiv.appendChild(weightSvg);
  svgContainer.appendChild(weightDiv);
  
  // Listen for data changes
  model.on("change:data", () => {
    render({ model, el });
  });
}

export default { render };