export default function ScatterActions({ model, React }) {
  const { useState, useEffect, useMemo, useCallback } = React;

  const basePoints = useMemo(() => {
    const seed = 77;
    const rng = (() => { let s = seed; return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; }; })();
    return Array.from({ length: 40 }, (_, i) => ({
      x: 10 + rng() * 80,
      y: 10 + rng() * 80,
      id: i,
    }));
  }, []);

  const [zoom, setZoom] = useState({ x: 0, y: 0, scale: 1 });
  const [hovered, setHovered] = useState(null);
  const [animProgress, setAnimProgress] = useState(0);
  const [resetFlash, setResetFlash] = useState(false);

  useEffect(() => {
    const start = performance.now();
    let raf;
    function tick(now) {
      const t = Math.min((now - start) / 700, 1);
      setAnimProgress(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const m = { top: 36, right: 20, bottom: 44, left: 48 };
  const w = 480, h = 340;
  const pw = w - m.left - m.right;
  const ph = h - m.top - m.bottom;

  const zoomIn = useCallback((cx, cy) => {
    setZoom(z => ({
      x: cx - (cx - z.x) / 1.4,
      y: cy - (cy - z.y) / 1.4,
      scale: Math.min(z.scale * 1.4, 5),
    }));
  }, []);

  const resetView = useCallback(() => {
    setZoom({ x: 0, y: 0, scale: 1 });
    setResetFlash(true);
    setTimeout(() => setResetFlash(false), 400);
  }, []);

  const sx = v => m.left + ((v / 100) * pw * zoom.scale) + zoom.x;
  const sy = v => m.top + ph - ((v / 100) * ph * zoom.scale) - zoom.y;

  return React.createElement('div', {
    style: {
      width: '100%', height: '100%',
      background: '#f7f0e6',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
      position: 'relative',
    }
  },
    React.createElement('svg', {
      viewBox: `0 0 ${w} ${h}`,
      style: { width: '100%', maxWidth: w, height: 'auto' },
    },
      // Title
      React.createElement('text', {
        x: m.left, y: 22,
        style: { fontSize: 13, fontWeight: 700, fill: '#1a1a1a', fontFamily: "'Space Grotesk', sans-serif" },
      }, 'Interactive Scatter — Click to Zoom'),

      // Clip path for plot area
      React.createElement('defs', null,
        React.createElement('clipPath', { id: 'plot-clip' },
          React.createElement('rect', { x: m.left, y: m.top, width: pw, height: ph }),
        ),
      ),

      // Background flash on reset
      resetFlash && React.createElement('rect', {
        x: m.left, y: m.top, width: pw, height: ph,
        fill: '#f97316', fillOpacity: 0.06,
        style: { transition: 'fill-opacity 0.4s' },
      }),

      // Grid (clipped)
      React.createElement('g', { clipPath: 'url(#plot-clip)' },
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
      ),

      // Axes
      React.createElement('line', { x1: m.left, x2: m.left + pw, y1: m.top + ph, y2: m.top + ph, stroke: '#1a1a1a', strokeWidth: 2 }),
      React.createElement('line', { x1: m.left, x2: m.left, y1: m.top, y2: m.top + ph, stroke: '#1a1a1a', strokeWidth: 2 }),

      // Tick labels
      ...[0, 25, 50, 75, 100].flatMap(v => [
        React.createElement('text', { key: `xt-${v}`, x: sx(v), y: m.top + ph + 16, textAnchor: 'middle', style: { fontSize: 9, fill: '#1a1a1a', opacity: 0.4 } }, v),
        React.createElement('text', { key: `yt-${v}`, x: m.left - 6, y: sy(v) + 3, textAnchor: 'end', style: { fontSize: 9, fill: '#1a1a1a', opacity: 0.4 } }, v),
      ]),

      // Points (clipped)
      React.createElement('g', { clipPath: 'url(#plot-clip)' },
        ...basePoints.map((p, i) =>
          React.createElement('circle', {
            key: p.id,
            cx: sx(p.x),
            cy: sy(p.y) + (1 - animProgress) * 25,
            r: hovered === i ? 7 : 5,
            fill: hovered === i ? '#f97316' : '#4a7c8a',
            fillOpacity: hovered === i ? 0.95 : 0.7 * animProgress,
            stroke: hovered === i ? '#1a1a1a' : '#4a7c8a',
            strokeWidth: hovered === i ? 2 : 0.5,
            strokeOpacity: 0.3,
            style: { cursor: 'pointer', transition: 'cx 0.4s, cy 0.4s, r 0.12s, fill 0.15s' },
            onMouseEnter: () => setHovered(i),
            onMouseLeave: () => setHovered(null),
            onClick: () => zoomIn(sx(p.x), sy(p.y)),
          })
        ),
      ),

      // Zoom level indicator
      zoom.scale > 1 && React.createElement('g', null,
        React.createElement('rect', {
          x: w - m.right - 54, y: m.top + 2, width: 48, height: 18, rx: 9,
          fill: '#f97316', fillOpacity: 0.12, stroke: '#f97316', strokeWidth: 1,
        }),
        React.createElement('text', {
          x: w - m.right - 30, y: m.top + 14, textAnchor: 'middle',
          style: { fontSize: 9, fill: '#f97316', fontWeight: 700 },
        }, `${zoom.scale.toFixed(1)}x`),
      ),
    ),

    // Action button — Reset View
    React.createElement('button', {
      onClick: resetView,
      style: {
        position: 'absolute',
        bottom: 16, right: 16,
        background: zoom.scale > 1 ? '#f97316' : '#f7f0e6',
        color: zoom.scale > 1 ? '#fff' : '#1a1a1a',
        border: '2px solid #1a1a1a',
        borderRadius: 6,
        padding: '6px 14px',
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
        cursor: 'pointer',
        boxShadow: '2px 2px 0 0 #1a1a1a',
        transition: 'background 0.2s, color 0.2s, transform 0.1s',
      },
      onMouseDown: (e) => { e.currentTarget.style.transform = 'translate(1px, 1px)'; e.currentTarget.style.boxShadow = '1px 1px 0 0 #1a1a1a'; },
      onMouseUp: (e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '2px 2px 0 0 #1a1a1a'; },
    }, 'Reset View'),

    // Tooltip
    hovered !== null && React.createElement('div', {
      style: {
        position: 'absolute', top: 12, right: 16,
        background: '#f7f0e6',
        border: '2px solid #1a1a1a',
        borderRadius: 6,
        padding: '6px 10px',
        boxShadow: '3px 3px 0 0 #1a1a1a',
        fontSize: 11,
      }
    },
      React.createElement('div', { style: { opacity: 0.5 } }, `Point ${basePoints[hovered].id}`),
      React.createElement('div', null, `x: ${basePoints[hovered].x.toFixed(1)}  y: ${basePoints[hovered].y.toFixed(1)}`),
      React.createElement('div', { style: { color: '#f97316', fontSize: 9, marginTop: 2 } }, 'Click to zoom'),
    ),
  );
}
