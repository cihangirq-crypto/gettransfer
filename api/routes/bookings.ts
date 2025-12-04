import { Router, type Request, type Response } from 'express'

const router = Router()

type Booking = {
  id: string
  customerId: string
  driverId?: string
  pickupLocation: { lat: number, lng: number, address: string }
  dropoffLocation: { lat: number, lng: number, address: string }
  pickupTime: string
  passengerCount: number
  vehicleType: 'sedan'|'suv'|'van'|'luxury'
  status: 'pending'|'accepted'|'driver_en_route'|'driver_arrived'|'in_progress'|'completed'|'cancelled'
  basePrice: number
  finalPrice?: number
  route?: { driverPath: Array<{ lat: number, lng: number }>, customerPath?: Array<{ lat: number, lng: number }> }
  pickedUpAt?: string
  completedAt?: string
  paymentStatus?: 'unpaid'|'paid'
  paidAt?: string
  createdAt: string
  updatedAt: string
}

const bookings: Map<string, Booking> = new Map()

router.post('/create', (req: Request, res: Response) => {
  const b = req.body as Partial<Booking>
  if (!b.pickupLocation || !b.dropoffLocation || !b.passengerCount || !b.vehicleType) {
    res.status(400).json({ success: false, error: 'invalid_payload' })
    return
  }
  const id = 'bk_' + Date.now()
  const now = new Date().toISOString()
  const booking: Booking = {
    id,
    customerId: b.customerId || 'cust_' + Date.now(),
    driverId: b.driverId,
    pickupLocation: b.pickupLocation as any,
    dropoffLocation: b.dropoffLocation as any,
    pickupTime: b.pickupTime || now,
    passengerCount: b.passengerCount as number,
    vehicleType: b.vehicleType as any,
    status: 'pending',
    basePrice: b.basePrice || 0,
    finalPrice: b.finalPrice,
    paymentStatus: 'unpaid',
    createdAt: now,
    updatedAt: now,
  }
  bookings.set(id, booking)
  res.json({ success: true, data: booking })
})

router.put('/:id/status', (req: Request, res: Response) => {
  const { id } = req.params
  const { status } = req.body || {}
  const b = bookings.get(id)
  if (!b) {
    res.status(404).json({ success: false, error: 'booking_not_found' })
    return
  }
  b.status = status
  if (status === 'in_progress') {
    b.pickedUpAt = new Date().toISOString()
  } else if (status === 'completed') {
    b.completedAt = new Date().toISOString()
  }
  b.updatedAt = new Date().toISOString()
  bookings.set(id, b)
  res.json({ success: true, data: b })
})

router.get('/:id', (req: Request, res: Response) => {
  const b = bookings.get(req.params.id)
  if (!b) {
    res.status(404).json({ success: false, error: 'booking_not_found' })
    return
  }
  res.json({ success: true, data: b })
})

router.put('/:id/route', (req: Request, res: Response) => {
  const { id } = req.params
  const { driverPath, customerPath } = req.body || {}
  const b = bookings.get(id)
  if (!b) { res.status(404).json({ success: false, error: 'booking_not_found' }); return }
  if (!Array.isArray(driverPath) || driverPath.length === 0) { res.status(400).json({ success: false, error: 'invalid_route' }); return }
  b.route = { driverPath, customerPath: Array.isArray(customerPath) ? customerPath : undefined }
  b.updatedAt = new Date().toISOString()
  bookings.set(id, b)
  res.json({ success: true, data: b })
})

router.get('/by-driver/:driverId', (req: Request, res: Response) => {
  const list = Array.from(bookings.values()).filter(b => b.driverId === req.params.driverId)
  res.json({ success: true, data: list })
})

router.post('/:id/pay', (req: Request, res: Response) => {
  const { id } = req.params
  const { amount } = req.body || {}
  const b = bookings.get(id)
  if (!b) { res.status(404).json({ success: false, error: 'booking_not_found' }); return }
  b.paymentStatus = 'paid'
  b.finalPrice = typeof amount === 'number' ? amount : b.finalPrice
  b.paidAt = new Date().toISOString()
  b.updatedAt = new Date().toISOString()
  bookings.set(id, b)
  res.json({ success: true, data: b })
})

router.get('/by-customer/:customerId', (req: Request, res: Response) => {
  const list = Array.from(bookings.values()).filter(b => b.customerId === req.params.customerId)
  res.json({ success: true, data: list })
})

export default router
