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

// Demo sürücü verisi - SADECE ilk kurulumda veya Supabase çalışmadığında kullanılır
const DEMO_DRIVERS: DriverSession[] = [
  {
    id: 'drv_fatih',
    name: 'Fatih Yılmaz',
    email: 'fatih@test.com',
    phone: '0532 555 12 34',
    address: 'Kadıköy Mahallesi, Bağdat Caddesi No: 45, Kadıköy/İstanbul',
    password: '123456',
    vehicleType: 'sedan',
    vehicleModel: 'Toyota Corolla 2022',
    licensePlate: '34 ABC 123',
    docs: [
      { name: 'license', url: 'https://placehold.co/400x300/1e40af/white?text=Suru+cu+Belgesi', uploadedAt: '2024-01-15T10:00:00Z', status: 'approved' },
      { name: 'vehicle_registration', url: 'https://placehold.co/400x300/166534/white?text=Ruhsat', uploadedAt: '2024-01-15T10:05:00Z', status: 'approved' },
      { name: 'insurance', url: 'https://placehold.co/400x300/7c3aed/white?text=Sigorta', uploadedAt: '2024-01-15T10:10:00Z', status: 'approved' },
      { name: 'profile_photo', url: 'https://placehold.co/400x400/374151/white?text=Fatih', uploadedAt: '2024-01-15T10:15:00Z', status: 'approved' },
    ],
    location: { lat: 40.9819, lng: 29.0267 }, // Kadıköy
    available: false,
    approved: true,
  },
  {
    id: 'drv_vedat',
    name: 'Vedat Demir',
    email: 'vedat@test.com',
    phone: '0533 666 78 90',
    address: 'Beşiktaş Mahallesi, Barbaros Bulvarı No: 78, Beşiktaş/İstanbul',
    password: '123456',
    vehicleType: 'luxury',
    vehicleModel: 'Mercedes E-Class 2023',
    licensePlate: '34 XYZ 456',
    docs: [
      { name: 'license', url: 'https://placehold.co/400x300/1e40af/white?text=Suru+cu+Belgesi', uploadedAt: '2024-02-01T09:00:00Z', status: 'approved' },
      { name: 'vehicle_registration', url: 'https://placehold.co/400x300/166534/white?text=Ruhsat', uploadedAt: '2024-02-01T09:05:00Z', status: 'approved' },
      { name: 'insurance', url: 'https://placehold.co/400x300/7c3aed/white?text=Sigorta', uploadedAt: '2024-02-01T09:10:00Z', status: 'approved' },
      { name: 'profile_photo', url: 'https://placehold.co/400x400/374151/white?text=Vedat', uploadedAt: '2024-02-01T09:15:00Z', status: 'approved' },
    ],
    location: { lat: 41.0421, lng: 29.0093 }, // Beşiktaş
    available: false,
    approved: true,
  }
]

// Test sürücüleri için örnek veri (veritabanında eksikse kullanılır)
const TEST_DRIVER_DATA: Record<string, Partial<DriverSession>> = {
  'drv_fatih': {
    name: 'Fatih Yılmaz',
    phone: '0532 555 12 34',
    address: 'Kadıköy Mahallesi, Bağdat Caddesi No: 45, Kadıköy/İstanbul',
    vehicleModel: 'Toyota Corolla 2022',
    licensePlate: '34 ABC 123',
    docs: [
      { name: 'license', url: 'https://placehold.co/400x300/1e40af/white?text=Suru+cu+Belgesi', uploadedAt: '2024-01-15T10:00:00Z', status: 'approved' as const },
      { name: 'vehicle_registration', url: 'https://placehold.co/400x300/166534/white?text=Ruhsat', uploadedAt: '2024-01-15T10:05:00Z', status: 'approved' as const },
      { name: 'insurance', url: 'https://placehold.co/400x300/7c3aed/white?text=Sigorta', uploadedAt: '2024-01-15T10:10:00Z', status: 'approved' as const },
      { name: 'profile_photo', url: 'https://placehold.co/400x400/374151/white?text=Fatih', uploadedAt: '2024-01-15T10:15:00Z', status: 'approved' as const },
    ],
    location: { lat: 40.9819, lng: 29.0267 },
  },
  'drv_vedat': {
    name: 'Vedat Demir',
    phone: '0533 666 78 90',
    address: 'Beşiktaş Mahallesi, Barbaros Bulvarı No: 78, Beşiktaş/İstanbul',
    vehicleModel: 'Mercedes E-Class 2023',
    licensePlate: '34 XYZ 456',
    docs: [
      { name: 'license', url: 'https://placehold.co/400x300/1e40af/white?text=Suru+cu+Belgesi', uploadedAt: '2024-02-01T09:00:00Z', status: 'approved' as const },
      { name: 'vehicle_registration', url: 'https://placehold.co/400x300/166534/white?text=Ruhsat', uploadedAt: '2024-02-01T09:05:00Z', status: 'approved' as const },
      { name: 'insurance', url: 'https://placehold.co/400x300/7c3aed/white?text=Sigorta', uploadedAt: '2024-02-01T09:10:00Z', status: 'approved' as const },
      { name: 'profile_photo', url: 'https://placehold.co/400x400/374151/white?text=Vedat', uploadedAt: '2024-02-01T09:15:00Z', status: 'approved' as const },
    ],
    location: { lat: 41.0421, lng: 29.0093 },
  }
}

// Test sürücülerinin eksik verilerini tamamla
function enrichTestDriver(driver: DriverSession): DriverSession {
  const testData = TEST_DRIVER_DATA[driver.id]
  if (!testData) return driver
  
  return {
    ...driver,
    name: driver.name && driver.name !== 'Sürücü' ? driver.name : testData.name || driver.name,
    phone: driver.phone || testData.phone,
    address: driver.address || testData.address,
    vehicleModel: driver.vehicleModel || testData.vehicleModel,
    licensePlate: driver.licensePlate || testData.licensePlate,
    docs: Array.isArray(driver.docs) && driver.docs.length > 0 ? driver.docs : testData.docs,
    location: (driver.location?.lat !== 0 && driver.location?.lng !== 0) ? driver.location : (testData.location || driver.location),
  }
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
  
  await supabaseRequest('drivers', 'UPSERT', data)
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
      location: { lat: row.location_lat || 0, lng: row.location_lng || 0 },
      available: !!row.available,
      approved: !!row.approved,
      rejectedReason: row.rejected_reason || undefined,
    }
    // Test sürücülerinin eksik verilerini tamamla
    const enriched = enrichTestDriver(d)
    memory.set(id, enriched)
    return enriched
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
      location: { lat: row.location_lat || 0, lng: row.location_lng || 0 },
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
  
  if (!Array.isArray(rows)) {
    // Supabase çalışmıyorsa demo veri döndür
    if (status === 'approved') {
      return DEMO_DRIVERS
    }
    return []
  }
  
  return rows.map((row: any) => {
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
      location: { lat: row.location_lat || 0, lng: row.location_lng || 0 },
      available: !!row.available,
      approved: !!row.approved,
      rejectedReason: row.rejected_reason || undefined,
    }
    // Test sürücülerinin eksik verilerini tamamla
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
