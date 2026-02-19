import { Router, type Request, type Response } from 'express'
import { bootstrapSupabaseSchema, checkBookingsTable } from '../services/supabaseBootstrap.js'

const router = Router()

const getToken = () => {
  const v = process.env.BOOTSTRAP_TOKEN
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

const authorized = (req: Request) => {
  const tok = getToken()
  if (!tok) return false
  const got = String(req.headers['x-bootstrap-token'] || '').trim()
  return got && got === tok
}

router.post('/bootstrap', async (req: Request, res: Response) => {
  if (!getToken()) { res.status(404).json({ success: false, error: 'disabled' }); return }
  if (!authorized(req)) { res.status(401).json({ success: false, error: 'unauthorized' }); return }
  const r = await bootstrapSupabaseSchema()
  if (!r.ok) { res.status(500).json({ success: false, error: r.error, reason: (r as any).reason }); return }
  res.json({ success: true, data: r })
})

router.get('/bootstrap/status', async (req: Request, res: Response) => {
  if (!getToken()) { res.status(404).json({ success: false, error: 'disabled' }); return }
  if (!authorized(req)) { res.status(401).json({ success: false, error: 'unauthorized' }); return }
  const r = await checkBookingsTable()
  if (!r.ok) { res.status(500).json({ success: false, error: r.error, reason: (r as any).reason }); return }
  res.json({ success: true, data: r })
})

export default router

