/**
 * In-App Navigation Component
 * Uygulama içinde gömülü navigasyon
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  fetchRoute,
  Route,
  RoutePoint,
  formatDistance,
  formatDuration,
  calculateNavigationState,
  translateInstruction
} from '@/lib/navigation'
import { Navigation, ArrowUp, ArrowLeft, ArrowRight, MapPin, Flag, Clock, Car } from 'lucide-react'

// Custom marker icons
const createIcon = (color: string) => L.divIcon({
  className: 'custom-marker',
  html: `<div style="background: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
})

const driverIcon = L.divIcon({
  className: 'driver-marker',
  html: `<div style="background: #3b82f6; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(59,130,246,0.5); display: flex; align-items: center; justify-content: center;">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
})

interface InAppNavigationProps {
  start: RoutePoint
  end: RoutePoint
  driverLocation?: RoutePoint
  driverName?: string
  customerName?: string
  mode: 'to_pickup' | 'to_dropoff'
  onArrival?: () => void
  className?: string
}

export const InAppNavigation: React.FC<InAppNavigationProps> = ({
  start,
  end,
  driverLocation,
  driverName = 'Sürücü',
  customerName = 'Müşteri',
  mode,
  onArrival,
  className = ''
}) => {
  const [route, setRoute] = useState<Route | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [navState, setNavState] = useState<{
    distanceRemaining: number
    durationRemaining: number
    nextInstruction: string | null
  } | null>(null)
  
  const mapRef = useRef<L.Map | null>(null)

  // Rota yükle
  useEffect(() => {
    setLoading(true)
    setError(null)
    
    fetchRoute(start, end)
      .then(r => {
        if (r) {
          setRoute(r)
        } else {
          setError('Rota bulunamadı')
        }
      })
      .catch(err => {
        setError('Rota yüklenemedi')
        console.error(err)
      })
      .finally(() => setLoading(false))
  }, [start, end])

  // Navigasyon durumunu güncelle
  useEffect(() => {
    if (!route || !driverLocation) return
    
    const state = calculateNavigationState(driverLocation, route)
    setNavState({
      distanceRemaining: state.distanceRemaining,
      durationRemaining: state.durationRemaining,
      nextInstruction: state.nextInstruction
    })
    
    // Vardı mı kontrol et (50m içinde)
    if (state.distanceRemaining < 50 && onArrival) {
      onArrival()
    }
  }, [route, driverLocation, onArrival])

  // Haritayı güncelle
  useEffect(() => {
    if (!mapRef.current || !route) return
    
    const bounds = L.latLngBounds(route.geometry.map(p => [p.lat, p.lng]))
    if (driverLocation) {
      bounds.extend([driverLocation.lat, driverLocation.lng])
    }
    mapRef.current.fitBounds(bounds, { padding: [50, 50] })
  }, [route, driverLocation])

  return (
    <div className={`relative ${className}`}>
      {/* Navigasyon Bilgi Paneli */}
      {route && !loading && (
        <div className="absolute top-4 left-4 right-4 z-[1000] bg-gray-900/95 backdrop-blur rounded-xl p-4 shadow-2xl border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
              <Navigation className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white font-bold text-lg">
                  {navState ? formatDistance(navState.distanceRemaining) : formatDistance(route.distance)}
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-300">
                  {navState ? formatDuration(navState.durationRemaining) : formatDuration(route.duration)}
                </span>
              </div>
              {navState?.nextInstruction && (
                <p className="text-blue-400 text-sm">{navState.nextInstruction}</p>
              )}
              {!navState && (
                <p className="text-gray-400 text-sm">
                  {mode === 'to_pickup' ? `${customerName} konumuna` : 'Varış noktasına'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Yükleniyor */}
      {loading && (
        <div className="absolute inset-0 z-[1000] bg-gray-900/90 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-lg">Rota hesaplanıyor...</p>
          </div>
        </div>
      )}

      {/* Hata */}
      {error && (
        <div className="absolute inset-0 z-[1000] bg-gray-900/90 flex items-center justify-center">
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Navigation className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-white text-lg mb-2">Rota Hatası</p>
            <p className="text-gray-400">{error}</p>
            <button
              onClick={() => window.open(`https://www.google.com/maps/dir/${start.lat},${start.lng}/${end.lat},${end.lng}`, '_blank')}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Google Maps'te Aç
            </button>
          </div>
        </div>
      )}

      {/* Harita */}
      <MapContainer
        center={[start.lat, start.lng]}
        zoom={13}
        className="h-full w-full"
        zoomControl={false}
        ref={mapRef as any}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Rota çizgisi */}
        {route && (
          <Polyline
            positions={route.geometry.map(p => [p.lat, p.lng])}
            color="#3b82f6"
            weight={5}
            opacity={0.8}
          />
        )}
        
        {/* Başlangıç noktası */}
        <Marker position={[start.lat, start.lng]} icon={createIcon('#22c55e')}>
          <Popup>
            {mode === 'to_pickup' ? `${customerName} - Alış` : 'Başlangıç'}
          </Popup>
        </Marker>
        
        {/* Bitiş noktası */}
        <Marker position={[end.lat, end.lng]} icon={createIcon('#ef4444')}>
          <Popup>
            {mode === 'to_pickup' ? 'Varış' : `${customerName} - Bırakış`}
          </Popup>
        </Marker>
        
        {/* Sürücü konumu */}
        {driverLocation && (
          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon}>
            <Popup>
              <div className="text-center">
                <p className="font-medium">{driverName}</p>
                {navState && (
                  <p className="text-sm text-gray-500">
                    {formatDistance(navState.distanceRemaining)} kaldı
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Alt Bilgi */}
      {route && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-gray-900/95 backdrop-blur rounded-xl p-3 shadow-2xl border border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-blue-400" />
                <span className="text-gray-300">{driverName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-400" />
                <span className="text-gray-300">{formatDuration(route.duration)}</span>
              </div>
            </div>
            <button
              onClick={() => window.open(`https://www.google.com/maps/dir/${start.lat},${start.lng}/${end.lat},${end.lng}`, '_blank')}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs"
            >
              Google Maps
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default InAppNavigation
