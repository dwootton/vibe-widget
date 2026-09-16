import * as L from "https://esm.sh/leaflet@1.9.4";

// Clock dial component
export const ClockDial = ({ React, hours, minutes, onTimeChange, onFocus, onBlur, focused }) => {
  const svgRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);

  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 55;

  const totalMinutes = hours * 60 + minutes;
  const angle = (totalMinutes / (24 * 60)) * 360 - 90;

  const handLength = radius - 10;
  const handX = cx + handLength * Math.cos(angle * Math.PI / 180);
  const handY = cy + handLength * Math.sin(angle * Math.PI / 180);

  const formatTime = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  const handleMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleMouseMove = React.useCallback((e) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - cx;
    const y = e.clientY - rect.top - cy;
    let newAngle = Math.atan2(y, x) * 180 / Math.PI + 90;
    if (newAngle < 0) newAngle += 360;
    const newTotalMinutes = Math.round((newAngle / 360) * 24 * 60 / 15) * 15;
    const newHours = Math.floor(newTotalMinutes / 60) % 24;
    const newMins = newTotalMinutes % 60;
    onTimeChange(newHours, newMins);
  }, [dragging, onTimeChange]);

  const handleMouseUp = React.useCallback(() => setDragging(false), []);

  React.useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return () => {};
  }, [dragging, handleMouseMove, handleMouseUp]);

  const hourMarkers = [];
  for (let h = 0; h < 24; h += 2) {
    const markerAngle = (h / 24) * 360 - 90;
    const innerR = radius - 8;
    const outerR = radius;
    const x1 = cx + innerR * Math.cos(markerAngle * Math.PI / 180);
    const y1 = cy + innerR * Math.sin(markerAngle * Math.PI / 180);
    const x2 = cx + outerR * Math.cos(markerAngle * Math.PI / 180);
    const y2 = cy + outerR * Math.sin(markerAngle * Math.PI / 180);
    hourMarkers.push(
      <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#666" strokeWidth={h % 6 === 0 ? 2 : 1} />
    );
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', outline: 'none' }}
      tabIndex={0}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <svg ref={svgRef} width={size} height={size} style={{ cursor: dragging ? 'grabbing' : 'pointer' }}>
        <circle cx={cx} cy={cy} r={radius} fill="#f8f9fa" stroke={focused ? "#2563eb" : "#ccc"} strokeWidth={focused ? 3 : 2} />
        {hourMarkers}
        <text x={cx} y={cy - radius + 18} textAnchor="middle" fontSize="10" fill="#333">0</text>
        <text x={cx + radius - 16} y={cy + 4} textAnchor="middle" fontSize="10" fill="#333">6</text>
        <text x={cx} y={cy + radius - 8} textAnchor="middle" fontSize="10" fill="#333">12</text>
        <text x={cx - radius + 16} y={cy + 4} textAnchor="middle" fontSize="10" fill="#333">18</text>
        <line x1={cx} y1={cy} x2={handX} y2={handY} stroke="#2563eb" strokeWidth={4} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={6} fill="#2563eb" />
        <circle cx={handX} cy={handY} r={10} fill="#2563eb" stroke="#fff" strokeWidth={2} style={{ cursor: 'grab' }} onMouseDown={handleMouseDown} />
      </svg>
      <div style={{ marginTop: 6, fontSize: 20, fontWeight: 'bold', fontFamily: 'monospace', color: '#1a1a1a' }}>
        {formatTime(hours, minutes)}
      </div>
    </div>
  );
};

// Day buttons component
export const DayButtons = ({ React, selectedDay, onDayChange }) => {
  const days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  return (
    <div style={{ display: 'flex', gap: 2, marginTop: 8, justifyContent: 'center' }}>
      {days.map((day, idx) => (
        <button
          key={day}
          onClick={() => onDayChange(idx)}
          style={{
            width: 28, height: 24, padding: 0, fontSize: 10,
            fontWeight: selectedDay === idx ? 'bold' : 'normal',
            background: selectedDay === idx ? '#2563eb' : '#e5e7eb',
            color: selectedDay === idx ? '#fff' : '#333',
            border: 'none', borderRadius: 3, cursor: 'pointer'
          }}
        >
          {day}
        </button>
      ))}
    </div>
  );
};

// Parse OSM hours string
function parseOsmHours(hoursStr) {
  if (!hoursStr) return null;
  if (hoursStr === '24/7') return { type: '24/7' };
  const dayMap = { 'Mo': 0, 'Tu': 1, 'We': 2, 'Th': 3, 'Fr': 4, 'Sa': 5, 'Su': 6 };
  const rules = [];
  const parts = hoursStr.split(';').map(s => s.trim());
  for (const part of parts) {
    const match = part.match(/^(?:([A-Za-z,-]+)\s+)?(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    if (!match) continue;
    const [, dayPart, openTime, closeTime] = match;
    const openMin = parseInt(openTime.split(':')[0]) * 60 + parseInt(openTime.split(':')[1]);
    const closeMin = parseInt(closeTime.split(':')[0]) * 60 + parseInt(closeTime.split(':')[1]);
    let days = [];
    if (!dayPart) {
      days = [0, 1, 2, 3, 4, 5, 6];
    } else {
      const dayRanges = dayPart.split(',');
      for (const range of dayRanges) {
        const rangeMatch = range.match(/^([A-Za-z]{2})(?:-([A-Za-z]{2}))?$/);
        if (rangeMatch) {
          const startDay = dayMap[rangeMatch[1]];
          const endDay = rangeMatch[2] ? dayMap[rangeMatch[2]] : startDay;
          if (startDay !== undefined && endDay !== undefined) {
            for (let d = startDay; d !== (endDay + 1) % 7; d = (d + 1) % 7) {
              days.push(d);
              if (d === endDay) break;
            }
          }
        }
      }
    }
    rules.push({ days, openMin, closeMin });
  }
  return rules.length > 0 ? { type: 'schedule', rules } : null;
}

function isOpenAt(parsed, dayIdx, timeMin) {
  if (!parsed) return null;
  if (parsed.type === '24/7') return true;
  for (const rule of parsed.rules) {
    if (rule.days.includes(dayIdx)) {
      if (timeMin >= rule.openMin && timeMin < rule.closeMin) return true;
    }
  }
  return false;
}

function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// Region table component
export const RegionTable = ({ React, regions, data, selectedDay, leaveHours, leaveMinutes, hoveredRegion, onHoverRegion }) => {
  const regionNames = Object.keys(regions).sort();
  if (regionNames.length === 0) {
    return (
      <div style={{ padding: '12px', color: '#666', fontSize: 12, fontStyle: 'italic', textAlign: 'center' }}>
        Shift+drag on the map to draw lasso regions
      </div>
    );
  }
  const leaveTotalMin = leaveHours * 60 + leaveMinutes;
  const getRegionStats = (regionData) => {
    const regionIndices = regionData.indices || [];
    const shops = regionIndices.map(idx => data[idx]).filter(Boolean);
    const nShops = shops.length;
    const nIndependent = shops.filter(s => !s.chain).length;
    let nOpen = 0;
    let earliestArrival = null;
    shops.forEach(shop => {
      const arrivalMin = (leaveTotalMin + (shop.bike_min || 0)) % (24 * 60);
      const parsed = parseOsmHours(shop.hours);
      const openStatus = isOpenAt(parsed, selectedDay, arrivalMin);
      if (openStatus === true) {
        nOpen++;
        if (earliestArrival === null || arrivalMin < earliestArrival) earliestArrival = arrivalMin;
      }
    });
    let earliestFormatted = '-';
    if (earliestArrival !== null) {
      const h = Math.floor(earliestArrival / 60);
      const m = earliestArrival % 60;
      earliestFormatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return { nShops, nIndependent, nOpen, earliestFormatted };
  };
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'system-ui, sans-serif' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #ddd' }}>
          <th style={{ padding: '6px 8px', textAlign: 'left', color: '#333', fontWeight: 600 }}>Region</th>
          <th style={{ padding: '6px 8px', textAlign: 'right', color: '#333', fontWeight: 600 }}>Shops</th>
          <th style={{ padding: '6px 8px', textAlign: 'right', color: '#333', fontWeight: 600 }}>Indep.</th>
          <th style={{ padding: '6px 8px', textAlign: 'right', color: '#333', fontWeight: 600 }}>Open</th>
          <th style={{ padding: '6px 8px', textAlign: 'right', color: '#333', fontWeight: 600 }}>Earliest</th>
        </tr>
      </thead>
      <tbody>
        {regionNames.map(name => {
          const stats = getRegionStats(regions[name]);
          const isHovered = hoveredRegion === name;
          return (
            <tr
              key={name}
              onMouseEnter={() => onHoverRegion(name)}
              onMouseLeave={() => onHoverRegion(null)}
              style={{ borderBottom: '1px solid #eee', background: isHovered ? '#e0f2fe' : 'transparent', cursor: 'pointer' }}
            >
              <td style={{ padding: '6px 8px', fontWeight: 600, color: '#2563eb' }}>{name}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1a1a1a' }}>{stats.nShops}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#ff8c00' }}>{stats.nIndependent}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#16a34a' }}>{stats.nOpen}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#1a1a1a' }}>{stats.earliestFormatted}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

// Draggable/reorderable route list with drag handles
export const RouteList = ({ React, route, data, legs, leaveHours, leaveMinutes, highlighted, onReorder, onHighlight, onRemove }) => {
  const [dragIdx, setDragIdx] = React.useState(null);
  const [overIdx, setOverIdx] = React.useState(null);

  if (route.length === 0) {
    return (
      <div style={{ padding: '12px', color: '#666', fontSize: 12, fontStyle: 'italic', textAlign: 'center' }}>
        Click shops on the map to pin them and build a route
      </div>
    );
  }

  const STOP_TIME = 10;
  const leaveTotalMin = leaveHours * 60 + leaveMinutes;

  const formatTime = (totalMin) => {
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  let cumulativeMin = 0;
  const stops = route.map((shopIdx, i) => {
    const shop = data[shopIdx];
    const fromIdx = i === 0 ? 0 : route[i - 1] + 1;
    const toIdx = shopIdx + 1;
    const legMin = legs[fromIdx] && legs[fromIdx][toIdx] != null ? legs[fromIdx][toIdx] : null;
    if (legMin != null) cumulativeMin += legMin;
    const arrivalMin = leaveTotalMin + cumulativeMin;
    if (i < route.length - 1) cumulativeMin += STOP_TIME;
    return { idx: shopIdx, name: shop ? shop.name : `#${shopIdx}`, legMin, arrivalTime: formatTime(arrivalMin), stopNum: i + 1 };
  });

  const totalTravelMin = stops.reduce((sum, s) => sum + (s.legMin || 0), 0);
  const totalStopMin = (route.length - 1) * STOP_TIME;
  const totalMin = totalTravelMin + totalStopMin;

  const handleDrop = (targetPos) => {
    if (dragIdx === null || dragIdx === targetPos) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const newRoute = [...route];
    const [moved] = newRoute.splice(dragIdx, 1);
    let insertAt = targetPos;
    if (dragIdx < targetPos) insertAt = targetPos - 1;
    newRoute.splice(insertAt, 0, moved);
    onReorder(newRoute);
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div>
      <div style={{ border: '1px solid #eee', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ display: 'flex', padding: '6px 8px', borderBottom: '2px solid #ddd', fontSize: 12, fontWeight: 600, color: '#333', background: '#fafafa' }}>
          <div style={{ width: 24 }}></div>
          <div style={{ width: 30, textAlign: 'center' }}>#</div>
          <div style={{ flex: 1 }}>Shop</div>
          <div style={{ width: 60, textAlign: 'right' }}>Leg</div>
          <div style={{ width: 60, textAlign: 'right' }}>Arrive</div>
          <div style={{ width: 24 }}></div>
        </div>
        {stops.map((stop, pos) => {
          const isHighlighted = highlighted === stop.idx;
          const isOver = overIdx === pos && dragIdx !== null && dragIdx !== pos;
          return (
            <div
              key={stop.idx}
              onDragOver={(e) => { e.preventDefault(); setOverIdx(pos); }}
              onDrop={(e) => { e.preventDefault(); handleDrop(pos); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 8px',
                borderBottom: '1px solid #eee',
                fontSize: 12,
                background: isHighlighted ? '#fee2e2' : (isOver ? '#e0f2fe' : (dragIdx === pos ? '#f3f4f6' : 'transparent')),
                borderTop: isOver ? '2px solid #2563eb' : '2px solid transparent',
                cursor: 'pointer'
              }}
              onClick={() => onHighlight(isHighlighted ? null : stop.idx)}
            >
              <div
                draggable
                onDragStart={(e) => { setDragIdx(pos); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                title="Drag to reorder"
                style={{ width: 24, cursor: 'grab', color: '#888', fontSize: 14, textAlign: 'center', userSelect: 'none' }}
                onClick={(e) => e.stopPropagation()}
              >
                ⠿
              </div>
              <div style={{ width: 30, textAlign: 'center', fontWeight: 700, color: isHighlighted ? '#e11d48' : '#2563eb' }}>{stop.stopNum}</div>
              <div style={{ flex: 1, color: '#1a1a1a', fontWeight: isHighlighted ? 700 : 400 }}>{stop.name}</div>
              <div style={{ width: 60, textAlign: 'right', color: '#666', fontFamily: 'monospace' }}>
                {stop.legMin != null ? `${stop.legMin} min` : '—'}
              </div>
              <div style={{ width: 60, textAlign: 'right', color: '#16a34a', fontWeight: 600, fontFamily: 'monospace' }}>{stop.arrivalTime}</div>
              <div style={{ width: 24, textAlign: 'center' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(stop.idx); }}
                  title="Remove stop"
                  style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, padding: '8px 12px', background: '#f0f9ff', borderRadius: 4, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span style={{ color: '#333' }}>
          <strong>Total:</strong> {totalMin} min ({totalTravelMin} travel + {totalStopMin} stops)
        </span>
        <span style={{ color: '#2563eb', fontWeight: 600 }}>
          Return: {formatTime(leaveTotalMin + totalMin)}
        </span>
      </div>
      {highlighted != null && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#e11d48', textAlign: 'center' }}>
          Pin #{route.indexOf(highlighted) + 1} highlighted — Delete to remove · ← → to jump to nearest shop
        </div>
      )}
    </div>
  );
};

export default function Widget({ model, React }) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const circleRef = React.useRef(null);
  const markersRef = React.useRef([]);
  const labelRef = React.useRef(null);
  const isoLayersRef = React.useRef([]);
  const regionsLayerRef = React.useRef({});
  const lassoLayerRef = React.useRef(null);
  const routeLayerRef = React.useRef(null);
  const pinMarkersRef = React.useRef([]);
  const legLabelsRef = React.useRef([]);
  const dragStateRef = React.useRef({ active: false, pinPos: -1 });

  const data = model.get("data") || [];
  const legs = model.get("legs") || [];
  const isochrones = model.get("isochrones") || {};

  const [radiusKm, setRadiusKm] = React.useState(3.5);
  const [leaveHours, setLeaveHours] = React.useState(6);
  const [leaveMinutes, setLeaveMinutes] = React.useState(30);
  const [selectedDay, setSelectedDay] = React.useState(1);
  const [clockFocused, setClockFocused] = React.useState(false);
  const [stats, setStats] = React.useState({ inside: 0, independent: 0, open: 0 });
  const [regions, setRegions] = React.useState({});
  const [hoveredRegion, setHoveredRegion] = React.useState(null);
  const [route, setRoute] = React.useState([]);
  const [highlighted, setHighlighted] = React.useState(null);

  // Refs mirroring live state for use in map event handlers / drag
  const routeRef = React.useRef(route);
  const highlightRef = React.useRef(highlighted);
  const radiusRef = React.useRef(radiusKm);
  const dayRef = React.useRef(selectedDay);
  const leaveHRef = React.useRef(leaveHours);
  const leaveMRef = React.useRef(leaveMinutes);
  React.useEffect(() => { routeRef.current = route; }, [route]);
  React.useEffect(() => { highlightRef.current = highlighted; }, [highlighted]);
  React.useEffect(() => { radiusRef.current = radiusKm; }, [radiusKm]);
  React.useEffect(() => { dayRef.current = selectedDay; }, [selectedDay]);
  React.useEffect(() => { leaveHRef.current = leaveHours; }, [leaveHours]);
  React.useEffect(() => { leaveMRef.current = leaveMinutes; }, [leaveMinutes]);

  const hotelLat = 29.7522;
  const hotelLon = -95.3578;

  const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Nearest shop (by geographic distance) not already in the route
  const nearestShopNotInRoute = React.useCallback((shopIdx, currentRoute, direction) => {
    const origin = data[shopIdx];
    if (!origin) return null;
    const candidates = [];
    data.forEach((shop, idx) => {
      if (idx === shopIdx) return;
      if (currentRoute.includes(idx)) return;
      const d = getDistanceKm(origin.lat, origin.lon, shop.lat, shop.lon);
      candidates.push({ idx, d });
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.d - b.d);
    // direction: +1 -> next nearest, -1 -> previous (wrap)
    if (direction < 0) {
      return candidates[0].idx; // simplest: nearest either way; but for left we pick nearest too
    }
    return candidates[0].idx;
  }, [data]);

  const handleTimeChange = React.useCallback((h, m) => {
    setLeaveHours(h);
    setLeaveMinutes(m);
  }, []);

  // Clock keyboard nav (only when clock focused)
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (!clockFocused) return;
      let totalMin = leaveHours * 60 + leaveMinutes;
      if (e.key === 'ArrowLeft') {
        totalMin = (totalMin - 15 + 24 * 60) % (24 * 60);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        totalMin = (totalMin + 15) % (24 * 60);
        e.preventDefault();
      } else {
        return;
      }
      setLeaveHours(Math.floor(totalMin / 60));
      setLeaveMinutes(totalMin % 60);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clockFocused, leaveHours, leaveMinutes]);

  // Highlighted pin keyboard: Delete removes, arrows jump to nearest shop
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (highlighted == null) return;
      if (clockFocused) return; // clock owns arrows when focused

      const currentRoute = routeRef.current;
      const pos = currentRoute.indexOf(highlighted);
      if (pos < 0) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const newRoute = [...currentRoute.slice(0, pos), ...currentRoute.slice(pos + 1)];
        setRoute(newRoute);
        setHighlighted(null);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const routeWithoutSelf = currentRoute.filter(i => i !== highlighted);
        const target = nearestShopNotInRoute(highlighted, routeWithoutSelf, dir);
        if (target != null) {
          const newRoute = [...currentRoute];
          newRoute[pos] = target;
          setRoute(newRoute);
          setHighlighted(target);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [highlighted, clockFocused, nearestShopNotInRoute]);

  const updateAll = React.useCallback((radius, day, leaveH, leaveM) => {
    const insideIndices = [];
    const openIndices = [];
    let independentCount = 0;
    let openCount = 0;
    const leaveTotalMin = leaveH * 60 + leaveM;
    data.forEach((shop, idx) => {
      const dist = getDistanceKm(hotelLat, hotelLon, shop.lat, shop.lon);
      if (dist <= radius) {
        insideIndices.push(idx);
        if (!shop.chain) independentCount++;
        const arrivalMin = (leaveTotalMin + (shop.bike_min || 0)) % (24 * 60);
        const parsed = parseOsmHours(shop.hours);
        const open = isOpenAt(parsed, day, arrivalMin);
        if (open === true) {
          openCount++;
          openIndices.push(idx);
        }
      }
    });
    setStats({ inside: insideIndices.length, independent: independentCount, open: openCount });
    return { insideIndices, openIndices };
  }, [data]);

  const updateMarkers = React.useCallback((radius, day, leaveH, leaveM, currentRoute, highlightIdx) => {
    const leaveTotalMin = leaveH * 60 + leaveM;
    markersRef.current.forEach(({ marker, label, shop, idx }) => {
      const dist = getDistanceKm(hotelLat, hotelLon, shop.lat, shop.lon);
      const isInside = dist <= radius;
      const isPinned = currentRoute.includes(idx);
      const isHi = highlightIdx === idx;

      const arrivalMin = (leaveTotalMin + (shop.bike_min || 0)) % (24 * 60);
      const arrivalH = Math.floor(arrivalMin / 60);
      const arrivalM = arrivalMin % 60;
      const arrivalFormatted = `${String(arrivalH).padStart(2, '0')}:${String(arrivalM).padStart(2, '0')}`;

      const parsed = parseOsmHours(shop.hours);
      const openStatus = isOpenAt(parsed, day, arrivalMin);

      let fillColor, strokeColor, fillOpacity, dashArray, labelColor;
      if (openStatus === true) {
        fillColor = shop.chain ? '#888' : '#ff8c00';
        fillOpacity = isInside ? 0.9 : 0.3;
        dashArray = null;
        labelColor = '#16a34a';
      } else if (openStatus === false) {
        fillColor = 'transparent';
        fillOpacity = 0;
        dashArray = null;
        labelColor = '#dc2626';
      } else {
        fillColor = 'transparent';
        fillOpacity = 0;
        dashArray = '3,3';
        labelColor = '#666';
      }
      strokeColor = shop.chain ? '#888' : '#ff8c00';
      if (isPinned) {
        strokeColor = '#e11d48';
        fillOpacity = fillOpacity > 0 ? 1 : 0;
      }
      marker.setStyle({
        fillColor: fillColor,
        fillOpacity: fillOpacity,
        radius: isHi ? 11 : (isInside ? 8 : 5),
        color: isHi ? '#7c1d3e' : strokeColor,
        weight: isHi ? 4 : (isPinned ? 3 : (isInside ? 2 : 1)),
        dashArray: dashArray,
        opacity: isInside ? 1 : 0.4
      });

      if (label && isInside) {
        label.setLatLng([shop.lat, shop.lon]);
        const el = label.getElement();
        if (el) {
          el.innerHTML = arrivalFormatted;
          el.style.color = labelColor;
          el.style.display = 'block';
        }
      } else if (label) {
        const el = label.getElement();
        if (el) el.style.display = 'none';
      }
    });
  }, []);

  const updateLabel = React.useCallback((radius) => {
    if (!labelRef.current || !mapRef.current) return;
    const center = L.latLng(hotelLat, hotelLon);
    const angle = 45 * Math.PI / 180;
    const earthRadius = 6371000;
    const angularDist = (radius * 1000) / earthRadius;
    const lat1 = center.lat * Math.PI / 180;
    const lon1 = center.lng * Math.PI / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angularDist) +
                          Math.cos(lat1) * Math.sin(angularDist) * Math.cos(angle));
    const lon2 = lon1 + Math.atan2(Math.sin(angle) * Math.sin(angularDist) * Math.cos(lat1),
                                    Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2));
    const edgeLat = lat2 * 180 / Math.PI;
    const edgeLon = lon2 * 180 / Math.PI;
    labelRef.current.setLatLng([edgeLat, edgeLon]);
    labelRef.current.setContent(`<div style="background:#fff;padding:2px 6px;border-radius:3px;font-weight:bold;border:1px solid #333;white-space:nowrap">${radius.toFixed(1)} km</div>`);
  }, []);

  const findShopsInPolygon = React.useCallback((polygon) => {
    const indices = [];
    data.forEach((shop, idx) => {
      if (pointInPolygon([shop.lon, shop.lat], polygon)) indices.push(idx);
    });
    return indices;
  }, [data]);

  // Compute route geometry/leg mins for a hypothetical route (used during drag)
  const buildRoutePoints = React.useCallback((currentRoute) => {
    const points = [[hotelLat, hotelLon]];
    currentRoute.forEach(shopIdx => {
      const shop = data[shopIdx];
      if (shop) points.push([shop.lat, shop.lon]);
    });
    return points;
  }, [data]);

  // Render route polyline, leg labels, and DRAGGABLE numbered pins
  const updateRouteLayer = React.useCallback((currentRoute, highlightIdx) => {
    const map = mapRef.current;
    if (!map) return;

    if (routeLayerRef.current) { routeLayerRef.current.remove(); routeLayerRef.current = null; }
    pinMarkersRef.current.forEach(m => m.remove());
    pinMarkersRef.current = [];
    legLabelsRef.current.forEach(l => l.remove());
    legLabelsRef.current = [];

    if (currentRoute.length === 0) return;

    const points = buildRoutePoints(currentRoute);

    const polyline = L.polyline(points, {
      color: '#e11d48', weight: 4, opacity: 0.8, dashArray: '8,8'
    }).addTo(map);
    routeLayerRef.current = polyline;

    for (let i = 0; i < currentRoute.length; i++) {
      const fromIdx = i === 0 ? 0 : currentRoute[i - 1] + 1;
      const toIdx = currentRoute[i] + 1;
      const legMin = legs[fromIdx] && legs[fromIdx][toIdx] != null ? legs[fromIdx][toIdx] : null;
      if (legMin != null) {
        const fromPoint = points[i];
        const toPoint = points[i + 1];
        const midLat = (fromPoint[0] + toPoint[0]) / 2;
        const midLon = (fromPoint[1] + toPoint[1]) / 2;
        const legLabel = L.marker([midLat, midLon], {
          icon: L.divIcon({
            html: `<div style="background:#e11d48;color:#fff;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:bold;white-space:nowrap">${legMin}m</div>`,
            className: '',
            iconAnchor: [15, 10]
          }),
          interactive: false
        }).addTo(map);
        legLabelsRef.current.push(legLabel);
      }
    }

    currentRoute.forEach((shopIdx, i) => {
      const shop = data[shopIdx];
      if (!shop) return;
      const isHi = highlightIdx === shopIdx;
      const pinIcon = L.divIcon({
        html: `<div style="
          width: 26px; height: 26px;
          background: ${isHi ? '#7c1d3e' : '#e11d48'};
          color: #fff; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: bold; font-size: 12px;
          border: ${isHi ? '3px solid #fde047' : '2px solid #fff'};
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">${i + 1}</div>`,
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const pinMarker = L.marker([shop.lat, shop.lon], {
        icon: pinIcon,
        zIndexOffset: 1000,
        draggable: true
      }).addTo(map);

      // Click number -> highlight toggle
      pinMarker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setHighlighted(prev => (prev === shopIdx ? null : shopIdx));
      });

      // Live-drag: find nearest shop under pointer; snap on dragend
      pinMarker.on('dragstart', () => {
        dragStateRef.current = { active: true, pinPos: i };
      });

      pinMarker.on('drag', (e) => {
        const ll = e.target.getLatLng();
        // find nearest shop to current pointer position
        let bestIdx = null, bestD = Infinity;
        data.forEach((s, sIdx) => {
          const d = getDistanceKm(ll.lat, ll.lng, s.lat, s.lon);
          if (d < bestD) { bestD = d; bestIdx = sIdx; }
        });
        const cur = routeRef.current;
        if (bestIdx == null) return;
        // build a preview route with this pin's slot replaced by bestIdx (if not duplicate elsewhere)
        const preview = [...cur];
        const dupPos = preview.indexOf(bestIdx);
        if (dupPos !== -1 && dupPos !== i) return; // would collide with another pin; skip live preview
        preview[i] = bestIdx;
        // Redraw polyline + leg labels live (but keep the dragged marker where the cursor is)
        const points2 = buildRoutePoints(preview);
        if (routeLayerRef.current) routeLayerRef.current.setLatLngs(points2);
        // update leg labels live
        legLabelsRef.current.forEach(l => l.remove());
        legLabelsRef.current = [];
        for (let k = 0; k < preview.length; k++) {
          const fromIdx = k === 0 ? 0 : preview[k - 1] + 1;
          const toIdx = preview[k] + 1;
          const legMin = legs[fromIdx] && legs[fromIdx][toIdx] != null ? legs[fromIdx][toIdx] : null;
          const fromPoint = k === i ? [ll.lat, ll.lng] : points2[k];
          const toPoint = (k + 1 === i) ? [ll.lat, ll.lng] : points2[k + 1];
          if (legMin != null) {
            const midLat = (fromPoint[0] + toPoint[0]) / 2;
            const midLon = (fromPoint[1] + toPoint[1]) / 2;
            const legLabel = L.marker([midLat, midLon], {
              icon: L.divIcon({
                html: `<div style="background:#e11d48;color:#fff;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:bold;white-space:nowrap">${legMin}m</div>`,
                className: '',
                iconAnchor: [15, 10]
              }),
              interactive: false
            }).addTo(map);
            legLabelsRef.current.push(legLabel);
          }
        }
      });

      pinMarker.on('dragend', (e) => {
        dragStateRef.current = { active: false, pinPos: -1 };
        const ll = e.target.getLatLng();
        let bestIdx = null, bestD = Infinity;
        data.forEach((s, sIdx) => {
          const d = getDistanceKm(ll.lat, ll.lng, s.lat, s.lon);
          if (d < bestD) { bestD = d; bestIdx = sIdx; }
        });
        const cur = routeRef.current;
        if (bestIdx == null) { setRoute([...cur]); return; }
        const dupPos = cur.indexOf(bestIdx);
        if (dupPos !== -1 && dupPos !== i) {
          // snap back — target already occupied
          setRoute([...cur]);
          return;
        }
        const newRoute = [...cur];
        newRoute[i] = bestIdx;
        setRoute(newRoute);
        if (highlightRef.current === cur[i]) setHighlighted(bestIdx);
      });

      pinMarker.bindTooltip(`<div style="font-weight:bold">${i + 1}. ${shop.name}</div><div style="color:#666;font-size:11px">Drag to another shop · click number to select</div>`, {
        direction: 'top',
        offset: [0, -14]
      });

      pinMarkersRef.current.push(pinMarker);
    });
  }, [data, legs, buildRoutePoints]);

  const updateRegionLayers = React.useCallback((currentRegions, hovered) => {
    const map = mapRef.current;
    if (!map) return;
    Object.values(regionsLayerRef.current).forEach(layerGroup => {
      if (layerGroup.polygon) layerGroup.polygon.remove();
      if (layerGroup.label) layerGroup.label.remove();
      if (layerGroup.handles) layerGroup.handles.forEach(h => h.remove());
    });
    regionsLayerRef.current = {};
    Object.entries(currentRegions).forEach(([name, regionData]) => {
      const polygon = regionData.polygon;
      if (!polygon || polygon.length < 3) return;
      const isHovered = hovered === name;
      const latLngs = polygon.map(([lon, lat]) => [lat, lon]);
      const polyLayer = L.polygon(latLngs, {
        color: isHovered ? '#e11d48' : '#8b5cf6',
        weight: isHovered ? 3 : 2,
        fillColor: '#8b5cf6',
        fillOpacity: isHovered ? 0.3 : 0.15,
        interactive: true
      }).addTo(map);
      polyLayer.on('dblclick', (e) => {
        L.DomEvent.stopPropagation(e);
        setRegions(prev => { const n = { ...prev }; delete n[name]; return n; });
      });
      const center = polyLayer.getBounds().getCenter();
      const labelIcon = L.divIcon({
        html: `<div style="background:#8b5cf6;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold;font-size:12px;white-space:nowrap">${name}</div>`,
        className: '',
        iconAnchor: [12, 10]
      });
      const labelMarker = L.marker(center, { icon: labelIcon, interactive: false }).addTo(map);
      const handles = polygon.map((coord, vertexIdx) => {
        const handleIcon = L.divIcon({
          html: `<div style="width:10px;height:10px;background:#fff;border:2px solid #8b5cf6;border-radius:50%;cursor:move"></div>`,
          className: '',
          iconSize: [10, 10],
          iconAnchor: [5, 5]
        });
        const handle = L.marker([coord[1], coord[0]], { icon: handleIcon, draggable: true }).addTo(map);
        handle.on('drag', (e) => {
          const newLatLng = e.target.getLatLng();
          setRegions(prev => {
            const newRegions = { ...prev };
            if (newRegions[name]) {
              const newPolygon = [...newRegions[name].polygon];
              newPolygon[vertexIdx] = [newLatLng.lng, newLatLng.lat];
              newRegions[name] = { ...newRegions[name], polygon: newPolygon, indices: findShopsInPolygon(newPolygon) };
            }
            return newRegions;
          });
        });
        return handle;
      });
      regionsLayerRef.current[name] = { polygon: polyLayer, label: labelMarker, handles };
    });
  }, [findShopsInPolygon]);

  React.useEffect(() => {
    updateRegionLayers(regions, hoveredRegion);
  }, [regions, hoveredRegion, updateRegionLayers]);

  React.useEffect(() => {
    updateRouteLayer(route, highlighted);
  }, [route, highlighted, updateRouteLayer]);

  // Initialize outputs on mount
  React.useEffect(() => {
    const { insideIndices, openIndices } = updateAll(3.5, 1, 6, 30);
    model.set("inside", insideIndices);
    model.set("radius_km", 3.5);
    model.set("open_on_arrival", openIndices);
    model.set("when", { day: 1, hhmm: "06:30" });
    model.set("regions", {});
    model.set("route", []);
    model.save_changes();
    return () => {};
  }, []);

  // Sync state to model
  React.useEffect(() => {
    const { insideIndices, openIndices } = updateAll(radiusKm, selectedDay, leaveHours, leaveMinutes);
    model.set("inside", insideIndices);
    model.set("radius_km", radiusKm);
    model.set("open_on_arrival", openIndices);
    model.set("when", { day: selectedDay, hhmm: `${String(leaveHours).padStart(2, '0')}:${String(leaveMinutes).padStart(2, '0')}` });
    const regionsIndices = {};
    Object.entries(regions).forEach(([name, regionData]) => { regionsIndices[name] = regionData.indices || []; });
    model.set("regions", regionsIndices);
    model.set("route", route);
    model.save_changes();

    if (circleRef.current) circleRef.current.setRadius(radiusKm * 1000);
    updateMarkers(radiusKm, selectedDay, leaveHours, leaveMinutes, route, highlighted);
    updateLabel(radiusKm);
    return () => {};
  }, [radiusKm, selectedDay, leaveHours, leaveMinutes, regions, route, highlighted, updateAll, updateMarkers, updateLabel]);

  const togglePin = React.useCallback((shopIdx) => {
    setRoute(prev => {
      const idx = prev.indexOf(shopIdx);
      if (idx >= 0) return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      return [...prev, shopIdx];
    });
  }, []);

  // Initialize map
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const map = L.map(containerRef.current, { boxZoom: false }).setView([hotelLat, hotelLon], 12);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    if (isochrones.features) {
      const sortedFeatures = [...isochrones.features].sort((a, b) =>
        (b.properties?.contour || 0) - (a.properties?.contour || 0)
      );
      sortedFeatures.forEach(feature => {
        const contour = feature.properties?.contour || 30;
        const opacity = contour === 10 ? 0.4 : contour === 20 ? 0.25 : 0.15;
        const layer = L.geoJSON(feature, {
          style: { fillColor: '#2563eb', fillOpacity: opacity, color: '#2563eb', weight: 1, opacity: 0.3 }
        }).addTo(map);
        isoLayersRef.current.push(layer);
      });
    }

    const hotelIcon = L.divIcon({
      html: `<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center">
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path fill="#1a1a1a" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>`,
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 24]
    });
    L.marker([hotelLat, hotelLon], { icon: hotelIcon }).addTo(map).bindTooltip('Hotel', { permanent: false });

    const circle = L.circle([hotelLat, hotelLon], {
      radius: 3500, color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.1, weight: 3
    }).addTo(map);
    circleRef.current = circle;
    circle.bringToFront();

    const label = L.popup({ closeButton: false, autoClose: false, closeOnClick: false, className: 'radius-label' })
      .setLatLng([hotelLat, hotelLon]).setContent('3.5 km').addTo(map);
    labelRef.current = label;
    updateLabel(3.5);

    const leaveTotalMin = 6 * 60 + 30;

    data.forEach((shop, idx) => {
      const dist = getDistanceKm(hotelLat, hotelLon, shop.lat, shop.lon);
      const isInside = dist <= 3.5;
      const arrivalMin = (leaveTotalMin + (shop.bike_min || 0)) % (24 * 60);
      const arrivalH = Math.floor(arrivalMin / 60);
      const arrivalM = arrivalMin % 60;
      const arrivalFormatted = `${String(arrivalH).padStart(2, '0')}:${String(arrivalM).padStart(2, '0')}`;
      const parsed = parseOsmHours(shop.hours);
      const openStatus = isOpenAt(parsed, 1, arrivalMin);

      let fillColor, strokeColor, fillOpacity, dashArray, labelColor;
      if (openStatus === true) {
        fillColor = shop.chain ? '#888' : '#ff8c00';
        fillOpacity = isInside ? 0.9 : 0.3;
        dashArray = null;
        labelColor = '#16a34a';
      } else if (openStatus === false) {
        fillColor = 'transparent'; fillOpacity = 0; dashArray = null; labelColor = '#dc2626';
      } else {
        fillColor = 'transparent'; fillOpacity = 0; dashArray = '3,3'; labelColor = '#666';
      }
      strokeColor = shop.chain ? '#888' : '#ff8c00';

      const marker = L.circleMarker([shop.lat, shop.lon], {
        radius: isInside ? 8 : 5,
        fillColor, fillOpacity, color: strokeColor,
        weight: isInside ? 2 : 1, dashArray, opacity: isInside ? 1 : 0.4
      }).addTo(map);

      marker.on('click', () => { togglePin(idx); });

      const timeLabel = L.marker([shop.lat, shop.lon], {
        icon: L.divIcon({
          html: `<div style="font-size:9px;font-weight:bold;color:${labelColor};text-shadow:0 0 2px #fff,0 0 2px #fff;white-space:nowrap;display:${isInside ? 'block' : 'none'}">${arrivalFormatted}</div>`,
          className: '',
          iconSize: [40, 14],
          iconAnchor: [-8, 7]
        }),
        interactive: false
      }).addTo(map);

      const tooltipContent = `<div style="font-weight:bold;color:#000">${shop.name}</div>
        ${shop.street ? `<div style="color:#333">${shop.street}</div>` : ''}
        ${shop.hours ? `<div style="color:#555;font-size:11px">${shop.hours}</div>` : '<div style="color:#999;font-size:11px">Hours unknown</div>'}
        <div style="color:#2563eb;font-size:11px">${shop.bike_min} min by bike</div>
        <div style="color:#e11d48;font-size:11px;margin-top:4px">Click to pin/unpin</div>`;
      marker.bindTooltip(tooltipContent, { direction: 'top', offset: [0, -5] });

      markersRef.current.push({ marker, label: timeLabel, shop, idx });
    });

    // Lasso drawing
    let isLassoing = false;
    let lassoPoints = [];
    let lassoPolyline = null;

    const onMouseDown = (e) => {
      if (e.originalEvent.shiftKey) {
        isLassoing = true;
        lassoPoints = [[e.latlng.lng, e.latlng.lat]];
        map.dragging.disable();
        lassoPolyline = L.polyline([[e.latlng.lat, e.latlng.lng]], { color: '#8b5cf6', weight: 2, dashArray: '5,5' }).addTo(map);
        lassoLayerRef.current = lassoPolyline;
        e.originalEvent.preventDefault();
        return;
      }
      const center = L.latLng(hotelLat, hotelLon);
      const clickDist = map.distance(center, e.latlng);
      const circleRadius = circleRef.current.getRadius();
      if (Math.abs(clickDist - circleRadius) < circleRadius * 0.15) {
        map.dragging.disable();
        e.originalEvent.preventDefault();
        const onDragMove = (e2) => {
          const newRadius = map.distance(center, e2.latlng);
          const newRadiusKm = Math.max(0.5, Math.min(20, newRadius / 1000));
          setRadiusKm(newRadiusKm);
        };
        const onDragEnd = () => {
          map.off('mousemove', onDragMove);
          map.off('mouseup', onDragEnd);
          document.removeEventListener('mouseup', onDragEnd);
          map.dragging.enable();
        };
        map.on('mousemove', onDragMove);
        map.on('mouseup', onDragEnd);
        document.addEventListener('mouseup', onDragEnd);
      }
    };

    const onMouseMove = (e) => {
      if (isLassoing && lassoPolyline) {
        lassoPoints.push([e.latlng.lng, e.latlng.lat]);
        const latLngs = lassoPoints.map(([lon, lat]) => [lat, lon]);
        lassoPolyline.setLatLngs(latLngs);
        return;
      }
      const center = L.latLng(hotelLat, hotelLon);
      const dist = map.distance(center, e.latlng);
      const circleRadius = circleRef.current.getRadius();
      if (Math.abs(dist - circleRadius) < circleRadius * 0.15) {
        containerRef.current.style.cursor = 'ew-resize';
      } else if (e.originalEvent.shiftKey) {
        containerRef.current.style.cursor = 'crosshair';
      } else {
        containerRef.current.style.cursor = '';
      }
    };

    const onMouseUp = () => {
      if (isLassoing && lassoPoints.length >= 3) {
        lassoPoints.push(lassoPoints[0]);
        const indices = [];
        data.forEach((shop, idx) => {
          if (pointInPolygon([shop.lon, shop.lat], lassoPoints)) indices.push(idx);
        });
        if (indices.length > 0) {
          setRegions(prev => {
            const existingKeys = Object.keys(prev);
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            let name = '';
            for (const letter of letters) {
              if (!existingKeys.includes(letter)) { name = letter; break; }
            }
            if (!name) name = `Region${existingKeys.length + 1}`;
            return { ...prev, [name]: { polygon: lassoPoints, indices } };
          });
        }
      }
      if (lassoPolyline) { lassoPolyline.remove(); lassoPolyline = null; lassoLayerRef.current = null; }
      isLassoing = false;
      lassoPoints = [];
      map.dragging.enable();
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);

    const docMouseUp = () => {
      if (isLassoing) {
        if (lassoPolyline) { lassoPolyline.remove(); lassoPolyline = null; }
        isLassoing = false;
        lassoPoints = [];
        map.dragging.enable();
      }
    };
    document.addEventListener('mouseup', docMouseUp);

    return () => {
      document.removeEventListener('mouseup', docMouseUp);
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
      isoLayersRef.current.forEach(layer => layer.remove());
      isoLayersRef.current = [];
      Object.values(regionsLayerRef.current).forEach(layerGroup => {
        if (layerGroup.polygon) layerGroup.polygon.remove();
        if (layerGroup.label) layerGroup.label.remove();
        if (layerGroup.handles) layerGroup.handles.forEach(h => h.remove());
      });
      regionsLayerRef.current = {};
      if (routeLayerRef.current) { routeLayerRef.current.remove(); routeLayerRef.current = null; }
      pinMarkersRef.current.forEach(m => m.remove());
      pinMarkersRef.current = [];
      legLabelsRef.current.forEach(l => l.remove());
      legLabelsRef.current = [];
      markersRef.current.forEach(({ marker, label }) => { marker.remove(); if (label) label.remove(); });
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      circleRef.current = null;
      labelRef.current = null;
      link.remove();
    };
  }, [data, isochrones, updateLabel, findShopsInPolygon, togglePin]);

  // React to input data changes from other widgets
  React.useEffect(() => {
    const handler = () => {};
    model.on("change:data", handler);
    return () => model.off("change:data", handler);
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ position: 'relative', flex: 1, height: 500 }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden' }} />
          <div style={{
            position: 'absolute', top: 10, left: 50, zIndex: 1000,
            background: 'rgba(255,255,255,0.95)', padding: '8px 14px', borderRadius: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)', fontSize: 14, fontWeight: 600, color: '#1a1a1a'
          }}>
            <span style={{ color: '#2563eb' }}>{stats.inside}</span> inside · <span style={{ color: '#ff8c00' }}>{stats.independent}</span> independent · <span style={{ color: '#16a34a' }}>{stats.open}</span> open on arrival
          </div>
          <div style={{
            position: 'absolute', bottom: 30, right: 10, zIndex: 1000,
            background: 'rgba(255,255,255,0.95)', padding: '8px 12px', borderRadius: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)', fontSize: 11, color: '#333'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff8c00', display: 'inline-block' }}></span>
              <span>Independent (solid=open)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#888', display: 'inline-block' }}></span>
              <span>Chain</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #ff8c00', background: 'transparent', display: 'inline-block', boxSizing: 'border-box' }}></span>
              <span style={{ color: '#dc2626' }}>Closed</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px dashed #888', background: 'transparent', display: 'inline-block', boxSizing: 'border-box' }}></span>
              <span style={{ color: '#666' }}>Unknown hours</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid #ddd', paddingTop: 4, marginTop: 4 }}>
              <span style={{ width: 10, height: 10, background: '#8b5cf6', opacity: 0.5, display: 'inline-block' }}></span>
              <span>Shift+drag = lasso</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <span style={{ width: 10, height: 10, background: '#e11d48', borderRadius: '50%', display: 'inline-block' }}></span>
              <span>Click shop = pin · drag pin = move</span>
            </div>
          </div>
        </div>

        <div style={{
          width: 160, background: '#fff', borderRadius: 8, padding: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8 }}>Leave Hotel</div>
          <ClockDial
            React={React}
            hours={leaveHours}
            minutes={leaveMinutes}
            onTimeChange={handleTimeChange}
            onFocus={() => setClockFocused(true)}
            onBlur={() => setClockFocused(false)}
            focused={clockFocused}
          />
          <DayButtons React={React} selectedDay={selectedDay} onDayChange={setSelectedDay} />
          <div style={{ fontSize: 10, color: '#888', marginTop: 8, textAlign: 'center' }}>← → keys: ±15 min</div>
        </div>
      </div>

      <div style={{ marginTop: 12, background: '#fff', borderRadius: 8, padding: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 8 }}>
          Route Itinerary <span style={{ fontWeight: 400, color: '#666' }}>(drag ⠿ to reorder · × to remove · click row to select then Delete / ← →)</span>
        </div>
        <RouteList
          React={React}
          route={route}
          data={data}
          legs={legs}
          leaveHours={leaveHours}
          leaveMinutes={leaveMinutes}
          highlighted={highlighted}
          onReorder={(newRoute) => setRoute(newRoute)}
          onHighlight={(idx) => setHighlighted(idx)}
          onRemove={(idx) => {
            setRoute(prev => prev.filter(i => i !== idx));
            setHighlighted(prev => (prev === idx ? null : prev));
          }}
        />
      </div>

      <div style={{ marginTop: 12, background: '#fff', borderRadius: 8, padding: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 8 }}>
          Lasso Regions <span style={{ fontWeight: 400, color: '#666' }}>(double-click region to delete)</span>
        </div>
        <RegionTable
          React={React}
          regions={regions}
          data={data}
          selectedDay={selectedDay}
          leaveHours={leaveHours}
          leaveMinutes={leaveMinutes}
          hoveredRegion={hoveredRegion}
          onHoverRegion={setHoveredRegion}
        />
      </div>
    </div>
  );
}