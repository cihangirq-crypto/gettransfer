import { test, expect } from '@playwright/test'
// Dev sunucusu HTTP altında çalışıyor

test('Giriş olmadan select-driver yönlendirmesi login’e gider', async ({ page }) => {
  await page.goto('http://localhost:4173/select-driver')
  await expect(page).toHaveURL(/\/login/)
})
