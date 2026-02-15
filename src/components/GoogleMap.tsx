import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { toast } from 'sonner';

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
  vehicleType?: string;
  distance?: number;
}

interface RouteInfo {
  distance: number; // meters
  duration: number; // seconds
  distanceText: string;
  durationText: string;
}

interface GoogleMapProps {
  center: Location;
  customerLocation?: Location;
  destination?: Location;
  drivers?: MapDriver[];
  onDriverClick?: (driver: MapDriver) => void;
  onMapClick?: (loc: Location) => void;
  className?: string;
  showRoute?: boolean;
  showTraffic?: boolean;
  pickupLocation?: Location;
  dropoffLocation?: Location;
  driverLocation?: Location;
  onRouteCalculated?: (routeInfo: RouteInfo) => void;
  highlightDriverId?: string;
}

// Global state for Google Maps loader
let googleMapsLoader: Loader | null = null;
let googleMapsLoaded = false;

export const GoogleMap: React.FC<GoogleMapProps> = ({
  center,
  customerLocation,
  destination,
  drivers = [],
  onDriverClick,
  onMapClick,
  className = 'h-96 w-full',
  showRoute = false,
  showTraffic = true,
  pickupLocation,
  dropoffLocation,
  driverLocation,
  onRouteCalculated,
  highlightDriverId,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const customerMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  // Initialize Google Maps
  useEffect(() => {
    const initMap = async () => {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setError('Google Maps API key eksik');
        setLoading(false);
        return;
      }

      try {
        // Initialize loader only once
        if (!googleMapsLoader) {
          googleMapsLoader = new Loader({
            apiKey,
            version: 'weekly',
            libraries: ['places', 'geometry', 'marker'],
          });
        }

        // Load Google Maps
        if (!googleMapsLoaded) {
          await googleMapsLoader.load();
          googleMapsLoaded = true;
        }

        // Wait for DOM element
        let attempts = 0;
        while (!mapRef.current && attempts < 20) {
          await new Promise(r => setTimeout(r, 100));
          attempts++;
        }

        if (!mapRef.current) {
          setError('Harita container bulunamadı');
          setLoading(false);
          return;
        }

        // Create map
        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: center.lat, lng: center.lng },
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          ],
        });

        mapInstanceRef.current = map;

        // Create directions service and renderer
        directionsServiceRef.current = new window.google.maps.DirectionsService();
        directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#2563eb',
            strokeWeight: 5,
            strokeOpacity: 0.8,
          },
        });

        // Create traffic layer
        if (showTraffic) {
          trafficLayerRef.current = new window.google.maps.TrafficLayer();
          trafficLayerRef.current.setMap(map);
        }

        // Map click handler
        if (onMapClick) {
          map.addListener('click', (e: google.maps.MapMouseEvent) => {
            if (e.latLng) {
              onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
            }
          });
        }

        setLoading(false);
      } catch (err) {
        console.error('Google Maps init error:', err);
        setError('Google Maps yüklenemedi');
        setLoading(false);
      }
    };

    initMap();
  }, []);

  // Update center
  useEffect(() => {
    if (mapInstanceRef.current && center) {
      mapInstanceRef.current.panTo({ lat: center.lat, lng: center.lng });
    }
  }, [center]);

  // Customer marker
  useEffect(() => {
    if (!mapInstanceRef.current || !customerLocation) return;

    if (customerMarkerRef.current) {
      customerMarkerRef.current.setMap(null);
    }

    customerMarkerRef.current = new window.google.maps.Marker({
      position: { lat: customerLocation.lat, lng: customerLocation.lng },
      map: mapInstanceRef.current,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
      title: 'Sizin Konumunuz',
    });
  }, [customerLocation]);

  // Destination marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.setMap(null);
      destinationMarkerRef.current = null;
    }

    if (destination) {
      destinationMarkerRef.current = new window.google.maps.Marker({
        position: { lat: destination.lat, lng: destination.lng },
        map: mapInstanceRef.current,
        icon: {
          path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 8,
          fillColor: '#ef4444',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        title: 'Varış Noktası',
      });
    }
  }, [destination]);

  // Pickup marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.setMap(null);
      pickupMarkerRef.current = null;
    }

    if (pickupLocation) {
      pickupMarkerRef.current = new window.google.maps.Marker({
        position: { lat: pickupLocation.lat, lng: pickupLocation.lng },
        map: mapInstanceRef.current,
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 8,
          fillColor: '#22c55e',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        title: 'Alış Noktası',
      });
    }
  }, [pickupLocation]);

  // Driver location marker (for active trip)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setMap(null);
      driverMarkerRef.current = null;
    }

    if (driverLocation) {
      driverMarkerRef.current = new window.google.maps.Marker({
        position: { lat: driverLocation.lat, lng: driverLocation.lng },
        map: mapInstanceRef.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#10b981',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        title: 'Şoför Konumu',
      });
    }
  }, [driverLocation]);

  // Driver markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // Add driver markers
    drivers.forEach(driver => {
      const isHighlighted = highlightDriverId === driver.id;
      
      const marker = new window.google.maps.Marker({
        position: { lat: driver.location.lat, lng: driver.location.lng },
        map: mapInstanceRef.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: isHighlighted ? 12 : 8,
          fillColor: driver.available ? '#10b981' : '#f59e0b',
          fillOpacity: 1,
          strokeColor: isHighlighted ? '#2563eb' : '#ffffff',
          strokeWeight: isHighlighted ? 3 : 2,
        },
        title: `${driver.name} ${driver.available ? '(Müsait)' : '(Meşgul)'}`,
      });

      marker.addListener('click', () => {
        onDriverClick?.(driver);
      });

      markersRef.current.push(marker);
    });
  }, [drivers, highlightDriverId, onDriverClick]);

  // Calculate and display route
  const calculateRoute = useCallback(async (
    origin: Location,
    dest: Location,
    waypoints?: Location[]
  ) => {
    if (!directionsServiceRef.current || !directionsRendererRef.current || !mapInstanceRef.current) {
      return null;
    }

    try {
      const request: google.maps.DirectionsRequest = {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: dest.lat, lng: dest.lng },
        travelMode: window.google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
        },
      };

      if (waypoints && waypoints.length > 0) {
        request.waypoints = waypoints.map(wp => ({
          location: { lat: wp.lat, lng: wp.lng },
          stopover: false,
        }));
      }

      const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
        directionsServiceRef.current!.route(request, (result, status) => {
          if (status === 'OK' && result) {
            resolve(result);
          } else {
            reject(new Error(`Directions failed: ${status}`));
          }
        });
      });

      directionsRendererRef.current.setDirections(result);

      // Extract route info
      const route = result.routes[0];
      const leg = route.legs[0];
      
      const info: RouteInfo = {
        distance: leg.distance?.value || 0,
        duration: leg.duration?.value || 0,
        distanceText: leg.distance?.text || '',
        durationText: leg.duration?.text || '',
      };

      setRouteInfo(info);
      onRouteCalculated?.(info);

      // Fit bounds
      const bounds = new window.google.maps.LatLngBounds();
      route.bounds.extend(bounds.getNorthEast());
      route.bounds.extend(bounds.getSouthWest());
      mapInstanceRef.current.fitBounds(route.bounds, 50);

      return info;
    } catch (err) {
      console.error('Route calculation error:', err);
      return null;
    }
  }, [onRouteCalculated]);

  // Show route when locations change
  useEffect(() => {
    if (!showRoute || !mapInstanceRef.current) return;

    // Route from driver to pickup to dropoff
    if (driverLocation && pickupLocation && dropoffLocation) {
      // Full route: driver -> pickup -> dropoff
      calculateRoute(driverLocation, dropoffLocation, [pickupLocation]);
    } else if (pickupLocation && dropoffLocation) {
      // Just pickup to dropoff
      calculateRoute(pickupLocation, dropoffLocation);
    } else if (customerLocation && destination) {
      // Basic route: customer to destination
      calculateRoute(customerLocation, destination);
    }
  }, [showRoute, customerLocation, destination, pickupLocation, dropoffLocation, driverLocation, calculateRoute]);

  // Traffic toggle
  useEffect(() => {
    if (trafficLayerRef.current && mapInstanceRef.current) {
      trafficLayerRef.current.setMap(showTraffic ? mapInstanceRef.current : null);
    }
  }, [showTraffic]);

  // Loading state
  if (loading) {
    return (
      <div className={`${className} bg-gray-100 rounded-lg flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600">Google Maps yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`${className} bg-gray-100 rounded-lg flex items-center justify-center`}>
        <div className="text-center p-4">
          <p className="text-red-600 mb-2">⚠️ {error}</p>
          <p className="text-sm text-gray-500">Lütfen sayfayı yenileyin</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="w-full h-full rounded-lg" />

      {/* Traffic indicator */}
      {showTraffic && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg px-3 py-2">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Hızlı</span>
            <div className="w-3 h-3 bg-yellow-500 rounded-full ml-2"></div>
            <span>Orta</span>
            <div className="w-3 h-3 bg-red-500 rounded-full ml-2"></div>
            <span>Yavaş</span>
          </div>
        </div>
      )}

      {/* Route info */}
      {routeInfo && (
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg px-4 py-3">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-500">Mesafe:</span>
              <span className="font-semibold ml-1">{routeInfo.distanceText}</span>
            </div>
            <div>
              <span className="text-gray-500">Süre:</span>
              <span className="font-semibold ml-1">{routeInfo.durationText}</span>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg overflow-hidden">
        <button
          onClick={() => {
            if (mapInstanceRef.current && customerLocation) {
              mapInstanceRef.current.panTo({ lat: customerLocation.lat, lng: customerLocation.lng });
              mapInstanceRef.current.setZoom(15);
            }
          }}
          className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-b"
        >
          📍 Konumuma Git
        </button>
        <button
          onClick={() => {
            if (mapInstanceRef.current && pickupLocation && dropoffLocation) {
              calculateRoute(pickupLocation, dropoffLocation);
            }
          }}
          className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          🔄 Rotayı Yenile
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3">
        <h4 className="text-xs font-semibold text-gray-900 mb-2">Lejant</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Konumunuz</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Müsait Şoför</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Varış Noktası</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleMap;
