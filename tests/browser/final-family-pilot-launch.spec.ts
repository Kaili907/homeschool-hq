import { expect, test, chromium, type BrowserContext, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const APP_URL = 'http://127.0.0.1:4181/family-pilot'
const DB = 'manuel-academy.study.family-pilot-durable'
const STORE = 'records'
const CORE_KEY = 'manuel-academy.study.family-pilot-state.v1'
const APP_KEY = 'manuel-academy.study.final-family-pilot-app.v1'
const DURABLE_PREFIX = 'manuel-academy.study.family-pilot-durable-ports.v1'

const LESSON = {
  a: {
    courseRef: 'ma-g5-mathematics',
    lessonRef: 'ma-g5-mathematics-u01-l01',
    title: 'Launch and diagnostic: problem-solving routines',
  },
  b: {
    courseRef: 'ma-g8-mathematics',
    lessonRef: 'ma-g8-mathematics-u01-l01',
    title: 'Launch and diagnostic: rational and irrational numbers',
  },
  c: {
    courseRef: 'ma-g12-science',
    lessonRef: 'ma-hs12-earth-space-environmental-u01-l01',
    title: 'Launch and diagnostic: systems and system models',
  },
  guardian: {
    courseRef: 'ma-g5-ready-for-life',
    lessonRef: 'ma-g5-ready-for-life-u01-l04',
    title: 'Application or project: hazard recognition',
  },
  dynamic: {
    courseRef: 'ma-g3-social-studies',
    lessonRef: 'ma-g3-social-studies-u09-l01',
    title: 'Launch and diagnostic: specialization and interdependence',
  },
} as const

type Lesson = (typeof LESSON)[keyof typeof LESSON]

async function setupFamily(page: Page, students: Array<{ name: string; grade: string }>) {
  await page.goto(APP_URL)
  await expect(page.getByRole('heading', { name: 'Set up your learners' })).toBeVisible()
  for (const student of students) {
    await page.getByLabel('Student display name').fill(student.name)
    await page.getByLabel('Nominal grade').selectOption(student.grade)
    await page.getByRole('button', { name: 'Add student' }).click()
    await expect(page.getByText(new RegExp(`^${student.name} · Nominal Grade ${student.grade}`))).toBeVisible()
  }
  await page.getByRole('button', { name: 'Finish family setup' }).click()
  await expect(page.getByRole('heading', { name: 'Household learning' })).toBeVisible()
}

async function parentStudent(page: Page, name: string) {
  await page.getByRole('button', { name: 'Parent', exact: true }).click()
  await page.getByLabel('Parent student').selectOption({ label: name })
  await expect(page.getByLabel('Parent student').locator('option:checked')).toHaveText(name)
}

async function assign(page: Page, name: string, lesson: Lesson) {
  await parentStudent(page, name)
  await page.getByRole('button', { name: 'Assignments & readiness' }).click()
  await page.getByLabel('Admitted course').selectOption(lesson.courseRef)
  const row = page.getByRole('listitem').filter({ hasText: lesson.title }).last()
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: `Assign to ${name}` }).click()
  await expect(page.getByRole('heading', { name: 'Current work' }).locator('..').getByText(lesson.title)).toBeVisible()
}

async function openStudent(page: Page, name: string, pin?: string) {
  await page.getByRole('button', { name: 'Student', exact: true }).click()
  await page.getByRole('listitem', { name: `Continue as ${name}` }).click()
  if (pin) {
    for (const digit of pin) await page.getByRole('button', { name: `digit ${digit}` }).click()
  } else {
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
  }
  await expect(page.getByRole('heading', { name: `Hi, ${name}` })).toBeVisible()
}

async function startFromHome(page: Page, lesson: Lesson) {
  await page.getByRole('button', { name: `Start ${lesson.title}` }).click()
}

async function resumeFromHome(page: Page, lesson: Lesson) {
  await page.getByRole('button', { name: `Resume ${lesson.title}` }).click()
}

async function continueStep(page: Page) {
  const status = page.getByRole('status').filter({ hasText: /^Step \d+ of \d+$/ })
  const before = await status.textContent()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect.poll(async () => (await status.count()) ? status.textContent() : 'finished').not.toBe(before)
}

async function finishThreeStepLesson(page: Page) {
  await expect(page.getByText('Step 1 of 3', { exact: true })).toBeVisible()
  await continueStep(page)
  await continueStep(page)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
}

async function supportState(page: Page) {
  return page.evaluate(({ coreKey, appKey }) => ({
    core: JSON.parse(localStorage.getItem(coreKey) ?? 'null'),
    app: JSON.parse(localStorage.getItem(appKey) ?? 'null'),
    keys: Object.keys(localStorage).sort(),
  }), { coreKey: CORE_KEY, appKey: APP_KEY })
}

async function idbRecords(page: Page): Promise<Array<{ key: string; value: unknown }>> {
  return page.evaluate(async ({ databaseName, storeName }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const values = await new Promise<Array<{ key: string; value: unknown }>>((resolve, reject) => {
      const request = db.transaction(storeName).objectStore(storeName).getAll()
      request.onsuccess = () => resolve(request.result as Array<{ key: string; value: unknown }>)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return values
  }, { databaseName: DB, storeName: STORE })
}

function studyDocument(records: Array<{ key: string; value: unknown }>, studentRef: string) {
  const envelope = records.find((record) => record.key.includes(`:learner:${encodeURIComponent(studentRef)}`)) as { value?: string } | undefined
  if (!envelope || typeof envelope.value !== 'string') throw new Error(`No durable Study document for ${studentRef}`)
  return JSON.parse(envelope.value)
}

function assignmentFor(core: any, studentRef: string, lessonRef: string) {
  return core.students.find((student: any) => student.studentRef === studentRef)?.assignments.find((assignment: any) => assignment.lessonRef === lessonRef)
}

test('complete family workflow survives a real browser-process reopen and stays isolated', async ({}, testInfo) => {
  const profile = testInfo.outputPath('family-profile')
  let context: BrowserContext | null = await chromium.launchPersistentContext(profile, { headless: true, acceptDownloads: true })
  const requests = new Set<string>()
  const watchNetwork = (held: BrowserContext) => held.on('request', (request) => requests.add(request.url()))
  watchNetwork(context)
  let page = context.pages()[0] ?? await context.newPage()

  try {
    await setupFamily(page, [
      { name: 'Avery Synthetic', grade: '6' },
      { name: 'Blake Synthetic', grade: '8' },
      { name: 'Casey Synthetic', grade: '12' },
    ])

    await parentStudent(page, 'Avery Synthetic')
    await page.getByRole('button', { name: 'Preferences' }).click()
    await page.getByLabel('Working grade for Mathematics').selectOption('5')
    await page.getByLabel('Working grade for Science').selectOption('7')
    await page.getByLabel('Working grade for Social Studies').selectOption('3')
    await page.getByLabel('Working grade for Ready for Life').selectOption('5')
    page.once('dialog', (dialog) => dialog.accept('1357'))
    await page.getByLabel('PIN required').check()
    await page.getByRole('button', { name: 'Close' }).click()
    const courseOptions = await page.getByLabel('Admitted course').locator('option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))
    expect(courseOptions).toEqual([
      'ma-g5-mathematics',
      'ma-g7-science',
      'ma-g3-social-studies',
      'ma-g5-ready-for-life',
    ])
    expect(courseOptions.some((course) => course.includes('g6'))).toBe(false)

    await assign(page, 'Avery Synthetic', LESSON.a)
    await assign(page, 'Blake Synthetic', LESSON.b)
    await assign(page, 'Casey Synthetic', LESSON.c)

    const initial = await supportState(page)
    const aRef = initial.app.setup.students.find((student: any) => student.displayName === 'Avery Synthetic').studentRef
    const bRef = initial.app.setup.students.find((student: any) => student.displayName === 'Blake Synthetic').studentRef
    const cRef = initial.app.setup.students.find((student: any) => student.displayName === 'Casey Synthetic').studentRef
    expect(initial.app.pinDigests[aRef]).toBeTruthy()
    expect(JSON.stringify(initial)).not.toContain('1357')

    await page.getByRole('button', { name: 'Student', exact: true }).click()
    await page.getByRole('listitem', { name: 'Continue as Avery Synthetic' }).click()
    for (const digit of '0000') await page.getByRole('button', { name: `digit ${digit}` }).click()
    await expect(page.getByRole('alert')).toContainText('That PIN is not right')
    for (const digit of '1357') await page.getByRole('button', { name: `digit ${digit}` }).click()
    await expect(page.getByRole('heading', { name: 'Hi, Avery Synthetic' })).toBeVisible()
    await expect(page.getByText(LESSON.a.title, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(LESSON.b.title, { exact: true })).toHaveCount(0)
    await startFromHome(page, LESSON.a)
    await expect(page.locator(`[data-material-ref]`)).toContainText(LESSON.a.title)
    await expect(page.locator(`[data-material-ref]`)).not.toContainText(/answer key|teacher guide|scoring guide/i)
    await expect(page.getByText('Step 1 of 3', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Ask the Tutor for help' }).click()
    await expect(page.getByText('Tutor help', { exact: true })).toBeVisible()
    await expect(page.getByText(/accepted static curriculum fallback/)).toBeVisible()
    await continueStep(page)
    await continueStep(page)
    await expect(page.getByText('Step 3 of 3', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Save and exit' }).click()
    await expect(page.getByRole('heading', { name: 'Hi, Avery Synthetic' })).toBeVisible()

    const beforeReopenRecords = await idbRecords(page)
    const beforeReopenDocument = studyDocument(beforeReopenRecords, aRef)
    expect(JSON.stringify(beforeReopenDocument)).toContain(LESSON.a.lessonRef)
    expect(JSON.stringify(beforeReopenDocument).match(/completed/g)?.length ?? 0).toBeGreaterThan(1)
    const storageBefore = await supportState(page)
    expect(storageBefore.keys.some((key) => key.startsWith(DURABLE_PREFIX))).toBe(false)
    expect(JSON.stringify(storageBefore.core)).not.toContain('calendarState')

    await context.close()
    context = await chromium.launchPersistentContext(profile, { headless: true, acceptDownloads: true })
    watchNetwork(context)
    page = context.pages()[0] ?? await context.newPage()
    await page.goto(APP_URL)
    await openStudent(page, 'Avery Synthetic', '1357')
    await resumeFromHome(page, LESSON.a)
    await expect(page.getByText('Step 3 of 3', { exact: true })).toBeVisible()
    expect(studyDocument(await idbRecords(page), aRef)).toEqual(beforeReopenDocument)

    await page.getByRole('button', { name: 'I need an adult check-in' }).click()
    await expect(page.getByText('A parent check-in is now required')).toBeVisible()
    await page.getByRole('button', { name: 'Save and exit' }).click()
    await expect(page.getByRole('heading', { name: 'Study is on hold' })).toBeVisible()
    await expect(page.getByRole('button', { name: `Resume ${LESSON.a.title}` })).toBeDisabled()

    await page.getByRole('button', { name: 'Switch student' }).click()
    await page.getByRole('listitem', { name: 'Continue as Blake Synthetic' }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByText(LESSON.a.title, { exact: true })).toHaveCount(0)
    await startFromHome(page, LESSON.b)
    await finishThreeStepLesson(page)
    await expect(page.getByRole('heading', { name: `${LESSON.b.title}: lesson complete` })).toBeVisible()
    await page.getByRole('button', { name: 'Done' }).click()

    await page.getByRole('button', { name: 'Parent', exact: true }).click()
    await parentStudent(page, 'Avery Synthetic')
    await expect(page.getByRole('heading', { name: 'Safety check-in' })).toBeVisible()
    await page.getByRole('button', { name: 'Parent checked in — clear hold' }).click()
    await expect(page.getByRole('heading', { name: 'Safety check-in' })).toHaveCount(0)
    await openStudent(page, 'Avery Synthetic', '1357')
    await resumeFromHome(page, LESSON.a)
    await expect(page.getByText('Step 3 of 3', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: `${LESSON.a.title}: lesson complete` })).toBeVisible()
    await page.getByRole('button', { name: 'Done' }).click()

    await assign(page, 'Avery Synthetic', LESSON.guardian)
    await openStudent(page, 'Avery Synthetic', '1357')
    await startFromHome(page, LESSON.guardian)
    await finishThreeStepLesson(page)
    await expect(page.getByRole('heading', { name: 'Work finished — parent sign-off pending' })).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: 'Parent', exact: true }).click()
    await parentStudent(page, 'Avery Synthetic')
    await expect(page.getByRole('heading', { name: 'Guardian attestation pending' })).toBeVisible()
    await page.getByRole('button', { name: 'Attest: adult observed' }).click()
    await expect(page.getByRole('heading', { name: 'Guardian attestation pending' })).toHaveCount(0)

    await assign(page, 'Avery Synthetic', LESSON.dynamic)
    await openStudent(page, 'Avery Synthetic', '1357')
    await startFromHome(page, LESSON.dynamic)
    await expect(page.getByRole('heading', { name: 'Lesson not ready' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText('source')
    await page.getByRole('button', { name: 'Back to Home' }).click()
    await page.getByRole('button', { name: 'Parent', exact: true }).click()
    await parentStudent(page, 'Avery Synthetic')
    await page.getByLabel('Source title').fill('Local economics packet')
    await page.getByLabel('Publisher').fill('Manuel Academy family library')
    await page.getByLabel('Publication date').fill('2026-08-13')
    await page.getByRole('button', { name: 'Attach qualifying metadata' }).click()
    await expect(page.getByText(/ATTACHED_SATISFIED/)).toBeVisible()
    await page.reload()
    await expect(page.getByText(/ATTACHED_SATISFIED/)).toBeVisible()
    await openStudent(page, 'Avery Synthetic', '1357')
    await startFromHome(page, LESSON.dynamic)
    await continueStep(page)
    await page.getByRole('button', { name: 'Save and exit' }).click()

    await page.getByRole('button', { name: 'Parent', exact: true }).click()
    await parentStudent(page, 'Avery Synthetic')
    await page.getByRole('button', { name: 'Reports' }).click()
    await expect(page.getByRole('heading', { name: 'Subject and grade progress' })).toBeVisible()
    await expect(page.getByText(/Mathematics · Working Grade 5 · 1\/1 completed/)).toBeVisible()
    await expect(page.getByText('Pending guardian attestations: 0')).toBeVisible()
    await expect(page.getByText('Open safety holds: 0')).toBeVisible()
    await parentStudent(page, 'Blake Synthetic')
    await page.getByRole('button', { name: 'Reports' }).click()
    await expect(page.getByText(/Mathematics · Working Grade 8 · 1\/1 completed/)).toBeVisible()

    await parentStudent(page, 'Avery Synthetic')
    await page.getByRole('button', { name: 'Backup' }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download backup' }).click()
    const download = await downloadPromise
    const backupPath = testInfo.outputPath('family-pilot-backup.json')
    await download.saveAs(backupPath)
    const backupText = readFileSync(backupPath, 'utf8')
    const backup = JSON.parse(backupText)
    expect(backup.appState.setup.students).toHaveLength(3)
    expect(backup.learnerTextIncluded).toBe(false)
    expect(backup.tutorTranscriptIncluded).toBe(false)
    expect(backup.appState.attestations.some((item: any) => item.status === 'CERTIFIED')).toBe(true)
    expect(backup.appState.sourceAttachments[0]).toMatchObject({ title: 'Local economics packet', publisher: 'Manuel Academy family library' })
    expect(backup.studyDocuments.filter((item: any) => item.record)).toHaveLength(2)

    await page.getByRole('button', { name: 'Preferences' }).click()
    await page.getByLabel('Display name').fill('Changed Name')
    await page.getByLabel('Display name').blur()
    await expect(page.getByRole('heading', { name: 'Preferences — Changed Name' })).toBeVisible()
    await page.getByRole('button', { name: 'Backup' }).click()
    const chooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Restore validated backup' }).click()
    await (await chooserPromise).setFiles(backupPath)
    await expect(page.getByLabel('Parent student')).toContainText('Avery Synthetic')

    const validBeforeNegative = await supportState(page)
    for (const invalid of [
      { name: 'corrupt.json', mimeType: 'application/json', buffer: Buffer.from('{not-json') },
      { name: 'future.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...backup, backupSchemaVersion: 999 })) },
    ]) {
      const alertPromise = page.waitForEvent('dialog')
      const filePromise = page.waitForEvent('filechooser')
      await page.getByRole('button', { name: 'Restore validated backup' }).click()
      await (await filePromise).setFiles(invalid)
      const alert = await alertPromise
      expect(alert.message()).toContain('Backup was not restored')
      await alert.accept()
      expect(await supportState(page)).toEqual(validBeforeNegative)
    }

    const final = await supportState(page)
    expect(assignmentFor(final.core, aRef, LESSON.a.lessonRef).state).toBe('completed')
    expect(assignmentFor(final.core, bRef, LESSON.b.lessonRef).state).toBe('completed')
    expect(assignmentFor(final.core, aRef, LESSON.guardian.lessonRef).state).toBe('completed')
    expect(assignmentFor(final.core, aRef, LESSON.dynamic.lessonRef).state).toBe('active')
    expect(assignmentFor(final.core, cRef, LESSON.c.lessonRef).state).toBe('planned')
    expect(final.app.attestations.find((item: any) => item.lessonRef === LESSON.guardian.lessonRef)).toMatchObject({
      studentRef: aRef,
      authority: 'GUARDIAN_ATTESTATION_REQUIRED',
      status: 'CERTIFIED',
    })
    expect(final.app.attestations.find((item: any) => item.lessonRef === LESSON.guardian.lessonRef).attestedByRef).toMatch(/^adult:/)
    expect(final.app.sourceAttachments[0]).toMatchObject({ studentRef: aRef, lessonRef: LESSON.dynamic.lessonRef, status: 'ATTACHED_SATISFIED' })
    expect(final.app.safety.holds.every((hold: any) => hold.clearedAt)).toBe(true)
    expect(JSON.stringify(final)).not.toMatch(/answerKeyRef|tutorTranscript|1357/)

    const external = [...requests].filter((raw) => {
      const url = new URL(raw)
      return !['127.0.0.1', 'localhost'].includes(url.hostname) && !['data:', 'blob:'].includes(url.protocol)
    })
    expect(external).toEqual([])
  } finally {
    await context?.close()
  }
})

test('a second fresh browser is independent until a Parent Download Backup is restored', async ({}, testInfo) => {
  const profileA = testInfo.outputPath('transfer-browser-a')
  const profileB = testInfo.outputPath('transfer-browser-b')
  let contextA: BrowserContext | null = await chromium.launchPersistentContext(profileA, { headless: true, acceptDownloads: true })
  let contextB: BrowserContext | null = null

  try {
    const pageA = contextA.pages()[0] ?? await contextA.newPage()
    await setupFamily(pageA, [{ name: 'Transfer Student', grade: '5' }])
    await expect(pageA.getByTestId('family-pilot-device-storage-notice')).toContainText('saves progress in this browser on this device')
    await assign(pageA, 'Transfer Student', LESSON.a)
    const browserAState = await supportState(pageA)
    const studentRef = browserAState.app.setup.students[0].studentRef
    await openStudent(pageA, 'Transfer Student')
    await startFromHome(pageA, LESSON.a)
    await continueStep(pageA)
    await pageA.getByRole('button', { name: 'Save and exit' }).click()

    await parentStudent(pageA, 'Transfer Student')
    await pageA.getByRole('button', { name: 'Backup' }).click()
    const downloadPromise = pageA.waitForEvent('download')
    await pageA.getByRole('button', { name: 'Download backup' }).click()
    const backupPath = testInfo.outputPath('cross-browser-family-pilot-backup.json')
    await (await downloadPromise).saveAs(backupPath)
    const browserAStudy = studyDocument(await idbRecords(pageA), studentRef)

    await contextA.close()
    contextA = null

    contextB = await chromium.launchPersistentContext(profileB, { headless: true, acceptDownloads: true })
    const pageB = contextB.pages()[0] ?? await contextB.newPage()
    await pageB.goto(APP_URL)
    await expect(pageB.getByRole('heading', { name: 'Set up your learners' })).toBeVisible()
    await expect(pageB.getByText('Transfer Student', { exact: true })).toHaveCount(0)
    expect((await supportState(pageB)).app?.setup.students ?? []).toEqual([])

    const chooserPromise = pageB.waitForEvent('filechooser')
    await pageB.getByRole('button', { name: 'Restore a Family Pilot backup' }).click()
    await (await chooserPromise).setFiles(backupPath)
    await expect(pageB.getByRole('heading', { name: 'Household learning' })).toBeVisible()
    await expect(pageB.getByLabel('Parent student')).toContainText('Transfer Student')
    expect(studyDocument(await idbRecords(pageB), studentRef)).toEqual(browserAStudy)

    await openStudent(pageB, 'Transfer Student')
    await resumeFromHome(pageB, LESSON.a)
    await expect(pageB.getByText('Step 2 of 3', { exact: true })).toBeVisible()
  } finally {
    await contextA?.close()
    await contextB?.close()
  }
})

test('a refused real IndexedDB write does not advance visible or supporting state', async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      if (sessionStorage.getItem('family-pilot-refuse-idb') === '1' && String(key).includes(':learner:')) {
        throw new DOMException('Injected launch-audit refusal', 'QuotaExceededError')
      }
      return original.call(this, value, key)
    }
  })
  await setupFamily(page, [{ name: 'Refusal Student', grade: '5' }])
  await assign(page, 'Refusal Student', LESSON.a)
  const state = await supportState(page)
  const studentRef = state.app.setup.students[0].studentRef
  await openStudent(page, 'Refusal Student')
  await startFromHome(page, LESSON.a)
  await expect(page.getByText('Step 1 of 3', { exact: true })).toBeVisible()
  const beforeDocument = studyDocument(await idbRecords(page), studentRef)
  const beforeCore = (await supportState(page)).core
  await page.evaluate(() => sessionStorage.setItem('family-pilot-refuse-idb', '1'))
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Nothing was recorded')
  await expect(page.getByRole('heading', { name: 'Lesson not ready' })).toBeVisible()
  await expect(page.getByText('Step 2 of 3', { exact: true })).toHaveCount(0)
  expect(studyDocument(await idbRecords(page), studentRef)).toEqual(beforeDocument)
  expect((await supportState(page)).core).toEqual(beforeCore)
  expect((await idbRecords(page)).some((record) => record.key === `${DURABLE_PREFIX}:health` && record.value === 'write-failed')).toBe(true)
})

test('a corrupt durable Study document fails closed and preserves quarantine evidence', async ({}, testInfo) => {
  const profile = testInfo.outputPath('corrupt-profile')
  let context = await chromium.launchPersistentContext(profile, { headless: true })
  let page = context.pages()[0] ?? await context.newPage()
  await setupFamily(page, [{ name: 'Corrupt Student', grade: '5' }])
  await assign(page, 'Corrupt Student', LESSON.a)
  const state = await supportState(page)
  const studentRef = state.app.setup.students[0].studentRef
  await openStudent(page, 'Corrupt Student')
  await startFromHome(page, LESSON.a)
  await continueStep(page)
  await page.getByRole('button', { name: 'Save and exit' }).click()
  await page.evaluate(async ({ databaseName, storeName, student, prefix }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const key = `${prefix}:learner:${encodeURIComponent(student)}`
    await new Promise<void>((resolve, reject) => {
      const store = db.transaction(storeName, 'readwrite').objectStore(storeName)
      const get = store.get(key)
      get.onsuccess = () => {
        const envelope = get.result
        const put = store.put({ ...envelope, value: '{corrupt-study-document' }, key)
        put.onsuccess = () => resolve()
        put.onerror = () => reject(put.error)
      }
      get.onerror = () => reject(get.error)
    })
    db.close()
  }, { databaseName: DB, storeName: STORE, student: studentRef, prefix: DURABLE_PREFIX })
  await context.close()

  context = await chromium.launchPersistentContext(profile, { headless: true })
  page = context.pages()[0] ?? await context.newPage()
  try {
    await page.goto(APP_URL)
    await openStudent(page, 'Corrupt Student')
    await resumeFromHome(page, LESSON.a)
    await expect(page.getByRole('heading', { name: 'Lesson not ready' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(/not being saved|unreadable|safely/i)
    await expect(page.getByText('Step 1 of 3', { exact: true })).toHaveCount(0)
    const records = await idbRecords(page)
    expect(records.some((record) => record.key.endsWith(':quarantine'))).toBe(true)
    expect(assignmentFor((await supportState(page)).core, studentRef, LESSON.a.lessonRef).progress.completedSegmentRefs).toHaveLength(1)
  } finally {
    await context.close()
  }
})
