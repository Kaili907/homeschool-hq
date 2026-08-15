import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadFinalFamilyPilotCatalog, type FinalFamilyPilotCatalog } from '../../../curriculum/final-app-data'
import { ACADEMY_SUBJECTS } from '../../../types'
import { createStudent, completeSetup, EMPTY_FAMILY_SETUP_STATE, setWorkingGrade } from '../setup'
import { createFakeIndexedDb, type FakeIndexedDb } from '../durable-indexeddb/testing/fakeIndexedDb'
import {
  FinalFamilyPilotController,
  finalFamilyPilotSafetyPort,
} from './controller'
import {
  exportFinalFamilyPilotBackup,
  previewFinalFamilyPilotRestore,
  restoreFinalFamilyPilotBackup,
  validateFinalFamilyPilotBackup,
} from './backup'
import {
  FINAL_FAMILY_PILOT_APP_STATE_KEY,
  loadFinalFamilyPilotAppState,
} from './state'

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>()
  get length() { return this.#values.size }
  clear() { this.#values.clear() }
  getItem(key: string) { return this.#values.get(key) ?? null }
  key(index: number) { return [...this.#values.keys()][index] ?? null }
  removeItem(key: string) { this.#values.delete(key) }
  setItem(key: string, value: string) { this.#values.set(key, value) }
}

const root = process.cwd()
const browserRoot = join(root, 'public', 'family-pilot-final', '2.0.0')
let catalog: FinalFamilyPilotCatalog

async function fileFetch(input: RequestInfo | URL): Promise<Response> {
  const raw = String(input)
  const marker = 'family-pilot-final/2.0.0/'
  const relative = raw.slice(raw.indexOf(marker) + marker.length)
  try {
    return new Response(await readFile(join(browserRoot, decodeURIComponent(relative))), { status: 200 })
  } catch {
    return new Response('missing', { status: 404 })
  }
}

beforeAll(async () => {
  try { await stat(join(browserRoot, 'manifest.json')) } catch {
    execFileSync(process.execPath, ['scripts/build-final-family-pilot-data.mjs'], { cwd: root, stdio: 'inherit' })
  }
  catalog = await loadFinalFamilyPilotCatalog({ fetch: fileFetch as typeof fetch, baseUrl: '/' })
})

function clock() {
  let tick = Date.parse('2026-08-13T13:00:00.000Z')
  return () => new Date((tick += 1000))
}

function makeController(
  storage = new MemoryStorage(),
  factory: FakeIndexedDb = createFakeIndexedDb(),
  now: () => Date = clock(),
) {
  return {
    storage,
    factory,
    controller: new FinalFamilyPilotController({
      catalog,
      coreStore: { storage },
      appStore: { storage, householdRef: 'household:test' },
      indexedDb: { safety: finalFamilyPilotSafetyPort, factory: factory.factory, storageManager: factory.storageManager },
      now,
    }),
  }
}

function setupTwo(controller: FinalFamilyPilotController) {
  let setup = createStudent(EMPTY_FAMILY_SETUP_STATE, {
    studentRef: 'student:a', displayName: 'Ada', nominalGrade: '5', enabledSubjects: ACADEMY_SUBJECTS,
  }, '2026-08-13T12:00:00.000Z')
  expect(setup.status).toBe('ok')
  if (setup.status !== 'ok') throw new Error('fixture setup')
  setup = createStudent(setup.state, {
    studentRef: 'student:b', displayName: 'Bo', nominalGrade: '7', enabledSubjects: ACADEMY_SUBJECTS,
  }, '2026-08-13T12:00:01.000Z')
  if (setup.status !== 'ok') throw new Error('fixture setup')
  const working = setWorkingGrade(setup.state, 'student:a', 'social-studies', '3', '2026-08-13T12:00:02.000Z')
  if (working.status !== 'ok') throw new Error('fixture setup')
  const finished = completeSetup(working.state, '2026-08-13T12:00:03.000Z')
  if (finished.status !== 'ok') throw new Error('fixture setup')
  controller.setParentPin('2468')
  controller.saveSetup(finished.state)
  controller.setParentPin('2468')
  return finished.state
}

async function firstLesson(subject: string, grade: number) {
  const course = catalog.runtime.listCourses(grade as never).find((item) => item.subject === subject)
  if (!course) throw new Error(`course fixture ${subject}/${grade}`)
  return (await catalog.runtime.listLessons(course.courseRef))[0]!
}

async function lessonWithBinding(predicate: (binding: NonNullable<Awaited<ReturnType<FinalFamilyPilotCatalog['getBinding']>>>) => boolean) {
  for (const course of catalog.manifest.runtime.courses) {
    const payload = await catalog.loadCoursePayload(course.courseRef)
    const match = Object.values(payload.bindings).find(predicate)
    if (match) return payload.lessons.find((lesson) => lesson.lessonRef === match.lessonRef)!
  }
  throw new Error('required production binding fixture not found')
}

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

async function finish(controller: FinalFamilyPilotController, studentRef: string, assignmentRef: string) {
  let latest = await controller.start(studentRef, assignmentRef)
  expect(latest.status).toBe('ok')
  for (let step = 0; latest.status === 'ok' && latest.study.assignmentState !== 'completed' && step < 10; step += 1) {
    latest = await controller.completeSegment(studentRef, assignmentRef)
  }
  return latest
}

describe('final Family Pilot real convergence', () => {
  it('opens exactly the admitted final release and lazily resolves every production binding', async () => {
    expect(catalog.manifest.counts).toEqual({ grades: 9, courses: 90, units: 698, lessons: 8292, assessments: 699 })
    expect(catalog.runtime.listGrades()).toEqual([3, 4, 5, 7, 8, 9, 10, 11, 12])
    expect(catalog.runtime.listCourses(6 as never)).toEqual([])
    let bindings = 0
    for (const course of catalog.manifest.runtime.courses) {
      const payload = await catalog.loadCoursePayload(course.courseRef)
      bindings += Object.keys(payload.bindings).length
      expect(payload.lessons).toHaveLength(course.lessonCount)
      expect(Object.keys(payload.materials)).toHaveLength(course.lessonCount)
      expect(JSON.stringify(payload)).not.toMatch(/answerKeyRef|scoringAuthorityRef|scoringRef|correctAnswer|answerIndex|answer-keys|scoring-guide|teacher-guide/i)
    }
    expect(bindings).toBe(8292)
  }, 120_000)

  it('keeps nominal Grade 6 unsupported until a per-subject supported working grade is configured', () => {
    const { controller } = makeController()
    const setup = createStudent(EMPTY_FAMILY_SETUP_STATE, {
      studentRef: 'student:six', displayName: 'Six', nominalGrade: '6', enabledSubjects: ['mathematics'],
    }, '2026-08-13T12:00:00.000Z')
    if (setup.status !== 'ok') throw new Error('fixture setup')
    const refused = completeSetup(setup.state, '2026-08-13T12:00:01.000Z')
    expect(refused.status).toBe('blocked')
    const working = setWorkingGrade(setup.state, 'student:six', 'mathematics', '5', '2026-08-13T12:00:02.000Z')
    if (working.status !== 'ok') throw new Error('fixture setup')
    const finished = completeSetup(working.state, '2026-08-13T12:00:03.000Z')
    if (finished.status !== 'ok') throw new Error('fixture setup')
    controller.saveSetup(finished.state)
    expect(controller.coursesFor(finished.state.students[0]!, 'mathematics').map((course) => course.grade)).toEqual([5])
    controller.close()
  })

  it('requires an explicit alternate level for manual work, preserves official level, and deduplicates exact items', async () => {
    const { controller } = makeController()
    const setup = setupTwo(controller)
    const student = setup.students.find((item) => item.studentRef === 'student:a')!
    const alternateLesson = await firstLesson('mathematics', 7)

    await expect(controller.assignLesson('student:a', alternateLesson.lessonRef)).rejects.toThrow(/choose the different supported level explicitly/i)
    const assigned = await controller.assignLesson('student:a', alternateLesson.lessonRef, { explicitBrowseGrade: '7' })
    const duplicate = await controller.assignLesson('student:a', alternateLesson.lessonRef, { explicitBrowseGrade: '7' })
    expect(duplicate.assignmentRef).toBe(assigned.assignmentRef)
    expect(controller.coreSnapshot.state.students.find((item) => item.studentRef === 'student:a')?.assignments.filter((item) => item.lessonRef === alternateLesson.lessonRef)).toHaveLength(1)
    expect(student.workingGradeBySubject.mathematics).toBeUndefined()
    expect(student.nominalGrade).toBe('5')

    const course = catalog.runtime.getCourse(alternateLesson.courseRef)!
    const assessment = catalog.listAssessments(course.courseRef)[0]!
    await expect(controller.assignAssessment('student:a', assessment.assessmentRef)).rejects.toThrow(/choose the different supported level explicitly/i)
    const assignedAssessment = await controller.assignAssessment('student:a', assessment.assessmentRef, { explicitBrowseGrade: '7' })
    const duplicateAssessment = await controller.assignAssessment('student:a', assessment.assessmentRef, { explicitBrowseGrade: '7' })
    expect(duplicateAssessment.assignmentRef).toBe(assignedAssessment.assignmentRef)
    expect(controller.assessmentAssignments('student:a').filter((item) => item.assessmentRef === assessment.assessmentRef)).toHaveLength(1)
    expect(controller.appSnapshot.state.setup.students.find((item) => item.studentRef === 'student:a')?.workingGradeBySubject.mathematics).toBeUndefined()
    controller.close()
  }, 60_000)

  it('keeps two students isolated and cold-reopens the exact IndexedDB checkpoint', async () => {
    const { controller, storage, factory } = makeController()
    setupTwo(controller)
    const aLesson = await firstLesson('mathematics', 5)
    const bLesson = await firstLesson('science', 7)
    const aAssignment = await controller.assignLesson('student:a', aLesson.lessonRef)
    const bAssignment = await controller.assignLesson('student:b', bLesson.lessonRef)
    const started = await controller.start('student:a', aAssignment.assignmentRef)
    expect(started.status).toBe('ok')
    const progressed = await controller.completeSegment('student:a', aAssignment.assignmentRef)
    expect(progressed.status).toBe('ok')
    if (progressed.status !== 'ok') return
    await controller.checkpoint('student:a', aAssignment.assignmentRef)
    const exactSegment = progressed.study.segmentRef
    const exactCompleted = progressed.study.completedSegmentRefs
    expect(controller.coreSnapshot.state.students.find((item) => item.studentRef === 'student:b')?.assignments[0]?.state).toBe('planned')
    controller.close()

    const reloaded = makeController(storage, factory).controller
    const reopened = await reloaded.reopen('student:a', aAssignment.assignmentRef)
    expect(reopened.status).toBe('ok')
    if (reopened.status === 'ok') {
      expect(reopened.study.segmentRef).toBe(exactSegment)
      expect(reopened.study.completedSegmentRefs).toEqual(exactCompleted)
      expect(reopened.study.session.learnerRef).toBe('student:a')
    }
    const bStarted = await reloaded.start('student:b', bAssignment.assignmentRef)
    expect(bStarted.status).toBe('ok')
    if (bStarted.status === 'ok') expect(bStarted.study.session.learnerRef).toBe('student:b')
    reloaded.close()
  }, 60_000)

  it('completes ordinary work through the final Study composition', async () => {
    const { controller } = makeController()
    setupTwo(controller)
    const lesson = await firstLesson('health', 5)
    const assignment = await controller.assignLesson('student:a', lesson.lessonRef)
    const completed = await finish(controller, 'student:a', assignment.assignmentRef)
    expect(completed.status).toBe('ok')
    if (completed.status === 'ok') expect(completed.completionStatus).toBe('CERTIFIED')
    expect(controller.coreSnapshot.state.students[0]?.assignments[0]?.state).toBe('completed')
    controller.close()
  }, 60_000)

  it('normalizes ordinary millisecond browser timing for accepted calendar transitions', async () => {
    let tick = Date.parse('2026-08-13T13:00:00.137Z')
    const { controller } = makeController(
      new MemoryStorage(),
      createFakeIndexedDb(),
      () => new Date((tick += 137)),
    )
    setupTwo(controller)
    const lesson = await firstLesson('mathematics', 5)
    const assignment = await controller.assignLesson('student:a', lesson.lessonRef)
    const completed = await finish(controller, 'student:a', assignment.assignmentRef)
    expect(completed.status).toBe('ok')
    if (completed.status === 'ok') expect(completed.completionStatus).toBe('CERTIFIED')
    controller.close()
  }, 60_000)

  it('keeps RFL pending until exact authorized attestation, including equal-credit mode', async () => {
    const { controller } = makeController()
    setupTwo(controller)
    const lesson = await lessonWithBinding((binding) => binding.grade === 5 && binding.completionAuthority === 'GUARDIAN_ATTESTATION_REQUIRED')
    const assignment = await controller.assignLesson('student:a', lesson.lessonRef)
    const finished = await finish(controller, 'student:a', assignment.assignmentRef)
    expect(finished.status).toBe('ok')
    if (finished.status === 'ok') expect(finished.completionStatus).toBe('PENDING_GUARDIAN_ATTESTATION')
    expect(controller.coreSnapshot.state.students[0]?.assignments[0]?.state).not.toBe('completed')
    expect(controller.pendingAttestations('student:b')).toHaveLength(0)
    const certified = await controller.attest('student:a', assignment.assignmentRef, 'simulated-alternative')
    expect(certified.status).toBe('ok')
    expect(controller.coreSnapshot.state.students[0]?.assignments[0]?.state).toBe('completed')
    controller.close()
  }, 60_000)

  it('blocks only the affected dynamic Social lesson until minimized source metadata is attached', async () => {
    const { controller } = makeController()
    setupTwo(controller)
    const dynamicLesson = await lessonWithBinding((binding) => binding.sourceReadinessKind === 'DYNAMIC_SOURCE_REQUIRED')
    const ordinaryLesson = await firstLesson('social-studies', 7)
    const dynamic = await controller.assignLesson('student:a', dynamicLesson.lessonRef)
    const ordinary = await controller.assignLesson('student:b', ordinaryLesson.lessonRef)
    const blocked = await controller.start('student:a', dynamic.assignmentRef)
    expect(blocked.status).toBe('rejected')
    if (blocked.status === 'rejected') expect(blocked.message).toContain('source metadata')
    expect((await controller.start('student:b', ordinary.assignmentRef)).status).toBe('ok')
    expect(() => controller.attachDynamicSource({
      studentRef: 'student:a', assignmentRef: dynamic.assignmentRef,
      sources: [{ sourceTitle: 'Trivial title-only record' }], adultAttested: true,
    })).toThrow(/two qualifying|incomplete/i)
    expect((await controller.start('student:a', dynamic.assignmentRef)).status).toBe('rejected')
    controller.attachDynamicSource({ studentRef: 'student:a', assignmentRef: dynamic.assignmentRef,
      sources: dynamicSourceBundle(dynamicLesson.lessonRef), adultAttested: true })
    expect((await controller.start('student:a', dynamic.assignmentRef)).status).toBe('ok')
    controller.close()
  }, 60_000)

  it('scopes safety hold and clear to the exact student/session while a sibling remains usable', async () => {
    const { controller } = makeController()
    setupTwo(controller)
    const a = await controller.assignLesson('student:a', (await firstLesson('science', 5)).lessonRef)
    const b = await controller.assignLesson('student:b', (await firstLesson('science', 7)).lessonRef)
    expect((await controller.start('student:a', a.assignmentRef)).status).toBe('ok')
    expect((await controller.start('student:b', b.assignmentRef)).status).toBe('ok')
    const hold = await controller.requestAdultHelp('student:a', a.assignmentRef)
    expect((await controller.reopen('student:a', a.assignmentRef)).status).toBe('rejected')
    expect((await controller.reopen('student:b', b.assignmentRef)).status).toBe('ok')
    await controller.clearHold('student:a', a.assignmentRef, hold.holdRef)
    expect((await controller.reopen('student:a', a.assignmentRef)).status).toBe('ok')
    controller.close()
  }, 60_000)

  it('uses accepted static Tutor help without persisting a conversation', async () => {
    const { controller, storage } = makeController()
    setupTwo(controller)
    const assignment = await controller.assignLesson('student:a', (await firstLesson('technology', 5)).lessonRef)
    await controller.start('student:a', assignment.assignmentRef)
    const help = await controller.tutor('student:a', assignment.assignmentRef)
    expect(help.status).toBe('ok')
    if (help.status === 'ok') expect(help.step.session.path).toBe('static-fallback')
    const persisted = JSON.stringify([...Array.from({ length: storage.length }, (_, index) => storage.getItem(storage.key(index) ?? ''))])
    if (help.status === 'ok') expect(persisted).not.toContain(help.step.presentation.visibleText)
    expect(persisted).not.toContain('"transcript":')
    controller.close()
  }, 60_000)

  it('keeps trusted scoring pending and requires a live parent PIN session for valid adult assessment actions', async () => {
    const { controller } = makeController()
    setupTwo(controller)
    const autoBinding = catalog.listAssessments().find((item) => item.grade === 5 && item.authorityClass === 'AUTO_SCOREABLE')
    const manualBinding = catalog.listAssessments().find((item) => item.grade === 5 && item.authorityClass === 'RUBRIC_REQUIRED')
    const guardianBinding = catalog.listAssessments().find((item) => item.grade === 7 && item.authorityClass === 'GUARDIAN_REQUIRED')
    if (!autoBinding || !manualBinding || !guardianBinding) throw new Error('assessment authority fixtures unavailable')

    const auto = await controller.assignAssessment('student:a', autoBinding.assessmentRef)
    controller.updateAssessmentStatus('student:a', auto.assignmentRef, 'ACTIVE')
    controller.updateAssessmentStatus('student:a', auto.assignmentRef, 'PENDING_ASSESSMENT')
    expect(() => controller.updateAssessmentStatus('student:a', auto.assignmentRef, 'CERTIFIED')).toThrow(/trusted scoring authority/i)
    expect(controller.assessmentAssignments('student:a').find((item) => item.assignmentRef === auto.assignmentRef)?.status).toBe('PENDING_ASSESSMENT')

    const siblingLesson = await controller.assignLesson('student:b', (await firstLesson('science', 7)).lessonRef)
    expect((await controller.start('student:b', siblingLesson.assignmentRef)).status).toBe('ok')

    const manual = await controller.assignAssessment('student:a', manualBinding.assessmentRef)
    controller.updateAssessmentStatus('student:a', manual.assignmentRef, 'ACTIVE')
    controller.updateAssessmentStatus('student:a', manual.assignmentRef, 'ADULT_REVIEW_REQUIRED')
    controller.lockParentSession()
    expect(() => controller.completeAssessmentReview('student:a', manual.assignmentRef, 'manual-review')).toThrow(/parent pin/i)
    expect(controller.verifyParentPin('0000')).toBe(false)
    expect(controller.verifyParentPin('2468')).toBe(true)
    controller.completeAssessmentReview('student:a', manual.assignmentRef, 'manual-review')
    expect(controller.assessmentAssignments('student:a').find((item) => item.assignmentRef === manual.assignmentRef)?.status).toBe('CERTIFIED')

    const guardian = await controller.assignAssessment('student:b', guardianBinding.assessmentRef)
    controller.updateAssessmentStatus('student:b', guardian.assignmentRef, 'ACTIVE')
    controller.updateAssessmentStatus('student:b', guardian.assignmentRef, 'PENDING_GUARDIAN_ATTESTATION')
    expect(() => controller.completeAssessmentReview('student:b', guardian.assignmentRef, 'manual-review')).toThrow(/does not match/i)
    controller.completeAssessmentReview('student:b', guardian.assignmentRef, 'guardian-certification')
    expect(controller.assessmentAssignments('student:b')).toMatchObject([{ status: 'CERTIFIED' }])
    expect(controller.assessmentAssignments('student:a').some((item) => item.assignmentRef === guardian.assignmentRef)).toBe(false)
    controller.close()
  }, 60_000)

  it('backup validates, restores both students, and corrupt/future state fails closed', async () => {
    const { controller, storage, factory } = makeController()
    setupTwo(controller)
    const assignment = await controller.assignLesson('student:a', (await firstLesson('health', 5)).lessonRef)
    await controller.start('student:a', assignment.assignmentRef)
    const progressed = await controller.completeSegment('student:a', assignment.assignmentRef)
    if (progressed.status !== 'ok') throw new Error('fixture progress')
    await controller.checkpoint('student:a', assignment.assignmentRef)
    const exactSegment = progressed.study.segmentRef
    controller.close()
    const indexedDb = { factory: factory.factory, storageManager: factory.storageManager }
    const backup = await exportFinalFamilyPilotBackup({ coreStore: { storage }, appStore: { storage }, indexedDb, now: () => '2026-08-13T14:00:00.000Z' })
    expect((await validateFinalFamilyPilotBackup(backup)).status).toBe('valid')
    expect(backup.studyDocuments.find((item) => item.studentRef === 'student:a')?.record).not.toBeNull()
    storage.clear()
    const preview = await previewFinalFamilyPilotRestore(JSON.stringify(backup), { coreStore: { storage }, appStore: { storage }, indexedDb })
    expect(preview.status).toBe('ready')
    if (preview.status !== 'ready') throw new Error('backup preview fixture')
    expect(await restoreFinalFamilyPilotBackup(JSON.stringify(backup), {
      coreStore: { storage }, appStore: { storage }, indexedDb, preview, authority: { newParentPin: '8642' },
    })).toMatchObject({ status: 'restored', studentCount: 2 })
    expect(loadFinalFamilyPilotAppState({ storage }).state.setup.students).toHaveLength(2)
    const restoredController = makeController(storage, factory).controller
    const reopened = await restoredController.reopen('student:a', assignment.assignmentRef)
    expect(reopened.status).toBe('ok')
    if (reopened.status === 'ok') expect(reopened.study.segmentRef).toBe(exactSegment)
    restoredController.close()
    storage.setItem(FINAL_FAMILY_PILOT_APP_STATE_KEY, JSON.stringify({ schemaVersion: 99 }))
    expect(loadFinalFamilyPilotAppState({ storage }).status).toBe('read-only')
    const corrupt = { ...backup, appState: { ...backup.appState, safety: '{bad' } }
    expect(await validateFinalFamilyPilotBackup(corrupt)).toEqual({ status: 'invalid', reasonCode: 'integrity-mismatch' })
  })
})
