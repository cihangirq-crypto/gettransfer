import React, { useEffect, useMemo, useRef, useState } from 'react'
import OpenStreetMap from '@/components/OpenStreetMap'
import { io as ioClient, type Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/AdminLayout'
import { 
  Users, UserCheck, UserX, MapPin, Car, Phone, Mail, 
  FileText, Clock, DollarSign, CheckCircle, XCircle, 
  Eye, RefreshCw, Trash2, ChevronRight, Loader2, Wifi,
  WifiOff, Navigation, Calendar, AlertTriangle, Home
} from 'lucide-react'

const extFromDataUrl = (u: string) => (u || '').startsWith('data:image/png') ? 'png' : 'jpg'

const currencySymbol = (c: string) => (String(c).toUpperCase() === 'TRY' ? '₺' : '€')

type DriverStatus = 'approved' | 'pending' | 'rejected'

interface DriverDoc {
  name: string
  url?: string
  uploadedAt?: string
  status?: 'pending' | 'approved' | 'rejected'
  rejectReason?: string
}

interface Driver {
  id: string
  name: string
  email?: string
  phone?: string
  address?: string
  vehicleType: string
  vehicleModel?: string
  licensePlate?: string
  location?: { lat: number; lng: number }
  available?: boolean
  rating?: number
  docs?: DriverDoc[]
  rejectReason?: string
  createdAt?: string
  approved?: boolean
}

interface Booking {
  id: string
  pickupLocation?: { address: string; lat: number; lng: number }
  dropoffLocation?: { address: string; lat: number; lng: number }
  status: string
  finalPrice?: number
  basePrice?: number
  reservationCode?: string
  pickupTime?: string
  customerName?: string
  extras?: { pricing?: { currency?: string } }
}

export const AdminDrivers: React.FC = () => {
  const [pending, setPending] = useState<Driver[]>([])
  const [approved, setApproved] = useState<Driver[]>([])
  const [rejected, setRejected] = useState<Driver[]>([])
  const [view, setView] = useState<DriverStatus>('approved')
  const [isLoading, setIsLoading] = useState(true)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [detailTab, setDetailTab] = useState<'live' | 'history' | 'docs'>('live')
  const [rejectReason, setRejectReason] = useState('Eksik belge')

  const [bookings, setBookings] = useState<Booking[]>([])
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)

  const list = view === 'approved' ? approved : (view === 'pending' ? pending : rejected)

  const refresh = async () => {
    setIsLoading(true)
    try {
      const [p, a, r] = await Promise.all([
        fetch('/api/drivers/pending').then(r => r.json()).catch(() => ({})),
        fetch('/api/drivers/list?status=approved').then(r => r.json()).catch(() => ({})),
        fetch('/api/drivers/list?status=rejected').then(r => r.json()).catch(() => ({}))
      ])
      setPending(p?.data || [])
      const approvedList = a?.data || []
      setApproved(approvedList)
      setOnlineCount(approvedList.filter((d: Driver) => d.available).length)
      setRejected(r?.data || [])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    if (!selectedId) {
      setSelectedDriver(null)
      setBookings([])
      return
    }
    ;(async () => {
      const d = await fetch(`/api/drivers/${selectedId}`).then(r => r.json()).catch(() => null)
      if (d?.success && d?.data) setSelectedDriver(d.data)
      const b = await fetch(`/api/bookings/by-driver/${selectedId}`).then(r => r.json()).catch(() => null)
      if (b?.success && Array.isArray(b.data)) setBookings(b.data)
    })()
  }, [selectedId])

  const activeBooking = useMemo(() => {
    return bookings.find(x => x && x.status !== 'completed' && x.status !== 'cancelled') || null
  }, [bookings])

  const completedBookings = useMemo(() => {
    return bookings.filter(x => x && x.status === 'completed')
  }, [bookings])

  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const origin = (import.meta.env.VITE_API_ORIGIN as string) || `http://${window.location.hostname}:3005`
    const s = ioClient(origin, { transports: ['websocket'], reconnection: true })
    socketRef.current = s
    
    s.on('driver:update', (d: never) => {
      if (!d || typeof d !== 'object' || !('id' in d)) return
      const driverData = d as { id: string; location?: { lat: number; lng: number }; available?: boolean }
      setApproved(prev => prev.map(x => x.id === driverData.id ? { ...x, location: driverData.location, available: driverData.available } : x))
      if (selectedDriver?.id === driverData.id) setSelectedDriver((cur: Driver | null) => cur ? { ...cur, location: driverData.location, available: driverData.available } : cur)
      
      // Online sayısını güncelle
      setApproved(prev => {
        const count = prev.filter(d => d.available).length
        setOnlineCount(count)
        return prev
      })
    })
    
    s.on('booking:update', (b: never) => {
      if (!b || typeof b !== 'object' || !('id' in b)) return
      const bookingData = b as Booking & { driverId?: string }
      if (bookingData.driverId && bookingData.driverId === selectedId) {
        setBookings(prev => {
          const exists = prev.some(x => x?.id === bookingData.id)
          return exists ? prev.map(x => x?.id === bookingData.id ? bookingData : x) : [bookingData, ...prev]
        })
      }
    })

    s.on('driver:applied', (d: Driver) => {
      if (d) {
        setPending(prev => [d, ...prev])
        toast.info(`Yeni sürücü başvurusu: ${d.name}`)
      }
    })

    s.on('driver:docs-updated', (data: { driverId: string; docs: DriverDoc[] }) => {
      if (data?.driverId) {
        setPending(prev => prev.map(d => d.id === data.driverId ? { ...d, docs: data.docs } : d))
        setApproved(prev => prev.map(d => d.id === data.driverId ? { ...d, docs: data.docs } : d))
        toast.info(`Sürücü belgeleri güncellendi`)
      }
    })
    
    return () => {
      s.disconnect()
      socketRef.current = null
    }
  }, [selectedId, selectedDriver?.id])

  const handleApprove = async (driverId: string) => {
    try {
      const res = await fetch('/api/drivers/approve', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ id: driverId }) 
      })
      const j = await res.json().catch(() => null)
      if (!res.ok || !j?.success) throw new Error(j?.error || 'approve_failed')
      toast.success('Sürücü onaylandı!')
      setSelectedId(null)
      await refresh()
      setView('approved')
    } catch {
      toast.error('Onaylama başarısız')
    }
  }

  const handleReject = async (driverId: string, reason: string) => {
    try {
      const res = await fetch('/api/drivers/reject', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ id: driverId, reason }) 
      })
      const j = await res.json().catch(() => null)
      if (!res.ok || !j?.success) throw new Error(j?.error || 'reject_failed')
      toast.success('Sürücü reddedildi')
      setSelectedId(null)
      await refresh()
      setView('rejected')
    } catch {
      toast.error('Reddetme başarısız')
    }
  }

  const handleDelete = async (driverId: string) => {
    if (!confirm('Bu sürücüyü silmek istediğinize emin misiniz?')) return
    try {
      const res = await fetch('/api/drivers/delete', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ id: driverId }) 
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j?.success) throw new Error(j?.error || 'delete_failed')
      toast.success('Sürücü silindi')
      setSelectedId(null)
      refresh()
    } catch {
      toast.error('Silme başarısız')
    }
  }

  // Belge onaylama
  const handleDocApprove = async (docName: string) => {
    if (!selectedDriver) return
    try {
      const res = await fetch('/api/drivers/docs/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: selectedDriver.id, docName, approved: true })
      })
      const j = await res.json()
      if (!res.ok || !j?.success) throw new Error(j?.error)
      
      setSelectedDriver((prev: Driver | null) => {
        if (!prev || !Array.isArray(prev.docs)) return prev
        return {
          ...prev,
          docs: prev.docs.map(d => d.name === docName ? { ...d, status: 'approved' as const } : d)
        }
      })
      toast.success('Belge onaylandı')
    } catch {
      toast.error('Belge onaylama başarısız')
    }
  }

  // Belge reddetme
  const handleDocReject = async (docName: string, reason: string) => {
    if (!selectedDriver) return
    try {
      const res = await fetch('/api/drivers/docs/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: selectedDriver.id, docName, approved: false, reason })
      })
      const j = await res.json()
      if (!res.ok || !j?.success) throw new Error(j?.error)
      
      setSelectedDriver((prev: Driver | null) => {
        if (!prev || !Array.isArray(prev.docs)) return prev
        return {
          ...prev,
          docs: prev.docs.map(d => d.name === docName ? { ...d, status: 'rejected' as const, rejectReason: reason } : d)
        }
      })
      toast.error('Belge reddedildi')
    } catch {
      toast.error('Belge reddetme başarısız')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">Onaylı</span>
      case 'pending':
        return <span className="px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400">Bekliyor</span>
      case 'rejected':
        return <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">Reddedildi</span>
      default:
        return null
    }
  }

  const getDocLabel = (name: string) => {
    const labels: Record<string, string> = {
      'license': 'Sürücü Belgesi',
      'vehicle_registration': 'Araç Ruhsatı',
      'insurance': 'Sigorta Belgesi',
      'profile_photo': 'Profil Fotoğrafı'
    }
    return labels[name] || name
  }

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Sürücü Yönetimi</h1>
          <p className="text-gray-400 text-sm">Tüm sürücüleri görüntüleyin, onaylayın veya yönetin</p>
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{approved.length}</p>
                <p className="text-sm text-gray-400">Onaylı Sürücü</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <Wifi className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">{onlineCount}</p>
                <p className="text-sm text-gray-400">Şu An Online</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{pending.length}</p>
                <p className="text-sm text-gray-400">Onay Bekleyen</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
                <UserX className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{rejected.length}</p>
                <p className="text-sm text-gray-400">Reddedilen</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Butonları */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => { setView('approved'); setSelectedId(null); setDetailTab('live') }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              view === 'approved' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            Sürücüler ({approved.length})
            {onlineCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-emerald-500 text-white text-xs rounded-full">{onlineCount} online</span>
            )}
          </button>
          <button
            onClick={() => { setView('pending'); setSelectedId(null); setDetailTab('docs') }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              view === 'pending' 
                ? 'bg-yellow-600 text-white' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Clock className="h-4 w-4" />
            Onay Bekleyenler ({pending.length})
          </button>
          <button
            onClick={() => { setView('rejected'); setSelectedId(null); setDetailTab('docs') }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              view === 'rejected' 
                ? 'bg-red-600 text-white' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <UserX className="h-4 w-4" />
            Reddedilenler ({rejected.length})
          </button>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 ml-auto"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>

        {/* Ana İçerik */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Sürücü Listesi */}
          <div className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">
                {view === 'approved' ? 'Onaylı Sürücüler' : view === 'pending' ? 'Onay Bekleyenler' : 'Reddedilen Başvurular'}
              </h2>
            </div>
            
            {isLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
                <p className="text-gray-400">Yükleniyor...</p>
              </div>
            ) : list.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Kayıt bulunamadı</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700 max-h-[600px] overflow-y-auto">
                {list.map(d => (
                  <div
                    key={d.id}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedId === d.id 
                        ? 'bg-blue-500/10 border-l-4 border-l-blue-500' 
                        : 'hover:bg-gray-700/50'
                    }`}
                    onClick={() => {
                      setSelectedId(d.id)
                      setDetailTab(view === 'approved' ? 'live' : 'docs')
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-white truncate">{d.name}</p>
                          {view === 'approved' && (
                            d.available ? (
                              <span className="flex items-center gap-1 text-xs text-emerald-400">
                                <Wifi className="h-3 w-3" />
                                ONLINE
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <WifiOff className="h-3 w-3" />
                                offline
                              </span>
                            )
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Car className="h-3 w-3" />
                          <span>{d.vehicleType}</span>
                          {d.licensePlate && (
                            <>
                              <span className="text-gray-600">•</span>
                              <span className="text-gray-500">{d.licensePlate}</span>
                            </>
                          )}
                        </div>
                        {d.phone && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                            <Phone className="h-3 w-3" />
                            <span>{d.phone}</span>
                          </div>
                        )}
                        {/* Konum durumu - (0,0) geçersiz sayılır */}
                        {(!d.location || (d.location.lat === 0 && d.location.lng === 0)) ? (
                          <div className="flex items-center gap-1 text-xs text-red-400 mt-1">
                            <MapPin className="h-3 w-3" />
                            <span>Konum mevcut değil</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-green-400 mt-1">
                            <MapPin className="h-3 w-3" />
                            <span>{d.location.lat.toFixed(4)}, {d.location.lng.toFixed(4)}</span>
                          </div>
                        )}
                        {/* Belgeler özeti */}
                        {Array.isArray(d.docs) && d.docs.length > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            <FileText className="h-3 w-3 text-gray-500" />
                            <span className="text-xs text-gray-500">
                              {d.docs.filter(doc => doc.status === 'approved').length}/{d.docs.length} belge onaylı
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {view === 'pending' && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleApprove(d.id) }}
                              className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                              title="Onayla"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReject(d.id, rejectReason) }}
                              className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                              title="Reddet"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {view === 'approved' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(d.id) }}
                            className="p-2 bg-gray-700 hover:bg-red-600 text-gray-400 hover:text-white rounded-lg transition-colors"
                            title="Sil"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detay Paneli */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            {!selectedDriver ? (
              <div className="p-8 text-center">
                <Eye className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Detay görmek için sürücü seçin</p>
              </div>
            ) : (
              <>
                {/* Sürücü Bilgileri */}
                <div className="p-4 border-b border-gray-700 bg-gray-800/50">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                      <Users className="h-6 w-6 text-gray-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{selectedDriver.name}</h3>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(view)}
                        {view === 'approved' && (
                          selectedDriver.available ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-400">
                              <Wifi className="h-3 w-3" /> Online
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <WifiOff className="h-3 w-3" /> Offline
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    {selectedDriver.email && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <Mail className="h-4 w-4" />
                        <span>{selectedDriver.email}</span>
                      </div>
                    )}
                    {selectedDriver.phone && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <Phone className="h-4 w-4" />
                        <span>{selectedDriver.phone}</span>
                      </div>
                    )}
                    {selectedDriver.address && (
                      <div className="flex items-start gap-2 text-gray-400">
                        <Home className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{selectedDriver.address}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-400">
                      <Car className="h-4 w-4" />
                      <span>{selectedDriver.vehicleType} {selectedDriver.vehicleModel && `- ${selectedDriver.vehicleModel}`}</span>
                    </div>
                    {selectedDriver.licensePlate && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <FileText className="h-4 w-4" />
                        <span>{selectedDriver.licensePlate}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tab Butonları */}
                <div className="flex border-b border-gray-700">
                  {view === 'approved' && (
                    <button
                      onClick={() => setDetailTab('live')}
                      className={`flex-1 py-3 text-sm font-medium transition-colors ${
                        detailTab === 'live' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Şu Anki
                    </button>
                  )}
                  <button
                    onClick={() => setDetailTab('history')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      detailTab === 'history' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Geçmiş
                  </button>
                  <button
                    onClick={() => setDetailTab('docs')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      detailTab === 'docs' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Evraklar
                  </button>
                </div>

                {/* Tab İçerikleri */}
                <div className="p-4 max-h-[400px] overflow-y-auto">
                  {detailTab === 'live' && view === 'approved' && (
                    <div className="space-y-4">
                      {/* Aktif Yolculuk */}
                      {!activeBooking ? (
                        <div className="text-center py-6">
                          <Car className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                          <p className="text-gray-400 text-sm">Aktif yolculuk yok</p>
                          {selectedDriver.available && (
                            <p className="text-emerald-400 text-xs mt-1">Sürücü yeni yolculuk bekliyor</p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-white">Aktif Yolculuk</span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              activeBooking.status === 'in_progress' ? 'bg-purple-500/20 text-purple-400' :
                              activeBooking.status === 'driver_en_route' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {activeBooking.status === 'in_progress' ? 'Yolda' :
                               activeBooking.status === 'driver_en_route' ? 'Yola Çıktı' :
                               activeBooking.status === 'driver_arrived' ? 'Geldi' :
                               activeBooking.status}
                            </span>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                              <p className="text-gray-300">{activeBooking.pickupLocation?.address || 'Alış Noktası'}</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></div>
                              <p className="text-gray-300">{activeBooking.dropoffLocation?.address || 'Varış Noktası'}</p>
                            </div>
                          </div>

                          {activeBooking.finalPrice && (
                            <div className="mt-3 pt-3 border-t border-gray-600">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white">
                                  <DollarSign className="h-4 w-4 text-green-400" />
                                  <span className="font-bold">
                                    {currencySymbol(activeBooking.extras?.pricing?.currency || 'TRY')}
                                    {activeBooking.finalPrice.toFixed(0)}
                                  </span>
                                </div>
                                {activeBooking.reservationCode && (
                                  <span className="text-xs text-gray-500">#{activeBooking.reservationCode}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Konum Haritası */}
                      {(!selectedDriver.location || (selectedDriver.location.lat === 0 && selectedDriver.location.lng === 0)) ? (
                        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-red-400 mb-3">
                            <AlertTriangle className="h-5 w-5" />
                            <span className="font-medium">Konum Mevcut Değil</span>
                          </div>
                          <p className="text-sm text-gray-400 mb-3">
                            Şoför henüz GPS konumu göndermemiş veya konum izni vermemiş.
                          </p>
                          {/* Manuel Konum Güncelleme */}
                          <div className="space-y-2">
                            <label className="text-xs text-gray-500">Manuel Konum Ata (Test için):</label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                step="0.0001"
                                placeholder="Enlem (lat)"
                                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                                id={`lat-${selectedDriver.id}`}
                                defaultValue="41.0082"
                              />
                              <input
                                type="number"
                                step="0.0001"
                                placeholder="Boylam (lng)"
                                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                                id={`lng-${selectedDriver.id}`}
                                defaultValue="28.9784"
                              />
                            </div>
                            <button
                              onClick={async () => {
                                const latEl = document.getElementById(`lat-${selectedDriver.id}`) as HTMLInputElement
                                const lngEl = document.getElementById(`lng-${selectedDriver.id}`) as HTMLInputElement
                                const lat = parseFloat(latEl?.value || '0')
                                const lng = parseFloat(lngEl?.value || '0')
                                if (lat && lng && lat !== 0 && lng !== 0) {
                                  try {
                                    const res = await fetch('/api/drivers/location', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: selectedDriver.id, location: { lat, lng } })
                                    })
                                    if (res.ok) {
                                      toast.success('Konum güncellendi!')
                                      refresh()
                                    } else {
                                      toast.error('Konum güncellenemedi')
                                    }
                                  } catch {
                                    toast.error('Hata oluştu')
                                  }
                                }
                              }}
                              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
                            >
                              <MapPin className="h-3 w-3 inline mr-1" />
                              Konumu Güncelle
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                            <Navigation className="h-4 w-4" />
                            Anlık Konum
                          </h4>
                          <div className="h-48 rounded-lg overflow-hidden border border-gray-700">
                            <OpenStreetMap
                              center={selectedDriver.location}
                              customerLocation={activeBooking?.pickupLocation || selectedDriver.location}
                              destination={activeBooking?.dropoffLocation || selectedDriver.location}
                              drivers={[{ 
                                id: selectedDriver.id, 
                                name: selectedDriver.name, 
                                location: selectedDriver.location, 
                                rating: selectedDriver.rating || 0, 
                                available: !!selectedDriver.available 
                              }]}
                              highlightDriverId={selectedDriver.id}
                            />
                          </div>
                          <p className="text-xs text-green-400 mt-1 text-center">
                            📍 {selectedDriver.location.lat.toFixed(6)}, {selectedDriver.location.lng.toFixed(6)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {detailTab === 'history' && (
                    <div className="space-y-3">
                      {completedBookings.length === 0 ? (
                        <div className="text-center py-6">
                          <Clock className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                          <p className="text-gray-400 text-sm">Geçmiş yolculuk yok</p>
                        </div>
                      ) : (
                        completedBookings.slice(0, 10).map((b) => (
                          <div key={b.id} className="bg-gray-700/50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-gray-500">#{b.reservationCode || b.id.slice(-6)}</span>
                              <span className="text-xs text-green-400">
                                {currencySymbol(b.extras?.pricing?.currency || 'TRY')}
                                {(b.finalPrice || b.basePrice || 0).toFixed(0)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-300 line-clamp-1">{b.pickupLocation?.address}</p>
                            <p className="text-xs text-gray-500 line-clamp-1">→ {b.dropoffLocation?.address}</p>
                            {b.pickupTime && (
                              <p className="text-xs text-gray-600 mt-1">
                                <Calendar className="h-3 w-3 inline mr-1" />
                                {new Date(b.pickupTime).toLocaleString('tr-TR')}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {detailTab === 'docs' && (
                    <div className="space-y-3">
                      {Array.isArray(selectedDriver.docs) && selectedDriver.docs.length > 0 ? (
                        selectedDriver.docs.map((doc, i) => (
                          <div key={i} className="bg-gray-700/50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-white font-medium">{getDocLabel(doc.name)}</span>
                              <div className="flex items-center gap-2">
                                {doc.status === 'approved' && (
                                  <span className="text-xs text-green-400 flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" /> Onaylı
                                  </span>
                                )}
                                {doc.status === 'rejected' && (
                                  <span className="text-xs text-red-400 flex items-center gap-1">
                                    <XCircle className="h-3 w-3" /> Reddedildi
                                  </span>
                                )}
                                {doc.status === 'pending' && (
                                  <span className="text-xs text-yellow-400 flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> Onay Bekliyor
                                  </span>
                                )}
                                {!doc.status && doc.url && (
                                  <span className="text-xs text-gray-400">Yüklendi</span>
                                )}
                              </div>
                            </div>
                            
                            {doc.url ? (
                              <div className="relative group">
                                {doc.url.startsWith('data:image') ? (
                                  <img 
                                    src={doc.url} 
                                    alt={doc.name} 
                                    className="h-24 rounded border border-gray-600 cursor-zoom-in w-full object-cover"
                                    onClick={() => setPreview({ url: doc.url!, name: getDocLabel(doc.name) })}
                                  />
                                ) : (
                                  <div className="h-16 bg-gray-600/50 rounded flex items-center justify-center text-gray-500 text-xs">
                                    PDF Belgesi
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="h-16 bg-gray-600/50 rounded flex items-center justify-center text-gray-500 text-xs">
                                <AlertTriangle className="h-4 w-4 mr-1" />
                                Belge yüklenmemiş
                              </div>
                            )}

                            {/* Onay/Red Butonları (Admin için) */}
                            {doc.url && doc.status !== 'approved' && (
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleDocApprove(doc.name)}
                                  className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                                >
                                  <CheckCircle className="h-3 w-3 inline mr-1" />
                                  Onayla
                                </button>
                                <button
                                  onClick={() => handleDocReject(doc.name, 'Belge geçersiz')}
                                  className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                                >
                                  <XCircle className="h-3 w-3 inline mr-1" />
                                  Reddet
                                </button>
                              </div>
                            )}

                            {doc.uploadedAt && (
                              <p className="text-xs text-gray-500 mt-1">
                                Yüklenme: {new Date(doc.uploadedAt).toLocaleString('tr-TR')}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6">
                          <FileText className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                          <p className="text-gray-400 text-sm">Belge yok</p>
                          <p className="text-gray-500 text-xs mt-1">Sürücü henüz belge yüklememiş</p>
                        </div>
                      )}

                      {/* Başvuru İşlemleri */}
                      {(view === 'pending' || view === 'rejected') && (
                        <div className="pt-4 border-t border-gray-700 space-y-3">
                          <div>
                            <label className="text-xs text-gray-400 mb-1 block">Red Nedeni</label>
                            <input 
                              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                              value={rejectReason} 
                              onChange={e => setRejectReason(e.target.value)} 
                            />
                          </div>
                          <div className="flex gap-2">
                            {view === 'pending' && (
                              <button
                                onClick={() => handleApprove(selectedDriver.id)}
                                className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                              >
                                <CheckCircle className="h-4 w-4 inline mr-1" />
                                Onayla
                              </button>
                            )}
                            <button
                              onClick={() => handleReject(selectedDriver.id, rejectReason)}
                              className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                            >
                              <XCircle className="h-4 w-4 inline mr-1" />
                              Reddet
                            </button>
                          </div>
                        </div>
                      )}

                      {view === 'approved' && (
                        <div className="pt-4 border-t border-gray-700">
                          <button
                            onClick={() => handleDelete(selectedDriver.id)}
                            className="w-full py-2 bg-gray-700 hover:bg-red-600 text-red-400 hover:text-white rounded-lg font-medium transition-colors"
                          >
                            <Trash2 className="h-4 w-4 inline mr-1" />
                            Sürücüyü Sil
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Önizleme Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <span className="text-white font-medium">{preview.name}</span>
              <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-white">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4">
              <img src={preview.url} alt={preview.name} className="w-full h-auto rounded-lg" />
            </div>
            <div className="p-4 border-t border-gray-700">
              <a 
                href={preview.url} 
                download={`${preview.name}.${extFromDataUrl(preview.url)}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                İndir
              </a>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminDrivers
