import * as d3 from "https://esm.sh/d3@7";

export const ProgressBar = ({ label, value, isMax }) => {
  const barWidth = `${(value * 100).toFixed(1)}%`;
  return (
    <div style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
      <span style={{ width: "15px", fontWeight: "bold", fontSize: "12px" }}>{label}</span>
      <div style={{ flexGrow: 1, height: "12px", background: "#eee", borderRadius: "6px", overflow: "hidden" }}>
        <div
          style={{
            width: barWidth,
            height: "100%",
            background: isMax ? "#4f46e5" : "#94a3b8",
            transition: "width 0.3s ease",
          }}
        ></div>
      </div>
      <span
        style={{
          width: "40px",
          fontSize: "11px",
          textAlign: "right",
          color: isMax ? "#4f46e5" : "#64748b",
        }}
      >
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
};

export default function DigitRecognizerWidget({ model, React }) {
  const canvasRef = React.useRef(null);
  const [prediction, setPrediction] = React.useState(null);
  const [isDrawing, setIsDrawing] = React.useState(false);

  // Initialize trait state
  React.useEffect(() => {
    if (!model.get("image_data")) {
      model.set("image_data", new Array(784).fill(0));
      model.set("submit_count", 0);
      model.save_changes();
    }

    const handlePredictionChange = () => {
      setPrediction(model.get("prediction_result"));
    };

    model.on("change:prediction_result", handlePredictionChange);
    return () => model.off("change:prediction_result", handlePredictionChange);
  }, [model]);

  const getCanvasContext = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d", { willReadFrequently: true });
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const ctx = getCanvasContext();
    if (ctx) ctx.beginPath();
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = getCanvasContext();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineWidth = 20;
    ctx.lineCap = "round";
    ctx.strokeStyle = "white";

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleClear = () => {
    const ctx = getCanvasContext();
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 280, 280);
    setPrediction(null);
  };

  const handleSubmit = () => {
    const canvas = canvasRef.current;
    const ctx = getCanvasContext();
    
    // Create a temporary 28x28 canvas to downsample
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 28;
    tempCanvas.height = 28;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0, 280, 280, 0, 0, 28, 28);
    
    const imageData = tempCtx.getImageData(0, 0, 28, 28).data;
    const grayscale = [];
    for (let i = 0; i < imageData.length; i += 4) {
      // Use the red channel since it's grayscale white on black
      grayscale.push(imageData[i]);
    }

    model.set("image_data", grayscale);
    model.set("submit_count", model.get("submit_count") + 1);
    model.save_changes();
  };

  React.useEffect(() => {
    const ctx = getCanvasContext();
    if (ctx) {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, 280, 280);
    }
  }, []);

  const probs = prediction?.probabilities || new Array(10).fill(0);
  const maxIdx = probs.indexOf(Math.max(...probs));

  return (
    <div
      style={{
        display: "flex",
        gap: "40px",
        padding: "24px",
        background: "#f8fafc",
        borderRadius: "12px",
        fontFamily: "system-ui, sans-serif",
        height: "420px",
        color: "#1e293b",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Draw Digit (0-9)</h3>
        <canvas
          ref={canvasRef}
          width="280"
          height="280"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          style={{
            border: "2px solid #cbd5e1",
            borderRadius: "8px",
            cursor: "crosshair",
            background: "black",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
        />
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={handleClear}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "white",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Clear
          </button>
          <button
            onClick={handleSubmit}
            style={{
              flex: 2,
              padding: "8px",
              borderRadius: "6px",
              border: "none",
              background: "#4f46e5",
              color: "white",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Recognize
          </button>
        </div>
      </div>

      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Result
          </div>
          <div style={{ fontSize: "48px", fontWeight: "800", color: "#1e293b", margin: "4px 0" }}>
            {prediction ? prediction.label : "?"}
          </div>
          <div style={{ fontSize: "16px", color: "#4f46e5", fontWeight: 600 }}>
            {prediction ? `${(prediction.confidence * 100).toFixed(1)}%` : "Waiting..."}
          </div>
        </div>

        <div style={{ flexGrow: 1 }}>
          <h4 style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#64748b" }}>PROBABILITIES</h4>
          {probs.map((p, i) => (
            <ProgressBar key={i} label={i} value={p} isMax={prediction && i === maxIdx} />
          ))}
        </div>
      </div>
    </div>
  );
}
