import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import OpenStreetMap from '@/components/OpenStreetMap'
import { io as ioClient, type Socket } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'
import { currencySymbol } from '@/utils/pricing'
import { toast } from 'sonner'

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

export const AdminDrivers: React.FC = () => {
  const navigate = useNavigate()
  const [pending, setPending] = useState<any[]>([])
  const [approved, setApproved] = useState<any[]>([])
  const [rejected, setRejected] = useState<any[]>([])
  const [view, setView] = useState<'approved' | 'pending' | 'rejected'>('approved')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null)
  const [detailTab, setDetailTab] = useState<'live' | 'history' | 'docs'>('live')
  const [rejectReason, setRejectReason] = useState('Eksik belge')

  const [bookings, setBookings] = useState<any[]>([])
  const [preview, setPreview] = useState<{ url: string, name: string } | null>(null)
  const [customerLiveLocation, setCustomerLiveLocation] = useState<{ lat: number, lng: number } | null>(null)

  const list = view === 'approved' ? approved : (view === 'pending' ? pending : rejected)

  const refresh = async () => {
    const p = await fetch('/api/drivers/pending').then(r => r.json()).catch(() => ({}))
    const a = await fetch('/api/drivers/list?status=approved').then(r => r.json()).catch(() => ({}))
    const r = await fetch('/api/drivers/list?status=rejected').then(r => r.json()).catch(() => ({}))
    setPending(p?.data || [])
    setApproved(a?.data || [])
    setRejected(r?.data || [])
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
      if (d?.success && d?.data) setSelectedDriver(d.data)
      const b = await fetch(`/api/bookings/by-driver/${selectedId}`).then(r => r.json()).catch(() => null)
      if (b?.success && Array.isArray(b.data)) setBookings(b.data)
    })()
  }, [selectedId])

  const activeBooking = useMemo(() => {
    const b = bookings.find(x => x && x.status !== 'completed' && x.status !== 'cancelled') || null
    return b
  }, [bookings])

  const completedBookings = useMemo(() => {
    return bookings.filter(x => x && x.status === 'completed')
  }, [bookings])

  const socketRef = useRef<Socket | null>(null)
  const bookingSocketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const origin = (import.meta.env.VITE_API_ORIGIN as string) || `http://${window.location.hostname}:3005`
    const s = ioClient(origin, { transports: ['websocket'], reconnection: true })
    socketRef.current = s
    s.on('driver:update', (d: any) => {
      if (!d?.id) return
      setApproved(prev => prev.map(x => x.id === d.id ? { ...x, location: d.location, available: d.available } : x))
      if (selectedDriver?.id === d.id) setSelectedDriver((cur: any) => cur ? { ...cur, location: d.location, available: d.available } : cur)
    })
    s.on('booking:update', (b: any) => {
      if (!b?.id) return
      if (b.driverId && b.driverId === selectedId) {
        setBookings(prev => {
          const exists = prev.some(x => x?.id === b.id)
          return exists ? prev.map(x => x?.id === b.id ? b : x) : [b, ...prev]
        })
      }
    })
    return () => {
      s.disconnect()
      socketRef.current = null
    }
  }, [selectedId, selectedDriver?.id])

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
      setBookings(prev => prev.map(x => x?.id === next.id ? next : x))
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Yönetici • Sürücüler</h1>

        <div className="flex gap-2 mb-4">
          <Button variant={view === 'approved' ? 'primary' : 'outline'} onClick={() => { setView('approved'); setSelectedId(null); setDetailTab('live') }}>Sürücüler</Button>
          <Button variant={view === 'pending' ? 'primary' : 'outline'} onClick={() => { setView('pending'); setSelectedId(null); setDetailTab('docs') }}>Onay Bekleyenler</Button>
          <Button variant={view === 'rejected' ? 'primary' : 'outline'} onClick={() => { setView('rejected'); setSelectedId(null); setDetailTab('docs') }}>Reddedilenler</Button>
          <Button variant="outline" onClick={() => navigate('/admin/pricing')}>Fiyatlandırma</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{view === 'approved' ? 'Onaylı Sürücüler' : (view === 'pending' ? 'Onay Bekleyen Sürücüler' : 'Reddedilen Başvurular')}</h2>
              <Button size="sm" variant="outline" onClick={() => refresh()}>Yenile</Button>
            </div>
            <div className="mt-3 space-y-3">
              {list.map(d => (
                <div
                  key={d.id}
                  className={`border rounded p-3 cursor-pointer ${selectedId === d.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                  onClick={() => {
                    setSelectedId(d.id)
                    setDetailTab(view === 'approved' ? 'live' : 'docs')
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{d.name} • {d.email || '-'}</p>
                      <p className="text-xs text-gray-500">Araç: {d.vehicleType} • Plaka: {d.licensePlate || '-'}</p>
                      {view === 'approved' && d.location && (
                        <p className="text-xs text-gray-500 mt-1">Konum: {Number(d.location.lat).toFixed(5)}, {Number(d.location.lng).toFixed(5)}</p>
                      )}
                    </div>
                    {view === 'pending' && (
                      <div className="mt-1 flex gap-2">
                        <Button
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              const res = await fetch('/api/drivers/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id }) })
                              const j = await res.json().catch(() => null)
                              if (!res.ok || !j?.success) throw new Error(j?.error || 'approve_failed')
                              toast.success('Onaylandı')
                              setSelectedId(null)
                              await refresh()
                              setView('approved')
                            } catch {
                              toast.error('Onaylama başarısız')
                            }
                          }}
                        >
                          Onayla
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              const res = await fetch('/api/drivers/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id, reason: rejectReason }) })
                              const j = await res.json().catch(() => null)
                              if (!res.ok || !j?.success) throw new Error(j?.error || 'reject_failed')
                              toast.success('Reddedildi')
                              setSelectedId(null)
                              await refresh()
                              setView('rejected')
                            } catch {
                              toast.error('Reddetme başarısız')
                            }
                          }}
                        >
                          Reddet
                        </Button>
                      </div>
                    )}
                    {view === 'approved' && (
                      <div className="mt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (!confirm('Bu sürücüyü silmek istediğinize emin misiniz?')) return
                            try {
                              const res = await fetch('/api/drivers/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id }) })
                              const j = await res.json().catch(() => ({}))
                              if (!res.ok || !j?.success) throw new Error(j?.error || 'delete_failed')
                              toast.success('Silindi')
                              setSelectedId(null)
                              refresh()
                            } catch {
                              toast.error('Silme başarısız')
                            }
                          }}
                        >
                          Sil
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {list.length === 0 && <p className="text-sm text-gray-500">Kayıt yok</p>}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-lg font-semibold">Detay</h2>
            {!selectedDriver ? (
              <p className="text-sm text-gray-500 mt-2">Listeden bir kayıt seçin</p>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="flex gap-2">
                  <Button size="sm" variant={detailTab === 'live' ? 'primary' : 'outline'} onClick={() => setDetailTab('live')}>Şu Anki Yolculuk</Button>
                  <Button size="sm" variant={detailTab === 'history' ? 'primary' : 'outline'} onClick={() => setDetailTab('history')}>Geçmiş</Button>
                  <Button size="sm" variant={detailTab === 'docs' ? 'primary' : 'outline'} onClick={() => setDetailTab('docs')}>Evraklar</Button>
                </div>

                <div className="text-sm">
                  <div><span className="font-medium">Ad:</span> {selectedDriver.name}</div>
                  <div><span className="font-medium">E-posta:</span> {selectedDriver.email || '-'}</div>
                  <div><span className="font-medium">Araç:</span> {selectedDriver.vehicleType} • {selectedDriver.vehicleModel || '-'}</div>
                  <div><span className="font-medium">Plaka:</span> {selectedDriver.licensePlate || '-'}</div>
                </div>

                {detailTab === 'live' && (
                  <div className="space-y-3">
                    {!activeBooking ? (
                      <div className="text-sm text-gray-600">Aktif yolculuk yok.</div>
                    ) : (
                      <>
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">Aktif Yolculuk</div>
                          <div className="text-gray-700 mt-1">{activeBooking.pickupLocation?.address} → {activeBooking.dropoffLocation?.address}</div>
                          <div className="text-xs text-gray-500 mt-1">Durum: {activeBooking.status}</div>
                          <div className="text-xs text-gray-600 mt-1">
                            {(() => {
                              const cur = (activeBooking as any)?.extras?.pricing?.currency || 'EUR'
                              const sym = currencySymbol(cur)
                              const driverFare = Number(activeBooking.basePrice || 0)
                              const total = Number(activeBooking.finalPrice ?? activeBooking.basePrice ?? 0)
                              const fee = Math.max(0, total - driverFare)
                              return `Müşteri: ${sym}${total.toFixed(2)} • Şoför: ${sym}${driverFare.toFixed(2)} • Bizim pay: ${sym}${fee.toFixed(2)}`
                            })()}
                          </div>
                          {selectedDriver.location && activeBooking.pickupLocation && (
                            <div className="text-xs text-gray-500 mt-1">
                              Alış mesafe: {Math.round(haversineMeters(selectedDriver.location, activeBooking.pickupLocation))} m
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* ALWAYS SHOW MAP if driver has location, even without active booking */}
                    {selectedDriver.location && (
                      <div className="h-64 w-full rounded border overflow-hidden relative z-0">
                         <OpenStreetMap
                            center={selectedDriver.location}
                            // If no booking, just show driver location as 'customer' (center) and destination as same to render single marker
                            customerLocation={activeBooking?.pickupLocation || selectedDriver.location}
                            destination={activeBooking?.dropoffLocation || selectedDriver.location}
                            drivers={[{ 
                                id: selectedDriver.id, 
                                name: selectedDriver.name, 
                                location: selectedDriver.location, 
                                rating: 0, 
                                available: !!selectedDriver.available 
                            }]}
                            highlightDriverId={selectedDriver.id}
                          />
                      </div>
                    )}
                  </div>
                )}

                {detailTab === 'history' && (
                  <div className="space-y-2">
                    {completedBookings.length === 0 && <div className="text-sm text-gray-600">Tamamlanan yolculuk yok.</div>}
                    {completedBookings.map((b: any) => (
                      <div key={b.id} className="border rounded p-3">
                        <div className="text-sm font-medium">{b.pickupLocation?.address} → {b.dropoffLocation?.address}</div>
                        <div className="text-xs text-gray-500 mt-1">Kod: {b.reservationCode || '-'} • Tarih: {b.pickupTime ? new Date(b.pickupTime).toLocaleString('tr-TR') : '-'}</div>
                        <div className="text-xs text-gray-500 mt-1">Ücret: {b.finalPrice ?? b.basePrice ?? 0} • Durum: {b.status}</div>
                      </div>
                    ))}
                  </div>
                )}

                {detailTab === 'docs' && (
                  <div className="space-y-2">
                    <div className="space-y-2">
                      {Array.isArray(selectedDriver.docs) && selectedDriver.docs.length > 0 ? selectedDriver.docs.map((x: any, i: number) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs">• {x.name}</span>
                          {x.url ? (
                            <>
                              <img src={x.url} alt={x.name} className="h-16 rounded border cursor-zoom-in" onClick={() => setPreview({ url: x.url, name: x.name })} />
                              <a href={x.url} download={`${selectedDriver.id}_${x.name}.${extFromDataUrl(x.url)}`} className="text-blue-600 text-xs hover:underline">indir</a>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">(yok)</span>
                          )}
                        </div>
                      )) : (
                        <div className="text-sm text-gray-600">Belge yok.</div>
                      )}
                    </div>

                    {(view === 'pending' || view === 'rejected') && (
                      <div className="space-y-2 pt-3 border-t">
                        <label className="text-xs text-gray-600">Red nedeni</label>
                        <input className="border rounded px-2 py-1 text-sm w-full" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                        <div className="flex gap-2">
                          {view === 'pending' && (
                            <Button onClick={async () => {
                              try {
                                const res = await fetch('/api/drivers/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedDriver.id }) })
                                const j = await res.json().catch(() => null)
                                if (!res.ok || !j?.success) throw new Error(j?.error || 'approve_failed')
                                toast.success('Onaylandı')
                                setSelectedId(null)
                                await refresh()
                                setView('approved')
                              } catch {
                                toast.error('Onaylama başarısız')
                              }
                            }}>
                              Onayla
                            </Button>
                          )}
                          <Button variant="outline" onClick={async () => {
                            try {
                              const res = await fetch('/api/drivers/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedDriver.id, reason: rejectReason }) })
                              const j = await res.json().catch(() => null)
                              if (!res.ok || !j?.success) throw new Error(j?.error || 'reject_failed')
                              toast.success('Reddedildi')
                              setSelectedId(null)
                              await refresh()
                              setView('rejected')
                            } catch {
                              toast.error('Reddetme başarısız')
                            }
                          }}>
                            Reddet
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {view === 'approved' && (
                  <div className="pt-3 border-t">
                    <Button
                      variant="outline"
                      className="w-full text-red-600 border-red-200 hover:bg-red-50"
                      onClick={async () => {
                        if (!confirm('Bu sürücüyü silmek istediğinize emin misiniz?')) return
                        try {
                          const res = await fetch('/api/drivers/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedDriver.id }) })
                          const j = await res.json().catch(() => ({}))
                          if (!res.ok || !j?.success) throw new Error(j?.error || 'delete_failed')
                          toast.success('Silindi')
                          setSelectedId(null)
                          refresh()
                        } catch {
                          toast.error('Silme başarısız')
                        }
                      }}
                    >
                      Sürücüyü Sil
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-lg shadow-lg p-3 max-w-5xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <img src={preview.url} alt={preview.name} className="w-full h-auto rounded" />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-gray-700">{preview.name}</span>
              <a href={preview.url} download={`belge_${preview.name}.${extFromDataUrl(preview.url)}`} className="text-blue-600 hover:underline">İndir</a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

