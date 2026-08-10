import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from '../../adaptive-tutor/study-engine/runtime/node_modules/playwright/index.mjs'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const server = await createServer({
  root: repoRoot,
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})

let browser
try {
  await server.listen()
  const origin = server.resolvedUrls?.local[0]
  assert.ok(origin, 'Vite did not expose a local browser-test URL')
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(new URL('/tests/security/learner-activity.browser.html', origin).href)
  await page.waitForFunction(() => window.activityReady === true)

  const initial = await page.evaluate(() => window.activityApi.start())
  await page.waitForTimeout(30)
  await page.evaluate(() => window.scrollTo(0, 500))
  await page.waitForTimeout(30)
  assert.equal(await page.evaluate(() => window.activityApi.lastActivity()), initial)

  await page.click('#activity-button')
  const pointerActivity = await page.evaluate(() => window.activityApi.lastActivity())
  assert.ok(Date.parse(pointerActivity) > Date.parse(initial))

  await page.waitForTimeout(30)
  await page.mouse.move(300, 300)
  await page.mouse.wheel(0, 120)
  await page.waitForTimeout(50)
  const firstWheel = await page.evaluate(() => window.activityApi.lastActivity())
  assert.ok(Date.parse(firstWheel) > Date.parse(pointerActivity))
  await page.mouse.wheel(0, 120)
  await page.mouse.wheel(0, 120)
  await page.waitForTimeout(100)
  assert.equal(await page.evaluate(() => window.activityApi.lastActivity()), firstWheel)

  await page.waitForTimeout(2300)
  await page.mouse.move(310, 310)
  await page.mouse.wheel(0, -120)
  await page.waitForTimeout(50)
  const secondWheel = await page.evaluate(() => window.activityApi.lastActivity())
  assert.ok(Date.parse(secondWheel) > Date.parse(firstWheel))

  await page.waitForTimeout(30)
  await page.focus('#activity-input')
  await page.keyboard.press('A')
  const keyboardActivity = await page.evaluate(() => window.activityApi.lastActivity())
  assert.ok(Date.parse(keyboardActivity) > Date.parse(secondWheel))

  await page.evaluate(() => window.activityApi.close())
  await page.close()
  console.log(JSON.stringify({
    scrollAuthority: 'none',
    wheelBurst: 'deduplicated',
    laterWheelGesture: 'counted',
    pointer: 'counted',
    keyboardInput: 'counted',
  }))
} finally {
  await browser?.close()
  await server.close()
}
