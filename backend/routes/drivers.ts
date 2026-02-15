import { Router, type Request, type Response } from 'express'
import crypto from 'crypto'
import { saveDriver, getDriver, listDriversByStatus, approveDriver, rejectDriver, updateDriverPartial, deleteDriver } from '../services/storage.js'
import { diagnoseSupabase } from '../services/storage.js'
import { createBooking, generateReservationCode, getBookingById, updateBooking } from '../services/bookingsStorage.js'
import { getPricingConfig } from '../services/pricingStorage.js'

const router = Router()

type DriverSession = {
  id: string
  name: string
  email?: string
  password?: string
  passwordHash?: string
  passwordSalt?: string
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
  passengerCount?: number
  basePrice?: number
  pickup: { lat: number, lng: number, address: string }
  dropoff: { lat: number, lng: number, address: string }
  vehicleType: 'sedan' | 'suv' | 'van' | 'luxury'
  status: 'pending' | 'accepted' | 'cancelled'
  targetDriverId?: string
  driverId?: string
}

const drivers: Map<string, DriverSession> = new Map()
const requests: Map<string, RideRequest> = new Map()
const complaints: Array<{ id: string, driverId: string, text: string, createdAt: string }> = []
const isValidLatLng = (p: any) => typeof p?.lat === 'number' && typeof p?.lng === 'number' && isFinite(p.lat) && isFinite(p.lng) && p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180
const liveLocationTs: Map<string, number> = new Map()
const lastPersisted: Map<string, { ts: number, loc: { lat: number, lng: number } }> = new Map()
const LOCATION_PERSIST_MIN_INTERVAL_MS = 30_000
const LOCATION_PERSIST_MIN_DISTANCE_M = 100

const haversine = (a: { lat: number, lng: number }, b: { lat: number, lng: number }) => {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const la1 = a.lat * Math.PI / 180
  const la2 = b.lat * Math.PI / 180
  const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const round2 = (n: number) => Math.round(n * 100) / 100

const bboxFilter = (center: { lat: number, lng: number }, radiusMeters: number) => {
  const dLat = (radiusMeters / 111320)
  const dLng = (radiusMeters / (111320 * Math.cos(center.lat * Math.PI / 180)))
  const minLat = center.lat - dLat
  const maxLat = center.lat + dLat
  const minLng = center.lng - dLng
  const maxLng = center.lng + dLng
  return (p: { lat: number, lng: number }) => p.lat >= minLat && p.lat <= maxLat && p.lng >= minLng && p.lng <= maxLng
}

router.post('/register', (req: Request, res: Response) => {
  const { id, name, email, tcid, licenseNumber, vehicleType, vehicleModel, licensePlate, docs, location } = req.body || {}
  if (!id || !name || !email || !vehicleType || !location || !isValidLatLng(location)) {
    res.status(400).json({ success: false, error: 'invalid_payload' })
    return
  }
  const emailNorm = String(email).trim().toLowerCase()
  const d: DriverSession = {
    id,
    name,
    email: emailNorm,
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
  saveDriver(d).catch(()=>{})
  res.json({ success: true, data: d })
})

router.post('/clean-stale-requests', (_req: Request, res: Response) => {
    requests.clear()
    res.json({ success: true, message: 'All stale requests cleared' })
})

router.post('/apply', (req: Request, res: Response) => {
  const { name, email, password, vehicleType, vehicleModel, licensePlate, docs, location } = req.body || {}
  // Konum ZORUNLU - gerçek konum olmadan kayıt yapılamaz
  if (!name || !email || typeof password !== 'string' || password.length < 6 || !vehicleType || !location || !isValidLatLng(location)) {
    res.status(400).json({ success: false, error: 'invalid_payload_location_required' })
    return
  }
  const emailNorm = String(email).trim().toLowerCase()
  const reqDocs = ['license','vehicle_registration','insurance','profile_photo']
  const docsArr = Array.isArray(docs) ? docs : []
  const okDocs = reqDocs.every(n => docsArr.some((d:any)=>d?.name===n && typeof d?.url==='string' && d.url.length>10))
  if (!okDocs) { res.status(400).json({ success: false, error: 'docs_required' }); return }
  const id = 'drv_' + Date.now()
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  const d: DriverSession = {
    id,
    name,
    email: emailNorm,
    passwordHash: hash,
    passwordSalt: salt,
    tcid: 'NA',
    licenseNumber: 'NA',
    vehicleType,
    vehicleModel: vehicleModel || 'Araç',
    licensePlate: licensePlate || '',
    docs: docsArr.map((x:any)=>({ name: x?.name, url: x?.url })),
    location: location, // Sürücünün gerçek konumu
    available: false,
    approved: false,
  }
  drivers.set(id, d)
  try { (req.app.get('io') as any)?.emit('driver:applied', d) } catch {}
  saveDriver(d).catch(()=>{})
  res.json({ success: true, data: d })
})

router.post('/auth', async (req: Request, res: Response) => {
  const { email, password } = req.body || {}
  if (typeof email !== 'string' || typeof password !== 'string') { res.status(400).json({ success: false, error: 'invalid_payload' }); return }
  let found = Array.from(drivers.values()).find(d => d.email === email)
  if (!found) {
    try { found = await (await import('../services/storage.js')).getDriverByEmail(email) || undefined as any } catch {}
  }
  if (!found) {
    const emailNorm = String(email).trim().toLowerCase()
    if ((emailNorm === 'fatih@test.com' || emailNorm === 'vedat@test.com') && password === '123456') {
      const id = emailNorm === 'fatih@test.com' ? 'drv_fatih' : 'drv_vedat'
      const d: DriverSession = {
        id,
        name: emailNorm === 'fatih@test.com' ? 'fatih' : 'vedat',
        email: emailNorm,
        vehicleType: 'sedan',
        vehicleModel: 'Araç',
        licensePlate: '',
        docs: [
          { name: 'license' },
          { name: 'vehicle_registration' },
          { name: 'insurance' },
          { name: 'profile_photo' },
        ],
        location: { lat: 0, lng: 0 }, // Konum yok - sürücü dashboard'tan gönderecek
        available: false, // Konum olmadan müsait olamaz
        approved: true,
        password: '123456',
      }
      drivers.set(id, d)
      saveDriver(d).catch(()=>{})
      found = d
    } else {
      res.status(401).json({ success: false, error: 'invalid_credentials' }); return
    }
  }
  let ok = false
  if (found.passwordHash && found.passwordSalt) {
    try {
      const calc = crypto.scryptSync(password, found.passwordSalt, 64).toString('hex')
      ok = crypto.timingSafeEqual(Buffer.from(calc, 'hex'), Buffer.from(found.passwordHash, 'hex'))
    } catch {}
  } else if (found.password) {
    ok = found.password === password
  }
  if (!ok) { res.status(401).json({ success: false, error: 'invalid_credentials' }); return }
  res.json({
    success: true,
    data: {
      id: found.id,
      name: found.name,
      email: found.email,
      role: 'driver',
      approved: found.approved,
      vehicleType: found.vehicleType,
      location: found.location
    }
  })
})

router.post('/location', (req: Request, res: Response) => {
  const { id, location, available } = req.body || {}
  const d = drivers.get(id)
  if (!d) {
    res.status(404).json({ success: false, error: 'driver_not_found' })
    return
  }
  const now = Date.now()
  const hasLoc = location && isValidLatLng(location)
  if (hasLoc) {
    d.location = location
    liveLocationTs.set(id, now)
  }
  if (typeof available === 'boolean') d.available = available
  drivers.set(id, d)
  try { (req.app.get('io') as any)?.emit('driver:update', d) } catch {}
  if (hasLoc) {
    const prev = lastPersisted.get(id)
    const shouldPersist = !prev
      || now - prev.ts >= LOCATION_PERSIST_MIN_INTERVAL_MS
      || haversine(prev.loc, location) >= LOCATION_PERSIST_MIN_DISTANCE_M
    if (shouldPersist) {
      lastPersisted.set(id, { ts: now, loc: location })
      saveDriver(d).catch(()=>{})
    }
  }
  res.json({ success: true })
})

router.post('/status', (req: Request, res: Response) => {
  const { id, available } = req.body || {}
  const d = drivers.get(id)
  if (!d) { res.status(404).json({ success: false, error: 'driver_not_found' }); return }
  if (!!available && (!d.location || (d.location.lat === 0 && d.location.lng === 0))) {
    res.status(400).json({ success: false, error: 'location_required' })
    return
  }
  d.available = !!available
  drivers.set(id, d)
  saveDriver(d).catch(()=>{})
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
  updateDriverPartial(id, d).catch(()=>{})
  res.json({ success: true, data: d })
})

router.post('/request', async (req: Request, res: Response) => {
  const { id, customerId, passengerCount, basePrice, pickup, dropoff, vehicleType, targetDriverId } = req.body || {}
  if (!id || !customerId || !pickup || !dropoff || !vehicleType || !isValidLatLng(pickup) || !isValidLatLng(dropoff)) {
    res.status(400).json({ success: false, error: 'invalid_payload' })
    return
  }
  const r: RideRequest = {
    id,
    customerId,
    passengerCount: typeof passengerCount === 'number' && isFinite(passengerCount) ? Math.max(1, Math.floor(passengerCount)) : undefined,
    basePrice: typeof basePrice === 'number' && isFinite(basePrice) ? basePrice : undefined,
    pickup,
    dropoff,
    vehicleType,
    status: 'pending',
    targetDriverId: typeof targetDriverId === 'string' && targetDriverId.trim() ? targetDriverId.trim() : undefined,
  }
  requests.set(id, r)
  const preFilter = bboxFilter(pickup, 3000)
  let pool: DriverSession[] = []
  try { pool = await listDriversByStatus('approved') } catch { pool = Array.from(drivers.values()).filter(d=>d.approved) }
  const candidates = pool.filter(d => d.available && d.vehicleType === vehicleType && preFilter(d.location))
  const targeted = r.targetDriverId ? candidates.filter(d => d.id === r.targetDriverId) : candidates
  const sorted = targeted.sort((a, b) => haversine(pickup, a.location) - haversine(pickup, b.location))
  try { 
      const io = req.app.get('io') as any
      // Broadcast to ALL drivers initially, client side filters if it is relevant
      io?.emit('ride:request', r) 
      
      // Also send specifically to target driver if exists
      if (r.targetDriverId) {
         io?.emit(`driver:${r.targetDriverId}:request`, r)
      }
  } catch {}
  res.json({ success: true, data: { request: r, candidates: sorted.slice(0, 10) } })
})

router.get('/requests', (req: Request, res: Response) => {
  const vt = req.query.vehicleType as string
  const list = Array.from(requests.values()).filter(r => r.status === 'pending' && (!vt || r.vehicleType === vt))
  res.json({ success: true, data: list })
})

router.post('/accept', (req: Request, res: Response) => {
  const { driverId, requestId } = req.body || {}
  const r = requests.get(requestId)
  if (!r) {
    res.status(404).json({ success: false, error: 'request_not_found' })
    return
  }
  if (r.targetDriverId && r.targetDriverId !== driverId) {
    res.status(409).json({ success: false, error: 'not_target_driver' })
    return
  }
  ;(async () => {
    r.status = 'accepted'
    r.driverId = driverId
    requests.set(requestId, r)

    const d = drivers.get(driverId)
    if (d) {
      d.available = false
      drivers.set(driverId, d)
      saveDriver(d).catch(() => {})
      try { (req.app.get('io') as any)?.emit('driver:update', d) } catch {}
    }

    let booking = await getBookingById(r.id)
    if (!booking) {
      const now = new Date().toISOString()
      const pricing = await getPricingConfig().catch(() => null)
      const distKm = round2(haversine(r.pickup, r.dropoff) / 1000)
      const driverPerKm = pricing?.driverPerKm ?? 1
      const feePct = pricing?.platformFeePercent ?? 3
      const driverFare = round2(distKm * driverPerKm)
      const total = round2(driverFare * (1 + feePct / 100))
      const reservationCode = await generateReservationCode()
      booking = await createBooking({
        id: r.id,
        reservationCode,
        customerId: r.customerId,
        driverId,
        pickupLocation: { lat: r.pickup.lat, lng: r.pickup.lng, address: r.pickup.address || 'Alış Noktası' },
        dropoffLocation: { lat: r.dropoff.lat, lng: r.dropoff.lng, address: r.dropoff.address || 'Varış Noktası' },
        pickupTime: now,
        passengerCount: r.passengerCount || 1,
        vehicleType: r.vehicleType,
        status: 'accepted',
        basePrice: driverFare,
        finalPrice: total,
        paymentStatus: 'unpaid',
        paymentMethod: undefined,
        paidAt: undefined,
        route: undefined,
        pickedUpAt: undefined,
        completedAt: undefined,
        extras: { pricing: { driverPerKm, platformFeePercent: feePct, distanceKm: distKm, driverFare, platformFee: round2(total - driverFare), total, currency: pricing?.currency || 'EUR' } },
      } as any)
    } else {
      booking = await updateBooking(r.id, { status: 'accepted', driverId } as any)
    }

    try {
      const io = (req.app.get('io') as any)
      io?.emit('booking:update', booking)
      io?.to?.(`booking:${booking.id}`)?.emit?.('booking:update', booking)
      
      // Notify everyone that this request is TAKEN so they can remove it from list
      io?.emit('ride:taken', { requestId: r.id, driverId })
      
      // Also explicitly tell the driver who took it
      io?.emit(`driver:${driverId}:assigned`, booking)
    } catch {}
    res.json({ success: true, data: booking })
  })().catch(() => res.status(500).json({ success: false, error: 'accept_failed' }))
})

router.post('/cancel', (req: Request, res: Response) => {
  const { requestId, customerId } = req.body || {}
  const r = requests.get(requestId)
  if (!r || (customerId && r.customerId !== customerId)) {
    res.status(404).json({ success: false, error: 'request_not_found' })
    return
  }
  if (r.status === 'pending') {
    r.status = 'cancelled'
    requests.set(requestId, r)
    try { (req.app.get('io') as any)?.emit('ride:cancelled', { id: r.id, customerId: r.customerId }) } catch {}
  }
  res.json({ success: true, data: r })
})

router.get('/pending', (_req: Request, res: Response) => {
  listDriversByStatus('pending').then(list => res.json({ success: true, data: list })).catch(()=>res.json({ success: true, data: [] }))
})

router.get('/list', (req: Request, res: Response) => {
  const status = (req.query.status as string) || 'all'
  const st = status === 'approved' || status === 'pending' || status === 'rejected' ? status : 'all'
  listDriversByStatus(st as any).then(list => {
    const now = Date.now()
    const merged = list.map((row: any) => {
      const mem = drivers.get(row.id)
      const ts = liveLocationTs.get(row.id)
      if (mem && ts && now - ts < 2 * 60_000) {
        return { ...row, location: mem.location, available: mem.available }
      }
      return row
    })
    res.json({ success: true, data: merged })
  }).catch(()=>res.json({ success: true, data: [] }))
})

router.get('/diag', async (_req: Request, res: Response) => {
  try {
    const status = await diagnoseSupabase()
    res.json({ success: true, data: status })
  } catch {
    res.json({ success: true, data: { connected: false } })
  }
})

router.post('/approve', (req: Request, res: Response) => {
  const { id } = req.body || {}
  approveDriver(id).then(async () => {
    const d = await getDriver(id)
    if (d) drivers.set(id, d)
    res.json({ success: true, data: d })
  }).catch(()=>res.status(404).json({ success: false, error: 'driver_not_found' }))
})

router.post('/reject', (req: Request, res: Response) => {
  const { id, reason } = req.body || {}
  rejectDriver(id, reason).then(async () => {
    const d = await getDriver(id)
    if (d) drivers.set(id, d)
    res.json({ success: true, data: d })
  }).catch(()=>res.status(404).json({ success: false, error: 'driver_not_found' }))
})

router.post('/delete', (req: Request, res: Response) => {
  const { id } = req.body || {}
  deleteDriver(id).then(() => {
    if (drivers.has(id)) drivers.delete(id)
    res.json({ success: true })
  }).catch(()=>res.status(404).json({ success: false, error: 'driver_not_found' }))
})

router.get('/:id', (req: Request, res: Response) => {
  getDriver(req.params.id).then(d => {
    if (!d) { res.status(404).json({ success: false, error: 'driver_not_found' }); return }
    res.json({ success: true, data: d })
  }).catch(()=>res.status(404).json({ success: false, error: 'driver_not_found' }))
})

router.get('/earnings/:id', async (req: Request, res: Response) => {
  const d = await getDriver(req.params.id)
  if (!d) { res.status(404).json({ success: false, error: 'driver_not_found' }); return }
  const now = new Date()
  // Gerçek veri akışı sağlanana kadar başlangıç değerleri 0 olarak ayarlandı
  const daily = 0
  const weekly = 0
  const monthly = 0
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
