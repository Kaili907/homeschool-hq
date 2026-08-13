import { describe, expect, it } from 'vitest'
import type { HostLessonDescriptor } from '../../curriculumAdapter'
import { syntheticGrade5StudyContext } from '../../demonstrations'
import type { StudySafetyPort } from '../../ports'
import type { HostStudyLaunchContext } from '../../types'
import { createFakeIndexedDb, type FakeIndexedDb } from '../durable-indexeddb/testing/fakeIndexedDb'
import type { FamilyPilotStudySession } from '../study'
import {
  createFinalFamilyPilotStudyRuntime,
  type FinalFamilyPilotAssignmentBinding,
  type FinalFamilyPilotAttestationRecord,
  type FinalFamilyPilotGuardianAttestationPort,
  type FinalFamilyPilotSafetyHoldPort,
  type FinalFamilyPilotStudyRuntimeApi,
} from '.'

const HOUSEHOLD = 'household:final-pilot'
const START = Date.parse('2026-08-13T14:00:00.000Z')
const RAW_ANSWER = 'RAW-ANSWER-CANARY-DO-NOT-STORE'
const EXPECTED_ANSWER = 'EXPECTED-ANSWER-CANARY-DO-NOT-STORE'
const TRANSCRIPT = 'TUTOR-TRANSCRIPT-CANARY-DO-NOT-STORE'
const PRIVATE_REFLECTION = 'PRIVATE-REFLECTION-CANARY-DO-NOT-STORE'

function context(studentRef: string): HostStudyLaunchContext {
  return {
    ...syntheticGrade5StudyContext('math'),
    householdRef: HOUSEHOLD,
    learnerRef: `learner:${studentRef}`,
    hostProfileRef: `profile:${studentRef}`,
  }
}

function lesson(lessonRef = 'lesson:shared-math', kind: HostLessonDescriptor['kind'] = 'math'): HostLessonDescriptor {
  return { lessonRef, title: lessonRef, kind, skillRefs: [`skill:${lessonRef}`] }
}

function clearSafety(): StudySafetyPort {
  return {
    mode: 'production',
    classifierVersion: 'final-composition-fixture-v1',
    evaluate: async () => ({ outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }),
  }
}

class SafetyHolds implements FinalFamilyPilotSafetyHoldPort {
  readonly holds = new Map<string, { holdRef: string; reasonCode: string }>()

  key(studentRef: string, sessionRef: string): string {
    return `${studentRef}\u001f${sessionRef}`
  }

  hold(studentRef: string, sessionRef: string, holdRef = `hold:${studentRef}`): string {
    this.holds.set(this.key(studentRef, sessionRef), { holdRef, reasonCode: 'parent-review-requested' })
    return holdRef
  }

  checkStudyEntry(input: FinalFamilyPilotAssignmentBinding & { readonly sessionRef: string | null }) {
    const hold = input.sessionRef ? this.holds.get(this.key(input.studentRef, input.sessionRef)) : null
    return hold
      ? { allowed: false as const, reasonCode: hold.reasonCode, studentMessage: 'Please get an adult.', holdRef: hold.holdRef }
      : { allowed: true as const }
  }

  async clear(input: {
    readonly studentRef: string
    readonly sessionRef: string
    readonly holdRef: string
  }) {
    const key = this.key(input.studentRef, input.sessionRef)
    const hold = this.holds.get(key)
    if (!hold || hold.holdRef !== input.holdRef) return { status: 'not-found' as const }
    this.holds.delete(key)
    return { status: 'cleared' as const }
  }
}

class Attestations implements FinalFamilyPilotGuardianAttestationPort {
  readonly records = new Map<string, FinalFamilyPilotAttestationRecord>()

  key(input: FinalFamilyPilotAssignmentBinding & { readonly sessionRef: string }): string {
    return `${input.studentRef}\u001f${input.assignmentRef}\u001f${input.lessonRef}\u001f${input.sessionRef}`
  }

  read(input: FinalFamilyPilotAssignmentBinding & { readonly sessionRef: string }) {
    return this.records.get(this.key(input)) ?? null
  }

  async recordLearnerCompletion(input: FinalFamilyPilotAssignmentBinding & {
    readonly sessionRef: string
    readonly learnerAssertedAt: string
  }) {
    const key = this.key(input)
    const existing = this.records.get(key)
    if (existing) return existing
    const record: FinalFamilyPilotAttestationRecord = Object.freeze({
      studentRef: input.studentRef,
      assignmentRef: input.assignmentRef,
      lessonRef: input.lessonRef,
      sessionRef: input.sessionRef,
      authority: 'GUARDIAN_ATTESTATION_REQUIRED',
      status: 'PENDING_GUARDIAN_ATTESTATION',
      learnerAssertedAt: input.learnerAssertedAt,
      attestedAt: null,
      attestedByRef: null,
      evidenceMode: null,
    })
    this.records.set(key, record)
    return record
  }

  async attest(input: FinalFamilyPilotAssignmentBinding & {
    readonly sessionRef: string
    readonly attestedAt: string
    readonly attestedByRef: string
    readonly evidenceMode: 'adult-observed' | 'simulated-alternative'
  }) {
    const key = this.key(input)
    const pending = this.records.get(key)
    if (!pending) throw new Error('attestation-not-pending')
    const record: FinalFamilyPilotAttestationRecord = Object.freeze({
      ...pending,
      status: 'CERTIFIED',
      attestedAt: input.attestedAt,
      attestedByRef: input.attestedByRef,
      evidenceMode: input.evidenceMode,
    })
    this.records.set(key, record)
    return record
  }
}

interface DeviceFixture {
  readonly fake: FakeIndexedDb
  readonly safetyHolds: SafetyHolds
  readonly attestations: Attestations
  readonly lessons: Map<string, HostLessonDescriptor>
  readonly assignments: Map<string, string>
  readonly guardianLessons: Set<string>
  readonly blockedSources: Set<string>
  readonly clock: () => Date
  open(studentRef: string): Promise<FinalFamilyPilotStudyRuntimeApi>
}

function deviceFixture(): DeviceFixture {
  const fake = createFakeIndexedDb()
  const safetyHolds = new SafetyHolds()
  const attestations = new Attestations()
  const lessons = new Map<string, HostLessonDescriptor>()
  const assignments = new Map<string, string>()
  const guardianLessons = new Set<string>()
  const blockedSources = new Set<string>()
  let tick = 0
  const clock = () => new Date(START + (tick += 1_000))
  return {
    fake,
    safetyHolds,
    attestations,
    lessons,
    assignments,
    guardianLessons,
    blockedSources,
    clock,
    async open(studentRef) {
      return createFinalFamilyPilotStudyRuntime({
        context: { studentRef, study: context(studentRef) },
        assignmentState: {
          resolve: ({ assignmentRef }) => {
            const lessonRef = assignments.get(`${studentRef}\u001f${assignmentRef}`)
            return lessonRef ? { studentRef, assignmentRef, lessonRef } : null
          },
        },
        curriculumLessons: { resolveLesson: ({ lessonRef }) => lessons.get(lessonRef) ?? null },
        productionMaterials: {
          resolve: ({ lessonRef }) => ({
            status: 'ready',
            material: { materialRef: `material:${lessonRef}`, mediaAvailable: false },
          }),
        },
        sourceReadiness: {
          check: ({ lessonRef }) => blockedSources.has(lessonRef)
            ? { status: 'blocked', reasonCode: 'pending-source-attachment' }
            : { status: 'ready' },
        },
        completionAuthority: {
          authorityFor: ({ lessonRef }) => guardianLessons.has(lessonRef)
            ? 'GUARDIAN_ATTESTATION_REQUIRED'
            : 'LEARNER_AUTHORITY',
        },
        guardianAttestation: attestations,
        safetyHolds,
        now: clock,
        indexedDb: {
          safety: clearSafety(),
          factory: fake.factory,
          storageManager: fake.storageManager,
          now: clock,
          legacyStorage: { getItem: () => null },
        },
      })
    },
  }
}

function assign(device: DeviceFixture, studentRef: string, assignmentRef: string, descriptor: HostLessonDescriptor) {
  device.lessons.set(descriptor.lessonRef, descriptor)
  device.assignments.set(`${studentRef}\u001f${assignmentRef}`, descriptor.lessonRef)
}

function sessionOf(result: Awaited<ReturnType<FinalFamilyPilotStudyRuntimeApi['start']>>): FamilyPilotStudySession {
  if (result.status !== 'ok') throw new Error(result.reason)
  return result.study.session
}

async function finishSegments(
  runtime: FinalFamilyPilotStudyRuntimeApi,
  assignmentRef: string,
  session: FamilyPilotStudySession,
) {
  for (;;) {
    const current = await runtime.snapshot(assignmentRef, session)
    if (current.status !== 'ok') throw new Error(current.reason)
    if (current.study.assignmentState === 'completed') return current
    const action = await runtime.submitStudyAction({
      assignmentRef,
      session,
      transientLearnerText: 'fixture-ready',
      expectedAnswer: 'fixture-ready',
    })
    if (action.status !== 'ok') throw new Error(action.reason)
    const next = await runtime.completeSegment(assignmentRef, session)
    if (next.status !== 'ok') throw new Error(next.reason)
  }
}

describe('final Family Pilot Study composition fixtures', () => {
  it('isolates two siblings even when both are assigned the same lesson and assignment ref', async () => {
    const device = deviceFixture()
    const shared = lesson()
    assign(device, 'student:ada', 'assignment:shared', shared)
    assign(device, 'student:bea', 'assignment:shared', shared)
    const ada = await device.open('student:ada')
    const bea = await device.open('student:bea')
    const adaSession = sessionOf(await ada.start('assignment:shared'))
    const beaSession = sessionOf(await bea.start('assignment:shared'))

    expect(await ada.completeSegment('assignment:shared', adaSession)).toMatchObject({
      status: 'ok', study: { segmentOrdinal: 2 },
    })
    expect(await bea.snapshot('assignment:shared', beaSession)).toMatchObject({
      status: 'ok', study: { segmentOrdinal: 1, completedSegmentRefs: [] },
    })
    expect(adaSession.learnerRef).toBe('learner:student:ada')
    expect(beaSession.learnerRef).toBe('learner:student:bea')
    ada.close()
    bea.close()
  })

  it('cold-destroys and reopens at the exact IndexedDB checkpoint, then preserves completion', async () => {
    const device = deviceFixture()
    assign(device, 'student:ada', 'assignment:reload', lesson('lesson:reload'))
    let runtime = await device.open('student:ada')
    expect(runtime.migration).toMatchObject({ status: 'not-needed', legacyRetained: true })
    const session = sessionOf(await runtime.start('assignment:reload'))
    await runtime.completeSegment('assignment:reload', session)
    const saved = await runtime.checkpoint('assignment:reload', session, 'draft:opaque-1')
    if (saved.status !== 'ok') throw new Error(saved.reason)
    runtime.close()

    runtime = await device.open('student:ada')
    const reopened = await runtime.reopen('assignment:reload', JSON.parse(JSON.stringify(session)))
    expect(reopened).toMatchObject({
      status: 'ok',
      study: {
        segmentRef: saved.study.segmentRef,
        segmentOrdinal: saved.study.segmentOrdinal,
        checkpointRef: saved.study.checkpointRef,
        checkpointRevision: 1,
        completedSegmentRefs: saved.study.completedSegmentRefs,
      },
    })
    await finishSegments(runtime, 'assignment:reload', session)
    const completed = await runtime.complete('assignment:reload', session)
    if (completed.status !== 'ok') throw new Error(JSON.stringify(completed))
    expect(completed).toMatchObject({
      status: 'ok', completionStatus: 'CERTIFIED', study: { sessionStatus: 'completed' },
    })
    runtime.close()

    runtime = await device.open('student:ada')
    expect(await runtime.reopen('assignment:reload', session)).toMatchObject({
      status: 'ok', completionStatus: 'CERTIFIED', study: { assignmentState: 'completed', sessionStatus: 'completed' },
    })
    expect(await runtime.start('assignment:reload')).toMatchObject({
      status: 'rejected', reason: 'runtime-rejected', detailCode: 'assignment-already-complete',
    })
    runtime.close()
  })

  it('applies a safety hold only to its exact student/session and parent clear resumes that session', async () => {
    const device = deviceFixture()
    const shared = lesson('lesson:safety')
    assign(device, 'student:ada', 'assignment:safety', shared)
    assign(device, 'student:bea', 'assignment:safety', shared)
    const ada = await device.open('student:ada')
    const bea = await device.open('student:bea')
    const adaSession = sessionOf(await ada.start('assignment:safety'))
    const beaSession = sessionOf(await bea.start('assignment:safety'))
    const paused = await ada.pause('assignment:safety', adaSession)
    if (paused.status !== 'ok') throw new Error(paused.reason)
    const holdRef = device.safetyHolds.hold('student:ada', adaSession.sessionRef)

    expect(await ada.reopen('assignment:safety', adaSession)).toMatchObject({
      status: 'rejected', reason: 'safety-hold', detailCode: 'parent-review-requested',
    })
    expect(await bea.reopen('assignment:safety', beaSession)).toMatchObject({ status: 'ok' })
    expect(await ada.clearSafetyHold({
      assignmentRef: 'assignment:safety',
      session: adaSession,
      holdRef,
      adultAuthorized: true,
      adultHouseholdRef: HOUSEHOLD,
      clearedByRef: 'adult:guardian-1',
    })).toEqual({ status: 'cleared' })
    expect(await ada.resume('assignment:safety', adaSession)).toMatchObject({
      status: 'ok', study: { assignmentState: 'active', segmentRef: paused.study.segmentRef },
    })
    ada.close()
    bea.close()
  })

  it('keeps RFL completion pending until an authorized adult attests while learner-authority work completes normally', async () => {
    const device = deviceFixture()
    const rfl = lesson('lesson:rfl-guardian', 'parent-created')
    const math = lesson('lesson:learner-math')
    device.guardianLessons.add(rfl.lessonRef)
    assign(device, 'student:ada', 'assignment:rfl', rfl)
    assign(device, 'student:bea', 'assignment:math', math)
    let ada = await device.open('student:ada')
    const bea = await device.open('student:bea')
    const rflSession = sessionOf(await ada.start('assignment:rfl'))
    const mathSession = sessionOf(await bea.start('assignment:math'))
    await finishSegments(ada, 'assignment:rfl', rflSession)
    await finishSegments(bea, 'assignment:math', mathSession)

    expect(await ada.complete('assignment:rfl', rflSession)).toMatchObject({
      status: 'ok', completionStatus: 'PENDING_GUARDIAN_ATTESTATION', study: { sessionStatus: 'active' },
    })
    const learnerCompleted = await bea.complete('assignment:math', mathSession)
    if (learnerCompleted.status !== 'ok') throw new Error(JSON.stringify(learnerCompleted))
    expect(learnerCompleted).toMatchObject({
      status: 'ok', completionStatus: 'CERTIFIED', study: { sessionStatus: 'completed' },
    })
    ada.close()
    ada = await device.open('student:ada')
    expect(await ada.reopen('assignment:rfl', rflSession)).toMatchObject({
      status: 'ok', completionStatus: 'PENDING_GUARDIAN_ATTESTATION',
    })
    expect(await ada.attest({
      assignmentRef: 'assignment:rfl',
      session: rflSession,
      adultAuthorized: false,
      adultHouseholdRef: HOUSEHOLD,
      attestedByRef: 'adult:guardian-1',
      evidenceMode: 'simulated-alternative',
    })).toMatchObject({ status: 'rejected', reason: 'adult-not-authorized' })
    expect(await ada.attest({
      assignmentRef: 'assignment:rfl',
      session: rflSession,
      adultAuthorized: true,
      adultHouseholdRef: HOUSEHOLD,
      attestedByRef: 'adult:guardian-1',
      evidenceMode: 'simulated-alternative',
    })).toMatchObject({
      status: 'ok', completion: { status: 'CERTIFIED', attestedByRef: 'adult:guardian-1' }, study: { sessionStatus: 'completed' },
    })
    ada.close()
    bea.close()
  })

  it('blocks only the dynamic Social lesson whose source is pending', async () => {
    const device = deviceFixture()
    const pending = lesson('lesson:social-pending', 'review')
    const ready = lesson('lesson:social-ready', 'review')
    assign(device, 'student:ada', 'assignment:social-pending', pending)
    assign(device, 'student:ada', 'assignment:social-ready', ready)
    device.blockedSources.add(pending.lessonRef)
    const runtime = await device.open('student:ada')

    expect(await runtime.start('assignment:social-pending')).toMatchObject({
      status: 'rejected', reason: 'source-not-ready', detailCode: 'pending-source-attachment',
    })
    expect(await runtime.start('assignment:social-ready')).toMatchObject({ status: 'ok' })
    runtime.close()
  })

  it('surfaces storage refusal and never stores raw answers, Tutor transcripts, or private reflections', async () => {
    const device = deviceFixture()
    assign(device, 'student:ada', 'assignment:privacy', lesson('lesson:privacy'))
    const runtime = await device.open('student:ada')
    const session = sessionOf(await runtime.start('assignment:privacy'))

    expect(await runtime.submitStudyAction({
      assignmentRef: 'assignment:privacy',
      session,
      transientLearnerText: `${RAW_ANSWER} ${PRIVATE_REFLECTION}`,
      expectedAnswer: EXPECTED_ANSWER,
    })).toMatchObject({ status: 'ok' })
    const tutor = await runtime.startTutor('assignment:privacy', session)
    if (tutor.status !== 'ok') throw new Error(tutor.reason)
    const turn = await runtime.submitTutorTurn(tutor.step.session, TRANSCRIPT)
    const closed = runtime.closeTutor(turn.session)
    expect(closed.summary.rawConversationIncluded).toBe(false)
    expect(closed.session.transcript).toEqual([])

    const stored = JSON.stringify([...device.fake.records().values()])
    expect(stored).not.toContain(RAW_ANSWER)
    expect(stored).not.toContain(EXPECTED_ANSWER)
    expect(stored).not.toContain(TRANSCRIPT)
    expect(stored).not.toContain(PRIVATE_REFLECTION)

    device.fake.failNextWrites(1)
    expect(await runtime.completeSegment('assignment:privacy', session)).toMatchObject({
      status: 'rejected', reason: 'storage-unavailable',
    })
    expect(await runtime.storageHealth()).toMatchObject({
      backend: 'indexeddb', ready: false, previousWriteFailed: true,
    })
    runtime.close()
  })
})
