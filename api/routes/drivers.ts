import { Router, type Request, type Response } from 'express'

const router = Router()

type DriverSession = {
  id: string
  name: string
  email?: string
  tcid?: string
  licenseNumber?: string
  vehicleType: 'sedan' | 'suv' | 'van' | 'luxury'
  vehicleModel?: string
  licensePlate?: string
  docs?: Array<{ name: string, url?: string }>
  location: { lat: number, lng: number }
  available: boolean
  approved: boolean
  rejectedReason?: string
}

type RideRequest = {
  id: string
  customerId: string
  pickup: { lat: number, lng: number, address: string }
  dropoff: { lat: number, lng: number, address: string }
  vehicleType: 'sedan' | 'suv' | 'van' | 'luxury'
  status: 'pending' | 'accepted'
  driverId?: string
}

const drivers: Map<string, DriverSession> = new Map()
const requests: Map<string, RideRequest> = new Map()
const complaints: Array<{ id: string, driverId: string, text: string, createdAt: string }> = []

router.post('/register', (req: Request, res: Response) => {
  const { id, name, email, tcid, licenseNumber, vehicleType, vehicleModel, licensePlate, docs, location } = req.body || {}
  if (!id || !name || !vehicleType || !location) {
    res.status(400).json({ success: false, error: 'invalid_payload' })
    return
  }
  const d: DriverSession = {
    id,
    name,
    email,
    tcid: tcid || 'NA',
    licenseNumber: licenseNumber || 'NA',
    vehicleType,
    vehicleModel: vehicleModel || 'Araç',
    licensePlate: licensePlate || '',
    docs: Array.isArray(docs) ? docs : [],
    location,
    available: true,
    approved: id === 'drv_fatih' || id === 'drv_vedat',
  }
  if ((id === 'drv_fatih' || id === 'drv_vedat') && d.docs.length === 0) {
    d.docs = [
      { name: 'license' },
      { name: 'vehicle_registration' },
      { name: 'insurance' },
      { name: 'profile_photo' },
    ]
  }
  drivers.set(id, d)
  res.json({ success: true, data: d })
})

router.post('/location', (req: Request, res: Response) => {
  const { id, location, available } = req.body || {}
  const d = drivers.get(id)
  if (!d) {
    res.status(404).json({ success: false, error: 'driver_not_found' })
    return
  }
  d.location = location || d.location
  if (typeof available === 'boolean') d.available = available
  drivers.set(id, d)
  res.json({ success: true })
})

router.post('/status', (req: Request, res: Response) => {
  const { id, available } = req.body || {}
  const d = drivers.get(id)
  if (!d) { res.status(404).json({ success: false, error: 'driver_not_found' }); return }
  d.available = !!available
  drivers.set(id, d)
  res.json({ success: true, data: d })
})

router.post('/profile', (req: Request, res: Response) => {
  const { id, name, vehicleModel, licensePlate } = req.body || {}
  const d = drivers.get(id)
  if (!d) { res.status(404).json({ success: false, error: 'driver_not_found' }); return }
  if (typeof name === 'string' && name.trim()) d.name = name.trim()
  if (typeof vehicleModel === 'string' && vehicleModel.trim()) d.vehicleModel = vehicleModel.trim()
  if (typeof licensePlate === 'string') d.licensePlate = licensePlate.trim()
  drivers.set(id, d)
  res.json({ success: true, data: d })
})

router.post('/request', (req: Request, res: Response) => {
  const { id, customerId, pickup, dropoff, vehicleType } = req.body || {}
  if (!id || !customerId || !pickup || !dropoff || !vehicleType) {
    res.status(400).json({ success: false, error: 'invalid_payload' })
    return
  }
  const r: RideRequest = { id, customerId, pickup, dropoff, vehicleType, status: 'pending' }
  requests.set(id, r)
  const candidates = Array.from(drivers.values()).filter(d => d.approved && d.available && d.vehicleType === vehicleType)
  const sorted = candidates.sort((a, b) => {
    const da = Math.hypot(a.location.lat - pickup.lat, a.location.lng - pickup.lng)
    const db = Math.hypot(b.location.lat - pickup.lat, b.location.lng - pickup.lng)
    return da - db
  })
  res.json({ success: true, data: { request: r, candidates: sorted.slice(0, 10) } })
})

router.get('/requests', (_req: Request, res: Response) => {
  const list = Array.from(requests.values()).filter(r => r.status === 'pending')
  res.json({ success: true, data: list })
})

router.post('/accept', (req: Request, res: Response) => {
  const { driverId, requestId } = req.body || {}
  const r = requests.get(requestId)
  if (!r) {
    res.status(404).json({ success: false, error: 'request_not_found' })
    return
  }
  r.status = 'accepted'
  r.driverId = driverId
  requests.set(requestId, r)
  res.json({ success: true, data: r })
})

router.get('/pending', (_req: Request, res: Response) => {
  const list = Array.from(drivers.values()).filter(d => !d.approved && !d.rejectedReason)
  res.json({ success: true, data: list })
})

router.get('/list', (req: Request, res: Response) => {
  const status = (req.query.status as string) || 'all'
  let list = Array.from(drivers.values())
  if (status === 'approved') list = list.filter(d => d.approved)
  else if (status === 'pending') list = list.filter(d => !d.approved && !d.rejectedReason)
  else if (status === 'rejected') list = list.filter(d => !!d.rejectedReason)
  res.json({ success: true, data: list })
})

router.post('/approve', (req: Request, res: Response) => {
  const { id } = req.body || {}
  const d = drivers.get(id)
  if (!d) { res.status(404).json({ success: false, error: 'driver_not_found' }); return }
  d.approved = true
  d.rejectedReason = undefined
  drivers.set(id, d)
  res.json({ success: true, data: d })
})

router.post('/reject', (req: Request, res: Response) => {
  const { id, reason } = req.body || {}
  const d = drivers.get(id)
  if (!d) { res.status(404).json({ success: false, error: 'driver_not_found' }); return }
  d.approved = false
  d.rejectedReason = reason || 'unspecified'
  drivers.set(id, d)
  res.json({ success: true, data: d })
})

router.get('/:id', (req: Request, res: Response) => {
  const d = drivers.get(req.params.id)
  if (!d) { res.status(404).json({ success: false, error: 'driver_not_found' }); return }
  res.json({ success: true, data: d })
})

// demo uçları kaldırıldı

router.get('/earnings/:id', (req: Request, res: Response) => {
  const d = drivers.get(req.params.id)
  if (!d) { res.status(404).json({ success: false, error: 'driver_not_found' }); return }
  const now = new Date()
  const daily = 350
  const weekly = 2100
  const monthly = 9000
  res.json({ success: true, data: { driverId: d.id, currency: 'TRY', daily, weekly, monthly, generatedAt: now.toISOString() } })
})

router.post('/complaints', (req: Request, res: Response) => {
  const { driverId, text } = req.body || {}
  if (!driverId || !text) { res.status(400).json({ success: false, error: 'invalid_payload' }); return }
  const id = 'cmp_' + Date.now()
  complaints.push({ id, driverId, text, createdAt: new Date().toISOString() })
  res.json({ success: true })
})

router.get('/complaints', (_req: Request, res: Response) => {
  res.json({ success: true, data: complaints })
})

export default router
