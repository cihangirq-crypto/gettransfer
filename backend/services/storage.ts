import fetch from 'node-fetch'
import { logger } from '../utils/logger.js'

const getEnv = (k: string) => {
  const v = process.env[k]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

// Supabase REST API doğrudan kullan (serverless uyumlu)
const SUPABASE_URL = getEnv('SUPABASE_URL')
const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_ANON_KEY')

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

let memory: Map<string, DriverSession> = new Map()

// Doğrudan REST API ile Supabase erişimi
async function supabaseRequest(table: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'UPSERT', data?: any, query?: string): Promise<any> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('Supabase credentials not found')
    return null
  }
  
  let url = `${SUPABASE_URL}/rest/v1/${table}`
  const headers: Record<string, string> = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  }
  
  if (method === 'UPSERT') {
    headers['Prefer'] = 'resolution=merge-duplicates,return=representation'
  } else if (method === 'POST' || method === 'PATCH') {
    headers['Prefer'] = 'return=representation'
  }
  
  if (query) {
    url += '?' + query
  }
  
  try {
    const response = await fetch(url, {
      method: method === 'UPSERT' ? 'POST' : method,
      headers,
      body: data ? JSON.stringify(data) : undefined
    })
    
    if (!response.ok) {
      const text = await response.text()
      console.error('Supabase REST error:', response.status, text)
      return null
    }
    
    const text = await response.text()
    if (!text) return null
    return JSON.parse(text)
  } catch (e) {
    console.error('Supabase fetch error:', e)
    return null
  }
}

// Demo sürücü verisi - ARTIK KULLANILMIYOR (gerçek verilerle çalışıyoruz)
const DEMO_DRIVERS: DriverSession[] = []

// Test sürücüleri için örnek veri - ARTIK KULLANILMIYOR
const TEST_DRIVER_DATA: Record<string, Partial<DriverSession>> = {}

// Konum geçerli mi kontrol et
const isValidLocation = (lat: number | null | undefined, lng: number | null | undefined): boolean => {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false
  if (!isFinite(lat) || !isFinite(lng)) return false
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false
  // (0, 0) koordinatları geçersiz - Afrika açıkları
  if (lat === 0 && lng === 0) return false
  return true
}

// Test sürücülerinin eksik verilerini tamamla (artık kullanılmıyor - gerçek verilerle çalışıyoruz)
function enrichTestDriver(driver: DriverSession): DriverSession {
  return driver
}

async function sbUpsertDriver(d: DriverSession) {
  const data = {
    id: d.id,
    name: d.name,
    email: d.email || null,
    phone: d.phone || null,
    address: d.address || null,
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
  }
  
  // on_conflict parametresi ile UPSERT - id kolonunda çakışma olursa güncelle
  const result = await supabaseRequest('drivers', 'UPSERT', data, 'on_conflict=id')
  if (!result) {
    console.error('Failed to upsert driver:', d.id)
  }
  return result
}

export async function saveDriver(d: DriverSession) {
  memory.set(d.id, d)
  await sbUpsertDriver(d)
}

export async function getDriver(id: string): Promise<DriverSession | null> {
  if (memory.has(id)) return memory.get(id) || null
  
  // Supabase'den çek
  const rows = await supabaseRequest('drivers', 'GET', null, `id=eq.${id}&limit=1`)
  const row = Array.isArray(rows) ? rows[0] : null
  
  if (row) {
    const lat = typeof row.location_lat === 'number' ? row.location_lat : 0
    const lng = typeof row.location_lng === 'number' ? row.location_lng : 0
    
    const d: DriverSession = {
      id: row.id,
      name: row.name || 'Sürücü',
      email: row.email || undefined,
      phone: row.phone || undefined,
      address: row.address || undefined,
      passwordHash: row.password_hash || undefined,
      passwordSalt: row.password_salt || undefined,
      vehicleType: row.vehicle_type,
      vehicleModel: row.vehicle_model || undefined,
      licensePlate: row.license_plate || undefined,
      docs: row.docs || undefined,
      location: { lat, lng },
      available: !!row.available,
      approved: !!row.approved,
      rejectedReason: row.rejected_reason || undefined,
    }
    memory.set(id, d)
    return d
  }
  
  return null
}

export async function getDriverByEmail(email: string): Promise<DriverSession | null> {
  const emailNorm = String(email).trim().toLowerCase()
  
  // Önce bellekte ara
  const mem = Array.from(memory.values()).find(d => (d.email || '').toLowerCase() === emailNorm)
  if (mem) return mem
  
  // Supabase'den çek
  const rows = await supabaseRequest('drivers', 'GET', null, `email=eq.${encodeURIComponent(emailNorm)}&limit=1`)
  const row = Array.isArray(rows) ? rows[0] : null
  
  if (row) {
    const lat = typeof row.location_lat === 'number' ? row.location_lat : 0
    const lng = typeof row.location_lng === 'number' ? row.location_lng : 0
    
    const d: DriverSession = {
      id: row.id,
      name: row.name || 'Sürücü',
      email: row.email || undefined,
      phone: row.phone || undefined,
      address: row.address || undefined,
      passwordHash: row.password_hash || undefined,
      passwordSalt: row.password_salt || undefined,
      vehicleType: row.vehicle_type,
      vehicleModel: row.vehicle_model || undefined,
      licensePlate: row.license_plate || undefined,
      docs: row.docs || undefined,
      location: { lat, lng },
      available: !!row.available,
      approved: !!row.approved,
      rejectedReason: row.rejected_reason || undefined,
    }
    memory.set(d.id, d)
    return d
  }
  
  return null
}

export async function listDriversByStatus(status: 'approved' | 'pending' | 'rejected' | 'all'): Promise<DriverSession[]> {
  let query = 'select=*'
  
  if (status === 'approved') {
    query += '&approved=eq.true'
  } else if (status === 'pending') {
    query += '&approved=eq.false&rejected_reason=is.null'
  } else if (status === 'rejected') {
    query += '&rejected_reason=not.is.null'
  }
  
  const rows = await supabaseRequest('drivers', 'GET', null, query)
  
  // Supabase çalışmıyorsa veya boşsa demo veri döndür
  if (!Array.isArray(rows)) {
    console.log('Supabase not available, returning demo drivers for', status)
    if (status === 'approved' || status === 'all') {
      return DEMO_DRIVERS
    }
    return []
  }
  
  return rows.map((row: any) => {
    const lat = typeof row.location_lat === 'number' ? row.location_lat : 0
    const lng = typeof row.location_lng === 'number' ? row.location_lng : 0
    
    const driver: DriverSession = {
      id: row.id,
      name: row.name || 'Sürücü',
      email: row.email || undefined,
      phone: row.phone || undefined,
      address: row.address || undefined,
      passwordHash: row.password_hash || undefined,
      passwordSalt: row.password_salt || undefined,
      vehicleType: row.vehicle_type,
      vehicleModel: row.vehicle_model || undefined,
      licensePlate: row.license_plate || undefined,
      docs: row.docs || undefined,
      location: { lat, lng },
      available: !!row.available,
      approved: !!row.approved,
      rejectedReason: row.rejected_reason || undefined,
    }
    return enrichTestDriver(driver)
  })
}

export async function approveDriver(id: string): Promise<void> {
  await supabaseRequest('drivers', 'PATCH', { approved: true }, `id=eq.${id}`)
}

export async function rejectDriver(id: string, reason?: string): Promise<void> {
  await supabaseRequest('drivers', 'PATCH', { approved: false, rejected_reason: reason || 'Rejected' }, `id=eq.${id}`)
}

export async function updateDriverPartial(id: string, data: Partial<DriverSession>): Promise<void> {
  const updateData: any = {}
  if (data.name) updateData.name = data.name
  if (data.vehicleModel) updateData.vehicle_model = data.vehicleModel
  if (data.licensePlate) updateData.license_plate = data.licensePlate
  if (data.location) {
    updateData.location_lat = data.location.lat
    updateData.location_lng = data.location.lng
  }
  if (typeof data.available === 'boolean') updateData.available = data.available
  
  await supabaseRequest('drivers', 'PATCH', updateData, `id=eq.${id}`)
}

export async function deleteDriver(id: string): Promise<void> {
  await supabaseRequest('drivers', 'DELETE', null, `id=eq.${id}`)
}

export async function diagnoseSupabase() {
  const connected = !!(SUPABASE_URL && SUPABASE_KEY)
  
  let canQuery = false
  let error = null
  
  if (connected) {
    try {
      const result = await supabaseRequest('drivers', 'GET', null, 'limit=1')
      canQuery = Array.isArray(result)
    } catch (e: any) {
      error = e.message || String(e)
    }
  }
  
  return {
    connected,
    canQuery,
    error,
    hasUrl: !!SUPABASE_URL,
    hasService: !!getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    hasAnon: !!getEnv('SUPABASE_ANON_KEY'),
  }
}
