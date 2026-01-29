export default function ScatterTooltipsLegend({ model, React }) {
  const { useState, useEffect, useMemo } = React;

  const categories = ['Revenue', 'Growth', 'Margin'];
  const palette = ['#f97316', '#4a7c8a', '#c4a35a'];

  const points = useMemo(() => {
    const seed = 53;
    const rng = (() => { let s = seed; return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; }; })();
    return Array.from({ length: 45 }, (_, i) => {
      const cat = Math.floor(rng() * 3);
      const cx = [30, 55, 75][cat];
      const cy = [55, 70, 40][cat];
      return {
        x: cx + (rng() - 0.5) * 40,
        y: cy + (rng() - 0.5) * 35,
        value: Math.round(20 + rng() * 80),
        cat,
        id: i,
      };
    });
  }, []);

  const [hovered, setHovered] = useState(null);
  const [hovPos, setHovPos] = useState({ x: 0, y: 0 });
  const [animProgress, setAnimProgress] = useState(0);
  const [activeCats, setActiveCats] = useState(new Set([0, 1, 2]));

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

  const m = { top: 32, right: 20, bottom: 44, left: 48 };
  const w = 500, h = 340;
  const pw = w - m.left - m.right;
  const ph = h - m.top - m.bottom;

  const sx = v => m.left + (v / 100) * pw;
  const sy = v => m.top + ph - (v / 100) * ph;

  const toggleCat = (cat) => {
    setActiveCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) { if (next.size > 1) next.delete(cat); }
      else next.add(cat);
      return next;
    });
  };

  const hovPt = hovered !== null ? points[hovered] : null;

  return React.createElement('div', {
    style: {
      width: '100%', height: '100%',
      background: '#f7f0e6',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
      position: 'relative',
      padding: '8px 0',
    }
  },
    React.createElement('svg', {
      viewBox: `0 0 ${w} ${h}`,
      style: { width: '100%', maxWidth: w, height: 'auto' },
    },
      // Title
      React.createElement('text', {
        x: m.left, y: 18,
        style: { fontSize: 13, fontWeight: 700, fill: '#1a1a1a', fontFamily: "'Space Grotesk', sans-serif" },
      }, 'Performance Metrics'),

      // Subtle grid
      ...[0, 25, 50, 75, 100].flatMap(v => [
        React.createElement('line', {
          key: `gx-${v}`, x1: sx(v), x2: sx(v), y1: m.top, y2: m.top + ph,
          stroke: '#1a1a1a', strokeOpacity: 0.05, strokeDasharray: '2,4',
        }),
        React.createElement('line', {
          key: `gy-${v}`, x1: m.left, x2: m.left + pw, y1: sy(v), y2: sy(v),
          stroke: '#1a1a1a', strokeOpacity: 0.05, strokeDasharray: '2,4',
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
      ...points.map((p, i) => {
        const active = activeCats.has(p.cat);
        return React.createElement('circle', {
          key: p.id,
          cx: sx(p.x),
          cy: sy(p.y) + (1 - animProgress) * 20,
          r: hovered === i ? 7 : 4.5,
          fill: palette[p.cat],
          fillOpacity: active ? (hovered === i ? 0.95 : 0.65 * animProgress) : 0.08,
          stroke: hovered === i ? '#1a1a1a' : 'none',
          strokeWidth: 2,
          style: { cursor: 'pointer', transition: 'r 0.12s, fill-opacity 0.25s, cy 0.4s' },
          onMouseEnter: (e) => { setHovered(i); setHovPos({ x: e.clientX, y: e.clientY }); },
          onMouseLeave: () => setHovered(null),
        });
      }),

      // Axis titles
      React.createElement('text', {
        x: m.left + pw / 2, y: h - 4, textAnchor: 'middle',
        style: { fontSize: 9, fill: '#1a1a1a', opacity: 0.35, textTransform: 'uppercase', letterSpacing: 1.2 },
      }, 'Efficiency'),
      React.createElement('text', {
        x: 14, y: m.top + ph / 2, textAnchor: 'middle',
        style: { fontSize: 9, fill: '#1a1a1a', opacity: 0.35, textTransform: 'uppercase', letterSpacing: 1.2 },
        transform: `rotate(-90, 14, ${m.top + ph / 2})`,
      }, 'Score'),
    ),

    // Legend bar (interactive, below chart)
    React.createElement('div', {
      style: {
        display: 'flex', gap: 12, marginTop: 4,
        background: '#f7f0e6',
        border: '2px solid #1a1a1a',
        borderRadius: 8,
        padding: '5px 14px',
        boxShadow: '2px 2px 0 0 #1a1a1a',
      }
    },
      ...categories.map((cat, i) =>
        React.createElement('div', {
          key: cat,
          onClick: () => toggleCat(i),
          style: {
            display: 'flex', alignItems: 'center', gap: 5,
            cursor: 'pointer', userSelect: 'none',
            opacity: activeCats.has(i) ? 1 : 0.3,
            transition: 'opacity 0.2s',
          }
        },
          React.createElement('div', {
            style: {
              width: 10, height: 10, borderRadius: 2,
              background: palette[i],
              border: '1.5px solid #1a1a1a',
            }
          }),
          React.createElement('span', {
            style: { fontSize: 10, fontWeight: 600, color: '#1a1a1a' },
          }, cat),
        )
      ),
    ),

    // Floating tooltip
    hovPt && activeCats.has(hovPt.cat) && React.createElement('div', {
      style: {
        position: 'absolute',
        top: 40, right: 16,
        background: '#f7f0e6',
        border: '2px solid #1a1a1a',
        borderRadius: 6,
        padding: '8px 12px',
        boxShadow: '3px 3px 0 0 #1a1a1a',
        fontSize: 11,
        zIndex: 10,
        minWidth: 120,
      }
    },
      React.createElement('div', {
        style: {
          fontWeight: 700, marginBottom: 4, paddingBottom: 4,
          borderBottom: `2px solid ${palette[hovPt.cat]}`,
          fontFamily: "'Space Grotesk', sans-serif",
        }
      }, categories[hovPt.cat]),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 12 } },
        React.createElement('span', { style: { opacity: 0.5 } }, 'Efficiency'),
        React.createElement('span', { style: { fontWeight: 600 } }, hovPt.x.toFixed(1)),
      ),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 12 } },
        React.createElement('span', { style: { opacity: 0.5 } }, 'Score'),
        React.createElement('span', { style: { fontWeight: 600 } }, hovPt.y.toFixed(1)),
      ),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 12 } },
        React.createElement('span', { style: { opacity: 0.5 } }, 'Value'),
        React.createElement('span', { style: { fontWeight: 600, color: palette[hovPt.cat] } }, hovPt.value),
      ),
    ),
  );
}
