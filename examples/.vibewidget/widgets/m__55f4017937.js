import L from "https://esm.sh/leaflet@1.9.4";

// Inject Leaflet CSS once
const LEAFLET_CSS_ID = "leaflet-css-bundle-style";
if (typeof document !== "undefined" && !document.getElementById(LEAFLET_CSS_ID)) {
  const link = document.createElement("link");
  link.id = LEAFLET_CSS_ID;
  link.rel = "stylesheet";
  link.href = "https://esm.sh/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

const HOTEL = { lat: 29.7522, lon: -95.3578 };
const INITIAL_RADIUS_KM = 3.5;
const ACCENT_COLOR = "#d9480f";
const INK_COLOR = "#111111";
const GREY_COLOR = "#777777";
const HAIRLINE_COLOR = "#d9d9d9";

// Haversine formula to compute distance in km
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Compute lat/lon destination given start, bearing (degrees), distance (km)
function destinationPoint(lat, lon, bearingDeg, distKm) {
  const R = 6371.0;
  const rad = Math.PI / 180;
  const phi1 = lat * rad;
  const lam1 = lon * rad;
  const theta = bearingDeg * rad;
  const d_R = distKm / R;

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(d_R) +
      Math.cos(phi1) * Math.sin(d_R) * Math.cos(theta)
  );
  const lam2 =
    lam1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(d_R) * Math.cos(phi1),
      Math.cos(d_R) - Math.sin(phi1) * Math.sin(phi2)
    );

  return [phi2 / rad, lam2 / rad];
}

export const CountLine = ({ insideCount, independentCount }) => (
  <div
    style={{
      position: "absolute",
      top: 14,
      left: 14,
      zIndex: 1000,
      backgroundColor: "rgba(255, 255, 255, 0.94)",
      padding: "5px 9px",
      border: `1px solid ${HAIRLINE_COLOR}`,
      fontSize: 12,
      fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
      color: INK_COLOR,
      fontVariantNumeric: "tabular-nums",
      pointerEvents: "none",
      lineHeight: "16px",
    }}
  >
    <span style={{ fontWeight: 600 }}>{insideCount}</span> inside ·{" "}
    <span style={{ fontWeight: 600 }}>{independentCount}</span> independent
  </div>
);

export const TooltipOverlay = ({ hoveredShop }) => {
  if (!hoveredShop) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 18,
        left: 14,
        zIndex: 1000,
        backgroundColor: "rgba(255, 255, 255, 0.96)",
        padding: "7px 11px",
        border: `1px solid ${HAIRLINE_COLOR}`,
        fontSize: 12,
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
        color: INK_COLOR,
        maxWidth: 320,
        pointerEvents: "none",
        lineHeight: "17px",
      }}
    >
      <div style={{ fontWeight: 600 }}>{hoveredShop.name}</div>
      {hoveredShop.street && (
        <div style={{ color: GREY_COLOR, fontSize: 11 }}>{hoveredShop.street}</div>
      )}
      {hoveredShop.hours && (
        <div
          style={{
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: 11,
            marginTop: 2,
            color: "#333333",
          }}
        >
          {hoveredShop.hours}
        </div>
      )}
    </div>
  );
};

export default function Widget({ model, React }) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const circleRef = React.useRef(null);
  const edgeHandleRef = React.useRef(null);
  const shopsLayerRef = React.useRef(null);
  const isDraggingRef = React.useRef(false);
  const radiusKmRef = React.useRef(INITIAL_RADIUS_KM);

  const [radiusKm, setRadiusKm] = React.useState(INITIAL_RADIUS_KM);
  const [counts, setCounts] = React.useState({ inside: 0, independent: 0 });
  const [hoveredShop, setHoveredShop] = React.useState(null);

  // Parse shops from model input
  const getShops = () => {
    const raw = model.get("data");
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "object") {
      // Handles columnar format or { columns, data } format
      if (Array.isArray(raw.data)) {
        const cols = raw.columns || [];
        return raw.data.map((row) => {
          const item = {};
          cols.forEach((col, i) => {
            item[col] = row[i];
          });
          return item;
        });
      }
      const keys = Object.keys(raw);
      if (keys.length > 0 && typeof raw[keys[0]] === "object") {
        const rowKeys = Object.keys(raw[keys[0]]);
        return rowKeys.map((idx) => {
          const item = {};
          keys.forEach((k) => {
            item[k] = raw[k][idx];
          });
          return item;
        });
      }
    }
    return [];
  };

  const shopsRef = React.useRef(getShops());

  // Helper: compute inside indices and counts given a radius
  const evaluateInside = (rKm) => {
    const shops = shopsRef.current;
    const insideIndices = [];
    let insideCount = 0;
    let indepCount = 0;

    for (let i = 0; i < shops.length; i++) {
      const s = shops[i];
      const dist =
        s.km_from_hotel != null
          ? s.km_from_hotel
          : distanceKm(HOTEL.lat, HOTEL.lon, s.lat, s.lon);
      if (dist <= rKm) {
        insideIndices.push(i);
        insideCount++;
        if (!s.chain) indepCount++;
      }
    }
    return { insideIndices, insideCount, independentCount: indepCount };
  };

  // Sync to model
  const syncOutput = (rKm, insideIndices) => {
    model.set("radius_km", parseFloat(rKm.toFixed(2)));
    model.set("inside", insideIndices);
    model.save_changes();
  };

  // Update shop marker styles imperatively without re-creating Leaflet elements
  const updateShopStyles = (rKm) => {
    const layer = shopsLayerRef.current;
    if (!layer) return;
    const shops = shopsRef.current;
    const layers = layer.getLayers();

    layers.forEach((marker) => {
      const idx = marker.__shopIndex;
      const s = shops[idx];
      if (!s) return;
      const dist =
        s.km_from_hotel != null
          ? s.km_from_hotel
          : distanceKm(HOTEL.lat, HOTEL.lon, s.lat, s.lon);
      const isInside = dist <= rKm;

      if (isInside) {
        if (!s.chain) {
          // Independent: accent solid dot
          marker.setStyle({
            radius: 5.5,
            fillColor: ACCENT_COLOR,
            color: "#ffffff",
            weight: 1.5,
            opacity: 1,
            fillOpacity: 1,
          });
        } else {
          // Chain inside: grey solid dot
          marker.setStyle({
            radius: 5,
            fillColor: GREY_COLOR,
            color: "#ffffff",
            weight: 1.2,
            opacity: 1,
            fillOpacity: 1,
          });
        }
      } else {
        // Outside circle: faded small dot
        marker.setStyle({
          radius: 3,
          fillColor: GREY_COLOR,
          color: HAIRLINE_COLOR,
          weight: 0.8,
          opacity: 0.45,
          fillOpacity: 0.35,
        });
      }
    });
  };

  // Update handle position and label
  const updateHandleAndCircle = (rKm) => {
    if (circleRef.current) {
      circleRef.current.setRadius(rKm * 1000);
    }
    if (edgeHandleRef.current) {
      const handlePos = destinationPoint(HOTEL.lat, HOTEL.lon, 90, rKm);
      edgeHandleRef.current.setLatLng(handlePos);
      const labelText = `${rKm.toFixed(1)} km`;
      edgeHandleRef.current.setTooltipContent(
        `<span style="font-family:system-ui,-apple-system,sans-serif;font-size:11px;font-variant-numeric:tabular-nums;color:${INK_COLOR};padding:1px 3px;font-weight:500;">${labelText}</span>`
      );
    }
  };

  // Main Leaflet setup effect
  React.useEffect(() => {
    if (!containerRef.current) return;

    // Initialize map
    const map = L.map(containerRef.current, {
      center: [HOTEL.lat, HOTEL.lon],
      zoom: 12,
      zoomControl: false,
    });
    mapRef.current = map;

    // Zoom control at bottom right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Light grey Esri canvas basemap
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 16,
        attribution: "Esri, HERE, Garmin, OpenStreetMap contributors",
      }
    ).addTo(map);

    // Hotel fixed ink pin
    const hotelIcon = L.divIcon({
      className: "hotel-pin-icon",
      html: `
        <svg width="24" height="24" viewBox="0 0 24 24" style="overflow:visible;display:block;">
          <circle cx="12" cy="12" r="5" fill="${INK_COLOR}" stroke="#ffffff" stroke-width="1.5" />
          <line x1="12" y1="17" x2="12" y2="22" stroke="${INK_COLOR}" stroke-width="2" stroke-linecap="round" />
        </svg>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 22],
    });

    L.marker([HOTEL.lat, HOTEL.lon], {
      icon: hotelIcon,
      interactive: true,
      zIndexOffset: 1000,
    })
      .bindTooltip("hotel", {
        permanent: false,
        direction: "top",
        offset: [0, -20],
        className: "hotel-tooltip",
      })
      .addTo(map);

    // Circle centered on hotel
    const circle = L.circle([HOTEL.lat, HOTEL.lon], {
      radius: radiusKmRef.current * 1000,
      color: INK_COLOR,
      weight: 1.5,
      opacity: 0.85,
      fillColor: INK_COLOR,
      fillOpacity: 0.04,
      interactive: true,
    }).addTo(map);
    circleRef.current = circle;

    // Draggable edge handle on the eastern rim of the circle
    const handlePos = destinationPoint(
      HOTEL.lat,
      HOTEL.lon,
      90,
      radiusKmRef.current
    );
    const handleIcon = L.divIcon({
      className: "edge-handle-icon",
      html: `
        <div style="width:24px;height:24px;margin:-12px 0 0 -12px;display:flex;align-items:center;justify-content:center;cursor:ew-resize;">
          <div style="width:9px;height:9px;border-radius:50%;background:${INK_COLOR};border:1.5px solid #ffffff;box-sizing:border-box;"></div>
        </div>
      `,
      iconSize: [0, 0],
    });

    const edgeHandle = L.marker(handlePos, {
      icon: handleIcon,
      draggable: true,
      zIndexOffset: 1200,
    }).addTo(map);
    edgeHandleRef.current = edgeHandle;

    edgeHandle.bindTooltip(
      `<span style="font-family:system-ui,-apple-system,sans-serif;font-size:11px;font-variant-numeric:tabular-nums;color:${INK_COLOR};padding:1px 3px;font-weight:500;">${radiusKmRef.current.toFixed(
        1
      )} km</span>`,
      {
        permanent: true,
        direction: "right",
        offset: [10, 0],
        className: "edge-radius-tooltip",
      }
    );

    // Dragging helper
    const applyNewRadius = (newR) => {
      const clamped = Math.max(0.4, Math.min(25, newR));
      radiusKmRef.current = clamped;
      updateHandleAndCircle(clamped);
      updateShopStyles(clamped);
      const evalRes = evaluateInside(clamped);
      setCounts({
        inside: evalRes.insideCount,
        independent: evalRes.independentCount,
      });
      setRadiusKm(clamped);
      syncOutput(clamped, evalRes.insideIndices);
    };

    // Edge handle dragging events
    edgeHandle.on("dragstart", () => {
      isDraggingRef.current = true;
      map.dragging.disable();
    });

    edgeHandle.on("drag", (e) => {
      const latlng = e.target.getLatLng();
      const dist = distanceKm(HOTEL.lat, HOTEL.lon, latlng.lat, latlng.lng);
      applyNewRadius(dist);
    });

    edgeHandle.on("dragend", (e) => {
      isDraggingRef.current = false;
      map.dragging.enable();
      const latlng = e.target.getLatLng();
      const dist = distanceKm(HOTEL.lat, HOTEL.lon, latlng.lat, latlng.lng);
      applyNewRadius(dist);
    });

    // Also support dragging anywhere along the circle edge
    let circleEdgeDragging = false;
    circle.on("mousedown", (e) => {
      const clickedDist = distanceKm(
        HOTEL.lat,
        HOTEL.lon,
        e.latlng.lat,
        e.latlng.lng
      );
      // If clicking near the perimeter (within 20% or 0.5km of edge)
      const diff = Math.abs(clickedDist - radiusKmRef.current);
      if (diff < Math.max(0.4, radiusKmRef.current * 0.18)) {
        circleEdgeDragging = true;
        map.dragging.disable();
        applyNewRadius(clickedDist);
      }
    });

    const onMapMouseMove = (e) => {
      if (circleEdgeDragging) {
        const dist = distanceKm(
          HOTEL.lat,
          HOTEL.lon,
          e.latlng.lat,
          e.latlng.lng
        );
        applyNewRadius(dist);
      }
    };

    const onMapMouseUp = () => {
      if (circleEdgeDragging) {
        circleEdgeDragging = false;
        map.dragging.enable();
      }
    };

    map.on("mousemove", onMapMouseMove);
    map.on("mouseup", onMapMouseUp);

    // Shops layer
    const shopsGroup = L.layerGroup().addTo(map);
    shopsLayerRef.current = shopsGroup;

    const shops = shopsRef.current;
    shops.forEach((shop, index) => {
      const marker = L.circleMarker([shop.lat, shop.lon], {
        radius: 5,
        fillColor: GREY_COLOR,
        color: "#ffffff",
        weight: 1,
        fillOpacity: 1,
      });
      marker.__shopIndex = index;

      marker.on("mouseover", () => {
        setHoveredShop(shop);
        marker.bringToFront();
      });

      marker.on("mouseout", () => {
        setHoveredShop(null);
      });

      marker.addTo(shopsGroup);
    });

    // Initial styling and outputs
    updateShopStyles(radiusKmRef.current);
    const initialEval = evaluateInside(radiusKmRef.current);
    setCounts({
      inside: initialEval.insideCount,
      independent: initialEval.independentCount,
    });
    syncOutput(radiusKmRef.current, initialEval.insideIndices);

    // Handle data trait changes if upstream updates
    const onDataChange = () => {
      shopsRef.current = getShops();
      shopsGroup.clearLayers();
      shopsRef.current.forEach((shop, index) => {
        const marker = L.circleMarker([shop.lat, shop.lon], {
          radius: 5,
          fillColor: GREY_COLOR,
          color: "#ffffff",
          weight: 1,
          fillOpacity: 1,
        });
        marker.__shopIndex = index;
        marker.on("mouseover", () => {
          setHoveredShop(shop);
          marker.bringToFront();
        });
        marker.on("mouseout", () => {
          setHoveredShop(null);
        });
        marker.addTo(shopsGroup);
      });
      updateShopStyles(radiusKmRef.current);
      const res = evaluateInside(radiusKmRef.current);
      setCounts({ inside: res.insideCount, independent: res.independentCount });
      syncOutput(radiusKmRef.current, res.insideIndices);
    };

    model.on("change:data", onDataChange);

    return () => {
      model.off("change:data", onDataChange);
      map.off("mousemove", onMapMouseMove);
      map.off("mouseup", onMapMouseUp);
      map.remove();
    };
  }, []);

  return (
    <div
      style={{
        width: "100%",
        backgroundColor: "#ffffff",
        padding: 12,
        boxSizing: "border-box",
        position: "relative",
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
      }}
    >
      <style>{`
        .edge-radius-tooltip {
          background: rgba(255, 255, 255, 0.95) !important;
          border: 1px solid ${HAIRLINE_COLOR} !important;
          box-shadow: none !important;
          padding: 2px 6px !important;
          border-radius: 0 !important;
        }
        .edge-radius-tooltip::before {
          border-right-color: ${HAIRLINE_COLOR} !important;
        }
        .hotel-tooltip {
          background: ${INK_COLOR} !important;
          color: #ffffff !important;
          border: none !important;
          box-shadow: none !important;
          padding: 2px 6px !important;
          font-size: 11px !important;
          font-family: system-ui, -apple-system, Inter, Helvetica, sans-serif !important;
          border-radius: 0 !important;
        }
        .hotel-tooltip::before {
          border-top-color: ${INK_COLOR} !important;
        }
        .leaflet-container {
          background-color: #f2f2f2;
          font-family: inherit;
        }
        .leaflet-bar {
          border-radius: 0 !important;
          border: 1px solid ${HAIRLINE_COLOR} !important;
          box-shadow: none !important;
        }
        .leaflet-bar a {
          border-radius: 0 !important;
          color: ${INK_COLOR} !important;
          border-bottom: 1px solid ${HAIRLINE_COLOR} !important;
        }
        .leaflet-bar a:last-child {
          border-bottom: none !important;
        }
        .leaflet-control-attribution {
          background: rgba(255, 255, 255, 0.85) !important;
          color: ${GREY_COLOR} !important;
          font-size: 10px !important;
        }
      `}</style>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: 560,
          border: `1px solid ${HAIRLINE_COLOR}`,
          overflow: "hidden",
        }}
      >
        <CountLine
          insideCount={counts.inside}
          independentCount={counts.independent}
        />
        <TooltipOverlay hoveredShop={hoveredShop} />
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}