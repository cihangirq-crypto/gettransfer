import { Router, type Request, type Response } from 'express'
import crypto from 'crypto'
import { saveDriver, getDriver, listDriversByStatus, approveDriver, rejectDriver, updateDriverPartial, deleteDriver } from '../services/storage.js'
import { diagnoseSupabase } from '../services/storage.js'
import { createBooking, generateReservationCode, getBookingById, updateBooking, listPendingBookings } from '../services/bookingsStorage.js'
import { getPricingConfig } from '../services/pricingStorage.js'

const router = Router()

type DriverDoc = {
  name: string
  url?: string
  uploadedAt?: string
  status?: 'pending' | 'approved' | 'rejected'
  rejectReason?: string
}

type DriverSession = {
  id: string
  name: string
  email?: string
  phone?: string
  address?: string
  password?: string
  passwordHash?: string
  passwordSalt?: string
  tcid?: string
  licenseNumber?: string
  vehicleType: 'sedan' | 'suv' | 'van' | 'luxury'
  vehicleModel?: string
  licensePlate?: string
  docs?: DriverDoc[]
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
// Konum doğrulama - (0,0) geçersiz sayılır (Afrika açıkları)
const isValidLatLng = (p: any) => {
  if (typeof p?.lat !== 'number' || typeof p?.lng !== 'number') return false
  if (!isFinite(p.lat) || !isFinite(p.lng)) return false
  if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) return false
  // (0, 0) koordinatları geçersiz - hiçbir sürücü Afrika açıklarında olamaz
  if (p.lat === 0 && p.lng === 0) return false
  return true
}
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

router.post('/apply', async (req: Request, res: Response) => {
  const { name, email, password, phone, address, vehicleType, vehicleModel, licensePlate, docs, location } = req.body || {}
  // Konum ZORUNLU - gerçek konum olmadan kayıt yapılamaz
  if (!name || !email || typeof password !== 'string' || password.length < 6 || !phone || !address || !vehicleType || !location || !isValidLatLng(location)) {
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
    phone: String(phone).trim(),
    address: String(address).trim(),
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
  
  // Veritabanına kaydet - hata durumunda logla ama devam et
  try {
    await saveDriver(d)
    console.log('Driver saved to database:', id)
  } catch (e) {
    console.error('Failed to save driver:', id, e)
  }
  
  // Admin'e bildir
  try { (req.app.get('io') as any)?.emit('driver:applied', d) } catch {}
  
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
      const isFatih = emailNorm === 'fatih@test.com'
      const id = isFatih ? 'drv_fatih' : 'drv_vedat'
      
      // Gerçekçi örnek veriler
      const sampleData = isFatih ? {
        name: 'Fatih Yılmaz',
        phone: '0532 555 12 34',
        address: 'Kadıköy Mahallesi, Bağdat Caddesi No: 45, Kadıköy/İstanbul',
        vehicleModel: 'Toyota Corolla 2022',
        licensePlate: '34 ABC 123',
        vehicleType: 'sedan' as const,
        docs: [
          { name: 'license', url: 'https://placehold.co/400x300/1e40af/white?text=Suru+cu+Belgesi%0AFatih+Yilmaz%0AB+Sinifi', uploadedAt: '2024-01-15T10:00:00Z', status: 'approved' as const },
          { name: 'vehicle_registration', url: 'https://placehold.co/400x300/166534/white?text=Ruhsat%0A34+ABC+123%0AToyota+Corolla', uploadedAt: '2024-01-15T10:05:00Z', status: 'approved' as const },
          { name: 'insurance', url: 'https://placehold.co/400x300/7c3aed/white?text=Sigorta+Poli%E7esi%0ATrafik+Sigortasi%0A2024-2025', uploadedAt: '2024-01-15T10:10:00Z', status: 'approved' as const },
          { name: 'profile_photo', url: 'https://placehold.co/400x400/374151/white?text=Fatih%0AYilmaz%0AProfil+Foto', uploadedAt: '2024-01-15T10:15:00Z', status: 'approved' as const },
        ]
      } : {
        name: 'Vedat Demir',
        phone: '0533 666 78 90',
        address: 'Beşiktaş Mahallesi, Barbaros Bulvarı No: 78, Beşiktaş/İstanbul',
        vehicleModel: 'Mercedes E-Class 2023',
        licensePlate: '34 XYZ 456',
        vehicleType: 'luxury' as const,
        docs: [
          { name: 'license', url: 'https://placehold.co/400x300/1e40af/white?text=Suru+cu+Belgesi%0AVedat+Demir%0AB+Sinifi', uploadedAt: '2024-02-01T09:00:00Z', status: 'approved' as const },
          { name: 'vehicle_registration', url: 'https://placehold.co/400x300/166534/white?text=Ruhsat%0A34+XYZ+456%0AMercedes+E200', uploadedAt: '2024-02-01T09:05:00Z', status: 'approved' as const },
          { name: 'insurance', url: 'https://placehold.co/400x300/7c3aed/white?text=Sigorta+Poli%E7esi%0ATrafik+Sigortasi%0A2024-2025', uploadedAt: '2024-02-01T09:10:00Z', status: 'approved' as const },
          { name: 'profile_photo', url: 'https://placehold.co/400x400/374151/white?text=Vedat%0ADemir%0AProfil+Foto', uploadedAt: '2024-02-01T09:15:00Z', status: 'approved' as const },
        ]
      }
      
      const d: DriverSession = {
        id,
        name: sampleData.name,
        email: emailNorm,
        phone: sampleData.phone,
        address: sampleData.address,
        vehicleType: sampleData.vehicleType,
        vehicleModel: sampleData.vehicleModel,
        licensePlate: sampleData.licensePlate,
        docs: sampleData.docs,
        location: { lat: isFatih ? 40.9819 : 41.0421, lng: isFatih ? 29.0267 : 29.0093 }, // Kadıköy / Beşiktaş
        available: false,
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
      phone: found.phone,
      address: found.address,
      role: 'driver',
      approved: found.approved,
      vehicleType: found.vehicleType,
      vehicleModel: found.vehicleModel,
      licensePlate: found.licensePlate,
      location: found.location,
      available: found.available ?? false
    }
  })
})

router.post('/location', async (req: Request, res: Response) => {
  const { id, location, available } = req.body || {}
  let d = drivers.get(id)
  
  // Sürücü bellekte yoksa veritabanından yükle
  if (!d) {
    try {
      d = await getDriver(id) as DriverSession | undefined
      if (d) drivers.set(id, d)
    } catch {}
  }
  
  if (!d) {
    res.status(404).json({ success: false, error: 'driver_not_found' })
    return
  }
  const now = Date.now()
  const hasLoc = location && isValidLatLng(location)
  
  // GERÇEK GPS konumunu kaydet
  if (hasLoc) {
    d.location = location
    liveLocationTs.set(id, now)
    console.log('📍 Sürücü konumu güncellendi:', id, location)
  }
  
  if (typeof available === 'boolean') d.available = available
  drivers.set(id, d)
  
  // SERVERLESS: Socket.io çalışmayabilir, ama yine de dene
  try { (req.app.get('io') as any)?.emit('driver:update', d) } catch {}
  
  // SERVERLESS: Her konum güncellemesini ANINDA veritabanına yaz
  if (hasLoc || typeof available === 'boolean') {
    try { await saveDriver(d) } catch {}
  }
  
  res.json({ success: true, location: d.location, available: d.available })
})

router.post('/status', async (req: Request, res: Response) => {
  const { id, available } = req.body || {}
  let d = drivers.get(id)
  
  // Sürücü bellekte yoksa veritabanından yükle
  if (!d) {
    try {
      d = await getDriver(id) as DriverSession | undefined
      if (d) drivers.set(id, d)
    } catch {}
  }
  
  if (!d) { res.status(404).json({ success: false, error: 'driver_not_found' }); return }
  if (!!available && (!d.location || (d.location.lat === 0 && d.location.lng === 0))) {
    res.status(400).json({ success: false, error: 'location_required' })
    return
  }
  d.available = !!available
  drivers.set(id, d)
  
  // SERVERLESS: Her durum değişikliğini ANINDA veritabanına yaz
  try { await saveDriver(d) } catch {}
  
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

// Sürücüye özel fiyatlandırma
router.post('/pricing', async (req: Request, res: Response) => {
  const { id, driverPerKm, platformFeePercent, customPricing } = req.body || {}
  
  let d = drivers.get(id)
  if (!d) {
    try {
      d = await getDriver(id) as DriverSession | undefined
      if (d) drivers.set(id, d)
    } catch {}
  }
  
  if (!d) { res.status(404).json({ success: false, error: 'driver_not_found' }); return }
  
  // Store pricing info in driver object
  const updatedDriver = {
    ...d,
    driverPerKm: typeof driverPerKm === 'number' ? driverPerKm : undefined,
    platformFeePercent: typeof platformFeePercent === 'number' ? platformFeePercent : undefined,
    customPricing: !!customPricing
  } as any
  
  drivers.set(id, updatedDriver)
  
  // Also save to database with pricing fields
  try {
    const updateData: any = {}
    if (typeof driverPerKm === 'number') updateData.driver_per_km = driverPerKm
    if (typeof platformFeePercent === 'number') updateData.platform_fee_percent = platformFeePercent
    updateData.custom_pricing = !!customPricing
    
    // Update in Supabase
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    
    if (SUPABASE_URL && SUPABASE_KEY) {
      await fetch(`${SUPABASE_URL}/rest/v1/drivers?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      })
    }
  } catch {}
  
  res.json({ success: true, data: updatedDriver })
})

router.post('/request', async (req: Request, res: Response) => {
  const { id, customerId, passengerCount, basePrice, pickup, dropoff, vehicleType, targetDriverId } = req.body || {}
  if (!id || !customerId || !pickup || !dropoff || !vehicleType || !isValidLatLng(pickup) || !isValidLatLng(dropoff)) {
    res.status(400).json({ success: false, error: 'invalid_payload' })
    return
  }
  
  // Talebi doğrudan bookings tablosuna kaydet (kalıcı depolama)
  const now = new Date().toISOString()
  const pricing = await getPricingConfig().catch(() => null)
  const distKm = round2(haversine(pickup, dropoff) / 1000)
  const driverPerKm = pricing?.driverPerKm ?? 1
  const feePct = pricing?.platformFeePercent ?? 3
  const driverFare = round2(distKm * driverPerKm)
  const total = round2(driverFare * (1 + feePct / 100))
  const reservationCode = await generateReservationCode()
  
  const bookingData = {
    id,
    reservationCode,
    customerId,
    driverId: targetDriverId || undefined,
    pickupLocation: { lat: pickup.lat, lng: pickup.lng, address: pickup.address || 'Alış Noktası' },
    dropoffLocation: { lat: dropoff.lat, lng: dropoff.lng, address: dropoff.address || 'Varış Noktası' },
    pickupTime: now,
    passengerCount: passengerCount || 1,
    vehicleType,
    status: 'pending' as const,
    basePrice: driverFare,
    finalPrice: total,
    paymentStatus: 'unpaid' as const,
    extras: { pricing: { driverPerKm, platformFeePercent: feePct, distanceKm: distKm, driverFare, platformFee: round2(total - driverFare), total, currency: pricing?.currency || 'EUR' } },
  }
  
  try {
    await createBooking(bookingData)
    console.log('Ride request saved to bookings:', id)
  } catch (e) {
    console.error('Failed to save ride request:', e)
  }
  
  // Ayrıca bellekte de tut (geriye dönük uyumluluk için)
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
  
  // Socket ile sürücülere bildir
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

router.get('/requests', async (req: Request, res: Response) => {
  const vt = req.query.vehicleType as string
  
  try {
    // Supabase'ten pending bookingleri çek (artık calisiyor)
    const pendingBookings = await listPendingBookings(vt || undefined)
    
    const dbList: RideRequest[] = pendingBookings.map((b: any) => ({
      id: b.id,
      customerId: b.customerId || '',
      passengerCount: b.passengerCount,
      basePrice: b.basePrice,
      pickup: b.pickupLocation,
      dropoff: b.dropoffLocation,
      vehicleType: b.vehicleType,
      status: 'pending' as const,
      targetDriverId: b.driverId || undefined,
    }))
    
    // Bellekteki talepleri de ekle (duplicate kontrolü ile)
    const memoryList = Array.from(requests.values()).filter(r => r.status === 'pending' && (!vt || r.vehicleType === vt))
    const allRequests = [...dbList]
    for (const r of memoryList) {
      if (!allRequests.some(x => x.id === r.id)) {
        allRequests.push(r)
      }
    }
    
    res.json({ success: true, data: allRequests })
  } catch (e) {
    console.error('Failed to fetch pending bookings:', e)
    // Fallback to memory
    const memoryList = Array.from(requests.values()).filter(r => r.status === 'pending' && (!vt || r.vehicleType === vt))
    res.json({ success: true, data: memoryList })
  }
})

router.post('/accept', (req: Request, res: Response) => {
  const { driverId, requestId } = req.body || {}
  
  ;(async () => {
    // Önce bellekte ara, yoksa veritabanından çek
    let r = requests.get(requestId)
    
    if (!r) {
      // Veritabanından pending booking'i ara
      const booking = await getBookingById(requestId)
      if (booking && booking.status === 'pending') {
        r = {
          id: booking.id,
          customerId: booking.customerId || '',
          passengerCount: booking.passengerCount,
          basePrice: booking.basePrice,
          pickup: booking.pickupLocation,
          dropoff: booking.dropoffLocation,
          vehicleType: booking.vehicleType as any,
          status: 'pending',
          targetDriverId: booking.driverId,
        }
      }
    }
    
    if (!r) {
      res.status(404).json({ success: false, error: 'request_not_found' })
      return
    }
    
    if (r.targetDriverId && r.targetDriverId !== driverId) {
      res.status(409).json({ success: false, error: 'not_target_driver' })
      return
    }
    
    r.status = 'accepted'
    r.driverId = driverId
    requests.set(requestId, r)

    // Sürücü bilgilerini al
    const driver = await getDriver(driverId)

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

    // Driver bilgilerini booking'e ekle
    const enrichedBooking = {
      ...booking,
      driverName: driver?.name || 'Şoför',
      driverPhone: driver?.phone || ''
    }

    try {
      const io = (req.app.get('io') as any)
      io?.emit('booking:update', enrichedBooking)
      io?.to?.(`booking:${booking.id}`)?.emit?.('booking:update', enrichedBooking)
      
      // Notify everyone that this request is TAKEN so they can remove it from list
      io?.emit('ride:taken', { requestId: r.id, driverId })
      
      // Also explicitly tell the driver who took it
      io?.emit(`driver:${driverId}:assigned`, enrichedBooking)
    } catch {}
    res.json({ success: true, data: enrichedBooking })
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

router.get('/list', async (req: Request, res: Response) => {
  const status = (req.query.status as string) || 'all'
  const st = status === 'approved' || status === 'pending' || status === 'rejected' ? status : 'all'
  
  try {
    // SERVERLESS: Her zaman veritabanından çek (bellek güvenilir değil)
    const list = await listDriversByStatus(st as any)
    res.json({ success: true, data: list })
  } catch {
    res.json({ success: true, data: [] })
  }
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

// Sürücü belge yükleme/güncelleme
router.post('/upload-docs', async (req: Request, res: Response) => {
  const { driverId, docs } = req.body || {}
  
  if (!driverId || !Array.isArray(docs)) {
    res.status(400).json({ success: false, error: 'invalid_payload' })
    return
  }

  try {
    // Sürücüyü getir
    let d = drivers.get(driverId)
    if (!d) {
      d = await getDriver(driverId) as DriverSession | undefined
      if (d) drivers.set(driverId, d)
    }

    if (!d) {
      res.status(404).json({ success: false, error: 'driver_not_found' })
      return
    }

    // Mevcut belgeleri merge et
    const existingDocs = Array.isArray(d.docs) ? [...d.docs] : []
    
    for (const newDoc of docs) {
      const idx = existingDocs.findIndex(e => e.name === newDoc.name)
      if (idx >= 0) {
        if (newDoc.url && newDoc.url.length > 0) {
          // Güncelle
          existingDocs[idx] = {
            ...existingDocs[idx],
            url: newDoc.url,
            uploadedAt: new Date().toISOString(),
            status: 'pending'
          }
        } else {
          // Sil
          existingDocs.splice(idx, 1)
        }
      } else if (newDoc.url && newDoc.url.length > 0) {
        // Yeni ekle
        existingDocs.push({
          name: newDoc.name,
          url: newDoc.url,
          uploadedAt: new Date().toISOString(),
          status: 'pending'
        })
      }
    }

    d.docs = existingDocs
    drivers.set(driverId, d)
    
    // Veritabanına kaydet
    await saveDriver(d)

    // Socket ile admin'e bildir
    try { 
      (req.app.get('io') as any)?.emit('driver:docs-updated', { driverId, docs: existingDocs }) 
    } catch {}

    res.json({ success: true, data: { docs: existingDocs } })
  } catch (err) {
    console.error('Belge yükleme hatası:', err)
    res.status(500).json({ success: false, error: 'upload_failed' })
  }
})

// Sürücü belge onaylama/reddetme (Admin)
router.post('/docs/approve', async (req: Request, res: Response) => {
  const { driverId, docName, approved, reason } = req.body || {}
  
  if (!driverId || !docName) {
    res.status(400).json({ success: false, error: 'invalid_payload' })
    return
  }

  try {
    let d = drivers.get(driverId)
    if (!d) {
      d = await getDriver(driverId) as DriverSession | undefined
      if (d) drivers.set(driverId, d)
    }

    if (!d || !Array.isArray(d.docs)) {
      res.status(404).json({ success: false, error: 'driver_or_docs_not_found' })
      return
    }

    const docIdx = d.docs.findIndex(doc => doc.name === docName)
    if (docIdx < 0) {
      res.status(404).json({ success: false, error: 'doc_not_found' })
      return
    }

    d.docs[docIdx].status = approved ? 'approved' : 'rejected'
    if (!approved && reason) {
      (d.docs[docIdx] as any).rejectReason = reason
    }

    drivers.set(driverId, d)
    await saveDriver(d)

    // Tüm belgeler onaylı mı kontrol et
    const allApproved = d.docs.every(doc => doc.status === 'approved')
    const requiredDocs = ['license', 'vehicle_registration', 'insurance', 'profile_photo']
    const hasAllRequired = requiredDocs.every(req => d!.docs?.some(doc => doc.name === req && doc.status === 'approved'))

    res.json({ 
      success: true, 
      data: { 
        docs: d.docs, 
        allApproved,
        hasAllRequired
      } 
    })
  } catch (err) {
    res.status(500).json({ success: false, error: 'update_failed' })
  }
})

// Admin: Sürücü available durumunu doğrudan veritabanında güncelle
router.post('/admin/set-available', async (req: Request, res: Response) => {
  const { id, available } = req.body || {}
  if (!id) { res.status(400).json({ success: false, error: 'id_required' }); return }
  
  try {
    const d = await getDriver(id)
    if (!d) { res.status(404).json({ success: false, error: 'driver_not_found' }); return }
    
    d.available = !!available
    await saveDriver(d)
    res.json({ success: true, data: d })
  } catch (e) {
    res.status(500).json({ success: false, error: 'update_failed' })
  }
})

// Admin: Tüm sürücüleri offline yap
router.post('/admin/all-offline', async (_req: Request, res: Response) => {
  try {
    const list = await listDriversByStatus('approved')
    for (const d of list) {
      d.available = false
      await saveDriver(d)
    }
    res.json({ success: true, message: `${list.length} sürücü offline yapıldı` })
  } catch (e) {
    res.status(500).json({ success: false, error: 'update_failed' })
  }
})

 

export default router
