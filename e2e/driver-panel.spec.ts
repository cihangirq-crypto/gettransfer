import { test, expect } from '@playwright/test'

test('Sürücü paneli: giriş ve bekleyen çağrılar görünür', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 41.0082, longitude: 28.9784 })

  await page.goto('http://localhost:4173/')
  await page.evaluate(() => {
    const state = {
      user: { id: 'drv_test', email: 'test@taksi.com', name: 'Test Sürücü', phone: '', role: 'driver', isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      token: 'mock-token',
      refreshToken: 'mock-refresh',
    }
    localStorage.setItem('auth-storage', JSON.stringify({ state }))
  })
  await page.goto('http://localhost:4173/driver/dashboard')
  const header = page.getByRole('heading', { name: 'Sürücü Paneli' })
  await expect(header).toBeVisible()
})
