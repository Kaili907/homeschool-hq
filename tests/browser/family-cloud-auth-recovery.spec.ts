import { expect, test, type BrowserContext, type Route } from '@playwright/test'

const SUPABASE_ORIGIN = 'https://fqzcxrkvpaivpnzdbuol.supabase.co'
const USER_ID = '30000000-0000-4000-8000-000000000003'
const EMAIL = 'srkmanuel@gmail.com'
const STORAGE_KEY = 'sb-fqzcxrkvpaivpnzdbuol-auth-token'

const user = {
  id: USER_ID, aud: 'authenticated', role: 'authenticated', email: EMAIL,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { email: EMAIL, email_verified: true }, identities: [],
  created_at: '2026-08-15T12:00:00.000Z', updated_at: '2026-08-15T12:00:00.000Z',
}

function session() {
  const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const expiresAt = Math.floor(Date.now() / 1_000) + 3_600
  return {
    access_token: `${encoded({ alg: 'HS256' })}.${encoded({ sub: USER_ID, exp: expiresAt, role: 'authenticated' })}.signature`,
    refresh_token: 'browser-auth-refresh-token', token_type: 'bearer', expires_in: 3_600,
    expires_at: expiresAt, user,
  }
}

async function installAuthBackend(context: BrowserContext, requests: URL[], tokenBodies: unknown[] = []) {
  await context.route(`${SUPABASE_ORIGIN}/**`, async (route: Route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    const json = (value: unknown, status = 200) => route.fulfill({
      status, contentType: 'application/json', body: JSON.stringify(value),
    })
    if (url.pathname === '/auth/v1/recover') return json({})
    if (url.pathname === '/auth/v1/otp') return json({})
    if (url.pathname === '/auth/v1/token') {
      tokenBodies.push(route.request().postDataJSON())
      return json(session())
    }
    if (url.pathname === '/auth/v1/user') return json(user)
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' })
    if (url.pathname === '/rest/v1/academy_household_memberships') return json([{
      household_id: '10000000-0000-4000-8000-000000000001',
      academy_households: { status: 'active' },
    }])
    if (url.pathname === '/rest/v1/rpc/academy_family_cloud_bootstrap_r1') return json({
      schemaVersion: 1, status: 'ready', householdRef: '10000000-0000-4000-8000-000000000001', learners: [],
    })
    return json({ message: `Unhandled auth test route: ${url.pathname}` }, 404)
  })
}

async function seedSession(context: BrowserContext) {
  const value = session()
  await context.addInitScript(({ key, serialized }) => {
    localStorage.setItem(key, serialized)
  }, { key: STORAGE_KEY, serialized: JSON.stringify(value) })
}

test('forgot-password request sends the exact deployed reset redirect', async ({ browser, baseURL }) => {
  const context = await browser.newContext()
  const requests: URL[] = []
  await installAuthBackend(context, requests)
  const page = await context.newPage()
  try {
    await page.goto('/family-pilot')
    await page.getByLabel('Parent email').fill(EMAIL)
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    await page.getByRole('button', { name: 'Send password reset link' }).click()
    await expect(page.getByText('Check your email for a secure password reset link.')).toBeVisible()
    const recovery = requests.find((url) => url.pathname === '/auth/v1/recover')
    expect(recovery?.searchParams.get('redirect_to')).toBe(`${baseURL}/family-pilot/reset-password`)
    // Reproduce an older/default recovery email that returned to the site root.
    // The client-owned PKCE verifier identifies the code as password recovery.
    await page.goto('/?code=password-recovery-code')
    await expect(page).toHaveURL(/\/family-pilot\/reset-password$/)
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible()
  } finally { await context.close() }
})

test('valid session opens reset form, rejects mismatch, and updates without password persistence', async ({ browser }) => {
  const context = await browser.newContext()
  const requests: URL[] = []
  await installAuthBackend(context, requests)
  await seedSession(context)
  const page = await context.newPage()
  try {
    await page.goto('/family-pilot/reset-password')
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible()
    await page.getByLabel('New password', { exact: true }).fill('browser-new-password')
    await page.getByLabel('Confirm new password').fill('different-password')
    await page.getByRole('button', { name: 'Set password' }).click()
    await expect(page.getByText('The passwords do not match.')).toBeVisible()
    await page.getByLabel('Confirm new password').fill('browser-new-password')
    await page.getByRole('button', { name: 'Set password' }).click()
    await expect(page.getByText('Password updated')).toBeVisible()
    expect(requests.filter((url) => url.pathname === '/auth/v1/user')).not.toHaveLength(0)
    const storage = await page.evaluate(() => JSON.stringify(localStorage))
    expect(storage).not.toContain('browser-new-password')
    await expect(page).toHaveURL(/\/family-pilot$/)
    await expect(page.getByRole('heading', { name: 'Sign in to Manuel Academy' })).toHaveCount(0)
    expect(await page.evaluate((key) => localStorage.getItem(key) !== null, STORAGE_KEY)).toBe(true)
  } finally { await context.close() }
})

test('root recognizes a persisted magic-link session before showing login', async ({ browser }) => {
  const context = await browser.newContext()
  const requests: URL[] = []
  await installAuthBackend(context, requests)
  await seedSession(context)
  const page = await context.newPage()
  try {
    await page.goto('/#type=magiclink')
    await expect(page).toHaveURL(/\/family-pilot$/)
    await expect(page.getByRole('heading', { name: 'Sign in to Manuel Academy' })).toHaveCount(0)
  } finally { await context.close() }
})

test('password session persists through rerender, navigation, reload, provider logout, and sign-in again', async ({ browser }) => {
  const context = await browser.newContext()
  const requests: URL[] = []
  const tokenBodies: unknown[] = []
  await installAuthBackend(context, requests, tokenBodies)
  const page = await context.newPage()
  try {
    const typedEmail = ` ${EMAIL} `
    await page.goto('/family-pilot')
    const emailInput = page.getByLabel('Parent email')
    await emailInput.fill(typedEmail)
    const submittedEmail = await emailInput.inputValue()
    await page.getByLabel('Family account password').fill('provider-owned-password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Set up everyone who learns here' })).toBeVisible()
    expect(tokenBodies[0]).toMatchObject({ email: submittedEmail })
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key) !== null, STORAGE_KEY)).toBe(true)

    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect(page.getByRole('heading', { name: 'Set up everyone who learns here' })).toBeVisible()
    expect(await page.evaluate((key) => localStorage.getItem(key) !== null, STORAGE_KEY)).toBe(true)
    await page.goto('/family-pilot?navigation-proof=1')
    await expect(page.getByRole('heading', { name: 'Set up everyone who learns here' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Set up everyone who learns here' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sign in to Manuel Academy' })).toHaveCount(0)

    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('family-cloud-auth-local-data-proof', 1)
        open.onupgradeneeded = () => open.result.createObjectStore('academic').put({ progress: 1 }, 'learner')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => { open.result.close(); resolve() }
      })
    })
    await page.getByRole('button', { name: 'Sign out family' }).click()
    await expect.poll(() => requests.filter((url) => url.pathname === '/auth/v1/logout').length).toBe(1)
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key) === null, STORAGE_KEY)).toBe(true)
    expect(await page.evaluate(async () => new Promise<number | null>((resolve, reject) => {
      const open = indexedDB.open('family-cloud-auth-local-data-proof', 1)
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const request = open.result.transaction('academic').objectStore('academic').get('learner')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => { open.result.close(); resolve(request.result?.progress ?? null) }
      }
    }))).toBe(1)

    await page.goto('/family-pilot')
    await expect(page.getByRole('heading', { name: 'Sign in to Manuel Academy' })).toBeVisible()
    await page.getByLabel('Parent email').fill(EMAIL)
    await page.getByLabel('Family account password').fill('provider-owned-password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Set up everyone who learns here' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Sign in to Manuel Academy' })).toHaveCount(0)
  } finally { await context.close() }
})

test('PKCE magic-link return is consumed once, persisted, cleaned, and never replayed', async ({ browser }) => {
  const context = await browser.newContext()
  const requests: URL[] = []
  await installAuthBackend(context, requests)
  const page = await context.newPage()
  try {
    await page.goto('/family-pilot')
    await page.getByLabel('Parent email').fill(EMAIL)
    await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
    await expect(page.getByText('Check your email for a secure sign-in link.')).toBeVisible()
    await page.goto('/?code=one-time-magic-link-code')
    await expect(page).toHaveURL(/\/family-pilot$/)
    await expect(page.getByRole('heading', { name: 'Sign in to Manuel Academy' })).toHaveCount(0)
    expect(requests.filter((url) => url.pathname === '/auth/v1/token')).toHaveLength(1)
    expect(requests.filter((url) => url.pathname === '/auth/v1/verify')).toHaveLength(0)
    expect(await page.evaluate((key) => localStorage.getItem(key) !== null, STORAGE_KEY)).toBe(true)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Sign in to Manuel Academy' })).toHaveCount(0)
    expect(requests.filter((url) => url.pathname === '/auth/v1/token')).toHaveLength(1)
    expect(requests.filter((url) => url.pathname === '/auth/v1/verify')).toHaveLength(0)
  } finally { await context.close() }
})

test('expired recovery return shows a safe request-another-reset path', async ({ browser }) => {
  const context = await browser.newContext()
  const requests: URL[] = []
  await installAuthBackend(context, requests)
  const page = await context.newPage()
  try {
    await page.goto('/family-pilot/reset-password?error=access_denied&error_code=otp_expired')
    await expect(page.getByText('This reset link is invalid or has expired')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Request another reset' })).toHaveAttribute('href', '/family-pilot')
  } finally { await context.close() }
})
