import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Types
interface Location {
  lat: number;
  lng: number;
}

interface MapDriver {
  id: string;
  name: string;
  location: Location;
  rating: number;
  available: boolean;
  distance?: number;
}

interface RouteInfo {
  distance: number; // km
  duration: number; // minutes
  coordinates: Location[];
}

interface OpenStreetMapProps {
  center: Location;
  customerLocation?: Location;
  destination?: Location;
  drivers?: MapDriver[];
  onDriverClick?: (driver: MapDriver) => void;
  onMapClick?: (loc: Location) => void;
  className?: string;
  showRoute?: boolean;
  pickupLocation?: Location;
  dropoffLocation?: Location;
  driverLocation?: Location;
  onRouteCalculated?: (distance: number, duration: number) => void;
  highlightDriverId?: string;
}

// OSRM Route Service - Multiple fallback servers
const OSRM_SERVERS = [
  'https://router.project-osrm.org',
  'https://routing.openstreetmap.de/routed-car',
  'https://routing.openstreetmap.de/routed-bike'
];

async function fetchOSRMRoute(
  start: Location, 
  end: Location
): Promise<RouteInfo | null> {
  // Try each server until one works
  for (const server of OSRM_SERVERS) {
    try {
      const url = `${server}/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=false`;
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'GetTransfer-App/1.0' }
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => ({ lat, lng })
        );
        
        return {
          distance: route.distance / 1000, // meters to km
          duration: route.duration / 60, // seconds to minutes
          coordinates
        };
      }
    } catch (error) {
      console.warn(`OSRM server ${server} failed:`, error);
      continue;
    }
  }
  
  console.error('All OSRM servers failed');
  return null;
}

// Map controller component
const MapController: React.FC<{ center: Location; bounds?: L.LatLngBoundsExpression }> = ({ center, bounds }) => {
  const map = useMap();
  
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      map.setView([center.lat, center.lng], 14);
    }
  }, [map, center, bounds]);
  
  return null;
};

// Click handler component
const MapClickHandler: React.FC<{ onMapClick?: (loc: Location) => void }> = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

// Custom icons
const createIcon = (color: string, size: number = 20, label?: string) => {
  const html = label 
    ? `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">${label}</div>`
    : `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`;
  
  return L.divIcon({
    html,
    className: 'custom-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const OpenStreetMap: React.FC<OpenStreetMapProps> = ({
  center,
  customerLocation,
  destination,
  drivers = [],
  onDriverClick,
  onMapClick,
  className = 'h-96 w-full',
  showRoute = false,
  pickupLocation,
  dropoffLocation,
  driverLocation,
  onRouteCalculated,
  highlightDriverId,
}) => {
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Calculate route when locations change
  useEffect(() => {
    const calculateRoute = async () => {
      const origin = driverLocation || pickupLocation || customerLocation;
      const dest = dropoffLocation || destination;
      
      if (!origin || !dest || !showRoute) {
        setRoute(null);
        return;
      }

      setRouteLoading(true);
      setRouteError(null);

      try {
        const routeData = await fetchOSRMRoute(origin, dest);
        
        if (routeData) {
          setRoute(routeData);
          onRouteCalculated?.(routeData.distance, routeData.duration);
        } else {
          setRouteError('Rota hesaplanamadı');
          // Fallback: straight line
          setRoute({
            distance: calculateStraightDistance(origin, dest),
            duration: calculateStraightDistance(origin, dest) * 2,
            coordinates: [origin, dest]
          });
        }
      } catch (error) {
        console.error('Route error:', error);
        setRouteError('Rota hatası');
      } finally {
        setRouteLoading(false);
      }
    };

    calculateRoute();
  }, [customerLocation, destination, pickupLocation, dropoffLocation, driverLocation, showRoute, onRouteCalculated]);

  // Straight line distance calculation (Haversine)
  const calculateStraightDistance = (from: Location, to: Location): number => {
    const R = 6371;
    const dLat = (to.lat - from.lat) * Math.PI / 180;
    const dLng = (to.lng - from.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Calculate bounds to fit all markers and route
  const bounds = useCallback(() => {
    const points: L.LatLngExpression[] = [];
    
    if (customerLocation) points.push([customerLocation.lat, customerLocation.lng]);
    if (destination) points.push([destination.lat, destination.lng]);
    if (pickupLocation) points.push([pickupLocation.lat, pickupLocation.lng]);
    if (dropoffLocation) points.push([dropoffLocation.lat, dropoffLocation.lng]);
    if (driverLocation) points.push([driverLocation.lat, driverLocation.lng]);
    if (route?.coordinates) {
      route.coordinates.forEach(c => points.push([c.lat, c.lng]));
    }
    
    if (points.length === 0) return undefined;
    if (points.length === 1) return undefined;
    
    return L.latLngBounds(points);
  }, [customerLocation, destination, pickupLocation, dropoffLocation, driverLocation, route]);

  return (
    <div className={className} style={{ width: '100%', height: '100%', minHeight: '400px' }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={14}
        className="h-full w-full rounded-lg"
        style={{ height: '100%', width: '100%', minHeight: '400px' }}
        ref={mapRef as any}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController center={center} bounds={bounds()} />
        <MapClickHandler onMapClick={onMapClick} />

        {/* Route Polyline */}
        {route && route.coordinates.length > 1 && (
          <Polyline
            positions={route.coordinates.map(c => [c.lat, c.lng])}
            color="#2563eb"
            weight={5}
            opacity={0.8}
          />
        )}

        {/* Customer Marker */}
        {customerLocation && (
          <Marker 
            position={[customerLocation.lat, customerLocation.lng]}
            icon={createIcon('#3b82f6', 16)}
          >
            <Popup>
              <div className="text-sm">
                <strong className="text-blue-600">📍 Sizin Konumunuz</strong>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Pickup Marker */}
        {pickupLocation && (
          <Marker 
            position={[pickupLocation.lat, pickupLocation.lng]}
            icon={createIcon('#22c55e', 18, 'P')}
          >
            <Popup>
              <div className="text-sm">
                <strong className="text-green-600">📍 Alış Noktası</strong>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Dropoff Marker */}
        {dropoffLocation && (
          <Marker 
            position={[dropoffLocation.lat, dropoffLocation.lng]}
            icon={createIcon('#ef4444', 18, 'D')}
          >
            <Popup>
              <div className="text-sm">
                <strong className="text-red-600">🎯 Varış Noktası</strong>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination Marker */}
        {destination && !dropoffLocation && (
          <Marker 
            position={[destination.lat, destination.lng]}
            icon={createIcon('#ef4444', 16)}
          >
            <Popup>
              <div className="text-sm">
                <strong className="text-red-600">🎯 Varış Noktası</strong>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Driver Location Marker */}
        {driverLocation && (
          <Marker 
            position={[driverLocation.lat, driverLocation.lng]}
            icon={createIcon('#10b981', 14)}
          >
            <Popup>
              <div className="text-sm">
                <strong className="text-green-600">🚗 Şoför Konumu</strong>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Available Driver Markers */}
        {drivers.map(driver => (
          <Marker
            key={driver.id}
            position={[driver.location.lat, driver.location.lng]}
            icon={createIcon(
              highlightDriverId === driver.id ? '#2563eb' : (driver.available ? '#10b981' : '#f59e0b'),
              highlightDriverId === driver.id ? 14 : 10
            )}
            eventHandlers={{
              click: () => onDriverClick?.(driver)
            }}
          >
            <Popup>
              <div className="text-sm min-w-[120px]">
                <strong className="text-green-600">{driver.name}</strong>
                <br />
                <span className="text-xs text-gray-600">⭐ {driver.rating}/5</span>
                <br />
                <span className={`text-xs ${driver.available ? 'text-green-600' : 'text-orange-600'}`}>
                  {driver.available ? '✅ Müsait' : '⏳ Meşgul'}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Loading Overlay */}
      {routeLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg z-[1000]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Rota hesaplanıyor...</p>
          </div>
        </div>
      )}

      {/* Route Info */}
      {route && !routeLoading && (
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg px-4 py-2 z-[1000]">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-500">📍 Mesafe:</span>
              <span className="font-semibold ml-1">{route.distance.toFixed(1)} km</span>
            </div>
            <div>
              <span className="text-gray-500">⏱️ Süre:</span>
              <span className="font-semibold ml-1">{Math.round(route.duration)} dk</span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg px-3 py-2 z-[1000]">
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Konumunuz</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Şoförler</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Varış</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {routeError && (
        <div className="absolute top-4 right-4 bg-yellow-100 border border-yellow-400 rounded-lg px-3 py-2 z-[1000]">
          <p className="text-xs text-yellow-800">⚠️ {routeError}</p>
        </div>
      )}
    </div>
  );
};

export default OpenStreetMap;
