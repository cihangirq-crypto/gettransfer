/**
 * Supabase Realtime Service
 * Serverless ortamında çalışan real-time iletişim
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

// Supabase config
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://huayayzxcojufskkrayg.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1YXlheXp4Y29qdWZza2tyYXlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MjU2MzAsImV4cCI6MjA4MDUwMTYzMH0.0wP58QloN2ohLfzuSF79KghiL8yIzaM9fLuPgpGA80c'

// Singleton client
let supabaseClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
  }
  return supabaseClient
}

// Booking durum değişikliklerini dinle
export function subscribeToBooking(
  bookingId: string,
  onUpdate: (booking: any) => void
): RealtimeChannel {
  const client = getSupabaseClient()
  
  return client
    .channel(`booking:${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${bookingId}`
      },
      (payload) => {
        console.log('Booking update:', payload)
        onUpdate(payload.new)
      }
    )
    .subscribe()
}

// Tüm yeni booking'leri dinle (sürücüler için)
// Vehicle type filtresi YOK - tüm sürücüler tüm talepleri duyar
export function subscribeToNewBookings(
  _vehicleType: string | null, // parametre artık kullanılmıyor
  onNew: (booking: any) => void
): RealtimeChannel {
  const client = getSupabaseClient()
  
  const channel = client.channel('new-bookings')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'bookings'
      },
      (payload) => {
        if (payload.new.status === 'pending') {
          console.log('New booking:', payload.new)
          onNew(payload.new)
        }
      }
    )
  
  return channel.subscribe()
}

// Sürücü konumunu broadcast et
export function broadcastDriverLocation(
  bookingId: string,
  location: { lat: number; lng: number }
): void {
  const client = getSupabaseClient()
  
  client.channel(`booking:${bookingId}`)
    .send({
      type: 'broadcast',
      event: 'driver_location',
      payload: { location }
    })
}

// Sürücü konumunu dinle (müşteriler için)
export function subscribeToDriverLocation(
  bookingId: string,
  onLocation: (location: { lat: number; lng: number }) => void
): RealtimeChannel {
  const client = getSupabaseClient()
  
  return client
    .channel(`booking:${bookingId}`)
    .on('broadcast', { event: 'driver_location' }, (payload) => {
      console.log('Driver location:', payload)
      onLocation(payload.payload.location)
    })
    .subscribe()
}

// Müşteri konumunu broadcast et
export function broadcastCustomerLocation(
  bookingId: string,
  location: { lat: number; lng: number }
): void {
  const client = getSupabaseClient()
  
  client.channel(`booking:${bookingId}`)
    .send({
      type: 'broadcast',
      event: 'customer_location',
      payload: { location }
    })
}

// Sürücü durum değişikliklerini dinle
export function subscribeToDriverUpdates(
  onUpdate: (driver: any) => void
): RealtimeChannel {
  const client = getSupabaseClient()
  
  return client
    .channel('driver-updates')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'drivers'
      },
      (payload) => {
        console.log('Driver update:', payload)
        onUpdate(payload.new)
      }
    )
    .subscribe()
}

// Channel'den çık
export function unsubscribe(channel: RealtimeChannel | null): void {
  if (channel) {
    channel.unsubscribe()
  }
}
