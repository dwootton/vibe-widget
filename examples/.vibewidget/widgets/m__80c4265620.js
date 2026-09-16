import L from "https://esm.sh/leaflet@1.9.4";

// Ensure Leaflet styles exist
function injectLeafletStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById("leaflet-base-styles")) return;
  const link = document.createElement("link");
  link.id = "leaflet-base-styles";
  link.rel = "stylesheet";
  link.href = "https://esm.sh/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

// Standalone Badge component
export const StatusBadge = ({ insideCount = 0, independentCount = 0, radiusKm = 3.5 }) => (
  <div
    style={{
      position: "absolute",
      top: 14,
      left: 14,
      zIndex: 1000,
      background: "rgba(253, 251, 247, 0.94)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      border: "1px solid #1a1a1a",
      boxShadow: "3px 3px 0px #1a1a1a",
      borderRadius: "4px",
      padding: "8px 14px",
      fontFamily: "'Fira Code', 'Pitch', monospace, monospace",
      fontSize: "12px",
      letterSpacing: "0.02em",
      color: "#1a1a1a",
      pointerEvents: "auto",
      display: "flex",
      alignItems: "center",
      gap: "10px",
    }}
  >
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "#e65100",
        boxShadow: "0 0 0 2px rgba(230, 81, 0, 0.25)",
      }}
    />
    <div>
      <span style={{ fontWeight: 700 }}>{insideCount}</span> inside
      <span style={{ margin: "0 6px", color: "#888" }}>·</span>
      <span style={{ fontWeight: 700, color: "#d84315" }}>{independentCount}</span> independent
      <span style={{ margin: "0 6px", color: "#888" }}>·</span>
      <span style={{ color: "#555" }}>{Number(radiusKm).toFixed(2)} km radius</span>
    </div>
  </div>
);

// Standalone Tooltip/Inspector component
export const ShopInspector = ({ shop }) => {
  if (!shop) {
    return (
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 14,
          zIndex: 1000,
          background: "rgba(253, 251, 247, 0.92)",
          border: "1px dashed #bbb",
          borderRadius: "4px",
          padding: "6px 12px",
          fontFamily: "'Fira Code', monospace",
          fontSize: "11px",
          color: "#777",
          pointerEvents: "none",
        }}
      >
        Hover over a shop dot to view details
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 14,
        left: 14,
        zIndex: 1000,
        maxWidth: "340px",
        background: "#fdfbf7",
        border: "1px solid #1a1a1a",
        boxShadow: "3px 3px 0px #1a1a1a",
        borderRadius: "4px",
        padding: "10px 14px",
        fontFamily: "'Fira Code', monospace",
        fontSize: "11px",
        color: "#1a1a1a",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "15px",
          fontWeight: 700,
          marginBottom: "4px",
          color: "#111",
          lineHeight: 1.2,
        }}
      >
        {shop.name}
      </div>
      <div style={{ color: "#555", marginBottom: "4px" }}>
        {shop.street ? shop.street : "Street address unlisted"}
      </div>
      <div style={{ fontSize: "10.5px", color: "#666", marginBottom: "4px" }}>
        <strong>Hours:</strong> {shop.hours ? shop.hours : "Hours unlisted"}
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
        <span
          style={{
            fontSize: "10px",
            textTransform: "uppercase",
            padding: "2px 6px",
            borderRadius: "2px",
            background: shop.chain ? "#e0e0e0" : "#ffeed9",
            color: shop.chain ? "#444" : "#b23c00",
            fontWeight: 700,
          }}
        >
          {shop.chain ? "Chain" : "Independent"}
        </span>
        {shop.kolache && (
          <span
            style={{
              fontSize: "10px",
              textTransform: "uppercase",
              padding: "2px 6px",
              borderRadius: "2px",
              background: "#e8f5e9",
              color: "#2e7d32",
              fontWeight: 700,
            }}
          >
            Kolaches
          </span>
        )}
      </div>
    </div>
  );
};

export default function Widget({ model, React }) {
  injectLeafletStyles();

  // Normalize data rows
  const rawData = model.get("data");
  const data = React.useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    if (typeof rawData === "object") {
      // In case DataFrame is serialized as columnar object
      const keys = Object.keys(rawData);
      if (keys.length === 0) return [];
      const firstCol = rawData[keys[0]];
      const len = Array.isArray(firstCol)
        ? firstCol.length
        : Object.keys(firstCol).length;
      const rows = [];
      for (let i = 0; i < len; i++) {
        const row = {};
        keys.forEach((k) => {
          row[k] = Array.isArray(rawData[k]) ? rawData[k][i] : rawData[k][i];
        });
        rows.push(row);
      }
      return rows;
    }
    return [];
  }, [rawData]);

  const HOTEL_LAT = 29.7522;
  const HOTEL_LON = -95.3578;
  const INITIAL_RADIUS = 3.5;

  const [radiusKm, setRadiusKm] = React.useState(INITIAL_RADIUS);
  const [hoveredShop, setHoveredShop] = React.useState(null);
  const [insideIndices, setInsideIndices] = React.useState([]);

  const mapContainerRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const circleRef = React.useRef(null);
  const circleHitRef = React.useRef(null);
  const edgeLabelMarkerRef = React.useRef(null);
  const shopMarkersRef = React.useRef([]);
  const isDraggingEdgeRef = React.useRef(false);
  const currentRadiusRef = React.useRef(INITIAL_RADIUS);

  // Initialize outputs on mount
  React.useEffect(() => {
    model.set("radius_km", INITIAL_RADIUS);
    model.set("inside", []);
    model.save_changes();
  }, []);

  // Compute inside indices given radius
  const computeInside = React.useCallback(
    (radius) => {
      const inside = [];
      const hotelLatLng = L.latLng(HOTEL_LAT, HOTEL_LON);
      data.forEach((row, idx) => {
        const lat = row.lat;
        const lon = row.lon;
        if (lat == null || lon == null) return;
        const distMeters = hotelLatLng.distanceTo(L.latLng(lat, lon));
        if (distMeters <= radius * 1000) {
          inside.push(idx);
        }
      });
      return inside;
    },
    [data]
  );

  // Update styles of shop markers based on current radius
  const updateMarkerStyles = React.useCallback(
    (radKm) => {
      const hotelLatLng = L.latLng(HOTEL_LAT, HOTEL_LON);
      shopMarkersRef.current.forEach(({ marker, row }) => {
        const distMeters = hotelLatLng.distanceTo(
          L.latLng(row.lat, row.lon)
        );
        const isInside = distMeters <= radKm * 1000;
        const isChain = Boolean(row.chain);

        if (isInside) {
          marker.setStyle({
            radius: 6.5,
            fillColor: isChain ? "#616161" : "#f57c00",
            color: "#1a1a1a",
            weight: 1.5,
            fillOpacity: 0.95,
            opacity: 1,
          });
          if (marker.bringToFront) marker.bringToFront();
        } else {
          marker.setStyle({
            radius: 3.5,
            fillColor: isChain ? "#9e9e9e" : "#ffb74d",
            color: "#666",
            weight: 0.8,
            fillOpacity: 0.25,
            opacity: 0.35,
          });
        }
      });
    },
    []
  );

  // Function to place edge label at (hotel + radius due East)
  const getEdgeLatLng = React.useCallback((rKm) => {
    const rMeters = rKm * 1000;
    // Offset along longitude east
    const deltaLon = (rMeters / (111320 * Math.cos((HOTEL_LAT * Math.PI) / 180)));
    return L.latLng(HOTEL_LAT, HOTEL_LON + deltaLon);
  }, []);

  // Sync radius state and notify model
  const applyRadius = React.useCallback(
    (newR) => {
      currentRadiusRef.current = newR;
      setRadiusKm(newR);

      if (circleRef.current) {
        circleRef.current.setRadius(newR * 1000);
      }
      if (circleHitRef.current) {
        circleHitRef.current.setRadius(newR * 1000);
      }
      if (edgeLabelMarkerRef.current) {
        edgeLabelMarkerRef.current.setLatLng(getEdgeLatLng(newR));
        const el = edgeLabelMarkerRef.current.getElement();
        if (el) {
          const textEl = el.querySelector(".edge-label-text");
          if (textEl) {
            textEl.textContent = `${newR.toFixed(2)} km`;
          }
        }
      }

      updateMarkerStyles(newR);
      const newInside = computeInside(newR);
      setInsideIndices(newInside);

      model.set("radius_km", Number(newR.toFixed(3)));
      model.set("inside", newInside);
      model.save_changes();
    },
    [computeInside, updateMarkerStyles, getEdgeLatLng, model]
  );

  // Initialize Leaflet Map
  React.useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [HOTEL_LAT, HOTEL_LON],
      zoom: 12,
      zoomControl: false,
    });
    mapInstanceRef.current = map;

    // Add zoom control top right
    L.control.zoom({ position: "topright" }).addTo(map);

    // OSM Tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    // Hotel Dark Pin Marker
    const hotelPinHtml = `
      <div style="
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translate(-50%, -100%);
      ">
        <span style="
          background: #111;
          color: #fdfbf7;
          font-family: 'Fira Code', monospace;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 2px 6px;
          border-radius: 3px;
          margin-bottom: 2px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          border: 1px solid #444;
          white-space: nowrap;
        ">hotel</span>
        <div style="
          width: 14px;
          height: 14px;
          background: #111;
          border: 2px solid #fff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 5px rgba(0,0,0,0.4);
        "></div>
      </div>
    `;

    const hotelIcon = L.divIcon({
      className: "hotel-pin-icon",
      html: hotelPinHtml,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    L.marker([HOTEL_LAT, HOTEL_LON], {
      icon: hotelIcon,
      zIndexOffset: 1200,
    }).addTo(map);

    // Interactive circle
    const circle = L.circle([HOTEL_LAT, HOTEL_LON], {
      radius: INITIAL_RADIUS * 1000,
      color: "#d84315",
      weight: 2.2,
      opacity: 0.9,
      fillColor: "#ff8a65",
      fillOpacity: 0.1,
      dashArray: "6, 4",
      interactive: false,
    }).addTo(map);
    circleRef.current = circle;

    // Draggable hit border for edge dragging
    const circleHit = L.circle([HOTEL_LAT, HOTEL_LON], {
      radius: INITIAL_RADIUS * 1000,
      color: "#ff3d00",
      weight: 18,
      opacity: 0.001,
      fill: false,
      interactive: true,
    }).addTo(map);
    circleHitRef.current = circleHit;

    // Edge label marker riding east on the circle edge
    const edgeLabelHtml = `
      <div style="
        transform: translate(-10%, -50%);
        pointer-events: auto;
        cursor: ew-resize;
        user-select: none;
      ">
        <div style="
          background: #1a1a1a;
          color: #fdfbf7;
          border: 1px solid #ffffff;
          padding: 2px 7px;
          border-radius: 12px;
          font-family: 'Fira Code', monospace;
          font-size: 11px;
          font-weight: 600;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        ">
          <span style="font-size: 8px; opacity: 0.7;">◀▶</span>
          <span class="edge-label-text">${INITIAL_RADIUS.toFixed(2)} km</span>
        </div>
      </div>
    `;
    const edgeLabelIcon = L.divIcon({
      className: "edge-label-icon",
      html: edgeLabelHtml,
      iconSize: [0, 0],
    });

    const edgeMarker = L.marker(getEdgeLatLng(INITIAL_RADIUS), {
      icon: edgeLabelIcon,
      zIndexOffset: 1500,
      interactive: true,
    }).addTo(map);
    edgeLabelMarkerRef.current = edgeMarker;

    // Pointer-based radius drag handlers
    const hotelLatLng = L.latLng(HOTEL_LAT, HOTEL_LON);

    const onPointerMove = (e) => {
      if (!isDraggingEdgeRef.current) return;
      const pointerLatLng = map.mouseEventToLatLng(e);
      const distM = hotelLatLng.distanceTo(pointerLatLng);
      const newRadKm = Math.min(Math.max(distM / 1000, 0.4), 25.0);
      applyRadius(newRadKm);
    };

    const onPointerUp = () => {
      if (!isDraggingEdgeRef.current) return;
      isDraggingEdgeRef.current = false;
      map.dragging.enable();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    const startRadiusDrag = (e) => {
      if (e.originalEvent) {
        L.DomEvent.stopPropagation(e.originalEvent);
        L.DomEvent.preventDefault(e.originalEvent);
      }
      isDraggingEdgeRef.current = true;
      map.dragging.disable();
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    };

    circleHit.on("mousedown", startRadiusDrag);
    edgeMarker.on("mousedown", startRadiusDrag);

    // Initial update of markers
    const initialInside = computeInside(INITIAL_RADIUS);
    setInsideIndices(initialInside);
    model.set("inside", initialInside);
    model.set("radius_km", INITIAL_RADIUS);
    model.save_changes();

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update shop dots when data or map changes
  React.useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous markers
    shopMarkersRef.current.forEach(({ marker }) => marker.remove());
    shopMarkersRef.current = [];

    const newMarkers = [];
    data.forEach((row, idx) => {
      if (row.lat == null || row.lon == null) return;

      const marker = L.circleMarker([row.lat, row.lon], {
        radius: 4,
        fillColor: row.chain ? "#757575" : "#f57c00",
        color: "#1a1a1a",
        weight: 1,
        opacity: 0.8,
        fillOpacity: 0.85,
        interactive: true,
      }).addTo(map);

      marker.on("mouseover", () => {
        setHoveredShop(row);
      });
      marker.on("mouseout", () => {
        setHoveredShop(null);
      });

      newMarkers.push({ marker, row, index: idx });
    });

    shopMarkersRef.current = newMarkers;
    updateMarkerStyles(currentRadiusRef.current);
    const currInside = computeInside(currentRadiusRef.current);
    setInsideIndices(currInside);
  }, [data]);

  // Derived counts for the status badge
  const { insideCount, independentCount } = React.useMemo(() => {
    let insideCnt = insideIndices.length;
    let indepCnt = 0;
    insideIndices.forEach((idx) => {
      const row = data[idx];
      if (row && !row.chain) {
        indepCnt++;
      }
    });
    return { insideCount: insideCnt, independentCount: indepCnt };
  }, [insideIndices, data]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "960px",
        margin: "0 auto",
        fontFamily: "'Fira Code', monospace",
        background: "#fdfbf7",
        borderRadius: "8px",
        border: "1px solid #1a1a1a",
        boxShadow: "4px 4px 0px #1a1a1a",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Top Banner / Scrollytelling bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 18px",
          background: "#fdfbf7",
          borderBottom: "1px solid #1a1a1a",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "19px",
              fontWeight: 800,
              color: "#1a1a1a",
              letterSpacing: "-0.01em",
            }}
          >
            Houston Donut Radius
          </h2>
          <span
            style={{
              fontSize: "11px",
              color: "#666",
              fontFamily: "'Fira Code', monospace",
            }}
          >
            Drag circle perimeter to sweep search radius
          </span>
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            fontSize: "11px",
            color: "#333",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#f57c00",
                display: "inline-block",
                border: "1px solid #1a1a1a",
              }}
            />
            <span>Independent</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#757575",
                display: "inline-block",
                border: "1px solid #1a1a1a",
              }}
            />
            <span>Chain</span>
          </div>
        </div>
      </div>

      {/* Map Canvas - 560px tall */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "560px",
          background: "#eae7dc",
        }}
      >
        <div
          ref={mapContainerRef}
          style={{
            width: "100%",
            height: "100%",
            outline: "none",
          }}
        />

        {/* Badge top-left */}
        <StatusBadge
          insideCount={insideCount}
          independentCount={independentCount}
          radiusKm={radiusKm}
        />

        {/* Hover Inspector */}
        <ShopInspector shop={hoveredShop} />
      </div>
    </div>
  );
}