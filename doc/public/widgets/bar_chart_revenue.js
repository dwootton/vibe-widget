export default function BarChartRevenue({ model, React }) {
  const { useState, useEffect, useRef, useCallback } = React;

  const data = [
    { region: 'North America', revenue: 4200 },
    { region: 'Europe', revenue: 3100 },
    { region: 'Asia Pacific', revenue: 2800 },
    { region: 'Latin America', revenue: 1400 },
    { region: 'Middle East', revenue: 950 },
  ];

  const palette = ['#f97316', '#4a7c8a', '#c4a35a', '#a0522d', '#6b7b8d'];

  const [hovered, setHovered] = useState(null);
  const [animProgress, setAnimProgress] = useState(0);
  const animRef = useRef(null);

  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setAnimProgress(ease);
      if (t < 1) animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const maxRevenue = Math.max(...data.map(d => d.revenue));
  const margin = { top: 32, right: 24, bottom: 64, left: 100 };
  const width = 560;
  const height = 340;
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const barH = Math.min(36, (plotH / data.length) - 8);
  const gap = (plotH - barH * data.length) / (data.length + 1);

  const ticks = [0, 1000, 2000, 3000, 4000, 5000];

  const fmt = v => v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${v}`;

  return React.createElement('div', {
    style: {
      width: '100%', height: '100%',
      background: '#f7f0e6',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      position: 'relative', overflow: 'hidden',
    }
  },
    React.createElement('svg', {
      viewBox: `0 0 ${width} ${height}`,
      style: { width: '100%', maxWidth: width, height: 'auto' },
    },
      // Title
      React.createElement('text', {
        x: margin.left, y: 20,
        style: { fontSize: 14, fontWeight: 700, fill: '#1a1a1a', fontFamily: "'Space Grotesk', sans-serif" }
      }, 'Revenue by Region'),

      // Grid lines
      ...ticks.map(tick =>
        React.createElement('line', {
          key: `grid-${tick}`,
          x1: margin.left + (tick / 5000) * plotW,
          x2: margin.left + (tick / 5000) * plotW,
          y1: margin.top,
          y2: margin.top + plotH,
          stroke: '#1a1a1a',
          strokeOpacity: 0.08,
          strokeWidth: 1,
          strokeDasharray: tick === 0 ? 'none' : '3,3',
        })
      ),

      // X axis ticks
      ...ticks.map(tick =>
        React.createElement('text', {
          key: `xtick-${tick}`,
          x: margin.left + (tick / 5000) * plotW,
          y: margin.top + plotH + 20,
          textAnchor: 'middle',
          style: { fontSize: 10, fill: '#1a1a1a', opacity: 0.5, fontFamily: 'inherit' }
        }, fmt(tick))
      ),

      // Axis line
      React.createElement('line', {
        x1: margin.left, x2: margin.left,
        y1: margin.top, y2: margin.top + plotH,
        stroke: '#1a1a1a', strokeWidth: 2,
      }),

      // Bars
      ...data.map((d, i) => {
        const y = margin.top + gap + i * (barH + gap);
        const barWidth = (d.revenue / 5000) * plotW * animProgress;
        const isHov = hovered === i;

        return React.createElement('g', { key: d.region },
          // Region label
          React.createElement('text', {
            x: margin.left - 8,
            y: y + barH / 2 + 1,
            textAnchor: 'end',
            dominantBaseline: 'middle',
            style: {
              fontSize: 11, fill: '#1a1a1a',
              fontWeight: isHov ? 700 : 400,
              fontFamily: 'inherit',
              transition: 'font-weight 0.15s',
            },
          }, d.region),

          // Bar shadow
          React.createElement('rect', {
            x: margin.left + 3,
            y: y + 3,
            width: barWidth,
            height: barH,
            rx: 3,
            fill: '#1a1a1a',
            opacity: 0.12,
          }),

          // Bar
          React.createElement('rect', {
            x: margin.left,
            y: y,
            width: barWidth,
            height: barH,
            rx: 3,
            fill: palette[i],
            stroke: isHov ? '#1a1a1a' : 'none',
            strokeWidth: isHov ? 2 : 0,
            style: { cursor: 'pointer', transition: 'stroke 0.15s, filter 0.15s', filter: isHov ? 'brightness(1.08)' : 'none' },
            onMouseEnter: () => setHovered(i),
            onMouseLeave: () => setHovered(null),
          }),

          // Value label
          animProgress > 0.5 && React.createElement('text', {
            x: margin.left + barWidth + 8,
            y: y + barH / 2 + 1,
            dominantBaseline: 'middle',
            style: {
              fontSize: 11,
              fill: '#1a1a1a',
              fontWeight: 600,
              fontFamily: 'inherit',
              opacity: Math.min(1, (animProgress - 0.5) * 4),
            }
          }, fmt(d.revenue)),
        );
      }),

      // X axis label
      React.createElement('text', {
        x: margin.left + plotW / 2,
        y: height - 8,
        textAnchor: 'middle',
        style: { fontSize: 10, fill: '#1a1a1a', opacity: 0.4, fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: 1.5 },
      }, 'Revenue (USD)'),
    ),

    // Tooltip
    hovered !== null && React.createElement('div', {
      style: {
        position: 'absolute', top: 12, right: 16,
        background: '#f7f0e6',
        border: '2px solid #1a1a1a',
        borderRadius: 6,
        padding: '8px 12px',
        boxShadow: '3px 3px 0 0 #1a1a1a',
        fontFamily: 'inherit',
        fontSize: 11,
        zIndex: 10,
      }
    },
      React.createElement('div', { style: { fontWeight: 700, marginBottom: 2 } }, data[hovered].region),
      React.createElement('div', { style: { color: palette[hovered] } }, fmt(data[hovered].revenue)),
    ),
  );
}
