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

// Helper: parse minutes to 'HH:MM' string
function formatHHMM(totalMinutes) {
  const norm = ((Math.round(totalMinutes) % 720) + 720) % 720;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Convert 'HH:MM' to minutes [0, 720)
function parseHHMM(str) {
  if (!str) return 0;
  const parts = str.split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

// Parse OSM hours: returns true (open), false (closed), null (unknown)
// targetDay: 0=Mo, 1=Tu, ..., 6=Su
// arrivalMin: minutes from midnight (0..1439). Notice 12-hour dial morning: 00:00 - 12:00
function checkShopOpen(hoursStr, targetDay, arrivalMin) {
  if (!hoursStr || typeof hoursStr !== "string") return null;
  const trimmed = hoursStr.trim();
  if (trimmed === "") return null;
  if (trimmed === "24/7") return true;

  const dayMap = { mo: 0, tu: 1, we: 2, th: 3, fr: 4, sa: 5, su: 6 };
  const rules = trimmed.split(";").map((s) => s.trim()).filter(Boolean);

  let matchedAnyDayRule = false;

  for (const rule of rules) {
    // Examples: "Mo-Sa 04:00-14:00", "Su 05:00-14:00", "05:00-20:00", "Tu-Fr 10:00-18:00"
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
        // spans midnight
        if (arrivalMin >= startMin || arrivalMin < endMin) return true;
      }
    }
  }

  return matchedAnyDayRule ? false : null;
}

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

export const HoverCard = ({ shop, leaveMin, targetDay }) => {
  if (!shop) return null;
  const isChain = Boolean(shop.chain);
  const bikeMin = shop.bike_min ?? 0;
  const arrivalMin = (leaveMin + bikeMin) % 720;
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

export const MapContainer = ({
  React,
  data = [],
  reach = null,
  hotel = [29.7522, -95.3578],
  radiusKm = 3.5,
  targetIndex = 2,
  leaveMin = 390,
  backByMin = 525,
  targetDay = 0,
  onRadiusChange,
  onSelectShop,
  onHoverShop,
}) => {
  const mapDivRef = React.useRef(null);
  const leafletMapRef = React.useRef(null);
  const circleRef = React.useRef(null);
  const handleMarkerRef = React.useRef(null);
  const edgeLabelMarkerRef = React.useRef(null);
  const shopMarkersRef = React.useRef([]);
  const reachLayerRef = React.useRef(null);
  const isDraggingRef = React.useRef(false);

  // Initialize Map
  React.useEffect(() => {
    ensureLeafletCss();
    if (!mapDivRef.current) return;

    const map = L.map(mapDivRef.current, {
      center: hotel,
      zoom: 13,
      zoomControl: false,
    });
    leafletMapRef.current = map;

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a> &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    // Hotel fixed ink pin
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

    // Initial radius circle
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

    // Edge label marker at East edge
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
      }
    };
    const onMapMouseUp = () => {
      if (circleDragging) {
        circleDragging = false;
        map.dragging.enable();
      }
    };

    circle.on("mousedown", (e) => {
      const dist = hotelLatLng.distanceTo(e.latlng);
      const currentRadiusM = circle.getRadius();
      if (Math.abs(dist - currentRadiusM) < Math.max(300, currentRadiusM * 0.25)) {
        circleDragging = true;
        map.dragging.disable();
        L.DomEvent.stopPropagation(e);
      }
    });

    map.on("mousemove", onMapMouseMove);
    map.on("mouseup", onMapMouseUp);

    return () => {
      map.off("mousemove", onMapMouseMove);
      map.off("mouseup", onMapMouseUp);
      map.remove();
      leafletMapRef.current = null;
    };
  }, []);

  // Sync reach polygons (bike reach: 30, 20, 10 min bands under shops, circle on top)
  React.useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    if (reachLayerRef.current) {
      reachLayerRef.current.remove();
      reachLayerRef.current = null;
    }

    if (!reach || !reach.bike) return;

    // reach.bike geojson: contours typically 30, 20, 10
    // Darker the closer: 30 min -> opacity 0.08, 20 min -> 0.14, 10 min -> 0.22
    const bikeGeo = reach.bike;
    const layer = L.geoJSON(bikeGeo, {
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

    // Bring circle to front so km circle stays on top of reach bands
    if (circleRef.current) {
      circleRef.current.bringToFront();
    }
    reachLayerRef.current = layer;
  }, [reach]);

  // Synchronize edge label & circle position if external radiusKm updates
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

  // Update shop markers
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

      const bikeMin = shop.bike_min ?? 0;
      const bikeBack = shop.bike_back ?? bikeMin;
      const roundTripMin = bikeMin + 10 + bikeBack;
      const fitsBeforeBackBy = roundTripMin <= availableDuration;

      const arrivalMin = (leaveMin + bikeMin) % 720;
      const arrivalStr = formatHHMM(arrivalMin);

      const openStatus = checkShopOpen(shop.hours, targetDay, arrivalMin);

      // Opacity: 35% if round trip does not fit before BACK BY
      const markOpacity = fitsBeforeBackBy ? 1.0 : 0.35;

      let dotHtml = "";
      let labelColor = "#777777";

      if (openStatus === true) {
        // Open: solid dot and green label
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
        // Closed: hollow ring and red label
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
        // Unknown: dashed ring and grey label
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

      // If this shop is the target: thick ring around it (accent #d9480f)
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

      // Label with arrival time if inside circle
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
  }, [data, radiusKm, targetIndex, leaveMin, backByMin, targetDay]);

  return (
    <div
      ref={mapDivRef}
      style={{
        flex: 1,
        height: "100%",
        backgroundColor: "#f2f2f2",
        position: "relative",
        outline: "none",
      }}
    />
  );
};

// 12-Hour Dial Component
export const TimeDial = ({
  React,
  leaveMin,
  backByMin,
  targetShop,
  targetDay,
  onLeaveChange,
  onBackByChange,
  onDayChange,
}) => {
  const dialRef = React.useRef(null);
  const activeHandleRef = React.useRef("leave"); // "leave" | "back"
  const draggingHandleRef = React.useRef(null);

  // SVG Geometry
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const rRim = 86; // outer rim radius
  const rTrip = 74; // trip arc radius inside rim

  // Minute [0, 720) to angle in radians clockwise from top (12 o'clock)
  const minToAngle = (m) => ((m % 720) / 720) * 2 * Math.PI;

  const minToXY = (m, r) => {
    const angle = minToAngle(m) - Math.PI / 2;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  // Convert pointer event to minute [0, 720)
  const getPointerMin = (e) => {
    if (!dialRef.current) return 0;
    const rect = dialRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - cx;
    const y = e.clientY - rect.top - cy;
    let rad = Math.atan2(y, x) + Math.PI / 2;
    if (rad < 0) rad += 2 * Math.PI;
    const totalMin = (rad / (2 * Math.PI)) * 720;
    // Snap to nearest minute or 5 minutes? Free-form minutes, clamped to [0, 720)
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

  // Keyboard navigation on dial focus
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

  // Build SVG path for the faint wedge between LEAVE and BACK BY
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

  // Trip arc calculation
  // rides just inside the rim from LEAVE to LEAVE + bike_min + 10 + bike_back
  // tick & label at LEAVE + bike_min
  // any part of the arc past BACK BY is red (#c92a2a), earlier part is ink (#111111)
  const tripParts = React.useMemo(() => {
    if (!targetShop) return null;
    const bikeMin = targetShop.bike_min ?? 0;
    const bikeBack = targetShop.bike_back ?? bikeMin;
    const totalTripMin = bikeMin + 10 + bikeBack;

    const arriveShopMin = leaveMin + bikeMin;
    const returnMin = leaveMin + totalTripMin;

    // Available duration between LEAVE and BACK BY
    let availableDuration = backByMin - leaveMin;
    if (availableDuration < 0) availableDuration += 720;

    // Arc from leaveMin to Math.min(returnMin, leaveMin + availableDuration) -> ink
    // Arc from that point to returnMin -> red
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

    // Arrival tick coordinates on trip arc
    const arrAngle = minToAngle(arriveShopMin) - Math.PI / 2;
    const arrInner = {
      x: cx + (rTrip - 4) * Math.cos(arrAngle),
      y: cy + (rTrip - 4) * Math.sin(arrAngle),
    };
    const arrOuter = {
      x: cx + (rTrip + 4) * Math.cos(arrAngle),
      y: cy + (rTrip + 4) * Math.sin(arrAngle),
    };

    // Arrival text position slightly inset
    const arrText = {
      x: cx + (rTrip - 13) * Math.cos(arrAngle),
      y: cy + (rTrip - 13) * Math.sin(arrAngle),
    };

    return {
      inkPath,
      redPath,
      arrInner,
      arrOuter,
      arrText,
      arrHhmm: formatHHMM(arriveShopMin),
    };
  }, [leaveMin, backByMin, targetShop, cx, cy, rTrip]);

  // Coordinates for LEAVE and BACK BY handles on rim
  const leavePos = minToXY(leaveMin, rRim);
  const backPos = minToXY(backByMin, rRim);

  // Label text outside the rim
  const leaveTextPos = minToXY(leaveMin, rRim + 20);
  const backTextPos = minToXY(backByMin, rRim + 20);

  const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  return (
    <div
      ref={dialRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        width: 280,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "16px 12px 12px 12px",
        boxSizing: "border-box",
        borderLeft: "1px solid #d9d9d9",
        backgroundColor: "#ffffff",
        outline: "none",
        userSelect: "none",
      }}
    >
      {/* 12-Hour Dial SVG */}
      <svg
        width={size}
        height={size}
        style={{ overflow: "visible", flexShrink: 0, touchAction: "none" }}
      >
        {/* Faint wedge between LEAVE and BACK BY */}
        {wedgePath && <path d={wedgePath} fill="#f2f2f2" opacity={0.7} />}

        {/* Outer Rim */}
        <circle cx={cx} cy={cy} r={rRim} fill="none" stroke="#d9d9d9" strokeWidth="1" />

        {/* Hour Ticks and Numerals at 0, 3, 6, 9 */}
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

        {/* Target's Trip Arc inside rim */}
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
            {/* Arrival tick and hh:mm text */}
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
          </g>
        )}

        {/* Outside HH:MM Labels */}
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

        {/* LEAVE Handle (ink) */}
        <g
          transform={`translate(${leavePos.x}, ${leavePos.y})`}
          style={{ cursor: "grab" }}
          onPointerDown={(e) => startDrag("leave", e)}
        >
          {/* Hit area */}
          <circle cx={0} cy={0} r={14} fill="transparent" />
          <circle cx={0} cy={0} r={4.5} fill="#111111" stroke="#ffffff" strokeWidth="1.5" />
        </g>

        {/* BACK BY Handle (accent) */}
        <g
          transform={`translate(${backPos.x}, ${backPos.y})`}
          style={{ cursor: "grab" }}
          onPointerDown={(e) => startDrag("back", e)}
        >
          {/* Hit area */}
          <circle cx={0} cy={0} r={14} fill="transparent" />
          <circle cx={0} cy={0} r={4.5} fill="#d9480f" stroke="#ffffff" strokeWidth="1.5" />
        </g>
      </svg>

      {/* Target Shop Name in one line */}
      <div
        style={{
          width: "100%",
          textAlign: "center",
          marginTop: 10,
          marginBottom: 14,
          fontSize: 12,
          fontWeight: 600,
          color: "#111111",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={targetShop ? targetShop.name : ""}
      >
        {targetShop ? targetShop.name : "no target selected"}
      </div>

      {/* Day Buttons Row: Mo Tu We Th Fr Sa Su */}
      <div
        style={{
          display: "flex",
          gap: 4,
          justifyContent: "center",
          width: "100%",
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
  const [radiusKm, setRadiusKm] = React.useState(() => model.get("radius_km") || 3.5);

  // Targets and Times
  // LEAVE starts at 06:30 (390 min)
  // BACK BY starts at 08:45 (525 min)
  // target starts with data row 2
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
    return w && typeof w.day === "number" ? w.day : 0; // Monday
  });

  const [hoveredShop, setHoveredShop] = React.useState(null);

  const hotel = React.useMemo(() => [29.7522, -95.3578], []);

  // Listen to inputs
  React.useEffect(() => {
    const handleDataChange = () => setData(model.get("data") || []);
    const handleReachChange = () => setReach(model.get("reach") || null);

    model.on("change:data", handleDataChange);
    model.on("change:reach", handleReachChange);

    return () => {
      model.off("change:data", handleDataChange);
      model.off("change:reach", handleReachChange);
    };
  }, [model]);

  // Compute metrics: inside, independent, open and back in time
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

          const bikeMin = row.bike_min ?? 0;
          const bikeBack = row.bike_back ?? bikeMin;
          const roundTripMin = bikeMin + 10 + bikeBack;
          const arrivalMin = (leaveMin + bikeMin) % 720;
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
    }, [data, radiusKm, hotel, leaveMin, backByMin, targetDay]);

  // Sync outputs to Python model
  React.useEffect(() => {
    model.set("inside", insideIndices);
    model.set("radius_km", radiusKm);
    model.set("open_on_arrival", openOnArrivalIndices);
    model.set("when", { day: targetDay, hhmm: formatHHMM(leaveMin) });
    model.set("back_by", formatHHMM(backByMin));
    model.set("target", targetIndex);
    model.save_changes();
  }, [
    insideIndices,
    radiusKm,
    openOnArrivalIndices,
    targetDay,
    leaveMin,
    backByMin,
    targetIndex,
    model,
  ]);

  const targetShop = data && data[targetIndex] ? data[targetIndex] : null;

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
      <div style={{ flex: 1, position: "relative", height: "100%" }}>
        <CountLine
          insideCount={insideCount}
          independentCount={independentCount}
          openAndBackCount={openAndBackCount}
        />
        <HoverCard shop={hoveredShop} leaveMin={leaveMin} targetDay={targetDay} />
        <MapContainer
          React={React}
          data={data}
          reach={reach}
          hotel={hotel}
          radiusKm={radiusKm}
          targetIndex={targetIndex}
          leaveMin={leaveMin}
          backByMin={backByMin}
          targetDay={targetDay}
          onRadiusChange={setRadiusKm}
          onSelectShop={setTargetIndex}
          onHoverShop={setHoveredShop}
        />
      </div>

      <TimeDial
        React={React}
        leaveMin={leaveMin}
        backByMin={backByMin}
        targetShop={targetShop}
        targetDay={targetDay}
        onLeaveChange={setLeaveMin}
        onBackByChange={setBackByMin}
        onDayChange={setTargetDay}
      />
    </div>
  );
}