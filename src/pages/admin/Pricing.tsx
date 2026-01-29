import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'

type PricingConfig = {
  driverPerKm: number
  platformFeePercent: number
  currency: 'EUR' | 'TRY'
  updatedAt?: string
}

const round2 = (n: number) => Math.round(n * 100) / 100
const sym = (c: string) => (String(c).toUpperCase() === 'TRY' ? '₺' : '€')

export const AdminPricing = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cfg, setCfg] = useState<PricingConfig>({ driverPerKm: 1, platformFeePercent: 3, currency: 'EUR' })

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/pricing')
        const j = await res.json()
        if (res.ok && j.success && j.data) {
          if (alive) setCfg(j.data as PricingConfig)
        }
      } catch {}
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  const derived = useMemo(() => {
    const driverPerKm = Number(cfg.driverPerKm || 0)
    const feePct = Number(cfg.platformFeePercent || 0)
    const customerPerKm = round2(driverPerKm * (1 + feePct / 100))
    return { customerPerKm }
  }, [cfg.driverPerKm, cfg.platformFeePercent])

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="mb-4">
            <Link to="/admin/drivers">
              <Button variant="outline">← Yönetici • Sürücüler</Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Fiyatlandırma</h1>
          <p className="text-sm text-gray-600 mt-1">Tüm sürücüler için km bazlı ücret ve platform payını yönetin.</p>

          {loading ? (
            <div className="mt-6 text-sm text-gray-500">Yükleniyor...</div>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Para birimi</label>
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    value={cfg.currency}
                    onChange={(e) => setCfg(s => ({ ...s, currency: (e.target.value === 'TRY' ? 'TRY' : 'EUR') as any }))}
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="TRY">TRY (₺)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Şoför km ücreti</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    value={cfg.driverPerKm}
                    onChange={(e) => setCfg(s => ({ ...s, driverPerKm: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bizim pay (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    value={cfg.platformFeePercent}
                    onChange={(e) => setCfg(s => ({ ...s, platformFeePercent: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-900 font-semibold">Hesaplama</div>
                <div className="mt-2 text-sm text-blue-800">
                  Müşteri km ücreti: <span className="font-semibold">{sym(cfg.currency)}{derived.customerPerKm.toFixed(2)}</span>
                </div>
                <div className="mt-1 text-xs text-blue-700">
                  Örnek: 10 km → Şoför: {sym(cfg.currency)}{round2(cfg.driverPerKm * 10).toFixed(2)} • Bizim pay: {sym(cfg.currency)}{round2((cfg.driverPerKm * 10) * (cfg.platformFeePercent / 100)).toFixed(2)} • Müşteri: {sym(cfg.currency)}{round2((cfg.driverPerKm * 10) * (1 + cfg.platformFeePercent / 100)).toFixed(2)}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true)
                    try {
                      const res = await fetch('/api/pricing', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
                      const j = await res.json()
                      if (!res.ok || !j.success) throw new Error(j.error || 'save_failed')
                      setCfg(j.data as PricingConfig)
                      toast.success('Kaydedildi')
                    } catch {
                      toast.error('Kaydetme başarısız')
                    } finally {
                      setSaving(false)
                    }
                  }}
                >
                  Kaydet
                </Button>
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={async () => {
                    setLoading(true)
                    try {
                      const res = await fetch('/api/pricing')
                      const j = await res.json()
                      if (res.ok && j.success && j.data) setCfg(j.data as PricingConfig)
                    } catch {}
                    setLoading(false)
                  }}
                >
                  Yenile
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

