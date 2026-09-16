import L from "https://esm.sh/leaflet@1.9.4";

// Ensure Leaflet CSS is injected once into document head
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

export const MapContainer = ({
  React,
  data = [],
  hotel = [29.7522, -95.3578],
  radiusKm = 3.5,
  onRadiusChange,
  onHoverShop,
}) => {
  const mapDivRef = React.useRef(null);
  const leafletMapRef = React.useRef(null);
  const circleRef = React.useRef(null);
  const handleMarkerRef = React.useRef(null);
  const edgeLabelMarkerRef = React.useRef(null);
  const shopMarkersRef = React.useRef([]);
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

    // Zoom control at bottom-right per theme specification
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Light grey basemap (CARTO Positron)
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }
    ).addTo(map);

    // Hotel fixed ink pin
    const hotelIcon = L.divIcon({
      className: "hotel-pin",
      html: `
        <div style="position:relative; width:14px; height:14px; transform:translate(-7px, -7px); pointer-events:auto;" title="Hotel (lat 29.7522, lon -95.3578)">
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
      fillOpacity: 0.08,
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

    // Radius drag handle marker on circle edge (also whole circle edge is draggable)
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

    // Interactive circle edge dragging
    const hotelLatLng = L.latLng(hotel[0], hotel[1]);

    const updateRadiusFromLatLng = (targetLatLng) => {
      const distMeters = hotelLatLng.distanceTo(targetLatLng);
      const clampedKm = Math.max(0.4, Math.min(25.0, distMeters / 1000));
      const newRadiusM = clampedKm * 1000;

      // Update circle visually
      circle.setRadius(newRadiusM);

      // Place handle and label along hotel -> targetLatLng bearing, or keep along the direction
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

    // Dragging handle directly
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

    // Dragging anywhere on circle edge or circle border
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
      // Check if click was near the circle's border edge
      const dist = hotelLatLng.distanceTo(e.latlng);
      const currentRadiusM = circle.getRadius();
      // If clicked near edge (within 18% or 300m)
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

  // Update shop markers when data or radius changes
  React.useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    // Clear previous markers
    shopMarkersRef.current.forEach((m) => m.remove());
    shopMarkersRef.current = [];

    const hotelLatLng = L.latLng(hotel[0], hotel[1]);
    const radiusMeters = radiusKm * 1000;

    const markers = (data || []).map((shop, idx) => {
      const lat = shop.lat;
      const lon = shop.lon;
      const shopLatLng = L.latLng(lat, lon);
      const distMeters = hotelLatLng.distanceTo(shopLatLng);
      const isInside = distMeters <= radiusMeters;
      const isChain = Boolean(shop.chain);

      // Marker style:
      // Inside circle: solid dots (accent #d9480f when chain is False, grey #777777 when True)
      // Outside circle: faded small dots
      let dotSize = 8;
      let dotColor = "#777777";
      let dotOpacity = 0.95;
      let strokeColor = "#ffffff";
      let strokeWidth = 1.5;

      if (isInside) {
        dotSize = 9;
        if (!isChain) {
          dotColor = "#d9480f"; // accent for independent
        } else {
          dotColor = "#777777"; // grey for chain
        }
        strokeColor = "#ffffff";
        strokeWidth = 1.5;
        dotOpacity = 1.0;
      } else {
        dotSize = 5;
        dotColor = isChain ? "#aaaaaa" : "#e07a5f";
        dotOpacity = 0.35;
        strokeWidth = 0.5;
        strokeColor = "#ffffff";
      }

      const icon = L.divIcon({
        className: "shop-dot-icon",
        html: `
          <div style="
            width:${dotSize}px;
            height:${dotSize}px;
            transform:translate(-${dotSize / 2}px, -${dotSize / 2}px);
            border-radius:50%;
            background-color:${dotColor};
            opacity:${dotOpacity};
            border:${strokeWidth}px solid ${strokeColor};
            cursor:pointer;
            box-sizing:border-box;
          "></div>
        `,
        iconSize: [dotSize, dotSize],
        iconAnchor: [dotSize / 2, dotSize / 2],
      });

      const marker = L.marker([lat, lon], {
        icon,
        zIndexOffset: isInside ? (isChain ? 100 : 200) : 10,
      }).addTo(map);

      marker.on("mouseover", () => {
        if (onHoverShop) onHoverShop(shop);
      });
      marker.on("mouseout", () => {
        if (onHoverShop) onHoverShop(null);
      });

      return marker;
    });

    shopMarkersRef.current = markers;
  }, [data, radiusKm]);

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

  return (
    <div
      ref={mapDivRef}
      style={{
        width: "100%",
        height: 560,
        backgroundColor: "#f2f2f2",
        position: "relative",
        outline: "none",
      }}
    />
  );
};

export const CountLine = ({ insideCount, independentCount }) => (
  <div
    style={{
      position: "absolute",
      top: 14,
      left: 14,
      zIndex: 1000,
      background: "rgba(255, 255, 255, 0.94)",
      border: "1px solid #d9d9d9",
      padding: "5px 10px",
      fontSize: "12px",
      fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
      color: "#111111",
      lineHeight: 1.4,
      fontVariantNumeric: "tabular-nums",
      pointerEvents: "none",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    }}
  >
    <span style={{ fontWeight: 600 }}>{insideCount}</span> inside ·{" "}
    <span style={{ fontWeight: 600 }}>{independentCount}</span> independent
  </div>
);

export const HoverCard = ({ shop }) => {
  if (!shop) return null;
  const isChain = Boolean(shop.chain);
  return (
    <div
      style={{
        position: "absolute",
        bottom: 18,
        left: 14,
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
      {shop.hours && (
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
      )}
      {!shop.hours && (
        <div style={{ color: "#777777", fontSize: "11px", marginTop: 3 }}>
          hours unlisted
        </div>
      )}
    </div>
  );
};

export default function Widget({ model, React }) {
  const [data, setData] = React.useState(() => model.get("data") || []);
  const [radiusKm, setRadiusKm] = React.useState(3.5);
  const [hoveredShop, setHoveredShop] = React.useState(null);

  const hotel = React.useMemo(() => [29.7522, -95.3578], []);

  // Listen to data trait updates from Python model
  React.useEffect(() => {
    const handleDataChange = () => {
      setData(model.get("data") || []);
    };
    model.on("change:data", handleDataChange);
    return () => {
      model.off("change:data", handleDataChange);
    };
  }, [model]);

  // Compute shops inside circle and independent count
  const { insideIndices, insideCount, independentCount } = React.useMemo(() => {
    const hotelLat = hotel[0];
    const hotelLon = hotel[1];
    const rad = radiusKm;

    const indices = [];
    let indep = 0;

    // Haversine distance in km
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
        indices.push(idx);
        if (!row.chain) {
          indep += 1;
        }
      }
    });

    return {
      insideIndices: indices,
      insideCount: indices.length,
      independentCount: indep,
    };
  }, [data, radiusKm, hotel]);

  // Sync outputs to Python model
  React.useEffect(() => {
    model.set("inside", insideIndices);
    model.set("radius_km", radiusKm);
    model.save_changes();
  }, [insideIndices, radiusKm, model]);

  const handleRadiusChange = React.useCallback((newR) => {
    setRadiusKm(newR);
  }, []);

  return (
    <div
      style={{
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
      <CountLine insideCount={insideCount} independentCount={independentCount} />
      <HoverCard shop={hoveredShop} />
      <MapContainer
        React={React}
        data={data}
        hotel={hotel}
        radiusKm={radiusKm}
        onRadiusChange={handleRadiusChange}
        onHoverShop={setHoveredShop}
      />
    </div>
  );
}