import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import OpenStreetMap from '@/components/OpenStreetMap'

export const AdminDrivers: React.FC = () => {
  const [pending, setPending] = useState<any[]>([])
  const [approved, setApproved] = useState<any[]>([])
  const [rejected, setRejected] = useState<any[]>([])
  const [view, setView] = useState<'drivers'|'applications'>('drivers')
  const [appsTab, setAppsTab] = useState<'pending'|'rejected'>('pending')
  const [selected, setSelected] = useState<any|null>(null)
  const [rejectReason, setRejectReason] = useState('Eksik belge')
  const [preview, setPreview] = useState<{ url: string, name: string } | null>(null)
  const extFromDataUrl = (u: string) => (u||'').startsWith('data:image/png') ? 'png' : 'jpg'
  const refresh = async () => {
    const p = await fetch('/api/drivers/pending').then(r=>r.json()).catch(()=>({}))
    const a = await fetch('/api/drivers/list?status=approved').then(r=>r.json()).catch(()=>({}))
    const r = await fetch('/api/drivers/list?status=rejected').then(r=>r.json()).catch(()=>({}))
    setPending(p?.data||[]); setApproved(a?.data||[]); setRejected(r?.data||[])
  }
  useEffect(()=>{ refresh() },[])
  const list = view==='drivers' ? approved : (appsTab==='pending' ? pending : rejected)
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Yönetici • Sürücüler</h1>
        <div className="flex gap-2 mb-4">
          <Button variant={view==='drivers'?'primary':'outline'} onClick={()=>{ setView('drivers'); setSelected(null) }}>Sürücüler</Button>
          <Button variant={view==='applications'?'primary':'outline'} onClick={()=>{ setView('applications'); setSelected(null) }}>Yeni Sürücüler</Button>
          {view==='applications' && (
            <div className="ml-4 flex gap-2">
              <Button variant={appsTab==='pending'?'primary':'outline'} onClick={()=>{ setAppsTab('pending'); setSelected(null) }}>Başvurular</Button>
              <Button variant={appsTab==='rejected'?'primary':'outline'} onClick={()=>{ setAppsTab('rejected'); setSelected(null) }}>Reddedilenler</Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-4 lg:col-span-2">
            <h2 className="text-lg font-semibold mb-2">{view==='drivers'?'Onaylı Sürücüler':(appsTab==='pending'?'Bekleyen Başvurular':'Reddedilen Başvurular')}</h2>
            <div className="space-y-3">
              {list.map(d => (
                <div key={d.id} className={`border rounded p-3 cursor-pointer ${selected?.id===d.id?'border-blue-500 bg-blue-50':'border-gray-200 hover:border-blue-300'}`} onClick={()=>setSelected(d)}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{d.name} • {d.email||'-'}</p>
                      <p className="text-xs text-gray-500">Araç: {d.vehicleType} • Plaka: {d.licensePlate||'-'}</p>
                      {Array.isArray(d.docs) && d.docs.length>0 && (
                        <div className="mt-2">
                          <div className="flex flex-wrap gap-2 items-center">
                            {d.docs.map((x:any,i:number)=> (
                              x.url ? (
                                <img key={i} src={x.url} alt={x.name} className="h-10 w-auto rounded border cursor-zoom-in" onClick={(e)=>{ e.stopPropagation(); setPreview({ url: x.url, name: x.name }) }} />
                              ) : (
                                <span className="text-xs text-gray-600">{x.name}</span>
                              )
                            ))}
                          </div>
                          <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={(e)=>{ e.stopPropagation(); setSelected(d) }}>Belgeleri Görüntüle</Button>
                        </div>
                      )}
                    </div>
                    {view==='applications' && appsTab==='pending' && (
                      <div className="mt-2 flex gap-2">
                        <Button onClick={async()=>{ await fetch('/api/drivers/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id})}); setSelected(null); refresh() }}>Onayla</Button>
                        <Button variant="outline" onClick={async()=>{ await fetch('/api/drivers/reject',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id,reason:rejectReason})}); setSelected(null); refresh() }}>Reddet</Button>
                      </div>
                    )}
                    {view==='drivers' && (
                      <div className="mt-2">
                        <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={async(e)=>{ e.stopPropagation(); if(confirm('Bu sürücüyü silmek istediğinize emin misiniz?')) { await fetch('/api/drivers/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id})}); setSelected(null); refresh() } }}>Sil</Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {list.length===0 && <p className="text-sm text-gray-500">Kayıt yok</p>}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-lg font-semibold mb-2">Detay</h2>
            {!selected ? (
              <p className="text-sm text-gray-500">Listeden bir kayıt seçin</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm"><span className="font-medium">Ad:</span> {selected.name}</p>
                <p className="text-sm"><span className="font-medium">E-posta:</span> {selected.email||'-'}</p>
                <p className="text-sm"><span className="font-medium">Araç:</span> {selected.vehicleType} • {selected.vehicleModel||'-'}</p>
                <p className="text-sm"><span className="font-medium">Plaka:</span> {selected.licensePlate||'-'}</p>
                {selected.location && (
                  <div className="mt-3">
                    <p className="text-sm font-medium mb-1">Konum</p>
                    <div className="h-48 rounded border overflow-hidden">
                      <OpenStreetMap center={selected.location} customerLocation={selected.location} drivers={[]} />
                    </div>
                  </div>
                )}
                {Array.isArray(selected.docs) && selected.docs.length>0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Belgeler</p>
                    <div className="space-y-2">
                      {selected.docs.map((x:any,i:number)=> (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs">• {x.name}</span>
                          {x.url ? (
                            <>
                              <img src={x.url} alt={x.name} className="h-16 rounded border cursor-zoom-in" onClick={()=>setPreview({ url: x.url, name: x.name })} />
                              <a href={x.url} download={`${selected.id}_${x.name}.${extFromDataUrl(x.url)}`} className="text-blue-600 text-xs hover:underline">indir</a>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">(yok)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {view==='applications' && (
                  <div className="space-y-2">
                    <label className="text-xs text-gray-600">Red nedeni</label>
                    <input className="border rounded px-2 py-1 text-sm w-full" value={rejectReason} onChange={e=>setRejectReason(e.target.value)} />
                    <div className="flex gap-2">
                      {appsTab==='pending' && <Button onClick={async()=>{ await fetch('/api/drivers/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selected.id})}); setSelected(null); refresh() }}>Onayla</Button>}
                      <Button variant="outline" onClick={async()=>{ await fetch('/api/drivers/reject',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selected.id,reason:rejectReason})}); setSelected(null); refresh() }}>Reddet</Button>
                    </div>
                  </div>
                )}
                {view==='drivers' && (
                  <div className="mt-4 pt-4 border-t">
                    <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={async()=>{ if(confirm('Bu sürücüyü silmek istediğinize emin misiniz?')) { await fetch('/api/drivers/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selected.id})}); setSelected(null); refresh() } }}>Sürücüyü Sil</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={()=>setPreview(null)}>
          <div className="bg-white rounded-lg shadow-lg p-3 max-w-5xl w-full mx-4" onClick={(e)=>e.stopPropagation()}>
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
