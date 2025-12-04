/**
 * This is a user authentication API route demo.
 * Handle user registration, login, token management, etc.
 */
import { Router, type Request, type Response } from 'express'

const router = Router()

// Mock register (customer)
router.post('/register/customer', async (req: Request, res: Response): Promise<void> => {
  const { email = 'customer@example.com', name = 'Müşteri' } = req.body || {}
  const user = {
    id: 'cust_' + Date.now(), email, name, phone: '', role: 'customer', isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  }
  res.json({ success: true, data: { user, token: 'mock-token', refreshToken: 'mock-refresh' } })
})

// Mock register (driver)
router.post('/register/driver', async (req: Request, res: Response): Promise<void> => {
  const { email = 'driver@example.com', name = 'Sürücü' } = req.body || {}
  const user = {
    id: 'drv_' + Date.now(), email, name, phone: '', role: 'driver', isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  }
  res.json({ success: true, data: { user, token: 'mock-token', refreshToken: 'mock-refresh' } })
})

// Mock login with test driver account
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email = 'user@example.com', password = '', userType = 'customer' } = req.body || {}
  
  if (email === 'fatih@test.com' && password === '123456') {
    const user = { id: 'drv_fatih', email, name: 'fatih', phone: '', role: 'driver', isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    res.json({ success: true, data: { user, token: 'mock-token', refreshToken: 'mock-refresh' } })
    return
  }
  if (email === 'vedat@test.com' && password === '123456') {
    const user = { id: 'drv_vedat', email, name: 'vedat', phone: '', role: 'driver', isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    res.json({ success: true, data: { user, token: 'mock-token', refreshToken: 'mock-refresh' } })
    return
  }
  if (email === 'cihangircelik@hotmail.com' && password === '123456' && userType === 'customer') {
    const user = { id: 'cust_cihangir', email, name: 'Cihangir Çelik', phone: '', role: 'customer', isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    res.json({ success: true, data: { user, token: 'mock-token', refreshToken: 'mock-refresh' } })
    return
  }
  
  const role = userType === 'driver' ? 'driver' : 'customer'
  const user = {
    id: (role === 'driver' ? 'drv_' : 'cust_') + Date.now(), email, name: role === 'driver' ? 'Sürücü' : 'Müşteri', phone: '', role, isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  }
  res.json({ success: true, data: { user, token: 'mock-token', refreshToken: 'mock-refresh' } })
})

router.post('/logout', async (_req: Request, res: Response): Promise<void> => {
  res.json({ success: true })
})

export default router
