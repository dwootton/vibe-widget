import * as d3 from "https://esm.sh/d3@7";

const GRID_SIZE = 64;
const CANVAS_SIZE = 512;
const CELL_PIXELS = CANVAS_SIZE / GRID_SIZE;

/**
 * Utility to map height [0, 1] to the specified terrain color gradient.
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

/**
 * Generates the initial procedural heightmap.
 */
const generateInitialHills = () => {
  const data = new Array(GRID_SIZE * GRID_SIZE);
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      let h = 0.30
        + 0.22 * Math.sin(x / 9) * Math.sin(y / 9)
        + 0.12 * Math.sin(x / 4 + 1.2) * Math.cos(y / 5)
        + 0.08 * Math.cos(x / 6 + 0.5) * Math.sin(y / 7 + 0.8);
      data[y * GRID_SIZE + x] = Math.max(0, Math.min(1, h));
    }
  }
  return data;
};

export const ControlSlider = ({ label, value, min, max, step = 1, onChange, React }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
    <label style={{ width: '100px', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{label}</label>
    <input 
      type="range" 
      min={min} 
      max={max} 
      step={step} 
      value={value} 
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ flex: 1, cursor: 'pointer' }}
    />
    <span style={{ width: '40px', fontSize: '13px', textAlign: 'right', color: '#666' }}>{value}</span>
  </div>
);

export const ActionButton = ({ label, onClick, color = '#444' }) => (
  <button 
    onClick={onClick}
    style={{
      padding: '8px 16px',
      backgroundColor: color,
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontWeight: 'bold',
      fontSize: '14px',
      marginRight: '8px'
    }}
  >
    {label}
  </button>
);

export default function TerrainPainter({ model, React }) {
  const canvasRef = React.useRef(null);
  const [heightmap, setHeightmap] = React.useState(() => generateInitialHills());
  const [brushSize, setBrushSize] = React.useState(5);
  const [strength, setStrength] = React.useState(0.05);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [drawMode, setDrawMode] = React.useState(1); // 1 for raise, -1 for lower

  // Sync to model on initial mount and heightmap changes
  React.useEffect(() => {
    model.set('heightmap', [...heightmap]);
    model.save_changes();
    drawCanvas();
  }, [heightmap]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const h = heightmap[y * GRID_SIZE + x];
        ctx.fillStyle = getTerrainColor(h);
        ctx.fillRect(x * CELL_PIXELS, y * CELL_PIXELS, CELL_PIXELS, CELL_PIXELS);
      }
    }
  };

  const applyBrush = (mouseX, mouseY, mode) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = Math.floor(((mouseX - rect.left) / CANVAS_SIZE) * GRID_SIZE);
    const centerY = Math.floor(((mouseY - rect.top) / CANVAS_SIZE) * GRID_SIZE);

    setHeightmap(prev => {
      const next = [...prev];
      const radiusSq = brushSize * brushSize;

      for (let y = centerY - brushSize; y <= centerY + brushSize; y++) {
        for (let x = centerX - brushSize; x <= centerX + brushSize; x++) {
          if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distSq = dx * dx + dy * dy;
            if (distSq <= radiusSq) {
              const falloff = 1 - Math.sqrt(distSq) / brushSize;
              const idx = y * GRID_SIZE + x;
              next[idx] = Math.max(0, Math.min(1, next[idx] + mode * strength * falloff));
            }
          }
        }
      }
      return next;
    });
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    const mode = e.button === 2 ? -1 : 1;
    setDrawMode(mode);
    setIsDrawing(true);
    applyBrush(e.clientX, e.clientY, mode);
  };

  const handleMouseMove = (e) => {
    if (isDrawing) {
      applyBrush(e.clientX, e.clientY, drawMode);
    }
  };

  const handleMouseUp = () => setIsDrawing(false);

  const handleReset = () => {
    setHeightmap(generateInitialHills());
  };

  const handleErode = () => {
    setHeightmap(prev => {
      const next = [...prev];
      const drops = 1500;
      const maxSteps = 40;
      const erodeAmount = 0.008;
      const depositAmount = 0.003;

      for (let i = 0; i < drops; i++) {
        let x = Math.floor(Math.random() * GRID_SIZE);
        let y = Math.floor(Math.random() * GRID_SIZE);

        for (let step = 0; step < maxSteps; step++) {
          let lowestX = x;
          let lowestY = y;
          let lowestH = next[y * GRID_SIZE + x];

          // Check 8 neighbors
          for (let ny = y - 1; ny <= y + 1; ny++) {
            for (let nx = x - 1; nx <= x + 1; nx++) {
              if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                const nh = next[ny * GRID_SIZE + nx];
                if (nh < lowestH) {
                  lowestH = nh;
                  lowestX = nx;
                  lowestY = ny;
                }
              }
            }
          }

          if (lowestX === x && lowestY === y) {
            next[y * GRID_SIZE + x] += depositAmount;
            break;
          } else {
            next[y * GRID_SIZE + x] -= erodeAmount;
            x = lowestX;
            y = lowestY;
          }
        }
      }
      // Final clip
      for (let i = 0; i < next.length; i++) {
        next[i] = Math.max(0, Math.min(1, next[i]));
      }
      return next;
    });
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      padding: '20px', 
      background: '#f5f5f5', 
      borderRadius: '8px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', marginBottom: '20px' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
          style={{ cursor: 'crosshair', display: 'block', borderRadius: '4px' }}
        />
      </div>

      <div style={{ width: '512px', background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <ControlSlider 
          label="Brush Size" 
          value={brushSize} 
          min={1} 
          max={20} 
          onChange={setBrushSize} 
          React={React} 
        />
        <ControlSlider 
          label="Strength" 
          value={strength} 
          min={0.01} 
          max={0.2} 
          step={0.01} 
          onChange={setStrength} 
          React={React} 
        />
        
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
          <ActionButton label="Erode Landscape" onClick={handleErode} color="#2c3e50" />
          <ActionButton label="Reset Map" onClick={handleReset} color="#e74c3c" />
        </div>
        
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#888', textAlign: 'center' }}>
          Left-click to Raise • Right-click to Lower
        </div>
      </div>
    </div>
  );
}