import { expect, test, type BrowserContext, type Route } from '@playwright/test'

const SUPABASE_ORIGIN = 'https://fqzcxrkvpaivpnzdbuol.supabase.co'
const USER_ID = '30000000-0000-4000-8000-000000000003'
const EMAIL = 'srkmanuel@gmail.com'
const STORAGE_KEY = 'sb-fqzcxrkvpaivpnzdbuol-auth-token'
const PARENT_PIN = '8642'
const STUDY_LESSON = {
  courseRef: 'ma-g5-mathematics',
  lessonRef: 'ma-g5-mathematics-u01-l01',
  title: 'Launch and diagnostic: problem-solving routines',
} as const

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

test('tab and window focus changes preserve parent auth and the exact mounted Family Pilot state', async ({ browser }) => {
  const context = await browser.newContext()
  const requests: URL[] = []
  await installAuthBackend(context, requests)
  const family = await context.newPage()
  const otherTab = await context.newPage()
  try {
    await family.goto('/family-pilot')
    await family.getByLabel('Parent email').fill(EMAIL)
    await family.getByLabel('Family account password').fill('provider-owned-password')
    await family.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(family.getByRole('heading', { name: 'Set up everyone who learns here' })).toBeVisible()
    const displayName = family.getByLabel('Display name')
    await displayName.fill('Unsaved learner draft survives focus')
    const tokenBefore = await family.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
    const deviceBefore = await family.evaluate(() => localStorage.getItem('manuel-academy.family-cloud.device-ref.r1'))

    await otherTab.goto('/family-pilot?second-tab=1')
    await otherTab.bringToFront()
    await otherTab.waitForTimeout(5_000)
    await family.bringToFront()

    await expect(family.getByRole('heading', { name: 'Sign in to Manuel Academy' })).toHaveCount(0)
    await expect(displayName).toHaveValue('Unsaved learner draft survives focus')
    expect(await family.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(tokenBefore)
    expect(await family.evaluate(() => localStorage.getItem('manuel-academy.family-cloud.device-ref.r1'))).toBe(deviceBefore)
    expect(requests.filter((url) => url.pathname === '/auth/v1/logout')).toHaveLength(0)
  } finally { await context.close() }
})

test('one-minute background interval does not become provider logout', async ({ browser }) => {
  const context = await browser.newContext()
  const requests: URL[] = []
  await installAuthBackend(context, requests)
  const family = await context.newPage()
  const otherTab = await context.newPage()
  try {
    await family.goto('/family-pilot')
    await family.getByLabel('Parent email').fill(EMAIL)
    await family.getByLabel('Family account password').fill('provider-owned-password')
    await family.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(family.getByRole('heading', { name: 'Set up everyone who learns here' })).toBeVisible()
    const displayName = family.getByLabel('Display name')
    await displayName.fill('One minute draft')
    await otherTab.goto('about:blank')
    await otherTab.bringToFront()
    await otherTab.waitForTimeout(60_000)
    await family.bringToFront()

    await expect(family.getByRole('heading', { name: 'Sign in to Manuel Academy' })).toHaveCount(0)
    await expect(displayName).toHaveValue('One minute draft')
    expect(await family.evaluate((key) => localStorage.getItem(key) !== null, STORAGE_KEY)).toBe(true)
    expect(requests.filter((url) => url.pathname === '/auth/v1/logout')).toHaveLength(0)
  } finally { await context.close() }
})

test('active Study keeps the same session, lesson, and segment through a tab switch', async ({ browser }) => {
  const context = await browser.newContext()
  const requests: URL[] = []
  await installAuthBackend(context, requests)
  const family = await context.newPage()
  const otherTab = await context.newPage()
  try {
    await family.goto('/family-pilot')
    await family.getByLabel('Parent email').fill(EMAIL)
    await family.getByLabel('Family account password').fill('provider-owned-password')
    await family.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(family.getByRole('heading', { name: 'Set up everyone who learns here' })).toBeVisible()
    await family.getByLabel('Display name').fill('Focus Learner')
    await family.getByLabel('Nominal grade').selectOption('5')
    await family.getByRole('checkbox', { name: 'Mathematics', exact: true }).check()
    await family.getByRole('button', { name: 'Save learner', exact: true }).click()
    await family.getByLabel('Parent PIN', { exact: true }).fill(PARENT_PIN)
    await family.getByLabel('Confirm Parent PIN', { exact: true }).fill(PARENT_PIN)
    await family.getByRole('button', { name: 'Continue to School Plan' }).click()
    const devicePins = family.getByRole('heading', { name: 'Set PINs for this device' })
    if (await devicePins.isVisible().catch(() => false)) {
      await family.getByLabel('Focus Learner new learner PIN').fill('1357')
      await family.getByLabel('Focus Learner confirm learner PIN').fill('1357')
      await family.getByRole('button', { name: 'Save PINs on this device' }).click()
    }
    await expect(family.getByRole('heading', { name: 'Household learning' })).toBeVisible()

    const parentStudent = family.getByLabel('Parent student')
    if (!await parentStudent.isVisible().catch(() => false)) {
      await family.getByRole('button', { name: 'Parent', exact: true }).click()
    }
    const unlock = family.getByLabel('Unlock parent PIN')
    if (await unlock.isVisible().catch(() => false)) {
      await unlock.fill(PARENT_PIN)
      await family.getByRole('button', { name: 'Unlock Parent Hub' }).click()
    }
    await parentStudent.selectOption({ label: 'Focus Learner' })
    await family.getByRole('button', { name: 'Assignments', exact: true }).click()
    await expect(family.getByRole('heading', { name: 'Choose an exact lesson or assessment' })).toBeVisible()
    await family.getByLabel('Search this course').fill(STUDY_LESSON.title)
    const lesson = family.locator(`[data-lesson-ref="${STUDY_LESSON.lessonRef}"]`)
    await expect(lesson).toBeVisible()
    await lesson.getByRole('button', { name: /Assign lesson/ }).click()

    await family.getByRole('button', { name: 'Student', exact: true }).click()
    await family.getByRole('listitem', { name: 'Continue as Focus Learner' }).click()
    for (const digit of '1357') await family.getByRole('button', { name: `digit ${digit}` }).click()
    await expect(family.getByRole('heading', { name: 'Hello, Focus' })).toBeVisible()
    await family.getByRole('button', { name: `Start ${STUDY_LESSON.title}` }).click()
    const segmentMarker = family.getByText(/^(?:Part|Step) \d+ of \d+$/, { exact: true }).first()
    await expect(segmentMarker).toBeVisible()
    const markerBefore = await segmentMarker.textContent()
    const materialBefore = await family.locator('[data-material-ref]').getAttribute('data-material-ref')
    const studyBefore = await family.evaluate(() => {
      const raw = localStorage.getItem('manuel-academy.study.family-pilot-state.v1')
      return raw ? JSON.parse(raw) : null
    })

    await otherTab.goto('about:blank')
    await otherTab.bringToFront()
    await otherTab.waitForTimeout(5_000)
    await family.bringToFront()

    await expect(family.getByRole('heading', { name: 'Sign in to Manuel Academy' })).toHaveCount(0)
    await expect(segmentMarker).toHaveText(markerBefore ?? '')
    await expect(family.locator('[data-material-ref]')).toHaveAttribute('data-material-ref', materialBefore ?? '')
    expect(await family.evaluate(() => {
      const raw = localStorage.getItem('manuel-academy.study.family-pilot-state.v1')
      return raw ? JSON.parse(raw) : null
    })).toEqual(studyBefore)
    expect(requests.filter((url) => url.pathname === '/auth/v1/logout')).toHaveLength(0)
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
