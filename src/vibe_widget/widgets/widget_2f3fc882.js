import * as d3 from "https://esm.sh/d3@7";

function render({ model, el }) {
  const data = model.get("data");
  
  // Clear previous content
  el.innerHTML = "";
  
  // Create container
  const container = document.createElement("div");
  container.style.cssText = "width: 100%; height: 100%; padding: 20px; font-family: Arial, sans-serif;";
  el.appendChild(container);
  
  // Create title
  const title = document.createElement("h2");
  title.textContent = "Height & Weight Pictograph";
  title.style.cssText = "text-align: center; color: #333; margin-bottom: 30px;";
  container.appendChild(title);
  
  // Create visualization container
  const vizContainer = document.createElement("div");
  vizContainer.style.cssText = "display: flex; flex-direction: column; gap: 30px; max-width: 800px; margin: 0 auto;";
  container.appendChild(vizContainer);
  
  // Normalize data for visualization
  const maxHeight = Math.max(...data.map(d => d.height));
  const maxWeight = Math.max(...data.map(d => d.weight));
  
  data.forEach((item, index) => {
    const row = document.createElement("div");
    row.style.cssText = "display: flex; align-items: center; gap: 15px; padding: 15px; background: #f5f5f5; border-radius: 8px;";
    
    // Label
    const label = document.createElement("div");
    label.style.cssText = "min-width: 150px; font-weight: bold; color: #333;";
    label.innerHTML = `Person ${index + 1}<br><small style="font-weight: normal; color: #666;">H: ${item.height}cm | W: ${item.weight}kg</small>`;
    row.appendChild(label);
    
    // Height visualization
    const heightBox = document.createElement("div");
    heightBox.style.cssText = "display: flex; flex-direction: column; flex: 1;";
    const heightLabel = document.createElement("div");
    heightLabel.style.cssText = "font-size: 12px; color: #666; margin-bottom: 5px;";
    heightLabel.textContent = "Height";
    const heightBar = document.createElement("div");
    const heightPercent = (item.height / maxHeight) * 100;
    heightBar.style.cssText = `height: 30px; background: linear-gradient(90deg, #4CAF50, #8BC34A); width: ${heightPercent}%; border-radius: 4px; transition: width 0.3s ease; cursor: pointer;`;
    heightBar.onmouseover = () => heightBar.style.opacity = "0.8";
    heightBar.onmouseout = () => heightBar.style.opacity = "1";
    heightBox.appendChild(heightLabel);
    heightBox.appendChild(heightBar);
    row.appendChild(heightBox);
    
    // Weight visualization
    const weightBox = document.createElement("div");
    weightBox.style.cssText = "display: flex; flex-direction: column; flex: 1;";
    const weightLabel = document.createElement("div");
    weightLabel.style.cssText = "font-size: 12px; color: #666; margin-bottom: 5px;";
    weightLabel.textContent = "Weight";
    const weightBar = document.createElement("div");
    const weightPercent = (item.weight / maxWeight) * 100;
    weightBar.style.cssText = `height: 30px; background: linear-gradient(90deg, #FF6B6B, #FF8E72); width: ${weightPercent}%; border-radius: 4px; transition: width 0.3s ease; cursor: pointer;`;
    weightBar.onmouseover = () => weightBar.style.opacity = "0.8";
    weightBar.onmouseout = () => weightBar.style.opacity = "1";
    weightBox.appendChild(weightLabel);
    weightBox.appendChild(weightBar);
    row.appendChild(weightBox);
    
    vizContainer.appendChild(row);
  });
  
  // Add legend
  const legend = document.createElement("div");
  legend.style.cssText = "margin-top: 30px; padding: 15px; background: #f9f9f9; border-radius: 8px; text-align: center; font-size: 14px; color: #666;";
  legend.innerHTML = `
    <div style="display: flex; justify-content: center; gap: 30px; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 20px; height: 15px; background: linear-gradient(90deg, #4CAF50, #8BC34A); border-radius: 2px;"></div>
        <span>Height (cm)</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 20px; height: 15px; background: linear-gradient(90deg, #FF6B6B, #FF8E72); border-radius: 2px;"></div>
        <span>Weight (kg)</span>
      </div>
    </div>
  `;
  container.appendChild(legend);
  
  // Listen for data changes
  model.on("change:data", () => {
    render({ model, el });
  });
}

export default { render };