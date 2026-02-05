import { create } from 'zustand'
import { API } from '@/utils/api'
import { io as ioClient, Socket } from 'socket.io-client'

const haversineMeters = (a: { lat: number, lng: number }, b: { lat: number, lng: number }) => {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const la1 = a.lat * Math.PI / 180
  const la2 = b.lat * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

let lastLocationSentAt = 0
let lastLocationSent: { lat: number, lng: number } | null = null
const MIN_LOCATION_SEND_INTERVAL_MS = 1000
const MIN_LOCATION_SEND_DISTANCE_M = 10

type DriverSession = {
  id: string
  name: string
  vehicleType: 'sedan' | 'suv' | 'van' | 'luxury'
  location: { lat: number, lng: number }
  available: boolean
  vehicleModel?: string
  licensePlate?: string
}

type DriverState = {
  me: DriverSession | null
  approved?: boolean
  rejectedReason?: string
  earnings?: { currency: string, daily: number, weekly: number, monthly: number, generatedAt: string } | null
  requests: Array<{
    id: string
    customerId: string
    pickup: { lat: number, lng: number, address: string }
    dropoff: { lat: number, lng: number, address: string }
    vehicleType: 'sedan' | 'suv' | 'van' | 'luxury'
  }>
  register: (session: DriverSession) => Promise<void>
  refreshRequests: () => Promise<void>
  updateLocation: (loc: { lat: number, lng: number }) => Promise<void>
  accept: (requestId: string) => Promise<void>
  setAvailable: (available: boolean) => Promise<void>
  refreshApproval: () => Promise<void>
  fetchEarnings: () => Promise<void>
  submitComplaint: (text: string) => Promise<void>
  updateProfile: (patch: Partial<{ name: string, vehicleModel: string, licensePlate: string }>) => Promise<void>
  startRealtime: () => void
  socket?: Socket | null
  isConnected?: boolean
}

export const useDriverStore = create<DriverState>()((set, get) => ({
  me: null,
  approved: undefined,
  rejectedReason: undefined,
  earnings: null,
  requests: [],
  socket: null,
  isConnected: false,
  register: async (session) => {
    const res = await fetch(`${API}/drivers/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session)
    })
    if (!res.ok) throw new Error('register_failed')
    set({ me: session })
    get().startRealtime()
  },
  refreshRequests: async () => {
    const { me } = get()
    const url = me?.vehicleType ? `${API}/drivers/requests?vehicleType=${me.vehicleType}` : `${API}/drivers/requests`
    const res = await fetch(url)
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error('requests_failed')
    const arr = Array.isArray(data.data) ? data.data : []
    const dedup = Array.from(new Map<string, any>(arr.map((x:any)=>[x.id,x])).values())
    set({ requests: dedup as any })
  },
  updateLocation: async (loc) => {
    const { me } = get()
    if (!me) return
    // Optimistic update
    set({ me: { ...me, location: loc } })
    try {
      const now = Date.now()
      if (lastLocationSent && now - lastLocationSentAt < MIN_LOCATION_SEND_INTERVAL_MS) {
        const dist = haversineMeters(lastLocationSent, loc)
        if (dist < MIN_LOCATION_SEND_DISTANCE_M) return
      }
      lastLocationSentAt = now
      lastLocationSent = loc
      await fetch(`${API}/drivers/location`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: me.id, location: loc })
      })
    } catch {}
  },
  accept: async (requestId) => {
    const { me } = get()
    if (!me) throw new Error('not_registered')
    const res = await fetch(`${API}/drivers/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ driverId: me.id, requestId })
    })
    if (!res.ok) throw new Error('accept_failed')
    set({ me: { ...me, available: false } })
  },
  setAvailable: async (available) => {
    const { me } = get()
    if (!me) return
    const res = await fetch(`${API}/drivers/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: me.id, available })
    })
    if (!res.ok) throw new Error('status_failed')
    set({ me: { ...me, available } })
  },
  refreshApproval: async () => {
    const { me } = get()
    if (!me) return
    try {
        const resApproved = await fetch(`${API}/drivers/list?status=approved`)
        const a = await resApproved.json()
        const isApproved = Array.isArray(a.data) && !!a.data.find((d: any) => d.id === me.id)
        
        // If not approved, check if pending
        let isPending = false
        if (!isApproved) {
            const resPending = await fetch(`${API}/drivers/list?status=pending`)
            const p = await resPending.json()
            isPending = Array.isArray(p.data) && !!p.data.find((d: any) => d.id === me.id)
        }
        
        set({ approved: isApproved, rejectedReason: isApproved ? undefined : (isPending ? undefined : 'unspecified') })
    } catch {}
  },
  fetchEarnings: async () => {
    const { me } = get()
    if (!me) return
    const res = await fetch(`${API}/drivers/earnings/${me.id}`)
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error('earnings_failed')
    set({ earnings: data.data })
  },
  submitComplaint: async (text) => {
    const { me } = get()
    if (!me) throw new Error('not_registered')
    const res = await fetch(`${API}/drivers/complaints`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ driverId: me.id, text })
    })
    if (!res.ok) throw new Error('complaint_failed')
  },
  updateProfile: async (patch) => {
    const { me } = get()
    if (!me) throw new Error('not_registered')
    const res = await fetch(`${API}/drivers/profile`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: me.id, ...patch })
    })
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error('profile_update_failed')
    set({ me: { ...me, ...patch } as any })
  },
  startRealtime: () => {
    const { socket, me } = get()
    if (socket) return
    const origin = (import.meta.env.VITE_API_ORIGIN as string) || `http://${window.location.hostname}:3005`
    const s = ioClient(origin, { transports: ['websocket'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000 })
    
    s.on('connect', () => {
      set({ isConnected: true })
      get().refreshRequests()
    })
    s.on('disconnect', () => {
      set({ isConnected: false })
    })

    s.on('ride:request', (r: any) => {
      const { me } = get()
      if (me && r?.vehicleType === me?.vehicleType) {
        if (r?.targetDriverId && String(r.targetDriverId) !== me.id) return
        const { requests } = get()
        const next = requests.some((x)=>x.id===r.id)
          ? requests
          : [...requests, { id: r.id, customerId: r.customerId, pickup: r.pickup, dropoff: r.dropoff, vehicleType: r.vehicleType }]
        const dedup = Array.from(new Map<string, any>(next.map((x:any)=>[x.id,x])).values())
        set({ requests: dedup as any })
      }
    })
    s.on('ride:taken', (payload: any) => {
      const { requests } = get()
      // If someone else took the ride, remove it from my list immediately
      set({ requests: requests.filter((x)=>x.id !== payload.requestId) })
    })
    s.on('ride:accepted', (r: any) => {
      const { requests } = get()
      set({ requests: requests.filter((x)=>x.id!==r.id) })
    })
    s.on('ride:cancelled', (r: any) => {
      const { requests } = get()
      set({ requests: requests.filter((x)=>x.id!==r.id) })
    })
    set({ socket: s })
  }
}))
