import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import OpenStreetMap from '@/components/OpenStreetMap'
import { useBookingStore } from '@/stores/bookingStore'
import { API } from '@/utils/api'
import { useAuthStore } from '@/stores/authStore'
import { MapPin, Car, Clock, CreditCard, User, Home, Phone, Mail, Star, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'

interface Booking {
  id: string
  pickupLocation: { address: string }
  dropoffLocation: { address: string }
  status: string
  finalPrice?: number
  basePrice?: number
  createdAt: string
}

export const CustomerDashboard = () => {
  const [lastBooking, setLastBooking] = useState<any | null>(null)
  const navigate = useNavigate()
  const { availableDrivers, refreshApprovedDriversNear, startRealTimeUpdates, stopRealTimeUpdates } = useBookingStore()
  const { user } = useAuthStore()
  const [currentLocation, setCurrentLocation] = useState<{ lat:number, lng:number } | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [stats, setStats] = useState({ total: 0, completed: 0, cancelled: 0, totalSpent: 0 })
  
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pendingBooking')
      if (saved) setLastBooking(JSON.parse(saved))
    } catch {}
  }, [])
  
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setCurrentLocation(loc)
        refreshApprovedDriversNear(loc)
        startRealTimeUpdates()
      })
    }
    return () => { stopRealTimeUpdates() }
  }, [])
  
  useEffect(() => {
    const loadData = async () => {
      if (user) {
        try {
          // Wrap calls in try-catch blocks individually to prevent one failure from breaking everything
          try {
            const pr = await fetch(`${API}/customer/profile/${user.id}`)
            if (pr.ok) {
              const pd = await pr.json()
              if (pd.success) setProfile(pd.data || { id: user.id, name: user.name, email: user.email, phone: user.phone })
            } else {
              setProfile({ id: user.id, name: user.name, email: user.email, phone: user.phone })
            }
          } catch {
             setProfile({ id: user.id, name: user.name, email: user.email, phone: user.phone })
          }
          
          try {
            const pm = await fetch(`${API}/payments/${user.id}`)
            if (pm.ok) {
              const pmd = await pm.json()
              if (pmd.success) setPayments(pmd.data || [])
            }
          } catch {}
          
          try {
            const bk = await fetch(`${API}/bookings/by-customer/${user.id}`)
            if (bk.ok) {
              const bkd = await bk.json()
              if (bkd.success && Array.isArray(bkd.data)) {
                setBookings(bkd.data)
                const completed = bkd.data.filter((b:Booking) => b.status === 'completed').length
                const cancelled = bkd.data.filter((b:Booking) => b.status === 'cancelled').length
                const spent = bkd.data
                  .filter((b:Booking) => b.status === 'completed')
                  .reduce((sum:number, b:Booking) => sum + (b.finalPrice || b.basePrice || 0), 0)
                setStats({ total: bkd.data.length, completed, cancelled, totalSpent: spent })
              }
            }
          } catch {}
        } catch {}
      }
    }
    loadData()
  }, [user])
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Hoş Geldiniz, {user?.name || 'Müşteri'}</h1>
          <p className="text-gray-600">Transfer hizmetlerinizi buradan yönetebilirsiniz</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Toplam Yolculuk</p>
                <p className="text-3xl font-bold mt-1">{stats.total}</p>
              </div>
              <Car className="h-12 w-12 text-blue-200" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Tamamlanan</p>
                <p className="text-3xl font-bold mt-1">{stats.completed}</p>
              </div>
              <Star className="h-12 w-12 text-green-200" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Toplam Harcama</p>
                <p className="text-3xl font-bold mt-1">₺{stats.totalSpent.toFixed(2)}</p>
              </div>
              <TrendingUp className="h-12 w-12 text-purple-200" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Yakındaki Sürücü</p>
                <p className="text-3xl font-bold mt-1">{availableDrivers.length}</p>
              </div>
              <MapPin className="h-12 w-12 text-orange-200" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <Car className="h-6 w-6 mr-2 text-blue-600" />
                Hızlı İşlemler
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link to="/" className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group">
                  <div className="text-center">
                    <MapPin className="h-12 w-12 text-gray-400 group-hover:text-blue-600 mx-auto mb-2" />
                    <p className="font-medium text-gray-700 group-hover:text-blue-600">Yeni Transfer</p>
                    <p className="text-sm text-gray-500">Hemen rezervasyon yap</p>
                  </div>
                </Link>
                <div className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all group cursor-pointer" onClick={() => toast.info('Geçmiş yolculuklar yükleniyor...')}>
                  <div className="text-center">
                    <Clock className="h-12 w-12 text-gray-400 group-hover:text-green-600 mx-auto mb-2" />
                    <p className="font-medium text-gray-700 group-hover:text-green-600">Geçmiş</p>
                    <p className="text-sm text-gray-500">Yolculuk geçmişi</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <MapPin className="h-6 w-6 mr-2 text-blue-600" />
                Yakındaki Sürücüler
              </h2>
              <div className="h-96 rounded-lg overflow-hidden border border-gray-200">
                {currentLocation ? (
                  <OpenStreetMap
                    center={currentLocation}
                    customerLocation={currentLocation}
                    drivers={availableDrivers
                      .filter(d => d.currentLocation)
                      .map(d => ({ id: d.id, name: d.name, location: d.currentLocation!, rating: d.rating, available: d.isAvailable }))}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center bg-gray-50">
                    <p className="text-gray-500">Konum bilgisi alınıyor...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Bookings */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <Clock className="h-6 w-6 mr-2 text-blue-600" />
                Son Yolculuklar
              </h2>
              <div className="space-y-3">
                {bookings.slice(0, 5).map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{booking.pickupLocation.address}</p>
                      <p className="text-sm text-gray-500">→ {booking.dropoffLocation.address}</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(booking.createdAt).toLocaleDateString('tr-TR')}</p>
                    </div>
                    <div className="text-right ml-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                        booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {booking.status === 'completed' ? 'Tamamlandı' :
                         booking.status === 'cancelled' ? 'İptal' : 'Bekliyor'}
                      </span>
                      <p className="text-sm font-bold text-gray-900 mt-1">₺{(booking.finalPrice || booking.basePrice || 0).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
                {bookings.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Car className="h-16 w-16 text-gray-300 mx-auto mb-3" />
                    <p>Henüz yolculuk kaydınız yok</p>
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
                Profil Bilgileri
              </h2>
              {profile ? (
                <form className="space-y-4" onSubmit={async (e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget as HTMLFormElement)
                  const name = String(fd.get('name') || '')
                  const email = String(fd.get('email') || '')
                  const phone = String(fd.get('phone') || '')
                  const res = await fetch(`${API}/customer/profile/${user!.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, phone, addresses: profile.addresses || [] })
                  })
                  const j = await res.json()
                  if (j.success) {
                    setProfile(j.data)
                    toast.success('Profil güncellendi')
                  }
                }}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input name="name" defaultValue={profile.name} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Ad Soyad" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input name="email" type="email" defaultValue={profile.email} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="E-posta" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input name="phone" defaultValue={profile.phone || ''} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Telefon" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full">Bilgileri Kaydet</Button>
                </form>
              ) : (
                <p className="text-gray-500 text-sm">Profil yükleniyor...</p>
              )}
            </div>

            {/* Saved Addresses */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <Home className="h-6 w-6 mr-2 text-blue-600" />
                Kayıtlı Adresler
              </h2>
              <div className="space-y-3 mb-4">
                {(profile?.addresses || []).map((a: any) => (
                  <div key={a.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="font-medium text-sm text-gray-900">{a.label}</p>
                    <p className="text-xs text-gray-600 mt-1">{a.address}</p>
                  </div>
                ))}
              </div>
              <form className="space-y-2" onSubmit={async (e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget as HTMLFormElement)
                const label = String(fd.get('label') || '')
                const address = String(fd.get('address') || '')
                const r = await fetch(`${API}/customer/address/${user!.id}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ label, address })
                })
                const j = await r.json()
                if (j.success) {
                  const next = { ...(profile || {}), addresses: [...(profile?.addresses || []), j.data] }
                  setProfile(next)
                  toast.success('Adres eklendi')
                }
                (e.currentTarget as HTMLFormElement).reset()
              }}>
                <input name="label" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" placeholder="Ev, İş, vb." />
                <input name="address" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" placeholder="Adres" />
                <Button type="submit" variant="outline" className="w-full">Adres Ekle</Button>
              </form>
            </div>

            {/* Payment Methods */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <CreditCard className="h-6 w-6 mr-2 text-blue-600" />
                Ödeme Yöntemleri
              </h2>
              <div className="space-y-2 mb-4">
                {payments.map((pm) => (
                  <div key={pm.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center">
                      <CreditCard className="h-5 w-5 text-gray-400 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{pm.brand} •••• {pm.last4}</p>
                        <p className="text-xs text-gray-500">{pm.expMonth}/{pm.expYear}</p>
                      </div>
                    </div>
                    {pm.default && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Varsayılan</span>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full" onClick={() => toast.info('Kart ekleme özelliği yakında...')}>
                <CreditCard className="h-4 w-4 mr-2" />
                Yeni Kart Ekle
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
