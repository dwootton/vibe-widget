export default function ScatterThemedFT({ model, React }) {
  const { useState, useEffect, useMemo } = React;

  // Financial Times inspired: salmon pink, muted palette, clean axes
  const ftPalette = ['#eb5a5a', '#1a6c8b', '#e8a83e', '#6b7b8d'];
  const categories = ['Equities', 'Bonds', 'Commodities', 'FX'];

  const points = useMemo(() => {
    const seed = 31;
    const rng = (() => { let s = seed; return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; }; })();
    return Array.from({ length: 48 }, (_, i) => {
      const cat = Math.floor(rng() * 4);
      const cx = [25, 55, 70, 40][cat];
      const cy = [60, 35, 65, 45][cat];
      return {
        x: cx + (rng() - 0.5) * 35,
        y: cy + (rng() - 0.5) * 30,
        cat,
        id: i,
      };
    });
  }, []);

  const [hovered, setHovered] = useState(null);
  const [animProgress, setAnimProgress] = useState(0);

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

  const m = { top: 36, right: 120, bottom: 44, left: 48 };
  const w = 520, h = 340;
  const pw = w - m.left - m.right;
  const ph = h - m.top - m.bottom;

  const sx = v => m.left + (v / 100) * pw;
  const sy = v => m.top + ph - (v / 100) * ph;

  const hovPt = hovered !== null ? points[hovered] : null;

  return React.createElement('div', {
    style: {
      width: '100%', height: '100%',
      background: '#fff1e5',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Georgia', 'Times New Roman', serif",
      position: 'relative',
    }
  },
    React.createElement('svg', {
      viewBox: `0 0 ${w} ${h}`,
      style: { width: '100%', maxWidth: w, height: 'auto' },
    },
      // FT-style top rule
      React.createElement('line', { x1: 0, x2: w, y1: 0, y2: 0, stroke: '#1a1a1a', strokeWidth: 4 }),

      // Title
      React.createElement('text', {
        x: m.left, y: 24,
        style: { fontSize: 15, fontWeight: 700, fill: '#1a1a1a', fontFamily: "'Georgia', serif" },
      }, 'Asset Performance Overview'),

      // Grid lines (FT uses light horizontal lines, no vertical)
      ...[0, 25, 50, 75, 100].map(v =>
        React.createElement('line', {
          key: `g-${v}`,
          x1: m.left, x2: m.left + pw,
          y1: sy(v), y2: sy(v),
          stroke: '#1a1a1a', strokeOpacity: v === 0 ? 0.2 : 0.07,
          strokeWidth: v === 0 ? 1.5 : 1,
        })
      ),

      // Y axis labels
      ...[0, 25, 50, 75, 100].map(v =>
        React.createElement('text', {
          key: `yl-${v}`, x: m.left - 8, y: sy(v) + 3, textAnchor: 'end',
          style: { fontSize: 10, fill: '#66605c', fontFamily: "'JetBrains Mono', monospace" },
        }, v)
      ),

      // X axis labels
      ...[0, 25, 50, 75, 100].map(v =>
        React.createElement('text', {
          key: `xl-${v}`, x: sx(v), y: m.top + ph + 18, textAnchor: 'middle',
          style: { fontSize: 10, fill: '#66605c', fontFamily: "'JetBrains Mono', monospace" },
        }, v)
      ),

      // Points
      ...points.map((p, i) =>
        React.createElement('circle', {
          key: p.id,
          cx: sx(p.x),
          cy: sy(p.y) + (1 - animProgress) * 25,
          r: hovered === i ? 6.5 : 4.5,
          fill: ftPalette[p.cat],
          fillOpacity: hovered === i ? 1 : 0.7 * animProgress,
          stroke: hovered === i ? '#1a1a1a' : 'none',
          strokeWidth: 1.5,
          style: { cursor: 'pointer', transition: 'r 0.12s, fill-opacity 0.15s, cy 0.4s' },
          onMouseEnter: () => setHovered(i),
          onMouseLeave: () => setHovered(null),
        })
      ),

      // Legend (FT-style, right side)
      ...categories.map((cat, i) =>
        React.createElement('g', { key: cat },
          React.createElement('circle', {
            cx: m.left + pw + 20,
            cy: m.top + 10 + i * 22,
            r: 5, fill: ftPalette[i],
          }),
          React.createElement('text', {
            x: m.left + pw + 30,
            y: m.top + 14 + i * 22,
            style: { fontSize: 11, fill: '#1a1a1a', fontFamily: "'Georgia', serif" },
          }, cat),
        )
      ),

      // Axis titles
      React.createElement('text', {
        x: m.left + pw / 2, y: h - 4, textAnchor: 'middle',
        style: { fontSize: 10, fill: '#66605c', fontStyle: 'italic' },
      }, 'Risk Score'),
      React.createElement('text', {
        x: 14, y: m.top + ph / 2, textAnchor: 'middle',
        style: { fontSize: 10, fill: '#66605c', fontStyle: 'italic' },
        transform: `rotate(-90, 14, ${m.top + ph / 2})`,
      }, 'Return (%)'),
    ),

    // Tooltip
    hovPt && React.createElement('div', {
      style: {
        position: 'absolute', top: 48, right: 20,
        background: '#fff1e5',
        border: '1px solid #1a1a1a',
        borderTop: '3px solid ' + ftPalette[hovPt.cat],
        padding: '6px 10px',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        boxShadow: '2px 2px 0 0 rgba(26,26,26,0.1)',
      }
    },
      React.createElement('div', { style: { fontWeight: 700, fontFamily: "'Georgia', serif", marginBottom: 2 } }, categories[hovPt.cat]),
      React.createElement('div', { style: { color: '#66605c' } }, `Risk: ${hovPt.x.toFixed(1)}  Return: ${hovPt.y.toFixed(1)}%`),
    ),
  );
}
