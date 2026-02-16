import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { io, type Socket } from 'socket.io-client'
import OpenStreetMap from '@/components/OpenStreetMap'
import { Button } from '@/components/ui/Button'
import { useBookingStore } from '@/stores/bookingStore'
import { Clock, Car } from 'lucide-react'
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

export const TrackingPage: React.FC = () => {
  const navigate = useNavigate()
  const { bookingId } = useParams()
  const { currentBooking, refreshBookingById, setCurrentBooking, updateBookingStatus } = useBookingStore()

  const [driverLocation, setDriverLocation] = useState<{ lat: number, lng: number } | null>(null)
  const [customerLocation, setCustomerLocation] = useState<{ lat: number, lng: number } | null>(null)
  const [routePath, setRoutePath] = useState<Array<{ lat: number, lng: number }>>([])
  const [approachPath, setApproachPath] = useState<Array<{ lat: number, lng: number }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const lastStatusRef = useRef<string | null>(null)
  const nearEachOtherRef = useRef(false)
  const lastCustomerPushRef = useRef(0)

  const booking = useMemo(() => {
    if (!bookingId) return null
    if (!currentBooking) return null
    return currentBooking.id === bookingId ? currentBooking : null
  }, [currentBooking, bookingId])

  useEffect(() => {
    if (!bookingId) return
    refreshBookingById(bookingId).catch(() => {})
  }, [bookingId, refreshBookingById])

  useEffect(() => {
    const origin = (import.meta.env.VITE_API_ORIGIN as string) || `http://${window.location.hostname}:3005`
    const s = io(origin, { transports: ['websocket'], reconnection: true })
    socketRef.current = s
    s.on('connect', () => {
      if (bookingId) s.emit('booking:join', { bookingId })
    })
    s.on('booking:update', (b: any) => {
      if (bookingId && b?.id === bookingId) setCurrentBooking(b)
    })
    s.on('booking:route', (ev: any) => {
      if (bookingId && ev?.id === bookingId && Array.isArray(ev?.driverPath)) setRoutePath(ev.driverPath)
    })
    s.on('driver:update', (d: any) => {
      if (!booking?.driverId) return
      if (d?.id !== booking.driverId) return
      if (d?.location) setDriverLocation(d.location)
    })
    return () => {
      try { if (bookingId) s.emit('booking:leave', { bookingId }) } catch {}
      s.disconnect()
      socketRef.current = null
    }
  }, [bookingId, booking?.driverId, setCurrentBooking])

  useEffect(() => {
    if (!booking) return
    if (Array.isArray(booking.route?.driverPath) && booking.route!.driverPath.length > 1) {
      setRoutePath(booking.route!.driverPath)
    }
  }, [booking?.route?.driverPath])

  useEffect(() => {
    const b = booking
    if (!b) return
    if (!driverLocation) return
    if (b.status === 'in_progress') return
    if (b.status === 'completed' || b.status === 'cancelled') return
    const target = customerLocation || b.pickupLocation
    const key = `${driverLocation.lat.toFixed(5)},${driverLocation.lng.toFixed(5)}|${target.lat.toFixed(5)},${target.lng.toFixed(5)}`
    let cancelled = false
    const run = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${driverLocation.lng},${driverLocation.lat};${target.lng},${target.lat}?overview=full&geometries=geojson`
        const res = await fetch(url)
        if (!res.ok) throw new Error('osrm_failed')
        const rj = await res.json()
        const coords = Array.isArray(rj?.routes) && rj.routes[0]?.geometry?.coordinates ? rj.routes[0].geometry.coordinates : []
        const mapped = coords.map((c: any) => ({ lat: c[1], lng: c[0] }))
        if (cancelled) return
        setApproachPath(mapped.length > 1 ? mapped : [driverLocation, target])
      } catch {
        if (cancelled) return
        setApproachPath([driverLocation, target])
      }
    }
    run()
    return () => { cancelled = true }
  }, [booking?.id, booking?.status, driverLocation?.lat, driverLocation?.lng, customerLocation?.lat, customerLocation?.lng])

  useEffect(() => {
    if (!booking?.driverId) return
    if (driverLocation) return
    fetch(`/api/drivers/${booking.driverId}`).then(r => r.json()).then(j => {
      if (j?.success && j?.data?.location) setDriverLocation(j.data.location)
    }).catch(() => {})
  }, [booking?.driverId, driverLocation])

  useEffect(() => {
    if (!bookingId) return
    if (!navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(p => {
      const next = { lat: p.coords.latitude, lng: p.coords.longitude }
      setCustomerLocation(next)
      const now = Date.now()
      if (now - lastCustomerPushRef.current < 1500) return
      lastCustomerPushRef.current = now
      fetch(`/api/bookings/${bookingId}/customer-location`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: next }) }).catch(() => {})
    }, () => {}, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }) as unknown as number
    return () => { try { navigator.geolocation.clearWatch(id) } catch {} }
  }, [bookingId])

  useEffect(() => {
    if (!booking) return
    if (lastStatusRef.current === booking.status) return
    lastStatusRef.current = booking.status
    if (booking.status === 'pending') toast.info('Sürücü kabulü bekleniyor.')
    if (booking.status === 'accepted') toast.success('Sürücü çağrıyı kabul etti.')
    if (booking.status === 'driver_en_route') toast.success('Sürücü yola çıktı.')
    if (booking.status === 'driver_arrived') toast.success('Sürücü alış noktasına ulaştı.')
    if (booking.status === 'in_progress') toast.info('Yolculuk başladı.')
    if (booking.status === 'completed') toast.success('Yolculuk tamamlandı.')
    if (booking.status === 'cancelled') toast.error('Yolculuk iptal edildi.')
  }, [booking?.status])

  useEffect(() => {
    if (!booking) return
    if (!driverLocation || !customerLocation) return
    const d = haversineMeters(driverLocation, customerLocation)
    if (d <= 50) {
      if (!nearEachOtherRef.current) {
        nearEachOtherRef.current = true
        toast.success('Sürücü ile aynı konumdasınız.')
      }
    } else {
      nearEachOtherRef.current = false
    }
  }, [driverLocation, customerLocation, booking?.id])

  const statusLabel = (st: string) => {
    if (st === 'pending') return 'Sürücü bekleniyor'
    if (st === 'accepted') return 'Sürücü kabul etti'
    if (st === 'driver_en_route') return 'Sürücü yolda'
    if (st === 'driver_arrived') return 'Sürücü geldi'
    if (st === 'in_progress') return 'Yolculuk devam ediyor'
    if (st === 'completed') return 'Yolculuk tamamlandı'
    if (st === 'cancelled') return 'İptal edildi'
    return st
  }

  const etaMinutes = useMemo(() => {
    if (!booking) return null
    if (!driverLocation) return null
    const target = booking.status === 'in_progress' ? booking.dropoffLocation : booking.pickupLocation
    const distKm = haversineMeters(driverLocation, target) / 1000
    return Math.max(1, Math.round((distKm / 35) * 60))
  }, [booking?.status, booking?.pickupLocation, booking?.dropoffLocation, driverLocation])

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow p-6">Geçersiz yolculuk.</div>
        </div>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow p-6 flex items-center gap-3">
            <Car className="h-6 w-6 text-gray-400" />
            <div>
              <div className="font-semibold">Yolculuk yükleniyor...</div>
              <div className="text-sm text-gray-600">Rezervasyon bilgileri alınıyor.</div>
            </div>
          </div>
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

  const mapPath = booking.status === 'in_progress'
    ? (routePath.length > 1 ? routePath : undefined)
    : (approachPath.length > 1 ? approachPath : undefined)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Canlı Takip</h1>
          <p className="text-sm text-gray-600">{booking.pickupLocation.address} → {booking.dropoffLocation.address}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden">
            <div className="h-[520px]">
              <OpenStreetMap
                center={mapCenter}
                customerLocation={customerLocation || booking.pickupLocation}
                destination={booking.dropoffLocation}
                drivers={driverMarker}
                highlightDriverId={booking.driverId}
                path={mapPath}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <div className="font-semibold">Durum</div>
                </div>
                <div className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-800">{statusLabel(booking.status)}</div>
              </div>
              <div className="mt-3 text-sm text-gray-700">
                {etaMinutes ? `Tahmini süre: ${etaMinutes} dk` : 'Tahmini süre hesaplanıyor'}
              </div>
              <div className="mt-2 text-sm text-gray-700">
                {(() => {
                  const cur = (booking as any)?.extras?.pricing?.currency || 'EUR'
                  const sym = currencySymbol(cur)
                  const driverFare = Number(booking.basePrice || 0)
                  const total = Number(booking.finalPrice ?? booking.basePrice ?? 0)
                  const fee = Math.max(0, total - driverFare)
                  return `Toplam: ${sym}${total.toFixed(2)} • Şoför: ${sym}${driverFare.toFixed(2)} • Servis payı: ${sym}${fee.toFixed(2)}`
                })()}
              </div>
              {!booking.driverId && (
                <div className="mt-3 text-sm text-gray-600">Sürücü kabulü bekleniyor.</div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-5">
              <div className="font-semibold text-gray-900">İşlemler</div>
              <div className="mt-3 flex gap-2">
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
                >
                  İptal Et
                </Button>
                <Button
                  variant="outline"
                  disabled={isLoading}
                  onClick={() => navigate('/customer/dashboard')}
                >
                  Panele Dön
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

