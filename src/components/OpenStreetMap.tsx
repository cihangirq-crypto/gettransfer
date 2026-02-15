import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// OSRM Route API types
interface OSRMCoordinate {
  lat: number;
  lng: number;
}

interface OSRMRoute {
  geometry: {
    coordinates: [number, number][];
  };
  distance: number;
  duration: number;
}

interface OSRMResponse {
  routes: OSRMRoute[];
  code: string;
}

// Fetch real road route from OSRM
const fetchOSRMRoute = async (start: OSRMCoordinate, end: OSRMCoordinate): Promise<OSRMCoordinate[] | null> => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    const data: OSRMResponse = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const coordinates = data.routes[0].geometry.coordinates;
      // Convert from [lng, lat] to {lat, lng}
      return coordinates.map(([lng, lat]) => ({ lat, lng }));
    }
    return null;
  } catch (error) {
    console.error('OSRM route fetch error:', error);
    return null;
  }
};
// import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// import markerIcon from 'leaflet/dist/images/marker-icon.png';
// import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
/* L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
}); */

interface Location {
  lat: number;
  lng: number;
}

type MapDriver = {
  id: string;
  name: string;
  location: Location;
  rating: number;
  available: boolean;
  distance?: number;
}

interface OpenStreetMapProps {
  center: Location;
  customerLocation: Location;
  destination?: Location;
  drivers: MapDriver[];
  onDriverClick?: (driver: MapDriver) => void;
  className?: string;
  onMapClick?: (loc: Location) => void;
  draggableCustomer?: boolean;
  onCustomerDragEnd?: (loc: Location) => void;
  accuracy?: number | null;
  highlightDriverId?: string;
  path?: Location[];
  pickupLocation?: Location;
  dropoffLocation?: Location;
  showRoute?: 'to_pickup' | 'to_dropoff' | 'both';
}

const MapController: React.FC<{ center: Location }> = ({ center }) => {
  const map = useMap();
  const dragging = useRef(false);

  useEffect(() => {
    map.on('dragstart', () => { dragging.current = true; });
    map.on('dragend', () => { dragging.current = false; });
  }, [map]);
  
  useEffect(() => {
    if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng) && !dragging.current) {
      map.panTo([center.lat, center.lng], { animate: true });
    }
  }, [center, map]);
  
  return null;
};

const ZoomControls: React.FC = () => {
  const map = useMap()
  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg">
      <div className="flex flex-col">
        <button
          className="p-2 hover:bg-gray-100 transition-colors"
          onClick={() => map.zoomIn()}
          title="Yakınlaştır"
          type="button"
        >
          +
        </button>
        <div className="border-t border-gray-200"></div>
        <button
          className="p-2 hover:bg-gray-100 transition-colors"
          onClick={() => map.zoomOut()}
          title="Uzaklaştır"
          type="button"
        >
          -
        </button>
      </div>
    </div>
  )
}

const MapClick: React.FC<{ onMapClick?: (loc: Location) => void }> = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

const AccuracyIndicator: React.FC<{ accuracy: number | null }> = ({ accuracy }) => {
  if (accuracy === null) return null;
  let color = 'bg-green-500';
  let text = 'Yüksek doğruluk';
  if (accuracy > 100) { color = 'bg-red-500'; text = 'Düşük doğruluk'; }
  else if (accuracy > 50) { color = 'bg-yellow-500'; text = 'Orta doğruluk'; }
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 ${color} rounded-full`}></div>
      <span className="text-xs">{text} (±{Math.round(accuracy)}m)</span>
    </div>
  );
};

const OpenStreetMap: React.FC<OpenStreetMapProps> = ({
  center,
  customerLocation,
  destination,
  drivers,
  onDriverClick,
  className = "h-96 w-full",
  onMapClick,
  draggableCustomer = false,
  onCustomerDragEnd,
  accuracy,
  highlightDriverId,
  path,
  pickupLocation,
  dropoffLocation,
  showRoute,
}) => {
  // Route state for real road paths
  const [routeToPickup, setRouteToPickup] = useState<Location[]>([]);
  const [routeToDropoff, setRouteToDropoff] = useState<Location[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);

  // Fetch real routes when locations change
  useEffect(() => {
    const fetchRoutes = async () => {
      setRouteLoading(true);
      
      // Route from highlighted driver to pickup
      if (showRoute === 'to_pickup' && pickupLocation && highlightDriverId) {
        const driver = drivers.find(d => d.id === highlightDriverId);
        if (driver) {
          const route = await fetchOSRMRoute(driver.location, pickupLocation);
          setRouteToPickup(route || [driver.location, pickupLocation]);
        }
      }
      
      // Route from pickup to dropoff
      if (showRoute === 'to_dropoff' && pickupLocation && dropoffLocation) {
        const route = await fetchOSRMRoute(pickupLocation, dropoffLocation);
        setRouteToDropoff(route || [pickupLocation, dropoffLocation]);
      }
      
      // Both routes
      if (showRoute === 'both' && pickupLocation && dropoffLocation && highlightDriverId) {
        const driver = drivers.find(d => d.id === highlightDriverId);
        if (driver) {
          const [toPickup, toDropoff] = await Promise.all([
            fetchOSRMRoute(driver.location, pickupLocation),
            fetchOSRMRoute(pickupLocation, dropoffLocation)
          ]);
          setRouteToPickup(toPickup || [driver.location, pickupLocation]);
          setRouteToDropoff(toDropoff || [pickupLocation, dropoffLocation]);
        }
      }
      
      setRouteLoading(false);
    };
    
    fetchRoutes();
  }, [showRoute, pickupLocation, dropoffLocation, highlightDriverId, drivers]);

  const customIcon = L.divIcon({
    html: `<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    className: 'custom-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  const driverIcon = L.divIcon({
    html: `<div style="background-color: #10b981; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    className: 'driver-marker',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  const highlightDriverIcon = L.divIcon({
    html: `<div style="background-color: #2563eb; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.35);"></div>`,
    className: 'driver-marker-highlight',
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });

  const destinationIcon = L.divIcon({
    html: `<div style="background-color: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    className: 'destination-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  const pickupIcon = L.divIcon({
    html: `<div style="background-color: #22c55e; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">P</div>`,
    className: 'pickup-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  const dropoffIcon = L.divIcon({
    html: `<div style="background-color: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">D</div>`,
    className: 'dropoff-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  return (
    <div className={`relative ${className}`}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={15}
        className="h-full w-full rounded-lg shadow-lg"
        style={{ backgroundColor: '#e5e7eb' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController center={center} />
        <MapClick onMapClick={onMapClick} />
        <ZoomControls />
        
        {/* Customer Location Marker */}
        {customerLocation && (
          <Marker 
            position={[customerLocation.lat, customerLocation.lng]} 
            icon={customIcon}
            draggable={draggableCustomer}
            eventHandlers={draggableCustomer ? { dragend: (e) => onCustomerDragEnd?.({ lat: (e as any).target.getLatLng().lat, lng: (e as any).target.getLatLng().lng }) } : undefined}
          >
            <Popup>
              <div className="text-sm">
                <strong className="text-blue-600">Sizin Konumunuz</strong>
                <br />
                <span className="text-gray-600">
                  {customerLocation.lat.toFixed(6)}, {customerLocation.lng.toFixed(6)}
                </span>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Destination Marker */}
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={destinationIcon}>
            <Popup>
              <div className="text-sm">
                <strong className="text-red-600">Varış Noktası</strong>
                <br />
                <span className="text-gray-600">
                  {destination.lat.toFixed(6)}, {destination.lng.toFixed(6)}
                </span>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Driver Markers */}
        {drivers.map((driver) => (
          <Marker
            key={driver.id}
            position={[driver.location.lat, driver.location.lng]}
            icon={highlightDriverId === driver.id ? highlightDriverIcon : driverIcon}
            eventHandlers={{
              click: () => onDriverClick?.(driver)
            }}
          >
            <Popup>
              <div className="text-sm min-w-[150px]">
                <strong className="text-green-600">{driver.name}</strong>
                <br />
                <span className="text-gray-600 text-xs">
                  Puan: {driver.rating}/5
                </span>
                <br />
                {driver.available ? (
                  <span className="text-green-600 text-xs">Müsait</span>
                ) : (
                  <span className="text-red-600 text-xs">Meşgul</span>
                )}
                {driver.distance && (
                  <>
                    <br />
                    <span className="text-gray-500 text-xs">
                      {driver.distance.toFixed(1)} km
                    </span>
                  </>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Route highlight from selected driver to customer */}
        {highlightDriverId && customerLocation && (()=>{
          const d = drivers.find(x=>x.id===highlightDriverId)
          if (!d) return null
          return <Polyline positions={[[d.location.lat, d.location.lng],[customerLocation.lat, customerLocation.lng]]} color="#2563eb" />
        })()}

        {/* Pickup Marker */}
        {pickupLocation && (
          <Marker position={[pickupLocation.lat, pickupLocation.lng]} icon={pickupIcon}>
            <Popup>
              <div className="text-sm">
                <strong className="text-green-600">📍 Alış Noktası (Pickup)</strong>
                <br />
                <span className="text-gray-600">
                  {pickupLocation.lat.toFixed(6)}, {pickupLocation.lng.toFixed(6)}
                </span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Dropoff Marker */}
        {dropoffLocation && (
          <Marker position={[dropoffLocation.lat, dropoffLocation.lng]} icon={dropoffIcon}>
            <Popup>
              <div className="text-sm">
                <strong className="text-red-600">🎯 Varış Noktası (Dropoff)</strong>
                <br />
                <span className="text-gray-600">
                  {dropoffLocation.lat.toFixed(6)}, {dropoffLocation.lng.toFixed(6)}
                </span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Rota Çizimi - Şoförden pickup'a (Gerçek yol rotası) */}
        {showRoute === 'to_pickup' && routeToPickup.length > 1 && (
          <Polyline 
            positions={routeToPickup.map(p => [p.lat, p.lng])} 
            color="#22c55e" 
            weight={5} 
            opacity={0.8}
          />
        )}
        {showRoute === 'to_pickup' && routeLoading && pickupLocation && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-3 py-2 rounded-lg shadow-lg text-sm z-[1000]">
            Rota hesaplanıyor...
          </div>
        )}

        {/* Rota Çizimi - Pickup'tan dropoff'a (Gerçek yol rotası) */}
        {showRoute === 'to_dropoff' && routeToDropoff.length > 1 && (
          <Polyline 
            positions={routeToDropoff.map(p => [p.lat, p.lng])} 
            color="#ef4444" 
            weight={5} 
            opacity={0.8}
          />
        )}
        {showRoute === 'to_dropoff' && routeLoading && pickupLocation && dropoffLocation && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-3 py-2 rounded-lg shadow-lg text-sm z-[1000]">
            Rota hesaplanıyor...
          </div>
        )}

        {/* Her iki rota (both mode) */}
        {showRoute === 'both' && routeToPickup.length > 1 && (
          <Polyline 
            positions={routeToPickup.map(p => [p.lat, p.lng])} 
            color="#22c55e" 
            weight={5} 
            opacity={0.8}
          />
        )}
        {showRoute === 'both' && routeToDropoff.length > 1 && (
          <Polyline 
            positions={routeToDropoff.map(p => [p.lat, p.lng])} 
            color="#ef4444" 
            weight={5} 
            opacity={0.8}
          />
        )}

        {/* Driver path polyline */}
        {Array.isArray(path) && path.length > 1 && (
          <Polyline positions={path.map(p=>[p.lat, p.lng])} color="#0ea5e9" />
        )}
      </MapContainer>
      {typeof accuracy === 'number' && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-2">
          <AccuracyIndicator accuracy={accuracy} />
        </div>
      )}
      
      {/* Map Controls Info */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-2 text-xs">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span>Sizin konumunuz</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span>Müsait sürücüler</span>
        </div>
        {destination && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Varış noktası</span>
          </div>
        )}
      </div>
      
    </div>
  );
};

export default OpenStreetMap;
