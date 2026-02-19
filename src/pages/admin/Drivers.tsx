import React, { useEffect, useMemo, useRef, useState } from 'react'
import OpenStreetMap from '@/components/OpenStreetMap'
import { io as ioClient, type Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/AdminLayout'
import { 
  Users, UserCheck, UserX, Car, Phone, Mail, 
  FileText, Clock, DollarSign, CheckCircle, XCircle, 
  Eye, RefreshCw, Trash2, ChevronRight, Loader2, Wifi,
  WifiOff, Navigation, Calendar, AlertTriangle, Home,
  Wallet, TrendingUp, Percent, X, ArrowLeft
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
  customPricing?: boolean
  driverPerKm?: number
  platformFeePercent?: number
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
  const [detailTab, setDetailTab] = useState<'live' | 'history' | 'docs' | 'accounting'>('live')
  const [rejectReason, setRejectReason] = useState('Eksik belge')
  
  const [customPricing, setCustomPricing] = useState(false)
  const [customDriverPerKm, setCustomDriverPerKm] = useState('')
  const [customPlatformFee, setCustomPlatformFee] = useState('')
  const [savingPricing, setSavingPricing] = useState(false)

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

  // POLLING: Serverless'de Socket.IO çalışmayabilir, bu yüzden periyodik yenileme
  useEffect(() => {
    const interval = setInterval(() => {
      // Sadece approved sürücüleri ve online sayısını güncelle
      fetch('/api/drivers/list?status=approved')
        .then(r => r.json())
        .then(data => {
          if (data?.success && Array.isArray(data.data)) {
            setApproved(data.data)
            setOnlineCount(data.data.filter((d: Driver) => d.available).length)
            
            // Seçili sürücünün konumunu da güncelle
            if (selectedId) {
              const updated = data.data.find((d: Driver) => d.id === selectedId)
              if (updated && selectedDriver) {
                setSelectedDriver(prev => prev ? { 
                  ...prev, 
                  location: updated.location, 
                  available: updated.available 
                } : prev)
              }
            }
          }
        })
        .catch(() => {})
    }, 3000) // Her 3 saniyede bir güncelle

    return () => clearInterval(interval)
  }, [selectedId, selectedDriver?.id])

  useEffect(() => {
    if (!selectedId) {
      setSelectedDriver(null)
      setBookings([])
      return
    }
    ;(async () => {
      const d = await fetch(`/api/drivers/${selectedId}`).then(r => r.json()).catch(() => null)
      if (d?.success && d?.data) {
        setSelectedDriver(d.data)
        setCustomPricing(d.data.customPricing === true)
        setCustomDriverPerKm(d.data.driverPerKm?.toString() || '')
        setCustomPlatformFee(d.data.platformFeePercent?.toString() || '')
      }
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

  // İstatistik kartı bileşeni
  const StatCard = ({ icon: Icon, value, label, color, bgColor }: { 
    icon: React.ElementType; 
    value: number | string; 
    label: string; 
    color: string; 
    bgColor: string 
  }) => (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-2 lg:p-4 text-center">
      <div className={`w-8 h-8 lg:w-12 lg:h-12 ${bgColor} rounded-lg flex items-center justify-center mx-auto mb-1 lg:mb-2`}>
        <Icon className={`h-4 w-4 lg:h-6 lg:w-6 ${color}`} />
      </div>
      <p className={`text-lg lg:text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 hidden lg:block">{label}</p>
    </div>
  )

  // Sürücü online durumu badge'i
  const DriverOnlineBadge = ({ available }: { available?: boolean }) => available ? (
    <span className="flex items-center gap-1 text-xs text-emerald-400">
      <Wifi className="h-3 w-3" /> ONLINE
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-gray-500">
      <WifiOff className="h-3 w-3" /> offline
    </span>
  )

  const handleSaveCustomPricing = async () => {
    if (!selectedDriver) return
    setSavingPricing(true)
    try {
      const res = await fetch('/api/drivers/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedDriver.id,
          customPricing,
          driverPerKm: customPricing ? parseFloat(customDriverPerKm) || undefined : undefined,
          platformFeePercent: customPricing ? parseFloat(customPlatformFee) || undefined : undefined,
        })
      })
      const j = await res.json()
      if (!res.ok || !j?.success) throw new Error(j?.error || 'save_failed')
      
      setSelectedDriver((prev: Driver | null) => prev ? {
        ...prev,
        customPricing,
        driverPerKm: customPricing ? parseFloat(customDriverPerKm) || undefined : undefined,
        platformFeePercent: customPricing ? parseFloat(customPlatformFee) || undefined : undefined,
      } : prev)
      
      toast.success(customPricing ? 'Özel fiyatlandırma kaydedildi' : 'Genel fiyatlandırmaya geçildi')
    } catch {
      toast.error('Fiyatlandırma kaydedilemedi')
    } finally {
      setSavingPricing(false)
    }
  }

  // Sürücü seçme ve detay gösterme
  const handleSelectDriver = (driverId: string) => {
    setSelectedId(driverId)
    setDetailTab(view === 'approved' ? 'live' : 'docs')
  }

  const handleCloseDetail = () => {
    setSelectedId(null)
  }

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6">
        {/* Header */}
        <div className="mb-4 lg:mb-6">
          <h1 className="text-xl lg:text-2xl font-bold text-white mb-1">Sürücü Yönetimi</h1>
          <p className="text-gray-400 text-sm hidden lg:block">Tüm sürücüleri görüntüleyin, onaylayın veya yönetin</p>
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-4 gap-2 lg:gap-4 mb-4 lg:mb-6">
          <StatCard icon={UserCheck} value={approved.length} label="Onaylı" color="text-white" bgColor="bg-green-500/20" />
          <StatCard icon={Wifi} value={onlineCount} label="Online" color="text-emerald-400" bgColor="bg-emerald-500/20" />
          <StatCard icon={Clock} value={pending.length} label="Bekleyen" color="text-white" bgColor="bg-yellow-500/20" />
          <StatCard icon={UserX} value={rejected.length} label="Reddedilen" color="text-white" bgColor="bg-red-500/20" />
        </div>

        {/* Tab Butonları */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => { setView('approved'); setSelectedId(null); setDetailTab('live') }}
            className={`flex items-center gap-1.5 px-3 lg:px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-colors text-sm lg:text-base ${
              view === 'approved' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>Sürücüler</span>
            {onlineCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-emerald-500 text-white text-xs rounded-full">{onlineCount}</span>
            )}
          </button>
          <button
            onClick={() => { setView('pending'); setSelectedId(null); setDetailTab('docs') }}
            className={`flex items-center gap-1.5 px-3 lg:px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-colors text-sm lg:text-base ${
              view === 'pending' 
                ? 'bg-yellow-600 text-white' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Bekleyenler</span>
            {pending.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-yellow-400 text-gray-900 text-xs rounded-full">{pending.length}</span>
            )}
          </button>
          <button
            onClick={() => { setView('rejected'); setSelectedId(null); setDetailTab('docs') }}
            className={`flex items-center gap-1.5 px-3 lg:px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-colors text-sm lg:text-base ${
              view === 'rejected' 
                ? 'bg-red-600 text-white' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <UserX className="h-4 w-4" />
            <span>Reddedilenler</span>
          </button>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 lg:px-4 py-2 rounded-xl font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 ml-auto text-sm"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Yenile</span>
          </button>
        </div>

        {/* Ana İçerik - Masaüstü için 2 sütun */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-4">
          {/* Sürücü Listesi */}
          <div className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
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
                    onClick={() => handleSelectDriver(d.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-white truncate">{d.name}</p>
                          {view === 'approved' && <DriverOnlineBadge available={d.available} />}
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

          {/* Detay Paneli - Masaüstü */}
          <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
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
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-lg">{selectedDriver.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{selectedDriver.name}</h3>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(view)}
                        {view === 'approved' && <DriverOnlineBadge available={selectedDriver.available} />}
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
                <div className="flex border-b border-gray-700 overflow-x-auto">
                  {view === 'approved' && (
                    <button
                      onClick={() => setDetailTab('live')}
                      className={`flex-1 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                        detailTab === 'live' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Şu Anki
                    </button>
                  )}
                  <button
                    onClick={() => setDetailTab('history')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                      detailTab === 'history' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Geçmiş
                  </button>
                  <button
                    onClick={() => setDetailTab('docs')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                      detailTab === 'docs' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Evraklar
                  </button>
                  {view === 'approved' && (
                    <button
                      onClick={() => setDetailTab('accounting')}
                      className={`flex-1 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                        detailTab === 'accounting' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Muhasebe
                    </button>
                  )}
                </div>

                {/* Tab İçerikleri */}
                <div className="p-4 max-h-[400px] overflow-y-auto">
                  {detailTab === 'live' && view === 'approved' && (
                    <div className="space-y-4">
                      {!activeBooking ? (
                        <div className="text-center py-6">
                          <Car className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                          <p className="text-gray-400 text-sm">Aktif yolculuk yok</p>
                          {selectedDriver.available && (
                            <p className="text-emerald-400 text-xs mt-1">Sürücü yeni yolculuk bekliyor</p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4">
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

                      {selectedDriver.location && selectedDriver.location.lat !== 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                            <Navigation className="h-4 w-4" />
                            Anlık Konum
                          </h4>
                          <div className="h-48 rounded-xl overflow-hidden border border-gray-700">
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
                          <div key={b.id} className="bg-gray-700/50 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-gray-500">#{b.reservationCode || b.id.slice(-6)}</span>
                              <span className="text-xs text-green-400">
                                {currencySymbol(b.extras?.pricing?.currency || 'TRY')}
                                {(b.finalPrice || b.basePrice || 0).toFixed(0)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-300 line-clamp-1">{b.pickupLocation?.address}</p>
                            <p className="text-xs text-gray-500 line-clamp-1">→ {b.dropoffLocation?.address}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {detailTab === 'docs' && (
                    <div className="space-y-3">
                      {Array.isArray(selectedDriver.docs) && selectedDriver.docs.length > 0 ? (
                        selectedDriver.docs.map((doc, i) => (
                          <div key={i} className="bg-gray-700/50 rounded-xl p-3">
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
                                    <Clock className="h-3 w-3" /> Bekliyor
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {doc.url ? (
                              doc.url.startsWith('data:image') ? (
                                <img 
                                  src={doc.url} 
                                  alt={doc.name} 
                                  className="h-24 rounded-lg border border-gray-600 cursor-zoom-in w-full object-cover"
                                  onClick={() => setPreview({ url: doc.url!, name: getDocLabel(doc.name) })}
                                />
                              ) : (
                                <div className="h-16 bg-gray-600/50 rounded-lg flex items-center justify-center text-gray-500 text-xs">
                                  PDF Belgesi
                                </div>
                              )
                            ) : (
                              <div className="h-16 bg-gray-600/50 rounded-lg flex items-center justify-center text-gray-500 text-xs">
                                <AlertTriangle className="h-4 w-4 mr-1" />
                                Belge yüklenmemiş
                              </div>
                            )}

                            {doc.url && doc.status !== 'approved' && (
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleDocApprove(doc.name)}
                                  className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs"
                                >
                                  <CheckCircle className="h-3 w-3 inline mr-1" />
                                  Onayla
                                </button>
                                <button
                                  onClick={() => handleDocReject(doc.name, 'Belge geçersiz')}
                                  className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs"
                                >
                                  <XCircle className="h-3 w-3 inline mr-1" />
                                  Reddet
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6">
                          <FileText className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                          <p className="text-gray-400 text-sm">Belge yok</p>
                        </div>
                      )}

                      {/* Başvuru İşlemleri */}
                      {(view === 'pending' || view === 'rejected') && (
                        <div className="pt-4 border-t border-gray-700 space-y-3">
                          <div>
                            <label className="text-xs text-gray-400 mb-1 block">Red Nedeni</label>
                            <input 
                              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white"
                              value={rejectReason} 
                              onChange={e => setRejectReason(e.target.value)} 
                            />
                          </div>
                          <div className="flex gap-2">
                            {view === 'pending' && (
                              <button
                                onClick={() => handleApprove(selectedDriver.id)}
                                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
                              >
                                <CheckCircle className="h-4 w-4 inline mr-1" />
                                Onayla
                              </button>
                            )}
                            <button
                              onClick={() => handleReject(selectedDriver.id, rejectReason)}
                              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
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
                            className="w-full py-2.5 bg-gray-700 hover:bg-red-600 text-red-400 hover:text-white rounded-xl font-medium transition-colors"
                          >
                            <Trash2 className="h-4 w-4 inline mr-1" />
                            Sürücüyü Sil
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Muhasebe Sekmesi */}
                  {detailTab === 'accounting' && view === 'approved' && (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-700/50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-white flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-green-400" />
                            Sürücü Kazancı
                          </span>
                          <TrendingUp className="h-4 w-4 text-green-400" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-400">Tamamlanan</p>
                            <p className="text-xl font-bold text-white">{completedBookings.length}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Toplam</p>
                            <p className="text-xl font-bold text-green-400">
                              {currencySymbol('EUR')}
                              {completedBookings.reduce((sum, b) => sum + (b.basePrice || 0), 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-700/50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm font-medium text-white">Özel Fiyatlandırma</span>
                          <button
                            onClick={() => setCustomPricing(!customPricing)}
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                              customPricing ? 'bg-green-600' : 'bg-gray-600'
                            }`}
                          >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                              customPricing ? 'left-7' : 'left-1'
                            }`} />
                          </button>
                        </div>

                        {customPricing ? (
                          <div className="space-y-4">
                            <p className="text-xs text-yellow-400 bg-yellow-500/10 p-2 rounded-lg">
                              ⚠️ Özel fiyatlandırma aktif.
                            </p>
                            
                            <div>
                              <label className="text-xs text-gray-400 mb-1 block">Km Başı Ücret (€)</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={customDriverPerKm}
                                  onChange={(e) => setCustomDriverPerKm(e.target.value)}
                                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 pr-8 text-white text-sm"
                                  placeholder="Örn: 1.50"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                              </div>
                            </div>

                            <div>
                              <label className="text-xs text-gray-400 mb-1 block">Platform Komisyonu (%)</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  value={customPlatformFee}
                                  onChange={(e) => setCustomPlatformFee(e.target.value)}
                                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 pr-8 text-white text-sm"
                                  placeholder="Örn: 3"
                                />
                                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                              </div>
                            </div>

                            <button
                              onClick={handleSaveCustomPricing}
                              disabled={savingPricing}
                              className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              {savingPricing ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Kaydediliyor...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4" />
                                  Kaydet
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-xs text-gray-400">
                              Bu sürücü genel fiyatlandırma kullanıyor.
                            </p>
                            <button
                              onClick={handleSaveCustomPricing}
                              disabled={savingPricing}
                              className="w-full py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-xl font-medium transition-colors text-sm"
                            >
                              Genel Fiyatlandırmayı Kullan
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobil Sürücü Listesi */}
        <div className="lg:hidden">
          {isLoading ? (
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
              <p className="text-gray-400">Yükleniyor...</p>
            </div>
          ) : list.length === 0 ? (
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 text-center">
              <Users className="h-12 w-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Kayıt bulunamadı</p>
            </div>
          ) : (
            <div className="space-y-2">
              {list.map(d => (
                <div
                  key={d.id}
                  className="bg-gray-800 border border-gray-700 rounded-2xl p-4 active:bg-gray-700/50 transition-colors"
                  onClick={() => handleSelectDriver(d.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">{d.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-white truncate">{d.name}</p>
                        {view === 'approved' && (
                          d.available ? (
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                          ) : null
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Car className="h-3 w-3" />
                        <span className="truncate">{d.vehicleType}</span>
                        {d.licensePlate && (
                          <span className="text-gray-500">• {d.licensePlate}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {view === 'pending' && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleApprove(d.id) }}
                            className="p-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors"
                          >
                            <CheckCircle className="h-5 w-5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleReject(d.id, rejectReason) }}
                            className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors"
                          >
                            <XCircle className="h-5 w-5" />
                          </button>
                        </>
                      )}
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobil Detay Modal */}
      {selectedDriver && (
        <div className="lg:hidden fixed inset-0 z-50 bg-gray-900 flex flex-col">
          {/* Modal Header */}
          <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center gap-3 safe-area-inset-top">
            <button
              onClick={handleCloseDetail}
              className="p-2 -ml-2 text-gray-400 hover:text-white rounded-lg"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div className="flex-1">
              <h2 className="font-semibold text-white">{selectedDriver.name}</h2>
              <div className="flex items-center gap-2">
                {getStatusBadge(view)}
                {view === 'approved' && <DriverOnlineBadge available={selectedDriver.available} />}
              </div>
            </div>
          </div>

          {/* Tab Butonları */}
          <div className="bg-gray-800 border-b border-gray-700 flex overflow-x-auto no-scrollbar">
            {view === 'approved' && (
              <button
                onClick={() => setDetailTab('live')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  detailTab === 'live' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'
                }`}
              >
                Şu Anki
              </button>
            )}
            <button
              onClick={() => setDetailTab('history')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                detailTab === 'history' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'
              }`}
            >
              Geçmiş
            </button>
            <button
              onClick={() => setDetailTab('docs')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                detailTab === 'docs' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'
              }`}
            >
              Evraklar
            </button>
            {view === 'approved' && (
              <button
                onClick={() => setDetailTab('accounting')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  detailTab === 'accounting' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'
                }`}
              >
                Muhasebe
              </button>
            )}
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-4 pb-24">
            {/* Sürücü Bilgileri */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 mb-4">
              <div className="space-y-3">
                {selectedDriver.email && (
                  <div className="flex items-center gap-3 text-gray-400">
                    <Mail className="h-4 w-4" />
                    <span>{selectedDriver.email}</span>
                  </div>
                )}
                {selectedDriver.phone && (
                  <div className="flex items-center gap-3 text-gray-400">
                    <Phone className="h-4 w-4" />
                    <span className="text-white">{selectedDriver.phone}</span>
                  </div>
                )}
                {selectedDriver.address && (
                  <div className="flex items-start gap-3 text-gray-400">
                    <Home className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{selectedDriver.address}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-gray-400">
                  <Car className="h-4 w-4" />
                  <span>{selectedDriver.vehicleType} {selectedDriver.vehicleModel && `- ${selectedDriver.vehicleModel}`}</span>
                </div>
                {selectedDriver.licensePlate && (
                  <div className="flex items-center gap-3 text-gray-400">
                    <FileText className="h-4 w-4" />
                    <span className="text-white font-medium">{selectedDriver.licensePlate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tab İçerikleri */}
            {detailTab === 'live' && view === 'approved' && (
              <div className="space-y-4">
                {!activeBooking ? (
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 text-center">
                    <Car className="h-10 w-10 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400">Aktif yolculuk yok</p>
                    {selectedDriver.available && (
                      <p className="text-emerald-400 text-sm mt-1">Sürücü yeni yolculuk bekliyor</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-blue-900/30 border border-blue-700 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-white">Aktif Yolculuk</span>
                      <span className={`px-3 py-1 rounded-full text-xs ${
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
                    
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full mt-1 flex-shrink-0"></div>
                        <p className="text-gray-300">{activeBooking.pickupLocation?.address || 'Alış Noktası'}</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-3 h-3 bg-red-500 rounded-full mt-1 flex-shrink-0"></div>
                        <p className="text-gray-300">{activeBooking.dropoffLocation?.address || 'Varış Noktası'}</p>
                      </div>
                    </div>

                    {activeBooking.finalPrice && (
                      <div className="mt-4 pt-4 border-t border-gray-600 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white">
                          <DollarSign className="h-5 w-5 text-green-400" />
                          <span className="text-xl font-bold">
                            {currencySymbol(activeBooking.extras?.pricing?.currency || 'TRY')}
                            {activeBooking.finalPrice.toFixed(0)}
                          </span>
                        </div>
                        {activeBooking.reservationCode && (
                          <span className="text-sm text-gray-500">#{activeBooking.reservationCode}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {selectedDriver.location && selectedDriver.location.lat !== 0 && (
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
                    <div className="p-3 border-b border-gray-700 flex items-center gap-2">
                      <Navigation className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-300">Anlık Konum</span>
                    </div>
                    <div className="h-56">
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
                  </div>
                )}
              </div>
            )}

            {detailTab === 'history' && (
              <div className="space-y-3">
                {completedBookings.length === 0 ? (
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 text-center">
                    <Clock className="h-10 w-10 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400">Geçmiş yolculuk yok</p>
                  </div>
                ) : (
                  completedBookings.map((b) => (
                    <div key={b.id} className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500">#{b.reservationCode || b.id.slice(-6)}</span>
                        <span className="text-green-400 font-bold">
                          {currencySymbol(b.extras?.pricing?.currency || 'TRY')}
                          {(b.finalPrice || b.basePrice || 0).toFixed(0)}
                        </span>
                      </div>
                      <p className="text-gray-300 mb-1">{b.pickupLocation?.address}</p>
                      <p className="text-sm text-gray-500">→ {b.dropoffLocation?.address}</p>
                      {b.pickupTime && (
                        <p className="text-xs text-gray-600 mt-2">
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
                    <div key={i} className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-white">{getDocLabel(doc.name)}</span>
                        {doc.status === 'approved' && (
                          <span className="text-xs text-green-400 flex items-center gap-1 bg-green-500/10 px-2 py-1 rounded-full">
                            <CheckCircle className="h-3 w-3" /> Onaylı
                          </span>
                        )}
                        {doc.status === 'rejected' && (
                          <span className="text-xs text-red-400 flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded-full">
                            <XCircle className="h-3 w-3" /> Reddedildi
                          </span>
                        )}
                        {doc.status === 'pending' && (
                          <span className="text-xs text-yellow-400 flex items-center gap-1 bg-yellow-500/10 px-2 py-1 rounded-full">
                            <Clock className="h-3 w-3" /> Bekliyor
                          </span>
                        )}
                      </div>
                      
                      {doc.url ? (
                        doc.url.startsWith('data:image') ? (
                          <img 
                            src={doc.url} 
                            alt={doc.name} 
                            className="h-32 rounded-xl border border-gray-600 cursor-zoom-in w-full object-cover"
                            onClick={() => setPreview({ url: doc.url!, name: getDocLabel(doc.name) })}
                          />
                        ) : (
                          <div className="h-20 bg-gray-700 rounded-xl flex items-center justify-center text-gray-500">
                            PDF Belgesi
                          </div>
                        )
                      ) : (
                        <div className="h-20 bg-gray-700 rounded-xl flex items-center justify-center text-gray-500">
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Belge yüklenmemiş
                        </div>
                      )}

                      {doc.url && doc.status !== 'approved' && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleDocApprove(doc.name)}
                            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium"
                          >
                            Onayla
                          </button>
                          <button
                            onClick={() => handleDocReject(doc.name, 'Belge geçersiz')}
                            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium"
                          >
                            Reddet
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 text-center">
                    <FileText className="h-10 w-10 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400">Belge yok</p>
                  </div>
                )}

                {/* Başvuru İşlemleri */}
                {(view === 'pending' || view === 'rejected') && (
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Red Nedeni</label>
                      <input 
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white"
                        value={rejectReason} 
                        onChange={e => setRejectReason(e.target.value)} 
                      />
                    </div>
                    <div className="flex gap-2">
                      {view === 'pending' && (
                        <button
                          onClick={() => handleApprove(selectedDriver.id)}
                          className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium"
                        >
                          Onayla
                        </button>
                      )}
                      <button
                        onClick={() => handleReject(selectedDriver.id, rejectReason)}
                        className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium"
                      >
                        Reddet
                      </button>
                    </div>
                  </div>
                )}

                {view === 'approved' && (
                  <button
                    onClick={() => handleDelete(selectedDriver.id)}
                    className="w-full py-3 bg-gray-800 hover:bg-red-600 text-red-400 hover:text-white rounded-xl font-medium transition-colors border border-gray-700"
                  >
                    <Trash2 className="h-4 w-4 inline mr-2" />
                    Sürücüyü Sil
                  </button>
                )}
              </div>
            )}

            {/* Muhasebe Sekmesi - Mobil */}
            {detailTab === 'accounting' && view === 'approved' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-700/50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet className="h-5 w-5 text-green-400" />
                    <span className="font-medium text-white">Sürücü Kazancı</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Yolculuk</p>
                      <p className="text-2xl font-bold text-white">{completedBookings.length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Toplam</p>
                      <p className="text-2xl font-bold text-green-400">
                        {currencySymbol('EUR')}
                        {completedBookings.reduce((sum, b) => sum + (b.basePrice || 0), 0).toFixed(0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-medium text-white">Özel Fiyatlandırma</span>
                    <button
                      onClick={() => setCustomPricing(!customPricing)}
                      className={`relative w-14 h-7 rounded-full transition-colors ${
                        customPricing ? 'bg-green-600' : 'bg-gray-600'
                      }`}
                    >
                      <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                        customPricing ? 'left-8' : 'left-1'
                      }`} />
                    </button>
                  </div>

                  {customPricing ? (
                    <div className="space-y-4">
                      <p className="text-sm text-yellow-400 bg-yellow-500/10 p-3 rounded-xl">
                        ⚠️ Özel fiyatlandırma aktif. Bu sürücü genel fiyatlandırmadan bağımsız çalışacak.
                      </p>
                      
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Km Başı Ücret (€)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={customDriverPerKm}
                            onChange={(e) => setCustomDriverPerKm(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 pr-10 text-white text-lg"
                            placeholder="Örn: 1.50"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Platform Komisyonu (%)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={customPlatformFee}
                            onChange={(e) => setCustomPlatformFee(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 pr-10 text-white text-lg"
                            placeholder="Örn: 3"
                          />
                          <Percent className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        </div>
                      </div>

                      <button
                        onClick={handleSaveCustomPricing}
                        disabled={savingPricing}
                        className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                      >
                        {savingPricing ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Kaydediliyor...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-5 w-5" />
                            Kaydet
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-400">
                        Bu sürücü şu anda genel fiyatlandırma ayarlarını kullanıyor.
                      </p>
                      <button
                        onClick={handleSaveCustomPricing}
                        disabled={savingPricing}
                        className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium text-sm"
                      >
                        Genel Fiyatlandırmayı Kullan
                      </button>
                    </div>
                  )}
                </div>

                {/* Son Yolculuklar */}
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
                  <h4 className="font-medium text-white mb-3">Son Tamamlanan Yolculuklar</h4>
                  {completedBookings.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Henüz tamamlanan yolculuk yok</p>
                  ) : (
                    <div className="space-y-2">
                      {completedBookings.slice(0, 5).map((b) => (
                        <div key={b.id} className="bg-gray-700/50 rounded-xl p-3">
                          <div className="flex justify-between mb-1">
                            <span className="text-gray-400 text-sm">#{b.reservationCode || b.id.slice(-6)}</span>
                            <span className="text-green-400 font-bold">
                              {currencySymbol(b.extras?.pricing?.currency || 'EUR')}
                              {(b.basePrice || 0).toFixed(0)}
                            </span>
                          </div>
                          <p className="text-gray-300 truncate text-sm">{b.pickupLocation?.address}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Önizleme Modal */}
      {preview && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800">
              <span className="text-white font-medium">{preview.name}</span>
              <button onClick={() => setPreview(null)} className="p-2 text-gray-400 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4">
              <img src={preview.url} alt={preview.name} className="w-full h-auto rounded-xl" />
            </div>
            <div className="p-4 border-t border-gray-700">
              <a 
                href={preview.url} 
                download={`${preview.name}.${extFromDataUrl(preview.url)}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
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
