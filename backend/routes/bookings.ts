import { Router, type Request, type Response } from 'express'
import { createBooking, findBookingByPhoneAndCode, generateReservationCode, getBookingById, listBookingsByCustomer, listBookingsByDriver, storageMode, updateBooking } from '../services/bookingsStorage.js'
import { verifyGuestToken } from '../services/guestToken.js'
import { getPricingConfig } from '../services/pricingStorage.js'

const router = Router()

type Booking = {
  id: string
  reservationCode?: string
  customerId?: string
  guestName?: string
  guestPhone?: string
  driverId?: string
  pickupLocation: { lat: number, lng: number, address: string }
  dropoffLocation: { lat: number, lng: number, address: string }
  pickupTime: string
  passengerCount: number
  adults?: number
  children?: number
  vehicleType: 'sedan'|'suv'|'van'|'luxury'
  isImmediate?: boolean
  flightNumber?: string
  nameBoard?: string
  returnTrip?: { enabled: boolean, pickupTime?: string }
  extras?: { notes?: string; tags?: string[]; promoCode?: string; termsAccepted?: boolean; pricing?: any }
  status: 'pending'|'accepted'|'driver_en_route'|'driver_arrived'|'in_progress'|'completed'|'cancelled'
  basePrice: number
  finalPrice?: number
  paymentStatus?: 'unpaid'|'paid'
  paymentMethod?: 'card'|'cash'
  paidAt?: string
  route?: { driverPath: Array<{ lat: number, lng: number }>, customerPath?: Array<{ lat: number, lng: number }> }
  pickedUpAt?: string
  completedAt?: string
  createdAt?: string
  updatedAt?: string
}

const isValidLatLng = (p: any) => typeof p?.lat === 'number' && typeof p?.lng === 'number' && isFinite(p.lat) && isFinite(p.lng) && p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180
const ALL_STATUSES: Array<Booking['status']> = ['pending', 'accepted', 'driver_en_route', 'driver_arrived', 'in_progress', 'completed', 'cancelled']
const isStatus = (v: any): v is Booking['status'] => typeof v === 'string' && (ALL_STATUSES as string[]).includes(v)
const allowedNext: Record<Booking['status'], Array<Booking['status']>> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['driver_en_route', 'cancelled'],
  driver_en_route: ['driver_arrived', 'cancelled'],
  driver_arrived: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}
const canTransition = (from: Booking['status'], to: Booking['status']) => from === to || allowedNext[from].includes(to)

const liveCustomerLocation: Map<string, { location: { lat: number, lng: number }, ts: number }> = new Map()

const round2 = (n: number) => Math.round(n * 100) / 100
const haversineMeters = (a: { lat: number, lng: number }, b: { lat: number, lng: number }) => {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const la1 = a.lat * Math.PI / 180
  const la2 = b.lat * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

router.post('/create', (req: Request, res: Response) => {
  const b = req.body as Partial<Booking>
  if (!b.pickupLocation || !b.dropoffLocation || !b.passengerCount || !b.vehicleType || !isValidLatLng(b.pickupLocation) || !isValidLatLng(b.dropoffLocation)) {
    res.status(400).json({ success: false, error: 'invalid_payload' })
    return
  }
  if (b.extras?.termsAccepted === false) {
    res.status(400).json({ success: false, error: 'terms_required' })
    return
  }
  const id = 'bk_' + Date.now()
  ;(async () => {
    const now = new Date().toISOString()
    const pricing = await getPricingConfig().catch(() => null)
    const distKm = round2(haversineMeters(b.pickupLocation as any, b.dropoffLocation as any) / 1000)
    const driverPerKm = pricing?.driverPerKm ?? 1
    const feePct = pricing?.platformFeePercent ?? 3
    const driverFare = round2(distKm * driverPerKm)
    const total = round2(driverFare * (1 + feePct / 100))
    const reservationCode = typeof b.reservationCode === 'string' && b.reservationCode.trim() ? b.reservationCode.trim().toUpperCase() : await generateReservationCode()
    const customerId = typeof b.customerId === 'string' && b.customerId.trim() ? b.customerId.trim() : undefined
    const guestName = typeof b.guestName === 'string' ? b.guestName.trim() : undefined
    const guestPhone = typeof b.guestPhone === 'string' ? b.guestPhone.trim() : undefined
    if (!customerId) {
      if (!guestName || guestName.length < 2) { res.status(400).json({ success: false, error: 'guest_name_required' }); return }
      if (!guestPhone || guestPhone.length < 7) { res.status(400).json({ success: false, error: 'guest_phone_required' }); return }
    }
    const created = await createBooking({
      id,
      reservationCode,
      customerId,
      guestName,
      guestPhone,
      driverId: b.driverId,
      pickupLocation: b.pickupLocation as any,
      dropoffLocation: b.dropoffLocation as any,
      pickupTime: b.pickupTime || now,
      passengerCount: b.passengerCount as number,
      adults: typeof b.adults === 'number' ? b.adults : undefined,
      children: typeof b.children === 'number' ? b.children : undefined,
      vehicleType: b.vehicleType as any,
      isImmediate: !!b.isImmediate,
      flightNumber: typeof b.flightNumber === 'string' ? b.flightNumber : undefined,
      nameBoard: typeof b.nameBoard === 'string' ? b.nameBoard : undefined,
      returnTrip: b.returnTrip && typeof (b.returnTrip as any).enabled === 'boolean' ? (b.returnTrip as any) : undefined,
      extras: b.extras ? {
        notes: typeof b.extras.notes === 'string' ? b.extras.notes : undefined,
        promoCode: typeof b.extras.promoCode === 'string' ? b.extras.promoCode : undefined,
        termsAccepted: !!b.extras.termsAccepted,
        tags: Array.isArray(b.extras.tags) ? b.extras.tags.filter((x: any) => typeof x === 'string').slice(0, 20) : undefined,
        pricing: { driverPerKm, platformFeePercent: feePct, distanceKm: distKm, driverFare, platformFee: round2(total - driverFare), total, currency: pricing?.currency || 'EUR' },
      } : undefined,
      status: (b.status as any) || 'pending',
      basePrice: driverFare,
      finalPrice: total,
      paymentStatus: 'unpaid',
      paymentMethod: b.paymentMethod,
      createdAt: now,
      updatedAt: now,
    } as any)
    try {
      const io = (req.app.get('io') as any)
      io?.emit('booking:create', created)
      io?.to?.(`booking:${created.id}`)?.emit?.('booking:create', created)
    } catch {}
    res.json({ success: true, data: { ...created, storage: storageMode() } })
  })().catch(() => res.status(500).json({ success: false, error: 'create_failed' }))
})

router.post('/:id/cancel', (req: Request, res: Response) => {
  const { id } = req.params
  updateBooking(id, { status: 'cancelled' } as any).then(b => {
    if (!b) { res.status(404).json({ success: false, error: 'booking_not_found' }); return }
    try {
      const io = (req.app.get('io') as any)
      io?.emit('booking:update', b)
      io?.to?.(`booking:${b.id}`)?.emit?.('booking:update', b)
    } catch {}
    res.json({ success: true, data: b })
  }).catch(() => res.status(500).json({ success: false, error: 'cancel_failed' }))
})

router.put('/:id/status', (req: Request, res: Response) => {
  const { id } = req.params
  const { status } = req.body || {}
  if (!isStatus(status)) { res.status(400).json({ success: false, error: 'invalid_status' }); return }
  ;(async () => {
    const cur = await getBookingById(id)
    if (!cur) { res.status(404).json({ success: false, error: 'booking_not_found' }); return }
    if (!canTransition(cur.status as any, status)) { res.status(409).json({ success: false, error: 'invalid_transition', data: { from: cur.status, to: status } }); return }
    const patch: any = { status }
    if (status === 'in_progress' && !cur.pickedUpAt) patch.pickedUpAt = new Date().toISOString()
    if (status === 'completed' && !cur.completedAt) patch.completedAt = new Date().toISOString()
    const updated = await updateBooking(id, patch)
    if (!updated) { res.status(404).json({ success: false, error: 'booking_not_found' }); return }
    try {
      const io = (req.app.get('io') as any)
      io?.emit('booking:update', updated)
      io?.to?.(`booking:${updated.id}`)?.emit?.('booking:update', updated)
    } catch {}
    res.json({ success: true, data: updated })
  })().catch(() => res.status(500).json({ success: false, error: 'update_failed' }))
})

router.get('/:id', (req: Request, res: Response) => {
  getBookingById(req.params.id).then(b => {
    if (!b) { res.status(404).json({ success: false, error: 'booking_not_found' }); return }
    res.json({ success: true, data: b })
  }).catch(() => res.status(500).json({ success: false, error: 'get_failed' }))
})

router.put('/:id/route', (req: Request, res: Response) => {
  const { id } = req.params
  const { driverPath, customerPath } = req.body || {}
  if (!Array.isArray(driverPath) || driverPath.length === 0) { res.status(400).json({ success: false, error: 'invalid_route' }); return }
  updateBooking(id, { route: { driverPath, customerPath: Array.isArray(customerPath) ? customerPath : undefined } } as any).then(b => {
    if (!b) { res.status(404).json({ success: false, error: 'booking_not_found' }); return }
    try {
      const io = (req.app.get('io') as any)
      io?.emit('booking:route', { id: b.id, driverPath: driverPath })
      io?.to?.(`booking:${b.id}`)?.emit?.('booking:route', { id: b.id, driverPath: driverPath })
    } catch {}
    res.json({ success: true, data: b })
  }).catch(() => res.status(500).json({ success: false, error: 'route_failed' }))
})

router.post('/:id/customer-location', (req: Request, res: Response) => {
  const { id } = req.params
  const { location } = req.body || {}
  if (!isValidLatLng(location)) { res.status(400).json({ success: false, error: 'invalid_location' }); return }
  liveCustomerLocation.set(id, { location, ts: Date.now() })
  try {
    const io = (req.app.get('io') as any)
    io?.emit('customer:update', { bookingId: id, location })
    io?.to?.(`booking:${id}`)?.emit?.('customer:update', { bookingId: id, location })
  } catch {}
  res.json({ success: true })
})

router.get('/:id/customer-location', (req: Request, res: Response) => {
  const { id } = req.params
  const got = liveCustomerLocation.get(id)
  if (!got) { res.json({ success: true, data: null }); return }
  if (Date.now() - got.ts > 5 * 60_000) { res.json({ success: true, data: null }); return }
  res.json({ success: true, data: got.location })
})

router.get('/by-driver/:driverId', (_req: Request, res: Response) => {
  const driverId = String(_req.params.driverId || '').trim()
  listBookingsByDriver(driverId).then(list => res.json({ success: true, data: list })).catch(() => res.status(500).json({ success: false, error: 'list_failed' }))
})

router.post('/:id/pay', (req: Request, res: Response) => {
  const { id } = req.params
  const { amount, method } = req.body || {}
  ;(async () => {
    const cur = await getBookingById(id)
    if (!cur) { res.status(404).json({ success: false, error: 'booking_not_found' }); return }
    const paymentMethod: any = method === 'cash' ? 'cash' : 'card'
    const patch: any = {
      paymentMethod,
      finalPrice: typeof amount === 'number' ? amount : cur.finalPrice,
    }
    if (paymentMethod === 'card') {
      patch.paymentStatus = 'paid'
      patch.paidAt = new Date().toISOString()
    }
    const updated = await updateBooking(id, patch)
    if (!updated) { res.status(404).json({ success: false, error: 'booking_not_found' }); return }
    try {
      const io = (req.app.get('io') as any)
      io?.emit('booking:paid', { id: updated.id, amount: updated.finalPrice, method: paymentMethod })
      io?.to?.(`booking:${updated.id}`)?.emit?.('booking:paid', { id: updated.id, amount: updated.finalPrice, method: paymentMethod })
    } catch {}
    res.json({ success: true, data: updated })
  })().catch(() => res.status(500).json({ success: false, error: 'pay_failed' }))
})

router.get('/by-customer/:customerId', (req: Request, res: Response) => {
  listBookingsByCustomer(req.params.customerId).then(list => res.json({ success: true, data: list })).catch(() => res.status(500).json({ success: false, error: 'list_failed' }))
})

router.post('/lookup', (req: Request, res: Response) => {
  const tokenRaw = String(req.headers['x-guest-token'] || '')
  const tok = verifyGuestToken(tokenRaw)
  if (!tok) { res.status(401).json({ success: false, error: 'guest_token_required' }); return }
  const { phone, reservationCode } = req.body || {}
  const phoneNorm = typeof phone === 'string' ? phone.trim() : ''
  const codeNorm = typeof reservationCode === 'string' ? reservationCode.trim().toUpperCase() : ''
  if (!phoneNorm || !codeNorm) { res.status(400).json({ success: false, error: 'invalid_payload' }); return }
  if (tok.phone !== phoneNorm && tok.phone !== String(phoneNorm).replace(/\s+/g, '')) { res.status(403).json({ success: false, error: 'phone_mismatch' }); return }
  findBookingByPhoneAndCode(phoneNorm, codeNorm).then(b => {
    if (!b) { res.status(404).json({ success: false, error: 'booking_not_found' }); return }
    res.json({ success: true, data: b })
  }).catch(() => res.status(500).json({ success: false, error: 'lookup_failed' }))
})

export default router
