import { test, expect } from '@playwright/test'
// Dev sunucusu HTTP altında çalışıyor

test.describe('Smoke: book-ride', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['geolocation'])
    await context.addCookies([{ name: 'allow_geolocation', value: '1', url: 'http://localhost:5173' }])
  })

  test('Harita ve konum yüklenir', async ({ page, context }) => {
    await context.setGeolocation({ latitude: 41.0082, longitude: 28.9784 })
    await page.goto('http://localhost:4173/')

    const locateBtn = page.getByRole('button', { name: 'Konumumu Bul' })
    if (await locateBtn.count() > 0) {
      await locateBtn.first().click()
    } else {
      await page.getByRole('button', { name: 'Manuel' }).click()
    }
    await page.waitForSelector('.leaflet-container', { state: 'visible', timeout: 15000 })
    const map = page.locator('.leaflet-container')
    await expect(map).toBeVisible()

    // Kullanıcı konumu mavi işaret
    const userMarker = page.locator('.custom-marker')
    await expect(userMarker).toHaveCount(1)

    // Smoke: sürücü işaretleri opsiyonel, yalnızca harita + kullanıcı konumu doğrulanır
  })
})
