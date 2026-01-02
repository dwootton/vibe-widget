import React from "https://esm.sh/react@18";

export const DrawingCanvas = ({ model, html, React }) => {
  const canvasRef = React.useRef(null);
  const contextRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = React.useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = 28;
    canvas.height = 28;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.lineCap = "round";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2.2; // Adjusted for 28x28 scale to feel like 5px on 280px
    contextRef.current = ctx;

    // Fill background with black
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 28, 28);
  }, []);

  const getCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    const { x, y } = getCoords(e);
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const { x, y } = getCoords(e);
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
  };

  const stopDrawing = () => {
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const ctx = contextRef.current;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 28, 28);
  };

  const submitCanvas = () => {
    const ctx = contextRef.current;
    const imageData = ctx.getImageData(0, 0, 28, 28);
    const data = imageData.data;
    const grayscale = [];
    // Extract only the R channel (since it's grayscale on black) or average
    for (let i = 0; i < data.length; i += 4) {
      grayscale.push(data[i]);
    }
    
    const currentCount = model.get("submit_count") || 0;
    model.set("image_data", grayscale);
    model.set("submit_count", currentCount + 1);
    model.save_changes();
  };

  return html`
    <div style=${{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <canvas
        ref=${canvasRef}
        onMouseDown=${startDrawing}
        onMouseMove=${draw}
        onMouseUp=${stopDrawing}
        onMouseOut=${stopDrawing}
        style=${{
          width: '280px',
          height: '280px',
          border: '2px solid #444',
          borderRadius: '8px',
          cursor: 'crosshair',
          imageRendering: 'pixelated',
          backgroundColor: 'black'
        }}
      />
      <div style=${{ display: 'flex', gap: '12px' }}>
        <button 
          onClick=${clearCanvas}
          style=${{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #ccc',
            backgroundColor: '#fff',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Clear
        </button>
        <button 
          onClick=${submitCanvas}
          style=${{
            padding: '8px 24px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#2563eb',
            color: 'white',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Recognize
        </button>
      </div>
    </div>
  `;
};

export const PredictionDisplay = ({ model, html, React }) => {
  const [result, setResult] = React.useState(model.get("prediction_result"));

  React.useEffect(() => {
    const handleChange = () => {
      setResult(model.get("prediction_result"));
    };
    model.on("change:prediction_result", handleChange);
    return () => model.off("change:prediction_result", handleChange);
  }, [model]);

  if (!result || typeof result === 'string') {
    return html`
      <div style=${{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#666',
        fontSize: '1.1rem',
        textAlign: 'center',
        padding: '20px',
        border: '2px dashed #ddd',
        borderRadius: '12px'
      }}>
        Draw a digit and press Recognize
      </div>
    `;
  }

  const { digit, confidence, probabilities } = result;

  return html`
    <div style=${{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style=${{ textAlign: 'center' }}>
        <div style=${{ fontSize: '14px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Predicted Digit</div>
        <div style=${{ fontSize: '72px', fontWeight: 'bold', color: '#1e293b', lineHeight: '1' }}>${digit}</div>
        <div style=${{ fontSize: '18px', color: '#2563eb', fontWeight: '600' }}>
          ${(confidence * 100).toFixed(1)}% confidence
        </div>
      </div>

      <div style=${{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        ${probabilities.map((p, i) => {
          const isSelected = i === digit;
          return html`
            <div key=${i} style=${{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style=${{ width: '12px', fontWeight: 'bold', color: isSelected ? '#2563eb' : '#64748b' }}>${i}</span>
              <div style=${{ 
                flex: 1, 
                height: '20px', 
                backgroundColor: '#f1f5f9', 
                borderRadius: '4px', 
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style=${{ 
                  width: `${p * 100}%`, 
                  height: '100%', 
                  backgroundColor: isSelected ? '#2563eb' : '#94a3b8',
                  transition: 'width 0.3s ease-out'
                }} />
              </div>
              <span style=${{ 
                width: '45px', 
                fontSize: '12px', 
                textAlign: 'right',
                color: isSelected ? '#2563eb' : '#64748b',
                fontWeight: isSelected ? 'bold' : 'normal'
              }}>
                ${(p * 100).toFixed(0)}%
              </span>
            </div>
          `;
        })}
      </div>
    </div>
  `;
};

export default function MNISTWidget({ model, html, React }) {
  React.useEffect(() => {
    // Initialize outputs
    if (model.get("submit_count") === undefined) {
      model.set("submit_count", 0);
    }
    if (model.get("image_data") === undefined) {
      model.set("image_data", new Array(784).fill(0));
    }
    model.save_changes();
  }, []);

  return html`
    <div style=${{ 
      padding: '32px', 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#fff',
      borderRadius: '16px',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h2 style=${{ marginTop: 0, marginBottom: '24px', textAlign: 'center', color: '#1e293b' }}>
        MNIST Digit Recognition
      </h2>
      
      <div style=${{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '40px',
        alignItems: 'start'
      }}>
        <section>
          <h3 style=${{ fontSize: '16px', color: '#64748b', marginBottom: '16px' }}>Drawing Canvas</h3>
          <${DrawingCanvas} model=${model} html=${html} React=${React} />
        </section>

        <section>
          <h3 style=${{ fontSize: '16px', color: '#64748b', marginBottom: '16px' }}>Model Prediction</h3>
          <${PredictionDisplay} model=${model} html=${html} React=${React} />
        </section>
      </div>
    </div>
  `;
}