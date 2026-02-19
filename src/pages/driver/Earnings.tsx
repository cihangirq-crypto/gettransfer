import React, { useEffect, useState } from 'react'
import { DriverLayout } from '@/components/DriverLayout'
import { useDriverStore } from '@/stores/driverStore'
import { API } from '@/utils/api'
import { 
  TrendingUp, TrendingDown, DollarSign, Car, Clock, Calendar, 
  MapPin, ArrowRight, Download, Filter, ChevronLeft, ChevronRight,
  Wallet, CreditCard, Banknote, Receipt, BarChart3, PieChart
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

type TripRecord = {
  id: string
  reservationCode: string
  pickup: { lat: number; lng: number; address: string }
  dropoff: { lat: number; lng: number; address: string }
  pickupTime: string
  completedAt: string
  passengerCount: number
  vehicleType: string
  distanceKm?: number
  driverFare: number
  platformFee?: number
  totalFare?: number
  paymentStatus?: string
  paymentMethod?: string
  customerName?: string
  customerPhone?: string
  status: string
  currency?: string
}

type EarningsData = {
  driverId: string
  currency: string
  daily: number
  weekly: number
  monthly: number
  total: number
  totalPlatformFee?: number
  totalTrips: number
  dailyTripsCount: number
  weeklyTripsCount: number
  monthlyTripsCount: number
  dailyBreakdown: { date: string; amount: number; trips: number }[]
  generatedAt: string
}

// Para birimi sembolü
const getCurrencySymbol = (currency: string) => {
  return currency?.toUpperCase() === 'TRY' ? '₺' : '€'
}

export const DriverEarnings = () => {
  const { me } = useDriverStore()
  const [earnings, setEarnings] = useState<EarningsData | null>(null)
  const [trips, setTrips] = useState<TripRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('week')
  const [currentPage, setCurrentPage] = useState(1)
  const tripsPerPage = 10

  useEffect(() => {
    if (me?.id) {
      fetchData()
    }
  }, [me?.id])

  const fetchData = async () => {
    if (!me?.id) return
    setLoading(true)
    try {
      const [earningsRes, tripsRes] = await Promise.all([
        fetch(`${API}/drivers/earnings/${me.id}`),
        fetch(`${API}/drivers/trips/${me.id}?limit=100`)
      ])
      
      const earningsData = await earningsRes.json()
      const tripsData = await tripsRes.json()
      
      if (earningsData.success) setEarnings(earningsData.data)
      if (tripsData.success) setTrips(tripsData.data)
    } catch (e) {
      console.error('Failed to fetch earnings data:', e)
    } finally {
      setLoading(false)
    }
  }

  const filterTripsByTime = (trips: TripRecord[]) => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - 7)
    const monthStart = new Date(todayStart)
    monthStart.setMonth(monthStart.getMonth() - 1)

    return trips.filter(trip => {
      const tripDate = new Date(trip.completedAt || trip.pickupTime)
      switch (timeFilter) {
        case 'today':
          return tripDate >= todayStart
        case 'week':
          return tripDate >= weekStart
        case 'month':
          return tripDate >= monthStart
        default:
          return true
      }
    })
  }

  const filteredTrips = filterTripsByTime(trips)
  const paginatedTrips = filteredTrips.slice(
    (currentPage - 1) * tripsPerPage,
    currentPage * tripsPerPage
  )
  const totalPages = Math.ceil(filteredTrips.length / tripsPerPage)

  const formatCurrency = (amount: number, currency?: string) => {
    const curr = currency || earnings?.currency || 'EUR'
    return new Intl.NumberFormat('tr-TR', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount) + ' ' + getCurrencySymbol(curr)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDateShort = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short'
    })
  }

  // Grafik için max değer bul
  const maxDailyAmount = Math.max(...(earnings?.dailyBreakdown?.map(d => d.amount) || [1]), 1)

  if (loading) {
    return (
      <DriverLayout>
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
        </div>
      </DriverLayout>
    )
  }

  return (
    <DriverLayout>
      <div className="min-h-screen bg-gray-900 text-white pb-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-900 to-emerald-900 p-6">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Wallet className="h-7 w-7" />
            Muhasebe & Kazançlar
          </h1>
          <p className="text-green-200 mt-1">Yolculuk kazançlarınızı ve istatistiklerinizi görüntüleyin</p>
        </div>

        {/* Özet Kartları */}
        <div className="px-4 -mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Günlük */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Bugün</span>
                <Calendar className="h-5 w-5 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(earnings?.daily || 0)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {earnings?.dailyTripsCount || 0} yolculuk
              </div>
            </div>

            {/* Haftalık */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Bu Hafta</span>
                <TrendingUp className="h-5 w-5 text-green-400" />
              </div>
              <div className="text-2xl font-bold text-green-400">
                {formatCurrency(earnings?.weekly || 0)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {earnings?.weeklyTripsCount || 0} yolculuk
              </div>
            </div>

            {/* Aylık */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Bu Ay</span>
                <BarChart3 className="h-5 w-5 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-purple-400">
                {formatCurrency(earnings?.monthly || 0)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {earnings?.monthlyTripsCount || 0} yolculuk
              </div>
            </div>

            {/* Toplam */}
            <div className="bg-gradient-to-br from-green-900 to-emerald-900 rounded-xl p-4 border border-green-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-200 text-sm">Toplam</span>
                <DollarSign className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="text-2xl font-bold text-yellow-400">
                {formatCurrency(earnings?.total || 0)}
              </div>
              <div className="text-xs text-green-300 mt-1">
                {earnings?.totalTrips || 0} toplam yolculuk
              </div>
            </div>
          </div>
        </div>

        {/* Grafik ve İstatistikler */}
        <div className="px-4 mt-6">
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Son 7 Gün Grafiği */}
            <div className="lg:col-span-2 bg-gray-800 rounded-xl p-5 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-400" />
                Son 7 Günlük Kazanç
              </h3>
              
              {earnings?.dailyBreakdown && earnings.dailyBreakdown.length > 0 ? (
                <div className="flex items-end justify-between h-48 gap-2">
                  {earnings.dailyBreakdown.map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div className="text-xs text-gray-400 mb-1">
                        {formatCurrency(day.amount)}
                      </div>
                      <div 
                        className="w-full bg-gradient-to-t from-green-600 to-emerald-500 rounded-t-lg transition-all duration-300 hover:from-green-500 hover:to-emerald-400"
                        style={{ 
                          height: `${Math.max((day.amount / maxDailyAmount) * 150, 8)}px`,
                          minHeight: '8px'
                        }}
                      />
                      <div className="text-xs text-gray-500 mt-2">
                        {formatDateShort(day.date)}
                      </div>
                      <div className="text-xs text-gray-600">
                        {day.trips} trip
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500">
                  Henüz kazanç verisi yok
                </div>
              )}
            </div>

            {/* Özet İstatistikler */}
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <PieChart className="h-5 w-5 text-purple-400" />
                Performans Özeti
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400">Ort. Günlük Kazanç</span>
                  <span className="font-semibold">
                    {earnings?.dailyBreakdown 
                      ? formatCurrency(earnings.dailyBreakdown.reduce((a, b) => a + b.amount, 0) / 7)
                      : formatCurrency(0)
                    }
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400">Ort. Yolculuk Ücreti</span>
                  <span className="font-semibold">
                    {earnings?.totalTrips 
                      ? formatCurrency(earnings.total / earnings.totalTrips)
                      : formatCurrency(0)
                    }
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400">Tamamlanan Yolculuk</span>
                  <span className="font-semibold text-green-400">
                    {earnings?.totalTrips || 0}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-400">Aktif Gün</span>
                  <span className="font-semibold text-blue-400">
                    {earnings?.dailyBreakdown?.filter(d => d.trips > 0).length || 0} / 7
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Yolculuk Geçmişi */}
        <div className="px-4 mt-6">
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            {/* Filtre Başlık */}
            <div className="p-4 border-b border-gray-700 flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Receipt className="h-5 w-5 text-orange-400" />
                Yolculuk Geçmişi
              </h3>
              
              <div className="flex gap-2">
                {(['today', 'week', 'month', 'all'] as const).map(filter => (
                  <button
                    key={filter}
                    onClick={() => { setTimeFilter(filter); setCurrentPage(1) }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      timeFilter === filter 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {filter === 'today' && 'Bugün'}
                    {filter === 'week' && 'Hafta'}
                    {filter === 'month' && 'Ay'}
                    {filter === 'all' && 'Tümü'}
                  </button>
                ))}
              </div>
            </div>

            {/* Yolculuk Listesi */}
            {filteredTrips.length > 0 ? (
              <>
                <div className="divide-y divide-gray-700">
                  {paginatedTrips.map(trip => (
                    <div key={trip.id} className="p-4 hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Rota */}
                          <div className="flex items-start gap-3 mb-2">
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-3 h-3 rounded-full bg-green-500"></div>
                              <div className="w-0.5 h-8 bg-gray-600"></div>
                              <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <MapPin className="h-4 w-4 text-green-400 flex-shrink-0" />
                                <span className="text-sm truncate">{trip.pickup?.address || 'Alış Noktası'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-red-400 flex-shrink-0" />
                                <span className="text-sm truncate">{trip.dropoff?.address || 'Varış Noktası'}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Meta Bilgiler */}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(trip.completedAt || trip.pickupTime)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Car className="h-3 w-3" />
                              {trip.distanceKm?.toFixed(1) || '-'} km
                            </span>
                            <span className="bg-gray-700 px-2 py-0.5 rounded text-xs">
                              #{trip.reservationCode}
                            </span>
                            {trip.paymentMethod && (
                              <span className={`flex items-center gap-1 ${
                                trip.paymentMethod === 'cash' ? 'text-green-400' : 'text-blue-400'
                              }`}>
                                {trip.paymentMethod === 'cash' ? (
                                  <Banknote className="h-3 w-3" />
                                ) : (
                                  <CreditCard className="h-3 w-3" />
                                )}
                                {trip.paymentMethod === 'cash' ? 'Nakit' : 'Kart'}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Kazanç */}
                        <div className="text-right flex-shrink-0">
                          <div className="text-xl font-bold text-green-400">
                            {formatCurrency(trip.driverFare || 0)}
                          </div>
                          {trip.platformFee && (
                            <div className="text-xs text-gray-500">
                              Komisyon: {formatCurrency(trip.platformFee)}
                            </div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            {trip.passengerCount} yolcu
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Sayfalama */}
                {totalPages > 1 && (
                  <div className="p-4 border-t border-gray-700 flex items-center justify-between">
                    <span className="text-sm text-gray-400">
                      {filteredTrips.length} yolculuktan {(currentPage - 1) * tripsPerPage + 1}-{Math.min(currentPage * tripsPerPage, filteredTrips.length)} gösteriliyor
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="px-3 py-2 text-sm">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-12 text-center text-gray-500">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Bu dönemde tamamlanan yolculuk yok</p>
              </div>
            )}
          </div>
        </div>

        {/* Ödeme Yöntemleri Özeti */}
        <div className="px-4 mt-6">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Nakit Ödemeler */}
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-900/50 flex items-center justify-center">
                  <Banknote className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Nakit Ödemeler</div>
                  <div className="text-xl font-bold text-green-400">
                    {formatCurrency(
                      trips
                        .filter(t => t.paymentMethod === 'cash')
                        .reduce((a, b) => a + (b.driverFare || 0), 0)
                    )}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {trips.filter(t => t.paymentMethod === 'cash').length} yolculuk
              </div>
            </div>

            {/* Kart Ödemeleri */}
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-900/50 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Kart Ödemeleri</div>
                  <div className="text-xl font-bold text-blue-400">
                    {formatCurrency(
                      trips
                        .filter(t => t.paymentMethod === 'card')
                        .reduce((a, b) => a + (b.driverFare || 0), 0)
                    )}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {trips.filter(t => t.paymentMethod === 'card').length} yolculuk
              </div>
            </div>
          </div>
        </div>
      </div>
    </DriverLayout>
  )
}

export default DriverEarnings
