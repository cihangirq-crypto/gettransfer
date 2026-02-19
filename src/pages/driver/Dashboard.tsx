import React, { useEffect, useState, useRef } from 'react'
import { useDriverStore } from '@/stores/driverStore'
import { useAuthStore } from '@/stores/authStore'
import { useBookingStore } from '@/stores/bookingStore'
import OpenStreetMap from '@/components/OpenStreetMap'
import { Button } from '@/components/ui/Button'
import { DriverLayout } from '@/components/DriverLayout'
import { io as ioClient, type Socket } from 'socket.io-client'
import { MapPin, Phone, Navigation, CheckCircle, XCircle, Clock, Coffee, Settings, FileText, User, ChevronRight, Car, Users, DollarSign, Route, PlayCircle, ArrowRight, Volume2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { DEFAULT_CENTER } from '@/config/env'
import { useNavigate } from 'react-router-dom'
import { API } from '@/utils/api'

// Booking tipi
interface BookingData {
  id: string
  customerId?: string
  driverId?: string
  pickupLocation: { lat: number; lng: number; address: string }
  dropoffLocation: { lat: number; lng: number; address: string }
  status: 'pending' | 'accepted' | 'driver_en_route' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled'
  finalPrice?: number
  basePrice?: number
  customerName?: string
  customerPhone?: string
  reservationCode?: string
}

// Rota bilgisi
interface RouteInfo {
  distance: number
  duration: number
  coordinates: Array<{ lat: number; lng: number }>
}

// OSRM'den rota çek
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

export const DriverDashboard = () => {
  const { me, requests, register, refreshRequests, accept, updateLocation, setAvailable, refreshApproval, earnings, fetchEarnings, approved } = useDriverStore()
  const { user } = useAuthStore()
  const { confirmPickup, appendRoutePoint, stopRouteRecordingAndSave, updateBookingStatus, saveRouteProgress } = useBookingStore()
  const navigate = useNavigate()
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [locationSource, setLocationSource] = useState<'gps' | 'ip' | 'manual' | 'none'>('none')

  type RideRequest = { id: string; pickup: { lat:number, lng:number, address:string }; dropoff: { lat:number, lng:number, address:string }; vehicleType: 'sedan'|'suv'|'van'|'luxury'; basePrice?: number }
  const [selectedRequest, setSelectedRequest] = useState<RideRequest | null>(null)
  const [activeBooking, setActiveBooking] = useState<BookingData | null>(null)
  const [customerLiveLocation, setCustomerLiveLocation] = useState<{ lat: number, lng: number } | null>(null)
  const bookingSocketRef = useRef<Socket | null>(null)

  // Rota bilgileri
  const [routeToPickup, setRouteToPickup] = useState<RouteInfo | null>(null)
  const [routeToDropoff, setRouteToDropoff] = useState<RouteInfo | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)

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

  // Sync driver data
  useEffect(() => {
    const sync = async () => {
      if (user && user.role === 'driver' && (!me || me.id !== user.id)) {
        try {
          const res = await fetch(`${API}/drivers/${user.id}`)
          const j = await res.json()
          if (res.ok && j.success && j.data) {
            const serverLoc = j.data.location
            const currentLoc = useDriverStore.getState().me?.location
            const finalLoc = (currentLoc && (currentLoc.lat !== 0 || currentLoc.lng !== 0)) ? currentLoc : serverLoc

            useDriverStore.setState({
              me: {
                id: j.data.id,
                name: j.data.name || 'Sürücü',
                vehicleType: j.data.vehicleType || 'sedan',
                location: finalLoc,
                available: true,
                approved: j.data.approved === true  // Me objesine eklendi
              },
              approved: j.data.approved === true
            })

            try {
              await fetch(`${API}/drivers/${j.data.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ available: true })
              })
            } catch { }

            try { useDriverStore.getState().startRealtime() } catch { }
          } else {
            await register({ id: user.id, name: user.name || 'Sürücü', vehicleType: 'sedan', location: { lat: 0, lng: 0 }, available: true })
          }
        } catch {
          try { await register({ id: user.id, name: user.name || 'Sürücü', vehicleType: 'sedan', location: { lat: 0, lng: 0 }, available: true }) } catch { }
        }
      }
    }
    sync()
  }, [me, user, register])

  useEffect(() => {
    const interval = setInterval(() => { if (me) refreshRequests() }, 3000)
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
    } catch { }
    try {
      const res = await fetch('https://ip-api.com/json/')
      if (res.ok) {
        const data = await res.json()
        if (data.lat && data.lon) return { lat: data.lat, lng: data.lon }
      }
    } catch { }
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
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2)
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
            const dist = R * c
            if (dist > 10 || timeDiff > 10000) shouldUpdate = true
          }

          if (shouldUpdate) {
            lastLocRef.current = { lat: newLat, lng: newLng, time: now }
            updateLocation({ lat: newLat, lng: newLng })
            appendRoutePoint({ lat: newLat, lng: newLng })
            if (activeBooking?.id) {
              sendDriverLocationToBooking(activeBooking.id, { lat: newLat, lng: newLng })
            }
          }
        },
        async (err) => {
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
          toast.warning('Konum bulunamadı.')
        }
      })()
    }

    return () => { if (watchIdLocal) navigator.geolocation.clearWatch(watchIdLocal) }
  }, [me?.id, updateLocation, appendRoutePoint, activeBooking?.id])

  useEffect(() => { if (me) { refreshApproval(); fetchEarnings() } }, [me, refreshApproval, fetchEarnings])

  useEffect(() => {
    if (!activeBooking) return
    const iv = setInterval(() => { saveRouteProgress(activeBooking.id) }, 5000)
    return () => clearInterval(iv)
  }, [activeBooking, saveRouteProgress])

  // Rota hesapla - Aktif booking varsa
  useEffect(() => {
    if (!activeBooking || !me?.location) {
      setRouteToPickup(null)
      setRouteToDropoff(null)
      return
    }

    const calculateRoutes = async () => {
      setRouteLoading(true)
      
      // Şoför müşteriye geliyor
      if (['accepted', 'driver_en_route', 'driver_arrived'].includes(activeBooking.status)) {
        const route = await fetchRoute(me.location, activeBooking.pickupLocation)
        setRouteToPickup(route)
        setRouteToDropoff(null)
      }
      
      // Şoför müşteriyi aldı, hedefe gidiyor
      if (activeBooking.status === 'in_progress') {
        const route = await fetchRoute(me.location, activeBooking.dropoffLocation)
        setRouteToDropoff(route)
        setRouteToPickup(null)
      }
      
      setRouteLoading(false)
    }

    calculateRoutes()
    
    // Her 10 saniyede rotayı güncelle
    const interval = setInterval(calculateRoutes, 10000)
    return () => clearInterval(interval)
  }, [activeBooking?.id, activeBooking?.status, me?.location?.lat, me?.location?.lng])

  const sendDriverLocationToBooking = async (bookingId: string, location: { lat: number; lng: number }) => {
    try {
      const origin = (import.meta.env.VITE_API_ORIGIN as string) || `http://${window.location.hostname}:3005`
      const socket = ioClient(origin, { transports: ['websocket'] })
      socket.emit('booking:join', { bookingId, role: 'driver' })
      socket.emit('driver:location', { bookingId, location })
    } catch { }
  }

  // Socket for customer location
  useEffect(() => {
    const b = activeBooking
    if (!b?.id) {
      setCustomerLiveLocation(null)
      if (bookingSocketRef.current) {
        try { bookingSocketRef.current.disconnect() } catch { }
        bookingSocketRef.current = null
      }
      return
    }
    const origin = (import.meta.env.VITE_API_ORIGIN as string) || `http://${window.location.hostname}:3005`
    const s = ioClient(origin, { transports: ['websocket'], reconnection: true })
    bookingSocketRef.current = s
    s.on('connect', () => { s.emit('booking:join', { bookingId: b.id, role: 'driver' }) })
    s.on('customer:update', (ev: { bookingId?: string; location?: { lat: number; lng: number } }) => {
      if (ev?.bookingId !== b.id) return
      if (ev?.location && typeof ev.location.lat === 'number' && typeof ev.location.lng === 'number') {
        setCustomerLiveLocation(ev.location)
      }
    })
    s.on('booking:update', (next: { id?: string; status?: string }) => {
      if (next?.id !== b.id) return
      setActiveBooking(prev => prev ? { ...prev, ...next } as BookingData : null)
    })
    fetch(`${API}/bookings/${b.id}/customer-location`).then(r => r.json()).then(j => {
      if (j?.success && j?.data && typeof j.data.lat === 'number' && typeof j.data.lng === 'number') setCustomerLiveLocation(j.data)
    }).catch(() => { })
    return () => {
      try { s.emit('booking:leave', { bookingId: b.id }) } catch { }
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
        const res = await fetch(`${API}/bookings/by-driver/${me.id}`)
        const j = await res.json()
        if (res.ok && j.success && Array.isArray(j.data)) {
          const active = (j.data as BookingData[]).find(b =>
            ['accepted', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(b.status)
          ) || null
          if (active?.id !== activeBooking?.id || active?.status !== activeBooking?.status) {
             setActiveBooking(active || null)
          }
        }
      } catch { }
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
        notificationAudio.current?.play().catch(() => { })
        if (navigator.vibrate) navigator.vibrate([200, 100, 200])
      } catch { }
    }
    prevRequestsLength.current = requests.length
    if (!selectedRequest && requests.length > 0) setSelectedRequest(requests[0])
  }, [requests, selectedRequest])

  const hasValidLocation = me?.location && (me.location.lat !== 0 || me.location.lng !== 0)

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
      
      // Booking'i hemen çek ve durumunu güncelle
      setTimeout(async () => {
        if (me) {
          const res = await fetch(`${API}/bookings/by-driver/${me.id}`)
          const j = await res.json()
          if (res.ok && j.success && Array.isArray(j.data)) {
            const active = j.data.find((b: BookingData) =>
              ['accepted', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(b.status)
            )
            if (active) {
              setActiveBooking(active)
              // Otomatik olarak "yola çıktım" durumuna geçir
              setTimeout(() => handleStartEnRoute(), 1000)
            }
          }
        }
      }, 500)
    } catch {
      toast.error('İstek kabul edilemedi.')
    }
  }

  // Yola çıktım
  const handleStartEnRoute = async () => {
    if (!activeBooking) return
    await updateBookingStatus(activeBooking.id, 'driver_en_route')
    setActiveBooking({ ...activeBooking, status: 'driver_en_route' })
    toast.success('🚗 Yola çıktınız! Rotanız hazırlanıyor...')
    
    // Google Maps navigasyon aç
    if (me?.location && activeBooking.pickupLocation) {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${me.location.lat},${me.location.lng}&destination=${activeBooking.pickupLocation.lat},${activeBooking.pickupLocation.lng}&travelmode=driving`
      window.open(url, '_blank')
    }
  }

  // Müşteriye vardım
  const handleArrived = async () => {
    if (!activeBooking) return
    await updateBookingStatus(activeBooking.id, 'driver_arrived')
    setActiveBooking({ ...activeBooking, status: 'driver_arrived' })
    toast.success('📍 Müşteriye ulaştınız! Müşteriyi bekleyin.')
  }

  // Müşteriyi aldım (ONAY GEREKLİ)
  const handlePickup = async () => {
    if (!activeBooking) return
    
    // Onay iste
    const confirmed = confirm('Müşteri araca bindiğini onaylıyor musunuz?')
    if (!confirmed) return
    
    await confirmPickup(activeBooking.id)
    setActiveBooking({ ...activeBooking, status: 'in_progress' })
    toast.success('✅ Müşteri alındı! Yolculuk başladı.')
    
    // Google Maps navigasyon aç - varış noktasına
    if (activeBooking.dropoffLocation) {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${activeBooking.pickupLocation.lat},${activeBooking.pickupLocation.lng}&destination=${activeBooking.dropoffLocation.lat},${activeBooking.dropoffLocation.lng}&travelmode=driving`
      window.open(url, '_blank')
    }
  }

  // Yolculuk tamamlandı (ONAY GEREKLİ)
  const handleComplete = async () => {
    if (!activeBooking) return
    
    // Onay iste
    const confirmed = confirm('Müşteri hedefe ulaştı mı? Yolculuğu tamamlamak için onaylayın.')
    if (!confirmed) return
    
    try { await stopRouteRecordingAndSave(activeBooking.id) } catch { }
    await updateBookingStatus(activeBooking.id, 'completed')
    await setAvailable(true)
    setActiveBooking(null)
    setRouteToPickup(null)
    setRouteToDropoff(null)
    toast.success('🎉 Yolculuk tamamlandı! Tebrikler!')
  }

  const getRouteMode = (): 'to_pickup' | 'to_dropoff' | undefined => {
    if (!activeBooking) return undefined
    if (['accepted', 'driver_en_route'].includes(activeBooking.status)) return 'to_pickup'
    if (activeBooking.status === 'in_progress') return 'to_dropoff'
    return undefined
  }

  return (
    <DriverLayout>
      <div className="h-[calc(100vh-56px)] flex flex-col lg:flex-row">
        {/* Sol Panel */}
        <div className="w-full lg:w-96 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden">
          
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
            <div className="flex-1 overflow-y-auto">
              {/* Durum Başlığı */}
              <div className={`p-4 ${
                activeBooking.status === 'accepted' ? 'bg-blue-600' :
                activeBooking.status === 'driver_en_route' ? 'bg-yellow-600' :
                activeBooking.status === 'driver_arrived' ? 'bg-green-600' :
                activeBooking.status === 'in_progress' ? 'bg-purple-600' : 'bg-gray-600'
              }`}>
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <Navigation className="h-6 w-6" />
                    <span className="font-bold text-lg">
                      {activeBooking.status === 'accepted' && '✅ Kabul Edildi'}
                      {activeBooking.status === 'driver_en_route' && '🚗 Yola Çıktınız'}
                      {activeBooking.status === 'driver_arrived' && '📍 Müşteride'}
                      {activeBooking.status === 'in_progress' && '🛣️ Yolda'}
                    </span>
                  </div>
                  {activeBooking.reservationCode && (
                    <span className="text-sm bg-white/20 px-2 py-1 rounded">
                      #{activeBooking.reservationCode}
                    </span>
                  )}
                </div>
              </div>

              {/* Rota Bilgisi */}
              {routeLoading ? (
                <div className="p-4 bg-gray-700 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  <span className="text-sm text-gray-300">Rota hesaplanıyor...</span>
                </div>
              ) : (
                (routeToPickup || routeToDropoff) && (
                  <div className="p-4 bg-gray-700 border-b border-gray-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-white">
                            {Math.round((routeToPickup || routeToDropoff)?.distance || 0)}
                          </p>
                          <p className="text-xs text-gray-400">km</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-500" />
                        <div className="text-center">
                          <p className="text-2xl font-bold text-white">
                            {Math.round((routeToPickup || routeToDropoff)?.duration || 0)}
                          </p>
                          <p className="text-xs text-gray-400">dk</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          {routeToPickup ? 'Alış noktasına' : 'Varış noktasına'}
                        </p>
                        <p className="text-sm text-green-400 font-medium">
                          {routeToPickup ? '📍 Müşteriye' : '🎯 Hedefe'}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Adresler */}
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-3 p-3 bg-gray-700/50 rounded-lg">
                  <div className="w-4 h-4 bg-green-500 rounded-full mt-1 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">ALIŞ NOKTASI</p>
                    <p className="text-white font-medium">{activeBooking.pickupLocation?.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-700/50 rounded-lg">
                  <div className="w-4 h-4 bg-red-500 rounded-full mt-1 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">VARIŞ NOKTASI</p>
                    <p className="text-white font-medium">{activeBooking.dropoffLocation?.address}</p>
                  </div>
                </div>
              </div>

              {/* Fiyat */}
              <div className="px-4 pb-4">
                <div className="p-4 bg-gradient-to-r from-green-900/50 to-emerald-900/50 border border-green-700/50 rounded-lg flex items-center justify-between">
                  <span className="text-gray-300">Tahmini Kazanç:</span>
                  <span className="text-2xl font-bold text-green-400">
                    ₺{(activeBooking.finalPrice || activeBooking.basePrice || 0).toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Durum Butonları */}
              <div className="p-4 border-t border-gray-700 space-y-3">
                {activeBooking.status === 'accepted' && (
                  <Button
                    size="lg"
                    onClick={handleStartEnRoute}
                    className="w-full bg-green-600 hover:bg-green-700 py-4 text-lg font-bold"
                  >
                    <PlayCircle className="h-6 w-6 mr-2" />
                    Yola Çıktım
                  </Button>
                )}
                
                {activeBooking.status === 'driver_en_route' && (
                  <div className="space-y-2">
                    <Button
                      size="lg"
                      onClick={handleArrived}
                      className="w-full bg-blue-600 hover:bg-blue-700 py-4 text-lg font-bold"
                    >
                      <CheckCircle className="h-6 w-6 mr-2" />
                      Müşteriye Ulaştım
                    </Button>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&origin=${me?.location?.lat},${me?.location?.lng}&destination=${activeBooking.pickupLocation?.lat},${activeBooking.pickupLocation?.lng}&travelmode=driving`}
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                    >
                      <Button variant="outline" className="w-full py-3 text-white border-white hover:bg-white/10">
                        <Navigation className="h-5 w-5 mr-2" />
                        Navigasyon Aç
                      </Button>
                    </a>
                  </div>
                )}
                
                {activeBooking.status === 'driver_arrived' && (
                  <div className="space-y-2">
                    <Button
                      size="lg"
                      onClick={handlePickup}
                      className="w-full bg-purple-600 hover:bg-purple-700 py-4 text-lg font-bold animate-pulse"
                    >
                      <Users className="h-6 w-6 mr-2" />
                      Müşteriyi Aldım ✓
                    </Button>
                    <p className="text-xs text-center text-yellow-400">
                      ⚠️ Müşteri araca bindikten sonra onaylayın
                    </p>
                  </div>
                )}
                
                {activeBooking.status === 'in_progress' && (
                  <div className="space-y-2">
                    <Button
                      size="lg"
                      onClick={handleComplete}
                      className="w-full bg-green-600 hover:bg-green-700 py-4 text-lg font-bold"
                    >
                      <CheckCircle className="h-6 w-6 mr-2" />
                      Yolculuk Tamamlandı ✓
                    </Button>
                    <p className="text-xs text-center text-yellow-400">
                      ⚠️ Müşteri indiğinde onaylayın
                    </p>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&origin=${me?.location?.lat},${me?.location?.lng}&destination=${activeBooking.dropoffLocation?.lat},${activeBooking.dropoffLocation?.lng}&travelmode=driving`}
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                    >
                      <Button variant="outline" className="w-full py-3 text-white border-white hover:bg-white/10">
                        <Navigation className="h-5 w-5 mr-2" />
                        Navigasyon Aç
                      </Button>
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Gelen İstekler */}
          {!activeBooking && (
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
                {me?.approved === true && requests.map(r => (
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
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-gray-500 text-xs">🚗 {r.vehicleType}</span>
                          {r.basePrice && (
                            <span className="text-green-400 text-xs font-medium">₺{r.basePrice.toFixed(0)}</span>
                          )}
                        </div>
                      </div>
                    </div>

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

                {me?.approved === true && requests.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    <Phone className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Bekleyen istek yok</p>
                    <p className="text-sm mt-1">Online olduğunuzda istekler burada görünecek</p>
                  </div>
                )}

                {me?.approved === false && (
                  <div className="p-8 text-center text-yellow-500">
                    <Clock className="h-12 w-12 mx-auto mb-3" />
                    <p>Başvurunuz onay bekliyor</p>
                    <p className="text-sm mt-1 text-gray-400">Yönetici onay verdikten sonra çağrı alabilirsiniz</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Kazanç */}
          <div className="p-4 border-t border-gray-700 bg-gray-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">Bugün:</span>
              <span className="text-2xl font-bold text-green-400">₺{earnings?.daily || 0}</span>
            </div>
            
            <div className="relative">
              <button
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>Ayarlar</span>
                </div>
                <ChevronRight className={`h-4 w-4 transition-transform ${showSettingsMenu ? 'rotate-90' : ''}`} />
              </button>
              
              {showSettingsMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-700 rounded-lg border border-gray-600 shadow-xl overflow-hidden z-10">
                  <button
                    onClick={() => { navigate('/driver/documents'); setShowSettingsMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-600 text-gray-300 transition-colors"
                  >
                    <FileText className="h-4 w-4 text-blue-400" />
                    <span>Belgelerim</span>
                  </button>
                  <button
                    onClick={() => { navigate('/driver/profile'); setShowSettingsMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-600 text-gray-300 transition-colors"
                  >
                    <User className="h-4 w-4 text-green-400" />
                    <span>Profilim</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Harita */}
        <div className="flex-1 relative">
          <OpenStreetMap
            center={hasValidLocation ? me.location : DEFAULT_CENTER}
            customerLocation={customerLiveLocation || (activeBooking?.pickupLocation)}
            destination={activeBooking ? (activeBooking.status === 'in_progress' ? activeBooking.dropoffLocation : activeBooking.pickupLocation) : (selectedRequest ? selectedRequest.pickup : undefined)}
            drivers={hasValidLocation ? [{ id: me.id, name: me.name, location: me.location, rating: 0, available: me.available }] : []}
            highlightDriverId={me?.id}
            driverLocation={me?.location}
            onMapClick={(loc) => {
              setLocationSource('manual')
              updateLocation(loc)
              toast.success('Konum güncellendi!')
            }}
            path={routeToPickup?.coordinates || routeToDropoff?.coordinates || (useBookingStore.getState().routePoints || [])}
            pickupLocation={activeBooking?.pickupLocation}
            dropoffLocation={activeBooking?.dropoffLocation}
            showRoute={getRouteMode()}
          />

          {/* Rota Bilgisi Overlay */}
          {!activeBooking && me?.available && (
            <div className="absolute bottom-4 left-4 right-4 lg:left-4 lg:right-auto lg:w-80 bg-gray-900/90 text-white text-sm px-4 py-3 rounded-lg flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span>Konumunuz müşterilere görünür durumda</span>
            </div>
          )}
        </div>
      </div>
    </DriverLayout>
  )
}

export default DriverDashboard
