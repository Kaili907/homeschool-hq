import { expect, test, type Browser, type Page } from '@playwright/test'
import {
  BrowserFamilyCloudDevice,
  FAMILY_CLOUD_AUTH_COOKIE,
  FAMILY_CLOUD_FIRST_LINK_KEY,
  LocalFamilyCloudScenarioAdapter,
  browserStorageEvidence,
  exactJson,
  type FamilyCloudScenarioAdapter,
} from './family-two-device-cloud-harness'

const APP_URL = process.env.FAMILY_PILOT_APP_URL ?? 'http://127.0.0.1:4183/family-pilot'
const PARENT_PIN = '8642'
const MAIN = {
  courseRef: 'ma-g5-mathematics',
  lessonRef: 'ma-g5-mathematics-u01-l01',
  title: 'Launch and diagnostic: problem-solving routines',
}
const SIBLING = {
  courseRef: 'ma-g8-mathematics',
  lessonRef: 'ma-g8-mathematics-u01-l01',
  title: 'Launch and diagnostic: rational and irrational numbers',
}

async function setupFamily(page: Page) {
  await page.goto(APP_URL)
  await expect(page.getByRole('heading', { name: 'Set up everyone who learns here' })).toBeVisible()
  for (const [index, learner] of [
    { name: 'Avery Cross Device', grade: '5' },
    { name: 'Blake Cross Device', grade: '8' },
  ].entries()) {
    if (index) await page.getByRole('button', { name: 'Add another learner' }).first().click()
    await page.getByLabel('Display name').fill(learner.name)
    await page.getByLabel('Nominal grade').selectOption(learner.grade)
    for (const subject of [
      'Mathematics', 'English Language Arts', 'Science', 'Social Studies', 'Health',
      'Physical Education', 'Ready for Life', 'Technology & Computer Science',
      'Arts & Music', 'Financial Literacy',
    ]) await page.getByRole('checkbox', { name: subject, exact: true }).check()
    await page.getByRole('button', { name: 'Save learner', exact: true }).click()
  }
  await page.getByLabel('Parent PIN', { exact: true }).fill(PARENT_PIN)
  await page.getByLabel('Confirm Parent PIN', { exact: true }).fill(PARENT_PIN)
  await page.getByRole('button', { name: 'Continue to School Plan' }).click()
  await expect(page.getByRole('heading', { name: 'Household learning' })).toBeVisible()
}

async function openAssignments(page: Page) {
  await page.getByRole('button', { name: 'Assignments', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose an exact lesson or assessment' })).toBeVisible()
}

async function parentStudent(page: Page, name: string) {
  const select = page.getByLabel('Parent student')
  if (!await select.isVisible().catch(() => false)) {
    const parent = page.getByRole('button', { name: 'Parent', exact: true })
    const assignments = page.getByRole('button', { name: /^All assignments/ })
    await expect(parent.or(assignments)).toBeVisible()
    if (await parent.isVisible()) await parent.click()
    else await assignments.click()
  }
  const unlock = page.getByLabel('Unlock parent PIN')
  if (await unlock.isVisible().catch(() => false)) {
    await unlock.fill(PARENT_PIN)
    await page.getByRole('button', { name: 'Unlock Parent Hub' }).click()
  }
  await select.selectOption({ label: name })
  await openAssignments(page)
}

async function configureSchoolPlan(page: Page, name: string) {
  await parentStudent(page, name)
  await page.getByRole('button', { name: 'School Plan', exact: true }).click()
  await expect(page.getByRole('heading', { name: `${name}’s automatic daily plan` })).toBeVisible()
  await page.getByLabel('School year starts').fill('2026-01-01')
  await page.getByLabel('School year ends').fill('2027-12-31')
  for (const day of ['Saturday', 'Sunday']) {
    const checkbox = page.getByLabel(day, { exact: true })
    if (!await checkbox.isChecked()) await checkbox.check()
  }
  await page.getByRole('button', { name: 'Save School Plan' }).click()
  await expect(page.getByRole('status')).toContainText('School Plan saved')
}

async function openStudent(page: Page, name: string) {
  const learner = page.getByRole('listitem', { name: `Continue as ${name}` })
  if (!await learner.isVisible().catch(() => false)) {
    const student = page.getByRole('button', { name: 'Student', exact: true })
    const switchLearner = page.getByRole('button', { name: 'Switch learner', exact: true })
    await expect(student.or(switchLearner)).toBeVisible()
    if (await student.isVisible()) await student.click()
    else await switchLearner.click()
  }
  await learner.click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: new RegExp(`Hello, ${name.split(' ')[0]}`) })).toBeVisible()
}

async function advanceOnePart(page: Page, responseText: string, choiceIndex = 0) {
  const material = page.locator('[data-material-ref]')
  const marker = page.getByText(/^(?:Part|Step) \d+ of \d+$/, { exact: true }).first()
  const before = await marker.textContent()
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const save = material.getByRole('button', { name: /^(?:Submit answer|Submit|Save response)$/ }).filter({ visible: true }).first()
    const radios = material.getByRole('radio')
    if (await save.isVisible().catch(() => false) && await radios.count()) {
      await radios.nth(Math.min(choiceIndex, await radios.count() - 1)).check()
      await save.click()
      await page.waitForTimeout(25)
      continue
    }
    const field = material.getByLabel(/Your response|Explain your thinking|Describe what you completed/).first()
    if (await field.isVisible().catch(() => false) && await save.isVisible().catch(() => false)) {
      await field.fill(responseText)
      const completed = material.getByRole('checkbox', { name: 'I completed the action described above.' })
      if (await completed.isVisible().catch(() => false)) await completed.check()
      await save.click()
      await page.waitForTimeout(25)
      continue
    }
    const advance = material.getByRole('button', { name: /^(?:Continue|Finish this part)$/ }).filter({ visible: true }).first()
    if (await advance.isVisible().catch(() => false) && await advance.isEnabled().catch(() => false)) {
      await advance.click()
      await page.waitForTimeout(25)
      const now = await marker.count() ? await marker.textContent() : 'finished'
      if (now !== before) return
      continue
    }
    if (!await marker.count()) return
    throw new Error(`No real learner action could advance ${before}.`)
  }
  throw new Error(`Study did not advance from ${before}.`)
}

async function saveAndExit(page: Page) {
  const done = page.getByRole('button', { name: 'Done' })
  const save = page.getByRole('button', { name: 'Save and exit' })
  const back = page.getByRole('button', { name: 'Back to Home' })
  const home = page.getByRole('heading', { name: /^Hello,/ })
  await expect(done.or(save).or(back).or(home)).toBeVisible()
  if (await home.isVisible().catch(() => false)) return
  if (await done.isVisible().catch(() => false)) await done.click()
  else if (await back.isVisible().catch(() => false)) await back.click()
  else await save.click()
  await expect(home).toBeVisible()
}

function learnerState(evidence: Awaited<ReturnType<typeof browserStorageEvidence>>, learnerRef: string) {
  const student = evidence.core?.students.find((item) => item.studentRef === learnerRef)
  if (!student) throw new Error(`No Core learner ${learnerRef}`)
  return student
}

function assignmentState(evidence: Awaited<ReturnType<typeof browserStorageEvidence>>, learnerRef: string, lessonRef: string) {
  const assignment = learnerState(evidence, learnerRef).assignments.find((item) => item.lessonRef === lessonRef)
  if (!assignment) throw new Error(`No assignment ${learnerRef}/${lessonRef}`)
  return assignment
}

function studyDocument(evidence: Awaited<ReturnType<typeof browserStorageEvidence>>, learnerRef: string) {
  const record = evidence.indexedDb.find((item) => item.key.includes(`:learner:${encodeURIComponent(learnerRef)}`))
  const envelope = record?.value as { value?: unknown } | undefined
  if (!envelope || typeof envelope.value !== 'string') throw new Error(`No Study document for ${learnerRef}`)
  return JSON.parse(envelope.value)
}

function responseDocuments(evidence: Awaited<ReturnType<typeof browserStorageEvidence>>, learnerRef: string) {
  return evidence.indexedDb.filter((item) => item.key.startsWith(`family-pilot:learner-response-attempt:v1:student:${encodeURIComponent(learnerRef)}:`))
}

function plannerDocument(evidence: Awaited<ReturnType<typeof browserStorageEvidence>>, learnerRef: string) {
  return evidence.indexedDb.find((item) => item.key.startsWith('manuel-academy.study.family-auto-planner.v1') &&
    item.key.endsWith(`|${encodeURIComponent(learnerRef)}`))?.value
}

async function finishCurrentPartAndReturn(page: Page, response: string, choiceIndex = 0) {
  await advanceOnePart(page, response, choiceIndex)
  const done = page.getByRole('button', { name: 'Done' })
  if (await done.isVisible().catch(() => false)) await done.click()
  else await saveAndExit(page)
}

export async function runFamilyTwoDeviceScenario(
  browser: Browser,
  adapter: FamilyCloudScenarioAdapter,
): Promise<void> {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const contextC = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()
  const pageC = await contextC.newPage()
  const deviceA = new BrowserFamilyCloudDevice(contextA, pageA, adapter, 'device:family-e2e:a', PARENT_PIN)
  const deviceB = new BrowserFamilyCloudDevice(contextB, pageB, adapter, 'device:family-e2e:b', PARENT_PIN)
  const freshDevice = new BrowserFamilyCloudDevice(contextC, pageC, adapter, 'device:family-e2e:fresh', null)
  const browserRequests: string[] = []
  for (const context of [contextA, contextB, contextC]) context.on('request', (request) => browserRequests.push(request.url()))

  try {
    await Promise.all([deviceA.initialize(), deviceB.initialize(), freshDevice.initialize()])

    // Device A owns the only initial local copy, including its PIN verifiers.
    await setupFamily(pageA)
    await configureSchoolPlan(pageA, 'Avery Cross Device')
    await configureSchoolPlan(pageA, 'Blake Cross Device')
    await openStudent(pageA, 'Avery Cross Device')
    await expect(pageA.getByRole('button', { name: `Start ${MAIN.title}` })).toBeVisible()
    await pageA.getByRole('button', { name: `Start ${MAIN.title}` }).click()
    await advanceOnePart(pageA, 'Device A reaches the first real learner item.')
    await advanceOnePart(pageA, 'Device A response retained for exact continuation.')
    await saveAndExit(pageA)
    await openStudent(pageA, 'Blake Cross Device')
    await expect(pageA.getByRole('button', { name: `Start ${SIBLING.title}` })).toBeVisible()
    await pageA.getByRole('button', { name: 'Switch learner', exact: true }).click()

    const aBeforeLink = await browserStorageEvidence(pageA)
    const householdRef = aBeforeLink.householdRef
    if (!householdRef) throw new Error('Device A household was not persisted.')
    const mainRef = aBeforeLink.app?.setup.students.find((item) => item.displayName === 'Avery Cross Device')?.studentRef
    const siblingRef = aBeforeLink.app?.setup.students.find((item) => item.displayName === 'Blake Cross Device')?.studentRef
    if (!mainRef || !siblingRef) throw new Error('Learner identities are unavailable.')
    expect(learnerState(aBeforeLink, mainRef).assignments).toHaveLength(10)
    expect(learnerState(aBeforeLink, siblingRef).assignments).toHaveLength(10)
    expect(responseDocuments(aBeforeLink, mainRef).length).toBeGreaterThan(0)
    expect(studyDocument(aBeforeLink, mainRef).checkpoints.length).toBeGreaterThan(0)
    expect(plannerDocument(aBeforeLink, mainRef)).toBeTruthy()
    expect(plannerDocument(aBeforeLink, siblingRef)).toBeTruthy()

    await deviceA.authenticate(householdRef)
    expect(await deviceA.firstLink(mainRef)).toEqual({ status: 'stored', revision: 0, readBackVerified: true })
    expect(await deviceA.firstLink(siblingRef)).toEqual({ status: 'stored', revision: 0, readBackVerified: true })
    const firstLinkMarker = await pageA.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), FAMILY_CLOUD_FIRST_LINK_KEY)
    expect(firstLinkMarker.learners[mainRef]).toEqual({ revision: 0, readBackVerified: true })
    expect(firstLinkMarker.learners[siblingRef]).toEqual({ revision: 0, readBackVerified: true })

    // Device B starts as a completely separate profile: no localStorage, IDB or cookie is copied.
    await pageB.goto(APP_URL)
    await expect(pageB.getByRole('heading', { name: 'Set up everyone who learns here' })).toBeVisible()
    const bEmpty = await browserStorageEvidence(pageB)
    expect(bEmpty.householdRef).not.toBe(householdRef)
    expect(bEmpty.indexedDb).toEqual([])
    expect(bEmpty.deviceRef).toBe('device:family-e2e:b')
    await deviceB.authenticate(householdRef)
    expect((await contextA.cookies()).find((cookie) => cookie.name === FAMILY_CLOUD_AUTH_COOKIE)?.value)
      .not.toBe((await contextB.cookies()).find((cookie) => cookie.name === FAMILY_CLOUD_AUTH_COOKIE)?.value)
    expect((await deviceB.hydrate(householdRef, mainRef)).status).toBe('ready')
    expect((await deviceB.hydrate(householdRef, siblingRef)).status).toBe('ready')
    await pageB.reload()

    const bHydrated = await browserStorageEvidence(pageB)
    expect(bHydrated.householdRef).toBe(householdRef)
    expect(learnerState(bHydrated, mainRef)).toEqual(learnerState(aBeforeLink, mainRef))
    expect(learnerState(bHydrated, siblingRef)).toEqual(learnerState(aBeforeLink, siblingRef))
    expect(plannerDocument(bHydrated, mainRef)).toEqual(plannerDocument(aBeforeLink, mainRef))
    expect(plannerDocument(bHydrated, siblingRef)).toEqual(plannerDocument(aBeforeLink, siblingRef))
    expect(studyDocument(bHydrated, mainRef)).toEqual(studyDocument(aBeforeLink, mainRef))
    expect(responseDocuments(bHydrated, mainRef)).toEqual(responseDocuments(aBeforeLink, mainRef))
    expect(new Set(learnerState(bHydrated, mainRef).assignments.map((item) => item.assignmentRef)).size).toBe(10)

    await openStudent(pageB, 'Avery Cross Device')
    await expect(pageB.getByRole('button', { name: `Continue ${MAIN.title}` })).toBeVisible()
    await pageB.getByRole('button', { name: `Continue ${MAIN.title}` }).click()
    await expect(pageB.getByText(/^(?:Part|Step) 3 of 3$/, { exact: true }).first()).toBeVisible()
    await finishCurrentPartAndReturn(pageB, 'Device B response completes the exact Device A checkpoint.', 1)
    expect(await deviceB.push(mainRef, 'NORMAL_COMPLETION')).toEqual({ status: 'stored', revision: 1, readBackVerified: true })

    // Device A receives B's new work without duplicates or regression.
    expect((await deviceA.hydrate(householdRef, mainRef)).status).toBe('ready')
    await pageA.reload()
    const aAfterB = await browserStorageEvidence(pageA)
    const bAfterWork = await browserStorageEvidence(pageB)
    expect(assignmentState(aAfterB, mainRef, MAIN.lessonRef)).toEqual(assignmentState(bAfterWork, mainRef, MAIN.lessonRef))
    expect(studyDocument(aAfterB, mainRef)).toEqual(studyDocument(bAfterWork, mainRef))
    expect(responseDocuments(aAfterB, mainRef)).toEqual(responseDocuments(bAfterWork, mainRef))
    expect(new Set(learnerState(aAfterB, mainRef).assignments.map((item) => item.assignmentRef)).size)
      .toBe(learnerState(aAfterB, mainRef).assignments.length)

    // A sibling follows the same real flow while the first learner remains byte-stable.
    const mainBeforeSibling = learnerState(await browserStorageEvidence(pageB), mainRef)
    await openStudent(pageB, 'Blake Cross Device')
    await pageB.getByRole('button', { name: `Start ${SIBLING.title}` }).click()
    await advanceOnePart(pageB, 'Sibling reaches the first real learner item.')
    await advanceOnePart(pageB, 'Sibling response belongs only to Blake.')
    await saveAndExit(pageB)
    expect(await deviceB.push(siblingRef)).toEqual({ status: 'stored', revision: 1, readBackVerified: true })
    expect(learnerState(await browserStorageEvidence(pageB), mainRef)).toEqual(mainBeforeSibling)
    expect((await deviceA.hydrate(householdRef, siblingRef)).status).toBe('ready')
    await pageA.reload()
    const aWithSibling = await browserStorageEvidence(pageA)
    expect(responseDocuments(aWithSibling, siblingRef).length).toBeGreaterThan(0)
    expect(responseDocuments(aWithSibling, mainRef).every((entry) => !entry.key.includes(encodeURIComponent(siblingRef)))).toBe(true)

    // Both profiles now edit the same next automatic assignment from revision 1.
    expect(deviceA.revisions.get(mainRef)).toBe(1)
    expect(deviceB.revisions.get(mainRef)).toBe(1)
    const concurrentAssignment = learnerState(aWithSibling, mainRef).assignments.find((item) => item.subject === 'science')
    if (!concurrentAssignment) throw new Error('Automatic Science assignment is unavailable for conflict proof.')
    const concurrentTitle = concurrentAssignment.title
    await openStudent(pageA, 'Avery Cross Device')
    await openStudent(pageB, 'Avery Cross Device')
    const nextStartA = pageA.getByRole('button', { name: `Start ${concurrentTitle}` })
    const nextStartB = pageB.getByRole('button', { name: `Start ${concurrentTitle}` })
    await expect(nextStartA).toBeVisible()
    await expect(nextStartB).toBeVisible()
    await nextStartA.click()
    await nextStartB.click()
    await advanceOnePart(pageA, 'Device A reaches the concurrent response item.')
    await advanceOnePart(pageB, 'Device B reaches the concurrent response item.')
    await advanceOnePart(pageA, 'Concurrent answer authored on Device A.', 0)
    await advanceOnePart(pageB, 'Conflicting answer authored on Device B.', 1)
    await saveAndExit(pageA)
    await saveAndExit(pageB)
    expect(await deviceA.push(mainRef)).toEqual({ status: 'stored', revision: 2, readBackVerified: true })
    const conflict = await deviceB.push(mainRef)
    expect(conflict).toMatchObject({ status: 'revision-conflict', serverRevision: 2 })
    expect(deviceB.conflicts).toHaveLength(1)
    expect(exactJson(deviceB.conflicts[0].localBundle)).not.toBe(exactJson(deviceB.conflicts[0].remoteBundle))
    const bConflictLocal = await browserStorageEvidence(pageB)
    expect(responseDocuments(bConflictLocal, mainRef).length).toBeGreaterThan(0)
    const remoteAfterConflict = await adapter.hydrate('device:family-e2e:a', householdRef, mainRef)
    expect(remoteAfterConflict.status).toBe('ready')
    if (remoteAfterConflict.status === 'ready') {
      expect(exactJson(remoteAfterConflict.bundle)).toBe(exactJson(deviceB.conflicts[0].remoteBundle))
    }

    // A finishes the conflicted assignment offline while B advances the sibling online.
    await contextA.setOffline(true)
    deviceA.setOnline(false)
    await openStudent(pageA, 'Avery Cross Device')
    await pageA.getByRole('button', { name: `Continue ${concurrentTitle}` }).click()
    await advanceOnePart(pageA, 'Device A response saved while offline.')
    const doneOffline = pageA.getByRole('button', { name: 'Done' })
    if (await doneOffline.isVisible().catch(() => false)) await doneOffline.click()
    else await saveAndExit(pageA)
    const providerCallsBeforeOfflinePush = adapter.providerCalls.length
    expect(await deviceA.push(mainRef)).toEqual({ status: 'offline' })
    expect(adapter.providerCalls).toHaveLength(providerCallsBeforeOfflinePush)
    expect(deviceA.pending.has(mainRef)).toBe(true)

    await openStudent(pageB, 'Blake Cross Device')
    await pageB.getByRole('button', { name: `Continue ${SIBLING.title}` }).click()
    await finishCurrentPartAndReturn(pageB, 'Sibling continues online while Device A is offline.')
    expect(await deviceB.push(siblingRef, 'NORMAL_COMPLETION')).toEqual({ status: 'stored', revision: 2, readBackVerified: true })

    await contextA.setOffline(false)
    deviceA.setOnline(true)
    expect(await deviceA.flush(mainRef)).toEqual({ status: 'stored', revision: 3, readBackVerified: true })
    expect(deviceA.pending.has(mainRef)).toBe(false)
    expect((await deviceA.hydrate(householdRef, siblingRef)).status).toBe('ready')
    expect((await deviceB.hydrate(householdRef, mainRef)).status).toBe('ready')
    await Promise.all([pageA.reload(), pageB.reload()])
    const reconciledA = await browserStorageEvidence(pageA)
    const reconciledB = await browserStorageEvidence(pageB)
    expect(assignmentState(reconciledB, mainRef, MAIN.lessonRef).state).toBe('completed')
    expect(learnerState(reconciledB, mainRef).assignments.some((item) => item.title === concurrentTitle && item.state === 'completed')).toBe(true)
    expect(assignmentState(reconciledA, siblingRef, SIBLING.lessonRef))
      .toEqual(assignmentState(reconciledB, siblingRef, SIBLING.lessonRef))

    // A completely fresh third profile hydrates without receiving any PIN or secret material.
    await pageC.goto(APP_URL)
    const cEmpty = await browserStorageEvidence(pageC)
    expect(cEmpty.indexedDb).toEqual([])
    expect(cEmpty.deviceRef).toBe('device:family-e2e:fresh')
    await freshDevice.authenticate(householdRef)
    expect((await freshDevice.hydrate(householdRef, mainRef)).status).toBe('ready')
    expect((await freshDevice.hydrate(householdRef, siblingRef)).status).toBe('ready')
    await pageC.reload()
    const fresh = await browserStorageEvidence(pageC)
    expect(fresh.householdRef).toBe(householdRef)
    expect(fresh.app?.setup.students).toHaveLength(2)
    expect(fresh.app?.setup.students.every((learner) => learner.pinRequired === false)).toBe(true)
    expect(fresh.app?.studentAccessVerifiers).toEqual({})
    expect(fresh.app?.parentAccessVerifier).toBeNull()
    expect(fresh.deviceRef).not.toBe(reconciledA.deviceRef)
    expect(fresh.deviceRef).not.toBe(reconciledB.deviceRef)

    // Every emulator request is inspected, including the underlying four-RPC arguments.
    const payloadEvidence = JSON.stringify({ requests: adapter.requests, rpc: adapter.providerCalls })
    expect(payloadEvidence).not.toMatch(/"(?:answerKey|correctAnswer|expectedAnswer|adultScoringGuide|scoringGuide|parentPin|learnerPin|pinDigest|pinHash|tutorTranscript|rawTutorConversation|serviceRole|serviceKey)"\s*:/i)
    for (const request of adapter.requests.filter((item) => item.learnerRef !== null)) {
      const other = request.learnerRef === mainRef ? siblingRef : mainRef
      expect(JSON.stringify(request.payload)).not.toContain(other)
    }
    for (const call of adapter.providerCalls) {
      const body = JSON.stringify(call.args)
      expect(body.includes(mainRef) && body.includes(siblingRef)).toBe(false)
    }
    const external = browserRequests.filter((raw) => {
      const url = new URL(raw)
      return !['127.0.0.1', 'localhost'].includes(url.hostname) && !['data:', 'blob:'].includes(url.protocol)
    })
    expect(external).toEqual([])
  } finally {
    await Promise.all([contextA.close(), contextB.close(), contextC.close()])
  }
}

test('Family Cloud Sync reconciles three isolated browser profiles through the local emulator', async ({ browser }) => {
  test.setTimeout(600_000)
  await runFamilyTwoDeviceScenario(browser, new LocalFamilyCloudScenarioAdapter())
})
