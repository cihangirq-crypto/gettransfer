import type { VercelRequest, VercelResponse } from '@vercel/node'

const popular: Map<string, number> = new Map()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ success: false, error: 'method_not_allowed' }); return }
  try {
    const { label } = req.body || {}
    if (!label) { res.status(400).json({ success: false, error: 'invalid_payload' }); return }
    popular.set(label, (popular.get(label) || 0) + 1)
    res.status(200).json({ success: true })
  } catch (e) { res.status(500).json({ success: false, error: 'server_error' }) }
}
