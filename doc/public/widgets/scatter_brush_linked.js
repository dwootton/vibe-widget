export default function ScatterBrushLinked({ model, React }) {
  const { useState, useEffect, useRef, useCallback, useMemo } = React;

  // Generate sample data
  const points = useMemo(() => {
    const seed = 42;
    const rng = (() => { let s = seed; return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; }; })();
    const cats = ['Group A', 'Group B', 'Group C'];
    const colors = ['#f97316', '#4a7c8a', '#c4a35a'];
    return Array.from({ length: 60 }, (_, i) => {
      const cat = Math.floor(rng() * 3);
      const cx = [35, 60, 75][cat];
      const cy = [65, 40, 70][cat];
      return {
        x: cx + (rng() - 0.5) * 40,
        y: cy + (rng() - 0.5) * 35,
        cat: cats[cat],
        color: colors[cat],
        id: i,
      };
    });
  }, []);

  const [brush, setBrush] = useState(null);
  const [brushing, setBrushing] = useState(false);
  const [brushStart, setBrushStart] = useState(null);
  const [animProgress, setAnimProgress] = useState(0);
  const svgRef = useRef(null);

  useEffect(() => {
    const start = performance.now();
    const duration = 700;
    let raf;
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      setAnimProgress(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const scatterM = { top: 28, right: 12, bottom: 36, left: 40 };
  const histM = { top: 28, right: 12, bottom: 36, left: 40 };
  const sw = 300, sh = 280;
  const hw = 220, hh = 280;
  const spw = sw - scatterM.left - scatterM.right;
  const sph = sh - scatterM.top - scatterM.bottom;

  const sx = v => scatterM.left + (v / 100) * spw;
  const sy = v => scatterM.top + sph - (v / 100) * sph;

  const selected = useMemo(() => {
    if (!brush) return new Set();
    const [x1, y1, x2, y2] = [
      Math.min(brush.x1, brush.x2), Math.min(brush.y1, brush.y2),
      Math.max(brush.x1, brush.x2), Math.max(brush.y1, brush.y2),
    ];
    return new Set(points.filter(p => {
      const px = sx(p.x), py = sy(p.y);
      return px >= x1 && px <= x2 && py >= y1 && py <= y2;
    }).map(p => p.id));
  }, [brush, points]);

  const activePoints = selected.size > 0 ? points.filter(p => selected.has(p.id)) : points;

  // Histogram bins for y values
  const bins = useMemo(() => {
    const nBins = 8;
    const binSize = 100 / nBins;
    const b = Array.from({ length: nBins }, (_, i) => ({
      lo: i * binSize, hi: (i + 1) * binSize, count: 0,
    }));
    activePoints.forEach(p => {
      const idx = Math.min(Math.floor(p.y / binSize), nBins - 1);
      b[idx].count++;
    });
    return b;
  }, [activePoints]);

  const maxBin = Math.max(...bins.map(b => b.count), 1);
  const hpw = hw - histM.left - histM.right;
  const hph = hh - histM.top - histM.bottom;

  const getSvgPoint = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * sw,
      y: ((e.clientY - rect.top) / rect.height) * sh,
    };
  }, []);

  const onMouseDown = useCallback((e) => {
    const pt = getSvgPoint(e);
    if (!pt) return;
    setBrushing(true);
    setBrushStart(pt);
    setBrush({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
  }, [getSvgPoint]);

  const onMouseMove = useCallback((e) => {
    if (!brushing || !brushStart) return;
    const pt = getSvgPoint(e);
    if (!pt) return;
    setBrush({ x1: brushStart.x, y1: brushStart.y, x2: pt.x, y2: pt.y });
  }, [brushing, brushStart, getSvgPoint]);

  const onMouseUp = useCallback(() => {
    setBrushing(false);
    if (brush && Math.abs(brush.x2 - brush.x1) < 4 && Math.abs(brush.y2 - brush.y1) < 4) {
      setBrush(null);
    }
  }, [brush]);

  return React.createElement('div', {
    style: {
      width: '100%', height: '100%',
      background: '#f7f0e6',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
      padding: '8px 16px',
      boxSizing: 'border-box',
    }
  },
    // Scatter plot
    React.createElement('svg', {
      ref: svgRef,
      viewBox: `0 0 ${sw} ${sh}`,
      style: { flex: '1 1 58%', maxWidth: sw, height: 'auto', cursor: 'crosshair', userSelect: 'none' },
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave: () => { if (brushing) onMouseUp(); },
    },
      React.createElement('text', {
        x: scatterM.left, y: 16,
        style: { fontSize: 12, fontWeight: 700, fill: '#1a1a1a', fontFamily: "'Space Grotesk', sans-serif" },
      }, 'Scatter — drag to select'),

      // Grid
      ...[0, 25, 50, 75, 100].map(v =>
        React.createElement('line', {
          key: `gx-${v}`,
          x1: sx(v), x2: sx(v), y1: scatterM.top, y2: scatterM.top + sph,
          stroke: '#1a1a1a', strokeOpacity: 0.06, strokeDasharray: '2,3',
        })
      ),
      ...[0, 25, 50, 75, 100].map(v =>
        React.createElement('line', {
          key: `gy-${v}`,
          x1: scatterM.left, x2: scatterM.left + spw, y1: sy(v), y2: sy(v),
          stroke: '#1a1a1a', strokeOpacity: 0.06, strokeDasharray: '2,3',
        })
      ),

      // Axes
      React.createElement('line', { x1: scatterM.left, x2: scatterM.left + spw, y1: scatterM.top + sph, y2: scatterM.top + sph, stroke: '#1a1a1a', strokeWidth: 2 }),
      React.createElement('line', { x1: scatterM.left, x2: scatterM.left, y1: scatterM.top, y2: scatterM.top + sph, stroke: '#1a1a1a', strokeWidth: 2 }),

      // Axis labels
      ...[0, 50, 100].map(v =>
        React.createElement('text', { key: `xl-${v}`, x: sx(v), y: scatterM.top + sph + 16, textAnchor: 'middle', style: { fontSize: 9, fill: '#1a1a1a', opacity: 0.4 } }, v)
      ),
      ...[0, 50, 100].map(v =>
        React.createElement('text', { key: `yl-${v}`, x: scatterM.left - 6, y: sy(v) + 3, textAnchor: 'end', style: { fontSize: 9, fill: '#1a1a1a', opacity: 0.4 } }, v)
      ),

      // Points
      ...points.map(p =>
        React.createElement('circle', {
          key: p.id,
          cx: sx(p.x),
          cy: sy(p.y) + (1 - animProgress) * 20,
          r: selected.size > 0 ? (selected.has(p.id) ? 5 : 3) : 4.5,
          fill: p.color,
          fillOpacity: selected.size > 0 ? (selected.has(p.id) ? 0.9 : 0.15) : 0.75 * animProgress,
          stroke: selected.has(p.id) ? '#1a1a1a' : 'none',
          strokeWidth: 1.5,
          style: { transition: 'fill-opacity 0.2s, r 0.2s, cy 0.3s', pointerEvents: 'none' },
        })
      ),

      // Brush rect
      brush && React.createElement('rect', {
        x: Math.min(brush.x1, brush.x2),
        y: Math.min(brush.y1, brush.y2),
        width: Math.abs(brush.x2 - brush.x1),
        height: Math.abs(brush.y2 - brush.y1),
        fill: '#f97316',
        fillOpacity: 0.08,
        stroke: '#f97316',
        strokeWidth: 1.5,
        strokeDasharray: '4,2',
        rx: 2,
      }),

      // X axis title
      React.createElement('text', {
        x: scatterM.left + spw / 2, y: sh - 4, textAnchor: 'middle',
        style: { fontSize: 9, fill: '#1a1a1a', opacity: 0.35, textTransform: 'uppercase', letterSpacing: 1.2 },
      }, 'x value'),
    ),

    // Histogram
    React.createElement('svg', {
      viewBox: `0 0 ${hw} ${hh}`,
      style: { flex: '1 1 38%', maxWidth: hw, height: 'auto' },
    },
      React.createElement('text', {
        x: histM.left, y: 16,
        style: { fontSize: 12, fontWeight: 700, fill: '#1a1a1a', fontFamily: "'Space Grotesk', sans-serif" },
      }, selected.size > 0 ? `Distribution (${selected.size} selected)` : 'Distribution'),

      // Axes
      React.createElement('line', { x1: histM.left, x2: histM.left + hpw, y1: histM.top + hph, y2: histM.top + hph, stroke: '#1a1a1a', strokeWidth: 2 }),
      React.createElement('line', { x1: histM.left, x2: histM.left, y1: histM.top, y2: histM.top + hph, stroke: '#1a1a1a', strokeWidth: 2 }),

      // Bars
      ...bins.map((b, i) => {
        const barH = (b.count / Math.max(maxBin, 1)) * hph * animProgress;
        const barW = (hpw / bins.length) - 3;
        const bx = histM.left + i * (hpw / bins.length) + 1.5;
        const by = histM.top + hph - barH;
        return React.createElement('g', { key: i },
          React.createElement('rect', {
            x: bx + 2, y: by + 2, width: barW, height: barH,
            rx: 2, fill: '#1a1a1a', opacity: 0.08,
          }),
          React.createElement('rect', {
            x: bx, y: by, width: barW, height: barH,
            rx: 2,
            fill: selected.size > 0 ? '#f97316' : '#4a7c8a',
            style: { transition: 'height 0.3s, y 0.3s, fill 0.3s' },
          }),
          b.count > 0 && React.createElement('text', {
            x: bx + barW / 2, y: by - 4, textAnchor: 'middle',
            style: { fontSize: 8, fill: '#1a1a1a', opacity: 0.5 },
          }, b.count),
        );
      }),

      // Bin labels
      ...bins.filter((_, i) => i % 2 === 0).map((b, idx) => {
        const i = idx * 2;
        return React.createElement('text', {
          key: `bl-${i}`,
          x: histM.left + i * (hpw / bins.length) + (hpw / bins.length) / 2,
          y: histM.top + hph + 14,
          textAnchor: 'middle',
          style: { fontSize: 8, fill: '#1a1a1a', opacity: 0.4 },
        }, Math.round(b.lo));
      }),

      React.createElement('text', {
        x: histM.left + hpw / 2, y: hh - 4, textAnchor: 'middle',
        style: { fontSize: 9, fill: '#1a1a1a', opacity: 0.35, textTransform: 'uppercase', letterSpacing: 1.2 },
      }, 'y value'),
    ),
  );
}
