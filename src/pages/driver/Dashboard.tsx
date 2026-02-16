import React, { useEffect, useState, useRef } from 'react'
import { useDriverStore } from '@/stores/driverStore'
import { useAuthStore } from '@/stores/authStore'
import { useBookingStore } from '@/stores/bookingStore'
import OpenStreetMap from '@/components/OpenStreetMap'
import { Button } from '@/components/ui/Button'
import { DriverLayout } from '@/components/DriverLayout'
import { io as ioClient, type Socket } from 'socket.io-client'
import { MapPin, Phone, Navigation, CheckCircle, XCircle, Clock, Coffee } from 'lucide-react'
import { toast } from 'sonner'
import { DEFAULT_CENTER } from '@/config/env'

export const DriverDashboard = () => {
  const { me, requests, register, refreshRequests, accept, updateLocation, setAvailable, refreshApproval, earnings, fetchEarnings, approved } = useDriverStore()
  const { user } = useAuthStore()
  const { confirmPickup, appendRoutePoint, stopRouteRecordingAndSave, updateBookingStatus, saveRouteProgress } = useBookingStore()

  const [locationSource, setLocationSource] = useState<'gps' | 'ip' | 'manual' | 'none'>('none')

  type RideRequest = { id: string; pickup: { lat:number, lng:number, address:string }; dropoff: { lat:number, lng:number, address:string }; vehicleType: 'sedan'|'suv'|'van'|'luxury' }
  const [selectedRequest, setSelectedRequest] = useState<RideRequest | null>(null)
  const [activeBooking, setActiveBooking] = useState<import('@/types').Booking | null>(null)
  const [customerLiveLocation, setCustomerLiveLocation] = useState<{ lat: number, lng: number } | null>(null)
  const bookingSocketRef = useRef<Socket | null>(null)

  const calcMeters = (a?: { lat: number, lng: number } | null, b?: { lat: number, lng: number } | null) => {
    if (!a || !b) return null
    const R = 6371000
    const dLat = (b.lat - a.lat) * Math.PI / 180
    const dLng = (b.lng - a.lng) * Math.PI / 180
    const la1 = a.lat * Math.PI / 180
    const la2 = b.lat * Math.PI / 180
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(h))
  }
  const metersToPickup = activeBooking ? calcMeters(me?.location, activeBooking.pickupLocation) : null
  const metersToDropoff = activeBooking ? calcMeters(me?.location, activeBooking.dropoffLocation) : null

  useEffect(() => { if (me) refreshRequests() }, [me, refreshRequests])

  // Sync driver data - Giriş yaptığında otomatik ONLINE yap
  useEffect(() => {
    const sync = async () => {
      if (user && user.role === 'driver' && (!me || me.id !== user.id)) {
        try {
          const res = await fetch(`/api/drivers/${user.id}`)
          const j = await res.json()
          if (res.ok && j.success && j.data) {
            // Sürücü varsa, otomatik online yap
            const serverLoc = j.data.location
            const currentLoc = useDriverStore.getState().me?.location
            const finalLoc = (currentLoc && (currentLoc.lat !== 0 || currentLoc.lng !== 0)) ? currentLoc : serverLoc

            useDriverStore.setState({
              me: {
                id: j.data.id,
                name: j.data.name || 'Sürücü',
                vehicleType: j.data.vehicleType || 'sedan',
                location: finalLoc,
                available: true // Otomatik ONLINE
              }
            })

            // Sunucuda da online yap
            try {
              await fetch(`/api/drivers/${j.data.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ available: true })
              })
            } catch { /* ignore */ }

            try { useDriverStore.getState().startRealtime() } catch { /* ignore */ }
          } else {
            await register({ id: user.id, name: user.name || 'Sürücü', vehicleType: 'sedan', location: { lat: 0, lng: 0 }, available: true })
          }
        } catch {
          try { await register({ id: user.id, name: user.name || 'Sürücü', vehicleType: 'sedan', location: { lat: 0, lng: 0 }, available: true }) } catch { /* ignore */ }
        }
      }
    }
    sync()
  }, [me, user, register])

  useEffect(() => {
    const interval = setInterval(() => { if (me) refreshRequests() }, 3000) // 3 saniyede bir kontrol
    return () => clearInterval(interval)
  }, [me, refreshRequests])

  // Location tracking
  const lastLocRef = useRef<{lat:number, lng:number, time:number}|null>(null)

  const fetchIpLocation = async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      const res = await fetch('https://ipapi.co/json/')
      if (res.ok) {
        const data = await res.json()
        if (data.latitude && data.longitude) return { lat: data.latitude, lng: data.longitude }
      }
    } catch { /* ignore */ }
    try {
      const res = await fetch('https://ip-api.com/json/')
      if (res.ok) {
        const data = await res.json()
        if (data.lat && data.lon) return { lat: data.lat, lng: data.lon }
      }
    } catch { /* ignore */ }
    return null
  }

  useEffect(() => {
    if (!me?.id) return

    let watchIdLocal: number | null = null
    let ipLocationAttempted = false

    if (navigator.geolocation) {
      watchIdLocal = navigator.geolocation.watchPosition(
        (p) => {
          setLocationSource('gps')

          const newLat = p.coords.latitude
          const newLng = p.coords.longitude
          const now = Date.now()

          let shouldUpdate = false

          if (!lastLocRef.current) {
            shouldUpdate = true
          } else {
            const { lat: oldLat, lng: oldLng, time: oldTime } = lastLocRef.current
            const timeDiff = now - oldTime

            const R = 6371e3
            const φ1 = oldLat * Math.PI/180
            const φ2 = newLat * Math.PI/180
            const Δφ = (newLat-oldLat) * Math.PI/180
            const Δλ = (newLng-oldLng) * Math.PI/180
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                      Math.cos(φ1) * Math.cos(φ2) *
                      Math.sin(Δλ/2) * Math.sin(Δλ/2)
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
            const dist = R * c

            if (dist > 10 || timeDiff > 10000) {
              shouldUpdate = true
            }
          }

          if (shouldUpdate) {
            lastLocRef.current = { lat: newLat, lng: newLng, time: now }
            updateLocation({ lat: newLat, lng: newLng })
            appendRoutePoint({ lat: newLat, lng: newLng })
          }
        },
        async (err) => {
          console.warn('GPS hatası:', err.message)

          if (!ipLocationAttempted) {
            ipLocationAttempted = true
            toast.info('GPS kullanılamıyor, IP bazlı konum aranıyor...')

            const ipLoc = await fetchIpLocation()
            if (ipLoc) {
              setLocationSource('ip')
              updateLocation(ipLoc)
              toast.success('Yaklaşık konum bulundu!')
            } else {
              setLocationSource('none')
              toast.warning('Konum bulunamadı. Haritada tıklayarak seçin.')
            }
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      ) as unknown as number
    } else {
      (async () => {
        ipLocationAttempted = true
        toast.info('GPS desteklenmiyor, IP bazlı konum aranıyor...')

        const ipLoc = await fetchIpLocation()
        if (ipLoc) {
          setLocationSource('ip')
          updateLocation(ipLoc)
        } else {
          setLocationSource('none')
          toast.warning('Konum bulunamadı. Haritada tıklayarak seçin.')
        }
      })()
    }

    return () => {
      try {
        if (watchIdLocal) navigator.geolocation.clearWatch(watchIdLocal)
      } catch { /* ignore */ }
    }
  }, [me?.id, updateLocation, appendRoutePoint])

  useEffect(() => { if (me) { refreshApproval(); fetchEarnings() } }, [me, refreshApproval, fetchEarnings])

  useEffect(() => {
    if (!activeBooking) return
    const iv = setInterval(() => {
      saveRouteProgress(activeBooking.id)
    }, 5000)
    return () => clearInterval(iv)
  }, [activeBooking, saveRouteProgress])

  // Socket for customer location
  useEffect(() => {
    const b = activeBooking
    if (!b?.id) {
      setCustomerLiveLocation(null)
      if (bookingSocketRef.current) {
        try { bookingSocketRef.current.disconnect() } catch { /* ignore */ }
        bookingSocketRef.current = null
      }
      return
    }
    const origin = (import.meta.env.VITE_API_ORIGIN as string) || `http://${window.location.hostname}:3005`
    const s = ioClient(origin, { transports: ['websocket'], reconnection: true })
    bookingSocketRef.current = s
    s.on('connect', () => {
      s.emit('booking:join', { bookingId: b.id })
    })
    s.on('customer:update', (ev: { bookingId?: string; location?: { lat: number; lng: number } }) => {
      if (ev?.bookingId !== b.id) return
      if (ev?.location && typeof ev.location.lat === 'number' && typeof ev.location.lng === 'number') {
        setCustomerLiveLocation(ev.location)
      }
    })
    s.on('booking:update', (next: { id?: string; status?: string }) => {
      if (next?.id !== b.id) return
      setActiveBooking(prev => prev ? { ...prev, ...next } : null)
    })
    fetch(`/api/bookings/${b.id}/customer-location`).then(r => r.json()).then(j => {
      if (j?.success && j?.data && typeof j.data.lat === 'number' && typeof j.data.lng === 'number') setCustomerLiveLocation(j.data)
    }).catch(() => { /* ignore */ })
    return () => {
      try { s.emit('booking:leave', { bookingId: b.id }) } catch { /* ignore */ }
      s.disconnect()
      bookingSocketRef.current = null
    }
  }, [activeBooking?.id])

  // Poll active booking
  useEffect(() => {
    if (!me) return
    const poll = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch(`/api/bookings/by-driver/${me.id}`)
        const j = await res.json()
        if (res.ok && j.success && Array.isArray(j.data)) {
          const active = (j.data as import('@/types').Booking[]).find(b =>
            ['accepted', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(b.status)
          ) || null

          if (active?.id !== activeBooking?.id || active?.status !== activeBooking?.status) {
             setActiveBooking(active || null)
          }
        }
      } catch { /* ignore */ }
    }
    poll()
    const iv = setInterval(poll, 3000)
    return () => clearInterval(iv)
  }, [me?.id, activeBooking?.id, activeBooking?.status])

  // Audio notifications
  const notificationAudio = useRef<HTMLAudioElement | null>(null)
  const prevRequestsLength = useRef(0)

  useEffect(() => {
    notificationAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
  }, [])

  useEffect(() => {
    if (requests.length > prevRequestsLength.current) {
      toast.success('🔔 Yeni yolculuk isteği!', { duration: 10000 })
      try {
        notificationAudio.current?.play().catch(() => { /* ignore */ })
        if (navigator.vibrate) navigator.vibrate([200, 100, 200])
      } catch { /* ignore */ }
    }
    prevRequestsLength.current = requests.length

    if (!selectedRequest && requests.length > 0) {
      setSelectedRequest(requests[0])
    }
  }, [requests, selectedRequest])

  const hasValidLocation = me?.location && (me.location.lat !== 0 || me.location.lng !== 0)

  // Mola/Online toggle
  const toggleAvailability = async () => {
    if (!hasValidLocation) {
      toast.error('Konumunuz yüklenmeden müsait olamazsınız')
      return
    }
    const newStatus = !me?.available
    await setAvailable(newStatus)
    toast.success(newStatus ? 'Online oldunuz!' : 'Molaya geçtiniz')
  }

  // İstek kabul et
  const handleAcceptRequest = async (requestId: string) => {
    try {
      await accept(requestId)
      toast.success('İstek kabul edildi! Rotanız çiziliyor...')
    } catch {
      toast.error('İstek kabul edilemedi. Başka bir sürücü aldı olabilir.')
    }
  }

  return (
    <DriverLayout>
      <div className="h-[calc(100vh-56px)] flex flex-col lg:flex-row">
        {/* Sol Panel - Sürücü Kontrolleri */}
        <div className="w-full lg:w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
          
          {/* Online/Mola Toggle */}
          <div className="p-4 border-b border-gray-700">
            <button
              onClick={toggleAvailability}
              disabled={!hasValidLocation}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                me?.available
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-yellow-600 hover:bg-yellow-700 text-white'
              } ${!hasValidLocation ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {me?.available ? (
                <>
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                  ONLINE - Çağrı Alıyor
                </>
              ) : (
                <>
                  <Coffee className="h-5 w-5" />
                  MOLADA
                </>
              )}
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {locationSource === 'gps' && '📍 GPS konum aktif'}
              {locationSource === 'ip' && '🌐 IP bazlı konum'}
              {locationSource === 'manual' && '👆 Manuel konum'}
              {locationSource === 'none' && '⏳ Konum bekleniyor...'}
            </p>
          </div>

          {/* Aktif Yolculuk */}
          {activeBooking && (
            <div className="p-4 bg-blue-900/50 border-b border-blue-700">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Navigation className="h-5 w-5 text-blue-400" />
                Aktif Yolculuk
              </h3>
              
              <div className="space-y-2 text-sm">
                <p className="text-white font-medium">{activeBooking.pickupLocation?.address}</p>
                <p className="text-gray-300">→ {activeBooking.dropoffLocation?.address}</p>

                {/* Mesafe Bilgisi */}
                <div className="text-xs text-gray-400 mt-2">
                  {typeof metersToPickup === 'number' && activeBooking.status !== 'in_progress' && (
                    <span className="bg-gray-800 px-2 py-1 rounded">📍 Alış: {Math.round(metersToPickup)} m</span>
                  )}
                  {typeof metersToDropoff === 'number' && activeBooking.status === 'in_progress' && (
                    <span className="bg-gray-800 px-2 py-1 rounded">🎯 Varış: {Math.round(metersToDropoff)} m</span>
                  )}
                </div>

                {/* Durum Butonları */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {activeBooking.status === 'accepted' && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        await updateBookingStatus(activeBooking.id, 'driver_en_route')
                        const url = `https://www.google.com/maps/dir/?api=1&origin=${me?.location?.lat},${me?.location?.lng}&destination=${activeBooking.pickupLocation?.lat},${activeBooking.pickupLocation?.lng}&travelmode=driving`
                        window.open(url, '_blank')
                      }}
                      className="bg-green-600 hover:bg-green-700 w-full"
                    >
                      🚗 Yola Çık & Navigasyon
                    </Button>
                  )}
                  {activeBooking.status === 'driver_en_route' && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        await updateBookingStatus(activeBooking.id, 'driver_arrived')
                        toast.success('Müşteriye vardınız!')
                      }}
                      className="bg-blue-600 hover:bg-blue-700 w-full"
                    >
                      ✅ Geldim
                    </Button>
                  )}
                  {activeBooking.status === 'driver_arrived' && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        await confirmPickup(activeBooking.id)
                        toast.success('Yolculuk başladı!')
                        const url = `https://www.google.com/maps/dir/?api=1&origin=${activeBooking.pickupLocation?.lat},${activeBooking.pickupLocation?.lng}&destination=${activeBooking.dropoffLocation?.lat},${activeBooking.dropoffLocation?.lng}&travelmode=driving`
                        window.open(url, '_blank')
                      }}
                      className="bg-purple-600 hover:bg-purple-700 w-full"
                    >
                      🚀 Müşteriyi Aldım
                    </Button>
                  )}
                  {activeBooking.status === 'in_progress' && (
                    <>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=${me?.location?.lat},${me?.location?.lng}&destination=${activeBooking.dropoffLocation?.lat},${activeBooking.dropoffLocation?.lng}&travelmode=driving`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1"
                      >
                        <Button size="sm" variant="outline" className="text-white border-white w-full">
                          🗺️ Navigasyon
                        </Button>
                      </a>
                      <Button
                        size="sm"
                        disabled={typeof metersToDropoff === 'number' && metersToDropoff > 200}
                        onClick={async () => {
                          try { await stopRouteRecordingAndSave(activeBooking.id) } catch { /* ignore */ }
                          await updateBookingStatus(activeBooking.id, 'completed')
                          await setAvailable(true)
                          toast.success('Yolculuk tamamlandı! 🎉')
                        }}
                        className="bg-green-600 hover:bg-green-700 flex-1"
                      >
                        ✅ Tamamla
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Gelen İstekler */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Gelen İstekler
                {requests.length > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
                    {requests.length}
                  </span>
                )}
              </h3>
            </div>

            <div className="divide-y divide-gray-700">
              {approved === true && requests.map(r => (
                <div
                  key={r.id}
                  className={`p-4 cursor-pointer transition-all ${selectedRequest?.id === r.id ? 'bg-blue-900/50 border-l-4 border-blue-500' : 'hover:bg-gray-700/50'}`}
                  onClick={() => setSelectedRequest(r)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0 animate-pulse">
                      <Phone className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{r.pickup.address}</p>
                      <p className="text-gray-400 text-sm truncate">→ {r.dropoff.address}</p>
                      <p className="text-gray-500 text-xs mt-1">🚗 {r.vehicleType}</p>
                    </div>
                  </div>

                  {/* Hızlı Kabul Butonları */}
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleAcceptRequest(r.id) }}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Kabul Et
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); setSelectedRequest(null) }}
                      className="text-white border-gray-600"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {approved === true && requests.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Phone className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Bekleyen istek yok</p>
                  <p className="text-sm mt-1">Online olduğunuzda istekler burada görünecek</p>
                </div>
              )}

              {approved === false && (
                <div className="p-8 text-center text-yellow-500">
                  <Clock className="h-12 w-12 mx-auto mb-3" />
                  <p>Başvurunuz onay bekliyor</p>
                  <p className="text-sm mt-1 text-gray-400">Yönetici onay verdikten sonra çağrı alabilirsiniz</p>
                </div>
              )}
            </div>
          </div>

          {/* Günlük Kazanç */}
          <div className="p-4 border-t border-gray-700 bg-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Bugün:</span>
              <span className="text-2xl font-bold text-green-400">₺{earnings?.daily || 0}</span>
            </div>
          </div>
        </div>

        {/* Sağ Panel - Harita */}
        <div className="flex-1 relative">
          <OpenStreetMap
            center={hasValidLocation ? me.location : DEFAULT_CENTER}
            customerLocation={customerLiveLocation || (activeBooking?.pickupLocation)}
            destination={activeBooking ? (activeBooking.status === 'in_progress' ? activeBooking.dropoffLocation : activeBooking.pickupLocation) : (selectedRequest ? selectedRequest.pickup : undefined)}
            drivers={hasValidLocation ? [{ id: me.id, name: me.name, location: me.location, rating: 0, available: me.available }] : []}
            highlightDriverId={me?.id}
            onMapClick={(loc) => {
              setLocationSource('manual')
              updateLocation(loc)
              toast.success('Konum güncellendi!')
            }}
            path={activeBooking ? (useBookingStore.getState().routePoints || []) : []}
            pickupLocation={activeBooking?.pickupLocation}
            dropoffLocation={activeBooking?.dropoffLocation}
            showRoute={activeBooking ? (activeBooking.status === 'in_progress' ? 'to_dropoff' : 'to_pickup') : undefined}
          />

          {/* Harita Uyarı */}
          <div className="absolute bottom-4 left-4 right-4 lg:left-4 lg:right-auto lg:w-80 bg-gray-900/90 text-white text-sm px-4 py-3 rounded-lg flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-400" />
            <span>Konumunuz müşterilere görünür durumda</span>
          </div>
        </div>
      </div>
    </DriverLayout>
  )
}

export default DriverDashboard
