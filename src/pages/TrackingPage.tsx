import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { io, type Socket } from 'socket.io-client'
import OpenStreetMap from '@/components/OpenStreetMap'
import { Button } from '@/components/ui/Button'
import { useBookingStore } from '@/stores/bookingStore'
import { Clock, Car, MapPin, Navigation, CheckCircle, Phone, User, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { currencySymbol } from '@/utils/pricing'

const haversineMeters = (a: { lat: number, lng: number }, b: { lat: number, lng: number }) => {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const la1 = a.lat * Math.PI / 180
  const la2 = b.lat * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// OSRM Rota
interface RouteInfo {
  distance: number
  duration: number
  coordinates: Array<{ lat: number; lng: number }>
}

async function fetchRoute(start: { lat: number; lng: number }, end: { lat: number; lng: number }): Promise<RouteInfo | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (data.code === 'Ok' && data.routes?.[0]) {
      return {
        distance: data.routes[0].distance / 1000,
        duration: data.routes[0].duration / 60,
        coordinates: data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }))
      }
    }
  } catch { }
  return null
}

export const TrackingPage: React.FC = () => {
  const navigate = useNavigate()
  const { bookingId } = useParams()
  const { currentBooking, refreshBookingById, setCurrentBooking, updateBookingStatus } = useBookingStore()

  const [driverLocation, setDriverLocation] = useState<{ lat: number, lng: number } | null>(null)
  const [customerLocation, setCustomerLocation] = useState<{ lat: number, lng: number } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const lastStatusRef = useRef<string | null>(null)
  const lastCustomerPushRef = useRef(0)

  const booking = useMemo(() => {
    if (!bookingId) return null
    if (!currentBooking) return null
    return currentBooking.id === bookingId ? currentBooking : null
  }, [currentBooking, bookingId])

  // Booking yükle
  useEffect(() => {
    if (!bookingId) return
    refreshBookingById(bookingId).catch(() => { })
  }, [bookingId, refreshBookingById])

  // Socket bağlantısı
  useEffect(() => {
    const origin = (import.meta.env.VITE_API_ORIGIN as string) || `http://${window.location.hostname}:3005`
    const s = io(origin, { transports: ['websocket'], reconnection: true })
    socketRef.current = s
    s.on('connect', () => {
      if (bookingId) s.emit('booking:join', { bookingId })
    })
    s.on('booking:update', (b: any) => {
      if (bookingId && b?.id === bookingId) {
        setCurrentBooking(b)
        toast.success('📍 Durum güncellendi!')
      }
    })
    s.on('driver:location', (ev: any) => {
      if (bookingId && ev?.bookingId === bookingId && ev?.location) {
        setDriverLocation(ev.location)
      }
    })
    s.on('driver:update', (d: any) => {
      if (!booking?.driverId) return
      if (d?.id !== booking.driverId) return
      if (d?.location) setDriverLocation(d.location)
    })
    return () => {
      try { if (bookingId) s.emit('booking:leave', { bookingId }) } catch { }
      s.disconnect()
      socketRef.current = null
    }
  }, [bookingId, booking?.driverId, setCurrentBooking])

  // Şoför konumunu çek
  useEffect(() => {
    if (!booking?.driverId) return
    if (driverLocation) return
    fetch(`/api/drivers/${booking.driverId}`).then(r => r.json()).then(j => {
      if (j?.success && j?.data?.location) setDriverLocation(j.data.location)
    }).catch(() => { })
  }, [booking?.driverId, driverLocation])

  // Müşteri konumu
  useEffect(() => {
    if (!bookingId) return
    if (!navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(p => {
      const next = { lat: p.coords.latitude, lng: p.coords.longitude }
      setCustomerLocation(next)
      const now = Date.now()
      if (now - lastCustomerPushRef.current < 1500) return
      lastCustomerPushRef.current = now
      fetch(`/api/bookings/${bookingId}/customer-location`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: next }) }).catch(() => { })
    }, () => { }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }) as unknown as number
    return () => { try { navigator.geolocation.clearWatch(id) } catch { } }
  }, [bookingId])

  // Rota hesapla
  useEffect(() => {
    if (!booking || !driverLocation) {
      setRouteInfo(null)
      return
    }

    const target = booking.status === 'in_progress' ? booking.dropoffLocation : booking.pickupLocation
    
    const calculateRoute = async () => {
      setRouteLoading(true)
      const route = await fetchRoute(driverLocation, target)
      setRouteInfo(route)
      setRouteLoading(false)
    }

    calculateRoute()
    const interval = setInterval(calculateRoute, 10000)
    return () => clearInterval(interval)
  }, [booking?.id, booking?.status, driverLocation?.lat, driverLocation?.lng])

  // Durum değişikliği bildirimi
  useEffect(() => {
    if (!booking) return
    if (lastStatusRef.current === booking.status) return
    lastStatusRef.current = booking.status

    const statusMessages: Record<string, string> = {
      pending: '⏳ Sürücü aranıyor...',
      accepted: '✅ Sürücü kabul etti!',
      driver_en_route: '🚗 Sürücü yola çıktı!',
      driver_arrived: '📍 Sürücü geldi! Hazır olun.',
      in_progress: '🛣️ Yolculuk başladı!',
      completed: '🎉 Yolculuk tamamlandı!',
      cancelled: '❌ Yolculuk iptal edildi.'
    }

    toast.success(statusMessages[booking.status] || booking.status, { duration: 5000 })
  }, [booking?.status])

  const statusConfig = useMemo(() => {
    if (!booking) return null

    const configs: Record<string, { label: string; color: string; icon: any; description: string }> = {
      pending: { label: 'Sürücü Bekleniyor', color: 'bg-yellow-500', icon: Clock, description: 'Yakınınızdaki sürücülere istek gönderildi' },
      accepted: { label: 'Kabul Edildi', color: 'bg-blue-500', icon: CheckCircle, description: 'Sürücü talebinizi kabul etti' },
      driver_en_route: { label: 'Yola Çıktı', color: 'bg-orange-500', icon: Car, description: 'Sürücü size doğru geliyor' },
      driver_arrived: { label: 'Geldi', color: 'bg-green-500', icon: MapPin, description: 'Sürücü alış noktasında!' },
      in_progress: { label: 'Yolda', color: 'bg-purple-500', icon: Navigation, description: 'Hedefe doğru ilerliyorsunuz' },
      completed: { label: 'Tamamlandı', color: 'bg-green-600', icon: CheckCircle, description: 'Yolculuk tamamlandı' },
      cancelled: { label: 'İptal', color: 'bg-red-500', icon: AlertTriangle, description: 'Yolculuk iptal edildi' }
    }

    return configs[booking.status] || configs.pending
  }, [booking?.status])

  const etaMinutes = useMemo(() => {
    if (!booking || !driverLocation) return null
    const target = booking.status === 'in_progress' ? booking.dropoffLocation : booking.pickupLocation
    const distKm = haversineMeters(driverLocation, target) / 1000
    return Math.max(1, Math.round((distKm / 35) * 60))
  }, [booking?.status, booking?.pickupLocation, booking?.dropoffLocation, driverLocation])

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Geçersiz yolculuk.</div>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <div className="text-white font-semibold">Yolculuk yükleniyor...</div>
          <div className="text-gray-400 text-sm mt-1">Rezervasyon bilgileri alınıyor</div>
        </div>
      </div>
    )
  }

  const mapCenter = customerLocation || booking.pickupLocation
  const driverMarker = booking.driverId && driverLocation ? [{
    id: booking.driverId,
    name: 'Sürücü',
    location: driverLocation,
    rating: 0,
    available: false,
  }] : []

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Üst Bilgi */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Navigation className="h-5 w-5 text-blue-400" />
              Canlı Takip
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {booking.pickupLocation?.address?.slice(0, 30)}... → {booking.dropoffLocation?.address?.slice(0, 30)}...
            </p>
          </div>
          {booking.reservationCode && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Rezervasyon Kodu</p>
              <p className="text-lg font-bold text-white">#{booking.reservationCode}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Harita */}
        <div className="flex-1 relative min-h-[400px] lg:min-h-0">
          <OpenStreetMap
            center={mapCenter}
            customerLocation={customerLocation || booking.pickupLocation}
            destination={booking.dropoffLocation}
            drivers={driverMarker}
            highlightDriverId={booking.driverId}
            path={routeInfo?.coordinates}
            pickupLocation={booking.pickupLocation}
            dropoffLocation={booking.dropoffLocation}
            driverLocation={driverLocation}
            showRoute={booking.status === 'driver_en_route' ? 'to_pickup' : booking.status === 'in_progress' ? 'to_dropoff' : false}
          />

          {/* Harita Üst Bilgi */}
          {routeLoading && (
            <div className="absolute top-4 left-4 bg-gray-900/90 px-3 py-2 rounded-lg flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              <span className="text-sm text-white">Rota güncelleniyor...</span>
            </div>
          )}

          {/* Rota Bilgisi */}
          {routeInfo && (
            <div className="absolute bottom-4 left-4 right-4 lg:right-auto lg:w-80 bg-gray-900/95 rounded-xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Navigation className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-bold">{routeInfo.distance.toFixed(1)} km</p>
                    <p className="text-xs text-gray-400">Mesafe</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">{Math.round(routeInfo.duration)} dk</p>
                  <p className="text-xs text-gray-400">Tahmini</p>
                </div>
              </div>
              <div className="text-xs text-blue-400 flex items-center gap-1">
                {booking.status === 'driver_en_route' && '🚗 Sürücü size geliyor'}
                {booking.status === 'in_progress' && '🎯 Hedefe doğru ilerliyorsunuz'}
              </div>
            </div>
          )}
        </div>

        {/* Sağ Panel */}
        <div className="w-full lg:w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
          {/* Durum Kartı */}
          <div className="p-4 border-b border-gray-700">
            {statusConfig && (
              <div className={`${statusConfig.color} rounded-xl p-4`}>
                <div className="flex items-center gap-3 mb-2">
                  <statusConfig.icon className="h-6 w-6 text-white" />
                  <span className="text-white font-bold text-lg">{statusConfig.label}</span>
                </div>
                <p className="text-white/80 text-sm">{statusConfig.description}</p>
                
                {etaMinutes && ['driver_en_route', 'in_progress'].includes(booking.status) && (
                  <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between">
                    <span className="text-white/70 text-sm">Tahmini varış:</span>
                    <span className="text-white font-bold">{etaMinutes} dk</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Şoför Bilgisi */}
          {booking.driverId && (
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-gray-400 text-xs uppercase mb-3">Şoför Bilgileri</h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{(booking as any).driverName || 'Şoför'}</p>
                  <p className="text-gray-400 text-sm">Sürücü</p>
                </div>
                {(booking as any).driverPhone && (
                  <a
                    href={`tel:${(booking as any).driverPhone}`}
                    className="w-10 h-10 bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center transition-colors"
                  >
                    <Phone className="h-5 w-5 text-white" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Fiyat Bilgisi */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-gray-400 text-xs uppercase mb-3">Fiyat Detayı</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Toplam:</span>
                <span className="text-white font-bold text-lg">
                  {currencySymbol((booking as any)?.extras?.pricing?.currency || 'EUR')}
                  {(booking.finalPrice || booking.basePrice || 0).toFixed(0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Mesafe:</span>
                <span className="text-gray-300">
                  {((booking as any)?.extras?.pricing?.distanceKm || 0).toFixed(1)} km
                </span>
              </div>
            </div>
          </div>

          {/* Adresler */}
          <div className="p-4 flex-1 overflow-y-auto">
            <h3 className="text-gray-400 text-xs uppercase mb-3">Güzergah</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-4 h-4 bg-green-500 rounded-full mt-1 flex-shrink-0"></div>
                <div>
                  <p className="text-xs text-gray-400">ALIŞ</p>
                  <p className="text-white">{booking.pickupLocation?.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-4 h-4 bg-red-500 rounded-full mt-1 flex-shrink-0"></div>
                <div>
                  <p className="text-xs text-gray-400">VARIŞ</p>
                  <p className="text-white">{booking.dropoffLocation?.address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* İşlemler */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={isLoading || booking.status === 'completed' || booking.status === 'cancelled'}
                onClick={async () => {
                  if (!confirm('Yolculuğu iptal etmek istiyor musunuz?')) return
                  setIsLoading(true)
                  try {
                    await updateBookingStatus(booking.id, 'cancelled')
                    navigate('/customer/dashboard')
                  } catch {
                    toast.error('İptal başarısız')
                  } finally {
                    setIsLoading(false)
                  }
                }}
                className="flex-1 border-red-500 text-red-400 hover:bg-red-500/20"
              >
                İptal Et
              </Button>
              <Button
                onClick={() => navigate('/customer/dashboard')}
                className="flex-1 bg-gray-600 hover:bg-gray-500"
              >
                Panele Dön
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrackingPage
