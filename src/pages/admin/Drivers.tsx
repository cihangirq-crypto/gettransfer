import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import OpenStreetMap from '@/components/OpenStreetMap'
import { io as ioClient, type Socket } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'
import { currencySymbol } from '@/utils/pricing'
import { toast } from 'sonner'
import { 
  Users, Truck, MapPin, DollarSign, FileText, CheckCircle, XCircle, 
  Clock, Eye, Download, Trash2, Edit, Search, Filter, RefreshCw,
  TrendingUp, Calendar, Navigation, Phone, Mail, Car
} from 'lucide-react'

const extFromDataUrl = (u: string) => (u || '').startsWith('data:image/png') ? 'png' : 'jpg'

const haversineMeters = (a: { lat: number, lng: number }, b: { lat: number, lng: number }) => {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const la1 = a.lat * Math.PI / 180
  const la2 = b.lat * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

type DriverWithPricing = {
  id: string
  name: string
  email?: string
  phone?: string
  vehicleType: 'sedan' | 'suv' | 'van' | 'luxury'
  vehicleModel?: string
  licensePlate?: string
  location?: { lat: number, lng: number }
  available: boolean
  approved: boolean
  docs?: Array<{ name: string, url?: string }>
  rejectedReason?: string
  createdAt?: string
  // Fiyatlandırma
  driverPerKm?: number
  platformFeePercent?: number
  customPricing?: boolean
}

export const AdminDrivers: React.FC = () => {
  const navigate = useNavigate()
  const [pending, setPending] = useState<DriverWithPricing[]>([])
  const [approved, setApproved] = useState<DriverWithPricing[]>([])
  const [rejected, setRejected] = useState<DriverWithPricing[]>([])
  const [view, setView] = useState<'dashboard' | 'approved' | 'pending' | 'rejected' | 'map'>('dashboard')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAvailable, setFilterAvailable] = useState<'all' | 'online' | 'offline'>('all')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<DriverWithPricing | null>(null)
  const [detailTab, setDetailTab] = useState<'info' | 'live' | 'history' | 'docs' | 'pricing'>('info')
  const [rejectReason, setRejectReason] = useState('Eksik belge')

  const [bookings, setBookings] = useState<any[]>([])
  const [preview, setPreview] = useState<{ url: string, name: string } | null>(null)
  const [customerLiveLocation, setCustomerLiveLocation] = useState<{ lat: number, lng: number } | null>(null)
  
  // Fiyatlandırma state
  const [pricingForm, setPricingForm] = useState({
    driverPerKm: 1,
    platformFeePercent: 3,
    customPricing: false
  })

  // Global pricing config
  const [globalPricing, setGlobalPricing] = useState({
    driverPerKm: 1,
    platformFeePercent: 3,
    currency: 'TRY'
  })

  const list = view === 'approved' ? approved : (view === 'pending' ? pending : rejected)

  const filteredList = useMemo(() => {
    let result = list
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(d => 
        d.name.toLowerCase().includes(term) ||
        d.email?.toLowerCase().includes(term) ||
        d.licensePlate?.toLowerCase().includes(term)
      )
    }
    
    if (filterAvailable !== 'all') {
      result = result.filter(d => 
        filterAvailable === 'online' ? d.available : !d.available
      )
    }
    
    return result
  }, [list, searchTerm, filterAvailable])

  // Stats
  const stats = useMemo(() => ({
    total: approved.length,
    online: approved.filter(d => d.available).length,
    offline: approved.filter(d => !d.available).length,
    pending: pending.length,
    rejected: rejected.length
  }), [approved, pending, rejected])

  const refresh = async () => {
    const p = await fetch('/api/drivers/pending').then(r => r.json()).catch(() => ({}))
    const a = await fetch('/api/drivers/list?status=approved').then(r => r.json()).catch(() => ({}))
    const r = await fetch('/api/drivers/list?status=rejected').then(r => r.json()).catch(() => ({}))
    const pr = await fetch('/api/pricing').then(r => r.json()).catch(() => ({}))
    
    setPending(p?.data || [])
    setApproved(a?.data || [])
    setRejected(r?.data || [])
    if (pr?.data) setGlobalPricing(pr.data)
  }

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    if (!selectedId) {
      setSelectedDriver(null)
      setBookings([])
      setCustomerLiveLocation(null)
      return
    }
    ;(async () => {
      const d = await fetch(`/api/drivers/${selectedId}`).then(r => r.json()).catch(() => null)
      if (d?.success && d?.data) {
        setSelectedDriver(d.data)
        setPricingForm({
          driverPerKm: d.data.driverPerKm || globalPricing.driverPerKm,
          platformFeePercent: d.data.platformFeePercent || globalPricing.platformFeePercent,
          customPricing: d.data.customPricing || false
        })
      }
      const b = await fetch(`/api/bookings/by-driver/${selectedId}`).then(r => r.json()).catch(() => null)
      if (b?.success && Array.isArray(b.data)) setBookings(b.data)
    })()
  }, [selectedId, globalPricing])

  const activeBooking = useMemo(() => {
    return bookings.find(x => x && x.status !== 'completed' && x.status !== 'cancelled') || null
  }, [bookings])

  const completedBookings = useMemo(() => {
    return bookings.filter(x => x && x.status === 'completed')
  }, [bookings])

  // Socket for real-time updates
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const origin = (import.meta.env.VITE_API_ORIGIN as string) || `http://${window.location.hostname}:3005`
    const s = ioClient(origin, { transports: ['websocket'], reconnection: true })
    socketRef.current = s
    s.on('driver:update', (d: any) => {
      if (!d?.id) return
      setApproved(prev => prev.map(x => x.id === d.id ? { ...x, location: d.location, available: d.available } : x))
      if (selectedDriver?.id === d.id) setSelectedDriver((cur: any) => cur ? { ...cur, location: d.location, available: d.available } : cur)
    })
    return () => { s.disconnect(); socketRef.current = null }
  }, [selectedDriver?.id])

  // Save driver pricing
  const savePricing = async () => {
    if (!selectedDriver) return
    try {
      const res = await fetch('/api/drivers/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedDriver.id,
          ...pricingForm
        })
      })
      const j = await res.json()
      if (!res.ok || !j?.success) throw new Error(j?.error || 'failed')
      toast.success('Fiyatlandırma kaydedildi')
      refresh()
    } catch {
      toast.error('Kaydetme başarısız')
    }
  }

  // Approve driver
  const approveDriver = async (id: string) => {
    try {
      const res = await fetch('/api/drivers/approve', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ id }) 
      })
      const j = await res.json()
      if (!res.ok || !j?.success) throw new Error(j?.error || 'failed')
      toast.success('Onaylandı')
      setSelectedId(null)
      await refresh()
      setView('approved')
    } catch {
      toast.error('Onaylama başarısız')
    }
  }

  // Reject driver
  const rejectDriver = async (id: string, reason: string) => {
    try {
      const res = await fetch('/api/drivers/reject', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ id, reason }) 
      })
      const j = await res.json()
      if (!res.ok || !j?.success) throw new Error(j?.error || 'failed')
      toast.success('Reddedildi')
      setSelectedId(null)
      await refresh()
      setView('rejected')
    } catch {
      toast.error('Reddetme başarısız')
    }
  }

  // Delete driver
  const deleteDriver = async (id: string) => {
    if (!confirm('Bu sürücüyü silmek istediğinize emin misiniz?')) return
    try {
      const res = await fetch('/api/drivers/delete', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ id }) 
      })
      const j = await res.json()
      if (!res.ok || !j?.success) throw new Error(j?.error || 'failed')
      toast.success('Silindi')
      setSelectedId(null)
      refresh()
    } catch {
      toast.error('Silme başarısız')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Admin Paneli</h1>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Yenile
            </Button>
          </div>
          
          {/* Navigation Tabs */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            <Button 
              variant={view === 'dashboard' ? 'primary' : 'outline'} 
              size="sm"
              onClick={() => { setView('dashboard'); setSelectedId(null) }}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Özet
            </Button>
            <Button 
              variant={view === 'map' ? 'primary' : 'outline'} 
              size="sm"
              onClick={() => { setView('map'); setSelectedId(null) }}
            >
              <MapPin className="h-4 w-4 mr-2" />
              Harita
            </Button>
            <Button 
              variant={view === 'approved' ? 'primary' : 'outline'} 
              size="sm"
              onClick={() => { setView('approved'); setSelectedId(null) }}
            >
              <Users className="h-4 w-4 mr-2" />
              Sürücüler ({stats.total})
            </Button>
            <Button 
              variant={view === 'pending' ? 'primary' : 'outline'} 
              size="sm"
              onClick={() => { setView('pending'); setSelectedId(null) }}
            >
              <Clock className="h-4 w-4 mr-2" />
              Başvurular ({stats.pending})
            </Button>
            <Button 
              variant={view === 'rejected' ? 'primary' : 'outline'} 
              size="sm"
              onClick={() => { setView('rejected'); setSelectedId(null) }}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reddedilenler
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/admin/pricing')}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Fiyatlandırma
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Dashboard View */}
        {view === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Toplam Sürücü</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Çevrimiçi</p>
                    <p className="text-2xl font-bold text-green-600">{stats.online}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Çevrimdışı</p>
                    <p className="text-2xl font-bold text-gray-500">{stats.offline}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-gray-400" />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Bekleyen Başvuru</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-500" />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Reddedilen</p>
                    <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
              </div>
            </div>

            {/* Quick Map - All Drivers */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-4">Sürücü Haritası</h2>
              <div className="h-80 rounded-lg overflow-hidden border">
                <OpenStreetMap
                  center={{ lat: 36.8969, lng: 30.7133 }}
                  customerLocation={{ lat: 36.8969, lng: 30.7133 }}
                  drivers={approved.filter(d => d.location && (d.location.lat !== 0 || d.location.lng !== 0)).map(d => ({
                    id: d.id,
                    name: d.name,
                    location: d.location!,
                    rating: 0,
                    available: d.available
                  }))}
                  onMapClick={() => {}}
                />
              </div>
              <div className="mt-3 flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Çevrimiçi ({stats.online})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                  <span>Çevrimdışı ({stats.offline})</span>
                </div>
              </div>
            </div>

            {/* Recent Pending Applications */}
            {pending.length > 0 && (
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Son Başvurular</h2>
                  <Button variant="outline" size="sm" onClick={() => setView('pending')}>
                    Tümünü Gör
                  </Button>
                </div>
                <div className="space-y-3">
                  {pending.slice(0, 3).map(d => (
                    <div key={d.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{d.name}</p>
                        <p className="text-sm text-gray-500">{d.email} • {d.vehicleType}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => approveDriver(d.id)}>Onayla</Button>
                        <Button size="sm" variant="outline" onClick={() => rejectDriver(d.id, 'Onaylanmadı')}>Reddet</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Map View - Full Screen Map */}
        {view === 'map' && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Tüm Sürücüler - Canlı Harita</h2>
              <div className="flex gap-2">
                <select 
                  className="border rounded px-3 py-1 text-sm"
                  value={filterAvailable}
                  onChange={(e) => setFilterAvailable(e.target.value as any)}
                >
                  <option value="all">Tümü</option>
                  <option value="online">Çevrimiçi</option>
                  <option value="offline">Çevrimdışı</option>
                </select>
              </div>
            </div>
            <div className="h-[500px] rounded-lg overflow-hidden border">
              <OpenStreetMap
                center={{ lat: 36.8969, lng: 30.7133 }}
                customerLocation={{ lat: 36.8969, lng: 30.7133 }}
                drivers={approved
                  .filter(d => {
                    if (!d.location || (d.location.lat === 0 && d.location.lng === 0)) return false
                    if (filterAvailable === 'online' && !d.available) return false
                    if (filterAvailable === 'offline' && d.available) return false
                    return true
                  })
                  .map(d => ({
                    id: d.id,
                    name: d.name,
                    location: d.location!,
                    rating: 0,
                    available: d.available
                  }))}
                  highlightDriverId={selectedId}
                  onMapClick={(loc) => {
                    // Find closest driver
                    const closest = approved.reduce((prev, curr) => {
                      if (!curr.location) return prev
                      if (!prev?.location) return curr
                      const dPrev = haversineMeters(loc, prev.location)
                      const dCurr = haversineMeters(loc, curr.location)
                      return dCurr < dPrev ? curr : prev
                    }, null as DriverWithPricing | null)
                    if (closest) {
                      setSelectedId(closest.id)
                      setDetailTab('info')
                    }
                  }}
              />
            </div>
            
            {/* Driver Quick List */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {approved.filter(d => d.available).map(d => (
                <div 
                  key={d.id}
                  className={`p-3 border rounded-lg cursor-pointer transition ${selectedId === d.id ? 'border-blue-500 bg-blue-50' : 'hover:border-blue-300'}`}
                  onClick={() => { setSelectedId(d.id); setDetailTab('info') }}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${d.available ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span className="font-medium text-sm">{d.name}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{d.vehicleType} • {d.licensePlate || 'Plaka yok'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* List Views (Approved, Pending, Rejected) */}
        {(view === 'approved' || view === 'pending' || view === 'rejected') && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Driver List */}
            <div className="bg-white rounded-lg shadow p-4 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {view === 'approved' && 'Onaylı Sürücüler'}
                  {view === 'pending' && 'Onay Bekleyen Başvurular'}
                  {view === 'rejected' && 'Reddedilen Başvurular'}
                </h2>
              </div>
              
              {/* Search & Filter */}
              <div className="flex gap-3 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="İsim, e-posta veya plaka ara..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {view === 'approved' && (
                  <select
                    className="border rounded-lg px-3 py-2"
                    value={filterAvailable}
                    onChange={(e) => setFilterAvailable(e.target.value as any)}
                  >
                    <option value="all">Tümü</option>
                    <option value="online">Çevrimiçi</option>
                    <option value="offline">Çevrimdışı</option>
                  </select>
                )}
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredList.map(d => (
                  <div
                    key={d.id}
                    className={`border rounded-lg p-4 cursor-pointer transition ${selectedId === d.id ? 'border-blue-500 bg-blue-50' : 'hover:border-blue-300'}`}
                    onClick={() => {
                      setSelectedId(d.id)
                      setDetailTab(view === 'pending' ? 'docs' : 'info')
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${d.available ? 'bg-green-500' : 'bg-gray-400'}`}>
                          {d.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{d.name}</p>
                          <p className="text-sm text-gray-500">{d.email}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Car className="h-3 w-3" />
                              {d.vehicleType}
                            </span>
                            <span className="flex items-center gap-1">
                              <Truck className="h-3 w-3" />
                              {d.licensePlate || 'Plaka yok'}
                            </span>
                          </div>
                          {view === 'approved' && d.location && (
                            <p className="text-xs text-gray-400 mt-1">
                              <Navigation className="h-3 w-3 inline mr-1" />
                              {d.location.lat.toFixed(4)}, {d.location.lng.toFixed(4)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {view === 'approved' && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${d.available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {d.available ? 'Çevrimiçi' : 'Çevrimdışı'}
                          </span>
                        )}
                        {view === 'pending' && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={(e) => { e.stopPropagation(); approveDriver(d.id) }}>
                              Onayla
                            </Button>
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); rejectDriver(d.id, rejectReason) }}>
                              Reddet
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {filteredList.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Kayıt bulunamadı
                  </div>
                )}
              </div>
            </div>

            {/* Driver Detail Panel */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-4">Sürücü Detayı</h2>
              
              {!selectedDriver ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Listeden bir sürücü seçin</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Tabs */}
                  <div className="flex gap-1 flex-wrap">
                    <Button size="sm" variant={detailTab === 'info' ? 'primary' : 'outline'} onClick={() => setDetailTab('info')}>
                      <User className="h-3 w-3 mr-1" />Bilgi
                    </Button>
                    <Button size="sm" variant={detailTab === 'live' ? 'primary' : 'outline'} onClick={() => setDetailTab('live')}>
                      <MapPin className="h-3 w-3 mr-1" />Konum
                    </Button>
                    <Button size="sm" variant={detailTab === 'docs' ? 'primary' : 'outline'} onClick={() => setDetailTab('docs')}>
                      <FileText className="h-3 w-3 mr-1" />Belgeler
                    </Button>
                    <Button size="sm" variant={detailTab === 'pricing' ? 'primary' : 'outline'} onClick={() => setDetailTab('pricing')}>
                      <DollarSign className="h-3 w-3 mr-1" />Fiyat
                    </Button>
                    <Button size="sm" variant={detailTab === 'history' ? 'primary' : 'outline'} onClick={() => setDetailTab('history')}>
                      <Clock className="h-3 w-3 mr-1" />Geçmiş
                    </Button>
                  </div>

                  {/* Info Tab */}
                  {detailTab === 'info' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 pb-3 border-b">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${selectedDriver.available ? 'bg-green-500' : 'bg-gray-400'}`}>
                          {selectedDriver.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{selectedDriver.name}</p>
                          <p className={`text-sm ${selectedDriver.available ? 'text-green-600' : 'text-gray-500'}`}>
                            {selectedDriver.available ? '● Çevrimiçi' : '○ Çevrimdışı'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span>{selectedDriver.email || 'E-posta yok'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4 text-gray-400" />
                          <span>{selectedDriver.vehicleType} - {selectedDriver.vehicleModel || 'Model belirtilmemiş'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-gray-400" />
                          <span>{selectedDriver.licensePlate || 'Plaka yok'}</span>
                        </div>
                        {selectedDriver.location && (
                          <div className="flex items-center gap-2">
                            <Navigation className="h-4 w-4 text-gray-400" />
                            <span>{selectedDriver.location.lat.toFixed(4)}, {selectedDriver.location.lng.toFixed(4)}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="pt-4 border-t space-y-2">
                        {view === 'pending' && (
                          <>
                            <input
                              type="text"
                              placeholder="Red nedeni..."
                              className="w-full border rounded px-3 py-2 text-sm"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <Button className="flex-1" onClick={() => approveDriver(selectedDriver.id)}>Onayla</Button>
                              <Button className="flex-1" variant="outline" onClick={() => rejectDriver(selectedDriver.id, rejectReason)}>Reddet</Button>
                            </div>
                          </>
                        )}
                        {view === 'rejected' && selectedDriver.rejectedReason && (
                          <div className="p-3 bg-red-50 rounded text-sm text-red-700">
                            <strong>Red Nedeni:</strong> {selectedDriver.rejectedReason}
                          </div>
                        )}
                        <Button 
                          variant="outline" 
                          className="w-full text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => deleteDriver(selectedDriver.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Sürücüyü Sil
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Live/Map Tab */}
                  {detailTab === 'live' && (
                    <div className="space-y-3">
                      {selectedDriver.location && (selectedDriver.location.lat !== 0 || selectedDriver.location.lng !== 0) ? (
                        <>
                          <div className="h-48 rounded-lg overflow-hidden border">
                            <OpenStreetMap
                              center={selectedDriver.location}
                              customerLocation={selectedDriver.location}
                              destination={activeBooking?.dropoffLocation || selectedDriver.location}
                              drivers={[{
                                id: selectedDriver.id,
                                name: selectedDriver.name,
                                location: selectedDriver.location,
                                rating: 0,
                                available: selectedDriver.available
                              }]}
                              highlightDriverId={selectedDriver.id}
                              onMapClick={() => {}}
                            />
                          </div>
                          <div className="text-sm space-y-1">
                            <p><strong>Enlem:</strong> {selectedDriver.location.lat.toFixed(6)}</p>
                            <p><strong>Boylam:</strong> {selectedDriver.location.lng.toFixed(6)}</p>
                            <a 
                              href={`https://www.google.com/maps?q=${selectedDriver.location.lat},${selectedDriver.location.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm"
                            >
                              Google Maps'te Aç →
                            </a>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <MapPin className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                          <p>Konum bilgisi yok</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Documents Tab */}
                  {detailTab === 'docs' && (
                    <div className="space-y-3">
                      {selectedDriver.docs && selectedDriver.docs.length > 0 ? (
                        <div className="space-y-3">
                          {selectedDriver.docs.map((doc, i) => (
                            <div key={i} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-sm">{doc.name}</span>
                                <span className={`text-xs px-2 py-1 rounded ${doc.url ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {doc.url ? 'Yüklendi' : 'Eksik'}
                                </span>
                              </div>
                              {doc.url && (
                                <div className="flex gap-2">
                                  <img 
                                    src={doc.url} 
                                    alt={doc.name} 
                                    className="h-20 rounded border cursor-pointer hover:opacity-80"
                                    onClick={() => setPreview({ url: doc.url!, name: doc.name })}
                                  />
                                  <a 
                                    href={doc.url} 
                                    download
                                    className="text-xs text-blue-600 hover:underline self-end"
                                  >
                                    <Download className="h-4 w-4" />
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                          <p>Belge yok</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pricing Tab */}
                  {detailTab === 'pricing' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-blue-50 rounded-lg text-sm">
                        <p className="font-medium text-blue-800">Global Fiyatlandırma</p>
                        <p className="text-blue-600">Kilometre: {globalPricing.driverPerKm} {globalPricing.currency}</p>
                        <p className="text-blue-600">Platform Payı: %{globalPricing.platformFeePercent}</p>
                      </div>

                      <div className="space-y-3">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={pricingForm.customPricing}
                            onChange={(e) => setPricingForm({ ...pricingForm, customPricing: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm font-medium">Sürücüye Özel Fiyatlandırma</span>
                        </label>

                        {pricingForm.customPricing && (
                          <>
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">Kilometre Başı Ücret ({globalPricing.currency})</label>
                              <input
                                type="number"
                                step="0.1"
                                className="w-full border rounded px-3 py-2"
                                value={pricingForm.driverPerKm}
                                onChange={(e) => setPricingForm({ ...pricingForm, driverPerKm: parseFloat(e.target.value) || 0 })}
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">Platform Payı (%)</label>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="50"
                                className="w-full border rounded px-3 py-2"
                                value={pricingForm.platformFeePercent}
                                onChange={(e) => setPricingForm({ ...pricingForm, platformFeePercent: parseFloat(e.target.value) || 0 })}
                              />
                            </div>
                          </>
                        )}

                        <Button className="w-full" onClick={savePricing}>
                          Kaydet
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* History Tab */}
                  {detailTab === 'history' && (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {completedBookings.length > 0 ? (
                        completedBookings.map((b: any) => (
                          <div key={b.id} className="border rounded-lg p-3 text-sm">
                            <div className="font-medium">{b.reservationCode || b.id.slice(-6)}</div>
                            <p className="text-gray-600 text-xs mt-1">
                              {b.pickupLocation?.address?.slice(0, 30)}... → {b.dropoffLocation?.address?.slice(0, 30)}...
                            </p>
                            <div className="flex justify-between mt-2 text-xs">
                              <span className="text-gray-500">{b.pickupTime ? new Date(b.pickupTime).toLocaleDateString('tr-TR') : '-'}</span>
                              <span className="font-medium">{currencySymbol(globalPricing.currency)}{b.finalPrice || b.basePrice || 0}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Clock className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                          <p>Geçmiş yolculuk yok</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <img src={preview.url} alt={preview.name} className="w-full h-auto" />
            <div className="p-4 flex items-center justify-between border-t">
              <span className="font-medium">{preview.name}</span>
              <div className="flex gap-2">
                <a 
                  href={preview.url} 
                  download={`${preview.name}.${extFromDataUrl(preview.url)}`}
                  className="text-blue-600 hover:underline text-sm"
                >
                  İndir
                </a>
                <button onClick={() => setPreview(null)} className="text-gray-500 hover:text-gray-700 text-sm">
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Missing import fix
const User = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)
