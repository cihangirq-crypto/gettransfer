import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import OpenStreetMap from '@/components/OpenStreetMap'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { useDriverStore } from '@/stores/driverStore'
import { useNavigate } from 'react-router-dom'
import { DEFAULT_CENTER } from '@/config/env'

export const DriverApply: React.FC = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', vehicleType: 'sedan', vehicleModel: '', licensePlate: '', lat: 0, lng: 0 })
  const [docs, setDocs] = useState<Record<string, string>>({})
  const [locating, setLocating] = useState(true)
  const requiredDocs = ['license','vehicle_registration','insurance','profile_photo']
  const navigate = useNavigate()
  const { setUser, setTokens } = useAuthStore.getState()
  const { register, refreshApproval } = useDriverStore()

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          setForm(prev => ({ ...prev, lat: p.coords.latitude, lng: p.coords.longitude }))
          setLocating(false)
        },
        () => {
          toast.error('Konum alınamadı, lütfen haritadan seçin')
          setLocating(false)
          // Fallback to default only if GPS fails
          setForm(prev => ({ ...prev, lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng }))
        },
        { enableHighAccuracy: true }
      )
    } else {
      setLocating(false)
    }
  }, [])
  
  const onFile = (name: string, file?: File) => {
    if (!file) return
    const okType = /image\/(jpeg|png)/.test(file.type)
    if (!okType) { toast.error('JPEG/PNG yükleyin'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      if (!dataUrl.startsWith('data:image/')) { toast.error('Görsel okunamadı'); return }
      setDocs(prev => ({ ...prev, [name]: dataUrl }))
      toast.success(`${name} yüklendi`)
    }
    reader.onerror = () => toast.error('Dosya okunamadı')
    reader.readAsDataURL(file)
  }
  const submit = async () => {
    if (!form.name) { toast.error('Ad Soyad gerekli'); return }
    for (const n of requiredDocs) { if (!docs[n]) { toast.error(`Eksik belge: ${n}`); return } }
    try {
      if (!form.email) { toast.error('E-posta gerekli'); return }
      if (!form.password || form.password.length < 6) { toast.error('Şifre en az 6 karakter olmalı'); return }
      const payload = { name: form.name, email: form.email, password: form.password, vehicleType: form.vehicleType, vehicleModel: form.vehicleModel, licensePlate: form.licensePlate, docs: requiredDocs.map(n=>({ name: n, url: docs[n] })), location: { lat: form.lat, lng: form.lng } }
      const res = await fetch('/api/drivers/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json()
      if (!res.ok || !j.success) {
        if (j.error === 'docs_required') throw new Error('Lütfen tüm belgeleri eksiksiz yükleyin')
        if (j.error === 'invalid_payload') throw new Error('Form verileri eksik veya geçersiz (Ad, E-posta, Şifre, Araç Tipi kontrol edin)')
        throw new Error(j.error || 'Başvuru sırasında sunucu hatası oluştu')
      }
      toast.success('Başvurunuz başarıyla alındı, yönetici onayı bekleniyor')
      const driverId = j.data?.id as string
      if (driverId) {
        setUser({ id: driverId, email: form.email, name: form.name || 'Sürücü', phone: '', role: 'driver', isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as any)
        setTokens('mock-token', 'mock-refresh')
        // Gereksiz register API çağrısı kaldırıldı
        navigate('/driver/dashboard')
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Başvuru başarısız') }
  }
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Yeni Sürücü Başvurusu</h1>
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <input className="border rounded-lg px-4 py-3 w-full" placeholder="Ad Soyad" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
          <input className="border rounded-lg px-4 py-3 w-full" placeholder="E-posta" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
          <input className="border rounded-lg px-4 py-3 w-full" placeholder="Şifre (en az 6 karakter)" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select className="border rounded-lg px-4 py-3" value={form.vehicleType} onChange={e=>setForm({...form,vehicleType:e.target.value as any})}>
              <option value="sedan">Sedan</option>
              <option value="suv">SUV</option>
              <option value="van">Van</option>
              <option value="luxury">Lüks</option>
            </select>
            <input className="border rounded-lg px-4 py-3" placeholder="Araç Modeli" value={form.vehicleModel} onChange={e=>setForm({...form,vehicleModel:e.target.value})} />
            <input className="border rounded-lg px-4 py-3" placeholder="Plaka" value={form.licensePlate} onChange={e=>setForm({...form,licensePlate:e.target.value})} />
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-sm text-gray-700 mb-2">Belgeler (JPEG/PNG)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {requiredDocs.map(n => (
                <div key={n} className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">{n}</label>
                  <input type="file" accept="image/jpeg,image/png" onChange={(e)=>onFile(n, e.target.files?.[0])} />
                  {docs[n] && <img src={docs[n]} alt={n} className="h-20 rounded border" />}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 h-64 rounded-lg overflow-hidden border border-gray-200 relative">
            {locating && (
              <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
                <span className="text-sm text-gray-600">Konum alınıyor...</span>
              </div>
            )}
            <OpenStreetMap center={form.lat ? { lat: form.lat, lng: form.lng } : DEFAULT_CENTER} customerLocation={form.lat ? { lat: form.lat, lng: form.lng } : DEFAULT_CENTER} drivers={[]} onMapClick={(loc)=>setForm({...form,lat:loc.lat,lng:loc.lng})} />
          </div>
          <div className="flex justify-end">
            <Button onClick={submit} disabled={locating || !form.lat}>Başvuruyu Gönder</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
