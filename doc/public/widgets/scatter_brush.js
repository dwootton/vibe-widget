export default function ScatterBrush({ model, React }) {
  const { useState, useEffect, useRef, useCallback, useMemo } = React;

  const points = useMemo(() => {
    const seed = 17;
    const rng = (() => { let s = seed; return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; }; })();
    return Array.from({ length: 50 }, (_, i) => ({
      x: 10 + rng() * 80,
      y: 10 + rng() * 80,
      size: 3 + rng() * 4,
      id: i,
    }));
  }, []);

  const [brush, setBrush] = useState(null);
  const [brushing, setBrushing] = useState(false);
  const [brushStart, setBrushStart] = useState(null);
  const [animProgress, setAnimProgress] = useState(0);
  const svgRef = useRef(null);

  useEffect(() => {
    const start = performance.now();
    let raf;
    function tick(now) {
      const t = Math.min((now - start) / 800, 1);
      setAnimProgress(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const m = { top: 32, right: 20, bottom: 40, left: 44 };
  const w = 480, h = 340;
  const pw = w - m.left - m.right;
  const ph = h - m.top - m.bottom;

  const sx = v => m.left + (v / 100) * pw;
  const sy = v => m.top + ph - (v / 100) * ph;

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

  const getSvgPoint = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * w,
      y: ((e.clientY - rect.top) / rect.height) * h,
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
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
    }
  },
    React.createElement('svg', {
      ref: svgRef,
      viewBox: `0 0 ${w} ${h}`,
      style: { width: '100%', maxWidth: w, height: 'auto', cursor: 'crosshair', userSelect: 'none' },
      onMouseDown, onMouseMove, onMouseUp,
      onMouseLeave: () => { if (brushing) onMouseUp(); },
    },
      React.createElement('text', {
        x: m.left, y: 18,
        style: { fontSize: 13, fontWeight: 700, fill: '#1a1a1a', fontFamily: "'Space Grotesk', sans-serif" },
      }, 'Scatter Plot — Brush Selection'),

      // Selection count badge
      selected.size > 0 && React.createElement('g', null,
        React.createElement('rect', {
          x: w - m.right - 80, y: 6, width: 74, height: 20, rx: 10,
          fill: '#f97316', fillOpacity: 0.12, stroke: '#f97316', strokeWidth: 1,
        }),
        React.createElement('text', {
          x: w - m.right - 43, y: 19, textAnchor: 'middle',
          style: { fontSize: 9, fill: '#f97316', fontWeight: 700 },
        }, `${selected.size} selected`),
      ),

      // Grid
      ...[0, 25, 50, 75, 100].flatMap(v => [
        React.createElement('line', {
          key: `gx-${v}`, x1: sx(v), x2: sx(v), y1: m.top, y2: m.top + ph,
          stroke: '#1a1a1a', strokeOpacity: 0.06, strokeDasharray: '2,3',
        }),
        React.createElement('line', {
          key: `gy-${v}`, x1: m.left, x2: m.left + pw, y1: sy(v), y2: sy(v),
          stroke: '#1a1a1a', strokeOpacity: 0.06, strokeDasharray: '2,3',
        }),
      ]),

      // Axes
      React.createElement('line', { x1: m.left, x2: m.left + pw, y1: m.top + ph, y2: m.top + ph, stroke: '#1a1a1a', strokeWidth: 2 }),
      React.createElement('line', { x1: m.left, x2: m.left, y1: m.top, y2: m.top + ph, stroke: '#1a1a1a', strokeWidth: 2 }),

      // Tick labels
      ...[0, 25, 50, 75, 100].flatMap(v => [
        React.createElement('text', { key: `xt-${v}`, x: sx(v), y: m.top + ph + 16, textAnchor: 'middle', style: { fontSize: 9, fill: '#1a1a1a', opacity: 0.4 } }, v),
        React.createElement('text', { key: `yt-${v}`, x: m.left - 6, y: sy(v) + 3, textAnchor: 'end', style: { fontSize: 9, fill: '#1a1a1a', opacity: 0.4 } }, v),
      ]),

      // Points
      ...points.map(p => {
        const sel = selected.size > 0;
        const isSel = selected.has(p.id);
        return React.createElement('circle', {
          key: p.id,
          cx: sx(p.x),
          cy: sy(p.y) + (1 - animProgress) * 30,
          r: sel ? (isSel ? p.size + 1 : p.size - 1) : p.size,
          fill: isSel ? '#f97316' : '#4a7c8a',
          fillOpacity: sel ? (isSel ? 0.85 : 0.12) : 0.65 * animProgress,
          stroke: isSel ? '#1a1a1a' : 'none',
          strokeWidth: 1.5,
          style: { transition: 'fill-opacity 0.2s, r 0.15s, fill 0.2s, cy 0.4s', pointerEvents: 'none' },
        });
      }),

      // Brush rect
      brush && React.createElement('rect', {
        x: Math.min(brush.x1, brush.x2), y: Math.min(brush.y1, brush.y2),
        width: Math.abs(brush.x2 - brush.x1), height: Math.abs(brush.y2 - brush.y1),
        fill: '#f97316', fillOpacity: 0.07,
        stroke: '#f97316', strokeWidth: 1.5, strokeDasharray: '4,2', rx: 2,
      }),
    ),
  );
}
