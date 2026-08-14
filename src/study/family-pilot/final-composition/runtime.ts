import { StudyLifecycleBoundary } from '../../lifecycle'
import type { StudyPortBundle, StudySafetyPort } from '../../ports'
import type { HostLessonDescriptor } from '../../curriculumAdapter'
import {
  createFamilyPilotIndexedDbStudyPorts,
  type FamilyPilotIndexedDbStudyPorts,
  type FamilyPilotIndexedDbStudyPortsOptions,
} from '../durable-indexeddb'
import {
  FamilyPilotStudyRuntime,
  type FamilyPilotStudyActionResult,
  type FamilyPilotStudyResult,
  type FamilyPilotStudySession,
} from '../study'
import { closeStaticHelp, continueStaticHelp, startStaticHelp } from '../tutor/staticSession'
import type {
  FinalFamilyPilotAssignmentBinding,
  FinalFamilyPilotAssignmentStatePort,
  FinalFamilyPilotAttestationResult,
  FinalFamilyPilotCompletionAuthority,
  FinalFamilyPilotCompletionAuthorityPort,
  FinalFamilyPilotCompletionStatus,
  FinalFamilyPilotContext,
  FinalFamilyPilotCurriculumLessonResolver,
  FinalFamilyPilotGuardianAttestationPort,
  FinalFamilyPilotPreparedBinding,
  FinalFamilyPilotProductionMaterialResolver,
  FinalFamilyPilotRejected,
  FinalFamilyPilotResult,
  FinalFamilyPilotSafetyHoldPort,
  FinalFamilyPilotSourceReadinessResolver,
  FinalFamilyPilotStorageHealth,
  FinalFamilyPilotStoragePort,
  FinalFamilyPilotStudyRuntimeApi,
  FinalFamilyPilotTutorResult,
} from './types'

export const FINAL_FAMILY_PILOT_STUDY_RUNTIME_LABEL =
  'FAMILY PILOT — FINAL STUDY COMPOSITION' as const

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/

export interface CreateFinalFamilyPilotStudyRuntimeOptions {
  readonly context: FinalFamilyPilotContext
  readonly assignmentState: FinalFamilyPilotAssignmentStatePort
  readonly curriculumLessons: FinalFamilyPilotCurriculumLessonResolver
  readonly productionMaterials: FinalFamilyPilotProductionMaterialResolver
  readonly sourceReadiness: FinalFamilyPilotSourceReadinessResolver
  readonly completionAuthority: FinalFamilyPilotCompletionAuthorityPort
  readonly guardianAttestation?: FinalFamilyPilotGuardianAttestationPort
  readonly safetyHolds?: FinalFamilyPilotSafetyHoldPort
  readonly now?: () => Date
  readonly lifecycle?: StudyLifecycleBoundary
  readonly safetyStopStorage?: Pick<Storage, 'getItem' | 'setItem'>
  /** Use when final convergence already owns an accepted, student-scoped bundle. */
  readonly storage?: FinalFamilyPilotStoragePort
  /** Or let this factory open the accepted IndexedDB bundle, including legacy migration. */
  readonly indexedDb?: Omit<FamilyPilotIndexedDbStudyPortsOptions, 'scope'>
}

interface OpenStorage {
  readonly ports: StudyPortBundle
  readonly migration: unknown
  health(): Promise<FinalFamilyPilotStorageHealth>
  close(): void
}

function rejected(
  reason: FinalFamilyPilotRejected['reason'],
  message: string,
  detailCode?: string,
): FinalFamilyPilotRejected {
  return Object.freeze({ status: 'rejected', reason, message, ...(detailCode ? { detailCode } : {}) })
}

function mapIndexedDbHealth(handle: FamilyPilotIndexedDbStudyPorts): FinalFamilyPilotStorageHealth {
  const record = handle.services.health(handle.storage.scope)
  const device = handle.storage.status()
  const ready = record.durable && !record.previousWriteFailed && device.durable
  return Object.freeze({
    backend: 'indexeddb' as const,
    ready,
    reasonCode: device.failureKind ?? record.reasonCode,
    previousWriteFailed: record.previousWriteFailed,
    pendingWrites: device.pendingWrites,
    migrationStatus: handle.migration.status,
  })
}

async function openStorage(options: CreateFinalFamilyPilotStudyRuntimeOptions): Promise<OpenStorage> {
  if (Boolean(options.storage) === Boolean(options.indexedDb)) {
    throw new Error('Provide exactly one final Study storage source: storage or indexedDb.')
  }
  if (options.storage) {
    const injected = options.storage
    return Object.freeze({
      ports: injected.ports,
      migration: injected.migration ?? null,
      health: async () => injected.health(),
      close: () => injected.close?.(),
    })
  }
  const indexedDb = options.indexedDb as Omit<FamilyPilotIndexedDbStudyPortsOptions, 'scope'>
  const handle = await createFamilyPilotIndexedDbStudyPorts({
    ...indexedDb,
    // One monotonic clock must govern both Study transitions and their durable
    // document. A clock injected on only one side can otherwise create a valid
    // event that the calendar correctly rejects as out of order.
    ...(!indexedDb.now && options.now ? { now: options.now } : {}),
    scope: {
      householdRef: options.context.study.householdRef,
      learnerRef: options.context.study.learnerRef,
    },
  })
  return Object.freeze({
    ports: handle.ports,
    migration: handle.migration,
    health: async () => mapIndexedDbHealth(handle),
    close: () => handle.close(),
  })
}

function validContext(context: FinalFamilyPilotContext): boolean {
  return Boolean(context.studentRef) &&
    Boolean(context.study.learnerRef) &&
    Boolean(context.study.householdRef) &&
    SAFE_REF.test(context.studentRef) &&
    SAFE_REF.test(context.study.learnerRef) &&
    SAFE_REF.test(context.study.householdRef)
}

function underlyingFailure(result: Exclude<FamilyPilotStudyResult, { readonly status: 'ok' }>): FinalFamilyPilotRejected {
  return rejected('runtime-rejected', result.message, result.reason)
}

/**
 * Final Family Pilot composition for exactly one student.
 *
 * It is intentionally an async factory because the accepted IndexedDB seam
 * hydrates before the Study runtime may be exposed. This object owns no lesson
 * state machine and defines no alternative StudyPortBundle: all transitions
 * below delegate to FamilyPilotStudyRuntime and the exact nine accepted ports.
 */
export async function createFinalFamilyPilotStudyRuntime(
  options: CreateFinalFamilyPilotStudyRuntimeOptions,
): Promise<FinalFamilyPilotStudyRuntimeApi> {
  if (!validContext(options.context)) throw new Error('Final Study identity requires valid student, learner, and household references.')
  const storage = await openStorage(options)
  const now = options.now ?? (() => new Date())
  const study = new FamilyPilotStudyRuntime({
    ports: storage.ports,
    now,
    lifecycle: options.lifecycle ?? new StudyLifecycleBoundary(),
    ...(options.safetyStopStorage ? { safetyStopStorage: options.safetyStopStorage } : {}),
  })
  let closed = false

  const ensureOpen = (): FinalFamilyPilotRejected | null =>
    closed ? rejected('storage-unavailable', 'This student Study runtime has been closed.') : null

  async function ensureStorage(): Promise<FinalFamilyPilotRejected | null> {
    const unavailable = ensureOpen()
    if (unavailable) return unavailable
    try {
      const health = await storage.health()
      return health.ready
        ? null
        : rejected('storage-unavailable', 'Study work is not being saved on this device.', health.reasonCode ?? undefined)
    } catch {
      return rejected('storage-unavailable', 'Study storage health could not be confirmed.')
    }
  }

  async function runtimeFailure(
    result: Exclude<FamilyPilotStudyResult, { readonly status: 'ok' }>,
  ): Promise<FinalFamilyPilotRejected> {
    if (result.reason === 'study-unavailable') {
      try {
        const health = await storage.health()
        if (!health.ready) {
          return rejected(
            'storage-unavailable',
            'Study storage refused that operation. Nothing was recorded.',
            health.reasonCode ?? result.reason,
          )
        }
      } catch {
        return rejected('storage-unavailable', 'Study storage refused that operation. Nothing was recorded.')
      }
    }
    return underlyingFailure(result)
  }

  async function bind(assignmentRef: string): Promise<FinalFamilyPilotPreparedBinding | FinalFamilyPilotRejected> {
    const storageFailure = await ensureStorage()
    if (storageFailure) return storageFailure
    let binding: FinalFamilyPilotAssignmentBinding | null
    try {
      binding = await options.assignmentState.resolve({ studentRef: options.context.studentRef, assignmentRef })
    } catch {
      binding = null
    }
    if (!binding) return rejected('assignment-not-found', 'That assignment is not available for this student.')
    if (binding.studentRef !== options.context.studentRef || binding.assignmentRef !== assignmentRef) {
      return rejected('assignment-binding-mismatch', 'That assignment belongs to a different student.')
    }
    let lesson: HostLessonDescriptor | null
    try {
      lesson = await options.curriculumLessons.resolveLesson(binding)
    } catch {
      lesson = null
    }
    if (!lesson) return rejected('lesson-not-found', 'That curriculum lesson is not available.')
    if (lesson.lessonRef !== binding.lessonRef) {
      return rejected('lesson-binding-mismatch', 'The curriculum lesson no longer matches this assignment.')
    }
    let source
    try {
      source = await options.sourceReadiness.check({ ...binding, lesson })
    } catch {
      source = { status: 'blocked' as const, reasonCode: 'source-readiness-unavailable' }
    }
    if (source.status !== 'ready') {
      return rejected('source-not-ready', 'A required lesson source is not ready.', source.reasonCode)
    }
    let material
    try {
      material = await options.productionMaterials.resolve({ ...binding, lesson })
    } catch {
      material = { status: 'unavailable' as const, reasonCode: 'material-resolver-unavailable' }
    }
    if (material.status !== 'ready') {
      return rejected('material-unavailable', 'Production lesson materials are not available.', material.reasonCode)
    }
    if (!SAFE_REF.test(material.material.materialRef)) {
      return rejected('material-unavailable', 'Production lesson materials returned an invalid binding.', 'invalid-material-ref')
    }
    return Object.freeze({ binding, lesson, material: material.material })
  }

  function attestationMatches(
    record: Awaited<ReturnType<FinalFamilyPilotGuardianAttestationPort['read']>>,
    prepared: FinalFamilyPilotPreparedBinding,
    session: FamilyPilotStudySession,
  ): record is NonNullable<typeof record> {
    return Boolean(record) &&
      record?.studentRef === prepared.binding.studentRef &&
      record.assignmentRef === prepared.binding.assignmentRef &&
      record.lessonRef === prepared.binding.lessonRef &&
      record.sessionRef === session.sessionRef &&
      record.authority === 'GUARDIAN_ATTESTATION_REQUIRED'
  }

  async function safety(
    prepared: FinalFamilyPilotPreparedBinding,
    sessionRef: string | null,
  ): Promise<FinalFamilyPilotRejected | null> {
    if (!options.safetyHolds) return null
    let decision
    try {
      decision = await options.safetyHolds.checkStudyEntry({ ...prepared.binding, sessionRef })
    } catch {
      decision = { allowed: false as const, reasonCode: 'safety-hold-unavailable', studentMessage: 'Please get an adult before continuing.' }
    }
    return decision.allowed
      ? null
      : rejected('safety-hold', decision.studentMessage, decision.reasonCode)
  }

  async function authority(binding: FinalFamilyPilotAssignmentBinding): Promise<FinalFamilyPilotCompletionAuthority> {
    try {
      const value = await options.completionAuthority.authorityFor(binding)
      return value === 'LEARNER_AUTHORITY' ? value : 'GUARDIAN_ATTESTATION_REQUIRED'
    } catch {
      // Completion-policy failure must never turn adult-required work into a learner certification.
      return 'GUARDIAN_ATTESTATION_REQUIRED'
    }
  }

  async function completionStatus(
    prepared: FinalFamilyPilotPreparedBinding,
    session: FamilyPilotStudySession,
    result: FamilyPilotStudyResult,
  ): Promise<FinalFamilyPilotCompletionStatus> {
    const resolved = await authority(prepared.binding)
    if (resolved === 'LEARNER_AUTHORITY') {
      return result.status === 'ok' && result.snapshot.sessionStatus === 'completed' ? 'CERTIFIED' : 'NOT_COMPLETE'
    }
    if (!options.guardianAttestation) return 'NOT_COMPLETE'
    try {
      const record = await options.guardianAttestation.read({ ...prepared.binding, sessionRef: session.sessionRef })
      return attestationMatches(record, prepared, session) ? record.status : 'NOT_COMPLETE'
    } catch {
      return 'NOT_COMPLETE'
    }
  }

  async function present(
    prepared: FinalFamilyPilotPreparedBinding,
    session: FamilyPilotStudySession,
    result: FamilyPilotStudyResult,
  ): Promise<FinalFamilyPilotResult> {
    if (result.status !== 'ok') return runtimeFailure(result)
    return Object.freeze({
      status: 'ok' as const,
      study: result.snapshot,
      material: prepared.material,
      completionStatus: await completionStatus(prepared, session, result),
    })
  }

  async function preparedSession(
    assignmentRef: string,
    session: FamilyPilotStudySession,
  ): Promise<FinalFamilyPilotPreparedBinding | FinalFamilyPilotRejected> {
    if (
      session.householdRef !== options.context.study.householdRef ||
      session.learnerRef !== options.context.study.learnerRef
    ) return rejected('identity-mismatch', 'That saved session belongs to a different student or household.')
    const prepared = await bind(assignmentRef)
    if ('status' in prepared) return prepared
    const held = await safety(prepared, session.sessionRef)
    return held ?? prepared
  }

  async function run(
    assignmentRef: string,
    session: FamilyPilotStudySession,
    operation: () => Promise<FamilyPilotStudyResult>,
  ): Promise<FinalFamilyPilotResult> {
    const prepared = await preparedSession(assignmentRef, session)
    if ('status' in prepared) return prepared
    return present(prepared, session, await operation())
  }

  const api: FinalFamilyPilotStudyRuntimeApi = {
    label: FINAL_FAMILY_PILOT_STUDY_RUNTIME_LABEL,
    studentRef: options.context.studentRef,
    ports: storage.ports,
    migration: storage.migration,
    async start(assignmentRef) {
      const prepared = await bind(assignmentRef)
      if ('status' in prepared) return prepared
      const held = await safety(prepared, null)
      if (held) return held
      const started = await study.startAssignment({
        context: { ...options.context.study, lessonRef: prepared.lesson.lessonRef, skillRefs: prepared.lesson.skillRefs },
        assignment: { kind: 'static-curriculum', lesson: prepared.lesson },
      })
      if (started.status !== 'ok') return runtimeFailure(started)
      // The exact-session gate catches a hold created for a deterministic saved session.
      const exactHold = await safety(prepared, started.snapshot.session.sessionRef)
      if (exactHold) return exactHold
      return present(prepared, started.snapshot.session, started)
    },
    async reopen(assignmentRef, session) {
      return run(assignmentRef, session, () => study.resumeAssignment({ context: options.context.study, session }))
    },
    async snapshot(assignmentRef, session) {
      return run(assignmentRef, session, () => study.snapshot({ context: options.context.study, session }))
    },
    async pause(assignmentRef, session) {
      return run(assignmentRef, session, () => study.pause({ context: options.context.study, session }))
    },
    async resume(assignmentRef, session) {
      return run(assignmentRef, session, () => study.resume({ context: options.context.study, session }))
    },
    async checkpoint(assignmentRef, session, responseDraftRef = null) {
      return run(assignmentRef, session, () => study.checkpoint({
        context: options.context.study,
        session,
        responseDraftRef,
      }))
    },
    async completeSegment(assignmentRef, session) {
      return run(assignmentRef, session, () => study.completeSegment({ context: options.context.study, session }))
    },
    async submitStudyAction(input) {
      const prepared = await preparedSession(input.assignmentRef, input.session)
      if ('status' in prepared) return prepared
      const action: FamilyPilotStudyActionResult = await study.submitStudyAction({
        context: options.context.study,
        session: input.session,
        transientLearnerText: input.transientLearnerText,
      })
      if (action.status === 'rejected') return runtimeFailure(action)
      return Object.freeze({ status: 'ok' as const, action, material: prepared.material })
    },
    async complete(assignmentRef, session) {
      const prepared = await preparedSession(assignmentRef, session)
      if ('status' in prepared) return prepared
      const current = await study.snapshot({ context: options.context.study, session })
      if (current.status !== 'ok') return runtimeFailure(current)
      if (current.snapshot.assignmentState !== 'completed') return underlyingFailure({
        status: 'rejected', reason: 'assignment-incomplete', message: 'This Study assignment still has required work left.',
      })
      const resolved = await authority(prepared.binding)
      if (resolved === 'GUARDIAN_ATTESTATION_REQUIRED') {
        if (!options.guardianAttestation) {
          return rejected('guardian-attestation-unavailable', 'An adult sign-off is required but its durable port is unavailable.')
        }
        let pending
        try {
          pending = await options.guardianAttestation.recordLearnerCompletion({
            ...prepared.binding,
            sessionRef: session.sessionRef,
            learnerAssertedAt: now().toISOString(),
          })
        } catch {
          return rejected(
            'guardian-attestation-unavailable',
            'The learner completion could not be saved for adult sign-off. Nothing was certified.',
          )
        }
        if (!attestationMatches(pending, prepared, session) || pending.status !== 'PENDING_GUARDIAN_ATTESTATION') {
          return rejected(
            'guardian-attestation-unavailable',
            'The adult sign-off port returned a mismatched completion binding. Nothing was certified.',
          )
        }
        return Object.freeze({
          status: 'ok' as const,
          study: current.snapshot,
          material: prepared.material,
          completionStatus: pending.status,
        })
      }
      return present(
        prepared,
        session,
        await study.completeAssignment({ context: options.context.study, session }),
      )
    },
    async attest(input): Promise<FinalFamilyPilotAttestationResult> {
      if (!input.adultAuthorized || input.adultHouseholdRef !== options.context.study.householdRef) {
        return rejected('adult-not-authorized', 'Only a verified adult in this household can attest this work.')
      }
      if (!SAFE_REF.test(input.attestedByRef)) {
        return rejected('identity-mismatch', 'Guardian attestation requires an opaque adult reference.')
      }
      const prepared = await preparedSession(input.assignmentRef, input.session)
      if ('status' in prepared) return prepared
      if (await authority(prepared.binding) !== 'GUARDIAN_ATTESTATION_REQUIRED' || !options.guardianAttestation) {
        return rejected('attestation-not-pending', 'This assignment is not waiting for guardian attestation.')
      }
      let before
      try {
        before = await options.guardianAttestation.read({ ...prepared.binding, sessionRef: input.session.sessionRef })
      } catch {
        return rejected('guardian-attestation-unavailable', 'Adult sign-off storage is unavailable.')
      }
      if (!attestationMatches(before, prepared, input.session) || before.status !== 'PENDING_GUARDIAN_ATTESTATION') {
        return rejected('attestation-not-pending', 'The learner has not recorded completion for this assignment.')
      }
      let completion
      try {
        completion = await options.guardianAttestation.attest({
          ...prepared.binding,
          sessionRef: input.session.sessionRef,
          attestedAt: now().toISOString(),
          attestedByRef: input.attestedByRef,
          evidenceMode: input.evidenceMode,
        })
      } catch {
        return rejected('guardian-attestation-unavailable', 'Guardian attestation could not be saved. Nothing was certified.')
      }
      if (!attestationMatches(completion, prepared, input.session) || completion.status !== 'CERTIFIED') {
        return rejected('guardian-attestation-unavailable', 'Guardian attestation returned a mismatched binding. Nothing was certified.')
      }
      const completed = await study.completeAssignment({ context: options.context.study, session: input.session })
      if (completed.status !== 'ok') return runtimeFailure(completed)
      return Object.freeze({ status: 'ok', study: completed.snapshot, completion })
    },
    async clearSafetyHold(input) {
      if (!input.adultAuthorized || input.adultHouseholdRef !== options.context.study.householdRef) {
        return rejected('adult-not-authorized', 'Only a verified adult in this household can clear a safety hold.')
      }
      if (!SAFE_REF.test(input.clearedByRef) || !SAFE_REF.test(input.holdRef)) {
        return rejected('identity-mismatch', 'Safety hold clearing requires opaque hold and adult references.')
      }
      if (!options.safetyHolds) return rejected('safety-hold', 'No safety hold port is available.')
      if (
        input.session.householdRef !== options.context.study.householdRef ||
        input.session.learnerRef !== options.context.study.learnerRef
      ) return rejected('identity-mismatch', 'That safety hold belongs to a different session.')
      let result
      try {
        result = await options.safetyHolds.clear({
          householdRef: options.context.study.householdRef,
          studentRef: options.context.studentRef,
          sessionRef: input.session.sessionRef,
          holdRef: input.holdRef,
          clearedByRef: input.clearedByRef,
          clearedAt: now().toISOString(),
        })
      } catch {
        return rejected('safety-hold', 'That safety hold could not be cleared.')
      }
      return result.status === 'cleared'
        ? Object.freeze({ status: 'cleared' as const })
        : rejected(result.status === 'not-authorized' ? 'adult-not-authorized' : 'safety-hold', 'That safety hold was not cleared.')
    },
    async startTutor(assignmentRef, session): Promise<FinalFamilyPilotTutorResult> {
      const prepared = await preparedSession(assignmentRef, session)
      if ('status' in prepared) return prepared
      // The final catalog uses one completion-authority lesson kind for every
      // subject. Subject eligibility therefore comes from the accepted launch
      // context, not from that intentionally generic curriculum kind.
      const subject = options.context.study.subject
      return Object.freeze({
        status: 'ok',
        step: startStaticHelp({
          scope: {
            householdRef: session.householdRef,
            learnerRef: session.learnerRef,
            sessionRef: session.sessionRef,
          },
          subject,
          grade: options.context.study.grade,
          noAudio: options.context.study.accessibility.noAudio,
          mediaAvailable: prepared.material.mediaAvailable,
        }),
      })
    },
    submitTutorTurn(session, transientMessage) {
      return Promise.resolve(continueStaticHelp(session, transientMessage))
    },
    closeTutor(session) {
      return closeStaticHelp(session)
    },
    storageHealth() {
      return storage.health()
    },
    close() {
      if (closed) return
      closed = true
      study.lifecycle.cancel('navigation-away')
      storage.close()
    },
  }
  return Object.freeze(api)
}

/** Convenience adapter when final convergence already holds the accepted nine ports. */
export function acceptedStudyStoragePort(input: {
  readonly ports: StudyPortBundle
  readonly migration?: unknown
  readonly health: FinalFamilyPilotStoragePort['health']
  readonly close?: () => void
}): FinalFamilyPilotStoragePort {
  return Object.freeze(input)
}

/** Type-only compatibility check for callers passing the accepted safety port into IndexedDB. */
export type FinalFamilyPilotIndexedDbSafetyPort = StudySafetyPort
