import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { logger } from '../utils/logger.js'

export type BookingRecord = {
  id: string
  reservationCode: string
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
  extras?: { notes?: string, tags?: string[], promoCode?: string, termsAccepted?: boolean, pricing?: { driverPerKm?: number, platformFeePercent?: number, distanceKm?: number, driverFare?: number, platformFee?: number, total?: number, currency?: string } }
  status: 'pending'|'accepted'|'driver_en_route'|'driver_arrived'|'in_progress'|'completed'|'cancelled'
  basePrice: number
  finalPrice?: number
  paymentStatus?: 'unpaid'|'paid'
  paymentMethod?: 'card'|'cash'
  paidAt?: string
  route?: { driverPath: Array<{ lat: number, lng: number }>, customerPath?: Array<{ lat: number, lng: number }> }
  pickedUpAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

const memory: Map<string, BookingRecord> = new Map()

const getEnv = (k: string) => {
  const v = process.env[k]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

const supabaseUrl = getEnv('SUPABASE_URL')
const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_ANON_KEY')
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } }) : null

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const randomCode = (len: number) => {
  const bytes = crypto.randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return out
}

async function isReservationCodeTaken(code: string) {
  if (!supabase) {
    return Array.from(memory.values()).some(b => b.reservationCode === code)
  }
  try {
    const { data, error } = await supabase.from('bookings').select('reservation_code').eq('reservation_code', code).limit(1)
    if (error) return true
    return Array.isArray(data) && data.length > 0
  } catch {
    return true
  }
}

export async function generateReservationCode() {
  for (let i = 0; i < 8; i++) {
    const code = randomCode(8)
    const taken = await isReservationCodeTaken(code)
    if (!taken) return code
  }
  return randomCode(10)
}

const mapRowToBooking = (row: any): BookingRecord => ({
  id: String(row.id),
  reservationCode: String(row.reservation_code),
  customerId: row.customer_id || undefined,
  guestName: row.guest_name || undefined,
  guestPhone: row.guest_phone || undefined,
  driverId: row.driver_id || undefined,
  pickupLocation: row.pickup_location,
  dropoffLocation: row.dropoff_location,
  pickupTime: row.pickup_time,
  passengerCount: row.passenger_count,
  adults: typeof row.adults === 'number' ? row.adults : undefined,
  children: typeof row.children === 'number' ? row.children : undefined,
  vehicleType: row.vehicle_type,
  isImmediate: !!row.is_immediate,
  flightNumber: row.flight_number || undefined,
  nameBoard: row.name_board || undefined,
  returnTrip: row.return_trip || undefined,
  extras: row.extras || undefined,
  status: row.status,
  basePrice: Number(row.base_price || 0),
  finalPrice: row.final_price !== null && row.final_price !== undefined ? Number(row.final_price) : undefined,
  paymentStatus: row.payment_status || undefined,
  paymentMethod: row.payment_method || undefined,
  paidAt: row.paid_at || undefined,
  route: row.route || undefined,
  pickedUpAt: row.picked_up_at || undefined,
  completedAt: row.completed_at || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export function storageMode() {
  return supabase ? 'supabase' : 'memory'
}

export async function createBooking(b: Omit<BookingRecord, 'createdAt'|'updatedAt'>) {
  const now = new Date().toISOString()
  const next: BookingRecord = { ...b, createdAt: now, updatedAt: now }
  memory.set(next.id, next)
  if (!supabase) return next
  try {
    const { data, error } = await supabase.from('bookings').insert({
      id: next.id,
      reservation_code: next.reservationCode,
      customer_id: next.customerId || null,
      guest_name: next.guestName || null,
      guest_phone: next.guestPhone || null,
      driver_id: next.driverId || null,
      pickup_location: next.pickupLocation,
      dropoff_location: next.dropoffLocation,
      pickup_time: next.pickupTime,
      passenger_count: next.passengerCount,
      adults: next.adults ?? null,
      children: next.children ?? null,
      vehicle_type: next.vehicleType,
      is_immediate: !!next.isImmediate,
      flight_number: next.flightNumber || null,
      name_board: next.nameBoard || null,
      return_trip: next.returnTrip || null,
      extras: next.extras || null,
      status: next.status,
      base_price: next.basePrice,
      final_price: next.finalPrice ?? null,
      payment_status: next.paymentStatus || null,
      payment_method: next.paymentMethod || null,
      paid_at: next.paidAt || null,
      route: next.route || null,
      picked_up_at: next.pickedUpAt || null,
      completed_at: next.completedAt || null,
      created_at: now,
      updated_at: now,
    }).select('*').limit(1)
    if (error) throw error
    const row = Array.isArray(data) && data[0]
    if (row) {
      const mapped = mapRowToBooking(row)
      memory.set(mapped.id, mapped)
      return mapped
    }
  } catch (e: any) {
    logger.warn('bookings_supabase_insert_failed', { reason: String(e?.message || e || 'unknown') })
  }
  return next
}

export async function getBookingById(id: string) {
  if (memory.has(id)) return memory.get(id) || null
  if (!supabase) return null
  try {
    const { data, error } = await supabase.from('bookings').select('*').eq('id', id).limit(1)
    if (error) throw error
    const row = Array.isArray(data) && data[0]
    if (!row) return null
    const mapped = mapRowToBooking(row)
    memory.set(id, mapped)
    return mapped
  } catch (e: any) {
    logger.warn('bookings_supabase_get_failed', { id, reason: String(e?.message || e || 'unknown') })
    return null
  }
}

export async function listBookingsByCustomer(customerId: string) {
  if (!supabase) {
    return Array.from(memory.values()).filter(b => b.customerId === customerId)
  }
  try {
    const { data, error } = await supabase.from('bookings').select('*').eq('customer_id', customerId).order('created_at', { ascending: false })
    if (error) throw error
    const arr = Array.isArray(data) ? data : []
    const mapped = arr.map(mapRowToBooking)
    mapped.forEach(b => memory.set(b.id, b))
    return mapped
  } catch (e: any) {
    logger.warn('bookings_supabase_list_failed', { customerId, reason: String(e?.message || e || 'unknown') })
    return []
  }
}

export async function listBookingsByDriver(driverId: string) {
  const id = String(driverId || '').trim()
  if (!id) return []
  if (!supabase) {
    return Array.from(memory.values()).filter(b => b.driverId === id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  }
  try {
    const { data, error } = await supabase.from('bookings').select('*').eq('driver_id', id).order('created_at', { ascending: false })
    if (error) throw error
    const arr = Array.isArray(data) ? data : []
    const mapped = arr.map(mapRowToBooking)
    mapped.forEach(b => memory.set(b.id, b))
    return mapped
  } catch (e: any) {
    logger.warn('bookings_supabase_list_by_driver_failed', { driverId: id, reason: String(e?.message || e || 'unknown') })
    return []
  }
}

export async function listPendingBookings(vehicleType?: string) {
  if (!supabase) {
    return Array.from(memory.values()).filter(b => b.status === 'pending' && (!vehicleType || b.vehicleType === vehicleType))
  }
  try {
    let query = supabase.from('bookings').select('*').eq('status', 'pending')
    if (vehicleType) {
      query = query.eq('vehicle_type', vehicleType)
    }
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    const arr = Array.isArray(data) ? data : []
    const mapped = arr.map(mapRowToBooking)
    mapped.forEach(b => memory.set(b.id, b))
    return mapped
  } catch (e: any) {
    logger.warn('bookings_supabase_list_pending_failed', { reason: String(e?.message || e || 'unknown') })
    return Array.from(memory.values()).filter(b => b.status === 'pending' && (!vehicleType || b.vehicleType === vehicleType))
  }
}

export async function findBookingByPhoneAndCode(guestPhone: string, reservationCode: string) {
  const phoneNorm = String(guestPhone || '').trim()
  const codeNorm = String(reservationCode || '').trim().toUpperCase()
  if (!phoneNorm || !codeNorm) return null
  if (!supabase) {
    return Array.from(memory.values()).find(b => (b.guestPhone || '') === phoneNorm && b.reservationCode === codeNorm) || null
  }
  try {
    const { data, error } = await supabase.from('bookings').select('*').eq('guest_phone', phoneNorm).eq('reservation_code', codeNorm).limit(1)
    if (error) throw error
    const row = Array.isArray(data) && data[0]
    if (!row) return null
    const mapped = mapRowToBooking(row)
    memory.set(mapped.id, mapped)
    return mapped
  } catch (e: any) {
    logger.warn('bookings_supabase_lookup_failed', { reason: String(e?.message || e || 'unknown') })
    return null
  }
}

// Sürücü için detaylı kazanç istatistikleri
export async function getDriverEarnings(driverId: string, pricingConfig?: { currency?: string }) {
  const bookings = await listBookingsByDriver(driverId)
  const completed = bookings.filter(b => b.status === 'completed')
  
  // Para birimi: önce booking'den, yoksa global config'den
  const currency = completed[0]?.extras?.pricing?.currency || pricingConfig?.currency || 'EUR'
  
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 7)
  const monthStart = new Date(todayStart)
  monthStart.setMonth(monthStart.getMonth() - 1)
  
  let daily = 0
  let weekly = 0
  let monthly = 0
  let total = 0
  let totalTrips = 0
  let totalPlatformFee = 0  // Platform komisyonu toplamı
  
  const dailyTrips: BookingRecord[] = []
  const weeklyTrips: BookingRecord[] = []
  const monthlyTrips: BookingRecord[] = []
  
  for (const b of completed) {
    const completedAt = b.completedAt ? new Date(b.completedAt) : new Date(b.createdAt)
    const fare = b.extras?.pricing?.driverFare || b.basePrice || 0
    const platformFee = b.extras?.pricing?.platformFee || 0
    
    total += fare
    totalPlatformFee += platformFee
    totalTrips++
    
    if (completedAt >= todayStart) {
      daily += fare
      dailyTrips.push(b)
    }
    if (completedAt >= weekStart) {
      weekly += fare
      weeklyTrips.push(b)
    }
    if (completedAt >= monthStart) {
      monthly += fare
      monthlyTrips.push(b)
    }
  }
  
  // Son 7 günlük günlük breakdown
  const dailyBreakdown: { date: string; amount: number; trips: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart)
    d.setDate(d.getDate() - i)
    const nextDay = new Date(d)
    nextDay.setDate(nextDay.getDate() + 1)
    
    let amount = 0
    let trips = 0
    for (const b of completed) {
      const completedAt = b.completedAt ? new Date(b.completedAt) : new Date(b.createdAt)
      if (completedAt >= d && completedAt < nextDay) {
        amount += b.extras?.pricing?.driverFare || b.basePrice || 0
        trips++
      }
    }
    dailyBreakdown.push({
      date: d.toISOString().split('T')[0],
      amount: Math.round(amount * 100) / 100,
      trips
    })
  }
  
  return {
    driverId,
    currency,
    daily: Math.round(daily * 100) / 100,
    weekly: Math.round(weekly * 100) / 100,
    monthly: Math.round(monthly * 100) / 100,
    total: Math.round(total * 100) / 100,
    totalPlatformFee: Math.round(totalPlatformFee * 100) / 100,  // Platform kazancı
    totalTrips,
    dailyTripsCount: dailyTrips.length,
    weeklyTripsCount: weeklyTrips.length,
    monthlyTripsCount: monthlyTrips.length,
    dailyBreakdown,
    generatedAt: now.toISOString()
  }
}

// Sürücü için tamamlanan yolculuk listesi (detaylı)
export async function getDriverTripHistory(driverId: string, limit: number = 50, offset: number = 0) {
  const bookings = await listBookingsByDriver(driverId)
  const completed = bookings
    .filter(b => b.status === 'completed')
    .slice(offset, offset + limit)
  
  return completed.map(b => ({
    id: b.id,
    reservationCode: b.reservationCode,
    pickup: b.pickupLocation,
    dropoff: b.dropoffLocation,
    pickupTime: b.pickupTime,
    completedAt: b.completedAt,
    passengerCount: b.passengerCount,
    vehicleType: b.vehicleType,
    distanceKm: b.extras?.pricing?.distanceKm,
    driverFare: b.extras?.pricing?.driverFare || b.basePrice,
    platformFee: b.extras?.pricing?.platformFee,
    totalFare: b.extras?.pricing?.total || b.finalPrice,
    paymentStatus: b.paymentStatus,
    paymentMethod: b.paymentMethod,
    customerName: b.guestName,
    customerPhone: b.guestPhone,
    status: b.status,
    currency: b.extras?.pricing?.currency || 'EUR'
  }))
}

// Platform genel muhasebe - Tüm sürücüler ve platform kazancı
export async function getPlatformAccounting() {
  // Tüm booking'leri çek
  let allBookings: BookingRecord[] = []
  
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
      
      if (!error && Array.isArray(data)) {
        allBookings = data.map(mapRowToBooking)
      }
    } catch (e) {
      console.error('Failed to fetch all bookings:', e)
    }
  } else {
    allBookings = Array.from(memory.values()).filter(b => b.status === 'completed')
  }
  
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 7)
  const monthStart = new Date(todayStart)
  monthStart.setMonth(monthStart.getMonth() - 1)
  
  // Hesaplamalar
  let totalRevenue = 0          // Toplam ciro (müşteri ödemeleri)
  let totalDriverPayout = 0     // Sürücü toplam ödemesi
  let totalPlatformRevenue = 0  // Platform komisyon geliri
  let totalTrips = 0
  
  let dailyRevenue = 0
  let weeklyRevenue = 0
  let monthlyRevenue = 0
  let dailyPlatformFee = 0
  let weeklyPlatformFee = 0
  let monthlyPlatformFee = 0
  
  // Sürücü bazlı özet
  const driverSummary: Record<string, { 
    name: string
    totalTrips: number 
    totalEarnings: number 
    platformFee: number 
  }> = {}
  
  for (const b of allBookings) {
    const driverFare = b.extras?.pricing?.driverFare || b.basePrice || 0
    const platformFee = b.extras?.pricing?.platformFee || 0
    const totalFare = b.extras?.pricing?.total || b.finalPrice || driverFare + platformFee
    const completedAt = b.completedAt ? new Date(b.completedAt) : new Date(b.createdAt)
    
    totalRevenue += totalFare
    totalDriverPayout += driverFare
    totalPlatformRevenue += platformFee
    totalTrips++
    
    // Zaman bazlı
    if (completedAt >= todayStart) {
      dailyRevenue += totalFare
      dailyPlatformFee += platformFee
    }
    if (completedAt >= weekStart) {
      weeklyRevenue += totalFare
      weeklyPlatformFee += platformFee
    }
    if (completedAt >= monthStart) {
      monthlyRevenue += totalFare
      monthlyPlatformFee += platformFee
    }
    
    // Sürücü bazlı
    if (b.driverId) {
      if (!driverSummary[b.driverId]) {
        driverSummary[b.driverId] = { 
          name: b.driverId, 
          totalTrips: 0, 
          totalEarnings: 0, 
          platformFee: 0 
        }
      }
      driverSummary[b.driverId].totalTrips++
      driverSummary[b.driverId].totalEarnings += driverFare
      driverSummary[b.driverId].platformFee += platformFee
    }
  }
  
  // Para birimi (ilk booking'den veya default)
  const currency = allBookings[0]?.extras?.pricing?.currency || 'EUR'
  
  // Son 7 günlük breakdown
  const dailyBreakdown: { date: string; revenue: number; platformFee: number; trips: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart)
    d.setDate(d.getDate() - i)
    const nextDay = new Date(d)
    nextDay.setDate(nextDay.getDate() + 1)
    
    let revenue = 0
    let platformFee = 0
    let trips = 0
    
    for (const b of allBookings) {
      const completedAt = b.completedAt ? new Date(b.completedAt) : new Date(b.createdAt)
      if (completedAt >= d && completedAt < nextDay) {
        revenue += b.extras?.pricing?.total || b.finalPrice || 0
        platformFee += b.extras?.pricing?.platformFee || 0
        trips++
      }
    }
    
    dailyBreakdown.push({
      date: d.toISOString().split('T')[0],
      revenue: Math.round(revenue * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      trips
    })
  }
  
  return {
    currency,
    // Genel Özet
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalDriverPayout: Math.round(totalDriverPayout * 100) / 100,
    totalPlatformRevenue: Math.round(totalPlatformRevenue * 100) / 100,
    totalTrips,
    
    // Zaman bazlı
    daily: {
      revenue: Math.round(dailyRevenue * 100) / 100,
      platformFee: Math.round(dailyPlatformFee * 100) / 100,
    },
    weekly: {
      revenue: Math.round(weeklyRevenue * 100) / 100,
      platformFee: Math.round(weeklyPlatformFee * 100) / 100,
    },
    monthly: {
      revenue: Math.round(monthlyRevenue * 100) / 100,
      platformFee: Math.round(monthlyPlatformFee * 100) / 100,
    },
    
    // Grafik verisi
    dailyBreakdown,
    
    // Sürücü bazlı özet
    driverSummary: Object.entries(driverSummary).map(([driverId, data]) => ({
      driverId,
      driverName: data.name,
      totalTrips: data.totalTrips,
      totalEarnings: Math.round(data.totalEarnings * 100) / 100,
      platformFee: Math.round(data.platformFee * 100) / 100,
    })).sort((a, b) => b.totalEarnings - a.totalEarnings),
    
    generatedAt: now.toISOString()
  }
}

export async function updateBooking(id: string, patch: Partial<BookingRecord>) {
  const cur = (await getBookingById(id)) || null
  if (!cur) return null
  const updated: BookingRecord = { ...cur, ...patch, updatedAt: new Date().toISOString() }
  memory.set(id, updated)
  if (!supabase) return updated
  try {
    const { data, error } = await supabase.from('bookings')
      .update({
        customer_id: updated.customerId || null,
        guest_name: updated.guestName || null,
        guest_phone: updated.guestPhone || null,
        driver_id: updated.driverId || null,
        pickup_location: updated.pickupLocation,
        dropoff_location: updated.dropoffLocation,
        pickup_time: updated.pickupTime,
        passenger_count: updated.passengerCount,
        adults: updated.adults ?? null,
        children: updated.children ?? null,
        vehicle_type: updated.vehicleType,
        is_immediate: !!updated.isImmediate,
        flight_number: updated.flightNumber || null,
        name_board: updated.nameBoard || null,
        return_trip: updated.returnTrip || null,
        extras: updated.extras || null,
        status: updated.status,
        base_price: updated.basePrice,
        final_price: updated.finalPrice ?? null,
        payment_status: updated.paymentStatus || null,
        payment_method: updated.paymentMethod || null,
        paid_at: updated.paidAt || null,
        route: updated.route || null,
        picked_up_at: updated.pickedUpAt || null,
        completed_at: updated.completedAt || null,
        updated_at: updated.updatedAt,
      })
      .eq('id', id)
      .select('*')
      .limit(1)
    if (error) throw error
    const row = Array.isArray(data) && data[0]
    if (row) {
      const mapped = mapRowToBooking(row)
      memory.set(id, mapped)
      return mapped
    }
  } catch (e: any) {
    logger.warn('bookings_supabase_update_failed', { id, reason: String(e?.message || e || 'unknown') })
  }
  return updated
}

