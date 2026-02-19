/**
 * OSRM Navigation Service
 * Ücretsiz, uygulama içi rota ve navigasyon
 */

// OSRM sunucuları (fallback ile)
const OSRM_SERVERS = [
  'https://router.project-osrm.org',
  'https://routing.openstreetmap.de/routed-car',
  'https://routing.openstreetmap.de/routed-bike'
]

export interface RoutePoint {
  lat: number
  lng: number
}

export interface RouteStep {
  distance: number
  duration: number
  instruction: string
  name: string
  type: string
  location: RoutePoint
}

export interface RouteLeg {
  distance: number
  duration: number
  steps: RouteStep[]
}

export interface Route {
  distance: number  // metre
  duration: number  // saniye
  geometry: RoutePoint[]
  legs: RouteLeg[]
}

export interface NavigationState {
  route: Route | null
  currentStep: number
  distanceRemaining: number
  durationRemaining: number
  nextInstruction: string | null
}

// OSRM'den rota al
export async function fetchRoute(
  start: RoutePoint,
  end: RoutePoint,
  waypoints?: RoutePoint[]
): Promise<Route | null> {
  // Koordinatları OSRM formatına çevir (lng,lat)
  const coords = [
    `${start.lng},${start.lat}`,
    ...(waypoints?.map(w => `${w.lng},${w.lat}`) || []),
    `${end.lng},${end.lat}`
  ].join(';')

  for (const server of OSRM_SERVERS) {
    try {
      const url = `${server}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&annotations=true`
      
      const response = await fetch(url)
      if (!response.ok) continue
      
      const data = await response.json()
      
      if (data.code === 'Ok' && data.routes?.length > 0) {
        const route = data.routes[0]
        
        // GeoJSON coordinates [lng, lat] -> {lat, lng}
        const geometry: RoutePoint[] = route.geometry.coordinates.map(
          (coord: number[]) => ({ lng: coord[0], lat: coord[1] })
        )
        
        const legs: RouteLeg[] = route.legs.map((leg: any) => ({
          distance: leg.distance,
          duration: leg.duration,
          steps: leg.steps.map((step: any) => ({
            distance: step.distance,
            duration: step.duration,
            instruction: step.maneuver?.type || 'continue',
            name: step.name || '',
            type: step.maneuver?.type || '',
            location: {
              lng: step.maneuver?.location?.[0] || 0,
              lat: step.maneuver?.location?.[1] || 0
            }
          }))
        }))
        
        return {
          distance: route.distance,
          duration: route.duration,
          geometry,
          legs
        }
      }
    } catch (error) {
      console.warn(`OSRM server ${server} failed:`, error)
      continue
    }
  }
  
  return null
}

// Turn-by-turn talimatları Türkçe'ye çevir
export function translateInstruction(step: RouteStep): string {
  const translations: Record<string, string> = {
    'turn': 'dön',
    'new name': 'yola devam et',
    'depart': 'başla',
    'arrive': 'varış',
    'merge': 'birleş',
    'on ramp': 'giriş rampası',
    'off ramp': 'çıkış rampası',
    'fork': 'kavşak',
    'roundabout': 'dönel kavşak',
    'exit rotary': 'dönel kavşaktan çık',
    'exit roundabout': 'dönel kavşaktan çık',
    'continue': 'devam et',
    'end of road': 'yol sonu',
    'notification': 'bilgi'
  }
  
  const modTranslations: Record<string, string> = {
    'left': 'sola',
    'right': 'sağa',
    'straight': 'düz',
    'slight left': 'hafif sola',
    'slight right': 'hafif sağa',
    'sharp left': 'keskin sola',
    'sharp right': 'keskin sağa',
    'uturn': 'U dönüşü'
  }
  
  const type = step.type.toLowerCase()
  const instruction = translations[type] || step.type
  
  // Basit talimat oluştur
  if (step.name) {
    return `${instruction} - ${step.name}`
  }
  
  return instruction
}

// Mesafe formatla
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`
  }
  return `${Math.round(meters)} m`
}

// Süre formatla
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours} sa ${minutes} dk`
  }
  return `${minutes} dk`
}

// Konumdan mesafe hesapla
export function distanceFromLine(
  point: RoutePoint,
  lineStart: RoutePoint,
  lineEnd: RoutePoint
): number {
  // Haversine ile noktadan çizgiye mesafe
  const R = 6371000
  
  const lat1 = lineStart.lat * Math.PI / 180
  const lat2 = lineEnd.lat * Math.PI / 180
  const lat3 = point.lat * Math.PI / 180
  
  const lng1 = lineStart.lng * Math.PI / 180
  const lng2 = lineEnd.lng * Math.PI / 180
  const lng3 = point.lng * Math.PI / 180
  
  // Cross-track distance formula
  const d13 = Math.acos(Math.sin(lat1) * Math.sin(lat3) + Math.cos(lat1) * Math.cos(lat3) * Math.cos(lng3 - lng1))
  const brng13 = Math.atan2(Math.sin(lng3 - lng1) * Math.cos(lat3), Math.cos(lat1) * Math.sin(lat3) - Math.sin(lat1) * Math.cos(lat3) * Math.cos(lng3 - lng1))
  const brng12 = Math.atan2(Math.sin(lng2 - lng1) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1))
  
  return Math.abs(Math.asin(Math.sin(d13) * Math.sin(brng13 - brng12)) * R)
}

// Rota üzerindeki en yakın noktayı bul
export function findClosestPointOnRoute(
  location: RoutePoint,
  route: RoutePoint[]
): { index: number; distance: number; point: RoutePoint } {
  let minDistance = Infinity
  let closestIndex = 0
  
  for (let i = 0; i < route.length - 1; i++) {
    const distance = distanceFromLine(location, route[i], route[i + 1])
    if (distance < minDistance) {
      minDistance = distance
      closestIndex = i
    }
  }
  
  return {
    index: closestIndex,
    distance: minDistance,
    point: route[closestIndex]
  }
}

// Navigasyon durumu hesapla
export function calculateNavigationState(
  currentLocation: RoutePoint,
  route: Route
): NavigationState {
  const closest = findClosestPointOnRoute(currentLocation, route.geometry)
  
  // Kalan mesafeyi hesapla
  let distanceRemaining = 0
  for (let i = closest.index; i < route.geometry.length - 1; i++) {
    distanceRemaining += haversineDistance(route.geometry[i], route.geometry[i + 1])
  }
  
  // Kalan süreyi tahmin et
  const progress = closest.index / route.geometry.length
  const durationRemaining = route.duration * (1 - progress)
  
  // Mevcut adımı bul
  let currentStep = 0
  let stepDistance = 0
  for (let i = 0; i < route.legs.length; i++) {
    const leg = route.legs[i]
    for (let j = 0; j < leg.steps.length; j++) {
      if (stepDistance + leg.steps[j].distance > distanceRemaining) {
        currentStep = i * 100 + j
        break
      }
      stepDistance += leg.steps[j].distance
    }
  }
  
  // Sonraki talimat
  let nextInstruction: string | null = null
  for (const leg of route.legs) {
    for (const step of leg.steps) {
      if (step.distance > distanceRemaining * 0.1) { // %10 içindeki bir sonraki adım
        nextInstruction = translateInstruction(step)
        break
      }
    }
    if (nextInstruction) break
  }
  
  return {
    route,
    currentStep,
    distanceRemaining,
    durationRemaining,
    nextInstruction
  }
}

// Haversine mesafe
function haversineDistance(a: RoutePoint, b: RoutePoint): number {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
