import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

export const AdminDrivers: React.FC = () => {
  const [pending, setPending] = useState<any[]>([])
  const [approved, setApproved] = useState<any[]>([])
  const [rejected, setRejected] = useState<any[]>([])
  const refresh = async () => {
    const p = await fetch('/api/drivers/pending').then(r=>r.json()).catch(()=>({}))
    const a = await fetch('/api/drivers/list?status=approved').then(r=>r.json()).catch(()=>({}))
    const r = await fetch('/api/drivers/list?status=rejected').then(r=>r.json()).catch(()=>({}))
    setPending(p?.data||[]); setApproved(a?.data||[]); setRejected(r?.data||[])
  }
  useEffect(()=>{ refresh() },[])
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Yönetici • Sürücü Onay</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-lg font-semibold mb-2">Bekleyen</h2>
            <div className="space-y-3">
              {pending.map(d => (
                <div key={d.id} className="border rounded p-3">
                  <p className="text-sm font-medium">{d.name} • {d.email}</p>
                  <p className="text-xs text-gray-500">Araç: {d.vehicleType} • Plaka: {d.licensePlate||'-'}</p>
                  <div className="mt-2 flex gap-2">
                    <Button onClick={async()=>{ await fetch('/api/drivers/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id})}); refresh() }}>Onayla</Button>
                    <Button variant="outline" onClick={async()=>{ await fetch('/api/drivers/reject',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id,reason:'Eksik belge'})}); refresh() }}>Reddet</Button>
                  </div>
                </div>
              ))}
              {pending.length===0 && <p className="text-sm text-gray-500">Bekleyen sürücü yok</p>}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-lg font-semibold mb-2">Onaylı</h2>
            <div className="space-y-3">
              {approved.map(d => (
                <div key={d.id} className="border rounded p-3">
                  <p className="text-sm font-medium">{d.name} • {d.email}</p>
                  <p className="text-xs text-gray-500">Araç: {d.vehicleType} • Plaka: {d.licensePlate||'-'}</p>
                </div>
              ))}
              {approved.length===0 && <p className="text-sm text-gray-500">Onaylı sürücü yok</p>}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-lg font-semibold mb-2">Reddedilen</h2>
            <div className="space-y-3">
              {rejected.map(d => (
                <div key={d.id} className="border rounded p-3">
                  <p className="text-sm font-medium">{d.name}</p>
                  <p className="text-xs text-red-600">Sebep: {d.rejectedReason}</p>
                </div>
              ))}
              {rejected.length===0 && <p className="text-sm text-gray-500">Reddedilen yok</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
