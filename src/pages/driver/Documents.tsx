import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { DriverLayout } from '@/components/DriverLayout'
import { FileText, Upload, Check, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export const DriverDocuments = () => {
  const [docs, setDocs] = useState<{ type: string, label: string, file?: File }[]>([
    { type: 'license', label: 'Sürücü Belgesi' },
    { type: 'vehicle_registration', label: 'Araç Ruhsatı' },
    { type: 'insurance', label: 'Sigorta Belgesi' },
    { type: 'profile_photo', label: 'Profil Fotoğrafı' },
  ])

  const handleFileChange = (index: number, file?: File) => {
    if (!file) return
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      toast.error('Sadece JPEG, PNG veya PDF yükleyebilirsiniz')
      return
    }
    const next = [...docs]
    next[index] = { ...next[index], file }
    setDocs(next)
    toast.success(`${next[index].label} yüklendi`)
  }

  const handleSubmit = () => {
    const missing = docs.filter(d => !d.file)
    if (missing.length > 0) {
      toast.error(`Eksik belgeler: ${missing.map(m => m.label).join(', ')}`)
      return
    }
    localStorage.setItem('driver_docs', JSON.stringify(docs.map(d => ({ type: d.type, name: d.file?.name }))))
    toast.success('Belgeler kaydedildi')
  }

  return (
    <DriverLayout>
      <div className="min-h-[calc(100vh-56px)] bg-gray-900 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="h-6 w-6 text-green-500" />
              Belgelerim
            </h1>
            <p className="mt-2 text-gray-400">Sürücü belgelerinizi buradan yönetebilirsiniz</p>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 divide-y divide-gray-700">
            {docs.map((doc, index) => (
              <div key={doc.type} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-medium">{doc.label}</span>
                  {doc.file ? (
                    <span className="flex items-center gap-1 text-green-400 text-sm">
                      <Check className="h-4 w-4" />
                      Yüklendi
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-yellow-400 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      Eksik
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={(e) => handleFileChange(index, e.target.files?.[0])}
                    className="hidden"
                    id={`doc-${doc.type}`}
                  />
                  <label
                    htmlFor={`doc-${doc.type}`}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    <span>{doc.file ? 'Değiştir' : 'Yükle'}</span>
                  </label>
                  {doc.file && (
                    <span className="text-sm text-gray-500">{doc.file.name}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <Button
              onClick={handleSubmit}
              className="w-full bg-green-600 hover:bg-green-700 py-3"
            >
              Belgeleri Kaydet
            </Button>
          </div>
        </div>
      </div>
    </DriverLayout>
  )
}

export default DriverDocuments
