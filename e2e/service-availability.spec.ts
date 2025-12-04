import { test, expect } from '@playwright/test'

const DEV = 'http://localhost:5173'
const PREVIEW = 'http://localhost:4173'

async function gotoAny(page: any, path: string) {
  try { await page.goto(`${DEV}${path}`) } catch { await page.goto(`${PREVIEW}${path}`) }
}

test('API health endpoint returns ok', async ({ request }) => {
  const res = await request.get('http://localhost:3003/api/health').catch(async ()=>{
    return await request.get('http://localhost:3001/api/health')
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.success).toBeTruthy()
})

test('Homepage responds 200', async ({ request }) => {
  let res = await request.get(`${DEV}/`).catch(async ()=> await request.get(`${PREVIEW}/`))
  expect(res.ok()).toBeTruthy()
})
