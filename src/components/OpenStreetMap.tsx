import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

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
}

const MapController: React.FC<{ center: Location }> = ({ center }) => {
  const map = useMap();
  const dragging = useRef(false);

  useEffect(() => {
    map.on('dragstart', () => { dragging.current = true; });
    map.on('dragend', () => { dragging.current = false; });
  }, [map]);
  
  useEffect(() => {
    if (center && center.lat && center.lng && !dragging.current) {
      map.panTo([center.lat, center.lng], { animate: true });
    }
  }, [center, map]);
  
  return null;
};

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
}) => {
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

  const destinationIcon = L.divIcon({
    html: `<div style="background-color: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    className: 'destination-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
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
            icon={driverIcon}
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
      
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg">
        <div className="flex flex-col">
          <button
            className="p-2 hover:bg-gray-100 transition-colors"
            onClick={() => {}}
            title="Yakınlaştır"
          >
            +
          </button>
          <div className="border-t border-gray-200"></div>
          <button
            className="p-2 hover:bg-gray-100 transition-colors"
            onClick={() => {}}
            title="Uzaklaştır"
          >
            -
          </button>
        </div>
      </div>
    </div>
  );
};

export default OpenStreetMap;
