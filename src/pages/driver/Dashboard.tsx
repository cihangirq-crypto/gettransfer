import React, { useEffect, useState, useRef } from 'react'
import { useDriverStore } from '@/stores/driverStore'
import { useAuthStore } from '@/stores/authStore'
import { useBookingStore } from '@/stores/bookingStore'
import OpenStreetMap from '@/components/OpenStreetMap'
import { Button } from '@/components/ui/Button'
import { io as ioClient, type Socket } from 'socket.io-client'
import { Car, User, MapPin, Star, TrendingUp, Clock, CheckCircle, Settings, Camera, FileText, DollarSign, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { DEFAULT_CENTER } from '@/config/env'
import { currencySymbol } from '@/utils/pricing'
import type { Booking } from '@/types'

export const DriverDashboard = () => {
  const { me, requests, register, refreshRequests, accept, updateLocation, setAvailable, refreshApproval, earnings, fetchEarnings, submitComplaint, approved, updateProfile, isConnected } = useDriverStore()
  const { user } = useAuthStore()
  const { confirmPickup, appendRoutePoint, stopRouteRecordingAndSave, updateBookingStatus, saveRouteProgress } = useBookingStore()
  
  const [form, setForm] = useState({ id: '', name: '', vehicleType: 'sedan', lat: 0, lng: 0 })
  const [locating, setLocating] = useState(true)
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
  const [vehicleModelInput, setVehicleModelInput] = useState('')
  const [vehicleImages, setVehicleImages] = useState<Array<{full:string, thumb:string}>>([])
  const [primaryVehicleImage, setPrimaryVehicleImage] = useState<string | null>(null)
  const [licensePlate, setLicensePlate] = useState('')
  const vehicleFileRef = useRef<HTMLInputElement | null>(null)
  
  type RideRequest = { id: string; pickup: { lat:number, lng:number, address:string }; dropoff: { lat:number, lng:number, address:string }; vehicleType: 'sedan'|'suv'|'van'|'luxury' }
  const [selectedRequest, setSelectedRequest] = useState<RideRequest | null>(null)
  const [watchId, setWatchId] = useState<number | null>(null)
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null)
  const [customerLiveLocation, setCustomerLiveLocation] = useState<{ lat: number, lng: number } | null>(null)
  const [stats, setStats] = useState({ todayTrips: 0, weeklyTrips: 0, avgRating: 4.8, totalEarnings: 0 })
  const [installEvt, setInstallEvt] = useState<any>(null)
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
  const nearCustomer = customerLiveLocation ? calcMeters(me?.location, customerLiveLocation) : null
  const nearCustomerNotifiedRef = useRef(false)

  useEffect(() => { if (me) refreshRequests() }, [me, refreshRequests])

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallEvt(e) }
    window.addEventListener('beforeinstallprompt', handler as any)
    return () => window.removeEventListener('beforeinstallprompt', handler as any)
  }, [])
  
  useEffect(() => {
    const sync = async () => {
      if (user && user.role === 'driver' && (!me || me.id !== user.id)) {
        try {
          const res = await fetch(`/api/drivers/${user.id}`)
          const j = await res.json()
          if (res.ok && j.success && j.data) {
            setForm(f => ({ ...f, name: j.data.name || f.name }))
            setAvailable(!!j.data.available)
            setStats(s => ({ ...s }))
            // Race condition önlemek için eğer GPS zaten çalışıyorsa (0,0 değilse) sunucudan gelen konumu ezme
            const serverLoc = j.data.location
            const currentLoc = useDriverStore.getState().me?.location
            const finalLoc = (currentLoc && (currentLoc.lat !== 0 || currentLoc.lng !== 0)) ? currentLoc : serverLoc

            useDriverStore.setState({ me: { id: j.data.id, name: j.data.name || 'Sürücü', vehicleType: j.data.vehicleType || 'sedan', location: finalLoc, available: j.data.available } })
            try { useDriverStore.getState().startRealtime() } catch {}
          } else {
            await register({ id: user.id, name: user.name || 'Sürücü', vehicleType: 'sedan', location: { lat: form.lat, lng: form.lng }, available: true })
          }
        } catch {
          try { await register({ id: user.id, name: user.name || 'Sürücü', vehicleType: 'sedan', location: { lat: form.lat, lng: form.lng }, available: true }) } catch {}
        }
      }
    }
    sync()
  }, [me, user])
  
  useEffect(() => {
    const interval = setInterval(() => { if (me) refreshRequests() }, 5000)
    return () => clearInterval(interval)
  }, [me, refreshRequests])
  
  // Location optimization refs
  const lastLocRef = useRef<{lat:number, lng:number, time:number}|null>(null)

  useEffect(() => {
    if (navigator.geolocation && me?.id) {
      const id = navigator.geolocation.watchPosition(p => {
        setLocating(false)
        
        const newLat = p.coords.latitude
        const newLng = p.coords.longitude
        const now = Date.now()
        
        // Optimization: Throttle & Distance Filter
        let shouldUpdate = false
        
        if (!lastLocRef.current) {
          shouldUpdate = true
        } else {
          const { lat: oldLat, lng: oldLng, time: oldTime } = lastLocRef.current
          const timeDiff = now - oldTime
          
          // Haversine distance (meters)
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
          
          // Update if moved > 10m OR last update was > 10s ago
          if (dist > 10 || timeDiff > 10000) {
            shouldUpdate = true
          }
        }

        if (shouldUpdate) {
          lastLocRef.current = { lat: newLat, lng: newLng, time: now }
          updateLocation({ lat: newLat, lng: newLng })
          appendRoutePoint({ lat: newLat, lng: newLng })
        }
      }, (err) => {
        console.warn('GPS hatası:', err.message)
        toast.error('Konum alınamıyor: ' + err.message)
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }) as unknown as number
      setWatchId(id)
      return () => { try { if (id) navigator.geolocation.clearWatch(id) } catch {} }
    }
  }, [me?.id])
  
  useEffect(() => { if (me) { refreshApproval(); fetchEarnings() } }, [me])
  useEffect(() => {
    if (!me) return
    let alive = true
    const tick = async () => {
      if (!alive) return
      try { await refreshApproval() } catch {}
      // Always keep checking approval status periodically, not just when unapproved
      if (alive) setTimeout(tick, 5000)
    }
    setTimeout(tick, 1000)
    return () => { alive = false }
  }, [me]) // Removed 'approved' dependency to prevent loop/stale closure issues

  useEffect(() => {
    if (!activeBooking) return
    const iv = setInterval(() => {
      saveRouteProgress(activeBooking.id)
    }, 5000)
    return () => clearInterval(iv)
  }, [activeBooking])

  useEffect(() => {
    const b = activeBooking
    if (!b?.id) {
      setCustomerLiveLocation(null)
      if (bookingSocketRef.current) {
        try { bookingSocketRef.current.disconnect() } catch {}
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
    s.on('customer:update', (ev: any) => {
      if (ev?.bookingId !== b.id) return
      if (ev?.location && typeof ev.location.lat === 'number' && typeof ev.location.lng === 'number') {
        setCustomerLiveLocation(ev.location)
      }
    })
    s.on('booking:update', (next: any) => {
      if (next?.id !== b.id) return
      setActiveBooking(next)
    })
    fetch(`/api/bookings/${b.id}/customer-location`).then(r => r.json()).then(j => {
      if (j?.success && j?.data && typeof j.data.lat === 'number' && typeof j.data.lng === 'number') setCustomerLiveLocation(j.data)
    }).catch(() => {})
    return () => {
      try { s.emit('booking:leave', { bookingId: b.id }) } catch {}
      s.disconnect()
      bookingSocketRef.current = null
    }
  }, [activeBooking?.id])

  useEffect(() => {
    if (!me) return
    const poll = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch(`/api/bookings/by-driver/${me.id}`)
        const j = await res.json()
        if (res.ok && j.success && Array.isArray(j.data)) {
          // Find any active booking (accepted, en_route, arrived, in_progress)
          // Filter out completed/cancelled
          const active = (j.data as Booking[]).find(b => 
            ['accepted', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(b.status)
          ) || null
          
          // Only update if ID changed or status changed to avoid re-renders
          if (active?.id !== activeBooking?.id || active?.status !== activeBooking?.status) {
             setActiveBooking(active || null)
          }
        }
      } catch {}
    }
    poll()
    const iv = setInterval(poll, 3000) // Poll more frequently for faster sync
    return () => clearInterval(iv)
  }, [me?.id, activeBooking?.id, activeBooking?.status])

  // Audio for notifications
  const notificationAudio = useRef<HTMLAudioElement | null>(null)
  const prevRequestsLength = useRef(0)

  useEffect(() => {
    notificationAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
  }, [])

  useEffect(() => {
    if (requests.length > prevRequestsLength.current) {
      // New request received
      toast.success('Yeni yolculuk talebi!', { duration: 5000 })
      try {
        notificationAudio.current?.play().catch(() => {})
        if (navigator.vibrate) navigator.vibrate([200, 100, 200])
      } catch {}
    }
    prevRequestsLength.current = requests.length
    
    if (!selectedRequest && requests.length > 0) {
      setSelectedRequest(requests[0])
    }
  }, [requests])

  useEffect(() => {
    if (me) {
      const saved = localStorage.getItem(`driver_profile_${me.id}`)
      if (saved) {
        try {
          const j = JSON.parse(saved)
          setProfilePhoto(j.profilePhoto || null)
          setVehicleImages(j.vehicleImages || [])
          setVehicleModelInput(j.vehicleModel || '')
          setPrimaryVehicleImage(j.primaryVehicleImage || null)
          setLicensePlate(j.licensePlate || '')
          setForm(f => ({ ...f, name: j.name || f.name }))
        } catch {}
      }
    }
  }, [me])

  useEffect(() => {
    if (!me) return
    const applyDefaults = async () => {
      const key = `driver_profile_${me.id}`
      let prev: any = {}
      try { prev = JSON.parse(localStorage.getItem(key) || '{}') } catch {}
      const next: any = { ...prev }
      if (!me.licensePlate || !prev.licensePlate) next.licensePlate = '34 ABC 987'
      if (!me.vehicleModel || !prev.vehicleModel) next.vehicleModel = 'Toyota Corolla Sedan'
      if (!prev.name) next.name = me.name || 'Sürücü'
      const carUrl = 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=high%20quality%20photo%20of%20silver%20sedan%20car%2C%203%2F4%20front%20view%2C%20city%20street%2C%20daylight%2C%20realistic%20details&image_size=landscape_16_9'
      if (!prev.primaryVehicleImage) next.primaryVehicleImage = carUrl
      if (!Array.isArray(prev.vehicleImages) || prev.vehicleImages.length === 0) next.vehicleImages = [{ full: carUrl, thumb: carUrl }]
      try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
      setVehicleModelInput(next.vehicleModel || '')
      setPrimaryVehicleImage(next.primaryVehicleImage || null)
      setVehicleImages(next.vehicleImages || [])
      setLicensePlate(next.licensePlate || '')
      setForm(f => ({ ...f, name: next.name || f.name }))
      try { await updateProfile({ name: next.name, vehicleModel: next.vehicleModel, licensePlate: next.licensePlate }) } catch {}
    }
    applyDefaults()
  }, [me])

  useEffect(() => {
    if (typeof nearCustomer !== 'number') return
    if (nearCustomer <= 50) {
      if (!nearCustomerNotifiedRef.current) {
        nearCustomerNotifiedRef.current = true
        toast.success('Müşteri ile aynı konumdasınız.')
      }
    } else {
      nearCustomerNotifiedRef.current = false
    }
  }, [nearCustomer])

  useEffect(() => {
    if (earnings) {
      setStats(s => ({ ...s, totalEarnings: earnings.monthly || 0 }))
    }
  }, [earnings])

  const handleImageUpload = async (file: File, type: 'profile' | 'vehicle') => {
    if (!file) return
    const okType = /image\/(jpeg|png)/.test(file.type)
    if (!okType) {
      toast.error('JPEG/PNG yükleyin')
      return
    }
    const img = await readImage(file)
    if (type === 'profile' && (img.width < 200 || img.height < 200)) {
      toast.error('Profil resmi en az 200x200 olmalı')
      return
    }
    if (type === 'vehicle' && (img.width < 800 || img.height < 600)) {
      toast.error('Araç resmi en az 800x600 olmalı')
      return
    }
    
    if (type === 'profile') {
      const dataUrl = await toDataURL(img)
      if (bytesFromDataUrl(dataUrl) > 1500000) {
        toast.error('Resim 1.5MB sınırını aşıyor')
        return
      }
      setProfilePhoto(dataUrl)
      if (me) persistProfile(me.id, { profilePhoto: dataUrl })
      toast.success('Profil fotoğrafı yüklendi')
    } else {
      const full = await toDataURL(img)
      const thumb = await toThumbnail(img, 240, 180)
      if (bytesFromDataUrl(thumb) > 500000) {
        toast.error('Küçük görsel 500KB sınırını aşıyor')
        return
      }
      const next = [...vehicleImages, { full, thumb }].slice(-5)
      setVehicleImages(next)
      setPrimaryVehicleImage(full)
      if (me) {
        persistProfile(me.id, { vehicleImages: next.map(v => ({ thumb: v.thumb })) })
        persistProfile(me.id, { primaryVehicleImage: thumb })
      }
      toast.success('Araç resmi yüklendi')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Sürücü Paneli</h1>
          <p className="text-gray-600">
            {me ? `Hoş geldiniz, ${me.name}` : 'Sisteme kayıt olun'} 
            {me && (
              <span className={`ml-3 text-sm font-medium px-2 py-0.5 rounded ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {isConnected ? 'Çevrimiçi' : 'Bağlantı Yok'}
              </span>
            )}
          </p>
          {installEvt && (
            <div className="mt-3">
              <Button size="sm" onClick={async()=>{ try { await installEvt.prompt(); setInstallEvt(null) } catch {} }}>Uygulamayı Kur</Button>
            </div>
          )}
        </div>

        {/* Approval info */}
        {me && approved === false && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 rounded-lg">
            <p className="text-sm text-yellow-900">Başvurunuz alındı. Yönetici onayı bekleniyor.</p>
          </div>
        )}
        {me && approved === true && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-8 rounded-lg">
            <p className="text-sm text-green-900">Onaylandı. Tüm sürücü özellikleri aktif.</p>
          </div>
        )}

        {!me ? (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Sürücü Kaydı</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {(!user || user.role !== 'driver') && (
                <input className="border rounded-lg px-4 py-3" placeholder="Sürücü ID" value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} />
              )}
              <input className="border rounded-lg px-4 py-3" placeholder="Ad Soyad" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <select className="border rounded-lg px-4 py-3" value={form.vehicleType} onChange={e => setForm({ ...form, vehicleType: e.target.value as any })}>
                <option value="sedan">Sedan</option>
                <option value="suv">SUV</option>
                <option value="van">Van</option>
                <option value="luxury">Lüks</option>
              </select>
              <Button onClick={() => register({ id: (user?.id || form.id), name: form.name, vehicleType: form.vehicleType as any, location: { lat: form.lat, lng: form.lng }, available: true })}>
                Kaydol
              </Button>
            </div>
            <div className="mt-6 h-96 rounded-lg overflow-hidden border border-gray-200">
              <OpenStreetMap center={{ lat: form.lat, lng: form.lng }} customerLocation={{ lat: form.lat, lng: form.lng }} drivers={[]} onMapClick={(loc) => setForm({ ...form, lat: loc.lat, lng: loc.lng })} />
            </div>
          </div>
        ) : (
          <div>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">Günlük Kazanç</p>
                    <p className="text-3xl font-bold mt-1">₺{earnings?.daily || 0}</p>
                  </div>
                  <DollarSign className="h-12 w-12 text-blue-200" />
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm">Haftalık Kazanç</p>
                    <p className="text-3xl font-bold mt-1">₺{earnings?.weekly || 0}</p>
                  </div>
                  <TrendingUp className="h-12 w-12 text-green-200" />
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm">Aylık Kazanç</p>
                    <p className="text-3xl font-bold mt-1">₺{earnings?.monthly || 0}</p>
                  </div>
                  <DollarSign className="h-12 w-12 text-purple-200" />
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm">Ortalama Puan</p>
                    <p className="text-3xl font-bold mt-1">{stats.avgRating}</p>
                  </div>
                  <Star className="h-12 w-12 text-orange-200 fill-current" />
                </div>
              </div>
            </div>

            {/* Interactive blocks */}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Map & Requests */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center">
                      <MapPin className="h-6 w-6 mr-2 text-blue-600" />
                      Konumunuz ve Rota
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Müsait</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={me.available} onChange={(e) => {
                          const next = e.target.checked
                          if (next && (!me.location || (me.location.lat === 0 && me.location.lng === 0))) {
                            toast.error('Müsait duruma geçmek için önce konum seçin')
                            return
                          }
                          setAvailable(next)
                        }} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                  <div className="h-96 rounded-lg overflow-hidden border border-gray-200 relative">
                    {locating && (!me.location || (me.location.lat === 0 && me.location.lng === 0)) && (
                      <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
                        <span className="text-sm text-gray-600">Konum alınıyor...</span>
                      </div>
                    )}
                    <OpenStreetMap
                        center={me.location && (me.location.lat !== 0 || me.location.lng !== 0) ? me.location : DEFAULT_CENTER}
                        customerLocation={customerLiveLocation || (me.location && (me.location.lat !== 0 || me.location.lng !== 0) ? me.location : DEFAULT_CENTER)}
                        destination={activeBooking ? (activeBooking.status === 'in_progress' ? activeBooking.dropoffLocation : activeBooking.pickupLocation) : (selectedRequest ? selectedRequest.pickup : undefined)}
                        drivers={[{ id: me.id, name: me.name, location: me.location && (me.location.lat !== 0 || me.location.lng !== 0) ? me.location : DEFAULT_CENTER, rating: 0, available: me.available }]}
                        highlightDriverId={me.id}
                        onMapClick={(loc) => updateLocation(loc)}
                        path={activeBooking ? (useBookingStore.getState().routePoints || []) : []}
                        pickupLocation={activeBooking?.pickupLocation}
                        dropoffLocation={activeBooking?.dropoffLocation}
                        showRoute={activeBooking ? (activeBooking.status === 'in_progress' ? 'to_dropoff' : 'to_pickup') : undefined}
                      />
                  </div>
                  {activeBooking && approved === true && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="font-semibold text-blue-900 mb-2">Aktif Rezervasyon</h3>
                      <p className="text-sm text-blue-800">{activeBooking.pickupLocation?.address} → {activeBooking.dropoffLocation?.address}</p>
                      <div className="mt-1 text-xs text-blue-700">
                        {typeof metersToPickup === 'number' ? `Alış noktasına: ${Math.round(metersToPickup)} m` : ''}
                        {typeof metersToDropoff === 'number' ? ` • Varış noktasına: ${Math.round(metersToDropoff)} m` : ''}
                      </div>
                      <div className="mt-2 text-xs text-blue-800">
                        {(() => {
                          const cur = (activeBooking as any)?.extras?.pricing?.currency || 'EUR'
                          const sym = currencySymbol(cur)
                          const driverFare = Number(activeBooking.basePrice || 0)
                          const total = Number(activeBooking.finalPrice ?? activeBooking.basePrice ?? 0)
                          const fee = Math.max(0, total - driverFare)
                          return `Müşteri: ${sym}${total.toFixed(2)} • Sizin kazanç: ${sym}${driverFare.toFixed(2)} • Bizim pay: ${sym}${fee.toFixed(2)}`
                        })()}
                      </div>
                      
                      {/* Durum Göstergesi */}
                      <div className="mt-3 p-2 rounded bg-white/70">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {activeBooking.status === 'accepted' && (
                            <span className="text-yellow-700">⏳ Müşteri bekleniyor - Yola çıkın</span>
                          )}
                          {activeBooking.status === 'driver_en_route' && (
                            <span className="text-blue-700">🚗 Müşteriye doğru yola çıktınız</span>
                          )}
                          {activeBooking.status === 'driver_arrived' && (
                            <span className="text-green-700">✅ Müşteri yanındasınız - Yolculuğu başlatın</span>
                          )}
                          {activeBooking.status === 'in_progress' && (
                            <span className="text-purple-700">🚀 Yolculuk devam ediyor - Varış noktasına gidin</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Yolculuk devam ederken navigasyon butonu */}
                      {activeBooking.status === 'in_progress' && (
                        <div className="mt-2">
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&origin=${me?.location?.lat},${me?.location?.lng}&destination=${activeBooking.dropoffLocation?.lat},${activeBooking.dropoffLocation?.lng}&travelmode=driving`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button size="sm" variant="outline">🗺️ Navigasyon</Button>
                          </a>
                          <span className="ml-2 text-xs text-gray-600">
                            {typeof metersToDropoff === 'number' ? `${Math.round(metersToDropoff)} m kaldı` : ''}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={activeBooking.status !== 'accepted'}
                          onClick={async () => {
                            await updateBookingStatus(activeBooking.id, 'driver_en_route')
                            // Google Maps navigasyon aç
                            const url = `https://www.google.com/maps/dir/?api=1&origin=${me?.location?.lat},${me?.location?.lng}&destination=${activeBooking.pickupLocation?.lat},${activeBooking.pickupLocation?.lng}&travelmode=driving`
                            window.open(url, '_blank')
                          }}
                        >
                          🚗 Yola Çık & Navigasyon
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={activeBooking.status !== 'driver_en_route'}
                          onClick={async () => {
                            if (typeof metersToPickup === 'number' && metersToPickup > 150) {
                              toast.error('Alış noktasına yaklaşınca “Geldim” yapın')
                              return
                            }
                            await updateBookingStatus(activeBooking.id, 'driver_arrived')
                            toast.success('Müşteriye vardınız!')
                          }}
                        >
                          ✅ Geldim
                        </Button>
                        <Button
                          size="sm"
                          disabled={activeBooking.status !== 'driver_arrived'}
                          onClick={async () => {
                            await confirmPickup(activeBooking.id)
                            toast.success('Yolculuk başladı! Varış noktasına gidin')
                            // Google Maps navigasyon aç - dropoff'a
                            const url = `https://www.google.com/maps/dir/?api=1&origin=${activeBooking.pickupLocation?.lat},${activeBooking.pickupLocation?.lng}&destination=${activeBooking.dropoffLocation?.lat},${activeBooking.dropoffLocation?.lng}&travelmode=driving`
                            window.open(url, '_blank')
                          }}
                        >
                          🚀 Müşteriyi Aldım & Yola Çık
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!(activeBooking.status === 'in_progress' && typeof metersToDropoff === 'number' && metersToDropoff <= 200)}
                          onClick={async () => {
                            try {
                              await stopRouteRecordingAndSave(activeBooking.id)
                            } catch {}
                            await updateBookingStatus(activeBooking.id, 'completed')
                            try { await setAvailable(true) } catch {}
                            toast.success('Yolculuk tamamlandı! Tebrikler 🎉')
                          }}
                        >
                          ✅ Yolculuğu Tamamla
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center">
                      <Clock className="h-6 w-6 mr-2 text-blue-600" />
                      Bekleyen Çağrılar
                    </h2>
                    <Button size="sm" variant="outline" onClick={() => refreshRequests()} disabled={approved !== true}>Yenile</Button>
                  </div>
                  <div className="space-y-3">
                    {approved === true && requests.map(r => (
                      <div key={r.id} className={`p-4 border-2 rounded-lg transition-all ${selectedRequest?.id === r.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 cursor-pointer" onClick={() => setSelectedRequest(r)}>
                            <p className="font-medium text-gray-900">{r.pickup.address}</p>
                            <p className="text-sm text-gray-600 mt-1">→ {r.dropoff.address}</p>
                            <p className="text-xs text-gray-500 mt-1">Araç tipi: {r.vehicleType}</p>
                          </div>
                          <div className="flex flex-col gap-2 ml-4">
                            <Button size="sm" onClick={() => accept(r.id)} disabled={approved !== true}>Kabul Et</Button>
                            {me && me.location && (
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&origin=${me.location.lat},${me.location.lng}&destination=${r.pickup.lat},${r.pickup.lng}`}
                                target="_blank" rel="noreferrer"
                                className="text-xs text-blue-600 text-center hover:underline"
                              >
                                Navigasyon
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {approved === true && requests.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <Clock className="h-16 w-16 text-gray-300 mx-auto mb-3" />
                        <p>Bekleyen çağrı yok</p>
                      </div>
                    )}
                    {approved === false && (
                      <div className="text-center py-12 text-gray-500">
                        <AlertCircle className="h-16 w-16 text-yellow-400 mx-auto mb-3" />
                        <p>Onay bekleniyor. Yönetici onayladığında çağrılar görünür.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Profile Card */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                    <User className="h-6 w-6 mr-2 text-blue-600" />
                    Profil
                  </h2>
                  <div className="flex flex-col items-center mb-4">
                    <div className="relative">
                      {profilePhoto ? (
                        <img src={profilePhoto} alt="Profil" className="w-24 h-24 rounded-full object-cover border-4 border-blue-500" />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center border-4 border-blue-500">
                          <User className="h-12 w-12 text-white" />
                        </div>
                      )}
                      <label className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-2 cursor-pointer hover:bg-blue-700 transition-all">
                        <Camera className="h-4 w-4 text-white" />
                        <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'profile')} />
                      </label>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mt-3">{form.name}</h3>
                    <div className="flex items-center mt-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current mr-1" />
                      <span className="text-sm text-gray-600">{stats.avgRating} puan</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
                      <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.name} onChange={e => { setForm({ ...form, name: e.target.value }); if (me) { persistProfile(me.id, { name: e.target.value }); try { updateProfile({ name: e.target.value }) } catch {} } }} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Plaka</label>
                      <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={licensePlate} onChange={e => { setLicensePlate(e.target.value); if (me) { persistProfile(me.id, { licensePlate: e.target.value }); try { updateProfile({ licensePlate: e.target.value }) } catch {} } }} />
                    </div>
                  </div>
                </div>

                
                
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                    <Car className="h-6 w-6 mr-2 text-blue-600" />
                    Araç Bilgileri
                  </h2>
                  {primaryVehicleImage && (
                    <div className="mb-4">
                      <img src={primaryVehicleImage} alt="Araç" className="rounded-lg w-full h-40 object-cover border border-gray-200" />
                    </div>
                  )}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Araç Modeli</label>
                      <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={vehicleModelInput} onChange={e => { setVehicleModelInput(e.target.value); if (me) { persistProfile(me.id, { vehicleModel: e.target.value }); try { updateProfile({ vehicleModel: e.target.value }) } catch {} } }} />
                    </div>
                    <input ref={vehicleFileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'vehicle')} />
                    <Button variant="outline" className="w-full" onClick={() => vehicleFileRef.current?.click()}>
                      <Camera className="h-4 w-4 mr-2" />
                      Araç Resmi Yükle
                    </Button>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                    <FileText className="h-6 w-6 mr-2 text-blue-600" />
                    Geri Bildirim
                  </h2>
                  <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget as HTMLFormElement); const text = String(fd.get('text') || ''); if (text) { await submitComplaint(text); toast.success('Geri bildiriminiz gönderildi'); (e.currentTarget as HTMLFormElement).reset() } }}>
                    <textarea name="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Sorununuzu veya önerinizi yazın" rows={4} />
                    <Button type="submit" className="w-full">Gönder</Button>
                  </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Helper functions
async function readImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = reject
    img.src = url
  })
}

async function toDataURL(img: HTMLImageElement): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = img.width; canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.85)
}

async function toThumbnail(img: HTMLImageElement, w: number, h: number): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.75)
}

function persistProfile(id: string, patch: any) {
  try {
    const key = `driver_profile_${id}`
    const prev = JSON.parse(localStorage.getItem(key) || '{}')
    const next = { ...prev, ...patch }
    localStorage.setItem(key, JSON.stringify(next))
  } catch {}
}

function bytesFromDataUrl(dataUrl: string): number {
  try { const base64 = (dataUrl.split(',')[1] || ''); return Math.ceil(base64.length * 3 / 4) } catch { return 0 }
}
