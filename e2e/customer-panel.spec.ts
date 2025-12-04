import { test, expect } from '@playwright/test'

test.describe('Müşteri paneli', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 41.0082, longitude: 28.9784 })
  })

  test('Profil ve ödeme yönetimi görünür', async ({ page }) => {
    await page.goto('http://localhost:4173/')
    await page.evaluate(() => {
      const state = {
        user: { id: 'cust_demo', email: 'user@example.com', name: 'Demo Müşteri', phone: '', role: 'customer', isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        token: 'mock-token', refreshToken: 'mock-refresh'
      }
      localStorage.setItem('auth-storage', JSON.stringify({ state }))
    })
    await page.goto('http://localhost:4173/customer/dashboard')
    await expect(page.getByRole('heading', { name: 'Müşteri Paneli' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Müşteri Bilgileri' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ödeme Yöntemleri' })).toBeVisible()
  })
})
