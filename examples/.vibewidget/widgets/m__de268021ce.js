import L from "https://esm.sh/leaflet@1.9.4";

export const MapStatsBadge = ({ countInside, countIndependent }) => (
  <div
    style={{
      position: "absolute",
      top: 14,
      left: 14,
      zIndex: 1000,
      background: "rgba(255, 255, 255, 0.94)",
      backdropFilter: "blur(6px)",
      border: "1px solid rgba(0, 0, 0, 0.08)",
      borderRadius: 6,
      padding: "6px 12px",
      boxShadow: "0 1px 4px rgba(0, 0, 0, 0.06)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: 13,
      fontWeight: 500,
      color: "#18181b",
      letterSpacing: "-0.01em",
      pointerEvents: "none",
      userSelect: "none",
    }}
  >
    <span style={{ fontWeight: 600 }}>{countInside}</span> inside
    <span style={{ margin: "0 6px", color: "#a1a1aa" }}>·</span>
    <span style={{ fontWeight: 600, color: "#d9480f" }}>{countIndependent}</span> independent
  </div>
);

function normalizeData(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (raw.columns && Array.isArray(raw.data)) {
    return raw.data.map((row) => {
      const obj = {};
      raw.columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }
  if (typeof raw === "object") {
    const cols = Object.keys(raw);
    if (cols.length === 0) return [];
    const firstCol = raw[cols[0]];
    if (Array.isArray(firstCol)) {
      return firstCol.map((_, i) => {
        const obj = {};
        cols.forEach((col) => {
          obj[col] = raw[col][i];
        });
        return obj;
      });
    }
  }
  return [];
}

function getPerimeterLatLng(centerLat, centerLon, radiusMeters, angleRad) {
  const dLat = (radiusMeters * Math.cos(angleRad)) / 111139;
  const dLon =
    (radiusMeters * Math.sin(angleRad)) /
    (111139 * Math.cos((centerLat * Math.PI) / 180));
  return [centerLat + dLat, centerLon + dLon];
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function Widget({ model, React }) {
  const [data, setData] = React.useState(() => normalizeData(model.get("data")));
  const [stats, setStats] = React.useState({ n: 0, k: 0 });

  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const dragActiveRef = React.useRef(false);
  const dragAngleRef = React.useRef(0.65);
  const radiusKmRef = React.useRef(3.5);
  const insideIndicesRef = React.useRef([]);
  const elementsRef = React.useRef({
    visualCircle: null,
    hitCircle: null,
    edgeMarker: null,
    shopRecords: [],
  });

  const hotelLat = 29.7522;
  const hotelLon = -95.3578;
  const hotelLatLng = L.latLng(hotelLat, hotelLon);

  // Sync data updates from python
  React.useEffect(() => {
    const handleDataChange = () => {
      setData(normalizeData(model.get("data")));
    };
    model.on("change:data", handleDataChange);
    return () => {
      model.off("change:data", handleDataChange);
    };
  }, [model]);

  // Leaflet CSS injection
  React.useEffect(() => {
    if (!document.getElementById("leaflet-base-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-base-css";
      link.rel = "stylesheet";
      link.href = "https://esm.sh/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
  }, []);

  // Map initialization and interaction management
  React.useEffect(() => {
    if (!containerRef.current) return;

    // Create Map
    const map = L.map(containerRef.current, {
      center: [hotelLat, hotelLon],
      zoom: 12,
      minZoom: 10,
      maxZoom: 16,
      zoomControl: false,
      attributionControl: false,
    });
    mapRef.current = map;

    // Minimal attribution control bottom-right
    L.control
      .attribution({ position: "bottomright", prefix: false })
      .addAttribution("Tiles &copy; Esri")
      .addTo(map);

    // Zoom control subtle top-right
    L.control.zoom({ position: "topright" }).addTo(map);

    // Esri Light Gray Canvas Base + Labels
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 16 }
    ).addTo(map);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 16 }
    ).addTo(map);

    // Hotel Fixed Ink Pin
    const hotelPinIcon = L.divIcon({
      className: "hotel-ink-pin",
      html: `
        <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%); pointer-events: none;">
          <div style="
            background: #09090b;
            color: #fafafa;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            padding: 2px 6px;
            border-radius: 3px;
            margin-bottom: 2px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.25);
            white-space: nowrap;
          ">Hotel</div>
          <svg width="20" height="26" viewBox="0 0 24 30" fill="none">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 8.5 12 18 12 18s12-9.5 12-18c0-6.63-5.37-12-12-12z" fill="#09090b"/>
            <circle cx="12" cy="11" r="4.5" fill="#f4f4f5"/>
          </svg>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    L.marker(hotelLatLng, { icon: hotelPinIcon, zIndexOffset: 2000, interactive: false }).addTo(map);

    // Initial radius: 3.5 km = 3500 m
    const startRadiusM = 3500;
    radiusKmRef.current = 3.5;

    // Visual boundary circle
    const visualCircle = L.circle(hotelLatLng, {
      radius: startRadiusM,
      color: "#475569",
      weight: 1.5,
      dashArray: "4, 4",
      fillColor: "#0f172a",
      fillOpacity: 0.03,
      interactive: false,
    }).addTo(map);

    // Hit area circle for edge drag
    const hitCircle = L.circle(hotelLatLng, {
      radius: startRadiusM,
      color: "transparent",
      weight: 22,
      fill: false,
      interactive: true,
    }).addTo(map);

    // Edge label marker
    const createEdgeLabelIcon = (rKm) =>
      L.divIcon({
        className: "radius-label-badge",
        html: `
          <div style="
            transform: translate(-50%, -50%);
            background: #18181b;
            color: #fafafa;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11px;
            font-weight: 500;
            padding: 2px 7px;
            border-radius: 9999px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.25);
            border: 1px solid rgba(255,255,255,0.8);
            cursor: ew-resize;
            user-select: none;
            white-space: nowrap;
          ">${rKm.toFixed(1)} km</div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

    const initPos = getPerimeterLatLng(hotelLat, hotelLon, startRadiusM, dragAngleRef.current);
    const edgeMarker = L.marker(initPos, {
      icon: createEdgeLabelIcon(3.5),
      zIndexOffset: 1500,
      interactive: true,
    }).addTo(map);

    // Build shop markers
    const shopRecords = data.map((shop, index) => {
      const sLatLng = L.latLng(shop.lat, shop.lon);
      const distKm = hotelLatLng.distanceTo(sLatLng) / 1000;
      const marker = L.circleMarker(sLatLng, {
        radius: 3.5,
        fillColor: "#94a3b8",
        color: "#94a3b8",
        weight: 0,
        fillOpacity: 0.35,
        opacity: 0.35,
      }).addTo(map);

      // Tooltip: name, street, hours
      const tooltipHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.45; color: #1e293b; min-width: 130px;">
          <div style="font-weight: 600; font-size: 13px; color: #09090b; margin-bottom: 2px;">${escapeHtml(shop.name)}</div>
          ${shop.street ? `<div style="color: #64748b; font-size: 11px;">${escapeHtml(shop.street)}</div>` : ""}
          ${shop.hours ? `<div style="color: #52525b; font-size: 11px; margin-top: 3px;">${escapeHtml(shop.hours)}</div>` : ""}
          <div style="margin-top: 4px; font-size: 10.5px; font-weight: 500; color: ${shop.chain ? "#71717a" : "#d9480f"};">
            ${shop.chain ? "Chain" : "Independent"} · ${distKm.toFixed(2)} km
          </div>
        </div>
      `;

      marker.bindTooltip(tooltipHtml, {
        direction: "top",
        offset: [0, -5],
        className: "custom-shop-tooltip",
        opacity: 0.98,
      });

      return { marker, shop, distKm, index };
    });

    elementsRef.current = {
      visualCircle,
      hitCircle,
      edgeMarker,
      shopRecords,
    };

    // Update shop marks and calculate stats
    const updateMarks = (rKm) => {
      const inside = [];
      let nInside = 0;
      let kIndependent = 0;

      shopRecords.forEach(({ marker, shop, distKm, index }) => {
        const isInside = distKm <= rKm;
        if (isInside) {
          inside.push(index);
          nInside++;
          if (!shop.chain) kIndependent++;

          marker.setStyle({
            radius: shop.chain ? 5 : 6,
            fillColor: shop.chain ? "#71717a" : "#d9480f",
            color: "#ffffff",
            weight: 1.5,
            fillOpacity: 0.95,
            opacity: 1,
          });
          marker.bringToFront();
        } else {
          marker.setStyle({
            radius: 3.5,
            fillColor: "#94a3b8",
            color: "#94a3b8",
            weight: 0,
            fillOpacity: 0.35,
            opacity: 0.35,
          });
        }
      });

      insideIndicesRef.current = inside;
      setStats({ n: nInside, k: kIndependent });
      return inside;
    };

    // Initial update and output declaration
    const initInside = updateMarks(3.5);
    model.set("radius_km", 3.5);
    model.set("inside", initInside);
    model.save_changes();

    // Drag handlers
    const startDrag = (e) => {
      L.DomEvent.stopPropagation(e);
      dragActiveRef.current = true;
      map.dragging.disable();
      if (containerRef.current) {
        containerRef.current.style.cursor = "ew-resize";
      }

      if (e.latlng) {
        dragAngleRef.current = Math.atan2(e.latlng.lng - hotelLon, e.latlng.lat - hotelLat);
      }
    };

    hitCircle.on("mousedown", startDrag);
    edgeMarker.on("mousedown", startDrag);

    hitCircle.on("mouseover", () => {
      if (!dragActiveRef.current && containerRef.current) {
        containerRef.current.style.cursor = "ew-resize";
      }
    });

    hitCircle.on("mouseout", () => {
      if (!dragActiveRef.current && containerRef.current) {
        containerRef.current.style.cursor = "";
      }
    });

    let syncTimer = null;
    const handlePointerMove = (e) => {
      if (!dragActiveRef.current) return;
      const mouseEvent = e.touches ? e.touches[0] : e;
      if (!mouseEvent) return;

      const currentLatLng = map.mouseEventToLatLng(mouseEvent);
      if (!currentLatLng) return;

      const distM = hotelLatLng.distanceTo(currentLatLng);
      const clampedMeters = Math.max(400, Math.min(22000, distM));
      const rKm = Math.round((clampedMeters / 1000) * 10) / 10;
      radiusKmRef.current = rKm;

      visualCircle.setRadius(clampedMeters);
      hitCircle.setRadius(clampedMeters);

      const angle = Math.atan2(currentLatLng.lng - hotelLon, currentLatLng.lat - hotelLat);
      dragAngleRef.current = angle;

      const newPos = getPerimeterLatLng(hotelLat, hotelLon, clampedMeters, angle);
      edgeMarker.setLatLng(newPos);
      edgeMarker.setIcon(createEdgeLabelIcon(rKm));

      const inside = updateMarks(rKm);

      // Throttled model sync during active drag
      if (!syncTimer) {
        syncTimer = setTimeout(() => {
          model.set("radius_km", rKm);
          model.set("inside", inside);
          model.save_changes();
          syncTimer = null;
        }, 80);
      }
    };

    const handlePointerUp = () => {
      if (!dragActiveRef.current) return;
      dragActiveRef.current = false;
      map.dragging.enable();
      if (containerRef.current) {
        containerRef.current.style.cursor = "";
      }

      if (syncTimer) {
        clearTimeout(syncTimer);
        syncTimer = null;
      }
      model.set("radius_km", radiusKmRef.current);
      model.set("inside", insideIndicesRef.current);
      model.save_changes();
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove, { passive: false });
    window.addEventListener("touchend", handlePointerUp);

    return () => {
      if (syncTimer) clearTimeout(syncTimer);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
      map.remove();
    };
  }, [data, model]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 560,
        overflow: "hidden",
        borderRadius: 8,
        border: "1px solid #e4e4e7",
        background: "#f4f4f5",
      }}
    >
      <style>{`
        .custom-shop-tooltip {
          background: rgba(255, 255, 255, 0.96) !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
          border-radius: 6px !important;
          padding: 6px 10px !important;
        }
        .custom-shop-tooltip::before {
          border-top-color: #e2e8f0 !important;
        }
        .leaflet-container {
          background: #f4f4f5 !important;
        }
      `}</style>

      <MapStatsBadge countInside={stats.n} countIndependent={stats.k} />

      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}