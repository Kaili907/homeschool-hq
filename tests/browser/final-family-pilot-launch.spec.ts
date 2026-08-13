import { expect, test, chromium, type BrowserContext, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const APP_URL = 'http://127.0.0.1:4181/family-pilot'
const DB = 'manuel-academy.study.family-pilot-durable'
const STORE = 'records'
const CORE_KEY = 'manuel-academy.study.family-pilot-state.v1'
const APP_KEY = 'manuel-academy.study.final-family-pilot-app.v1'
const DURABLE_PREFIX = 'manuel-academy.study.family-pilot-durable-ports.v1'
const PARENT_PIN = '8642'

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

function dynamicSourceBundle(lessonRef: string) {
  const source = (suffix: string, sourceKind: string, authorityTier: string, responsibleParty: string) => ({
    attachmentId: `attachment-${suffix}`, lessonRef, unitRef: 'ma-g3-social-studies-u09',
    issueStatement: 'How does a local budget choice affect families?', sourceIdentifier: `record-${suffix}`,
    sourceTitle: suffix === 'official' ? 'Local government budget update' : 'Independent local budget analysis',
    responsibleParty, sourceDate: '2026-08-12', sourceVersionOrEdition: null,
    retrievalLocation: `local-library:${suffix}`, retrievedOn: '2026-08-13', retrievedByRole: 'PARENT',
    retrievalStatus: 'OPENED_AND_READABLE', mediaType: 'text/html', language: 'English', sourceKind,
    authorityTier, authorityVerified: true, primaryOrSecondary: suffix === 'official' ? 'PRIMARY' : 'SECONDARY',
    primaryOrSecondaryReason: 'The learner classified this source from its relationship to the event.',
    interestDisclosure: 'The responsible party and potential interests are identified.',
    relevanceToIssue: 'The source directly addresses the learner-selected local budget issue.',
    limitsNoted: 'The source covers one jurisdiction and one reporting period.', rightsCategory: 'GOVERNMENT_RECORD',
    rightsStatement: 'Publicly accessible government record or linked analysis used as metadata only.', publicAccess: true,
    selectedByRole: 'PARENT', selectedOn: '2026-08-13', readInFull: true,
    contentSafetyReviewedByRole: 'PARENT', readingLevelReviewedByRole: 'PARENT', previewedForSafetyAndLevel: true,
    containsLearnerPersonalData: false, containsOtherMinorPersonalData: false, quotedTextStored: false,
    contentDigestSha256: null,
  })
  return [
    source('official', 'OFFICIAL_RECORD', 'TIER_1_OFFICIAL_RECORD', 'County public information office'),
    source('independent', 'INDEPENDENT_REPORTING', 'TIER_3_INDEPENDENT_REPORTING', 'Local civic newsroom'),
  ]
}

async function setupFamily(page: Page, students: Array<{ name: string; grade: string }>) {
  await page.goto(APP_URL)
  await expect(page.getByRole('heading', { name: 'Set up your learners' })).toBeVisible()
  for (const student of students) {
    await page.getByLabel('Student display name').fill(student.name)
    await page.getByLabel('Nominal grade').selectOption(student.grade)
    await page.getByRole('button', { name: 'Add student' }).click()
    await expect(page.getByText(new RegExp(`^${student.name} · Nominal Grade ${student.grade}`))).toBeVisible()
  }
  await page.getByLabel('Parent PIN', { exact: true }).fill(PARENT_PIN)
  await page.getByLabel('Confirm parent PIN', { exact: true }).fill(PARENT_PIN)
  await page.getByRole('button', { name: 'Finish family setup' }).click()
  await expect(page.getByRole('heading', { name: 'Household learning' })).toBeVisible()
}

async function parentStudent(page: Page, name: string) {
  await page.getByRole('button', { name: 'Parent', exact: true }).click()
  const unlock = page.getByLabel('Unlock parent PIN')
  if (await unlock.isVisible().catch(() => false)) {
    await unlock.fill(PARENT_PIN)
    await page.getByRole('button', { name: 'Unlock Parent Hub' }).click()
  }
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
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const submitChoice = page.getByRole('button', { name: 'Submit answer', exact: true })
    if (await submitChoice.isVisible().catch(() => false)) {
      await page.getByRole('radio').first().check()
      await submitChoice.click()
      await page.waitForTimeout(25)
      continue
    }
    const submitText = page.getByRole('button', { name: 'Submit', exact: true })
    if (await submitText.isVisible().catch(() => false)) {
      await page.getByLabel(/Your response|Describe what you completed/).fill('Browser proof response saved before Study advances.')
      const completion = page.getByRole('checkbox', { name: 'I completed the action described above.' })
      if (await completion.isVisible().catch(() => false)) await completion.check()
      await submitText.click()
      await page.waitForTimeout(25)
      continue
    }
    break
  }
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect.poll(async () => (await status.count()) ? status.textContent() : 'finished').not.toBe(before)
}

async function finishThreeStepLesson(page: Page) {
  await expect(page.getByText('Step 1 of 3', { exact: true })).toBeVisible()
  await continueStep(page)
  await continueStep(page)
  await continueStep(page)
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
    expect(initial.app.parentPinDigest).toBeTruthy()
    expect(JSON.stringify(initial)).not.toMatch(/1357|8642/)

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
    expect(JSON.stringify(beforeReopenRecords)).not.toMatch(/1357|8642|"tutorTranscript"\s*:|rawTutorConversation/i)
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
    await continueStep(page)
    await expect(page.getByRole('heading', { name: `${LESSON.a.title}: lesson complete` })).toBeVisible()
    await page.getByRole('button', { name: 'Done' }).click()

    await assign(page, 'Avery Synthetic', LESSON.guardian)
    await openStudent(page, 'Avery Synthetic', '1357')
    await startFromHome(page, LESSON.guardian)
    await finishThreeStepLesson(page)
    await expect(page.getByRole('heading', { name: 'Work finished — parent sign-off pending' })).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: 'Parent', exact: true }).click()
    await page.getByLabel('Unlock parent PIN').fill('0000')
    await page.getByRole('button', { name: 'Unlock Parent Hub' }).click()
    await expect(page.getByRole('alert')).toContainText('authorization failed')
    await expect(page.getByRole('heading', { name: 'Guardian attestation pending' })).toHaveCount(0)
    await parentStudent(page, 'Avery Synthetic')
    await page.getByLabel('Parent student').selectOption({ label: 'Blake Synthetic' })
    await expect(page.getByRole('heading', { name: 'Guardian attestation pending' })).toHaveCount(0)
    await page.getByLabel('Parent student').selectOption({ label: 'Avery Synthetic' })
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
    await page.getByLabel('Complete source metadata JSON').fill(JSON.stringify([{ sourceTitle: 'Trivial title-only record' }]))
    await page.getByLabel(/I am an authorized adult/).check()
    await page.getByRole('button', { name: 'Attach qualifying metadata' }).click()
    await expect(page.getByRole('alert')).toContainText(/two qualifying|incomplete/i)
    await expect(page.getByText(/PENDING_SOURCE_ATTACHMENT/)).toBeVisible()
    await page.getByLabel('Complete source metadata JSON').fill(JSON.stringify(dynamicSourceBundle(LESSON.dynamic.lessonRef)))
    await page.getByRole('button', { name: 'Attach qualifying metadata' }).click()
    await expect(page.getByText(/ATTACHED_SATISFIED/)).toBeVisible()
    await page.reload()
    await parentStudent(page, 'Avery Synthetic')
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
    expect(backupText).not.toMatch(/1357|8642|"tutorTranscript"\s*:|rawTutorConversation|"rawAnswer"\s*:/i)
    const backup = JSON.parse(backupText)
    expect(backup.appState.setup.students).toHaveLength(3)
    expect(backup.learnerTextIncluded).toBe(false)
    expect(backup.tutorTranscriptIncluded).toBe(false)
    expect(backup.appState.attestations.some((item: any) => item.status === 'CERTIFIED')).toBe(true)
    expect(backup.appState.sourceAttachments[0]).toMatchObject({ title: 'Local government budget update', publisher: 'County public information office' })
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

test('all 90 grade-subject cells load in Chromium and every subject launches lesson and assessment UI', async ({ page }) => {
  await page.goto(APP_URL)
  const proof = await page.evaluate(async () => {
    const supported = new Set(['NONE', 'READ', 'CHOICE', 'TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE', 'ACTIVITY_EVIDENCE', 'RUBRIC_REVIEW_PENDING', 'GUARDIAN_ATTESTATION'])
    const manifest = await (await fetch('/family-pilot-final/2.0.0/manifest.json')).json()
    const cells: Array<{ courseRef: string; grade: number; subject: string; lessonRef: string; title: string; assessmentRef: string }> = []
    let lessons = 0
    let assessments = 0
    for (const course of manifest.runtime.courses) {
      const payload = await (await fetch(`/family-pilot-final/2.0.0/courses/${encodeURIComponent(course.courseRef)}.json`)).json()
      if (payload.lessons.length !== course.lessonCount || Object.keys(payload.materials).length !== course.lessonCount) throw new Error(`Incomplete browser course ${course.courseRef}`)
      lessons += payload.lessons.length
      assessments += Object.keys(payload.assessments).length
      const lesson = payload.lessons[course.subject === 'arts-and-music' ? 1 : 0]
      const material = payload.materials[lesson.lessonRef]
      if (!material || !(material.sections?.length || material.markdown)) throw new Error(`No learner UI material ${lesson.lessonRef}`)
      const serialized = JSON.stringify(payload)
      if (/answerKeyRef|correctAnswer|answerIndex|expectedAnswer|\/scoring\/|scoring[-_]guide|teacher[-_]guide/i.test(serialized)) throw new Error(`Answer authority leaked in ${course.courseRef}`)
      for (const section of material.sections ?? []) for (const item of section.items ?? []) {
        if (!supported.has(item.responseKind)) throw new Error(`Unsupported response kind ${item.responseKind} in ${lesson.lessonRef}`)
      }
      const assessmentRef = Object.keys(payload.assessments)[0]
      const assessment = payload.assessments[assessmentRef]
      if (!assessment || !assessment.learnerTasks?.length) throw new Error(`No runnable assessment ${course.courseRef}`)
      cells.push({ courseRef: course.courseRef, grade: Number(course.grade), subject: course.subject, lessonRef: lesson.lessonRef, title: lesson.title, assessmentRef })
    }
    return { courses: manifest.runtime.courses.length, lessons, assessments, cells }
  })
  expect(proof).toMatchObject({ courses: 90, lessons: 8292, assessments: 699 })
  expect(new Set(proof.cells.map((cell) => `${cell.grade}:${cell.subject}`)).size).toBe(90)

  await setupFamily(page, [{ name: 'Matrix Student', grade: '9' }])
  const gradeNine = proof.cells.filter((cell) => cell.grade === 9)
  expect(gradeNine).toHaveLength(10)

  for (const cell of gradeNine) {
    await parentStudent(page, 'Matrix Student')
    await page.getByRole('button', { name: 'Assignments & readiness' }).click()
    await page.getByLabel('Admitted course').selectOption(cell.courseRef)
    const lessonRow = page.getByRole('listitem').filter({ hasText: cell.title }).last()
    await expect(lessonRow).toBeVisible()
    await lessonRow.getByRole('button', { name: 'Assign to Matrix Student' }).click()

    const assessmentSection = page.getByTestId('family-pilot-assessment-assignment')
    const assessmentRow = assessmentSection.getByRole('listitem').filter({ hasText: cell.assessmentRef })
    await assessmentRow.getByRole('button', { name: 'Assign assessment' }).click()
    await assessmentRow.getByRole('button', { name: 'Open' }).click()
    await expect(page.locator(`[data-assessment-ref="${cell.assessmentRef}"]`)).toBeVisible()
    await expect(page.locator('[data-assessment-task-ref]').first()).toBeVisible()
    await page.getByRole('button', { name: 'Back to Home' }).click()
  }

  await openStudent(page, 'Matrix Student')
  const requiredVisible: Readonly<Record<string, RegExp>> = {
    'english-language-arts': /Source or reading/i,
    health: /Key points/i,
    'physical-education': /Movement cues/i,
    technology: /Technology activity setup/i,
    'arts-and-music': /ATTACHED MANUEL ACADEMY LEARNER RESOURCE/i,
    science: /Materials|investigation|model/i,
    'social-studies': /Source metadata and context|Source provenance/i,
    'ready-for-life': /Warm Up|Guided|Independent/i,
    'financial-literacy': /Warm Up|Guided|Independent/i,
    mathematics: /Practice|Diagnostic|Lesson work|Launch/i,
  }
  for (const cell of gradeNine) {
    await page.getByRole('button', { name: `Start ${cell.title}` }).click()
    const material = page.locator('[data-material-ref]')
    await expect(material).toBeVisible()
    await expect(material).toContainText(requiredVisible[cell.subject])
    await page.getByRole('button', { name: 'Save and exit' }).click()
    await expect(page.getByRole('heading', { name: 'Hi, Matrix Student' })).toBeVisible()
  }
})

test('an incorrect auto-scoreable response stays pending without answer disclosure', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await setupFamily(page, [{ name: 'Negative Control Student', grade: '9' }])
  await parentStudent(page, 'Negative Control Student')
  await page.getByLabel('Admitted course').selectOption('ma-g9-mathematics')
  const assessmentRow = page.getByTestId('family-pilot-assessment-assignment').getByRole('listitem').first()
  await expect(assessmentRow).toContainText('AUTO SCOREABLE')
  await assessmentRow.getByRole('button', { name: 'Assign assessment' }).click()
  await assessmentRow.getByRole('button', { name: 'Open' }).click()
  await expect(page.locator('[data-assessment-ref]')).toBeVisible()
  const tasks = page.locator('[data-assessment-task-ref]')
  await expect(tasks.first()).toBeVisible()
  expect(await tasks.count()).toBeGreaterThan(0)
  for (let index = 0; index < await tasks.count(); index += 1) {
    const task = tasks.nth(index)
    const radios = task.getByRole('radio')
    if (await radios.count()) await radios.first().check()
    else await task.getByRole('textbox').fill('definitely-wrong-negative-control')
    await task.getByRole('button', { name: 'Save response' }).click()
    await expect(task.getByText('Saved in IndexedDB')).toBeVisible()
  }
  // The first displayed choice is intentionally wrong for the first task (67.0 m² vs 435.8 m²).
  await page.getByRole('button', { name: 'Submit assessment' }).click()
  await expect(page.getByRole('status')).toContainText('PENDING ASSESSMENT')
  await expect(page.getByRole('alert')).toContainText(/no correctness was fabricated/i)
  await expect(page.locator('body')).not.toContainText(/correct answer|solution reasoning|answer key/i)
  const records = await idbRecords(page)
  const serialized = JSON.stringify(records)
  expect(serialized).toContain('PENDING_ASSESSMENT')
  expect(serialized).not.toMatch(/correctAnswer|answerIndex|expectedAnswer|answerKey|solution/i)
  expect(requests.some((url) => /scoring|assessment-score|localhost/i.test(new URL(url).pathname))).toBe(false)
})

test('targeted repaired Math, ELA, and physical Science paths render in the learner UI', async ({ page }) => {
  await page.goto(APP_URL)
  const targets = await page.evaluate(async () => {
    const requested = [
      ['ma-g3-mathematics', 'ma-g3-mathematics-u01-l01', 'Math Three'],
      ['ma-g3-english-language-arts', 'ma-g3-english-language-arts-u01-l01', 'Math Three'],
      ['ma-g7-english-language-arts', 'ma-g7-english-language-arts-u01-l01', 'ELA Seven'],
      ['ma-g10-science', 'ma-hs10-chemistry-u01-l07', 'Science Ten'],
      ['ma-g12-mathematics', 'ma-g12-mathematics-u01-l01', 'Math Twelve'],
      ['ma-g12-english-language-arts', 'ma-g12-english-language-arts-u01-l01', 'Math Twelve'],
    ]
    return Promise.all(requested.map(async ([courseRef, lessonRef, student]) => {
      const payload = await (await fetch(`/family-pilot-final/2.0.0/courses/${courseRef}.json`)).json()
      const lesson = payload.lessons.find((item: any) => item.lessonRef === lessonRef)
      if (!lesson) throw new Error(`Missing target ${lessonRef}`)
      return { courseRef, lessonRef, title: lesson.title, student }
    }))
  })
  await setupFamily(page, [
    { name: 'Math Three', grade: '3' },
    { name: 'ELA Seven', grade: '7' },
    { name: 'Science Ten', grade: '10' },
    { name: 'Math Twelve', grade: '12' },
  ])
  for (const target of targets) await assign(page, target.student, target)

  for (const student of ['Math Three', 'ELA Seven', 'Science Ten', 'Math Twelve']) {
    await openStudent(page, student)
    for (const target of targets.filter((item) => item.student === student)) {
      await page.getByRole('button', { name: `Start ${target.title}` }).click()
      const material = page.locator('[data-material-ref]')
      await expect(material).toBeVisible()
      if (target.courseRef.includes('english-language-arts')) {
        await expect(material).toContainText('Source or reading')
        await expect(material).toContainText(/Completion and success criteria|Success criteria/i)
      } else if (target.courseRef === 'ma-g10-science') {
        await expect(material).toContainText(/physical and chemical properties/i)
        await expect(material).toContainText(/alternative path|alternative activity|same credit/i)
      } else {
        await expect(material).toContainText(/Launch and diagnostic|Independent practice|Mastery check/i)
      }
      await page.getByRole('button', { name: 'Save and exit' }).click()
    }
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
    await parentStudent(pageB, 'Transfer Student')
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
