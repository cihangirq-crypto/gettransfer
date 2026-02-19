import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { toast } from 'sonner'
import { 
  DollarSign, TrendingUp, Users, Car, Calendar, BarChart3, 
  Wallet, ArrowUpRight, ArrowDownRight, PieChart,
  RefreshCw, Loader2, ChevronRight, Banknote, CreditCard
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type PlatformAccounting = {
  currency: string
  totalRevenue: number
  totalDriverPayout: number
  totalPlatformRevenue: number
  totalTrips: number
  daily: { revenue: number; platformFee: number }
  weekly: { revenue: number; platformFee: number }
  monthly: { revenue: number; platformFee: number }
  dailyBreakdown: { date: string; revenue: number; platformFee: number; trips: number }[]
  driverSummary: {
    driverId: string
    driverName: string
    totalTrips: number
    totalEarnings: number
    platformFee: number
  }[]
  generatedAt: string
}

const sym = (c: string) => (String(c).toUpperCase() === 'TRY' ? '₺' : '€')

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount) + ' ' + sym(currency)
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short'
  })
}

export const AdminAccounting = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PlatformAccounting | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/drivers/accounting/platform')
      const j = await res.json()
      if (res.ok && j.success) {
        setData(j.data)
      } else {
        toast.error('Muhasebe verileri alınamadı')
      }
    } catch (e) {
      console.error('Failed to fetch accounting:', e)
      toast.error('Bağlantı hatası')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Grafik için max değer
  const maxRevenue = Math.max(...(data?.dailyBreakdown?.map(d => d.revenue) || [1]), 1)

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <Wallet className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-white">Platform Muhasebesi</h1>
              <p className="text-gray-400 text-sm hidden sm:block">Genel gelir gider takibi ve sürücü özetleri</p>
            </div>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Yenile</span>
          </button>
        </div>

        {loading ? (
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-yellow-500 mx-auto mb-3" />
            <p className="text-gray-400">Muhasebe verileri yükleniyor...</p>
          </div>
        ) : (
          <div className="space-y-4 lg:space-y-6">
            {/* Ana Özet Kartları - Mobil: 2x2 Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              {/* Toplam Ciro */}
              <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border border-blue-700/50 rounded-2xl p-4 lg:p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-300 text-xs lg:text-sm">Toplam Ciro</span>
                  <DollarSign className="h-4 w-4 lg:h-5 lg:w-5 text-blue-400" />
                </div>
                <div className="text-lg lg:text-2xl font-bold text-white">
                  {formatCurrency(data?.totalRevenue || 0, data?.currency || 'EUR')}
                </div>
                <div className="text-xs text-blue-400 mt-1 lg:mt-2">
                  {data?.totalTrips || 0} yolculuk
                </div>
              </div>

              {/* Platform Kazancı */}
              <div className="bg-gradient-to-br from-yellow-900/50 to-amber-800/30 border border-yellow-700/50 rounded-2xl p-4 lg:p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-300 text-xs lg:text-sm">Platform</span>
                  <TrendingUp className="h-4 w-4 lg:h-5 lg:w-5 text-yellow-400" />
                </div>
                <div className="text-lg lg:text-2xl font-bold text-yellow-400">
                  {formatCurrency(data?.totalPlatformRevenue || 0, data?.currency || 'EUR')}
                </div>
                <div className="text-xs text-yellow-500 mt-1 lg:mt-2 flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" />
                  Komisyon
                </div>
              </div>

              {/* Sürücü Ödemeleri */}
              <div className="bg-gradient-to-br from-green-900/50 to-emerald-800/30 border border-green-700/50 rounded-2xl p-4 lg:p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-green-300 text-xs lg:text-sm">Sürücüler</span>
                  <Users className="h-4 w-4 lg:h-5 lg:w-5 text-green-400" />
                </div>
                <div className="text-lg lg:text-2xl font-bold text-green-400">
                  {formatCurrency(data?.totalDriverPayout || 0, data?.currency || 'EUR')}
                </div>
                <div className="text-xs text-green-500 mt-1 lg:mt-2 flex items-center gap-1">
                  <ArrowDownRight className="h-3 w-3" />
                  Ödemeler
                </div>
              </div>

              {/* Bu Ay */}
              <div className="bg-gradient-to-br from-purple-900/50 to-violet-800/30 border border-purple-700/50 rounded-2xl p-4 lg:p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-300 text-xs lg:text-sm">Bu Ay</span>
                  <Calendar className="h-4 w-4 lg:h-5 lg:w-5 text-purple-400" />
                </div>
                <div className="text-lg lg:text-2xl font-bold text-purple-400">
                  {formatCurrency(data?.monthly?.revenue || 0, data?.currency || 'EUR')}
                </div>
                <div className="text-xs text-purple-500 mt-1 lg:mt-2">
                  +{formatCurrency(data?.monthly?.platformFee || 0, data?.currency || 'EUR')}
                </div>
              </div>
            </div>

            {/* Dönemsel Özet - Mobil için Yatay Kaydırma */}
            <div className="grid grid-cols-3 gap-3 lg:hidden">
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Bugün</p>
                <p className="text-sm font-bold text-white">
                  {formatCurrency(data?.daily?.revenue || 0, data?.currency || 'EUR')}
                </p>
                <p className="text-xs text-yellow-400 mt-1">
                  +{formatCurrency(data?.daily?.platformFee || 0, data?.currency || 'EUR')}
                </p>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Bu Hafta</p>
                <p className="text-sm font-bold text-white">
                  {formatCurrency(data?.weekly?.revenue || 0, data?.currency || 'EUR')}
                </p>
                <p className="text-xs text-yellow-400 mt-1">
                  +{formatCurrency(data?.weekly?.platformFee || 0, data?.currency || 'EUR')}
                </p>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Bu Ay</p>
                <p className="text-sm font-bold text-white">
                  {formatCurrency(data?.monthly?.revenue || 0, data?.currency || 'EUR')}
                </p>
                <p className="text-xs text-yellow-400 mt-1">
                  +{formatCurrency(data?.monthly?.platformFee || 0, data?.currency || 'EUR')}
                </p>
              </div>
            </div>

            {/* Grafik ve Detay */}
            <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
              {/* Son 7 Gün Grafiği */}
              <div className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-2xl p-4 lg:p-6">
                <h3 className="text-base lg:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-400" />
                  Son 7 Günlük Gelir
                </h3>

                {data?.dailyBreakdown && data.dailyBreakdown.length > 0 ? (
                  <div className="space-y-4">
                    {/* Bar Chart */}
                    <div className="flex items-end justify-between h-40 lg:h-48 gap-2 lg:gap-3">
                      {data.dailyBreakdown.map((day, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center">
                          <div className="text-[10px] lg:text-xs text-gray-400 mb-1">
                            {formatCurrency(day.revenue, data.currency)}
                          </div>
                          <div 
                            className="w-full bg-gradient-to-t from-blue-600 to-cyan-500 rounded-t-lg transition-all duration-300 hover:from-blue-500 hover:to-cyan-400 relative group"
                            style={{ 
                              height: `${Math.max((day.revenue / maxRevenue) * 120, 8)}px`,
                              minHeight: '8px'
                            }}
                          >
                            {/* Tooltip */}
                            <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-gray-900 px-2 py-1.5 rounded-lg text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border border-gray-700 shadow-xl">
                              <div className="text-white font-medium">{formatCurrency(day.revenue, data.currency)}</div>
                              <div className="text-yellow-400">Komisyon: {formatCurrency(day.platformFee, data.currency)}</div>
                              <div className="text-gray-400">{day.trips} yolculuk</div>
                            </div>
                          </div>
                          <div className="text-[10px] lg:text-xs text-gray-500 mt-2">{formatDate(day.date)}</div>
                        </div>
                      ))}
                    </div>

                    {/* Özet - Mobil için daha kompakt */}
                    <div className="grid grid-cols-3 gap-2 lg:gap-4 pt-4 border-t border-gray-700">
                      <div className="text-center">
                        <p className="text-[10px] lg:text-xs text-gray-400">Toplam Ciro</p>
                        <p className="text-sm lg:text-lg font-bold text-white">
                          {formatCurrency(
                            data.dailyBreakdown.reduce((a, b) => a + b.revenue, 0),
                            data.currency
                          )}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] lg:text-xs text-gray-400">Komisyon</p>
                        <p className="text-sm lg:text-lg font-bold text-yellow-400">
                          {formatCurrency(
                            data.dailyBreakdown.reduce((a, b) => a + b.platformFee, 0),
                            data.currency
                          )}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] lg:text-xs text-gray-400">Yolculuk</p>
                        <p className="text-sm lg:text-lg font-bold text-blue-400">
                          {data.dailyBreakdown.reduce((a, b) => a + b.trips, 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-40 lg:h-48 flex items-center justify-center text-gray-500">
                    Henüz veri yok
                  </div>
                )}
              </div>

              {/* Sağ Panel - Masaüstü */}
              <div className="hidden lg:block bg-gray-800 border border-gray-700 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-purple-400" />
                  Dönemsel Özet
                </h3>

                <div className="space-y-4">
                  {/* Bugün */}
                  <div className="bg-gray-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">Bugün</span>
                      <Calendar className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-white">
                        {formatCurrency(data?.daily?.revenue || 0, data?.currency || 'EUR')}
                      </span>
                      <span className="text-sm text-yellow-400">
                        +{formatCurrency(data?.daily?.platformFee || 0, data?.currency || 'EUR')}
                      </span>
                    </div>
                  </div>

                  {/* Bu Hafta */}
                  <div className="bg-gray-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">Bu Hafta</span>
                      <TrendingUp className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-white">
                        {formatCurrency(data?.weekly?.revenue || 0, data?.currency || 'EUR')}
                      </span>
                      <span className="text-sm text-yellow-400">
                        +{formatCurrency(data?.weekly?.platformFee || 0, data?.currency || 'EUR')}
                      </span>
                    </div>
                  </div>

                  {/* Bu Ay */}
                  <div className="bg-gray-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">Bu Ay</span>
                      <BarChart3 className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-white">
                        {formatCurrency(data?.monthly?.revenue || 0, data?.currency || 'EUR')}
                      </span>
                      <span className="text-sm text-yellow-400">
                        +{formatCurrency(data?.monthly?.platformFee || 0, data?.currency || 'EUR')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ödeme Yöntemleri */}
                <div className="mt-6 pt-4 border-t border-gray-700">
                  <h4 className="text-sm font-medium text-gray-300 mb-3">Ödeme Dağılımı</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 p-3 bg-green-900/30 rounded-xl">
                      <Banknote className="h-4 w-4 text-green-400" />
                      <div>
                        <p className="text-xs text-gray-400">Nakit</p>
                        <p className="text-sm font-medium text-green-400">-</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-blue-900/30 rounded-xl">
                      <CreditCard className="h-4 w-4 text-blue-400" />
                      <div>
                        <p className="text-xs text-gray-400">Kart</p>
                        <p className="text-sm font-medium text-blue-400">-</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sürücü Bazlı Muhasebe - Mobil için kart formatı */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-base lg:text-lg font-semibold text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-400" />
                  Sürücü Bazlı Muhasebe
                </h3>
                <button
                  onClick={() => navigate('/admin/drivers')}
                  className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <span className="hidden sm:inline">Sürücülere Git</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {data?.driverSummary && data.driverSummary.length > 0 ? (
                <>
                  {/* Masaüstü Tablo */}
                  <div className="hidden lg:block divide-y divide-gray-700">
                    <div className="grid grid-cols-5 gap-4 px-4 py-3 bg-gray-700/50 text-xs text-gray-400 font-medium">
                      <div>Sürücü</div>
                      <div className="text-center">Yolculuk</div>
                      <div className="text-right">Kazancı</div>
                      <div className="text-right">Komisyon</div>
                      <div className="text-right">İşlemler</div>
                    </div>
                    
                    {data.driverSummary.map((driver) => (
                      <div 
                        key={driver.driverId}
                        className="grid grid-cols-5 gap-4 px-4 py-3 items-center hover:bg-gray-700/30 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-white">{driver.driverName}</p>
                          <p className="text-xs text-gray-500">{driver.driverId}</p>
                        </div>
                        <div className="text-center">
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                            {driver.totalTrips}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-green-400 font-medium">
                            {formatCurrency(driver.totalEarnings, data.currency)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-yellow-400">
                            {formatCurrency(driver.platformFee, data.currency)}
                          </span>
                        </div>
                        <div className="text-right">
                          <button
                            onClick={() => navigate('/admin/drivers')}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            Detay <ChevronRight className="h-3 w-3 inline" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Mobil Kartlar */}
                  <div className="lg:hidden divide-y divide-gray-700">
                    {data.driverSummary.map((driver) => (
                      <div 
                        key={driver.driverId}
                        className="p-4 hover:bg-gray-700/30 transition-colors"
                        onClick={() => navigate('/admin/drivers')}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-sm">
                                {driver.driverName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-white">{driver.driverName}</p>
                              <p className="text-xs text-gray-500">{driver.totalTrips} yolculuk</p>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-gray-500" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-green-500/10 rounded-lg p-2 text-center">
                            <p className="text-xs text-gray-400">Kazancı</p>
                            <p className="text-sm font-bold text-green-400">
                              {formatCurrency(driver.totalEarnings, data.currency)}
                            </p>
                          </div>
                          <div className="bg-yellow-500/10 rounded-lg p-2 text-center">
                            <p className="text-xs text-gray-400">Komisyon</p>
                            <p className="text-sm font-bold text-yellow-400">
                              {formatCurrency(driver.platformFee, data.currency)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Car className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Henüz sürücü verisi yok</p>
                  <p className="text-sm mt-1">Yolculuklar tamamlandıkça burada görünecek</p>
                </div>
              )}
            </div>

            {/* Alt Bilgi */}
            {data?.generatedAt && (
              <p className="text-center text-xs text-gray-500">
                Son güncelleme: {new Date(data.generatedAt).toLocaleString('tr-TR')}
              </p>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

export default AdminAccounting
