import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export const DriverDocuments = () => {
  const [docs, setDocs] = useState<{ type: string, file?: File }[]>([
    { type: 'license' },
    { type: 'vehicle_registration' },
    { type: 'insurance' },
    { type: 'profile_photo' },
  ])
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Sürücü Dokümanları</h1>
        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          {docs.map((d, i) => (
            <div key={d.type} className="border rounded p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{d.type}</span>
                <span className="text-xs text-gray-500">{d.file ? 'Yüklendi' : 'Eksik'}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <input type="file" onChange={(e)=>{ const f = e.target.files?.[0]; const next = [...docs]; next[i] = { ...next[i], file: f }; setDocs(next) }} />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-end">
            <Button onClick={()=>{ localStorage.setItem('driver_docs', JSON.stringify(docs.map(d=>({ type: d.type, name: d.file?.name })))); }}>Başvuruyu Gönder</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
