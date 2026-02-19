const getEnv = (k: string) => {
  const v = process.env[k]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export type TwilioVerifyConfig = {
  authUser: string
  authPass: string
  verifyServiceSid: string
}

export const getTwilioVerifyConfig = (): TwilioVerifyConfig | null => {
  const verifyServiceSid = getEnv('TWILIO_VERIFY_SERVICE_SID')
  const apiKeySid = getEnv('TWILIO_API_KEY_SID')
  const apiKeySecret = getEnv('TWILIO_API_KEY_SECRET')
  const accountSid = getEnv('TWILIO_ACCOUNT_SID')
  const authToken = getEnv('TWILIO_AUTH_TOKEN')
  if (!verifyServiceSid) return null
  if (apiKeySid && apiKeySecret) return { authUser: apiKeySid, authPass: apiKeySecret, verifyServiceSid }
  if (accountSid && authToken) return { authUser: accountSid, authPass: authToken, verifyServiceSid }
  return null
}

const toBasic = (user: string, pass: string) => {
  return Buffer.from(`${user}:${pass}`).toString('base64')
}

const parseTwilioFailure = async (res: Response) => {
  const ct = (res.headers.get('content-type') || '').toLowerCase()
  if (ct.includes('application/json')) {
    const j: any = await res.json().catch(() => null)
    if (j && (typeof j.code === 'number' || typeof j.status === 'number' || typeof j.message === 'string')) {
      return { kind: 'json' as const, code: typeof j.code === 'number' ? j.code : undefined, status: typeof j.status === 'number' ? j.status : undefined, message: typeof j.message === 'string' ? j.message : undefined }
    }
  }
  const txt = await res.text().catch(() => '')
  return { kind: 'text' as const, text: txt }
}

const classifyTwilioFailure = (f: any) => {
  const msg = String(f?.message || f?.text || '').toLowerCase()
  if (msg.includes('trial') && msg.includes('verified')) return 'trial_verified_only'
  if (msg.includes('verified') && msg.includes('phone')) return 'recipient_not_verified'
  if (msg.includes('not a valid') || msg.includes('invalid') && msg.includes('phone')) return 'invalid_phone'
  if (msg.includes('permission') || msg.includes('geo')) return 'geo_permission'
  return 'unknown'
}

export const normalizePhoneE164 = (raw: string) => {
  const s = String(raw || '').trim().replace(/\s+/g, '')
  if (!s) return null
  if (s.startsWith('+')) return s
  const digits = s.replace(/[^\d]/g, '')
  if (!digits) return null
  if (digits.startsWith('90') && digits.length >= 12) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 11) return `+90${digits.slice(1)}`
  if (digits.startsWith('5') && digits.length === 10) return `+90${digits}`
  if (digits.length >= 10) return `+${digits}`
  return null
}

export async function sendOtpSms(toPhoneE164: string) {
  const cfg = getTwilioVerifyConfig()
  if (!cfg) return { ok: false as const, error: 'twilio_not_configured' as const }
  const url = `https://verify.twilio.com/v2/Services/${encodeURIComponent(cfg.verifyServiceSid)}/Verifications`
  const body = new URLSearchParams({ To: toPhoneE164, Channel: 'sms' })
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${toBasic(cfg.authUser, cfg.authPass)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })
  if (!res.ok) {
    const failure = await parseTwilioFailure(res)
    return { ok: false as const, error: 'twilio_send_failed' as const, failure, classification: classifyTwilioFailure(failure) }
  }
  return { ok: true as const }
}

export async function verifyOtpSms(toPhoneE164: string, code: string) {
  const cfg = getTwilioVerifyConfig()
  if (!cfg) return { ok: false as const, error: 'twilio_not_configured' as const }
  const url = `https://verify.twilio.com/v2/Services/${encodeURIComponent(cfg.verifyServiceSid)}/VerificationCheck`
  const body = new URLSearchParams({ To: toPhoneE164, Code: String(code || '').trim() })
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${toBasic(cfg.authUser, cfg.authPass)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })
  if (!res.ok) {
    const failure = await parseTwilioFailure(res)
    return { ok: false as const, error: 'twilio_verify_failed' as const, failure, classification: classifyTwilioFailure(failure) }
  }
  const j: any = await res.json().catch(() => null)
  if (j?.status === 'approved') return { ok: true as const }
  return { ok: false as const, error: 'invalid_code' as const, status: j?.status }
}

