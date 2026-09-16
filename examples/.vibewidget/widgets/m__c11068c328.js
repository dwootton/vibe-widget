import * as d3 from "https://esm.sh/d3@7";
import L from "https://esm.sh/leaflet@1.9.4";

export const Badge = ({ insideCount = 0, independentCount = 0 }) => (
  <div
    style={{
      position: "absolute",
      top: 14,
      left: 14,
      zIndex: 1000,
      background: "rgba(253, 251, 247, 0.94)",
      backdropFilter: "blur(6px)",
      border: "1px solid #1c1917",
      boxShadow: "3px 3px 0px #1c1917",
      padding: "8px 14px",
      borderRadius: "4px",
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: "13px",
      fontWeight: "700",
      letterSpacing: "0.02em",
      color: "#1c1917",
      pointerEvents: "none",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    }}
  >
    <span
      style={{
        display: "inline-block",
        width: "9px",
        height: "9px",
        borderRadius: "50%",
        background: "#ea580c",
      }}
    />
    <span>
      {insideCount} inside <span style={{ opacity: 0.45 }}>·</span>{" "}
      {independentCount} independent
    </span>
  </div>
);

export const Legend = () => (
  <div
    style={{
      position: "absolute",
      bottom: 16,
      right: 14,
      zIndex: 1000,
      background: "rgba(253, 251, 247, 0.94)",
      backdropFilter: "blur(6px)",
      border: "1px solid #292524",
      padding: "8px 12px",
      borderRadius: "4px",
      boxShadow: "2px 2px 0px #292524",
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: "11px",
      color: "#1c1917",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      pointerEvents: "auto",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#ea580c",
          border: "1px solid #9a3412",
          display: "inline-block",
        }}
      />
      <span>Independent (Inside)</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#64748b",
          border: "1px solid #334155",
          display: "inline-block",
        }}
      />
      <span>Chain (Inside)</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#a8a29e",
          opacity: 0.5,
          margin: "2px",
          display: "inline-block",
        }}
      />
      <span style={{ color: "#78716c" }}>Outside Radius</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span
        style={{
          width: 8,
          height: 8,
          background: "#09090b",
          border: "1.5px solid #fafaf9",
          outline: "1px solid #09090b",
          borderRadius: "2px",
          display: "inline-block",
          transform: "rotate(45deg)",
          margin: "1px 2px",
        }}
      />
      <span style={{ fontWeight: 600 }}>Hotel (Center)</span>
    </div>
  </div>
);

export const InfoTooltip = ({ shop }) => {
  if (!shop) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 14,
        right: 14,
        zIndex: 1000,
        maxWidth: "280px",
        background: "#fdfbf7",
        border: "1px solid #1c1917",
        boxShadow: "3px 3px 0px #1c1917",
        padding: "10px 14px",
        borderRadius: "4px",
        fontFamily: "'Courier New', Courier, monospace",
        color: "#1c1917",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "15px",
          fontWeight: "700",
          marginBottom: "4px",
          lineHeight: "1.2",
          color: "#0c0a09",
        }}
      >
        {shop.name}
      </div>
      <div style={{ fontSize: "11px", color: "#57534e", marginBottom: "4px" }}>
        {shop.street ? shop.street : "Street not listed"}
      </div>
      <div
        style={{
          fontSize: "10.5px",
          color: shop.hours ? "#292524" : "#a8a29e",
          borderTop: "1px dashed #d6d3d1",
          paddingTop: "4px",
          marginTop: "4px",
        }}
      >
        {shop.hours ? `Hours: ${shop.hours}` : "Hours unlisted"}
      </div>
      <div
        style={{
          fontSize: "10.5px",
          marginTop: "5px",
          display: "flex",
          justifyContent: "space-between",
          color: "#ea580c",
          fontWeight: "bold",
        }}
      >
        <span>{shop.chain ? "Chain" : "Independent"}</span>
        <span>{shop.km_from_hotel != null ? `${Number(shop.km_from_hotel).toFixed(2)} km` : ""}</span>
      </div>
    </div>
  );
};

export default function Widget({ model, React }) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const hotelPos = React.useMemo(() => [29.7522, -95.3578], []);

  // Parse input data safely
  const rawData = model.get("data");
  const data = React.useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    if (typeof rawData === "object") {
      const keys = Object.keys(rawData);
      if (keys.length === 0) return [];
      const len = Array.isArray(rawData[keys[0]])
        ? rawData[keys[0]].length
        : Object.keys(rawData[keys[0]]).length;
      const rows = [];
      for (let i = 0; i < len; i++) {
        const row = {};
        for (const k of keys) {
          row[k] = rawData[k][i] !== undefined ? rawData[k][i] : rawData[k][String(i)];
        }
        rows.push(row);
      }
      return rows;
    }
    return [];
  }, [rawData]);

  const [hoveredShop, setHoveredShop] = React.useState(null);
  const [stats, setStats] = React.useState({ insideCount: 0, independentCount: 0 });

  // Refs for gesture / mutable map objects without rebuilding map
  const circleRef = React.useRef(null);
  const hitCircleRef = React.useRef(null);
  const handleMarkerRef = React.useRef(null);
  const shopMarkersRef = React.useRef([]);
  const radiusKmRef = React.useRef(3.5);
  const isDraggingRef = React.useRef(false);

  // Initialize CSS stylesheet for leaflet & custom markers once
  React.useEffect(() => {
    const linkId = "leaflet-css-bundle";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://esm.sh/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const styleId = "leaflet-custom-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        .leaflet-grab { cursor: grab; }
        .leaflet-dragging .leaflet-grab { cursor: grabbing; }
        .radius-label-handle {
          background: transparent !important;
          border: none !important;
          user-select: none;
        }
        .radius-badge-pill {
          background: #1c1917;
          color: #fafaf9;
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 12px;
          white-space: nowrap;
          border: 1.5px solid #ea580c;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          cursor: ew-resize;
          transform: translate(-50%, -50%);
          display: inline-block;
          pointer-events: auto;
          transition: transform 0.1s ease, background 0.1s ease;
        }
        .radius-badge-pill:hover, .radius-badge-pill.active {
          transform: translate(-50%, -50%) scale(1.12);
          background: #ea580c;
          color: #ffffff;
        }
        .hotel-pin-custom {
          background: #09090b;
          border: 2px solid #fdfbf7;
          border-radius: 50% 50% 50% 0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          transform: rotate(-45deg);
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Compute position along circle's right perimeter for the drag handle & label
  const getPerimeterPoint = React.useCallback((centerLatLng, radiusMeters, bearingDeg = 90) => {
    const R = 6378137; // Earth's radius in meters
    const δ = radiusMeters / R;
    const θ = (bearingDeg * Math.PI) / 180;
    const φ1 = (centerLatLng[0] * Math.PI) / 180;
    const λ1 = (centerLatLng[1] * Math.PI) / 180;

    const φ2 = Math.asin(
      Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
    );
    const λ2 =
      λ1 +
      Math.atan2(
        Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
        Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
      );

    return [(φ2 * 180) / Math.PI, (λ2 * 180) / Math.PI];
  }, []);

  // Update shop marker styling and sync traits
  const updateVisualState = React.useCallback(
    (currentRadiusKm) => {
      const hotelLatLng = L.latLng(hotelPos[0], hotelPos[1]);
      const currentRadiusMeters = currentRadiusKm * 1000;
      const insideIndices = [];
      let insideCount = 0;
      let independentCount = 0;

      shopMarkersRef.current.forEach(({ marker, shop, index }) => {
        const d = hotelLatLng.distanceTo(L.latLng(shop.lat, shop.lon));
        const isInside = d <= currentRadiusMeters;

        if (isInside) {
          insideIndices.push(index);
          insideCount += 1;
          if (!shop.chain) independentCount += 1;

          marker.setStyle({
            radius: 6,
            fillColor: shop.chain ? "#64748b" : "#ea580c",
            color: shop.chain ? "#1e293b" : "#7c2d12",
            weight: 1.5,
            opacity: 0.95,
            fillOpacity: 0.88,
          });
          marker.bringToFront();
        } else {
          marker.setStyle({
            radius: 3.5,
            fillColor: "#a8a29e",
            color: "#78716c",
            weight: 1,
            opacity: 0.35,
            fillOpacity: 0.3,
          });
        }
      });

      // Update badge counts in local state
      setStats({ insideCount, independentCount });

      // Sync outputs to Python widget model
      model.set("radius_km", Math.round(currentRadiusKm * 100) / 100);
      model.set("inside", insideIndices);
      model.save_changes();
    },
    [hotelPos, model]
  );

  // Initialize outputs on mount
  React.useEffect(() => {
    model.set("radius_km", 3.5);
    model.set("inside", []);
    model.save_changes();
  }, [model]);

  // Map Setup Effect
  React.useEffect(() => {
    if (!containerRef.current) return;

    // Create Leaflet Map
    const map = L.map(containerRef.current, {
      center: [hotelPos[0], hotelPos[1] - 0.01],
      zoom: 13,
      zoomControl: false,
    });
    mapRef.current = map;

    // Add Zoom Control bottom-left
    L.control.zoom({ position: "bottomleft" }).addTo(map);

    // OpenStreetMap standard tile layer
    const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Dark Hotel Pin
    const hotelIcon = L.divIcon({
      className: "hotel-pin-wrapper",
      html: `
        <div style="position: relative; width: 22px; height: 22px;">
          <div class="hotel-pin-custom" style="width: 18px; height: 18px; position: absolute; top: 0; left: 2px;"></div>
          <div style="position: absolute; top: 5px; left: 7px; width: 8px; height: 8px; border-radius: 50%; background: #fdfbf7;"></div>
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 20],
    });
    const hotelMarker = L.marker(hotelPos, {
      icon: hotelIcon,
      zIndexOffset: 1200,
    }).addTo(map);

    hotelMarker.bindTooltip("Hotel (Center)", {
      direction: "top",
      offset: [0, -18],
      className: "hotel-tooltip",
    });

    // Visible circle
    const circle = L.circle(hotelPos, {
      radius: radiusKmRef.current * 1000,
      color: "#ea580c",
      weight: 2.2,
      opacity: 0.9,
      fillColor: "#ea580c",
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(map);
    circleRef.current = circle;

    // Hit-testing circle for dragging anywhere along the edge (wide transparent stroke)
    const hitCircle = L.circle(hotelPos, {
      radius: radiusKmRef.current * 1000,
      color: "#ea580c",
      weight: 18,
      opacity: 0.001,
      fill: false,
      interactive: true,
      className: "leaflet-grab",
    }).addTo(map);
    hitCircleRef.current = hitCircle;

    // Interactive Drag Handle with label on edge
    const initialHandlePos = getPerimeterPoint(hotelPos, radiusKmRef.current * 1000, 90);
    const handleIcon = L.divIcon({
      className: "radius-label-handle",
      html: `<div id="radius-pill" class="radius-badge-pill">${radiusKmRef.current.toFixed(1)} km ↔</div>`,
      iconSize: [80, 24],
      iconAnchor: [40, 12],
    });

    const handleMarker = L.marker(initialHandlePos, {
      icon: handleIcon,
      draggable: true,
      zIndexOffset: 1300,
    }).addTo(map);
    handleMarkerRef.current = handleMarker;

    // Drag / Radius updates
    const applyNewRadius = (newRadiusKm) => {
      // Clamp between 0.4 km and 25 km
      const clampedKm = Math.max(0.4, Math.min(25, newRadiusKm));
      radiusKmRef.current = clampedKm;
      const meters = clampedKm * 1000;

      // Update circles
      circle.setRadius(meters);
      hitCircle.setRadius(meters);

      // Reposition pill label at 90 deg bearing
      const newPos = getPerimeterPoint(hotelPos, meters, 90);
      handleMarker.setLatLng(newPos);

      // Update pill text
      const pill = document.getElementById("radius-pill");
      if (pill) {
        pill.innerText = `${clampedKm.toFixed(1)} km ↔`;
      }

      // Update shops & outputs
      updateVisualState(clampedKm);
    };

    // Handle marker dragging
    handleMarker.on("dragstart", () => {
      isDraggingRef.current = true;
      map.dragging.disable();
      const pill = document.getElementById("radius-pill");
      if (pill) pill.classList.add("active");
    });

    handleMarker.on("drag", (e) => {
      const currentPos = e.latlng;
      const dMeters = L.latLng(hotelPos).distanceTo(currentPos);
      applyNewRadius(dMeters / 1000);
    });

    handleMarker.on("dragend", () => {
      isDraggingRef.current = false;
      map.dragging.enable();
      const pill = document.getElementById("radius-pill");
      if (pill) pill.classList.remove("active");
    });

    // Dragging anywhere along the circle edge
    hitCircle.on("mousedown", (e) => {
      isDraggingRef.current = true;
      map.dragging.disable();
      const pill = document.getElementById("radius-pill");
      if (pill) pill.classList.add("active");

      const onMouseMove = (moveEvt) => {
        if (!isDraggingRef.current) return;
        const dMeters = L.latLng(hotelPos).distanceTo(moveEvt.latlng);
        applyNewRadius(dMeters / 1000);
      };

      const onMouseUp = () => {
        isDraggingRef.current = false;
        map.dragging.enable();
        if (pill) pill.classList.remove("active");
        map.off("mousemove", onMouseMove);
        map.off("mouseup", onMouseUp);
      };

      map.on("mousemove", onMouseMove);
      map.on("mouseup", onMouseUp);
    });

    // Populate donut shop markers
    shopMarkersRef.current = [];
    data.forEach((shop, index) => {
      if (shop.lat == null || shop.lon == null) return;

      const marker = L.circleMarker([shop.lat, shop.lon], {
        radius: 5,
        fillColor: "#ea580c",
        color: "#7c2d12",
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.85,
        interactive: true,
      }).addTo(map);

      marker.on("mouseover", () => {
        setHoveredShop(shop);
        marker.setStyle({ weight: 3, color: "#1c1917" });
      });

      marker.on("mouseout", () => {
        setHoveredShop(null);
        // Reset border based on state
        const d = L.latLng(hotelPos).distanceTo(L.latLng(shop.lat, shop.lon));
        const inside = d <= radiusKmRef.current * 1000;
        marker.setStyle({
          weight: inside ? 1.5 : 1,
          color: inside ? (shop.chain ? "#1e293b" : "#7c2d12") : "#78716c",
        });
      });

      shopMarkersRef.current.push({ marker, shop, index });
    });

    // Sync initial state
    updateVisualState(radiusKmRef.current);

    // Initial view fit
    map.setView([hotelPos[0], hotelPos[1]], 12.5);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [hotelPos, getPerimeterPoint, updateVisualState, data]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "560px",
        background: "#fdfbf7",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1.5px solid #292524",
        boxShadow: "0 6px 18px rgba(0, 0, 0, 0.08)",
        fontFamily: "'Courier New', Courier, monospace",
      }}
    >
      <Badge
        insideCount={stats.insideCount}
        independentCount={stats.independentCount}
      />
      <InfoTooltip shop={hoveredShop} />
      <Legend />
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          background: "#f7f4ec",
        }}
      />
    </div>
  );
}