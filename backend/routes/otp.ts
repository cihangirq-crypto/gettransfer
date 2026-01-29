import { Router, type Request, type Response } from 'express'
import { createGuestToken } from '../services/guestToken.js'
import { normalizePhoneE164, sendOtpSms, verifyOtpSms } from '../services/twilioVerify.js'

const router = Router()

const otpLimiter: Map<string, { tokens: number, last: number }> = new Map()
const cap = 6
const refillPerMs = cap / (10 * 60 * 1000)

const takeToken = (key: string) => {
  const now = Date.now()
  const st = otpLimiter.get(key) || { tokens: cap, last: now }
  const delta = Math.max(0, now - st.last)
  st.tokens = Math.min(cap, st.tokens + delta * refillPerMs)
  st.last = now
  if (st.tokens < 1) { otpLimiter.set(key, st); return false }
  st.tokens -= 1
  otpLimiter.set(key, st)
  return true
}

router.post('/send', async (req: Request, res: Response) => {
  const phoneRaw = String(req.body?.phone || '').trim()
  const phone = normalizePhoneE164(phoneRaw)
  if (!phone) { res.status(400).json({ success: false, error: 'invalid_phone' }); return }
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'local'
  const key = `${ip}|${phone}`
  if (!takeToken(key)) { res.status(429).json({ success: false, error: 'rate_limited' }); return }
  try {
    const r = await sendOtpSms(phone)
    if (!r.ok) {
      const classification = (r as any).classification
      if (classification === 'trial_verified_only' || classification === 'recipient_not_verified') {
        res.status(409).json({ success: false, error: classification })
        return
      }
      if (classification === 'geo_permission') {
        res.status(403).json({ success: false, error: 'geo_permission' })
        return
      }
      res.status(502).json({ success: false, error: r.error })
      return
    }
    res.json({ success: true })
  } catch {
    res.status(500).json({ success: false, error: 'otp_send_failed' })
  }
})

router.post('/verify', async (req: Request, res: Response) => {
  const phoneRaw = String(req.body?.phone || '').trim()
  const otp = String(req.body?.code || '').trim()
  const phone = normalizePhoneE164(phoneRaw)
  if (!phone || otp.length < 4) { res.status(400).json({ success: false, error: 'invalid_payload' }); return }
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'local'
  const key = `verify|${ip}|${phone}`
  if (!takeToken(key)) { res.status(429).json({ success: false, error: 'rate_limited' }); return }
  try {
    const r = await verifyOtpSms(phone, otp)
    if (!r.ok) {
      const classification = (r as any).classification
      if (classification === 'trial_verified_only' || classification === 'recipient_not_verified') {
        res.status(409).json({ success: false, error: classification })
        return
      }
      if (r.error === 'invalid_code') {
        res.status(401).json({ success: false, error: 'invalid_code' })
        return
      }
      res.status(401).json({ success: false, error: r.error })
      return
    }
    const guestToken = createGuestToken(phone, 20 * 60_000)
    res.json({ success: true, data: { guestToken, phone } })
  } catch {
    res.status(500).json({ success: false, error: 'otp_verify_failed' })
  }
})

export default router

