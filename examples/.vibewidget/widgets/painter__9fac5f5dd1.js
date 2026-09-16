import * as d3 from "https://esm.sh/d3@7";

/**
 * Procedural generation for rolling hills
 */
const generateInitialHills = () => {
  const size = 64;
  const h = new Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let val = 0.30
        + 0.22 * Math.sin(x / 9) * Math.sin(y / 9)
        + 0.12 * Math.sin(x / 4 + 1.2) * Math.cos(y / 5)
        + 0.08 * Math.cos(x / 6 + 0.5) * Math.sin(y / 7 + 0.8);
      h[y * size + x] = Math.max(0, Math.min(1, val));
    }
  }
  return h;
};

/**
 * Terrain color interpolation
 */
const getTerrainColor = (h) => {
  if (h <= 0.3) {
    const t = h / 0.3;
    return d3.interpolateRgb("rgb(0,20,120)", "rgb(34,139,34)")(t);
  } else if (h <= 0.6) {
    const t = (h - 0.3) / 0.3;
    return d3.interpolateRgb("rgb(34,139,34)", "rgb(180,180,100)")(t);
  } else {
    const t = (h - 0.6) / 0.4;
    return d3.interpolateRgb("rgb(180,180,100)", "rgb(255,255,255)")(t);
  }
};

export const ControlPanel = ({ React, brushSize, setBrushSize, strength, setStrength, onReset, onErode }) => (
  <div style={{ 
    marginTop: 15, 
    padding: 15, 
    background: "#f8f9fa", 
    borderRadius: 8, 
    display: "flex", 
    flexDirection: "column", 
    gap: 12,
    border: "1px solid #ddd",
    color: "#333"
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <label style={{ width: 100, fontWeight: "bold" }}>Brush Size</label>
      <input 
        type="range" min="1" max="20" step="1" 
        value={brushSize} 
        onChange={(e) => setBrushSize(parseInt(e.target.value))} 
        style={{ flex: 1 }}
      />
      <span style={{ width: 30 }}>{brushSize}</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <label style={{ width: 100, fontWeight: "bold" }}>Strength</label>
      <input 
        type="range" min="0.01" max="0.2" step="0.01" 
        value={strength} 
        onChange={(e) => setStrength(parseFloat(e.target.value))} 
        style={{ flex: 1 }}
      />
      <span style={{ width: 40 }}>{strength.toFixed(2)}</span>
    </div>
    <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
      <button 
        onClick={onErode}
        style={{ 
          flex: 1, padding: "8px 16px", cursor: "pointer", 
          backgroundColor: "#007bff", color: "white", border: "none", borderRadius: 4, fontWeight: "bold" 
        }}
      >
        Erode
      </button>
      <button 
        onClick={onReset}
        style={{ 
          flex: 1, padding: "8px 16px", cursor: "pointer", 
          backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: 4, fontWeight: "bold" 
        }}
      >
        Reset
      </button>
    </div>
  </div>
);

export default function TerrainPainterWidget({ model, React }) {
  const canvasRef = React.useRef(null);
  const [heightmap, setHeightmap] = React.useState(() => generateInitialHills());
  const [brushSize, setBrushSize] = React.useState(5);
  const [strength, setStrength] = React.useState(0.05);
  const isDrawing = React.useRef(null); // null, 0 (left), 2 (right)

  const GRID_SIZE = 64;
  const CANVAS_SIZE = 512;
  const CELL_PX = CANVAS_SIZE / GRID_SIZE;

  // Sync to model helper
  const syncToModel = React.useCallback((data) => {
    model.set("heightmap", Array.from(data));
    model.save_changes();
  }, [model]);

  // Initial sync
  React.useEffect(() => {
    syncToModel(heightmap);
  }, []);

  // Draw loop
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const h = heightmap[y * GRID_SIZE + x];
        ctx.fillStyle = getTerrainColor(h);
        ctx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
      }
    }
  }, [heightmap]);

  const handlePaint = React.useCallback((e) => {
    if (isDrawing.current === null) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / CELL_PX;
    const my = (e.clientY - rect.top) / CELL_PX;
    
    const nextMap = [...heightmap];
    const sign = isDrawing.current === 0 ? 1 : -1;
    const r = brushSize;
    
    let changed = false;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = Math.floor(mx + dx);
        const y = Math.floor(my + dy);
        if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= r) {
            const falloff = 1 - (dist / r);
            const idx = y * GRID_SIZE + x;
            nextMap[idx] = Math.max(0, Math.min(1, nextMap[idx] + sign * strength * falloff));
            changed = true;
          }
        }
      }
    }

    if (changed) {
      setHeightmap(nextMap);
      syncToModel(nextMap);
    }
  }, [heightmap, brushSize, strength, syncToModel]);

  const onMouseDown = (e) => {
    e.preventDefault();
    isDrawing.current = e.button;
    handlePaint(e);
  };

  const onMouseMove = (e) => {
    if (isDrawing.current !== null) handlePaint(e);
  };

  const onMouseUp = () => {
    isDrawing.current = null;
  };

  const handleReset = () => {
    const fresh = generateInitialHills();
    setHeightmap(fresh);
    syncToModel(fresh);
  };

  const handleErode = () => {
    const data = [...heightmap];
    const DROPS = 1500;
    const MAX_STEPS = 40;
    const ERODE = 0.008;
    const DEPOSIT = 0.003;

    for (let i = 0; i < DROPS; i++) {
      let x = Math.floor(Math.random() * GRID_SIZE);
      let y = Math.floor(Math.random() * GRID_SIZE);

      for (let step = 0; step < MAX_STEPS; step++) {
        let lowestH = data[y * GRID_SIZE + x];
        let targetX = x;
        let targetY = y;

        // Scan 8-neighbors
        for (let ny = y - 1; ny <= y + 1; ny++) {
          for (let nx = x - 1; nx <= x + 1; nx++) {
            if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE || (nx === x && ny === y)) continue;
            const h = data[ny * GRID_SIZE + nx];
            if (h < lowestH) {
              lowestH = h;
              targetX = nx;
              targetY = ny;
            }
          }
        }

        if (targetX === x && targetY === y) {
          data[y * GRID_SIZE + x] = Math.min(1, data[y * GRID_SIZE + x] + DEPOSIT);
          break;
        } else {
          data[y * GRID_SIZE + x] = Math.max(0, data[y * GRID_SIZE + x] - ERODE);
          x = targetX;
          y = targetY;
        }
      }
    }
    
    const clipped = data.map(v => Math.max(0, Math.min(1, v)));
    setHeightmap(clipped);
    syncToModel(clipped);
  };

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      padding: "20px",
      fontFamily: "system-ui, sans-serif",
      userSelect: "none"
    }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{ 
          cursor: "crosshair", 
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          borderRadius: "4px",
          backgroundColor: "#000"
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      
      <div style={{ width: CANVAS_SIZE }}>
        <ControlPanel 
          React={React}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          strength={strength}
          setStrength={setStrength}
          onReset={handleReset}
          onErode={handleErode}
        />
        <div style={{ marginTop: 10, fontSize: "0.85em", color: "#666", textAlign: "center" }}>
          Left-click to Raise • Right-click to Lower
        </div>
      </div>
    </div>
  );
}