import { expect, test, type Page } from '@playwright/test'

const DRAFT = '10000000-0000-4000-8000-000000000001'
const SESSION_KEY = 'sb-example-auth-token'
const ROUTES = [
  ['/academy/admin', 'Academy overview'],
  ['/academy/admin/learners', 'Learner Operations'],
  ['/academy/admin/costs', 'AI & Costs'],
  ['/academy/admin/audit-log', 'Audit Log'],
  ['/academy/admin/correlations', 'Incident Explorer'],
  ['/academy/admin/configuration', 'Configuration'],
  ['/academy/admin/access', 'Access & Permissions'],
  ['/academy/admin/production-readiness', 'Production Readiness'],
  ['/academy/admin/curriculum/studio', 'Curriculum Studio'],
  [`/academy/admin/curriculum/preview?draft=${DRAFT}&revision=7`, 'Curriculum Preview / Diff'],
  [`/academy/admin/curriculum/studio?draft=${DRAFT}&revision=7#curriculum-release-staging`, 'Curriculum Studio'],
  [`/academy/admin/curriculum/studio?draft=${DRAFT}&revision=7#curriculum-release-publishing`, 'Curriculum Studio'],
  ['/academy/admin/curriculum/activation', 'Curriculum Activation & Rollback'],
  ['/academy/admin/curriculum/history', 'Curriculum Release History & Governance'],
] as const

function base64Url(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function session(expiresAt: number) {
  const accessToken = `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url({
    aud: 'authenticated',
    exp: expiresAt,
    role: 'authenticated',
    sub: '00000000-0000-4000-8000-000000000001',
  })}.browser-test-signature`
  return {
    access_token: accessToken,
    expires_at: expiresAt,
    expires_in: Math.max(0, expiresAt - Math.floor(Date.now() / 1_000)),
    refresh_token: 'browser-test-refresh-token',
    token_type: 'bearer',
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'admin@example.test',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-08-10T00:00:00.000Z',
    },
  }
}

async function seedSession(page: Page, expiresAt = Math.floor(Date.now() / 1_000) + 86_400) {
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value))
  }, { key: SESSION_KEY, value: session(expiresAt) })
}

async function seedSessionOnce(page: Page, expiresAt = Math.floor(Date.now() / 1_000) + 86_400) {
  await page.goto('/academy')
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value))
  }, { key: SESSION_KEY, value: session(expiresAt) })
}

async function cacheUrls(page: Page) {
  return page.evaluate(async () => {
    const urls: string[] = []
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      urls.push(...(await cache.keys()).map((request) => request.url))
    }
    return urls
  })
}

function adminPageTitle(page: Page) {
  return page.locator('.admin-topbar h1')
}

test.beforeEach(async ({ request }) => {
  await request.post('/__admin_test__/state', {
    data: { authMode: 'owner', swVersion: 'old' },
  })
})

test('unauthenticated deep links and reloads fail closed without caching Admin state', async ({ page }) => {
  for (const [path] of ROUTES) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()
  }
  expect(await cacheUrls(page)).not.toEqual(expect.arrayContaining([
    expect.stringContaining('/academy/admin'),
    expect.stringContaining('/api/admin/'),
  ]))
})

test('authorized representative routes survive deep links and reloads', async ({ page }, testInfo) => {
  await seedSession(page)
  for (const [path, title] of ROUTES) {
    await page.goto(path)
    await expect(adminPageTitle(page)).toHaveText(title)
    await page.reload()
    await expect(adminPageTitle(page)).toHaveText(title)
    if (testInfo.project.name === 'chromium-mobile-390') {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    }
  }
  for (const url of await cacheUrls(page)) {
    const pathname = new URL(url).pathname
    expect(pathname === '/academy/admin' || pathname.startsWith('/academy/admin/')).toBe(false)
    expect(pathname.startsWith('/api/admin/')).toBe(false)
    expect(pathname.startsWith('/.netlify/functions/admin-')).toBe(false)
  }
})

test('an expired session fails closed within the authorization timeout', async ({ page }) => {
  await seedSession(page, Math.floor(Date.now() / 1_000) - 60)
  await page.goto('/academy/admin/costs')
  await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()
})

test('a revoked current session fails closed on reload', async ({ page, request }) => {
  await seedSession(page)
  await request.post('/__admin_test__/state', { data: { authMode: 'revoked', swVersion: 'old' } })
  await page.goto('/academy/admin/access')
  await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()
})

test('permission changes are revalidated before navigation and reload', async ({ page, request }) => {
  await seedSession(page)
  await page.goto('/academy/admin')
  await expect(page.getByText('Owner operator session')).toHaveText('Owner operator session')

  await request.post('/__admin_test__/state', { data: { authMode: 'viewer', swVersion: 'old' } })
  await page.getByRole('button', { name: 'Learners' }).click()
  await expect(adminPageTitle(page)).toHaveText('Learner Operations')
  await expect(page.getByText('Viewer operator session')).toHaveText('Viewer operator session')

  await request.post('/__admin_test__/state', { data: { authMode: 'revoked', swVersion: 'old' } })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()
  await expect(page.getByText(/operator session/)).toHaveCount(0)
})

test('sign-out session removal hides protected state and cannot recover it from caches', async ({ page }) => {
  await seedSessionOnce(page)
  await page.goto('/academy/admin/access')
  await expect(adminPageTitle(page)).toHaveText('Access & Permissions')
  await expect(page.getByText('Owner operator session')).toHaveText('Owner operator session')

  await page.evaluate((key) => {
    localStorage.removeItem(key)
    window.dispatchEvent(new Event('online'))
  }, SESSION_KEY)
  await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()
  await expect(page.getByText(/operator session/)).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()
  for (const url of await cacheUrls(page)) {
    const pathname = new URL(url).pathname
    expect(pathname === '/academy/admin' || pathname.startsWith('/academy/admin/')).toBe(false)
    expect(pathname.startsWith('/api/admin/')).toBe(false)
  }
})

test('back and forward navigation revalidates and restores the correct route', async ({ page }) => {
  await seedSession(page)
  await page.goto('/academy/admin')
  await page.getByRole('button', { name: 'Learners' }).click()
  await expect(adminPageTitle(page)).toHaveText('Learner Operations')
  await page.getByRole('button', { name: 'AI & Costs' }).click()
  await expect(adminPageTitle(page)).toHaveText('AI & Costs')

  await page.goBack()
  await expect(adminPageTitle(page)).toHaveText('Learner Operations')
  await page.goForward()
  await expect(adminPageTitle(page)).toHaveText('AI & Costs')
})

test('offline transition hides protected state and online recovery reauthorizes', async ({ page, context, request }, testInfo) => {
  await seedSession(page)
  await page.goto('/academy/admin')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect(adminPageTitle(page)).toHaveText('Academy overview')

  await request.post('/__admin_test__/state', { data: { authMode: 'revoked', swVersion: 'old' } })
  await context.setOffline(true)
  await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()
  await expect(page.getByText(/operator session/)).toHaveCount(0)
  if (testInfo.project.name === 'webkit') {
    await page.evaluate(() => { setTimeout(() => window.location.reload(), 0) })
  } else {
    await page.reload()
  }
  await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()

  await request.post('/__admin_test__/state', { data: { authMode: 'owner', swVersion: 'old' } })
  await context.setOffline(false)
  await expect(adminPageTitle(page)).toHaveText('Academy overview')
  await expect(page.getByText('Owner operator session')).toHaveText('Owner operator session')
})

test('a new service worker waits while the old loaded build remains active', async ({ page, request, context }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-mobile-390', 'Covered by both desktop engines')
  await seedSession(page)
  await request.post('/__admin_test__/state', { data: { authMode: 'owner', swVersion: 'old' } })
  await page.goto('/academy/admin')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect(adminPageTitle(page)).toHaveText('Academy overview')
  await page.evaluate(() => fetch('/curriculum/1.0.0/release.json').then((response) => response.json()))

  await request.post('/__admin_test__/state', { data: { authMode: 'owner', swVersion: 'new' } })
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((registration) => registration?.update()))
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state ?? null))
    .toBe('installed')
  await expect(adminPageTitle(page)).toHaveText('Academy overview')
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.state)).toBe('activated')
  expect(await page.evaluate(() => caches.keys())).toEqual(expect.arrayContaining([
    'homeschool-hq-app-old',
    'homeschool-hq-app-new',
    'homeschool-hq-curriculum-v1',
  ]))

  await page.close()
  const nextPage = await context.newPage()
  await nextPage.goto('/academy/admin')
  await nextPage.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => nextPage.evaluate(() => caches.keys())).not.toContain('homeschool-hq-app-old')
  expect(await nextPage.evaluate(() => caches.keys())).toEqual(expect.arrayContaining([
    'homeschool-hq-app-new',
    'homeschool-hq-curriculum-v1',
  ]))
})
