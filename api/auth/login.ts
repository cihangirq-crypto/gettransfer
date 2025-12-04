import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'method_not_allowed' })
    return
  }
  try {
    const { email = 'user@example.com', password = '', userType = 'customer' } = req.body || {}
    if (email === 'test@taksi.com' && password === '123456' && userType === 'driver') {
      const user = {
        id: 'drv_test', email, name: 'Test Sürücü', phone: '', role: 'driver', isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      }
      res.status(200).json({ success: true, data: { user, token: 'mock-token', refreshToken: 'mock-refresh' } })
      return
    }
    const role = userType === 'driver' ? 'driver' : 'customer'
    const user = {
      id: (role === 'driver' ? 'drv_' : 'cust_') + Date.now(), email, name: role === 'driver' ? 'Sürücü' : 'Müşteri', phone: '', role, isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    }
    res.status(200).json({ success: true, data: { user, token: 'mock-token', refreshToken: 'mock-refresh' } })
  } catch (e) {
    res.status(500).json({ success: false, error: 'server_error' })
  }
}
