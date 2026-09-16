import * as L from "https://esm.sh/leaflet@1.9.4";

export default function Widget({ model, React }) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const circleRef = React.useRef(null);
  const markersRef = React.useRef([]);
  const labelRef = React.useRef(null);
  
  const data = model.get("data") || [];
  const [radiusKm, setRadiusKm] = React.useState(3.5);
  const [hoveredShop, setHoveredShop] = React.useState(null);
  const [stats, setStats] = React.useState({ inside: 0, independent: 0 });
  
  const hotelLat = 29.7522;
  const hotelLon = -95.3578;

  // Haversine distance calculation
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

  // Calculate which shops are inside and update stats
  const updateStats = React.useCallback((radius) => {
    const insideIndices = [];
    let independentCount = 0;
    
    data.forEach((shop, idx) => {
      const dist = getDistanceKm(hotelLat, hotelLon, shop.lat, shop.lon);
      if (dist <= radius) {
        insideIndices.push(idx);
        if (!shop.chain) independentCount++;
      }
    });
    
    setStats({ inside: insideIndices.length, independent: independentCount });
    return insideIndices;
  }, [data]);

  // Update marker styles based on radius
  const updateMarkers = React.useCallback((radius) => {
    markersRef.current.forEach(({ marker, shop }) => {
      const dist = getDistanceKm(hotelLat, hotelLon, shop.lat, shop.lon);
      const isInside = dist <= radius;
      const color = shop.chain ? '#888' : '#ff8c00';
      
      marker.setStyle({
        fillColor: color,
        fillOpacity: isInside ? 0.9 : 0.3,
        radius: isInside ? 8 : 5,
        color: isInside ? '#333' : '#999',
        weight: isInside ? 2 : 1
      });
    });
  }, []);

  // Update label position on circle edge
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

  // Initialize outputs on mount
  React.useEffect(() => {
    const insideIndices = updateStats(3.5);
    model.set("inside", insideIndices);
    model.set("radius_km", 3.5);
    model.save_changes();
  }, []);

  // Sync radius changes to model
  React.useEffect(() => {
    const insideIndices = updateStats(radiusKm);
    model.set("inside", insideIndices);
    model.set("radius_km", radiusKm);
    model.save_changes();
    
    if (circleRef.current) {
      circleRef.current.setRadius(radiusKm * 1000);
    }
    updateMarkers(radiusKm);
    updateLabel(radiusKm);
  }, [radiusKm, updateStats, updateMarkers, updateLabel]);

  // Initialize map
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Add Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Create map
    const map = L.map(containerRef.current).setView([hotelLat, hotelLon], 12);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Hotel marker (dark pin)
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
    L.marker([hotelLat, hotelLon], { icon: hotelIcon }).addTo(map)
      .bindTooltip('Hotel', { permanent: false });

    // Radius circle
    const circle = L.circle([hotelLat, hotelLon], {
      radius: 3500,
      color: '#2563eb',
      fillColor: '#2563eb',
      fillOpacity: 0.1,
      weight: 3
    }).addTo(map);
    circleRef.current = circle;

    // Radius label
    const label = L.popup({
      closeButton: false,
      autoClose: false,
      closeOnClick: false,
      className: 'radius-label'
    }).setLatLng([hotelLat, hotelLon]).setContent('3.5 km').addTo(map);
    labelRef.current = label;
    updateLabel(3.5);

    // Shop markers
    data.forEach((shop, idx) => {
      const dist = getDistanceKm(hotelLat, hotelLon, shop.lat, shop.lon);
      const isInside = dist <= 3.5;
      const color = shop.chain ? '#888' : '#ff8c00';
      
      const marker = L.circleMarker([shop.lat, shop.lon], {
        radius: isInside ? 8 : 5,
        fillColor: color,
        fillOpacity: isInside ? 0.9 : 0.3,
        color: isInside ? '#333' : '#999',
        weight: isInside ? 2 : 1
      }).addTo(map);

      const tooltipContent = `<div style="font-weight:bold;color:#000">${shop.name}</div>
        ${shop.street ? `<div style="color:#333">${shop.street}</div>` : ''}
        ${shop.hours ? `<div style="color:#555;font-size:11px">${shop.hours}</div>` : ''}`;
      
      marker.bindTooltip(tooltipContent, { 
        direction: 'top',
        offset: [0, -5]
      });

      markersRef.current.push({ marker, shop, idx });
    });

    // Drag handling for circle edge
    let isDragging = false;
    
    const onMouseDown = (e) => {
      const center = L.latLng(hotelLat, hotelLon);
      const clickDist = map.distance(center, e.latlng);
      const circleRadius = circleRef.current.getRadius();
      
      if (Math.abs(clickDist - circleRadius) < circleRadius * 0.15) {
        isDragging = true;
        map.dragging.disable();
        e.originalEvent.preventDefault();
      }
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      
      const center = L.latLng(hotelLat, hotelLon);
      const newRadius = map.distance(center, e.latlng);
      const newRadiusKm = Math.max(0.5, Math.min(20, newRadius / 1000));
      
      setRadiusKm(newRadiusKm);
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        map.dragging.enable();
      }
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);
    document.addEventListener('mouseup', onMouseUp);

    // Change cursor on circle edge
    map.on('mousemove', (e) => {
      if (isDragging) return;
      const center = L.latLng(hotelLat, hotelLon);
      const dist = map.distance(center, e.latlng);
      const circleRadius = circleRef.current.getRadius();
      
      if (Math.abs(dist - circleRadius) < circleRadius * 0.15) {
        containerRef.current.style.cursor = 'ew-resize';
      } else {
        containerRef.current.style.cursor = '';
      }
    });

    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
      map.remove();
      mapRef.current = null;
      circleRef.current = null;
      labelRef.current = null;
      markersRef.current = [];
      link.remove();
    };
  }, [data, updateLabel]);

  return (
    <div style={{ position: 'relative', width: '100%', height: 560 }}>
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          borderRadius: 8,
          overflow: 'hidden'
        }} 
      />
      
      {/* Stats badge */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 50,
        zIndex: 1000,
        background: 'rgba(255,255,255,0.95)',
        padding: '8px 14px',
        borderRadius: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        fontWeight: 600,
        color: '#1a1a1a'
      }}>
        <span style={{ color: '#2563eb' }}>{stats.inside}</span> inside · <span style={{ color: '#ff8c00' }}>{stats.independent}</span> independent
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: 30,
        right: 10,
        zIndex: 1000,
        background: 'rgba(255,255,255,0.95)',
        padding: '8px 12px',
        borderRadius: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        color: '#333'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff8c00', display: 'inline-block' }}></span>
          <span>Independent</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#888', display: 'inline-block' }}></span>
          <span>Chain</span>
        </div>
      </div>
    </div>
  );
}