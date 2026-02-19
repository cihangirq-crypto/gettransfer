# 🚀 Real-Time Transfer Sistemi - Teknoloji Önerisi

## 📊 Araştırma Raporu

### 1. Real-Time Sistem Karşılaştırması

| Özellik | Pusher | Supabase Realtime | Firebase | Socket.io (WebSocket) |
|---------|--------|-------------------|----------|----------------------|
| **Serverless Desteği** | ✅ Mükemmel | ✅ Mükemmel | ✅ Mükemmel | ❌ Sınırlı |
| **Kurulum Zorluğu** | Kolay | Orta | Kolay | Zor |
| **Ücretsiz Katman** | 200k mesaj/gün | 500k mesaj/gün | 1GB veri/gün | Sınırsız* |
| **Latency** | ~100ms | ~150ms | ~100ms | ~50ms |
| **Scale** | Auto | Auto | Auto | Manuel |
| **Türkiye Erişimi** | ✅ | ✅ | ✅ | ✅ |

**\*Not:** Socket.io serverless'ta ek maliyet gerektirir (Redis adapter, ayrı sunucu vb.)

---

## 🏆 ÖNERİLEN ÇÖZÜM: Supabase Realtime

### Neden Supabase?

1. **Zaten Kullanıyorsunuz** - Ek kurulum gerekmez
2. **PostgreSQL Entegrasyonu** - Veritabanı değişikliklerini otomatik dinleme
3. **Ücretsiz Katman** - 500k mesaj/gün (yeterli)
4. **Broadcast + Presence** - Her iki özellik de mevcut
5. **Serverless Uyumlu** - Vercel ile sorunsuz çalışır

---

## 📱 Önerilen Mimari

```
┌─────────────────────────────────────────────────────────────────┐
│                        MÜŞTERİ AKIŞI                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Talep Oluştur ──► POST /api/bookings/create                │
│         │                                                       │
│         ▼                                                       │
│  2. Supabase Broadcast ──► "new_request" kanalı                │
│         │                                                       │
│         ▼                                                       │
│  3. Müşteri bekler ──► Supabase Realtime subscription          │
│         │                                                       │
│         ▼                                                       │
│  4. Sürücü kabul eder ──► Booking durumu "accepted"            │
│         │                                                       │
│         ▼                                                       │
│  5. Müşteri anında görür ──► Real-time notification            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        SÜRÜCÜ AKIŞI                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Dashboard aç ──► Supabase "requests" kanalına bağlan       │
│         │                                                       │
│         ▼                                                       │
│  2. Yeni talep gelir ──► Real-time "new_request" event         │
│         │                                                       │
│         ▼                                                       │
│  3. Kabul et ──► POST /api/bookings/:id/accept                 │
│         │                                                       │
│         ▼                                                       │
│  4. Navigasyon başlat ──► Leaflet + OSRM rota                  │
│         │                                                       │
│         ▼                                                       │
│  5. Konum paylaş ──► Supabase Presence (her 5sn)               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Implementation

### A. Supabase Realtime Kurulumu

```typescript
// src/lib/supabase-realtime.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Kanal türleri
export const CHANNELS = {
  REQUESTS: 'transfer-requests',      // Yeni talepler
  BOOKING_PREFIX: 'booking-',         // Booking durumu
  DRIVER_LOCATION: 'driver-location'  // Sürücü konumu
}
```

### B. Müşteri Tarafı - Talep Gönderme

```typescript
// src/stores/bookingStore.ts (güncellenmiş)

import { supabase, CHANNELS } from '@/lib/supabase-realtime'

// Yeni talep oluştur
const createRequest = async (data: BookingRequest) => {
  // 1. Veritabanına kaydet
  const response = await fetch(`${API}/bookings/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  
  const booking = await response.json()
  
  // 2. Broadcast ile tüm sürücüleri bilgilendir
  const channel = supabase.channel(CHANNELS.REQUESTS)
  await channel.send({
    type: 'broadcast',
    event: 'new_request',
    payload: booking.data
  })
  
  // 3. Bu booking için kanala abone ol
  subscribeToBooking(booking.data.id)
  
  return booking.data
}

// Booking durumunu dinle
const subscribeToBooking = (bookingId: string) => {
  const channel = supabase.channel(`${CHANNELS.BOOKING_PREFIX}${bookingId}`)
  
  channel
    .on('broadcast', { event: 'status_update' }, (payload) => {
      set({ currentBooking: payload })
    })
    .on('broadcast', { event: 'driver_location' }, (payload) => {
      // Sürücü konumu güncelle
      set((state) => ({
        currentBooking: state.currentBooking 
          ? { ...state.currentBooking, driverLocation: payload }
          : null
      }))
    })
    .subscribe()
}
```

### C. Sürücü Tarafı - Talep Dinleme

```typescript
// src/hooks/useDriverRequests.ts

import { supabase, CHANNELS } from '@/lib/supabase-realtime'
import { useEffect, useState } from 'react'

export const useDriverRequests = () => {
  const [requests, setRequests] = useState<Booking[]>([])
  const [driverLocation, setDriverLocation] = useState<Location | null>(null)
  
  useEffect(() => {
    // Yeni talepleri dinle
    const channel = supabase.channel(CHANNELS.REQUESTS)
    
    channel
      .on('broadcast', { event: 'new_request' }, (payload) => {
        // Sadece yakındaki talepleri göster
        if (driverLocation && isNearby(payload.pickupLocation, driverLocation, 10)) {
          setRequests((prev) => [...prev, payload])
          // Bildirim çal
          playNotificationSound()
        }
      })
      .subscribe()
    
    // Konum paylaş (Presence)
    const locationChannel = supabase.channel(CHANNELS.DRIVER_LOCATION)
    
    const shareLocation = setInterval(() => {
      navigator.geolocation.getCurrentPosition((pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setDriverLocation(loc)
        
        locationChannel.track({
          driver_id: currentDriver.id,
          location: loc,
          online_at: new Date().toISOString()
        })
      })
    }, 5000) // Her 5 saniye
    
    return () => {
      channel.unsubscribe()
      locationChannel.unsubscribe()
      clearInterval(shareLocation)
    }
  }, [driverLocation])
  
  const acceptRequest = async (bookingId: string) => {
    // 1. API'ye kabul et
    await fetch(`${API}/bookings/${bookingId}/accept`, { method: 'POST' })
    
    // 2. Broadcast ile müşteriye bildir
    const channel = supabase.channel(`${CHANNELS.BOOKING_PREFIX}${bookingId}`)
    await channel.send({
      type: 'broadcast',
      event: 'status_update',
      payload: { status: 'accepted', driverId: currentDriver.id }
    })
    
    // 3. Taleplerden kaldır
    setRequests((prev) => prev.filter((r) => r.id !== bookingId))
  }
  
  return { requests, acceptRequest }
}

const isNearby = (loc1: Location, loc2: Location, maxKm: number) => {
  const R = 6371
  const dLat = (loc2.lat - loc1.lat) * Math.PI / 180
  const dLng = (loc2.lng - loc1.lng) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(loc1.lat * Math.PI / 180) * 
            Math.cos(loc2.lat * Math.PI / 180) * Math.sin(dLng/2)**2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c <= maxKm
}
```

### D. Navigasyon - Uygulama İçi Rota

```typescript
// src/components/InAppNavigation.tsx

import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet'
import { useEffect, useState, useRef } from 'react'
import L from 'leaflet'

interface NavigationProps {
  pickup: Location
  dropoff: Location
  driverLocation: Location
  onArrival?: () => void
}

export const InAppNavigation: React.FC<NavigationProps> = ({
  pickup,
  dropoff,
  driverLocation,
  onArrival
}) => {
  const [route, setRoute] = useState<Location[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [eta, setEta] = useState<number>(0)
  const [distance, setDistance] = useState<number>(0)
  const [navigationMode, setNavigationMode] = useState<'to_pickup' | 'to_dropoff'>('to_pickup')
  const mapRef = useRef<L.Map | null>(null)
  
  // OSRM'den rota al
  useEffect(() => {
    const fetchRoute = async () => {
      const start = navigationMode === 'to_pickup' ? driverLocation : pickup
      const end = navigationMode === 'to_pickup' ? pickup : dropoff
      
      // Birden fazla OSRM sunucusu (fallback)
      const servers = [
        'https://router.project-osrm.org',
        'https://routing.openstreetmap.de/routed-car'
      ]
      
      for (const server of servers) {
        try {
          const url = `${server}/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true`
          
          const response = await fetch(url, {
            headers: { 'User-Agent': 'GetTransfer-App/1.0' }
          })
          
          if (!response.ok) continue
          
          const data = await response.json()
          
          if (data.code === 'Ok') {
            const coordinates = data.routes[0].geometry.coordinates.map(
              ([lng, lat]: [number, number]) => ({ lat, lng })
            )
            setRoute(coordinates)
            setEta(Math.ceil(data.routes[0].duration / 60))
            setDistance((data.routes[0].distance / 1000).toFixed(1) as any)
            
            // Haritayı rotaya odakla
            if (mapRef.current) {
              const bounds = L.latLngBounds(coordinates.map(c => [c.lat, c.lng]))
              mapRef.current.fitBounds(bounds, { padding: [50, 50] })
            }
            break
          }
        } catch (error) {
          console.warn(`OSRM server ${server} failed:`, error)
        }
      }
    }
    
    fetchRoute()
  }, [driverLocation, pickup, dropoff, navigationMode])
  
  // Varış kontrolü
  useEffect(() => {
    const target = navigationMode === 'to_pickup' ? pickup : dropoff
    const dist = calculateDistance(driverLocation, target)
    
    if (dist < 0.05) { // 50 metre
      if (navigationMode === 'to_pickup') {
        setNavigationMode('to_dropoff')
        onArrival?.()
      } else {
        // Yolculuk tamamlandı
        onArrival?.()
      }
    }
  }, [driverLocation, navigationMode])
  
  // Konum takibi
  useEffect(() => {
    if (mapRef.current && driverLocation) {
      mapRef.current.setView([driverLocation.lat, driverLocation.lng], 16)
    }
  }, [driverLocation])
  
  return (
    <div className="relative h-full w-full">
      {/* Harita */}
      <MapContainer
        center={[driverLocation.lat, driverLocation.lng]}
        zoom={16}
        className="h-full w-full"
        ref={mapRef as any}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        
        {/* Rota çizgisi */}
        {route.length > 0 && (
          <Polyline
            positions={route.map(c => [c.lat, c.lng])}
            color={navigationMode === 'to_pickup' ? '#3b82f6' : '#22c55e'}
            weight={5}
            opacity={0.8}
          />
        )}
        
        {/* Sürücü marker */}
        <Marker 
          position={[driverLocation.lat, driverLocation.lng]}
          icon={createNavigationIcon()}
        />
        
        {/* Hedef marker */}
        <Marker 
          position={[
            navigationMode === 'to_pickup' ? pickup.lat : dropoff.lat,
            navigationMode === 'to_pickup' ? pickup.lng : dropoff.lng
          ]}
          icon={createDestinationIcon()}
        />
      </MapContainer>
      
      {/* Navigasyon Bilgi Paneli */}
      <div className="absolute bottom-0 left-0 right-0 bg-white shadow-lg rounded-t-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm text-gray-500">
              {navigationMode === 'to_pickup' ? 'Müşteriye gidiliyor' : 'Hedefe gidiliyor'}
            </p>
            <p className="text-2xl font-bold">{eta} dk</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Mesafe</p>
            <p className="text-lg font-semibold">{distance} km</p>
          </div>
        </div>
        
        {/* Sonraki dönüş bilgisi */}
        <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-3">
          <span className="text-2xl">↗️</span>
          <div>
            <p className="font-medium">Sonraki dönüş</p>
            <p className="text-sm text-gray-600">200m sonra sağa dön</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Yardımcı fonksiyonlar
const createNavigationIcon = () => {
  return L.divIcon({
    html: `<div class="navigation-arrow">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="#3b82f6">
        <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
      </svg>
    </div>`,
    className: 'navigation-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  })
}

const calculateDistance = (a: Location, b: Location): number => {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const x = Math.sin(dLat/2)**2 + Math.cos(a.lat * Math.PI / 180) * 
            Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))
}
```

---

## 🗺️ Navigasyon Karşılaştırması

| Özellik | Google Maps API | Mapbox | Leaflet + OSRM |
|---------|-----------------|--------|----------------|
| **Ücretsiz Kullanım** | $200 kredi/ay | 50k request/ay | ✅ Sınırsız |
| **Rota Kalitesi** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Uygulama İçi Nav** | ✅ (pahalı) | ✅ | ✅ (ücretsiz) |
| **Türkiye Kapsama** | ✅ Mükemmel | ✅ İyi | ✅ İyi |
| **Offline Desteği** | ❌ | ✅ | ✅ |
| **Trafik Bilgisi** | ✅ | ✅ | ❌ |
| **Maliyet (10k request)** | ~$50 | ~$50 | $0 |

### Öneri: Leaflet + OSRM + Opsiyonel Mapbox

**Neden?**
1. **Ücretsiz** - OSRM ile sınırsız rota hesaplama
2. **Uygulama İçi** - Yeni pencere açılmıyor
3. **Yeterli Kalite** - Türkiye'de iyi çalışıyor
4. **Yedekleme** - Mapbox fallback olarak kullanılabilir

---

## 💰 Maliyet Analizi

### Senaryo: 1000 günlük yolculuk

| Hizmet | Maliyet |
|--------|---------|
| **Supabase Realtime** | $0 (ücretsiz katman) |
| **OSRM Rotalama** | $0 |
| **Vercel Hosting** | $0-20/ay |
| **Supabase DB** | $0-25/ay |
| **TOPLAM** | **$0-45/ay** |

### Karşılaştırma (aylık)

| Çözüm | Maliyet |
|-------|---------|
| Firebase + Google Maps | ~$150-300 |
| Pusher + Mapbox | ~$100-200 |
| **Supabase + OSRM** | **$0-45** |

---

## 🚀 Hızlı Başlangıç

### 1. Supabase Realtime Aktif Et

```sql
-- Supabase Dashboard > Database > Replication
-- realtime şemasını aktif et
CREATE PUBLICATION realtime FOR ALL TABLES;
```

### 2. Environment Variables

```env
# .env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

### 3. Kurulum

```bash
# Zaten kurulu, ekstra gerek yok
npm install
```

---

## 📝 Özet

### ✅ Önerilen Stack

| Katman | Teknoloji | Neden? |
|--------|-----------|--------|
| **Real-time** | Supabase Realtime | Ücretsiz, entegre, serverless uyumlu |
| **Harita** | Leaflet + React-Leaflet | Ücretsiz, hafif, esnek |
| **Rotalama** | OSRM (fallback: Mapbox) | Ücretsiz, iyi kalite |
| **Hosting** | Vercel | Zaten kullanılıyor |
| **Veritabanı** | Supabase PostgreSQL | Zaten kullanılıyor |

### 🔄 Mevcut Durum vs Önerilen

| Özellik | Mevcut | Önerilen |
|---------|--------|----------|
| Real-time | Socket.io + Polling | Supabase Realtime |
| Harita | Google Maps + Leaflet | Leaflet (primary) |
| Rota | OSRM | OSRM (optimize edilmiş) |
| Maliyet | ~$50-100/ay | ~$0-25/ay |

### 🎯 Sonraki Adımlar

1. ✅ Supabase Realtime entegrasyonu
2. ✅ Navigasyon bileşeni geliştirme
3. ✅ Sürücü bildirim sistemi
4. ✅ Test ve optimizasyon

---

## 📞 Destek

Sorular için GitHub Issues kullanabilirsiniz.
