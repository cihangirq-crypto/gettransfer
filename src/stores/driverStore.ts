import { create } from 'zustand'
import { API } from '@/utils/api'

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
}

export const useDriverStore = create<DriverState>()((set, get) => ({
  me: null,
  approved: undefined,
  rejectedReason: undefined,
  earnings: null,
  requests: [],
  register: async (session) => {
    const res = await fetch(`${API}/drivers/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session)
    })
    if (!res.ok) throw new Error('register_failed')
    set({ me: session })
  },
  refreshRequests: async () => {
    const res = await fetch(`${API}/drivers/requests`)
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error('requests_failed')
    set({ requests: data.data })
  },
  updateLocation: async (loc) => {
    const { me } = get()
    if (!me) return
    const res = await fetch(`${API}/drivers/location`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: me.id, location: loc })
    })
    if (!res.ok) throw new Error('location_failed')
    set({ me: { ...me, location: loc } })
  },
  accept: async (requestId) => {
    const { me } = get()
    if (!me) throw new Error('not_registered')
    const res = await fetch(`${API}/drivers/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ driverId: me.id, requestId })
    })
    if (!res.ok) throw new Error('accept_failed')
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
    const resApproved = await fetch(`${API}/drivers/list?status=approved`)
    const resPending = await fetch(`${API}/drivers/list?status=pending`)
    const a = await resApproved.json()
    const p = await resPending.json()
    const isApproved = Array.isArray(a.data) && !!a.data.find((d: any) => d.id === me.id)
    const isPending = Array.isArray(p.data) && !!p.data.find((d: any) => d.id === me.id)
    set({ approved: isApproved, rejectedReason: isApproved ? undefined : (isPending ? undefined : 'unspecified') })
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
}))
