import { createClient } from '@supabase/supabase-js'

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

let memory: Map<string, DriverSession> = new Map()

const supabaseUrl = process.env.SUPABASE_URL || 'https://qbkccvujlewqiphkkdfa.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } }) : null

async function sbUpsertDriver(d: DriverSession) {
  if (!supabase) return
  try {
    const { error } = await supabase.from('drivers').upsert({
      id: d.id,
      name: d.name,
      email: d.email || null,
      password_hash: d.passwordHash || null,
      password_salt: d.passwordSalt || null,
      vehicle_type: d.vehicleType,
      vehicle_model: d.vehicleModel || null,
      license_plate: d.licensePlate || null,
      docs: d.docs || null,
      location_lat: d.location.lat,
      location_lng: d.location.lng,
      available: d.available,
      approved: d.approved,
      rejected_reason: d.rejectedReason || null,
    })
    if (error) console.error('Supabase upsert error:', error.message)
  } catch (e: any) {
    console.error('Supabase unexpected error:', e?.message || e)
  }
}

export async function saveDriver(d: DriverSession) {
  memory.set(d.id, d)
  await sbUpsertDriver(d)
}

export async function getDriver(id: string): Promise<DriverSession | null> {
  if (memory.has(id)) return memory.get(id) || null
  if (supabase) {
    const { data } = await supabase.from('drivers').select('*').eq('id', id).limit(1)
    const row = Array.isArray(data) && data[0]
    if (row) {
      const d: DriverSession = {
        id: row.id,
        name: row.name || 'Sürücü',
        email: row.email || undefined,
        passwordHash: row.password_hash || undefined,
        passwordSalt: row.password_salt || undefined,
        vehicleType: row.vehicle_type,
        vehicleModel: row.vehicle_model || undefined,
        licensePlate: row.license_plate || undefined,
        docs: row.docs || undefined,
        location: { lat: row.location_lat, lng: row.location_lng },
        available: !!row.available,
        approved: !!row.approved,
        rejectedReason: row.rejected_reason || undefined,
      }
      memory.set(id, d)
      return d
    }
  }
  return null
}

async function ensureSeeds() {
  // Test verisi (fake seed) oluşturma devre dışı bırakıldı
  return
}

export async function getDriverByEmail(email: string): Promise<DriverSession | null> {
  const emailNorm = String(email).trim().toLowerCase()
  const mem = Array.from(memory.values()).find(d => (d.email || '').toLowerCase() === emailNorm)
  if (mem) return mem
  if (supabase) {
    const { data } = await supabase.from('drivers').select('*').eq('email', emailNorm)
    const row = Array.isArray(data) && data[0]
    if (row) {
      const d: DriverSession = {
        id: row.id,
        name: row.name || 'Sürücü',
        email: (row.email || undefined)?.toLowerCase(),
        passwordHash: row.password_hash || undefined,
        passwordSalt: row.password_salt || undefined,
        vehicleType: row.vehicle_type,
        vehicleModel: row.vehicle_model || undefined,
        licensePlate: row.license_plate || undefined,
        docs: row.docs || undefined,
        location: { lat: row.location_lat, lng: row.location_lng },
        available: !!row.available,
        approved: !!row.approved,
        rejectedReason: row.rejected_reason || undefined,
      }
      memory.set(d.id, d)
      return d
    }
  }
  return null
}

export async function listDriversByStatus(status: 'approved' | 'pending' | 'rejected' | 'all'): Promise<DriverSession[]> {
  if (supabase) {
    try {
      await ensureSeeds()
      let q = supabase.from('drivers').select('*')
      if (status === 'approved') q = q.eq('approved', true)
      else if (status === 'pending') q = q.eq('approved', false).is('rejected_reason', null)
      else if (status === 'rejected') q = q.not('rejected_reason', 'is', null)
      const { data, error } = await q
      if (error) throw error
      const arr = Array.isArray(data) ? data : []
      return arr.map((row: any) => ({
        id: row.id,
        name: row.name || 'Sürücü',
        email: row.email || undefined,
        passwordHash: row.password_hash || undefined,
        passwordSalt: row.password_salt || undefined,
        vehicleType: row.vehicle_type,
        vehicleModel: row.vehicle_model || undefined,
        licensePlate: row.license_plate || undefined,
        docs: row.docs || undefined,
        location: { lat: row.location_lat, lng: row.location_lng },
        available: !!row.available,
        approved: !!row.approved,
        rejectedReason: row.rejected_reason || undefined,
      }))
    } catch {
      const fallback = Array.from(memory.values())
      if (fallback.length) return fallback
      return [
        { id: 'drv_fatih', name: 'fatih', email: 'fatih@test.com', vehicleType: 'sedan', vehicleModel: 'Araç', licensePlate: '', docs: [{ name: 'license' }], location: { lat: 36.8969, lng: 30.7133 }, available: true, approved: true },
        { id: 'drv_vedat', name: 'vedat', email: 'vedat@test.com', vehicleType: 'sedan', vehicleModel: 'Araç', licensePlate: '', docs: [{ name: 'license' }], location: { lat: 36.8969, lng: 30.7133 }, available: true, approved: true },
      ]
    }
  }
  let arr = Array.from(memory.values())
  if (arr.length === 0) {
    arr = [
      { id: 'drv_fatih', name: 'fatih', email: 'fatih@test.com', vehicleType: 'sedan', vehicleModel: 'Araç', licensePlate: '', docs: [{ name: 'license' }], location: { lat: 36.8969, lng: 30.7133 }, available: true, approved: true },
      { id: 'drv_vedat', name: 'vedat', email: 'vedat@test.com', vehicleType: 'sedan', vehicleModel: 'Araç', licensePlate: '', docs: [{ name: 'license' }], location: { lat: 36.8969, lng: 30.7133 }, available: true, approved: true },
    ]
  }
  if (status === 'approved') return arr.filter(d => d.approved)
  if (status === 'pending') return arr.filter(d => !d.approved && !d.rejectedReason)
  if (status === 'rejected') return arr.filter(d => !!d.rejectedReason)
  return arr
}

export async function approveDriver(id: string) {
  const d = (await getDriver(id)) || null
  if (!d) return
  d.approved = true
  d.rejectedReason = undefined
  await saveDriver(d)
}

export async function rejectDriver(id: string, reason?: string) {
  const d = (await getDriver(id)) || null
  if (!d) return
  d.approved = false
  d.rejectedReason = reason || 'unspecified'
  await saveDriver(d)
}

export async function updateDriverPartial(id: string, patch: Partial<DriverSession>) {
  const d = (await getDriver(id)) || null
  if (!d) return
  const next: DriverSession = { ...d, ...patch, location: patch.location || d.location }
  await saveDriver(next)
}

export async function deleteDriver(id: string) {
  memory.delete(id)
  if (supabase) {
    await supabase.from('drivers').delete().eq('id', id)
  }
}

export async function diagnoseSupabase() {
  const connected = !!supabase
  const hasUrl = !!process.env.SUPABASE_URL
  const hasService = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const hasAnon = !!process.env.SUPABASE_ANON_KEY
  if (!connected) return { connected: false, hasUrl, hasService, hasAnon }
  try {
    const { data, error } = await supabase.from('drivers').select('id', { count: 'exact', head: false }).limit(1)
    if (error) return { connected: true, canQuery: false, error: String(error.message || error) }
    const rows = Array.isArray(data) ? data.length : 0
    return { connected: true, canQuery: true, rows, hasUrl, hasService, hasAnon }
  } catch (e: any) {
    return { connected: true, canQuery: false, error: String(e?.message || e), hasUrl, hasService, hasAnon }
  }
}
