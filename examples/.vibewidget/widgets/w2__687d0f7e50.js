import * as d3 from "https://esm.sh/d3@7";

export default function Widget({ model, React }) {
  const rawData = model.get("data") || [];
  const [selectedMonth, setSelectedMonth] = React.useState(9);
  const [sharedThreshold, setSharedThreshold] = React.useState(0.15);
  const [perPanelMode, setPerPanelMode] = React.useState(false);
  const [panelThresholds, setPanelThresholds] = React.useState({});
  const containerRef = React.useRef(null);

  // Get unique regions
  const regions = React.useMemo(() => {
    const r = [...new Set(rawData.map(d => d.region))].sort();
    return r;
  }, [rawData]);

  // Initialize panel thresholds
  React.useEffect(() => {
    if (regions.length > 0 && Object.keys(panelThresholds).length === 0) {
      const initial = {};
      regions.forEach(r => { initial[r] = 0.15; });
      setPanelThresholds(initial);
    }
  }, [regions]);

  // Filter and aggregate data for selected month
  const chartData = React.useMemo(() => {
    const filtered = rawData.filter(d => d.month === selectedMonth);
    const grouped = d3.rollup(
      filtered,
      v => d3.mean(v, d => d.frac),
      d => d.region,
      d => d.year
    );
    
    const result = {};
    for (const [region, yearMap] of grouped) {
      result[region] = Array.from(yearMap, ([year, frac]) => ({ year, frac }))
        .filter(d => d.year >= 1979 && d.year <= 2026)
        .sort((a, b) => a.year - b.year);
    }
    return result;
  }, [rawData, selectedMonth]);

  // Calculate under counts and update outputs
  const underCounts = React.useMemo(() => {
    const counts = {};
    const underYears = {};
    const thresholds = {};
    
    regions.forEach(region => {
      const data = chartData[region] || [];
      const threshold = perPanelMode ? (panelThresholds[region] ?? sharedThreshold) : sharedThreshold;
      thresholds[region] = threshold;
      const under = data.filter(d => d.frac < threshold);
      counts[region] = { under: under.length, total: data.length };
      underYears[region] = under.map(d => d.year);
    });
    
    return { counts, underYears, thresholds };
  }, [chartData, regions, sharedThreshold, perPanelMode, panelThresholds]);

  // Sync outputs to model
  React.useEffect(() => {
    model.set("under", underCounts.underYears);
    model.set("thresholds", underCounts.thresholds);
    model.save_changes();
  }, [underCounts]);

  // Generate SQL-like output
  const sqlOutput = React.useMemo(() => {
    const currentThreshold = perPanelMode ? panelThresholds : regions.reduce((acc, r) => ({ ...acc, [r]: sharedThreshold }), {});
    const rows = [];
    regions.forEach(region => {
      const data = chartData[region] || [];
      const threshold = currentThreshold[region] ?? sharedThreshold;
      data.forEach(d => {
        if (d.frac < threshold) {
          rows.push({ region, year: d.year, frac: d.frac });
        }
      });
    });
    rows.sort((a, b) => a.region.localeCompare(b.region) || a.year - b.year);
    return rows;
  }, [chartData, regions, sharedThreshold, perPanelMode, panelThresholds]);

  const months = [
    { value: 1, label: "Jan" }, { value: 2, label: "Feb" }, { value: 3, label: "Mar" },
    { value: 4, label: "Apr" }, { value: 5, label: "May" }, { value: 6, label: "Jun" },
    { value: 7, label: "Jul" }, { value: 8, label: "Aug" }, { value: 9, label: "Sep" },
    { value: 10, label: "Oct" }, { value: 11, label: "Nov" }, { value: 12, label: "Dec" }
  ];

  // Panel dimensions
  const panelWidth = 160;
  const panelHeight = 100;
  const margin = { top: 20, right: 5, bottom: 20, left: 25 };
  const innerWidth = panelWidth - margin.left - margin.right;
  const innerHeight = panelHeight - margin.top - margin.bottom;

  // Scales
  const years = d3.range(1979, 2027);
  const xScale = d3.scaleBand().domain(years).range([0, innerWidth]).padding(0.1);
  const yScale = d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]);

  const handleThresholdDrag = (region) => (e) => {
    const svg = e.target.closest('svg');
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const startY = e.clientY;
    const startThreshold = perPanelMode ? (panelThresholds[region] ?? sharedThreshold) : sharedThreshold;
    
    const onMove = (moveE) => {
      const deltaY = moveE.clientY - startY;
      const deltaThreshold = -deltaY / innerHeight;
      const newThreshold = Math.max(0, Math.min(1, startThreshold + deltaThreshold));
      
      if (perPanelMode) {
        setPanelThresholds(prev => ({ ...prev, [region]: newThreshold }));
      } else {
        setSharedThreshold(newThreshold);
      }
    };
    
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleToggle = () => {
    if (!perPanelMode) {
      // Switching to per-panel: initialize all to current shared value
      const newThresholds = {};
      regions.forEach(r => { newThresholds[r] = sharedThreshold; });
      setPanelThresholds(newThresholds);
    }
    setPerPanelMode(!perPanelMode);
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16, background: "#fafafa", minHeight: 600 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: "#222" }}>Arctic Sea Ice Extent by Region</h2>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button
            onClick={handleToggle}
            style={{
              padding: "6px 12px",
              background: perPanelMode ? "#2563eb" : "#e5e7eb",
              color: perPanelMode ? "#fff" : "#222",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: 500
            }}
          >
            {perPanelMode ? "Per Panel" : "Shared"} Threshold
          </button>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc", fontSize: 14, color: "#222", background: "#fff" }}
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Small multiples grid */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(5, 1fr)", 
        gap: 8,
        marginBottom: 16
      }}>
        {regions.map(region => {
          const data = chartData[region] || [];
          const threshold = perPanelMode ? (panelThresholds[region] ?? sharedThreshold) : sharedThreshold;
          const { under, total } = underCounts.counts[region] || { under: 0, total: 0 };
          
          return (
            <div key={region} style={{ background: "#fff", borderRadius: 4, padding: 4, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <svg width={panelWidth} height={panelHeight}>
                <g transform={`translate(${margin.left},${margin.top})`}>
                  {/* Bars */}
                  {data.map(d => (
                    <rect
                      key={d.year}
                      x={xScale(d.year)}
                      y={yScale(d.frac)}
                      width={xScale.bandwidth()}
                      height={innerHeight - yScale(d.frac)}
                      fill={d.frac < threshold ? "#dc2626" : "#3b82f6"}
                    />
                  ))}
                  
                  {/* Threshold line - invisible grab area */}
                  <rect
                    x={0}
                    y={yScale(threshold) - 7}
                    width={innerWidth}
                    height={14}
                    fill="transparent"
                    style={{ cursor: "ns-resize" }}
                    onMouseDown={handleThresholdDrag(region)}
                  />
                  
                  {/* Visible threshold line */}
                  <line
                    x1={0}
                    y1={yScale(threshold)}
                    x2={innerWidth}
                    y2={yScale(threshold)}
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4,2"
                    style={{ pointerEvents: "none" }}
                  />
                  
                  {/* X axis */}
                  <g transform={`translate(0,${innerHeight})`}>
                    <line x1={0} y1={0} x2={innerWidth} y2={0} stroke="#999" />
                    <text x={0} y={12} fontSize={8} fill="#666">1979</text>
                    <text x={innerWidth} y={12} fontSize={8} fill="#666" textAnchor="end">2026</text>
                  </g>
                  
                  {/* Y axis */}
                  <g>
                    <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="#999" />
                    <text x={-3} y={4} fontSize={8} fill="#666" textAnchor="end">1</text>
                    <text x={-3} y={innerHeight} fontSize={8} fill="#666" textAnchor="end">0</text>
                  </g>
                  
                  {/* Title */}
                  <text x={innerWidth / 2} y={-6} fontSize={9} fill="#222" textAnchor="middle" fontWeight="500">
                    {region} · {under} of {total} under
                  </text>
                </g>
              </svg>
            </div>
          );
        })}
      </div>

      {/* SQL-like output */}
      <div style={{ 
        background: "#1e293b", 
        color: "#e2e8f0", 
        padding: 12, 
        borderRadius: 4, 
        fontFamily: "monospace",
        fontSize: 11,
        maxHeight: 200,
        overflow: "auto"
      }}>
        <div style={{ marginBottom: 8, color: "#94a3b8" }}>
          SELECT region, year, AVG(frac) FROM ice WHERE month = {selectedMonth} GROUP BY region, year HAVING AVG(frac) &lt; {(perPanelMode ? "threshold" : sharedThreshold.toFixed(2))}   -- {sqlOutput.length} rows
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #475569" }}>
              <th style={{ textAlign: "left", padding: "4px 8px", color: "#94a3b8" }}>region</th>
              <th style={{ textAlign: "left", padding: "4px 8px", color: "#94a3b8" }}>year</th>
              <th style={{ textAlign: "left", padding: "4px 8px", color: "#94a3b8" }}>AVG(frac)</th>
            </tr>
          </thead>
          <tbody>
            {sqlOutput.map((row, i) => (
              <tr key={`${row.region}-${row.year}`} style={{ background: i % 2 === 0 ? "transparent" : "#334155" }}>
                <td style={{ padding: "2px 8px" }}>{row.region}</td>
                <td style={{ padding: "2px 8px" }}>{row.year}</td>
                <td style={{ padding: "2px 8px" }}>{row.frac?.toFixed(3) ?? "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}