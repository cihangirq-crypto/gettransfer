import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { API } from '@/utils/api'
import { Booking } from '@/types'
import { CalendarClock, MapPin, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/Input'

export const Reservations = () => {
  const { user } = useAuthStore()
  const [items, setItems] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [guestPhone, setGuestPhone] = useState(() => localStorage.getItem('guestPhone') || '')
  const [guestReservationCode, setGuestReservationCode] = useState(() => localStorage.getItem('guestReservationCode') || '')
  const [otp, setOtp] = useState('')
  const [guestToken, setGuestToken] = useState<string | null>(null)
  const [guestBooking, setGuestBooking] = useState<Booking | null>(null)
  const [otpSent, setOtpSent] = useState(false)

  const upcoming = useMemo(() => {
    const now = Date.now()
    return items
      .filter(b => !b.isImmediate && new Date(b.pickupTime).getTime() >= now && b.status !== 'cancelled')
      .sort((a, b) => new Date(a.pickupTime).getTime() - new Date(b.pickupTime).getTime())
  }, [items])

  const past = useMemo(() => {
    const now = Date.now()
    return items
      .filter(b => !b.isImmediate && (new Date(b.pickupTime).getTime() < now || b.status === 'cancelled'))
      .sort((a, b) => new Date(b.pickupTime).getTime() - new Date(a.pickupTime).getTime())
  }, [items])

  const refresh = async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/bookings/by-customer/${user.id}`)
      const j = await res.json()
      if (res.ok && j.success && Array.isArray(j.data)) setItems(j.data as Booking[])
      else setItems([])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh().catch(() => {}) }, [user?.id])

  const cancel = async (id: string) => {
    if (!confirm('Rezervasyonu iptal etmek istiyor musunuz?')) return
    try {
      const res = await fetch(`${API}/bookings/${id}/cancel`, { method: 'POST' })
      const j = await res.json()
      if (res.ok && j.success) {
        toast.success('Rezervasyon iptal edildi')
        refresh().catch(() => {})
      } else {
        toast.error('İptal edilemedi')
      }
    } catch {
      toast.error('İptal edilemedi')
    }
  }

  const Card = ({ b, canCancel }: { b: Booking, canCancel: boolean }) => (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{b.pickupLocation.address}</div>
          <div className="text-sm text-gray-600 truncate">→ {b.dropoffLocation.address}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-50 border">
              <CalendarClock className="h-3.5 w-3.5" />
              {new Date(b.pickupTime).toLocaleString('tr-TR')}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-50 border">
              <MapPin className="h-3.5 w-3.5" />
              {b.vehicleType} • {b.passengerCount} kişi
            </span>
            {b.flightNumber && <span className="inline-flex items-center px-2 py-1 rounded bg-gray-50 border">Uçuş: {b.flightNumber}</span>}
            {b.returnTrip?.enabled && <span className="inline-flex items-center px-2 py-1 rounded bg-gray-50 border">Dönüş</span>}
          </div>
          <div className="mt-2 text-xs text-gray-500">Durum: {b.status}</div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {canCancel && (
            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => cancel(b.id)}>
              <XCircle className="h-4 w-4 mr-1" />
              İptal
            </Button>
          )}
          <Link to={`/booking/${b.id}`}>
            <Button size="sm" variant="outline">Detay</Button>
          </Link>
        </div>
      </div>
    </div>
  )

  useEffect(() => {
    try { localStorage.setItem('guestPhone', guestPhone) } catch {}
  }, [guestPhone])

  useEffect(() => {
    try { localStorage.setItem('guestReservationCode', guestReservationCode) } catch {}
  }, [guestReservationCode])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('guestOtpToken')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!parsed?.token || !parsed?.exp) return
      if (Date.now() > parsed.exp) { sessionStorage.removeItem('guestOtpToken'); return }
      setGuestToken(parsed.token)
    } catch {}
  }, [])

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Rezervasyonlar</h1>
            <p className="text-gray-600">Telefon doğrulaması ile rezervasyonunuzu görüntüleyebilirsiniz.</p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="+90 5xx xxx xx xx" label="Telefon" />
              <Input value={guestReservationCode} onChange={(e) => setGuestReservationCode(e.target.value.toUpperCase())} placeholder="Rezervasyon Kodu" label="Rezervasyon Kodu" />
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const res = await fetch(`${API}/otp/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: guestPhone }) })
                    const j = await res.json()
                    if (!res.ok || !j.success) {
                      const code = j?.error
                      if (code === 'trial_verified_only' || code === 'recipient_not_verified') {
                        toast.error('Twilio deneme hesabında sadece doğrulanmış numaralara SMS gider.')
                        return
                      }
                      if (code === 'geo_permission') {
                        toast.error('SMS gönderimi için ülke izni kapalı görünüyor.')
                        return
                      }
                      throw new Error(code || 'otp_send_failed')
                    }
                    setOtpSent(true)
                    toast.success('SMS kodu gönderildi')
                  } catch {
                    toast.error('SMS gönderilemedi')
                  }
                }}
                disabled={!guestPhone || guestPhone.trim().length < 7}
              >
                SMS Kod Gönder
              </Button>
              <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="SMS Kodu" label="SMS Kodu" />
              <Button
                onClick={async () => {
                  try {
                    const vr = await fetch(`${API}/otp/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: guestPhone, code: otp }) })
                    const vj = await vr.json()
                    if (!vr.ok || !vj.success) {
                      const code = vj?.error
                      if (code === 'invalid_code') { toast.error('SMS kodu hatalı'); return }
                      if (code === 'trial_verified_only' || code === 'recipient_not_verified') {
                        toast.error('Twilio deneme hesabında sadece doğrulanmış numaralara SMS gider.')
                        return
                      }
                      throw new Error(code || 'otp_verify_failed')
                    }
                    const token = vj?.data?.guestToken as string
                    setGuestToken(token)
                    try { sessionStorage.setItem('guestOtpToken', JSON.stringify({ token, exp: Date.now() + 20 * 60_000 })) } catch {}
                    const br = await fetch(`${API}/bookings/lookup`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Guest-Token': token }, body: JSON.stringify({ phone: guestPhone, reservationCode: guestReservationCode }) })
                    const bj = await br.json()
                    if (!br.ok || !bj.success) throw new Error(bj.error || 'booking_lookup_failed')
                    setGuestBooking(bj.data as Booking)
                    toast.success('Rezervasyon bulundu')
                  } catch {
                    toast.error('Doğrulama veya rezervasyon bulma başarısız')
                  }
                }}
                disabled={!otpSent || !otp || !guestReservationCode}
              >
                Rezervasyonu Görüntüle
              </Button>
            </div>

            {guestToken && !guestBooking && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const br = await fetch(`${API}/bookings/lookup`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Guest-Token': guestToken }, body: JSON.stringify({ phone: guestPhone, reservationCode: guestReservationCode }) })
                      const bj = await br.json()
                      if (!br.ok || !bj.success) throw new Error(bj.error || 'booking_lookup_failed')
                      setGuestBooking(bj.data as Booking)
                      toast.success('Rezervasyon bulundu')
                    } catch {
                      toast.error('Rezervasyon bulunamadı')
                    }
                  }}
                  disabled={!guestPhone || !guestReservationCode}
                >
                  Tekrar SMS Girmeden Sorgula
                </Button>
              </div>
            )}

            {guestBooking && (
              <div className="mt-6 bg-gray-50 border rounded-lg p-4">
                <div className="text-sm font-semibold text-gray-900">Rezervasyon</div>
                <div className="text-sm text-gray-700 mt-1">{guestBooking.pickupLocation.address}</div>
                <div className="text-sm text-gray-600">→ {guestBooking.dropoffLocation.address}</div>
                <div className="text-xs text-gray-500 mt-2">
                  {new Date(guestBooking.pickupTime).toLocaleString('tr-TR')} • {guestBooking.vehicleType} • {guestBooking.passengerCount} kişi
                </div>
                <div className="text-xs text-gray-500 mt-1">Kod: {guestBooking.reservationCode || '-'}</div>
              </div>
            )}

            <div className="mt-6 border-t pt-4">
              <p className="text-sm text-gray-600">İsterseniz işlemlerinizi kaydetmek için giriş yapabilirsiniz.</p>
              <div className="mt-3 flex gap-2">
                <Link to="/login"><Button variant="outline">Giriş Yap</Button></Link>
                <Link to="/reserve"><Button>Yeni Rezervasyon</Button></Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rezervasyonlar</h1>
            <p className="text-gray-600">Planlı yolculuklarınızı buradan yönetebilirsiniz.</p>
          </div>
          <Link to="/reserve">
            <Button>Yeni Rezervasyon</Button>
          </Link>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Yaklaşan</h2>
            {loading && <div className="text-sm text-gray-500">Yükleniyor...</div>}
            {!loading && upcoming.length === 0 && <div className="text-sm text-gray-500">Yaklaşan rezervasyon yok.</div>}
            <div className="space-y-3">
              {upcoming.map(b => <Card key={b.id} b={b} canCancel={b.status === 'pending' || b.status === 'accepted'} />)}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Geçmiş</h2>
            {!loading && past.length === 0 && <div className="text-sm text-gray-500">Geçmiş rezervasyon yok.</div>}
            <div className="space-y-3">
              {past.map(b => <Card key={b.id} b={b} canCancel={false} />)}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

