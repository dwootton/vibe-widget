import * as d3 from "https://esm.sh/d3@7";

export const DampingSlider = ({ value, onChange, React }) => (
  <div style={{ marginBottom: 12 }}>
    <label style={{ fontWeight: 600, color: '#333' }}>
      Damping c: {value.toFixed(2)}
    </label>
    <input
      type="range"
      min={0}
      max={1.5}
      step={0.01}
      value={value}
      onInput={(e) => onChange(parseFloat(e.target.value))}
      style={{ width: 200, marginLeft: 12 }}
    />
  </div>
);

export const PointsTable = ({ points, trajectories, damping, React }) => {
  const findEquilibrium = (traj) => {
    if (!traj || traj.length === 0) return { eq: '—', time: '—' };
    const threshold = 0.05;
    const equilibria = [0, 2 * Math.PI, -2 * Math.PI];
    
    for (let i = 0; i < traj.length; i++) {
      const { theta, omega, t } = traj[i];
      for (const eq of equilibria) {
        const dist = Math.sqrt((theta - eq) ** 2 + omega ** 2);
        if (dist < threshold) {
          const eqLabel = eq === 0 ? '0' : eq > 0 ? '+2π' : '−2π';
          return { eq: eqLabel, time: t.toFixed(2) };
        }
      }
    }
    return { eq: '—', time: '—' };
  };

  return (
    <table style={{ 
      borderCollapse: 'collapse', 
      fontSize: 12, 
      backgroundColor: '#fff',
      border: '1px solid #ccc'
    }}>
      <thead>
        <tr style={{ backgroundColor: '#f0f0f0' }}>
          <th style={{ padding: '6px 8px', borderBottom: '2px solid #333', color: '#000' }}>#</th>
          <th style={{ padding: '6px 8px', borderBottom: '2px solid #333', color: '#000' }}>θ₀</th>
          <th style={{ padding: '6px 8px', borderBottom: '2px solid #333', color: '#000' }}>ω₀</th>
          <th style={{ padding: '6px 8px', borderBottom: '2px solid #333', color: '#000' }}>Eq.</th>
          <th style={{ padding: '6px 8px', borderBottom: '2px solid #333', color: '#000' }}>t</th>
        </tr>
      </thead>
      <tbody>
        {points.map((pt, i) => {
          const { eq, time } = findEquilibrium(trajectories[i]);
          return (
            <tr key={pt.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
              <td style={{ 
                padding: '4px 8px', 
                borderBottom: '1px solid #ddd',
                color: pt.color,
                fontWeight: 700
              }}>{i + 1}</td>
              <td style={{ padding: '4px 8px', borderBottom: '1px solid #ddd', color: '#000' }}>
                {pt.theta0.toFixed(2)}
              </td>
              <td style={{ padding: '4px 8px', borderBottom: '1px solid #ddd', color: '#000' }}>
                {pt.omega0.toFixed(2)}
              </td>
              <td style={{ padding: '4px 8px', borderBottom: '1px solid #ddd', color: '#000' }}>
                {eq}
              </td>
              <td style={{ padding: '4px 8px', borderBottom: '1px solid #ddd', color: '#000' }}>
                {time}
              </td>
            </tr>
          );
        })}
        {points.length === 0 && (
          <tr>
            <td colSpan={5} style={{ padding: '8px', color: '#666', textAlign: 'center' }}>
              Click plot to add points
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

export default function Widget({ model, React }) {
  const [damping, setDamping] = React.useState(0.25);
  const [points, setPoints] = React.useState([]);
  const [trajectories, setTrajectories] = React.useState([]);
  const [draggingIdx, setDraggingIdx] = React.useState(null);
  const svgRef = React.useRef(null);
  const idCounter = React.useRef(0);

  const width = 500;
  const height = 400;
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xScale = React.useMemo(() => 
    d3.scaleLinear().domain([-2 * Math.PI, 2 * Math.PI]).range([0, innerWidth]),
    [innerWidth]
  );
  const yScale = React.useMemo(() => 
    d3.scaleLinear().domain([-5, 5]).range([innerHeight, 0]),
    [innerHeight]
  );

  const colors = d3.schemeCategory10.concat(d3.schemePaired.slice(0, 2));

  // Initialize outputs on mount
  React.useEffect(() => {
    model.set("points", []);
    model.set("damping", 0.25);
    model.save_changes();
  }, []);

  // Sync damping to model
  React.useEffect(() => {
    model.set("damping", damping);
    model.save_changes();
  }, [damping]);

  // Sync points to model
  React.useEffect(() => {
    const pts = points.map(p => ({ theta0: p.theta0, omega0: p.omega0 }));
    model.set("points", pts);
    model.save_changes();
  }, [points]);

  // RK4 integrator for pendulum
  const integrate = React.useCallback((theta0, omega0, c, dt = 0.02, tMax = 25) => {
    const f = (theta, omega) => [omega, -Math.sin(theta) - c * omega];
    
    const rk4Step = (theta, omega, dt) => {
      const [k1t, k1o] = f(theta, omega);
      const [k2t, k2o] = f(theta + 0.5 * dt * k1t, omega + 0.5 * dt * k1o);
      const [k3t, k3o] = f(theta + 0.5 * dt * k2t, omega + 0.5 * dt * k2o);
      const [k4t, k4o] = f(theta + dt * k3t, omega + dt * k3o);
      return [
        theta + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t),
        omega + (dt / 6) * (k1o + 2 * k2o + 2 * k3o + k4o)
      ];
    };

    const trajectory = [{ theta: theta0, omega: omega0, t: 0 }];
    let theta = theta0, omega = omega0, t = 0;
    
    while (t < tMax) {
      [theta, omega] = rk4Step(theta, omega, dt);
      t += dt;
      trajectory.push({ theta, omega, t });
    }
    return trajectory;
  }, []);

  // Recompute all trajectories when damping or points change
  React.useEffect(() => {
    const newTrajectories = points.map(pt => 
      integrate(pt.theta0, pt.omega0, damping)
    );
    setTrajectories(newTrajectories);
  }, [points, damping, integrate]);

  // Draw direction field
  const drawDirectionField = React.useCallback((g, c) => {
    g.selectAll('.arrow').remove();
    
    const gridX = 20;
    const gridY = 16;
    const arrowLen = 12;
    
    for (let i = 0; i <= gridX; i++) {
      for (let j = 0; j <= gridY; j++) {
        const theta = -2 * Math.PI + (4 * Math.PI * i) / gridX;
        const omega = -5 + (10 * j) / gridY;
        
        const dtheta = omega;
        const domega = -Math.sin(theta) - c * omega;
        
        const mag = Math.sqrt(dtheta * dtheta + domega * domega);
        if (mag < 0.001) continue;
        
        const dx = (dtheta / mag) * arrowLen;
        const dy = (domega / mag) * arrowLen;
        
        const x = xScale(theta);
        const y = yScale(omega);
        
        g.append('line')
          .attr('class', 'arrow')
          .attr('x1', x - dx / 2)
          .attr('y1', y + dy / 2)
          .attr('x2', x + dx / 2)
          .attr('y2', y - dy / 2)
          .attr('stroke', '#bbb')
          .attr('stroke-width', 1)
          .attr('marker-end', 'url(#arrowhead)');
      }
    }
  }, [xScale, yScale]);

  // Main SVG setup and rendering
  React.useEffect(() => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    
    // Defs for arrowhead
    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 5)
      .attr('refY', 5)
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', '#bbb');

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Clip path
    defs.append('clipPath')
      .attr('id', 'plot-clip')
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight);

    // Background
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', '#fafafa');

    // Direction field group
    const fieldGroup = g.append('g').attr('class', 'field');
    drawDirectionField(fieldGroup, damping);

    // Axes
    const xAxis = d3.axisBottom(xScale)
      .tickValues([-2 * Math.PI, -Math.PI, 0, Math.PI, 2 * Math.PI])
      .tickFormat(d => {
        if (d === 0) return '0';
        if (d === Math.PI) return 'π';
        if (d === -Math.PI) return '−π';
        if (d === 2 * Math.PI) return '2π';
        if (d === -2 * Math.PI) return '−2π';
        return d;
      });
    
    const yAxis = d3.axisLeft(yScale);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .style('fill', '#000');

    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .style('fill', '#000');

    // Axis labels
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 35)
      .attr('text-anchor', 'middle')
      .attr('fill', '#000')
      .attr('font-size', 14)
      .text('θ');

    g.append('text')
      .attr('x', -innerHeight / 2)
      .attr('y', -35)
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('fill', '#000')
      .attr('font-size', 14)
      .text('ω');

    // Trajectories group
    const trajGroup = g.append('g')
      .attr('class', 'trajectories')
      .attr('clip-path', 'url(#plot-clip)');

    // Points group
    const pointsGroup = g.append('g').attr('class', 'points');

    // Line generator
    const lineGen = d3.line()
      .x(d => xScale(d.theta))
      .y(d => yScale(d.omega));

    // Draw trajectories
    trajectories.forEach((traj, i) => {
      if (!traj || !points[i]) return;
      trajGroup.append('path')
        .datum(traj)
        .attr('d', lineGen)
        .attr('fill', 'none')
        .attr('stroke', points[i].color)
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.8);
    });

    // Draw points
    points.forEach((pt, i) => {
      const cx = xScale(pt.theta0);
      const cy = yScale(pt.omega0);
      
      const pg = pointsGroup.append('g')
        .attr('class', 'point-group')
        .attr('transform', `translate(${cx},${cy})`)
        .style('cursor', 'grab');

      pg.append('circle')
        .attr('r', 8)
        .attr('fill', pt.color)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);

      pg.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', 4)
        .attr('fill', '#fff')
        .attr('font-size', 10)
        .attr('font-weight', 700)
        .text(i + 1);
    });

    return () => {
      svg.selectAll('*').remove();
    };
  }, [points, trajectories, damping, xScale, yScale, innerWidth, innerHeight, drawDirectionField]);

  // Handle click to add point
  const handleClick = (e) => {
    if (points.length >= 12) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - margin.left;
    const y = e.clientY - rect.top - margin.top;
    
    if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) return;
    
    const theta0 = xScale.invert(x);
    const omega0 = yScale.invert(y);
    
    const newPoint = {
      id: idCounter.current++,
      theta0,
      omega0,
      color: colors[points.length % colors.length]
    };
    
    setPoints(prev => [...prev, newPoint]);
  };

  // Handle double click to remove point
  const handleDoubleClick = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - margin.left;
    const y = e.clientY - rect.top - margin.top;
    
    const clickedIdx = points.findIndex(pt => {
      const px = xScale(pt.theta0);
      const py = yScale(pt.omega0);
      return Math.sqrt((x - px) ** 2 + (y - py) ** 2) < 12;
    });
    
    if (clickedIdx >= 0) {
      setPoints(prev => prev.filter((_, i) => i !== clickedIdx));
    }
  };

  // Handle mouse down for dragging
  const handleMouseDown = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - margin.left;
    const y = e.clientY - rect.top - margin.top;
    
    const clickedIdx = points.findIndex(pt => {
      const px = xScale(pt.theta0);
      const py = yScale(pt.omega0);
      return Math.sqrt((x - px) ** 2 + (y - py) ** 2) < 12;
    });
    
    if (clickedIdx >= 0) {
      setDraggingIdx(clickedIdx);
      e.preventDefault();
    }
  };

  // Handle mouse move for dragging
  const handleMouseMove = (e) => {
    if (draggingIdx === null) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - margin.left;
    const y = e.clientY - rect.top - margin.top;
    
    const theta0 = Math.max(-2 * Math.PI, Math.min(2 * Math.PI, xScale.invert(x)));
    const omega0 = Math.max(-5, Math.min(5, yScale.invert(y)));
    
    setPoints(prev => prev.map((pt, i) => 
      i === draggingIdx ? { ...pt, theta0, omega0 } : pt
    ));
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setDraggingIdx(null);
  };

  // Global mouse events for dragging
  React.useEffect(() => {
    if (draggingIdx !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingIdx, handleMouseMove]);

  return (
    <div style={{ 
      fontFamily: 'system-ui, sans-serif',
      padding: 16,
      backgroundColor: '#fff'
    }}>
      <h3 style={{ margin: '0 0 12px', color: '#222' }}>
        Damped Pendulum Phase Portrait
      </h3>
      <DampingSlider value={damping} onChange={setDamping} React={React} />
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div>
          <svg
            ref={svgRef}
            width={width}
            height={height}
            style={{ 
              border: '1px solid #ccc',
              cursor: draggingIdx !== null ? 'grabbing' : 'crosshair'
            }}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleMouseDown}
          />
          <p style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
            Click to add point • Drag to move • Double-click to remove • Max 12 points
          </p>
        </div>
        <div>
          <h4 style={{ margin: '0 0 8px', color: '#222', fontSize: 14 }}>Initial Conditions</h4>
          <PointsTable 
            points={points} 
            trajectories={trajectories} 
            damping={damping} 
            React={React} 
          />
        </div>
      </div>
    </div>
  );
}