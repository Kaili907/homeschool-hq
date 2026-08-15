import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test'
import { createLocalDbRpcEmulator } from '../../src/study/hosted-sync/v2/client/testing/localDbRpcEmulator'
import { HOSTED_SYNC_RPC } from '../../src/study/hosted-sync/v2/client'

const APP_URL = process.env.FAMILY_PILOT_APP_URL ?? 'http://127.0.0.1:4183/family-pilot'
const STAGING_ORIGIN = 'https://fqzcxrkvpaivpnzdbuol.supabase.co'
const HOUSEHOLD = '00000000-0000-4000-8000-000000000011'
const USER = '00000000-0000-4000-8000-000000000021'
const EMAIL = 'family-cloud-browser@example.test'
const PASSWORD = 'provider-managed-password'
const MAIN_TITLE = 'Launch and diagnostic: problem-solving routines'
const LEARNERS = Object.freeze([
  Object.freeze({ name: 'Ada Browser Cloud', grade: '5', pin: '1234', freshPin: '5678' }),
  Object.freeze({ name: 'Blake Browser Cloud', grade: '8', pin: '2468', freshPin: '1357' }),
])

interface HostedLearner {
  readonly learnerRef: string
  readonly hostedStudentId: string
  readonly tokenDigest: string
  readonly hostedAssignmentRef: string
  readonly hostedSessionRef: string
}

class BrowserSupabaseEmulator {
  readonly provider = createLocalDbRpcEmulator({ hostedHouseholdId: HOUSEHOLD })
  readonly learners = new Map<string, HostedLearner>()
  householdEstablished = false
  #sequence = 101

  async install(context: BrowserContext, deviceRef: string) {
    await context.route(`${STAGING_ORIGIN}/**`, (route) => this.#handle(route, deviceRef))
  }

  async #handle(route: Route, deviceRef: string) {
    const request = route.request()
    const url = new URL(request.url())
    const json = (status: number, value: unknown) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(value),
    })
    if (url.pathname === '/auth/v1/token') {
      const expiresAt = Math.floor(Date.now() / 1_000) + 3_600
      const user = this.#user()
      return json(200, {
        access_token: this.#accessToken(deviceRef, expiresAt),
        token_type: 'bearer', expires_in: 3_600, expires_at: expiresAt,
        refresh_token: `refresh-${deviceRef.replaceAll(':', '-')}`,
        user,
      })
    }
    if (url.pathname === '/auth/v1/user') return json(200, this.#user())
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' })
    if (url.pathname === '/rest/v1/academy_household_memberships') {
      return json(200, this.householdEstablished ? [{
        household_id: HOUSEHOLD,
        academy_households: { status: 'active' },
      }] : [])
    }
    if (url.pathname === '/rest/v1/rpc/academy_family_cloud_bootstrap_r1') {
      this.householdEstablished = true
      const body = request.postDataJSON() as { p_local_learners?: unknown }
      const local = Array.isArray(body.p_local_learners) ? body.p_local_learners : []
      for (const candidate of local) {
        const learner = candidate as { learnerRef?: unknown }
        if (typeof learner.learnerRef !== 'string' || this.learners.has(learner.learnerRef)) continue
        const hostedStudentId = `00000000-0000-4000-8000-${(this.#sequence++).toString().padStart(12, '0')}`
        const tokenDigest = this.#digest(learner.learnerRef)
        this.provider.setRole(tokenDigest, 'guardian')
        this.learners.set(learner.learnerRef, Object.freeze({
          learnerRef: learner.learnerRef,
          hostedStudentId,
          tokenDigest,
          hostedAssignmentRef: 'family-cloud:learner-authority',
          hostedSessionRef: `family-cloud:session:${hostedStudentId}`,
        }))
      }
      return json(200, {
        schemaVersion: 1, status: 'ready', householdRef: HOUSEHOLD,
        learners: [...this.learners.values()],
      })
    }
    const rpc = /^\/rest\/v1\/rpc\/(academy_study_sync_(?:first_link|resolve_mapping|hydrate|write)_v2)$/u.exec(url.pathname)
    if (rpc) {
      const result = await this.provider.rpc(rpc[1] as Parameters<typeof this.provider.rpc>[0], request.postDataJSON())
      if (result.error) return json(result.error.httpStatus ?? 503, {
        code: result.error.code,
        message: result.error.reasonCode ?? result.error.code,
      })
      return json(200, result.data)
    }
    return json(404, { message: `Unhandled browser Supabase route: ${url.pathname}` })
  }

  #digest(learnerRef: string): string {
    return [...learnerRef].reduce((value, character) => (value + character.codePointAt(0)!) % 16, 0).toString(16).repeat(64)
  }

  #accessToken(deviceRef: string, expiresAt: number): string {
    const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
    return `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({
      aud: 'authenticated', exp: expiresAt, iat: expiresAt - 3_600,
      role: 'authenticated', sub: USER, device_ref: deviceRef,
    })}.browser-e2e-signature`
  }

  #user() {
    const now = '2026-08-15T12:00:00.000Z'
    return {
      id: USER, aud: 'authenticated', role: 'authenticated', email: EMAIL,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { email: EMAIL, email_verified: true },
      identities: [], created_at: now, updated_at: now,
    }
  }
}

function writeOperationCount(backend: BrowserSupabaseEmulator, operation: string): number {
  return backend.provider.calls.filter((call) => (
    call.name === HOSTED_SYNC_RPC.write && call.args.p_operation === operation
  )).length
}

async function signIn(page: Page) {
  await page.goto(APP_URL)
  await expect(page.getByRole('heading', { name: 'Sign in to Manuel Academy' })).toBeVisible()
  await page.getByLabel('Parent email').fill(EMAIL)
  await page.getByLabel('Family account password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

async function setUpFamily(page: Page) {
  await expect(page.getByRole('heading', { name: 'Set up everyone who learns here' })).toBeVisible()
  for (const [index, learner] of LEARNERS.entries()) {
    if (index > 0) await page.getByRole('button', { name: 'Add another learner' }).first().click()
    await page.getByLabel('Display name').fill(learner.name)
    await page.getByLabel('Nominal grade').selectOption(learner.grade)
    await page.getByRole('checkbox', { name: 'Mathematics', exact: true }).check()
    await page.getByRole('button', { name: 'Save learner', exact: true }).click()
  }
  await page.getByLabel('Parent PIN', { exact: true }).fill('8642')
  await page.getByLabel('Confirm Parent PIN', { exact: true }).fill('8642')
  await page.getByRole('button', { name: 'Continue to School Plan' }).click()
  await expect(page.getByRole('heading', { name: 'Set PINs for this device' })).toBeVisible()
  for (const learner of LEARNERS) {
    await page.getByLabel(`${learner.name} new learner PIN`).fill(learner.pin)
    await page.getByLabel(`${learner.name} confirm learner PIN`).fill(learner.pin)
  }
  await page.getByRole('button', { name: 'Save PINs on this device' }).click()
  await expect(page.getByLabel('Family data status')).toHaveText('Up to date')
}

async function configureSchoolPlan(page: Page) {
  await expect(page.getByRole('heading', { name: 'Ada Browser Cloud’s automatic daily plan' })).toBeVisible()
  await page.getByLabel('School year starts').fill('2026-01-01')
  await page.getByLabel('School year ends').fill('2027-12-31')
  for (const day of ['Saturday', 'Sunday']) {
    const checkbox = page.getByLabel(day, { exact: true })
    if (!await checkbox.isChecked()) await checkbox.check()
  }
  await page.getByRole('button', { name: 'Save School Plan' }).click()
  await expect(page.getByRole('button', { name: 'Save School Plan' })).toBeVisible()
  await expect(page.getByLabel('Family data status')).toHaveText('Up to date')
}

async function chooseLearner(page: Page, name: string, pin: string) {
  const learner = page.getByRole('listitem', { name: `Continue as ${name}` })
  const student = page.getByRole('button', { name: 'Student', exact: true })
  const switchLearner = page.getByRole('button', { name: 'Switch learner', exact: true })
  await expect.poll(async () => (
    await learner.isVisible().catch(() => false)
    || await student.isVisible().catch(() => false)
    || await switchLearner.isVisible().catch(() => false)
  )).toBe(true)
  if (!await learner.isVisible().catch(() => false)) {
    if (await student.isVisible().catch(() => false)) await student.click()
    else await switchLearner.click()
  }
  await expect(learner).toBeVisible()
  await learner.click()
  for (const digit of pin) await page.getByRole('button', { name: `digit ${digit}` }).click()
  await expect(page.getByRole('heading', { name: `Hello, ${name.split(' ')[0]}` })).toBeVisible()
}

async function advanceOnePart(page: Page, responseText: string) {
  const material = page.locator('[data-material-ref]')
  const marker = page.getByText(/^(?:Part|Step) \d+ of \d+$/, { exact: true }).first()
  const before = await marker.textContent()
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const save = material.getByRole('button', { name: /^(?:Submit answer|Submit|Save response)$/ }).filter({ visible: true }).first()
    const radios = material.getByRole('radio')
    if (await save.isVisible().catch(() => false) && await radios.count()) {
      await radios.first().check()
      await save.click()
      await page.waitForTimeout(50)
      continue
    }
    const field = material.getByLabel(/Your response|Explain your thinking|Describe what you completed/).first()
    if (await field.isVisible().catch(() => false) && await save.isVisible().catch(() => false)) {
      await field.fill(responseText)
      const completed = material.getByRole('checkbox', { name: 'I completed the action described above.' })
      if (await completed.isVisible().catch(() => false)) await completed.check()
      await save.click()
      await page.waitForTimeout(50)
      continue
    }
    const advance = material.getByRole('button', { name: /^(?:Continue|Finish this part)$/ }).filter({ visible: true }).first()
    if (await advance.isVisible().catch(() => false) && await advance.isEnabled().catch(() => false)) {
      await advance.click()
      await page.waitForTimeout(50)
      if (!await marker.count() || await marker.textContent() !== before) return
      continue
    }
    if (await advance.isVisible().catch(() => false)) {
      await page.waitForTimeout(50)
      if (!await marker.count() || await marker.textContent() !== before) return
      continue
    }
    throw new Error(`No learner action could advance ${before}.`)
  }
  throw new Error(`Study did not advance from ${before}.`)
}

async function saveAndExit(page: Page) {
  const done = page.getByRole('button', { name: 'Done' })
  const save = page.getByRole('button', { name: 'Save and exit' })
  await expect(done.or(save)).toBeVisible()
  if (await done.isVisible().catch(() => false)) await done.click(); else await save.click()
  await expect(page.getByRole('heading', { name: 'Hello, Ada' })).toBeVisible()
}

async function waitForFamilySync(page: Page, parentPin: string) {
  const parent = page.getByRole('button', { name: 'Parent', exact: true })
  const lock = page.getByRole('button', { name: 'Lock', exact: true })
  await expect.poll(async () => (
    await parent.isVisible().catch(() => false) || await lock.isVisible().catch(() => false)
  )).toBe(true)
  if (!await parent.isVisible().catch(() => false)) {
    await lock.click()
  }
  await parent.click()
  await page.getByLabel('Unlock parent PIN').fill(parentPin)
  await page.getByRole('button', { name: 'Unlock Parent Hub' }).click()
  await expect(page.getByLabel('Family data status')).toHaveText('Up to date')
}

async function setFreshDevicePins(page: Page, parentPin: string, learnerPin: string) {
  await expect(page.getByRole('heading', { name: 'Set PINs for this device' })).toBeVisible()
  await page.getByLabel('New device Parent PIN', { exact: true }).fill(parentPin)
  await page.getByLabel('Confirm new device Parent PIN', { exact: true }).fill(parentPin)
  for (const [index, learner] of LEARNERS.entries()) {
    const pin = index === 0 ? learnerPin : learner.freshPin
    await page.getByLabel(`${learner.name} new learner PIN`).fill(pin)
    await page.getByLabel(`${learner.name} confirm learner PIN`).fill(pin)
  }
  await page.getByRole('button', { name: 'Save PINs on this device' }).click()
}

async function assignmentIdentityEvidence(page: Page) {
  return page.evaluate(() => {
    const suffix = ':manuel-academy.study.family-pilot-state.v1'
    const key = Object.keys(localStorage).find((candidate) => candidate.endsWith(suffix))
    if (!key) throw new Error('Scoped Family Pilot state is unavailable.')
    const state = JSON.parse(localStorage.getItem(key) ?? 'null') as {
      students: Array<{ studentRef: string; assignments: Array<{ assignmentRef: string }> }>
    }
    return state.students.map((student) => ({
      studentRef: student.studentRef,
      assignmentRefs: student.assignments.map((assignment) => assignment.assignmentRef),
    }))
  })
}

test('real cloud-enabled root signs in, first-links, hydrates, and resumes across fresh browser profiles', async ({ browser }) => {
  const backend = new BrowserSupabaseEmulator()
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const contextC = await browser.newContext()
  await backend.install(contextA, 'device:e2e:a')
  await backend.install(contextB, 'device:e2e:b')
  await backend.install(contextC, 'device:e2e:c')
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()
  const pageC = await contextC.newPage()
  try {
    await signIn(pageA)
    await setUpFamily(pageA)
    await configureSchoolPlan(pageA)
    await expect.poll(() => backend.provider.calls.filter((call) => call.name === HOSTED_SYNC_RPC.firstLink).length).toBe(2)
    await pageA.waitForTimeout(100)
    const authorityWritesBeforeAStudy = writeOperationCount(backend, 'authority-checkpoint:compare-and-swap')
    await pageA.getByRole('button', { name: 'Student', exact: true }).click()
    await chooseLearner(pageA, LEARNERS[0].name, LEARNERS[0].pin)
    await pageA.getByRole('button', { name: `Start ${MAIN_TITLE}` }).click()
    await advanceOnePart(pageA, 'Device A response through the real browser repository.')
    await saveAndExit(pageA)
    await waitForFamilySync(pageA, '8642')
    expect(backend.provider.calls.filter((call) => call.name === HOSTED_SYNC_RPC.firstLink)).toHaveLength(2)
    await expect.poll(() => writeOperationCount(backend, 'authority-checkpoint:compare-and-swap')).toBeGreaterThan(authorityWritesBeforeAStudy)
    await pageA.waitForTimeout(250)

    await signIn(pageB)
    await setFreshDevicePins(pageB, '9753', '5678')
    const hydratedAssignments = await assignmentIdentityEvidence(pageB)
    expect(hydratedAssignments).toHaveLength(2)
    for (const learner of hydratedAssignments) {
      expect(new Set(learner.assignmentRefs).size).toBe(learner.assignmentRefs.length)
    }
    await chooseLearner(pageB, LEARNERS[0].name, LEARNERS[0].freshPin)
    await expect(pageB.getByRole('button', { name: `Continue ${MAIN_TITLE}` })).toBeVisible()
    await pageB.getByRole('button', { name: `Continue ${MAIN_TITLE}` }).click()
    await expect(pageB.getByText(/^(?:Part|Step) 2 of 3$/, { exact: true }).first()).toBeVisible()
    const authorityWritesBeforeBStudy = writeOperationCount(backend, 'authority-checkpoint:compare-and-swap')
    const responseWritesBeforeBStudy = writeOperationCount(backend, 'learner-response-checkpoint:compare-and-swap')
    await advanceOnePart(pageB, 'Device B resumes the exact Device A checkpoint.')
    await saveAndExit(pageB)
    await waitForFamilySync(pageB, '9753')
    await expect.poll(() => writeOperationCount(backend, 'authority-checkpoint:compare-and-swap')).toBeGreaterThan(authorityWritesBeforeBStudy)
    await expect.poll(() => writeOperationCount(backend, 'learner-response-checkpoint:compare-and-swap')).toBeGreaterThan(responseWritesBeforeBStudy)
    await pageB.waitForTimeout(250)

    await pageA.reload()
    await chooseLearner(pageA, LEARNERS[0].name, LEARNERS[0].pin)
    await pageA.getByRole('button', { name: `Continue ${MAIN_TITLE}` }).click()
    await expect(pageA.getByText(/^(?:Part|Step) 3 of 3$/, { exact: true }).first()).toBeVisible()
    await saveAndExit(pageA)
    await waitForFamilySync(pageA, '8642')
    if (!await pageA.getByLabel('School year ends').isVisible().catch(() => false)) {
      await pageA.getByRole('button', { name: 'School Plan', exact: true }).click()
    }
    await expect(pageA.getByLabel('School year ends')).toBeVisible()

    await pageA.evaluate(() => Object.defineProperty(window.navigator, 'onLine', {
      configurable: true, get: () => false,
    }))
    expect(await pageA.evaluate(() => navigator.onLine)).toBe(false)
    const callsBeforeOfflineSave = backend.provider.calls.length
    await pageA.getByLabel('School year ends').fill('2027-11-30')
    await pageA.getByRole('button', { name: 'Save School Plan' }).click()
    await expect(pageA.getByLabel('Family data status')).toHaveText('Offline / saved on this device')
    expect(backend.provider.calls).toHaveLength(callsBeforeOfflineSave)
    await pageA.evaluate(() => Object.defineProperty(window.navigator, 'onLine', {
      configurable: true, get: () => true,
    }))
    expect(await pageA.evaluate(() => navigator.onLine)).toBe(true)
    await pageA.evaluate(() => window.dispatchEvent(new Event('online')))
    await waitForFamilySync(pageA, '8642')

    const oldWrite = backend.provider.calls.find((call) => call.name === HOSTED_SYNC_RPC.write && call.args.p_expected_revision === 0)
    if (!oldWrite) throw new Error('No browser-emitted revision-zero write was captured.')
    const stale = await backend.provider.rpc(HOSTED_SYNC_RPC.write, {
      ...oldWrite.args,
      p_client_operation_id: '00000000-0000-4000-8000-000000009999',
    })
    expect(stale.data).toMatchObject({ status: 'revision-conflict' })

    await signIn(pageC)
    await expect(pageC.getByRole('heading', { name: 'Set PINs for this device' })).toBeVisible()
    for (const learner of LEARNERS) await expect(pageC.getByText(learner.name, { exact: true }).first()).toBeVisible()
    expect(backend.learners.size).toBe(2)
    const hosted = [...backend.learners.values()]
    expect(new Set(hosted.map((learner) => learner.hostedStudentId)).size).toBe(2)
    for (const call of backend.provider.calls.filter((entry) => entry.name !== HOSTED_SYNC_RPC.firstLink)) {
      const body = JSON.stringify(call.args)
      expect(hosted.every((learner) => body.includes(learner.hostedStudentId))).toBe(false)
    }
    expect(JSON.stringify(backend.provider.calls)).not.toMatch(/1234|5678|8642|9753|parentAccessVerifier|studentAccessVerifiers|service.?role/i)
  } finally {
    await Promise.all([contextA.close(), contextB.close(), contextC.close()])
  }
})
