import type { VercelRequest, VercelResponse } from '@vercel/node'

const popular: Map<string, number> = new Map()
const norm = (s: string) => s.toLowerCase().replace(/ı/g, 'i').replace(/\s+/g, ' ').trim()
const isAirport = (cls: string, type: string, name: string) => {
  const c = cls.toLowerCase(), t = type.toLowerCase(), n = norm(name)
  return c === 'aeroway' || t === 'aerodrome' || t === 'terminal' || /hava ?alan|airport/.test(n)
}
const haversine = (a: { lat: number, lng: number }, b: { lat: number, lng: number }) => {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const la1 = a.lat * Math.PI / 180
  const la2 = b.lat * Math.PI / 180
  const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const qRaw = (req.query.q as string || '').trim()
    const lat = parseFloat(req.query.lat as string)
    const lng = parseFloat(req.query.lng as string)
    const limit = Math.min(20, Math.max(5, parseInt(req.query.limit as string || '10')))
    if (!qRaw) { res.status(200).json({ success: true, data: [] }); return }
    const q = qRaw
    let bbox = ''
    if (!isNaN(lat) && !isNaN(lng)) {
      const dLat = 0.35, dLng = 0.35
      const left = (lng - dLng).toFixed(6)
      const right = (lng + dLng).toFixed(6)
      const top = (lat + dLat).toFixed(6)
      const bottom = (lat - dLat).toFixed(6)
      bbox = `&viewbox=${left},${top},${right},${bottom}&bounded=1`
    }
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&namedetails=1&extratags=1&limit=${limit}${bbox}&q=${encodeURIComponent(q)}`
    const r = await fetch(url, { headers: { 'User-Agent': 'gettransfer-app/1.0', 'Accept-Language': 'tr' } as any })
    if (!r.ok) { res.status(502).json({ success: false, error: 'geocoding_failed' }); return }
    const arr: any[] = await r.json()
    const suggestions = arr.map((it: any) => {
      const label: string = it.display_name
      const latN = parseFloat(it.lat), lngN = parseFloat(it.lon)
      const category = isAirport(it.class || '', it.type || '', label) ? 'airport' : 'address'
      let score = 0
      const nq = norm(q), nl = norm(label)
      if (nl === nq) score += 5
      if (nl.startsWith(nq)) score += 3
      if (nl.includes(nq)) score += 1
      const freq = popular.get(label) || 0
      score += Math.min(3, freq)
      if (!isNaN(lat) && !isNaN(lng)) {
        const dist = haversine({ lat, lng }, { lat: latN, lng: lngN })
        const proximity = Math.max(0, 1 - Math.min(dist, 50000) / 50000)
        score += proximity * 3
      }
      return { label, lat: latN, lng: lngN, category, score }
    }).sort((a: any, b: any) => b.score - a.score)
    res.status(200).json({ success: true, data: suggestions })
  } catch (e) { res.status(500).json({ success: false, error: 'server_error' }) }
}
