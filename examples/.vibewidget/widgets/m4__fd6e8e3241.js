import L from "https://esm.sh/leaflet@1.9.4";

const LEAFLET_CSS_ID = "leaflet-css-bundle-v194";
function ensureLeafletCss() {
  if (typeof document !== "undefined" && !document.getElementById(LEAFLET_CSS_ID)) {
    const link = document.createElement("link");
    link.id = LEAFLET_CSS_ID;
    link.rel = "stylesheet";
    link.href = "https://esm.sh/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }
}

function formatHHMM(totalMinutes) {
  const norm = ((Math.round(totalMinutes) % 720) + 720) % 720;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseHHMM(str) {
  if (!str) return 0;
  const parts = str.split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function checkShopOpen(hoursStr, targetDay, arrivalMin) {
  if (!hoursStr || typeof hoursStr !== "string") return null;
  const trimmed = hoursStr.trim();
  if (trimmed === "") return null;
  if (trimmed === "24/7") return true;

  const dayMap = { mo: 0, tu: 1, we: 2, th: 3, fr: 4, sa: 5, su: 6 };
  const rules = trimmed.split(";").map((s) => s.trim()).filter(Boolean);

  let matchedAnyDayRule = false;

  for (const rule of rules) {
    const match = rule.match(/^(?:([A-Za-z,\s-]+)\s+)?(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!match) continue;

    const daysPart = match[1];
    const startTimeStr = match[2];
    const endTimeStr = match[3];

    const [sh, sm] = startTimeStr.split(":").map(Number);
    const [eh, em] = endTimeStr.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    let dayApplies = false;
    if (!daysPart) {
      dayApplies = true;
    } else {
      const dayTokens = daysPart.split(",").map((s) => s.trim());
      for (const token of dayTokens) {
        if (token.includes("-")) {
          const [d1, d2] = token.split("-").map((s) => s.trim().slice(0, 2).toLowerCase());
          const idx1 = dayMap[d1];
          const idx2 = dayMap[d2];
          if (idx1 !== undefined && idx2 !== undefined) {
            if (idx1 <= idx2) {
              if (targetDay >= idx1 && targetDay <= idx2) dayApplies = true;
            } else {
              if (targetDay >= idx1 || targetDay <= idx2) dayApplies = true;
            }
          }
        } else {
          const d = token.slice(0, 2).toLowerCase();
          if (dayMap[d] === targetDay) {
            dayApplies = true;
          }
        }
      }
    }

    if (dayApplies) {
      matchedAnyDayRule = true;
      if (endMin >= startMin) {
        if (arrivalMin >= startMin && arrivalMin < endMin) return true;
      } else {
        if (arrivalMin >= startMin || arrivalMin < endMin) return true;
      }
    }
  }

  return matchedAnyDayRule ? false : null;
}

function pointInPolygon(pt, poly) {
  let inside = false;
  const x = pt[0];
  const y = pt[1];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function getRegionName(index) {
  let name = "";
  let n = index;
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
}

export const ModeSwitch = ({ mode, onChange }) => {
  const modes = [
    { key: "walk", label: "walk" },
    { key: "bike", label: "bike" },
    { key: "drive", label: "drive" },
  ];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        marginBottom: 10,
        width: "100%",
      }}
    >
      {modes.map((m, idx) => {
        const isActive = mode === m.key;
        return (
          <React.Fragment key={m.key}>
            <button
              onClick={() => onChange(m.key)}
              style={{
                background: isActive ? "#111111" : "transparent",
                color: isActive ? "#ffffff" : "#111111",
                border: "1px solid #d9d9d9",
                fontSize: 11,
                fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
                padding: "2px 8px",
                cursor: "pointer",
                lineHeight: 1.2,
                borderRadius: 2,
              }}
            >
              {m.label}
            </button>
            {idx < modes.length - 1 && (
              <span style={{ margin: "0 6px", color: "#777777", fontSize: 10, userSelect: "none" }}>
                ·
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const CountLine = ({ insideCount, independentCount, openAndBackCount }) => (
  <div
    style={{
      position: "absolute",
      top: 12,
      left: 12,
      zIndex: 1000,
      background: "rgba(255, 255, 255, 0.94)",
      border: "1px solid #d9d9d9",
      padding: "4px 8px",
      fontSize: "12px",
      fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
      color: "#111111",
      lineHeight: 1.4,
      fontVariantNumeric: "tabular-nums",
      pointerEvents: "none",
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
    }}
  >
    <span style={{ fontWeight: 600 }}>{insideCount}</span> inside ·{" "}
    <span style={{ fontWeight: 600 }}>{independentCount}</span> independent ·{" "}
    <span style={{ fontWeight: 600 }}>{openAndBackCount}</span> open and back in time
  </div>
);

export const HoverCard = ({ shop, leaveMin, targetDay, mode = "bike" }) => {
  if (!shop) return null;
  const isChain = Boolean(shop.chain);
  const minKey = `${mode}_min`;
  const legMin = shop[minKey] ?? 0;
  const arrivalMin = (leaveMin + legMin) % 720;
  const arrivalStr = formatHHMM(arrivalMin);
  const openStatus = checkShopOpen(shop.hours, targetDay, arrivalMin);

  let statusText = "unknown hours";
  let statusColor = "#777777";
  if (openStatus === true) {
    statusText = "open at arrival";
    statusColor = "#2b8a3e";
  } else if (openStatus === false) {
    statusText = "closed at arrival";
    statusColor = "#c92a2a";
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 14,
        left: 12,
        zIndex: 1000,
        background: "#ffffff",
        border: "1px solid #d9d9d9",
        padding: "8px 12px",
        minWidth: 200,
        maxWidth: 320,
        fontSize: "12px",
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
        color: "#111111",
        pointerEvents: "none",
        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: isChain ? "#777777" : "#d9480f",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600, fontSize: "13px" }}>{shop.name}</span>
      </div>
      {shop.street && (
        <div style={{ color: "#777777", fontSize: "11px", marginTop: 2 }}>
          {shop.street}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
        <span style={{ fontFamily: "ui-monospace, SF Mono, Menlo, monospace", fontSize: "11px" }}>
          arr {arrivalStr}
        </span>
        <span style={{ color: statusColor, fontSize: "11px", fontWeight: 500 }}>
          {statusText}
        </span>
      </div>
      {shop.hours ? (
        <div
          style={{
            color: "#111111",
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: "11px",
            marginTop: 4,
            whiteSpace: "pre-wrap",
          }}
        >
          {shop.hours}
        </div>
      ) : (
        <div style={{ color: "#777777", fontSize: "11px", marginTop: 3 }}>
          hours unlisted
        </div>
      )}
    </div>
  );
};

export const RegionsTable = ({
  regions = [],
  highlightedRegionId,
  onHoverRegion,
}) => {
  if (!regions || regions.length === 0) return null;

  return (
    <div
      style={{
        borderTop: "1px solid #d9d9d9",
        backgroundColor: "#ffffff",
        maxHeight: 128,
        overflowY: "auto",
        boxSizing: "border-box",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "11px",
          fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
          color: "#111111",
          lineHeight: "20px",
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: "1px solid #d9d9d9",
              color: "#777777",
              textAlign: "right",
              userSelect: "none",
            }}
          >
            <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 500 }}>region</th>
            <th style={{ padding: "4px 8px", fontWeight: 500 }}>n shops</th>
            <th style={{ padding: "4px 8px", fontWeight: 500 }}>n independent</th>
            <th style={{ padding: "4px 8px", fontWeight: 500 }}>n open on arrival</th>
            <th style={{ padding: "4px 8px", fontWeight: 500 }}>earliest arrival</th>
          </tr>
        </thead>
        <tbody>
          {regions.map((reg) => {
            const isHov = reg.id === highlightedRegionId;
            return (
              <tr
                key={reg.id}
                onMouseEnter={() => onHoverRegion && onHoverRegion(reg.id)}
                onMouseLeave={() => onHoverRegion && onHoverRegion(null)}
                style={{
                  backgroundColor: isHov ? "#f2f2f2" : "transparent",
                  borderBottom: "1px solid #f0f0f0",
                  cursor: "default",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <td
                  style={{
                    textAlign: "left",
                    padding: "3px 8px",
                    fontWeight: 600,
                    color: isHov ? "#d9480f" : "#111111",
                  }}
                >
                  {reg.name}
                </td>
                <td style={{ textAlign: "right", padding: "3px 8px" }}>{reg.nShops}</td>
                <td style={{ textAlign: "right", padding: "3px 8px" }}>{reg.nIndep}</td>
                <td style={{ textAlign: "right", padding: "3px 8px" }}>{reg.nOpen}</td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "3px 8px",
                    fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                  }}
                >
                  {reg.earliestArrival ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const MapContainer = ({
  React,
  data = [],
  reach = null,
  routes = null,
  mode = "bike",
  hotel = [29.7522, -95.3578],
  radiusKm = 3.5,
  targetIndex = 2,
  leaveMin = 390,
  backByMin = 525,
  targetDay = 0,
  regions = [],
  highlightedRegionId = null,
  onRadiusChange,
  onSelectShop,
  onHoverShop,
  onAddRegion,
  onUpdateRegionVertices,
  onDeleteRegion,
}) => {
  const mapDivRef = React.useRef(null);
  const leafletMapRef = React.useRef(null);
  const circleRef = React.useRef(null);
  const handleMarkerRef = React.useRef(null);
  const edgeLabelMarkerRef = React.useRef(null);
  const shopMarkersRef = React.useRef([]);
  const reachLayerRef = React.useRef(null);
  const routeLayerRef = React.useRef(null);
  const routeLabelRef = React.useRef(null);
  const isDraggingRef = React.useRef(false);

  const regionLayersRef = React.useRef(new Map());
  const activeLassoLineRef = React.useRef(null);
  const lassoPointsRef = React.useRef([]);
  const isLassoingRef = React.useRef(false);

  const propsRef = React.useRef({
    regions,
    onAddRegion,
    onUpdateRegionVertices,
    onDeleteRegion,
    highlightedRegionId,
  });

  React.useEffect(() => {
    propsRef.current = {
      regions,
      onAddRegion,
      onUpdateRegionVertices,
      onDeleteRegion,
      highlightedRegionId,
    };
  });

  React.useEffect(() => {
    ensureLeafletCss();
    if (!mapDivRef.current) return;

    const map = L.map(mapDivRef.current, {
      center: hotel,
      zoom: 13,
      zoomControl: false,
      boxZoom: false,
    });
    leafletMapRef.current = map;

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a> &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    const hotelIcon = L.divIcon({
      className: "hotel-pin",
      html: `
        <div style="position:relative; width:14px; height:14px; transform:translate(-7px, -7px); pointer-events:auto;" title="Hotel">
          <div style="position:absolute; inset:0; border-radius:50%; background:#111111; box-shadow:0 0 0 2px #ffffff, 0 1px 3px rgba(0,0,0,0.3);"></div>
          <div style="position:absolute; top:4px; left:4px; width:6px; height:6px; border-radius:50%; background:#ffffff;"></div>
        </div>
      `,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    L.marker(hotel, { icon: hotelIcon, zIndexOffset: 1000 }).addTo(map);

    const circle = L.circle(hotel, {
      radius: radiusKm * 1000,
      color: "#111111",
      weight: 1.5,
      opacity: 0.85,
      fillColor: "#111111",
      fillOpacity: 0.05,
      interactive: true,
    }).addTo(map);
    circleRef.current = circle;

    const initialEdgePt = L.latLng(
      hotel[0],
      hotel[1] + (radiusKm / 111.32) / Math.cos((hotel[0] * Math.PI) / 180)
    );

    const labelIcon = L.divIcon({
      className: "circle-edge-label",
      html: `<div id="edge-km-label" style="display:inline-block; transform:translate(8px, -8px); font-family:ui-monospace,SF Mono,Menlo,monospace; font-size:11px; font-variant-numeric:tabular-nums; font-weight:600; color:#111111; background:#ffffff; border:1px solid #d9d9d9; padding:1px 5px; border-radius:2px; pointer-events:none; white-space:nowrap; box-shadow:0 1px 2px rgba(0,0,0,0.06);">${radiusKm.toFixed(1)} km</div>`,
      iconSize: [0, 0],
    });
    const edgeLabelMarker = L.marker(initialEdgePt, {
      icon: labelIcon,
      interactive: false,
    }).addTo(map);
    edgeLabelMarkerRef.current = edgeLabelMarker;

    const handleIcon = L.divIcon({
      className: "circle-drag-handle",
      html: `
        <div style="width:24px; height:24px; margin-left:-12px; margin-top:-12px; display:flex; align-items:center; justify-content:center; cursor:ew-resize;">
          <div style="width:7px; height:7px; border-radius:50%; background:#111111; border:1.5px solid #ffffff; box-shadow:0 0 0 1px #d9d9d9;"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    const handleMarker = L.marker(initialEdgePt, {
      icon: handleIcon,
      draggable: true,
      zIndexOffset: 900,
    }).addTo(map);
    handleMarkerRef.current = handleMarker;

    const hotelLatLng = L.latLng(hotel[0], hotel[1]);

    const updateRadiusFromLatLng = (targetLatLng) => {
      const distMeters = hotelLatLng.distanceTo(targetLatLng);
      const clampedKm = Math.max(0.4, Math.min(25.0, distMeters / 1000));
      const newRadiusM = clampedKm * 1000;

      circle.setRadius(newRadiusM);

      const angle = Math.atan2(
        targetLatLng.lat - hotelLatLng.lat,
        (targetLatLng.lng - hotelLatLng.lng) * Math.cos((hotelLatLng.lat * Math.PI) / 180)
      );
      const dLat = (newRadiusM / 111320) * Math.sin(angle);
      const dLng =
        ((newRadiusM / 111320) * Math.cos(angle)) /
        Math.cos((hotelLatLng.lat * Math.PI) / 180);
      const newEdgeLatLng = L.latLng(hotelLatLng.lat + dLat, hotelLatLng.lng + dLng);

      handleMarker.setLatLng(newEdgeLatLng);
      edgeLabelMarker.setLatLng(newEdgeLatLng);

      const labelEl = document.getElementById("edge-km-label");
      if (labelEl) {
        labelEl.textContent = `${clampedKm.toFixed(1)} km`;
      }

      if (onRadiusChange) {
        onRadiusChange(Number(clampedKm.toFixed(2)));
      }
    };

    handleMarker.on("dragstart", () => {
      isDraggingRef.current = true;
      map.dragging.disable();
    });
    handleMarker.on("drag", (e) => {
      updateRadiusFromLatLng(e.latlng);
    });
    handleMarker.on("dragend", () => {
      isDraggingRef.current = false;
      map.dragging.enable();
    });

    let circleDragging = false;
    const onMapMouseMove = (e) => {
      if (circleDragging) {
        updateRadiusFromLatLng(e.latlng);
        return;
      }
      if (isLassoingRef.current) {
        lassoPointsRef.current.push([e.latlng.lat, e.latlng.lng]);
        if (activeLassoLineRef.current) {
          activeLassoLineRef.current.setLatLngs(lassoPointsRef.current);
        }
      }
    };

    const finishLasso = () => {
      if (!isLassoingRef.current) return;
      isLassoingRef.current = false;
      map.dragging.enable();

      if (activeLassoLineRef.current) {
        activeLassoLineRef.current.remove();
        activeLassoLineRef.current = null;
      }

      const pts = lassoPointsRef.current;
      lassoPointsRef.current = [];

      if (pts.length >= 3) {
        let simplified = [];
        const step = Math.max(1, Math.floor(pts.length / 32));
        for (let i = 0; i < pts.length; i += step) {
          simplified.push(pts[i]);
        }
        if (simplified.length < 3 && pts.length >= 3) {
          simplified = pts.slice(0, 3);
        }
        if (simplified.length >= 3 && propsRef.current.onAddRegion) {
          propsRef.current.onAddRegion(simplified);
        }
      }
    };

    const onMapMouseDown = (e) => {
      if (e.originalEvent && e.originalEvent.shiftKey) {
        L.DomEvent.preventDefault(e.originalEvent);
        L.DomEvent.stopPropagation(e.originalEvent);
        map.dragging.disable();
        isLassoingRef.current = true;
        lassoPointsRef.current = [[e.latlng.lat, e.latlng.lng]];
        if (activeLassoLineRef.current) {
          activeLassoLineRef.current.remove();
        }
        activeLassoLineRef.current = L.polyline(lassoPointsRef.current, {
          color: "#d9480f",
          weight: 1.5,
          dashArray: "3, 3",
          opacity: 0.9,
        }).addTo(map);
      }
    };

    const onMapMouseUp = () => {
      if (circleDragging) {
        circleDragging = false;
        map.dragging.enable();
      }
      if (isLassoingRef.current) {
        finishLasso();
      }
    };

    circle.on("mousedown", (e) => {
      if (e.originalEvent && e.originalEvent.shiftKey) {
        return;
      }
      const dist = hotelLatLng.distanceTo(e.latlng);
      const currentRadiusM = circle.getRadius();
      if (Math.abs(dist - currentRadiusM) < Math.max(300, currentRadiusM * 0.25)) {
        circleDragging = true;
        map.dragging.disable();
        L.DomEvent.stopPropagation(e);
      }
    });

    map.on("mousedown", onMapMouseDown);
    map.on("mousemove", onMapMouseMove);
    map.on("mouseup", onMapMouseUp);

    const onDocMouseUp = () => {
      if (isLassoingRef.current) {
        finishLasso();
      }
    };
    window.addEventListener("mouseup", onDocMouseUp);

    return () => {
      window.removeEventListener("mouseup", onDocMouseUp);
      map.off("mousedown", onMapMouseDown);
      map.off("mousemove", onMapMouseMove);
      map.off("mouseup", onMapMouseUp);
      map.remove();
      leafletMapRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    if (reachLayerRef.current) {
      reachLayerRef.current.remove();
      reachLayerRef.current = null;
    }

    if (!reach || !reach[mode]) return;

    const geo = reach[mode];
    const layer = L.geoJSON(geo, {
      style: (feature) => {
        const contour = feature?.properties?.contour ?? 30;
        let fillOpacity = 0.08;
        if (contour <= 10) fillOpacity = 0.22;
        else if (contour <= 20) fillOpacity = 0.14;
        else fillOpacity = 0.08;

        return {
          color: "#4a6984",
          weight: 1,
          opacity: 0.4,
          fillColor: "#4a6984",
          fillOpacity,
          interactive: false,
        };
      },
    }).addTo(map);

    if (circleRef.current) {
      circleRef.current.bringToFront();
    }
    reachLayerRef.current = layer;
  }, [reach, mode]);

  React.useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }
    if (routeLabelRef.current) {
      routeLabelRef.current.remove();
      routeLabelRef.current = null;
    }

    if (
      !routes ||
      !routes[mode] ||
      targetIndex === null ||
      targetIndex === undefined ||
      !routes[mode][targetIndex]
    ) {
      return;
    }

    const routePts = routes[mode][targetIndex];
    if (!routePts || routePts.length === 0) return;

    const poly = L.polyline(routePts, {
      color: "#d9480f",
      weight: 2,
      opacity: 0.95,
      interactive: false,
    }).addTo(map);
    routeLayerRef.current = poly;

    let targetShop = data && data[targetIndex] ? data[targetIndex] : null;
    const minVal = targetShop ? Math.round(targetShop[`${mode}_min`] ?? 0) : 0;

    let totalDist = 0;
    const dists = [0];
    for (let i = 1; i < routePts.length; i++) {
      const p1 = L.latLng(routePts[i - 1][0], routePts[i - 1][1]);
      const p2 = L.latLng(routePts[i][0], routePts[i][1]);
      totalDist += p1.distanceTo(p2);
      dists.push(totalDist);
    }
    const halfDist = totalDist / 2;
    let midPt = routePts[Math.floor(routePts.length / 2)];
    for (let i = 1; i < dists.length; i++) {
      if (dists[i] >= halfDist) {
        const segLen = dists[i] - dists[i - 1];
        const fraction = segLen > 0 ? (halfDist - dists[i - 1]) / segLen : 0;
        midPt = [
          routePts[i - 1][0] + fraction * (routePts[i][0] - routePts[i - 1][0]),
          routePts[i - 1][1] + fraction * (routePts[i][1] - routePts[i - 1][1]),
        ];
        break;
      }
    }

    const lbl = L.marker(midPt, {
      icon: L.divIcon({
        className: "route-mid-label",
        html: `<div style="
          transform: translate(-50%, -50%);
          font-family: ui-monospace, SF Mono, Menlo, monospace;
          font-size: 10px;
          font-weight: 600;
          color: #d9480f;
          background: #ffffff;
          border: 1px solid #d9480f;
          padding: 1px 4px;
          border-radius: 2px;
          white-space: nowrap;
          pointer-events: none;
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        ">${minVal} min</div>`,
        iconSize: [0, 0],
      }),
      interactive: false,
      zIndexOffset: 700,
    }).addTo(map);
    routeLabelRef.current = lbl;
  }, [routes, mode, targetIndex, data]);

  React.useEffect(() => {
    if (isDraggingRef.current) return;
    if (circleRef.current && edgeLabelMarkerRef.current && handleMarkerRef.current) {
      circleRef.current.setRadius(radiusKm * 1000);
      const dLng = (radiusKm / 111.32) / Math.cos((hotel[0] * Math.PI) / 180);
      const edgePt = L.latLng(hotel[0], hotel[1] + dLng);
      handleMarkerRef.current.setLatLng(edgePt);
      edgeLabelMarkerRef.current.setLatLng(edgePt);
      const labelEl = document.getElementById("edge-km-label");
      if (labelEl) {
        labelEl.textContent = `${radiusKm.toFixed(1)} km`;
      }
    }
  }, [radiusKm]);

  React.useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    shopMarkersRef.current.forEach((m) => m.remove());
    shopMarkersRef.current = [];

    const hotelLatLng = L.latLng(hotel[0], hotel[1]);
    const radiusMeters = radiusKm * 1000;

    const availableDuration =
      backByMin >= leaveMin ? backByMin - leaveMin : 720 - leaveMin + backByMin;

    const markers = (data || []).map((shop, idx) => {
      const lat = shop.lat;
      const lon = shop.lon;
      const shopLatLng = L.latLng(lat, lon);
      const distMeters = hotelLatLng.distanceTo(shopLatLng);
      const isInside = distMeters <= radiusMeters;
      const isTarget = idx === targetIndex;

      const legMin = shop[`${mode}_min`] ?? 0;
      const legBack = shop[`${mode}_back`] ?? legMin;
      const roundTripMin = legMin + 10 + legBack;
      const fitsBeforeBackBy = roundTripMin <= availableDuration;

      const arrivalMin = (leaveMin + legMin) % 720;
      const arrivalStr = formatHHMM(arrivalMin);

      const openStatus = checkShopOpen(shop.hours, targetDay, arrivalMin);
      const markOpacity = fitsBeforeBackBy ? 1.0 : 0.35;

      let dotHtml = "";
      let labelColor = "#777777";

      if (openStatus === true) {
        labelColor = "#2b8a3e";
        dotHtml = `
          <div style="
            width: 8px;
            height: 8px;
            background: #2b8a3e;
            border-radius: 50%;
            border: 1px solid #ffffff;
            box-shadow: 0 0 0 1px #2b8a3e;
            box-sizing: border-box;
          "></div>
        `;
      } else if (openStatus === false) {
        labelColor = "#c92a2a";
        dotHtml = `
          <div style="
            width: 8px;
            height: 8px;
            background: #ffffff;
            border-radius: 50%;
            border: 2px solid #c92a2a;
            box-sizing: border-box;
          "></div>
        `;
      } else {
        labelColor = "#777777";
        dotHtml = `
          <div style="
            width: 8px;
            height: 8px;
            background: #ffffff;
            border-radius: 50%;
            border: 1.5px dashed #777777;
            box-sizing: border-box;
          "></div>
        `;
      }

      const targetRingHtml = isTarget
        ? `<div style="
            position: absolute;
            top: -4px;
            left: -4px;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: 2.5px solid #d9480f;
            box-sizing: border-box;
            pointer-events: none;
          "></div>`
        : "";

      const labelHtml = isInside
        ? `<div style="
            position: absolute;
            left: 11px;
            top: -5px;
            font-family: ui-monospace, SF Mono, Menlo, monospace;
            font-size: 10px;
            font-weight: 600;
            line-height: 1;
            color: ${labelColor};
            background: rgba(255,255,255,0.85);
            padding: 1px 3px;
            border-radius: 2px;
            white-space: nowrap;
            pointer-events: none;
            box-shadow: 0 1px 2px rgba(0,0,0,0.06);
          ">${arrivalStr}</div>`
        : "";

      const icon = L.divIcon({
        className: "custom-shop-pin",
        html: `
          <div style="
            position: relative;
            width: 8px;
            height: 8px;
            opacity: ${markOpacity};
            cursor: pointer;
          ">
            ${targetRingHtml}
            ${dotHtml}
            ${labelHtml}
          </div>
        `,
        iconSize: [8, 8],
        iconAnchor: [4, 4],
      });

      const marker = L.marker([lat, lon], {
        icon,
        zIndexOffset: isTarget ? 600 : isInside ? 300 : 50,
      }).addTo(map);

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (onSelectShop) onSelectShop(idx);
      });
      marker.on("mouseover", () => {
        if (onHoverShop) onHoverShop(shop);
      });
      marker.on("mouseout", () => {
        if (onHoverShop) onHoverShop(null);
      });

      return marker;
    });

    shopMarkersRef.current = markers;
  }, [data, radiusKm, targetIndex, leaveMin, backByMin, targetDay, mode]);

  React.useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    const currentMap = regionLayersRef.current;
    const newIds = new Set(regions.map((r) => r.id));

    currentMap.forEach((entry, id) => {
      if (!newIds.has(id)) {
        entry.polygon.remove();
        entry.label.remove();
        entry.handles.forEach((h) => h.remove());
        currentMap.delete(id);
      }
    });

    regions.forEach((reg) => {
      const isHighlighted = reg.id === highlightedRegionId;
      const strokeColor = isHighlighted ? "#d9480f" : "#111111";
      const strokeWidth = isHighlighted ? 2 : 1;
      const fillColor = isHighlighted ? "#d9480f" : "#111111";
      const fillOpacity = isHighlighted ? 0.16 : 0.08;

      let entry = currentMap.get(reg.id);

      if (!entry) {
        const polygon = L.polygon(reg.vertices, {
          color: strokeColor,
          weight: strokeWidth,
          fillColor,
          fillOpacity,
          interactive: true,
        }).addTo(map);

        polygon.on("dblclick", (e) => {
          L.DomEvent.stopPropagation(e);
          if (propsRef.current.onDeleteRegion) {
            propsRef.current.onDeleteRegion(reg.id);
          }
        });

        const labelCenter = polygon.getBounds().getCenter();
        const labelMarker = L.marker(labelCenter, {
          icon: L.divIcon({
            className: "region-name-tag",
            html: `<div style="transform:translate(-50%, -50%); font-family:system-ui,-apple-system,sans-serif; font-size:11px; font-weight:600; color:${strokeColor}; background:rgba(255,255,255,0.85); border:1px solid ${strokeColor}; padding:0px 4px; border-radius:2px; pointer-events:none; white-space:nowrap;">${reg.name}</div>`,
            iconSize: [0, 0],
          }),
          interactive: false,
        }).addTo(map);

        const handles = reg.vertices.map((v) => {
          const hIcon = L.divIcon({
            className: "region-handle-marker",
            html: `
              <div style="width:20px; height:20px; margin-left:-10px; margin-top:-10px; display:flex; align-items:center; justify-content:center; cursor:grab;">
                <div style="width:7px; height:7px; border-radius:50%; background:#111111; border:1.5px solid #ffffff; box-shadow:0 0 0 1px #d9d9d9;"></div>
              </div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });

          const handle = L.marker(v, {
            icon: hIcon,
            draggable: true,
            zIndexOffset: 800,
          }).addTo(map);

          handle.on("dragstart", () => {
            map.dragging.disable();
          });

          handle.on("drag", () => {
            const currentEntry = regionLayersRef.current.get(reg.id);
            if (!currentEntry) return;
            const curPts = currentEntry.handles.map((h) => {
              const ll = h.getLatLng();
              return [ll.lat, ll.lng];
            });
            currentEntry.polygon.setLatLngs(curPts);
            currentEntry.label.setLatLng(currentEntry.polygon.getBounds().getCenter());
          });

          handle.on("dragend", () => {
            map.dragging.enable();
            const currentEntry = regionLayersRef.current.get(reg.id);
            if (!currentEntry) return;
            const finalPts = currentEntry.handles.map((h) => {
              const ll = h.getLatLng();
              return [ll.lat, ll.lng];
            });
            if (propsRef.current.onUpdateRegionVertices) {
              propsRef.current.onUpdateRegionVertices(reg.id, finalPts);
            }
          });

          return handle;
        });

        currentMap.set(reg.id, {
          polygon,
          label: labelMarker,
          handles,
          verticesCount: reg.vertices.length,
        });
      } else {
        entry.polygon.setStyle({
          color: strokeColor,
          weight: strokeWidth,
          fillColor,
          fillOpacity,
        });

        entry.label.setIcon(
          L.divIcon({
            className: "region-name-tag",
            html: `<div style="transform:translate(-50%, -50%); font-family:system-ui,-apple-system,sans-serif; font-size:11px; font-weight:600; color:${strokeColor}; background:rgba(255,255,255,0.85); border:1px solid ${strokeColor}; padding:0px 4px; border-radius:2px; pointer-events:none; white-space:nowrap;">${reg.name}</div>`,
            iconSize: [0, 0],
          })
        );

        if (entry.verticesCount !== reg.vertices.length) {
          entry.handles.forEach((h) => h.remove());
          entry.handles = reg.vertices.map((v) => {
            const hIcon = L.divIcon({
              className: "region-handle-marker",
              html: `
                <div style="width:20px; height:20px; margin-left:-10px; margin-top:-10px; display:flex; align-items:center; justify-content:center; cursor:grab;">
                  <div style="width:7px; height:7px; border-radius:50%; background:#111111; border:1.5px solid #ffffff; box-shadow:0 0 0 1px #d9d9d9;"></div>
                </div>
              `,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            });
            const handle = L.marker(v, {
              icon: hIcon,
              draggable: true,
              zIndexOffset: 800,
            }).addTo(map);

            handle.on("dragstart", () => map.dragging.disable());
            handle.on("drag", () => {
              const curE = regionLayersRef.current.get(reg.id);
              if (!curE) return;
              const curPts = curE.handles.map((h) => {
                const ll = h.getLatLng();
                return [ll.lat, ll.lng];
              });
              curE.polygon.setLatLngs(curPts);
              curE.label.setLatLng(curE.polygon.getBounds().getCenter());
            });
            handle.on("dragend", () => {
              map.dragging.enable();
              const curE = regionLayersRef.current.get(reg.id);
              if (!curE) return;
              const finalPts = curE.handles.map((h) => {
                const ll = h.getLatLng();
                return [ll.lat, ll.lng];
              });
              if (propsRef.current.onUpdateRegionVertices) {
                propsRef.current.onUpdateRegionVertices(reg.id, finalPts);
              }
            });
            return handle;
          });
          entry.verticesCount = reg.vertices.length;
        } else {
          reg.vertices.forEach((v, idx) => {
            entry.handles[idx].setLatLng(v);
          });
        }

        entry.polygon.setLatLngs(reg.vertices);
        entry.label.setLatLng(entry.polygon.getBounds().getCenter());
      }
    });
  }, [regions, highlightedRegionId]);

  return (
    <div
      ref={mapDivRef}
      style={{
        flex: 1,
        width: "100%",
        height: "100%",
        minHeight: 0,
        backgroundColor: "#f2f2f2",
        position: "relative",
        outline: "none",
      }}
    />
  );
};

export const TimeDial = ({
  React,
  leaveMin,
  backByMin,
  targetShop,
  targetDay,
  mode = "bike",
  onModeChange,
  onLeaveChange,
  onBackByChange,
  onDayChange,
}) => {
  const dialRef = React.useRef(null);
  const activeHandleRef = React.useRef("leave");
  const draggingHandleRef = React.useRef(null);

  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const rRim = 86;
  const rTrip = 74;

  const minToAngle = (m) => ((m % 720) / 720) * 2 * Math.PI;

  const minToXY = (m, r) => {
    const angle = minToAngle(m) - Math.PI / 2;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const getPointerMin = (e) => {
    if (!dialRef.current) return 0;
    const rect = dialRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - cx;
    const y = e.clientY - rect.top - cy;
    let rad = Math.atan2(y, x) + Math.PI / 2;
    if (rad < 0) rad += 2 * Math.PI;
    const totalMin = (rad / (2 * Math.PI)) * 720;
    return Math.round(totalMin) % 720;
  };

  const startDrag = (handleType, e) => {
    e.preventDefault();
    e.stopPropagation();
    activeHandleRef.current = handleType;
    draggingHandleRef.current = handleType;
    if (dialRef.current) dialRef.current.focus();

    const handlePointerMove = (moveEvt) => {
      const min = getPointerMin(moveEvt);
      if (draggingHandleRef.current === "leave") {
        onLeaveChange(min);
      } else if (draggingHandleRef.current === "back") {
        onBackByChange(min);
      }
    };

    const handlePointerUp = () => {
      draggingHandleRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? 15 : -15;
      if (activeHandleRef.current === "leave") {
        const next = (((leaveMin + delta) % 720) + 720) % 720;
        onLeaveChange(next);
      } else {
        const next = (((backByMin + delta) % 720) + 720) % 720;
        onBackByChange(next);
      }
    }
  };

  const wedgePath = React.useMemo(() => {
    const startA = minToAngle(leaveMin) - Math.PI / 2;
    let diff = backByMin - leaveMin;
    if (diff < 0) diff += 720;
    if (diff === 0) return "";
    const sweepFlag = 1;
    const largeArc = diff > 360 ? 1 : 0;
    const endA = startA + (diff / 720) * 2 * Math.PI;

    const x1 = cx + rRim * Math.cos(startA);
    const y1 = cy + rRim * Math.sin(startA);
    const x2 = cx + rRim * Math.cos(endA);
    const y2 = cy + rRim * Math.sin(endA);

    return `M ${cx} ${cy} L ${x1} ${y1} A ${rRim} ${rRim} 0 ${largeArc} ${sweepFlag} ${x2} ${y2} Z`;
  }, [leaveMin, backByMin, cx, cy, rRim]);

  const tripParts = React.useMemo(() => {
    if (!targetShop) return null;
    const legMin = Math.round(targetShop[`${mode}_min`] ?? 0);
    const legBack = Math.round(targetShop[`${mode}_back`] ?? legMin);
    const totalTripMin = legMin + 10 + legBack;

    const arriveShopMin = leaveMin + legMin;
    const returnMin = leaveMin + totalTripMin;

    let availableDuration = backByMin - leaveMin;
    if (availableDuration < 0) availableDuration += 720;

    const inkEndMin = Math.min(returnMin, leaveMin + availableDuration);
    const redEndMin = returnMin;

    const createArcPath = (mStart, mEnd, r) => {
      if (mEnd <= mStart) return "";
      const dMin = mEnd - mStart;
      const aStart = minToAngle(mStart) - Math.PI / 2;
      const aEnd = aStart + (dMin / 720) * 2 * Math.PI;
      const largeArc = dMin > 360 ? 1 : 0;
      const x1 = cx + r * Math.cos(aStart);
      const y1 = cy + r * Math.sin(aStart);
      const x2 = cx + r * Math.cos(aEnd);
      const y2 = cy + r * Math.sin(aEnd);
      return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
    };

    const inkPath = createArcPath(leaveMin, inkEndMin, rTrip);
    const redPath = redEndMin > inkEndMin ? createArcPath(inkEndMin, redEndMin, rTrip) : "";

    const arrAngle = minToAngle(arriveShopMin) - Math.PI / 2;
    const arrInner = {
      x: cx + (rTrip - 4) * Math.cos(arrAngle),
      y: cy + (rTrip - 4) * Math.sin(arrAngle),
    };
    const arrOuter = {
      x: cx + (rTrip + 4) * Math.cos(arrAngle),
      y: cy + (rTrip + 4) * Math.sin(arrAngle),
    };

    const arrText = {
      x: cx + (rTrip - 13) * Math.cos(arrAngle),
      y: cy + (rTrip - 13) * Math.sin(arrAngle),
    };

    const backRimAngle = minToAngle(returnMin) - Math.PI / 2;
    const backRimInner = {
      x: cx + (rRim - 5) * Math.cos(backRimAngle),
      y: cy + (rRim - 5) * Math.sin(backRimAngle),
    };
    const backRimOuter = {
      x: cx + (rRim + 5) * Math.cos(backRimAngle),
      y: cy + (rRim + 5) * Math.sin(backRimAngle),
    };

    const isShopOpen = checkShopOpen(
      targetShop.hours,
      targetDay,
      arriveShopMin % 720
    );
    const openLabel =
      isShopOpen === true ? "open" : isShopOpen === false ? "closed" : "hours unlisted";

    const makesIt = totalTripMin <= availableDuration;
    const diffMinutes = Math.abs(availableDuration - totalTripMin);

    return {
      inkPath,
      redPath,
      arrInner,
      arrOuter,
      arrText,
      backRimInner,
      backRimOuter,
      arrHhmm: formatHHMM(arriveShopMin),
      backHhmm: formatHHMM(returnMin),
      openLabel,
      makesIt,
      diffMinutes,
      legMin,
      legBack,
    };
  }, [leaveMin, backByMin, targetShop, targetDay, mode, cx, cy, rTrip, rRim]);

  const leavePos = minToXY(leaveMin, rRim);
  const backPos = minToXY(backByMin, rRim);

  const leaveTextPos = minToXY(leaveMin, rRim + 20);
  const backTextPos = minToXY(backByMin, rRim + 20);

  const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  return (
    <div
      ref={dialRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        width: 300,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "12px 10px 10px 10px",
        boxSizing: "border-box",
        borderLeft: "1px solid #d9d9d9",
        backgroundColor: "#ffffff",
        outline: "none",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      <ModeSwitch mode={mode} onChange={onModeChange} />

      <svg
        width={size}
        height={size}
        style={{ overflow: "visible", flexShrink: 0, touchAction: "none" }}
      >
        {wedgePath && <path d={wedgePath} fill="#f2f2f2" opacity={0.7} />}

        <circle cx={cx} cy={cy} r={rRim} fill="none" stroke="#d9d9d9" strokeWidth="1" />

        {Array.from({ length: 12 }).map((_, h) => {
          const a = (h / 12) * 2 * Math.PI - Math.PI / 2;
          const isMajor = h % 3 === 0;
          const tickLen = isMajor ? 6 : 3;
          const x1 = cx + (rRim - tickLen) * Math.cos(a);
          const y1 = cy + (rRim - tickLen) * Math.sin(a);
          const x2 = cx + rRim * Math.cos(a);
          const y2 = cy + rRim * Math.sin(a);

          let numeral = null;
          if (isMajor) {
            const numR = rRim - 15;
            const nx = cx + numR * Math.cos(a);
            const ny = cy + numR * Math.sin(a);
            numeral = (
              <text
                key={`num-${h}`}
                x={nx}
                y={ny}
                textAnchor="middle"
                dominantBaseline="central"
                style={{
                  fontSize: 10,
                  fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                  fill: "#777777",
                }}
              >
                {h}
              </text>
            );
          }

          return (
            <g key={`tick-grp-${h}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isMajor ? "#111111" : "#bbbbbb"}
                strokeWidth={isMajor ? 1.5 : 1}
              />
              {numeral}
            </g>
          );
        })}

        {tripParts && (
          <g>
            {tripParts.inkPath && (
              <path
                d={tripParts.inkPath}
                fill="none"
                stroke="#111111"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
            {tripParts.redPath && (
              <path
                d={tripParts.redPath}
                fill="none"
                stroke="#c92a2a"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
            <line
              x1={tripParts.arrInner.x}
              y1={tripParts.arrInner.y}
              x2={tripParts.arrOuter.x}
              y2={tripParts.arrOuter.y}
              stroke="#111111"
              strokeWidth="1.5"
            />
            <text
              x={tripParts.arrText.x}
              y={tripParts.arrText.y}
              textAnchor="middle"
              dominantBaseline="central"
              style={{
                fontSize: 9,
                fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                fill: "#111111",
                fontWeight: 600,
              }}
            >
              {tripParts.arrHhmm}
            </text>

            <line
              x1={tripParts.backRimInner.x}
              y1={tripParts.backRimInner.y}
              x2={tripParts.backRimOuter.x}
              y2={tripParts.backRimOuter.y}
              stroke="#111111"
              strokeWidth="1.5"
              strokeDasharray="2, 2"
            />
          </g>
        )}

        <text
          x={leaveTextPos.x}
          y={leaveTextPos.y}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: 11,
            fill: "#111111",
            fontWeight: 600,
            pointerEvents: "none",
          }}
        >
          {formatHHMM(leaveMin)}
        </text>

        <text
          x={backTextPos.x}
          y={backTextPos.y}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: 11,
            fill: "#d9480f",
            fontWeight: 600,
            pointerEvents: "none",
          }}
        >
          {formatHHMM(backByMin)}
        </text>

        <g
          transform={`translate(${leavePos.x}, ${leavePos.y})`}
          style={{ cursor: "grab" }}
          onPointerDown={(e) => startDrag("leave", e)}
        >
          <circle cx={0} cy={0} r={14} fill="transparent" />
          <circle cx={0} cy={0} r={4.5} fill="#111111" stroke="#ffffff" strokeWidth="1.5" />
        </g>

        <g
          transform={`translate(${backPos.x}, ${backPos.y})`}
          style={{ cursor: "grab" }}
          onPointerDown={(e) => startDrag("back", e)}
        >
          <circle cx={0} cy={0} r={14} fill="transparent" />
          <circle cx={0} cy={0} r={4.5} fill="#d9480f" stroke="#ffffff" strokeWidth="1.5" />
        </g>
      </svg>

      {tripParts && targetShop ? (
        <div
          style={{
            width: "100%",
            textAlign: "center",
            marginTop: 8,
            marginBottom: 8,
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: 10.5,
            lineHeight: 1.45,
            color: "#111111",
          }}
        >
          <div
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={`leave ${formatHHMM(leaveMin)} → ${targetShop.name.toLowerCase()} ${tripParts.arrHhmm} · ${tripParts.openLabel} → 10 min → back ${tripParts.backHhmm}`}
          >
            leave {formatHHMM(leaveMin)} → {targetShop.name.toLowerCase()} {tripParts.arrHhmm} · {tripParts.openLabel} → 10 min → back {tripParts.backHhmm}
          </div>
          <div
            style={{
              fontWeight: 600,
              color: tripParts.makesIt ? "#2b8a3e" : "#c92a2a",
              marginTop: 2,
            }}
          >
            {tripParts.diffMinutes} min {tripParts.makesIt ? "before" : "after"} {formatHHMM(backByMin)}
          </div>
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            textAlign: "center",
            marginTop: 8,
            marginBottom: 8,
            fontSize: 11,
            color: "#777777",
          }}
        >
          no target selected
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 4,
          justifyContent: "center",
          width: "100%",
          marginTop: "auto",
        }}
      >
        {days.map((dayLabel, idx) => {
          const isActive = idx === targetDay;
          return (
            <button
              key={dayLabel}
              onClick={() => onDayChange(idx)}
              style={{
                width: 30,
                height: 24,
                border: "1px solid #d9d9d9",
                background: isActive ? "#111111" : "#ffffff",
                color: isActive ? "#ffffff" : "#111111",
                fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
                fontSize: 11,
                cursor: "pointer",
                padding: 0,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {dayLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default function Widget({ model, React }) {
  const [data, setData] = React.useState(() => model.get("data") || []);
  const [reach, setReach] = React.useState(() => model.get("reach") || null);
  const [routes, setRoutes] = React.useState(() => model.get("routes") || null);
  const [radiusKm, setRadiusKm] = React.useState(() => model.get("radius_km") || 3.5);

  const [mode, setMode] = React.useState(() => model.get("mode") || "bike");

  const [leaveMin, setLeaveMin] = React.useState(() => {
    const w = model.get("when");
    return w && w.hhmm ? parseHHMM(w.hhmm) : 390;
  });
  const [backByMin, setBackByMin] = React.useState(() => {
    const b = model.get("back_by");
    return b ? parseHHMM(b) : 525;
  });
  const [targetIndex, setTargetIndex] = React.useState(() => {
    const t = model.get("target");
    return typeof t === "number" ? t : 2;
  });
  const [targetDay, setTargetDay] = React.useState(() => {
    const w = model.get("when");
    return w && typeof w.day === "number" ? w.day : 0;
  });

  const [regionsList, setRegionsList] = React.useState([]);
  const [highlightedRegionId, setHighlightedRegionId] = React.useState(null);
  const [hoveredShop, setHoveredShop] = React.useState(null);

  const hotel = React.useMemo(() => [29.7522, -95.3578], []);

  React.useEffect(() => {
    const handleDataChange = () => setData(model.get("data") || []);
    const handleReachChange = () => setReach(model.get("reach") || null);
    const handleRoutesChange = () => setRoutes(model.get("routes") || null);
    const handleModeChange = () => {
      const m = model.get("mode");
      if (m && (m === "walk" || m === "bike" || m === "drive")) {
        setMode(m);
      }
    };

    model.on("change:data", handleDataChange);
    model.on("change:reach", handleReachChange);
    model.on("change:routes", handleRoutesChange);
    model.on("change:mode", handleModeChange);

    return () => {
      model.off("change:data", handleDataChange);
      model.off("change:reach", handleReachChange);
      model.off("change:routes", handleRoutesChange);
      model.off("change:mode", handleModeChange);
    };
  }, [model]);

  const handleAddRegion = React.useCallback((vertices) => {
    setRegionsList((prev) => {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const name = getRegionName(prev.length);
      return [...prev, { id, name, vertices }];
    });
  }, []);

  const handleUpdateRegionVertices = React.useCallback((id, newVertices) => {
    setRegionsList((prev) =>
      prev.map((r) => (r.id === id ? { ...r, vertices: newVertices } : r))
    );
  }, []);

  const handleDeleteRegion = React.useCallback((id) => {
    setRegionsList((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      return filtered.map((r, idx) => ({ ...r, name: getRegionName(idx) }));
    });
  }, []);

  const { insideIndices, insideCount, independentCount, openOnArrivalIndices, openAndBackCount } =
    React.useMemo(() => {
      const hotelLat = hotel[0];
      const hotelLon = hotel[1];
      const rad = radiusKm;

      const inside = [];
      const openArr = [];
      let indep = 0;
      let openAndBack = 0;

      const availableDuration =
        backByMin >= leaveMin ? backByMin - leaveMin : 720 - leaveMin + backByMin;

      const deg2rad = Math.PI / 180;
      (data || []).forEach((row, idx) => {
        const lat = row.lat;
        const lon = row.lon;
        const dLat = (lat - hotelLat) * deg2rad;
        const dLon = (lon - hotelLon) * deg2rad;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(hotelLat * deg2rad) *
            Math.cos(lat * deg2rad) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const dKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        if (dKm <= rad) {
          inside.push(idx);
          if (!row.chain) indep += 1;

          const legMin = row[`${mode}_min`] ?? 0;
          const legBack = row[`${mode}_back`] ?? legMin;
          const roundTripMin = legMin + 10 + legBack;
          const arrivalMin = (leaveMin + legMin) % 720;
          const isOpen = checkShopOpen(row.hours, targetDay, arrivalMin);

          if (isOpen === true) {
            openArr.push(idx);
            if (roundTripMin <= availableDuration) {
              openAndBack += 1;
            }
          }
        }
      });

      return {
        insideIndices: inside,
        insideCount: inside.length,
        independentCount: indep,
        openOnArrivalIndices: openArr,
        openAndBackCount: openAndBack,
      };
    }, [data, radiusKm, hotel, leaveMin, backByMin, targetDay, mode]);

  const { regionStats, regionsDict } = React.useMemo(() => {
    const stats = [];
    const dict = {};

    regionsList.forEach((reg) => {
      const shopIndices = [];
      let nIndep = 0;
      let nOpen = 0;
      let minArrivalMin = Infinity;

      (data || []).forEach((row, idx) => {
        const pt = [row.lat, row.lon];
        if (pointInPolygon(pt, reg.vertices)) {
          shopIndices.push(idx);
          if (!row.chain) nIndep += 1;

          const legMin = row[`${mode}_min`] ?? 0;
          const arrivalMin = (leaveMin + legMin) % 720;
          const isOpen = checkShopOpen(row.hours, targetDay, arrivalMin);
          if (isOpen === true) nOpen += 1;

          if (arrivalMin < minArrivalMin) {
            minArrivalMin = arrivalMin;
          }
        }
      });

      dict[reg.name] = shopIndices;
      stats.push({
        id: reg.id,
        name: reg.name,
        nShops: shopIndices.length,
        nIndep,
        nOpen,
        earliestArrival: minArrivalMin !== Infinity ? formatHHMM(minArrivalMin) : "—",
      });
    });

    return { regionStats: stats, regionsDict: dict };
  }, [regionsList, data, leaveMin, targetDay, mode]);

  const targetShop = data && data[targetIndex] ? data[targetIndex] : null;

  const { backHhmm, makesIt } = React.useMemo(() => {
    if (!targetShop) {
      return { backHhmm: formatHHMM(leaveMin), makesIt: true };
    }
    const legMin = Math.round(targetShop[`${mode}_min`] ?? 0);
    const legBack = Math.round(targetShop[`${mode}_back`] ?? legMin);
    const totalTripMin = legMin + 10 + legBack;
    const returnMin = leaveMin + totalTripMin;

    let availableDuration = backByMin - leaveMin;
    if (availableDuration < 0) availableDuration += 720;

    return {
      backHhmm: formatHHMM(returnMin),
      makesIt: totalTripMin <= availableDuration,
    };
  }, [targetShop, mode, leaveMin, backByMin]);

  React.useEffect(() => {
    model.set("inside", insideIndices);
    model.set("radius_km", radiusKm);
    model.set("open_on_arrival", openOnArrivalIndices);
    model.set("when", { day: targetDay, hhmm: formatHHMM(leaveMin) });
    model.set("back_by", formatHHMM(backByMin));
    model.set("target", targetIndex);
    model.set("regions", regionsDict);
    model.set("mode", mode);
    model.set("back_hhmm", backHhmm);
    model.set("makes_it", makesIt);
    model.save_changes();
  }, [
    insideIndices,
    radiusKm,
    openOnArrivalIndices,
    targetDay,
    leaveMin,
    backByMin,
    targetIndex,
    regionsDict,
    mode,
    backHhmm,
    makesIt,
    model,
  ]);

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        maxWidth: 960,
        margin: "0 auto",
        height: 560,
        backgroundColor: "#ffffff",
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
        boxSizing: "border-box",
        overflow: "hidden",
        border: "1px solid #d9d9d9",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          height: "100%",
          minWidth: 0,
        }}
      >
        <CountLine
          insideCount={insideCount}
          independentCount={independentCount}
          openAndBackCount={openAndBackCount}
        />
        <HoverCard
          shop={hoveredShop}
          leaveMin={leaveMin}
          targetDay={targetDay}
          mode={mode}
        />

        <div style={{ flex: 1, position: "relative", width: "100%", minHeight: 0 }}>
          <MapContainer
            React={React}
            data={data}
            reach={reach}
            routes={routes}
            mode={mode}
            hotel={hotel}
            radiusKm={radiusKm}
            targetIndex={targetIndex}
            leaveMin={leaveMin}
            backByMin={backByMin}
            targetDay={targetDay}
            regions={regionsList}
            highlightedRegionId={highlightedRegionId}
            onRadiusChange={setRadiusKm}
            onSelectShop={setTargetIndex}
            onHoverShop={setHoveredShop}
            onAddRegion={handleAddRegion}
            onUpdateRegionVertices={handleUpdateRegionVertices}
            onDeleteRegion={handleDeleteRegion}
          />
        </div>

        <RegionsTable
          regions={regionStats}
          highlightedRegionId={highlightedRegionId}
          onHoverRegion={setHighlightedRegionId}
        />
      </div>

      <TimeDial
        React={React}
        leaveMin={leaveMin}
        backByMin={backByMin}
        targetShop={targetShop}
        targetDay={targetDay}
        mode={mode}
        onModeChange={setMode}
        onLeaveChange={setLeaveMin}
        onBackByChange={setBackByMin}
        onDayChange={setTargetDay}
      />
    </div>
  );
}