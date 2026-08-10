import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from '../../adaptive-tutor/study-engine/runtime/node_modules/playwright/index.mjs'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const harnessPath = '/tests/security/learner-session-ownership.browser.html'
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
  const url = new URL(harnessPath, origin).href
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()

  const openHarness = async (serialized) => {
    const page = await context.newPage()
    if (serialized) {
      await page.addInitScript(([key, value]) => {
        sessionStorage.setItem(key, value)
      }, ['manuel-academy.security.learner-session.v1', serialized])
    }
    await page.goto(url)
    await page.waitForFunction(() => window.runtimeReady === true)
    return page
  }

  const tabA = await openHarness()
  const created = await tabA.evaluate(() => window.runtimeApi.create())
  const serialized = await tabA.evaluate(() => window.runtimeApi.serialized())
  assert.ok(serialized, 'Tab A did not persist its authoritative candidate record')

  const duplicatedTabB = await openHarness(serialized)
  const duplicateRestore = await duplicatedTabB.evaluate(() => window.runtimeApi.restore())
  assert.deepEqual(duplicateRestore, { status: 'ended', reason: 'ownership-conflict' })
  assert.equal(await duplicatedTabB.evaluate(() => window.runtimeApi.authority()), null)
  assert.deepEqual(await tabA.evaluate(() => window.runtimeApi.recheck()), {
    status: 'active',
    session: created,
  })

  await tabA.reload()
  await tabA.waitForFunction(() => window.runtimeReady === true)
  const refreshed = await tabA.evaluate(() => window.runtimeApi.restore())
  assert.deepEqual(refreshed, { status: 'active', session: created })

  await tabA.evaluate(() => window.runtimeApi.close())
  const copied = await tabA.evaluate(() => window.runtimeApi.serialized())
  const simultaneousA = await openHarness(copied)
  const simultaneousB = await openHarness(copied)
  const simultaneous = await Promise.all([
    simultaneousA.evaluate(() => window.runtimeApi.restore()),
    simultaneousB.evaluate(() => window.runtimeApi.restore()),
  ])
  assert.equal(simultaneous.filter((result) => result.status === 'active').length, 1)
  assert.equal(simultaneous.filter((result) => result.reason === 'ownership-conflict').length, 1)

  await Promise.all([
    duplicatedTabB.evaluate(() => window.runtimeApi.close()),
    simultaneousA.evaluate(() => window.runtimeApi.close()),
    simultaneousB.evaluate(() => window.runtimeApi.close()),
  ])
  await context.close()

  console.log(JSON.stringify({
    duplicatedTab: 'rejected',
    originalTab: 'remained-active',
    sameTabRefresh: 'restored',
    simultaneousRestoreOwners: 1,
  }))
} finally {
  await browser?.close()
  await server.close()
}
