import * as d3 from "https://esm.sh/d3@7";

const PALETTE = [
  "#d9534f", "#2b7cb6", "#2a9d8f", "#e76f51", 
  "#8a508f", "#f4a261", "#457b9d", "#b5179e", 
  "#3a0ca3", "#38b000", "#e63946", "#4361ee"
];

function rk4Integrate(theta0, omega0, c, totalT = 25, dt = 0.02) {
  let t = 0;
  let th = theta0;
  let w = omega0;
  const steps = Math.floor(totalT / dt);
  const path = [{ t: 0, theta: th, omega: w }];

  function f(currTh, currW) {
    return [currW, -Math.sin(currTh) - c * currW];
  }

  const eqCandidates = [0, -2 * Math.PI, 2 * Math.PI];
  let eqReached = null;
  let timeToEq = null;

  for (let i = 0; i < steps; i++) {
    const [k1Th, k1W] = f(th, w);
    const [k2Th, k2W] = f(th + 0.5 * dt * k1Th, w + 0.5 * dt * k1W);
    const [k3Th, k3W] = f(th + 0.5 * dt * k2Th, w + 0.5 * dt * k2W);
    const [k4Th, k4W] = f(th + dt * k3Th, w + dt * k3W);

    th += (dt / 6) * (k1Th + 2 * k2Th + 2 * k3Th + k4Th);
    w += (dt / 6) * (k1W + 2 * k2W + 2 * k3W + k4W);
    t += dt;

    path.push({ t, theta: th, omega: w });

    if (timeToEq === null) {
      for (const eq of eqCandidates) {
        const dist = Math.hypot(th - eq, w);
        if (dist < 0.05) {
          eqReached = eq;
          timeToEq = t;
          break;
        }
      }
    }
  }

  if (eqReached === null) {
    let bestDist = Infinity;
    let closestEq = null;
    for (const eq of eqCandidates) {
      const dist = Math.hypot(th - eq, w);
      if (dist < bestDist) {
        bestDist = dist;
        closestEq = eq;
      }
    }
    if (bestDist < 0.3) {
      eqReached = closestEq;
    }
  }

  return { path, eqReached, timeToEq };
}

export const DampingSlider = ({ value, onChange, React }) => {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      background: "rgba(255,255,255,0.7)",
      padding: "8px 16px",
      borderRadius: "8px",
      border: "1px solid #e2ddd5",
      boxShadow: "0 2px 5px rgba(0,0,0,0.03)"
    }}>
      <label style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontWeight: "bold",
        fontSize: "14px",
        color: "#2b2b2b"
      }}>
        Damping Coefficient (c):
      </label>
      <input
        type="range"
        min="0"
        max="1.5"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          cursor: "pointer",
          width: "160px",
          accentColor: "#2b7cb6"
        }}
      />
      <span style={{
        fontFamily: "monospace",
        fontWeight: "bold",
        fontSize: "14px",
        minWidth: "38px",
        color: "#1a1a1a"
      }}>
        {value.toFixed(2)}
      </span>
    </div>
  );
};

export const TrajectoryTable = ({ points, results, onRemove, onClearAll, React }) => {
  const getEqLabel = (eq) => {
    if (eq === null || eq === undefined) return "—";
    if (Math.abs(eq) < 0.1) return "0";
    if (eq > 0) return "+2π";
    return "-2π";
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      background: "#fff",
      border: "1px solid #e5dfd5",
      borderRadius: "10px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
      padding: "16px",
      width: "300px",
      maxHeight: "500px",
      overflowY: "auto",
      boxSizing: "border-box"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "12px",
        borderBottom: "1px solid #f0eae1",
        paddingBottom: "8px"
      }}>
        <h4 style={{
          margin: 0,
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "16px",
          color: "#222"
        }}>
          Initial Conditions
        </h4>
        {points.length > 0 && (
          <button
            onClick={onClearAll}
            style={{
              background: "none",
              border: "none",
              color: "#a04040",
              cursor: "pointer",
              fontSize: "12px",
              fontFamily: "monospace",
              textDecoration: "underline"
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {points.length === 0 ? (
        <p style={{
          fontSize: "13px",
          color: "#777",
          fontStyle: "italic",
          lineHeight: "1.4",
          margin: 0
        }}>
          Click anywhere in the phase space to launch a trajectory. Drag dots to adjust, or double-click to remove.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "12px",
            fontFamily: "monospace"
          }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ddd", textAlign: "left", color: "#666" }}>
                <th style={{ padding: "4px 2px" }}>#</th>
                <th style={{ padding: "4px 2px" }}>θ₀</th>
                <th style={{ padding: "4px 2px" }}>ω₀</th>
                <th style={{ padding: "4px 2px" }}>Eq.</th>
                <th style={{ padding: "4px 2px" }}>T(s)</th>
                <th style={{ padding: "4px 2px" }}></th>
              </tr>
            </thead>
            <tbody>
              {points.map((pt, idx) => {
                const res = results[idx] || {};
                return (
                  <tr key={pt.id} style={{ borderBottom: "1px solid #f2ede4" }}>
                    <td style={{ padding: "6px 2px" }}>
                      <span style={{
                        display: "inline-block",
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        backgroundColor: PALETTE[idx % PALETTE.length],
                        color: "#fff",
                        textAlign: "center",
                        lineHeight: "16px",
                        fontSize: "10px",
                        fontWeight: "bold"
                      }}>
                        {idx + 1}
                      </span>
                    </td>
                    <td style={{ padding: "6px 2px", color: "#222" }}>{pt.theta0.toFixed(2)}</td>
                    <td style={{ padding: "6px 2px", color: "#222" }}>{pt.omega0.toFixed(2)}</td>
                    <td style={{ padding: "6px 2px", fontWeight: "bold", color: "#333" }}>
                      {getEqLabel(res.eqReached)}
                    </td>
                    <td style={{ padding: "6px 2px", color: "#444" }}>
                      {res.timeToEq ? res.timeToEq.toFixed(1) + "s" : ">25s"}
                    </td>
                    <td style={{ padding: "6px 2px", textAlign: "right" }}>
                      <button
                        onClick={() => onRemove(pt.id)}
                        title="Remove dot"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#999",
                          fontSize: "14px",
                          fontWeight: "bold",
                          padding: "0 2px"
                        }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default function Widget({ model, React }) {
  const [damping, setDamping] = React.useState(0.25);
  const [points, setPoints] = React.useState([
    { id: 1, theta0: -2.5, omega0: 2.2 },
    { id: 2, theta0: 1.0, omega0: -3.5 }
  ]);

  const svgRef = React.useRef(null);
  const pointsRef = React.useRef(points);
  const dampingRef = React.useRef(damping);
  const idCounter = React.useRef(3);

  pointsRef.current = points;
  dampingRef.current = damping;

  React.useEffect(() => {
    model.set("points", points.map(p => ({ theta0: p.theta0, omega0: p.omega0 })));
    model.set("damping", damping);
    model.save_changes();
  }, []);

  const updateOutputs = (pts, c) => {
    model.set("points", pts.map(p => ({ theta0: p.theta0, omega0: p.omega0 })));
    model.set("damping", c);
    model.save_changes();
  };

  const setDampingWrapped = (newDamping) => {
    setDamping(newDamping);
    updateOutputs(pointsRef.current, newDamping);
  };

  const removePoint = (id) => {
    const updated = pointsRef.current.filter(p => p.id !== id);
    setPoints(updated);
    updateOutputs(updated, dampingRef.current);
  };

  const clearPoints = () => {
    setPoints([]);
    updateOutputs([], dampingRef.current);
  };

  const results = React.useMemo(() => {
    return points.map(pt => rk4Integrate(pt.theta0, pt.omega0, damping));
  }, [points, damping]);

  React.useEffect(() => {
    if (!svgRef.current) return;

    const width = 560;
    const height = 460;
    const margin = { top: 20, right: 25, bottom: 45, left: 50 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear()
      .domain([-2 * Math.PI, 2 * Math.PI])
      .range([0, innerW]);

    const yScale = d3.scaleLinear()
      .domain([-5, 5])
      .range([innerH, 0]);

    // Grid lines
    const xGrid = d3.axisBottom(xScale)
      .tickValues([-2 * Math.PI, -Math.PI, 0, Math.PI, 2 * Math.PI])
      .tickSize(-innerH)
      .tickFormat("");
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(xGrid)
      .selectAll("line")
      .attr("stroke", "#eae4d9")
      .attr("stroke-dasharray", "2,2");

    const yGrid = d3.axisLeft(yScale)
      .ticks(5)
      .tickSize(-innerW)
      .tickFormat("");
    g.append("g")
      .call(yGrid)
      .selectAll("line")
      .attr("stroke", "#eae4d9")
      .attr("stroke-dasharray", "2,2");

    // Equilibrium markers
    [-2 * Math.PI, 0, 2 * Math.PI].forEach(eq => {
      g.append("circle")
        .attr("cx", xScale(eq))
        .attr("cy", yScale(0))
        .attr("r", 5)
        .attr("fill", "#2b2b2b")
        .attr("stroke", "#fdfbf7")
        .attr("stroke-width", 2)
        .attr("opacity", 0.75);
    });

    [-Math.PI, Math.PI].forEach(saddle => {
      g.append("circle")
        .attr("cx", xScale(saddle))
        .attr("cy", yScale(0))
        .attr("r", 4)
        .attr("fill", "#fff")
        .attr("stroke", "#666")
        .attr("stroke-width", 2);
    });

    // Vector field group
    const vectorGroup = g.append("g").attr("class", "vector-field");

    function renderDirectionField(c) {
      vectorGroup.selectAll("*").remove();
      const nTheta = 24;
      const nOmega = 18;
      const dTh = (4 * Math.PI) / nTheta;
      const dOm = 10 / nOmega;

      for (let i = 0; i <= nTheta; i++) {
        const th = -2 * Math.PI + i * dTh;
        for (let j = 0; j <= nOmega; j++) {
          const w = -5 + j * dOm;
          const dTh_dt = w;
          const dW_dt = -Math.sin(th) - c * w;
          const mag = Math.hypot(dTh_dt, dW_dt) || 0.001;

          const arrowLen = 10;
          const u = (dTh_dt / mag) * arrowLen;
          const v = (dW_dt / mag) * arrowLen;

          const cx = xScale(th);
          const cy = yScale(w);

          // Arrow line
          vectorGroup.append("line")
            .attr("x1", cx - u * 0.5)
            .attr("y1", cy + v * 0.5)
            .attr("x2", cx + u * 0.5)
            .attr("y2", cy - v * 0.5)
            .attr("stroke", "#c4beb4")
            .attr("stroke-width", 1.1)
            .attr("stroke-linecap", "round");

          // Arrow head
          const angle = Math.atan2(-v, u);
          const headLen = 3;
          const tipX = cx + u * 0.5;
          const tipY = cy - v * 0.5;

          const a1 = angle + Math.PI * 0.85;
          const a2 = angle - Math.PI * 0.85;

          vectorGroup.append("line")
            .attr("x1", tipX)
            .attr("y1", tipY)
            .attr("x2", tipX + headLen * Math.cos(a1))
            .attr("y2", tipY + headLen * Math.sin(a1))
            .attr("stroke", "#c4beb4")
            .attr("stroke-width", 1.1);

          vectorGroup.append("line")
            .attr("x1", tipX)
            .attr("y1", tipY)
            .attr("x2", tipX + headLen * Math.cos(a2))
            .attr("y2", tipY + headLen * Math.sin(a2))
            .attr("stroke", "#c4beb4")
            .attr("stroke-width", 1.1);
        }
      }
    }

    renderDirectionField(damping);

    // Trajectory group
    const trajGroup = g.append("g").attr("class", "trajectories");

    // Dot group
    const dotGroup = g.append("g").attr("class", "dots");

    const lineGenerator = d3.line()
      .x(d => xScale(d.theta))
      .y(d => yScale(d.omega))
      .curve(d3.curveLinear);

    function updateTrajectories(curPoints, curDamping) {
      trajGroup.selectAll("*").remove();

      curPoints.forEach((pt, i) => {
        const color = PALETTE[i % PALETTE.length];
        const { path } = rk4Integrate(pt.theta0, pt.omega0, curDamping);

        trajGroup.append("path")
          .datum(path)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", 2)
          .attr("stroke-linecap", "round")
          .attr("stroke-linejoin", "round")
          .attr("opacity", 0.85)
          .attr("d", lineGenerator);
      });
    }

    function renderDots(curPoints) {
      const selection = dotGroup.selectAll("g.dot-node")
        .data(curPoints, d => d.id);

      selection.exit().remove();

      const enter = selection.enter()
        .append("g")
        .attr("class", "dot-node")
        .attr("cursor", "grab");

      // Invisible hit area for drag
      enter.append("circle")
        .attr("class", "hit-area")
        .attr("r", 15)
        .attr("fill", "transparent");

      // Visible circle
      enter.append("circle")
        .attr("class", "visible-circle")
        .attr("r", 7)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 2);

      // Label
      enter.append("text")
        .attr("class", "dot-label")
        .attr("text-anchor", "middle")
        .attr("dy", "3.5px")
        .attr("font-size", "9px")
        .attr("font-family", "monospace")
        .attr("font-weight", "bold")
        .attr("fill", "#ffffff")
        .attr("pointer-events", "none");

      const merged = enter.merge(selection);

      merged.attr("transform", d => `translate(${xScale(d.theta0)},${yScale(d.omega0)})`);

      merged.select(".visible-circle")
        .attr("fill", (d, i) => PALETTE[i % PALETTE.length]);

      merged.select(".dot-label")
        .text((d, i) => i + 1);

      // Set up drag behaviour
      const dragBehavior = d3.drag()
        .on("start", function () {
          d3.select(this).attr("cursor", "grabbing");
        })
        .on("drag", function (event, d) {
          const [px, py] = d3.pointer(event, g.node());
          const newTh = Math.max(-2 * Math.PI, Math.min(2 * Math.PI, xScale.invert(px)));
          const newW = Math.max(-5, Math.min(5, yScale.invert(py)));

          d.theta0 = newTh;
          d.omega0 = newW;

          d3.select(this).attr("transform", `translate(${xScale(newTh)},${yScale(newW)})`);

          updateTrajectories(pointsRef.current, dampingRef.current);
        })
        .on("end", function () {
          d3.select(this).attr("cursor", "grab");
          setPoints([...pointsRef.current]);
          updateOutputs(pointsRef.current, dampingRef.current);
        });

      merged.call(dragBehavior);

      merged.on("dblclick", function (event, d) {
        event.stopPropagation();
        removePoint(d.id);
      });
    }

    updateTrajectories(points, damping);
    renderDots(points);

    // Click on canvas to add a new starting point
    const bgRect = g.insert("rect", ":first-child")
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "transparent")
      .attr("cursor", "crosshair");

    bgRect.on("click", function (event) {
      if (pointsRef.current.length >= 12) return;
      const [px, py] = d3.pointer(event, g.node());
      const newTh = xScale.invert(px);
      const newW = yScale.invert(py);

      const newPt = {
        id: idCounter.current++,
        theta0: newTh,
        omega0: newW
      };

      const updated = [...pointsRef.current, newPt];
      setPoints(updated);
      updateOutputs(updated, dampingRef.current);
    });

    // Axes
    const xAxis = d3.axisBottom(xScale)
      .tickValues([-2 * Math.PI, -Math.PI, 0, Math.PI, 2 * Math.PI])
      .tickFormat(d => {
        if (Math.abs(d) < 0.01) return "0";
        if (Math.abs(d - Math.PI) < 0.01) return "π";
        if (Math.abs(d + Math.PI) < 0.01) return "-π";
        if (Math.abs(d - 2 * Math.PI) < 0.01) return "2π";
        if (Math.abs(d + 2 * Math.PI) < 0.01) return "-2π";
        return d;
      });

    const yAxis = d3.axisLeft(yScale).ticks(5);

    const xAxisG = g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(xAxis);

    xAxisG.selectAll("text")
      .attr("font-family", "monospace")
      .attr("font-size", "11px")
      .attr("fill", "#2b2b2b");

    const yAxisG = g.append("g")
      .call(yAxis);

    yAxisG.selectAll("text")
      .attr("font-family", "monospace")
      .attr("font-size", "11px")
      .attr("fill", "#2b2b2b");

    // Axis titles
    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 36)
      .attr("text-anchor", "middle")
      .attr("font-family", "'Playfair Display', Georgia, serif")
      .attr("font-size", "13px")
      .attr("font-style", "italic")
      .attr("fill", "#333")
      .text("Angle θ (radians)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2)
      .attr("y", -36)
      .attr("text-anchor", "middle")
      .attr("font-family", "'Playfair Display', Georgia, serif")
      .attr("font-size", "13px")
      .attr("font-style", "italic")
      .attr("fill", "#333")
      .text("Angular Velocity ω = θ'");

    return () => {
      svg.selectAll("*").remove();
    };
  }, [points, damping]);

  return (
    <section style={{
      background: "#fdfbf7",
      color: "#2b2b2b",
      padding: "24px 28px",
      borderRadius: "12px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      boxShadow: "inset 0 0 40px rgba(0,0,0,0.02)",
      maxWidth: "940px",
      margin: "0 auto",
      boxSizing: "border-box"
    }}>
      <div style={{ marginBottom: "16px" }}>
        <h2 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "24px",
          fontWeight: "700",
          margin: "0 0 6px 0",
          color: "#1d1d1d"
        }}>
          Phase Portrait: Damped Pendulum
        </h2>
        <p style={{
          margin: 0,
          fontSize: "13.5px",
          color: "#5c5852",
          maxWidth: "760px",
          lineHeight: "1.5"
        }}>
          Governed by <code>θ'' = -sin(θ) - c·θ'</code>. Click anywhere on the grid to drop a trajectory point (max 12). Drag dots to re-integrate dynamically in real time; double-click a dot to delete it.
        </p>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <DampingSlider value={damping} onChange={setDampingWrapped} React={React} />
      </div>

      <div style={{
        display: "flex",
        gap: "20px",
        alignItems: "flex-start",
        flexWrap: "wrap"
      }}>
        <div style={{
          background: "#ffffff",
          borderRadius: "10px",
          border: "1px solid #e5dfd5",
          padding: "10px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.03)"
        }}>
          <svg ref={svgRef} width={560} height={460} style={{ display: "block" }} />
        </div>

        <TrajectoryTable
          points={points}
          results={results}
          onRemove={removePoint}
          onClearAll={clearPoints}
          React={React}
        />
      </div>
    </section>
  );
}