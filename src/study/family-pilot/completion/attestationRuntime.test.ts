import { describe, expect, it } from 'vitest'
import { createLocalDevelopmentStudyPorts } from '../../localDevelopmentPorts'
import type { StudyAdultAuthorization } from '../../types'
import { FAMILY_PILOT_STATE_KEY, loadFamilyPilotState } from '../core'
import { FamilyPilotController } from '../integration/controller'
import { hostLessonCurriculumPort } from '../integration/curriculum'
import { FAMILY_PILOT_HOUSEHOLD_REF } from '../integration/identity'
import type { CurriculumCompletionAuthority } from './policy'

// FAMILY-PILOT-COMPLETION: the completion policy on the REAL runtime path.
//
// These tests drive the same controller the Family Pilot UI drives, over the
// real Study runtime and the real Core store. The only injected things are the
// clock, the storage and the student ref generator — so a pass here means the
// shipped completion path enforces the policy, not that a set of mocks agree.
//
// The lesson that requires an adult is marked through the curriculum port's own
// `completionAuthorityFor` hook, which is exactly how a student-work package's
// authored `completionAuthority: 'guardian'` reaches the runtime.

const ADULT: StudyAdultAuthorization = {
  householdRef: FAMILY_PILOT_HOUSEHOLD_REF,
  actorRef: 'family-pilot-parent',
  role: 'parent',
  adultAuthorized: true,
}

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
    clear: () => { map.clear() },
  } as Storage
}

/** Lesson day-1 is the adult-observed one; day-2 completes on the learner's say-so. */
const GUARDIAN_LESSON = 'grade-5:math:day-1'
const LEARNER_LESSON = 'grade-5:math:day-2'

function curriculum() {
  const base = hostLessonCurriculumPort(2)
  return {
    listLessons: base.listLessons,
    completionAuthorityFor: (lesson: { lessonRef: string }): CurriculumCompletionAuthority =>
      lesson.lessonRef === GUARDIAN_LESSON ? 'guardian' : 'learner',
  }
}

function harness() {
  const storage = memoryStorage()
  const now = () => new Date('2026-03-04T15:00:00.000Z')
  const ports = createLocalDevelopmentStudyPorts({ now }).ports
  let counter = 0
  const build = () => new FamilyPilotController({
    ports,
    curriculum: curriculum(),
    store: { storage, now: () => now().toISOString() },
    now,
    householdTimeZone: 'UTC',
    defaultGrade: '5',
    newStudentRef: () => `student:fixed-${(counter += 1)}`,
  })
  const state = { storage, ports, controller: build(), rebuild: () => (state.controller = build()) }
  return state
}

/** Signs a learner in, seeds their work, and drives one lesson to finished. */
async function workThrough(
  controller: FamilyPilotController,
  ref: string,
  lessonRef: string,
): Promise<string> {
  controller.ensureAssignments(ref)
  const assignment = controller
    .assignmentsFor(ref)
    .map((item) => item.assignmentRef)
    .find((item) => item.includes(lessonRef.replace(/:/g, ':')))
  if (!assignment) throw new Error(`no assignment for ${lessonRef}`)
  const started = await controller.start(ref, assignment)
  if (started.status !== 'ok' || !started.study) throw new Error('expected a Study snapshot')
  for (let index = 0; index < started.study.remainingSegmentRefs.length; index += 1) {
    const done = await controller.completeSegment(ref, assignment)
    expect(done.status).toBe('ok')
  }
  return assignment
}

describe('adult attestation on the runtime completion path', () => {
  it('records the learner’s finish without certifying adult-observed work', async () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const ref = pilot.controller.snapshot().state.students[0].studentRef
    pilot.controller.selectStudent(ref)
    const assignment = await workThrough(pilot.controller, ref, GUARDIAN_LESSON)

    // The exact call the learner's "Finish" button makes.
    const finished = await pilot.controller.complete(ref, assignment)
    expect(finished.status).toBe('ok')
    if (finished.status !== 'ok') throw new Error('expected ok')
    expect(finished.completion?.status).toBe('PENDING_GUARDIAN_ATTESTATION')

    const record = finished.snapshot.state.students[0].assignments
      .find((item) => item.assignmentRef === assignment)
    expect(record?.state).not.toBe('completed')
    expect(record?.completedAt).toBeNull()

    // Pressing Finish again does not certify it either.
    const again = await pilot.controller.complete(ref, assignment)
    expect(again.status).toBe('ok')
    if (again.status !== 'ok') throw new Error('expected ok')
    expect(again.completion?.status).toBe('PENDING_GUARDIAN_ATTESTATION')
    expect(pilot.controller.parentProgress(ref)?.completedCount).toBe(0)
    expect(pilot.controller.parentProgress(ref)?.pendingAttestationCount).toBe(1)
    // The learner surface shows the wait rather than a completion.
    const view = pilot.controller.assignmentsFor(ref).find((i) => i.assignmentRef === assignment)
    expect(view?.awaitingAdultAttestation).toBe(true)
    expect(view?.status).not.toBe('COMPLETED')
  })

  it('still completes learner-authority work on the learner’s own click', async () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const ref = pilot.controller.snapshot().state.students[0].studentRef
    pilot.controller.selectStudent(ref)
    const assignment = await workThrough(pilot.controller, ref, LEARNER_LESSON)

    const finished = await pilot.controller.complete(ref, assignment)
    expect(finished.status).toBe('ok')
    if (finished.status !== 'ok') throw new Error('expected ok')
    expect(finished.completion?.status).toBe('CERTIFIED')
    expect(finished.completion?.authority).toBe('LEARNER_AUTHORITY')
    expect(pilot.controller.pendingAttestations(ref)).toHaveLength(0)
    expect(pilot.controller.parentProgress(ref)?.completedCount).toBe(1)
  })

  it('keeps the pending state across a reload, and certifies without live Study ports', async () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const ref = pilot.controller.snapshot().state.students[0].studentRef
    pilot.controller.selectStudent(ref)
    const assignment = await workThrough(pilot.controller, ref, GUARDIAN_LESSON)
    await pilot.controller.complete(ref, assignment)

    // Throw the controller and the runtime away, as closing the browser does.
    const reloaded = loadFamilyPilotState({ storage: pilot.storage })
    expect(reloaded.state.students[0].assignments
      .find((item) => item.assignmentRef === assignment)?.completion.status)
      .toBe('PENDING_GUARDIAN_ATTESTATION')

    const next = pilot.rebuild()
    const pending = next.pendingAttestations(ref)
    expect(pending).toHaveLength(1)
    expect(pending[0].assignmentRef).toBe(assignment)
    expect(pending[0].lessonRef).toBe(GUARDIAN_LESSON)

    // The adult signs off the next morning. No Study session is reopened.
    const certified = next.attest({
      studentRef: ref,
      assignmentRef: assignment,
      lessonRef: pending[0].lessonRef,
      attestedByRef: ADULT.actorRef,
      evidenceMode: 'adult-observed',
    }, ADULT)
    expect(certified.status).toBe('ok')
    if (certified.status !== 'ok') throw new Error('expected ok')
    expect(certified.alreadyAttested).toBe(false)
    expect(certified.completion.status).toBe('CERTIFIED')
    expect(next.assignmentsFor(ref).find((i) => i.assignmentRef === assignment)?.status)
      .toBe('COMPLETED')
    expect(next.parentProgress(ref)?.completedCount).toBe(1)
    expect(next.parentProgress(ref)?.pendingAttestationCount).toBe(0)

    // And it is durable in its own right.
    const persisted = loadFamilyPilotState({ storage: pilot.storage })
    const stored = persisted.state.students[0].assignments
      .find((item) => item.assignmentRef === assignment)
    expect(stored?.state).toBe('completed')
    expect(stored?.completion.attestedByRef).toBe(ADULT.actorRef)
    expect(stored?.completion.attestedLessonRef).toBe(GUARDIAN_LESSON)
  })

  it('is idempotent when the adult signs the same work off twice', async () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const ref = pilot.controller.snapshot().state.students[0].studentRef
    const assignment = await workThrough(pilot.controller, ref, GUARDIAN_LESSON)
    await pilot.controller.complete(ref, assignment)
    const request = {
      studentRef: ref,
      assignmentRef: assignment,
      lessonRef: GUARDIAN_LESSON,
      attestedByRef: ADULT.actorRef,
      evidenceMode: 'adult-observed' as const,
    }
    const first = pilot.controller.attest(request, ADULT)
    const second = pilot.controller.attest(request, ADULT)
    expect(first.status).toBe('ok')
    expect(second.status).toBe('ok')
    if (first.status !== 'ok' || second.status !== 'ok') throw new Error('expected ok')
    expect(second.alreadyAttested).toBe(true)
    expect(second.completion.attestedAt).toBe(first.completion.attestedAt)
    expect(pilot.controller.parentProgress(ref)?.completedCount).toBe(1)
  })

  it('refuses an unauthorized adult, a stale lesson, and work that is not pending', async () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const ref = pilot.controller.snapshot().state.students[0].studentRef
    const guardianWork = await workThrough(pilot.controller, ref, GUARDIAN_LESSON)
    const learnerWork = await workThrough(pilot.controller, ref, LEARNER_LESSON)
    const request = {
      studentRef: ref,
      assignmentRef: guardianWork,
      lessonRef: GUARDIAN_LESSON,
      attestedByRef: ADULT.actorRef,
      evidenceMode: 'adult-observed' as const,
    }

    // Not yet finished by the learner: there is nothing to certify.
    expect(pilot.controller.attest(request, ADULT)).toMatchObject({
      status: 'rejected', reason: 'attestation-not-recorded',
    })
    await pilot.controller.complete(ref, guardianWork)

    expect(pilot.controller.attest(request, { ...ADULT, adultAuthorized: false }))
      .toMatchObject({ status: 'rejected', reason: 'adult-not-authorized' })
    expect(pilot.controller.attest(request, { ...ADULT, householdRef: 'other-household' }))
      .toMatchObject({ status: 'rejected', reason: 'adult-not-authorized' })
    expect(pilot.controller.attest({ ...request, lessonRef: LEARNER_LESSON }, ADULT))
      .toMatchObject({ status: 'rejected', reason: 'lesson-binding-mismatch' })
    expect(pilot.controller.attest({ ...request, assignmentRef: 'assignment:nope' }, ADULT))
      .toMatchObject({ status: 'rejected', reason: 'unknown-assignment' })
    expect(pilot.controller.attest({ ...request, studentRef: 'student:nobody' }, ADULT))
      .toMatchObject({ status: 'rejected', reason: 'unknown-student' })

    // Learner-authority work is not attestable; it needed no adult.
    await pilot.controller.complete(ref, learnerWork)
    expect(pilot.controller.attest({
      ...request, assignmentRef: learnerWork, lessonRef: LEARNER_LESSON,
    }, ADULT)).toMatchObject({ status: 'rejected', reason: 'attestation-not-required' })

    // Every refusal above left the work exactly as it was.
    expect(pilot.controller.pendingAttestations(ref).map((i) => i.assignmentRef))
      .toEqual([guardianWork])
  })

  it('does not let one child’s sign-off satisfy the other’s identical lesson', async () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    pilot.controller.createStudent('Bo')
    const [ada, bo] = pilot.controller.snapshot().state.students.map((s) => s.studentRef)
    const adaWork = await workThrough(pilot.controller, ada, GUARDIAN_LESSON)
    const boWork = await workThrough(pilot.controller, bo, GUARDIAN_LESSON)
    // Assignment refs are lesson-derived, so the two children share one.
    expect(adaWork).toBe(boWork)
    await pilot.controller.complete(ada, adaWork)
    await pilot.controller.complete(bo, boWork)

    pilot.controller.attest({
      studentRef: ada,
      assignmentRef: adaWork,
      lessonRef: GUARDIAN_LESSON,
      attestedByRef: ADULT.actorRef,
      evidenceMode: 'adult-observed',
    }, ADULT)

    expect(pilot.controller.parentProgress(ada)?.completedCount).toBe(1)
    expect(pilot.controller.parentProgress(ada)?.pendingAttestationCount).toBe(0)
    // Bo's identical work is untouched and still waiting on his own sign-off.
    expect(pilot.controller.parentProgress(bo)?.completedCount).toBe(0)
    expect(pilot.controller.pendingAttestations(bo).map((i) => i.assignmentRef)).toEqual([boWork])

    const persisted = JSON.parse(pilot.storage.getItem(FAMILY_PILOT_STATE_KEY) ?? '{}')
    const boRecord = persisted.students
      .find((s: { studentRef: string }) => s.studentRef === bo)
      .assignments.find((a: { assignmentRef: string }) => a.assignmentRef === boWork)
    expect(boRecord.completion.status).toBe('PENDING_GUARDIAN_ATTESTATION')
    expect(boRecord.completion.attestedByRef).toBeNull()
  })

  it('does not report a sign-off the device refused to store', async () => {
    // Safari private browsing, or a full quota: reads work, writes throw.
    // updateFamilyPilotState still hands back the MUTATED in-memory state, so a
    // controller that trusted the returned record would tell an adult the work
    // now counts while it stayed pending on disk — and stayed pending tomorrow.
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const ref = pilot.controller.snapshot().state.students[0].studentRef
    const assignment = await workThrough(pilot.controller, ref, GUARDIAN_LESSON)
    await pilot.controller.complete(ref, assignment)
    const before = pilot.storage.getItem(FAMILY_PILOT_STATE_KEY)

    const denied = Object.create(pilot.storage) as Storage
    denied.setItem = () => { throw new Error('QuotaExceededError') }
    const blocked = new FamilyPilotController({
      ports: pilot.ports,
      curriculum: curriculum(),
      store: { storage: denied, now: () => '2026-03-04T15:00:00.000Z' },
      now: () => new Date('2026-03-04T15:00:00.000Z'),
      householdTimeZone: 'UTC',
      defaultGrade: '5',
    })
    const result = blocked.attest({
      studentRef: ref,
      assignmentRef: assignment,
      lessonRef: GUARDIAN_LESSON,
      attestedByRef: ADULT.actorRef,
      evidenceMode: 'adult-observed',
    }, ADULT)
    expect(result).toMatchObject({ status: 'rejected', reason: 'attestation-not-saved' })
    // Nothing reached the device, and the work is still waiting.
    expect(pilot.storage.getItem(FAMILY_PILOT_STATE_KEY)).toBe(before)
    expect(pilot.rebuild().pendingAttestations(ref)).toHaveLength(1)
  })

  it('tells an adult the truth when the device holds state this build cannot write', async () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const ref = pilot.controller.snapshot().state.students[0].studentRef
    const assignment = await workThrough(pilot.controller, ref, GUARDIAN_LESSON)
    await pilot.controller.complete(ref, assignment)

    // A newer build's state. The store reports read-only and refuses writes.
    const ahead = memoryStorage()
    ahead.setItem(FAMILY_PILOT_STATE_KEY, JSON.stringify({
      ...JSON.parse(pilot.storage.getItem(FAMILY_PILOT_STATE_KEY) ?? '{}'),
      schemaVersion: 99,
    }))
    const stale = new FamilyPilotController({
      ports: pilot.ports,
      curriculum: curriculum(),
      store: { storage: ahead, now: () => '2026-03-04T15:00:00.000Z' },
      now: () => new Date('2026-03-04T15:00:00.000Z'),
      householdTimeZone: 'UTC',
      defaultGrade: '5',
    })
    const result = stale.attest({
      studentRef: ref,
      assignmentRef: assignment,
      lessonRef: GUARDIAN_LESSON,
      attestedByRef: ADULT.actorRef,
      evidenceMode: 'adult-observed',
    }, ADULT)
    // Not 'unknown-student' — the learner exists; this build just may not write.
    expect(result).toMatchObject({ status: 'rejected', reason: 'store-read-only' })
    if (result.status !== 'rejected') throw new Error('expected a refusal')
    expect(result.message).not.toContain('not set up on this device')
  })

  it('gives the simulated alternative the same credit as the observed action', async () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const ref = pilot.controller.snapshot().state.students[0].studentRef
    const assignment = await workThrough(pilot.controller, ref, GUARDIAN_LESSON)
    await pilot.controller.complete(ref, assignment)

    const result = pilot.controller.attest({
      studentRef: ref,
      assignmentRef: assignment,
      lessonRef: GUARDIAN_LESSON,
      attestedByRef: ADULT.actorRef,
      evidenceMode: 'simulated-alternative',
    }, ADULT)
    expect(result.status).toBe('ok')
    const item = pilot.controller.parentProgress(ref)?.assignments
      .find((entry) => entry.assignmentRef === assignment)
    expect(item?.completionStatus).toBe('CERTIFIED')
    expect(item?.evidenceMode).toBe('simulated-alternative')
    // Equal credit: the same completed count and the same 100% as an observed
    // sign-off would have produced.
    expect(item?.percentComplete).toBe(100)
    expect(pilot.controller.parentProgress(ref)?.completedCount).toBe(1)
    expect(pilot.controller.assignmentsFor(ref)
      .find((i) => i.assignmentRef === assignment)?.status).toBe('COMPLETED')
  })

  it('persists no reflection, answer, media or narrative alongside a sign-off', async () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const ref = pilot.controller.snapshot().state.students[0].studentRef
    const assignment = await workThrough(pilot.controller, ref, GUARDIAN_LESSON)
    await pilot.controller.complete(ref, assignment)
    pilot.controller.attest({
      studentRef: ref,
      assignmentRef: assignment,
      lessonRef: GUARDIAN_LESSON,
      attestedByRef: ADULT.actorRef,
      evidenceMode: 'adult-observed',
    }, ADULT)

    const document = pilot.storage.getItem(FAMILY_PILOT_STATE_KEY) ?? ''
    const record = JSON.parse(document).students[0].assignments
      .find((a: { assignmentRef: string }) => a.assignmentRef === assignment)
    expect(record.rawAnswerIncluded).toBe(false)
    expect(record.transcriptIncluded).toBe(false)
    expect(Object.keys(record.completion).sort()).toEqual([
      'attestedAssignmentRef', 'attestedAt', 'attestedByRef', 'attestedLessonRef',
      'attestedStudentRef', 'authority', 'evidenceMode', 'learnerAssertedAt', 'status',
    ])
    expect(document.replace(/"(rawAnswerIncluded|transcriptIncluded)":false/g, ''))
      .not.toMatch(/note|reflection|answer|transcript|audio|video|photo|narrative/i)
  })
})
