import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import OpenStreetMap from '@/components/OpenStreetMap'
import { useBookingStore } from '@/stores/bookingStore'
import { useAuthStore } from '@/stores/authStore'
import { CustomerLayout } from '@/components/CustomerLayout'
import { MapPin, Car, Clock, Navigation, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { API } from '@/utils/api'

interface Booking {
  id: string
  pickupLocation: { address: string; lat: number; lng: number }
  dropoffLocation: { address: string; lat: number; lng: number }
  status: string
  finalPrice?: number
  basePrice?: number
  createdAt: string
  driverId?: string
}

export const CustomerDashboard = () => {
  const navigate = useNavigate()
  const { availableDrivers, refreshApprovedDriversNear, startRealTimeUpdates, stopRealTimeUpdates } = useBookingStore()
  const { user } = useAuthStore()
  
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null)
  
  // Yeni transfer formu
  const [showNewTrip, setShowNewTrip] = useState(false)
  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')

  // Konum al
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setCurrentLocation(loc)
          refreshApprovedDriversNear(loc)
          startRealTimeUpdates()
        },
        () => {
          toast.error('Konum alınamadı')
        }
      )
    }
    return () => { stopRealTimeUpdates() }
  }, [])

  // Rezervasyonları yükle
  useEffect(() => {
    const loadData = async () => {
      if (user) {
        try {
          const res = await fetch(`${API}/bookings/by-customer/${user.id}`)
          if (res.ok) {
            const j = await res.json()
            if (j.success && Array.isArray(j.data)) {
              setBookings(j.data)
              
              // Aktif yolculuk var mı?
              const active = j.data.find((b: Booking) => 
                ['accepted', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(b.status)
              )
              setActiveBooking(active || null)
            }
          }
        } catch { /* ignore */ }
      }
    }
    loadData()
    
    // 5 saniyede bir güncelle
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [user])

  // Yeni transfer oluştur
  const handleNewTrip = async () => {
    if (!pickup || !dropoff) {
      toast.error('Alış ve varış noktası girin')
      return
    }

    try {
      const res = await fetch(`${API}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: user?.id,
          pickupLocation: { address: pickup, lat: currentLocation?.lat || 0, lng: currentLocation?.lng || 0 },
          dropoffLocation: { address: dropoff, lat: 0, lng: 0 },
          vehicleType: 'sedan',
          passengerCount: 1,
          pickupTime: new Date().toISOString()
        })
      })
      
      const j = await res.json()
      if (j.success) {
        toast.success('Transfer talebiniz oluşturuldu! Sürücüler bekleniyor...')
        setShowNewTrip(false)
        setPickup('')
        setDropoff('')
      } else {
        toast.error('Talep oluşturulamadı')
      }
    } catch {
      toast.error('Bir hata oluştu')
    }
  }

  // Durum çevirisi
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Sürücü bekleniyor'
      case 'accepted': return 'Sürücü atandı'
      case 'driver_en_route': return 'Sürücü yolda'
      case 'driver_arrived': return 'Sürücü geldi'
      case 'in_progress': return 'Yolculuk devam ediyor'
      case 'completed': return 'Tamamlandı'
      case 'cancelled': return 'İptal'
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-500/20'
      case 'cancelled': return 'text-red-400 bg-red-500/20'
      case 'in_progress': return 'text-purple-400 bg-purple-500/20'
      case 'driver_en_route': return 'text-blue-400 bg-blue-500/20'
      case 'driver_arrived': return 'text-yellow-400 bg-yellow-500/20'
      default: return 'text-gray-400 bg-gray-500/20'
    }
  }

  // Yakın sürücüler sayısı
  const nearbyDriversCount = availableDrivers.filter(d => d.isAvailable && d.currentLocation).length

  return (
    <CustomerLayout>
      <div className="h-[calc(100vh-56px)] flex flex-col lg:flex-row">
        {/* Sol Panel */}
        <div className="w-full lg:w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
          
          {/* Yeni Transfer Butonu */}
          <div className="p-4 border-b border-gray-700">
            <Button
              onClick={() => setShowNewTrip(!showNewTrip)}
              className="w-full bg-blue-600 hover:bg-blue-700 py-4 text-lg font-bold"
            >
              <Plus className="h-5 w-5 mr-2" />
              Yeni Transfer Talebi
            </Button>
          </div>

          {/* Yeni Transfer Formu */}
          {showNewTrip && (
            <div className="p-4 bg-gray-700/50 border-b border-gray-600">
              <h3 className="text-white font-semibold mb-3">Nereye gitmek istiyorsunuz?</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Alış Noktası</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-400" />
                    <input
                      type="text"
                      value={pickup}
                      onChange={e => setPickup(e.target.value)}
                      placeholder="Nereden alınacaksınız?"
                      className="w-full pl-10 pr-3 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Varış Noktası</label>
                  <div className="relative">
                    <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-400" />
                    <input
                      type="text"
                      value={dropoff}
                      onChange={e => setDropoff(e.target.value)}
                      placeholder="Nereye gitmek istiyorsunuz?"
                      className="w-full pl-10 pr-3 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleNewTrip}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    Talep Oluştur
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowNewTrip(false)}
                    className="text-white border-gray-600"
                  >
                    İptal
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Aktif Yolculuk */}
          {activeBooking && (
            <div className="p-4 bg-blue-900/50 border-b border-blue-700">
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <Car className="h-5 w-5 text-blue-400" />
                Aktif Yolculuk
              </h3>
              
              <div className="space-y-2 text-sm">
                <p className="text-white font-medium">{activeBooking.pickupLocation.address}</p>
                <p className="text-gray-300">→ {activeBooking.dropoffLocation.address}</p>
                
                <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(activeBooking.status)}`}>
                  {getStatusText(activeBooking.status)}
                </div>

                {activeBooking.status === 'driver_en_route' && (
                  <p className="text-blue-400 text-xs mt-2 animate-pulse">
                    🚗 Sürücünüz yola çıktı!
                  </p>
                )}
                
                {activeBooking.status === 'driver_arrived' && (
                  <p className="text-green-400 text-xs mt-2 animate-pulse">
                    ✅ Sürücünüz sizi bekliyor!
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Son Yolculuklar */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Son Yolculuklar
              </h3>
            </div>

            <div className="divide-y divide-gray-700">
              {bookings.slice(0, 10).map(booking => (
                <div key={booking.id} className="p-4 hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{booking.pickupLocation.address}</p>
                      <p className="text-gray-400 text-xs truncate">→ {booking.dropoffLocation.address}</p>
                      <p className="text-gray-500 text-xs mt-1">
                        {new Date(booking.createdAt).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs px-2 py-1 rounded-full ${getStatusColor(booking.status)}`}>
                        {getStatusText(booking.status)}
                      </div>
                      <p className="text-white font-bold text-sm mt-1">
                        ₺{(booking.finalPrice || booking.basePrice || 0).toFixed(0)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {bookings.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Car className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Henüz yolculuk yok</p>
                  <p className="text-sm mt-1">Yeni transfer talebi oluşturun</p>
                </div>
              )}
            </div>
          </div>

          {/* Yakın Sürücüler */}
          <div className="p-4 border-t border-gray-700 bg-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Yakındaki Sürücüler:</span>
              <span className="text-2xl font-bold text-green-400">{nearbyDriversCount}</span>
            </div>
          </div>
        </div>

        {/* Sağ Panel - Harita */}
        <div className="flex-1 relative">
          {currentLocation ? (
            <OpenStreetMap
              center={currentLocation}
              customerLocation={currentLocation}
              drivers={availableDrivers
                .filter(d => d.isAvailable && d.currentLocation)
                .map(d => ({
                  id: d.id,
                  name: d.name,
                  location: d.currentLocation!,
                  rating: d.rating,
                  available: d.isAvailable
                }))}
              destination={activeBooking?.dropoffLocation}
              pickupLocation={activeBooking?.pickupLocation}
              showRoute={activeBooking ? 'to_pickup' : undefined}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Konumunuz alınıyor...</p>
              </div>
            </div>
          )}

          {/* Harita Bilgisi */}
          <div className="absolute bottom-4 left-4 right-4 lg:left-4 lg:right-auto lg:w-80 bg-gray-900/90 text-white text-sm px-4 py-3 rounded-lg flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-400" />
            <span>Konumunuz ve yakın sürücüler haritada görünür</span>
          </div>
        </div>
      </div>
    </CustomerLayout>
  )
}

export default CustomerDashboard
