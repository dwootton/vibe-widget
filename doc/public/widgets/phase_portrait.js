import * as d3 from "https://esm.sh/d3@7";

// RK4 integrator for θ'' = -sin(θ) - c·θ'
// State: [θ, ω] where dθ/dt = ω, dω/dt = -sin(θ) - c*ω
function integrateTrajectory(theta0, omega0, c, dt = 0.02, tMax = 25) {
  const steps = Math.floor(tMax / dt);
  const path = [{ t: 0, theta: theta0, omega: omega0 }];
  let theta = theta0;
  let omega = omega0;

  const f = (th, om) => [om, -Math.sin(th) - c * om];

  // Target equilibria to test against: 0, 2π, -2π
  const targets = [0, 2 * Math.PI, -2 * Math.PI];
  let eqReached = null;
  let eqTime = null;

  for (let i = 0; i < steps; i++) {
    const t = (i + 1) * dt;

    const [k1_th, k1_om] = f(theta, omega);
    const [k2_th, k2_om] = f(theta + 0.5 * dt * k1_th, omega + 0.5 * dt * k1_om);
    const [k3_th, k3_om] = f(theta + 0.5 * dt * k2_th, omega + 0.5 * dt * k2_om);
    const [k4_th, k4_om] = f(theta + dt * k3_th, omega + dt * k3_om);

    theta += (dt / 6) * (k1_th + 2 * k2_th + 2 * k3_th + k4_th);
    omega += (dt / 6) * (k1_om + 2 * k2_om + 2 * k3_om + k4_om);

    path.push({ t, theta, omega });

    // Check if within 0.05 distance in (theta, omega) to any stable equilibrium
    // For damped pendulum, stable fixed points are (2kπ, 0)
    if (eqTime === null) {
      for (const eq of targets) {
        const d = Math.hypot(theta - eq, omega);
        if (d < 0.05) {
          eqReached = eq;
          eqTime = t;
          break;
        }
      }
    }
  }

  // Final equilibrium check if not detected along path or if it settled there
  if (eqReached === null) {
    let bestDist = Infinity;
    let bestEq = null;
    for (const eq of targets) {
      const d = Math.hypot(theta - eq, omega);
      if (d < bestDist) {
        bestDist = d;
        bestEq = eq;
      }
    }
    if (bestDist < 0.15) {
      eqReached = bestEq;
      eqTime = tMax;
    }
  }

  return { path, eqReached, eqTime };
}

// Fixed distinct ink palette for up to 12 dots
const PALETTE = [
  "#111111",
  "#d9480f",
  "#1971c2",
  "#2b8a3e",
  "#862e9c",
  "#e67700",
  "#099268",
  "#c92a2a",
  "#495057",
  "#5f3dc4",
  "#1098ad",
  "#a61e4d",
];

export const DampingSlider = ({ React, value, onChange }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 12,
        color: "#111111",
      }}
    >
      <span style={{ fontFamily: "ui-monospace, monospace" }}>c</span>
      <input
        type="range"
        min="0"
        max="1.5"
        step="0.01"
        value={value}
        onInput={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: 140, cursor: "pointer", accentColor: "#111111" }}
      />
      <span
        style={{
          fontFamily: "ui-monospace, monospace",
          width: 36,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value.toFixed(2)}
      </span>
    </div>
  );
};

export const TrajectoryTable = ({ dots }) => {
  const formatEq = (eq) => {
    if (eq === null || eq === undefined) return "—";
    if (Math.abs(eq) < 0.01) return "0";
    if (Math.abs(eq - 2 * Math.PI) < 0.1) return "+2π";
    if (Math.abs(eq + 2 * Math.PI) < 0.1) return "-2π";
    return (eq / Math.PI).toFixed(1) + "π";
  };

  return (
    <div
      style={{
        minWidth: 260,
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 12,
        color: "#111111",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "24px 44px 44px 50px 48px",
          borderBottom: "1px solid #111111",
          paddingBottom: 4,
          marginBottom: 4,
          fontSize: 11,
          color: "#777777",
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        }}
      >
        <span style={{ textAlign: "left" }}>#</span>
        <span style={{ textAlign: "right" }}>θ₀</span>
        <span style={{ textAlign: "right" }}>ω₀</span>
        <span style={{ textAlign: "right" }}>θ*</span>
        <span style={{ textAlign: "right" }}>t (s)</span>
      </div>
      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        {dots.map((d) => (
          <div
            key={d.id}
            style={{
              display: "grid",
              gridTemplateColumns: "24px 44px 44px 50px 48px",
              padding: "3px 0",
              borderBottom: "1px solid #f2f2f2",
              fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
              fontVariantNumeric: "tabular-nums",
              fontSize: 11,
            }}
          >
            <span style={{ color: d.color, fontWeight: 600 }}>{d.num}</span>
            <span style={{ textAlign: "right" }}>{d.theta0.toFixed(2)}</span>
            <span style={{ textAlign: "right" }}>{d.omega0.toFixed(2)}</span>
            <span style={{ textAlign: "right" }}>{formatEq(d.eqReached)}</span>
            <span style={{ textAlign: "right" }}>
              {d.eqTime != null ? d.eqTime.toFixed(1) : "—"}
            </span>
          </div>
        ))}
        {dots.length === 0 && (
          <div style={{ padding: "16px 0", color: "#777777", fontSize: 11 }}>
            0 points
          </div>
        )}
      </div>
    </div>
  );
};

export default function Widget({ model, React }) {
  const [damping, setDamping] = React.useState(0.25);
  const [dots, setDots] = React.useState([
    { id: 1, num: 1, theta0: 1.5, omega0: 0.0, color: PALETTE[0] },
    { id: 2, num: 2, theta0: -3.0, omega0: 2.0, color: PALETTE[1] },
  ]);

  const containerRef = React.useRef(null);
  const dotsRef = React.useRef(dots);
  dotsRef.current = dots;
  const dampingRef = React.useRef(damping);
  dampingRef.current = damping;

  // Initialize and sync outputs to Python
  React.useEffect(() => {
    const pts = dots.map((d) => ({ theta0: d.theta0, omega0: d.omega0 }));
    model.set("points", pts);
    model.set("damping", damping);
    model.save_changes();
  }, [dots, damping]);

  // Integrated computed trajectory cache
  const computedDots = React.useMemo(() => {
    return dots.map((d) => {
      const { path, eqReached, eqTime } = integrateTrajectory(
        d.theta0,
        d.omega0,
        damping
      );
      return {
        ...d,
        path,
        eqReached,
        eqTime,
      };
    });
  }, [dots, damping]);

  // SVG Chart Setup & Dynamic Updates
  React.useEffect(() => {
    if (!containerRef.current) return;

    const width = 500;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 30, left: 35 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    d3.select(containerRef.current).selectAll("*").remove();

    const svg = d3
      .select(containerRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("display", "block")
      .style("user-select", "none")
      .style("cursor", "crosshair");

    // Defs for arrowhead
    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "vf-arrow")
      .attr("viewBox", "0 0 6 6")
      .attr("refX", 5)
      .attr("refY", 3)
      .attr("markerWidth", 4)
      .attr("markerHeight", 4)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M 0 1.5 L 4.5 3 L 0 4.5 z")
      .attr("fill", "#c5c5c5");

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scaleLinear()
      .domain([-2 * Math.PI, 2 * Math.PI])
      .range([0, innerW]);

    const yScale = d3.scaleLinear().domain([-5, 5]).range([innerH, 0]);

    // Grid hairlines
    const xTicks = [-2 * Math.PI, -Math.PI, 0, Math.PI, 2 * Math.PI];
    const xTickLabels = ["-2π", "-π", "0", "π", "2π"];

    // Axes
    const xAxis = d3
      .axisBottom(xScale)
      .tickValues(xTicks)
      .tickFormat((d, i) => xTickLabels[i])
      .tickSize(-innerH);

    const yAxis = d3
      .axisLeft(yScale)
      .ticks(5)
      .tickSize(-innerW);

    const axisXG = g
      .append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(xAxis);

    const axisYG = g.append("g").call(yAxis);

    axisXG.select(".domain").attr("stroke", "#111111").attr("stroke-width", 1);
    axisYG.select(".domain").attr("stroke", "#111111").attr("stroke-width", 1);

    axisXG
      .selectAll(".tick line")
      .attr("stroke", "#f0f0f0")
      .attr("stroke-width", 1);
    axisYG
      .selectAll(".tick line")
      .attr("stroke", "#f0f0f0")
      .attr("stroke-width", 1);

    axisXG
      .selectAll(".tick text")
      .attr("fill", "#111111")
      .attr("font-family", "ui-monospace, monospace")
      .attr("font-size", 10)
      .attr("dy", 12);

    axisYG
      .selectAll(".tick text")
      .attr("fill", "#111111")
      .attr("font-family", "ui-monospace, monospace")
      .attr("font-size", 10)
      .attr("dx", -4);

    // Axis labels: θ and ω
    g.append("text")
      .attr("x", innerW)
      .attr("y", innerH - 6)
      .attr("text-anchor", "end")
      .attr("font-family", "ui-monospace, monospace")
      .attr("font-size", 11)
      .attr("fill", "#777777")
      .text("θ");

    g.append("text")
      .attr("x", 6)
      .attr("y", 12)
      .attr("font-family", "ui-monospace, monospace")
      .attr("font-size", 11)
      .attr("fill", "#777777")
      .text("ω");

    // Center axes (0 lines)
    g.append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", yScale(0))
      .attr("y2", yScale(0))
      .attr("stroke", "#d9d9d9")
      .attr("stroke-width", 1);

    g.append("line")
      .attr("x1", xScale(0))
      .attr("x2", xScale(0))
      .attr("y1", 0)
      .attr("y2", innerH)
      .attr("stroke", "#d9d9d9")
      .attr("stroke-width", 1);

    // Direction field layer
    const vfGroup = g.append("g").attr("class", "vf-layer");

    // Trajectories layer
    const trajGroup = g.append("g").attr("class", "traj-layer");

    // Dots layer
    const dotsGroup = g.append("g").attr("class", "dots-layer");

    // Clip path for trajectories and vector field
    svg
      .append("clipPath")
      .attr("id", "plot-clip")
      .append("rect")
      .attr("width", innerW)
      .attr("height", innerH);

    trajGroup.attr("clip-path", "url(#plot-clip)");
    vfGroup.attr("clip-path", "url(#plot-clip)");

    // Render vector field arrows
    const renderVectorField = (cVal) => {
      vfGroup.selectAll("*").remove();

      const nx = 21;
      const ny = 17;
      const thStep = (4 * Math.PI) / (nx - 1);
      const omStep = 10 / (ny - 1);

      for (let i = 0; i < nx; i++) {
        const th = -2 * Math.PI + i * thStep;
        for (let j = 0; j < ny; j++) {
          const om = -5 + j * omStep;

          const dth = om;
          const dom = -Math.sin(th) - cVal * om;
          const mag = Math.hypot(dth, dom);

          if (mag < 1e-6) continue;

          // Normalized step scaled in pixels
          const u = dth / mag;
          const v = dom / mag;

          const px0 = xScale(th);
          const py0 = yScale(om);
          const len = 9; // arrow length

          // Account for yScale invert
          const px1 = px0 + u * len;
          const py1 = py0 - v * len;

          vfGroup
            .append("line")
            .attr("x1", px0 - u * (len * 0.4))
            .attr("y1", py0 + v * (len * 0.4))
            .attr("x2", px1)
            .attr("y2", py1)
            .attr("stroke", "#c5c5c5")
            .attr("stroke-width", 1)
            .attr("marker-end", "url(#vf-arrow)");
        }
      }
    };

    renderVectorField(dampingRef.current);

    // Path generator
    const lineGen = d3
      .line()
      .x((d) => xScale(d.theta))
      .y((d) => yScale(d.omega));

    // Trajectory renderer
    const renderTrajectoriesAndDots = (currentDots, currentDamping) => {
      trajGroup.selectAll("*").remove();
      dotsGroup.selectAll("*").remove();

      currentDots.forEach((d) => {
        const res = integrateTrajectory(d.theta0, d.omega0, currentDamping);

        trajGroup
          .append("path")
          .datum(res.path)
          .attr("fill", "none")
          .attr("stroke", d.color)
          .attr("stroke-width", 1.5)
          .attr("stroke-opacity", 0.85)
          .attr("d", lineGen);

        const px = xScale(d.theta0);
        const py = yScale(d.omega0);

        const node = dotsGroup
          .append("g")
          .attr("class", `dot-node-${d.id}`)
          .attr("transform", `translate(${px},${py})`)
          .style("cursor", "grab");

        // Transparent hit area for drag and dblclick
        node
          .append("circle")
          .attr("r", 14)
          .attr("fill", "transparent");

        // Visible dot
        node
          .append("circle")
          .attr("r", 4.5)
          .attr("fill", d.color)
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 1.5);

        // Dot label number
        node
          .append("text")
          .attr("dx", 7)
          .attr("dy", 3.5)
          .attr("font-family", "ui-monospace, monospace")
          .attr("font-size", 10)
          .attr("font-weight", 600)
          .attr("fill", d.color)
          .text(d.num);

        // Drag behavior
        const dragBehavior = d3
          .drag()
          .on("start", function () {
            d3.select(this).style("cursor", "grabbing");
          })
          .on("drag", function (event) {
            const [mx, my] = d3.pointer(event, g.node());
            const clampedX = Math.max(0, Math.min(innerW, mx));
            const clampedY = Math.max(0, Math.min(innerH, my));
            const nextTh = xScale.invert(clampedX);
            const nextOm = yScale.invert(clampedY);

            // Imperative live update of this dot & its trajectory
            d3.select(this).attr(
              "transform",
              `translate(${clampedX},${clampedY})`
            );

            // Re-render all trajectories live
            const updated = dotsRef.current.map((item) =>
              item.id === d.id
                ? { ...item, theta0: nextTh, omega0: nextOm }
                : item
            );
            dotsRef.current = updated;

            trajGroup.selectAll("*").remove();
            updated.forEach((pt) => {
              const rk = integrateTrajectory(
                pt.theta0,
                pt.omega0,
                dampingRef.current
              );
              trajGroup
                .append("path")
                .datum(rk.path)
                .attr("fill", "none")
                .attr("stroke", pt.color)
                .attr("stroke-width", 1.5)
                .attr("stroke-opacity", 0.85)
                .attr("d", lineGen);
            });
          })
          .on("end", function () {
            d3.select(this).style("cursor", "grab");
            setDots([...dotsRef.current]);
          });

        node.call(dragBehavior);

        // Double click to remove dot
        node.on("dblclick", (e) => {
          e.stopPropagation();
          const next = dotsRef.current.filter((item) => item.id !== d.id);
          setDots(next);
        });
      });
    };

    renderTrajectoriesAndDots(dotsRef.current, dampingRef.current);

    // Click anywhere on plot group to add a starting point (up to 12)
    svg.on("click", (event) => {
      // Check if target is background
      if (dotsRef.current.length >= 12) return;
      const [mx, my] = d3.pointer(event, g.node());
      if (mx < 0 || mx > innerW || my < 0 || my > innerH) return;

      const th0 = xScale.invert(mx);
      const om0 = yScale.invert(my);

      // Determine lowest available dot number
      const usedNums = new Set(dotsRef.current.map((d) => d.num));
      let nextNum = 1;
      while (usedNums.has(nextNum)) nextNum++;

      const newDot = {
        id: Date.now() + Math.random(),
        num: nextNum,
        theta0: th0,
        omega0: om0,
        color: PALETTE[(nextNum - 1) % PALETTE.length],
      };

      setDots([...dotsRef.current, newDot]);
    });

    return () => {
      svg.remove();
    };
  }, []); // Chart shell created once

  // Update trajectories when dots or damping changes
  React.useEffect(() => {
    if (!containerRef.current) return;
    const g = d3.select(containerRef.current).select("g");
    if (g.empty()) return;

    const innerW = 500 - 35 - 20;
    const innerH = 400 - 20 - 30;

    const xScale = d3
      .scaleLinear()
      .domain([-2 * Math.PI, 2 * Math.PI])
      .range([0, innerW]);

    const yScale = d3.scaleLinear().domain([-5, 5]).range([innerH, 0]);

    const lineGen = d3
      .line()
      .x((d) => xScale(d.theta))
      .y((d) => yScale(d.omega));

    // Update vector field
    const vfGroup = g.select(".vf-layer");
    vfGroup.selectAll("*").remove();

    const nx = 21;
    const ny = 17;
    const thStep = (4 * Math.PI) / (nx - 1);
    const omStep = 10 / (ny - 1);
    const cVal = damping;

    for (let i = 0; i < nx; i++) {
      const th = -2 * Math.PI + i * thStep;
      for (let j = 0; j < ny; j++) {
        const om = -5 + j * omStep;

        const dth = om;
        const dom = -Math.sin(th) - cVal * om;
        const mag = Math.hypot(dth, dom);

        if (mag < 1e-6) continue;

        const u = dth / mag;
        const v = dom / mag;

        const px0 = xScale(th);
        const py0 = yScale(om);
        const len = 9;

        const px1 = px0 + u * len;
        const py1 = py0 - v * len;

        vfGroup
          .append("line")
          .attr("x1", px0 - u * (len * 0.4))
          .attr("y1", py0 + v * (len * 0.4))
          .attr("x2", px1)
          .attr("y2", py1)
          .attr("stroke", "#c5c5c5")
          .attr("stroke-width", 1)
          .attr("marker-end", "url(#vf-arrow)");
      }
    }

    // Update trajectories and dots
    const trajGroup = g.select(".traj-layer");
    const dotsGroup = g.select(".dots-layer");
    trajGroup.selectAll("*").remove();
    dotsGroup.selectAll("*").remove();

    dots.forEach((d) => {
      const res = integrateTrajectory(d.theta0, d.omega0, damping);

      trajGroup
        .append("path")
        .datum(res.path)
        .attr("fill", "none")
        .attr("stroke", d.color)
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.85)
        .attr("d", lineGen);

      const px = xScale(d.theta0);
      const py = yScale(d.omega0);

      const node = dotsGroup
        .append("g")
        .attr("class", `dot-node-${d.id}`)
        .attr("transform", `translate(${px},${py})`)
        .style("cursor", "grab");

      node.append("circle").attr("r", 14).attr("fill", "transparent");

      node
        .append("circle")
        .attr("r", 4.5)
        .attr("fill", d.color)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1.5);

      node
        .append("text")
        .attr("dx", 7)
        .attr("dy", 3.5)
        .attr("font-family", "ui-monospace, monospace")
        .attr("font-size", 10)
        .attr("font-weight", 600)
        .attr("fill", d.color)
        .text(d.num);

      const dragBehavior = d3
        .drag()
        .on("start", function () {
          d3.select(this).style("cursor", "grabbing");
        })
        .on("drag", function (event) {
          const [mx, my] = d3.pointer(event, g.node());
          const clampedX = Math.max(0, Math.min(innerW, mx));
          const clampedY = Math.max(0, Math.min(innerH, my));
          const nextTh = xScale.invert(clampedX);
          const nextOm = yScale.invert(clampedY);

          d3.select(this).attr(
            "transform",
            `translate(${clampedX},${clampedY})`
          );

          const updated = dotsRef.current.map((item) =>
            item.id === d.id
              ? { ...item, theta0: nextTh, omega0: nextOm }
              : item
          );
          dotsRef.current = updated;

          trajGroup.selectAll("*").remove();
          updated.forEach((pt) => {
            const rk = integrateTrajectory(
              pt.theta0,
              pt.omega0,
              dampingRef.current
            );
            trajGroup
              .append("path")
              .datum(rk.path)
              .attr("fill", "none")
              .attr("stroke", pt.color)
              .attr("stroke-width", 1.5)
              .attr("stroke-opacity", 0.85)
              .attr("d", lineGen);
          });
        })
        .on("end", function () {
          d3.select(this).style("cursor", "grab");
          setDots([...dotsRef.current]);
        });

      node.call(dragBehavior);

      node.on("dblclick", (e) => {
        e.stopPropagation();
        const next = dotsRef.current.filter((item) => item.id !== d.id);
        setDots(next);
      });
    });
  }, [dots, damping]);

  return (
    <div
      style={{
        padding: 12,
        background: "#ffffff",
        color: "#111111",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 820,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #d9d9d9",
          paddingBottom: 8,
        }}
      >
        <DampingSlider React={React} value={damping} onChange={setDamping} />
        <span
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            color: "#777777",
          }}
        >
          {dots.length}/12 dots
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        <div ref={containerRef} style={{ width: 500, height: 400 }} />
        <div
          style={{
            borderLeft: "1px solid #d9d9d9",
            paddingLeft: 16,
            height: 400,
            overflowY: "auto",
          }}
        >
          <TrajectoryTable dots={computedDots} />
        </div>
      </div>
    </div>
  );
}