import type { AcademyStudyContext } from '../../academy/adapters/studyContextAdapter'
import {
  StudyIdentityClientError,
} from '../client/studyIdentityClient'
import type { StudyProductionReadinessClient } from '../client/studyProductionReadinessClient'
import {
  StudyProductionSessionContractError,
  type StudyProductionSessionClient,
} from '../client/studyProductionSessionClient'
import type { StudyCheckpointRecord } from '../contracts/persistence/types'
import {
  isStudyProductionLocalDate,
  isStudyProductionReleaseVersion,
  isStudyProductionSafeRef,
  parseStudyCheckpointDraft,
  type StudyProductionBeginRequest,
  type StudyProductionBindingReason,
  type StudyProductionCheckpointReadResponse,
  type StudyProductionCheckpointRequest,
  type StudyProductionCheckpointResponse,
  type StudyProductionManualReviewReason,
  type StudyProductionResumeResponse,
  type StudyProductionSessionProjection,
  type StudyProductionSessionState,
  type StudyProductionSettingsSource,
  type StudyProductionSettingsUnavailableReason,
  type StudyProductionTransitionResponse,
  type StudyProductionTransitionType,
  type StudyProductionUnavailableResponse,
} from '../contracts/production/session'
import { StudyLifecycleAbortError } from '../lifecycle'

export type StudyProductionControllerStatus =
  | 'ready'
  | 'loading'
  | 'conflict'
  | 'manual_review'
  | 'unavailable'
  | 'not_ready'
  | 'rejected'
  | 'network_failure'
  | 'resume_required'

export type StudyProductionMutationKind = 'begin' | 'transition' | 'checkpoint'

export interface StudyProductionAdvisoryLaunch {
  readonly releaseVersion: string
  readonly lessonRef: string
  readonly skillRefs: readonly string[]
  readonly scopeWeek: number
  readonly scopeDay: number
}

export type StudyProductionControllerRecovery =
  | {
      readonly kind: 'revision_conflict'
      readonly currentRevision: number
      readonly currentState: StudyProductionSessionState
    }
  | {
      readonly kind: 'checkpoint_revision_conflict'
      readonly currentCheckpointRevision: number
      readonly sessionRevision: number
      readonly currentState: StudyProductionSessionState
    }
  | { readonly kind: 'idempotency_collision' }
  | {
      readonly kind: 'invalid_transition'
      readonly currentRevision: number
      readonly currentState: StudyProductionSessionState
      readonly transitionType: StudyProductionTransitionType | 'checkpoint'
    }
  | {
      readonly kind: 'invalid_checkpoint'
      readonly reasonCode: 'malformed-event' | 'stale-checkpoint' | 'idempotency-collision'
    }
  | {
      readonly kind: 'manual_review'
      readonly reasonCodes: readonly StudyProductionManualReviewReason[]
      readonly sourceCategories: readonly StudyProductionSettingsSource[]
    }
  | {
      readonly kind: 'unavailable'
      readonly reasonCode: StudyProductionBindingReason | StudyProductionSettingsUnavailableReason
    }
  | { readonly kind: 'checkpoint_integrity' }
  | { readonly kind: 'contract_invalid' }
  | { readonly kind: 'network_uncertain' }
  | { readonly kind: 'student_session_invalid' }
  | { readonly kind: 'mutation_pending' }

export interface StudyProductionControllerSnapshot {
  readonly status: StudyProductionControllerStatus
  /** Exact, rebuilt server DTO. Contains no household or learner authority. */
  readonly session: StudyProductionSessionProjection | null
  /** Exact recovery checkpoint, or null. Raw answers and transcripts are contractually absent. */
  readonly checkpoint: StudyCheckpointRecord | null
  readonly acceptedCheckpointRevision: number
  readonly selection: { readonly segmentId: string | null }
  readonly advisoryLaunch: StudyProductionAdvisoryLaunch | null
  readonly pendingMutation: StudyProductionMutationKind | null
  readonly recovery: StudyProductionControllerRecovery | null
}

export interface StudyProductionBeginInput {
  readonly academyContext: AcademyStudyContext
  readonly subjectId: string
  readonly studyPlanId: string | null
  readonly intendedLocalDate: string
  readonly initialSegmentId: string
}

export interface StudyProductionResumeInput {
  readonly sessionId: string
  readonly curriculumReleaseVersion: string
}

export interface StudyProductionTransitionInput {
  readonly type: StudyProductionTransitionType
  readonly segmentId: string | null
}

export type StudyProductionCheckpointDraft = Omit<
  StudyCheckpointRecord,
  'sessionId' | 'lessonId' | 'revision'
>

export interface StudyProductionController {
  checkReadiness(signal?: AbortSignal): Promise<StudyProductionControllerSnapshot>
  begin(input: StudyProductionBeginInput, signal?: AbortSignal): Promise<StudyProductionControllerSnapshot>
  resume(input: StudyProductionResumeInput, signal?: AbortSignal): Promise<StudyProductionControllerSnapshot>
  transition(
    input: StudyProductionTransitionInput,
    signal?: AbortSignal,
  ): Promise<StudyProductionControllerSnapshot>
  readCheckpoint(signal?: AbortSignal): Promise<StudyProductionControllerSnapshot>
  saveCheckpoint(
    checkpoint: StudyProductionCheckpointDraft,
    signal?: AbortSignal,
  ): Promise<StudyProductionControllerSnapshot>
  selectSegment(segmentId: string | null): StudyProductionControllerSnapshot
  snapshot(): StudyProductionControllerSnapshot
  subscribe(listener: (snapshot: StudyProductionControllerSnapshot) => void): () => void
}

export interface StudyProductionControllerOptions {
  readonly readiness: StudyProductionReadinessClient
  readonly sessions: StudyProductionSessionClient
  readonly createMutationId?: (kind: StudyProductionMutationKind) => string
}

interface PendingMutation {
  readonly kind: StudyProductionMutationKind
  readonly fingerprint: string
  readonly identity: string
  inFlight: Promise<StudyProductionControllerSnapshot> | null
}

interface ActiveRead {
  readonly kind: 'readiness' | 'resume' | 'checkpoint'
  readonly fingerprint: string
  inFlight: Promise<StudyProductionControllerSnapshot>
}

const TRANSITION_TYPES = new Set<StudyProductionTransitionType>([
  'segment-started', 'segment-completed', 'pause-started', 'session-resumed',
  'break-requested', 'break-started', 'break-ended',
  'technical-interruption-started', 'technical-interruption-ended',
  'session-completed', 'session-abandoned',
])

function defaultMutationId(kind: StudyProductionMutationKind): string {
  const value = globalThis.crypto?.randomUUID?.()
  if (!value) throw new Error('secure_mutation_identity_unavailable')
  return `study-${kind}:${value}`
}

function immutableAdvisory(value: AcademyStudyContext): StudyProductionAdvisoryLaunch | null {
  if (value.adapterVersion !== 1 ||
      !isStudyProductionReleaseVersion(value.releaseVersion) ||
      !isStudyProductionSafeRef(value.lessonRef) ||
      !Array.isArray(value.skillRefs) || value.skillRefs.length > 64 ||
      value.skillRefs.some((ref) => !isStudyProductionSafeRef(ref)) ||
      new Set(value.skillRefs).size !== value.skillRefs.length ||
      !Number.isSafeInteger(value.scopeWeek) || value.scopeWeek < 1 || value.scopeWeek > 53 ||
      !Number.isSafeInteger(value.scopeDay) || value.scopeDay < 1 || value.scopeDay > 7) return null
  return Object.freeze({
    releaseVersion: value.releaseVersion,
    lessonRef: value.lessonRef,
    skillRefs: Object.freeze([...value.skillRefs]),
    scopeWeek: value.scopeWeek,
    scopeDay: value.scopeDay,
  })
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function sameSessionRequest(
  projection: StudyProductionSessionProjection,
  request: { readonly sessionId: string; readonly curriculumReleaseVersion: string },
): boolean {
  return projection.sessionId === request.sessionId &&
    projection.curriculumBinding.releaseVersion === request.curriculumReleaseVersion
}

function unavailableStatus(
  value: StudyProductionUnavailableResponse,
): StudyProductionControllerStatus {
  return value.status === 'manual-review' || value.status === 'manual_review'
    ? 'manual_review'
    : 'unavailable'
}

function isUnavailableResponse(
  value: { readonly status: string },
): value is StudyProductionUnavailableResponse {
  return value.status === 'unavailable' || value.status === 'manual-review' ||
    value.status === 'manual_review'
}

/**
 * Stateful production controller. Server projections are the only source of
 * accepted session/checkpoint revisions; local identities exist solely to make
 * retries of one uncertain logical mutation replay-safe.
 */
export function createStudyProductionController(
  options: StudyProductionControllerOptions,
): StudyProductionController {
  const createMutationId = options.createMutationId ?? defaultMutationId
  const listeners = new Set<(snapshot: StudyProductionControllerSnapshot) => void>()
  let status: StudyProductionControllerStatus = 'not_ready'
  let session: StudyProductionSessionProjection | null = null
  let acceptedCheckpoint: StudyCheckpointRecord | null = null
  let checkpointRevision = 0
  let selectedSegmentId: string | null = null
  let advisoryLaunch: StudyProductionAdvisoryLaunch | null = null
  let recovery: StudyProductionControllerRecovery | null = null
  let pending: PendingMutation | null = null
  let activeRead: ActiveRead | null = null

  function snapshot(): StudyProductionControllerSnapshot {
    return Object.freeze({
      status,
      session,
      checkpoint: acceptedCheckpoint,
      acceptedCheckpointRevision: checkpointRevision,
      selection: Object.freeze({ segmentId: selectedSegmentId }),
      advisoryLaunch,
      pendingMutation: pending?.kind ?? null,
      recovery,
    })
  }

  function publish(
    nextStatus: StudyProductionControllerStatus,
    nextRecovery: StudyProductionControllerRecovery | null = null,
  ): StudyProductionControllerSnapshot {
    status = nextStatus
    recovery = nextRecovery
    const value = snapshot()
    for (const listener of listeners) listener(value)
    return value
  }

  function applyUnavailable(value: StudyProductionUnavailableResponse): StudyProductionControllerSnapshot {
    if (value.status === 'manual_review') {
      return publish('manual_review', Object.freeze({
        kind: 'manual_review',
        reasonCodes: Object.freeze([...value.reasonCodes]),
        sourceCategories: Object.freeze([...value.sourceCategories]),
      }))
    }
    if (value.status === 'manual-review') {
      return publish('manual_review', Object.freeze({
        kind: 'unavailable',
        reasonCode: value.reasonCode,
      }))
    }
    return publish(unavailableStatus(value), Object.freeze({
      kind: 'unavailable',
      reasonCode: value.reasonCode,
    }))
  }

  function knownFailure(error: unknown, mutationUncertain: boolean): StudyProductionControllerSnapshot {
    if (error instanceof StudyProductionSessionContractError) {
      if (pending) pending = null
      return publish('unavailable', Object.freeze({ kind: 'contract_invalid' }))
    }
    if (error instanceof StudyIdentityClientError) {
      if (error.code === 'learner-unavailable') {
        if (pending) pending = null
        return publish('unavailable', Object.freeze({
          kind: 'unavailable',
          reasonCode: 'study-session-unavailable',
        }))
      }
      if (error.code === 'student-session-invalid' || error.code === 'unauthenticated') {
        return publish('resume_required', Object.freeze({ kind: 'student_session_invalid' }))
      }
    }
    if (mutationUncertain || error instanceof StudyLifecycleAbortError ||
        error instanceof DOMException || error instanceof StudyIdentityClientError) {
      return publish('network_failure', Object.freeze({ kind: 'network_uncertain' }))
    }
    return publish('unavailable', Object.freeze({ kind: 'contract_invalid' }))
  }

  function invalidInput(): StudyProductionControllerSnapshot {
    return publish('rejected', Object.freeze({ kind: 'contract_invalid' }))
  }

  function startMutation(
    kind: StudyProductionMutationKind,
    fingerprint: string,
    execute: (identity: string) => Promise<StudyProductionControllerSnapshot>,
  ): Promise<StudyProductionControllerSnapshot> {
    if (activeRead) {
      return Promise.resolve(publish('resume_required', Object.freeze({ kind: 'mutation_pending' })))
    }
    if (pending && (pending.kind !== kind || pending.fingerprint !== fingerprint)) {
      return Promise.resolve(publish('resume_required', Object.freeze({ kind: 'mutation_pending' })))
    }
    if (!pending) {
      let identity: string
      try {
        identity = createMutationId(kind)
      } catch {
        return Promise.resolve(invalidInput())
      }
      if (!isStudyProductionSafeRef(identity)) return Promise.resolve(invalidInput())
      pending = { kind, fingerprint, identity, inFlight: null }
    }
    if (pending.inFlight) return pending.inFlight
    const claimed = pending
    publish('loading')
    const operation = execute(claimed.identity).finally(() => {
      if (pending === claimed) claimed.inFlight = null
    })
    claimed.inFlight = operation
    return operation
  }

  function startRead(
    kind: ActiveRead['kind'],
    fingerprint: string,
    execute: () => Promise<StudyProductionControllerSnapshot>,
  ): Promise<StudyProductionControllerSnapshot> {
    if (pending?.inFlight) {
      return Promise.resolve(publish('resume_required', Object.freeze({ kind: 'mutation_pending' })))
    }
    if (activeRead) {
      return activeRead.kind === kind && activeRead.fingerprint === fingerprint
        ? activeRead.inFlight
        : Promise.resolve(publish('resume_required', Object.freeze({ kind: 'mutation_pending' })))
    }
    publish('loading')
    const claimed: ActiveRead = {
      kind,
      fingerprint,
      inFlight: Promise.resolve(snapshot()),
    }
    const operation = execute().finally(() => {
      if (activeRead === claimed) activeRead = null
    })
    claimed.inFlight = operation
    activeRead = claimed
    return operation
  }

  function acceptSession(
    projection: StudyProductionSessionProjection,
    nextCheckpointRevision: number,
    nextCheckpoint: StudyCheckpointRecord | null = acceptedCheckpoint,
  ): StudyProductionControllerSnapshot {
    const { checkpoint: _checkpoint, ...sessionProjection } = projection as
      StudyProductionSessionProjection & { readonly checkpoint?: StudyCheckpointRecord | null }
    session = Object.freeze(sessionProjection)
    acceptedCheckpoint = nextCheckpoint
    checkpointRevision = nextCheckpointRevision
    selectedSegmentId = projection.currentSegmentId
    return publish('ready')
  }

  function checkReadiness(signal?: AbortSignal): Promise<StudyProductionControllerSnapshot> {
    return startRead('readiness', 'production-readiness', async () => {
      try {
        const value = await options.readiness.revalidate(signal)
        return publish(value.status === 'ready' ? 'ready' : 'not_ready')
      } catch (error) {
        return knownFailure(error, false)
      }
    })
  }

  function begin(
    input: StudyProductionBeginInput,
    signal?: AbortSignal,
  ): Promise<StudyProductionControllerSnapshot> {
    const advisory = immutableAdvisory(input.academyContext)
    if (!advisory || !isStudyProductionSafeRef(input.subjectId) ||
        (input.studyPlanId !== null && !isStudyProductionSafeRef(input.studyPlanId)) ||
        !isStudyProductionLocalDate(input.intendedLocalDate) ||
        !isStudyProductionSafeRef(input.initialSegmentId)) return Promise.resolve(invalidInput())
    if (!pending && status === 'conflict') return Promise.resolve(snapshot())
    if (session && !pending) {
      return Promise.resolve(publish('resume_required', Object.freeze({ kind: 'mutation_pending' })))
    }
    const requestWithoutIdentity = Object.freeze({
      lessonId: advisory.lessonRef,
      subjectId: input.subjectId,
      studyPlanId: input.studyPlanId,
      intendedLocalDate: input.intendedLocalDate,
      initialSegmentId: input.initialSegmentId,
      curriculumContext: Object.freeze({
        releaseVersion: advisory.releaseVersion,
        lessonRef: advisory.lessonRef,
        skillRefs: advisory.skillRefs,
      }),
    })
    const fingerprint = canonical(requestWithoutIdentity)
    return startMutation('begin', fingerprint, async (identity) => {
      const request: StudyProductionBeginRequest = Object.freeze({
        idempotencyKey: identity,
        ...requestWithoutIdentity,
      })
      try {
        const value = await options.sessions.begin(request, signal)
        if (pending?.identity === identity) pending = null
        if (value.status === 'begun') {
          if (value.revision !== 1 || value.lessonId !== request.lessonId ||
              value.subjectId !== request.subjectId || value.studyPlanId !== request.studyPlanId ||
              value.intendedLocalDate !== request.intendedLocalDate ||
              value.currentSegmentId !== request.initialSegmentId ||
              value.curriculumBinding.releaseVersion !== advisory.releaseVersion) {
            return publish('unavailable', Object.freeze({ kind: 'contract_invalid' }))
          }
          advisoryLaunch = advisory
          return acceptSession(value, 0, null)
        }
        if (value.status === 'idempotency-collision') {
          return publish('conflict', Object.freeze({ kind: 'idempotency_collision' }))
        }
        return applyUnavailable(value)
      } catch (error) {
        return knownFailure(error, true)
      }
    })
  }

  function resume(
    input: StudyProductionResumeInput,
    signal?: AbortSignal,
  ): Promise<StudyProductionControllerSnapshot> {
    if (!isStudyProductionSafeRef(input.sessionId) ||
        !isStudyProductionReleaseVersion(input.curriculumReleaseVersion)) {
      return Promise.resolve(invalidInput())
    }
    return startRead('resume', canonical(input), async () => {
      try {
        const value = await options.sessions.resume(Object.freeze({ ...input }), signal)
        if (value.status === 'resumable' || value.status === 'closed') {
          if (!sameSessionRequest(value, input) ||
              (value.checkpoint && (value.checkpoint.sessionId !== value.sessionId ||
                value.checkpoint.lessonId !== value.lessonId))) {
            return publish('unavailable', Object.freeze({ kind: 'contract_invalid' }))
          }
          pending = null
          return acceptSession(value, value.checkpoint?.revision ?? 0, value.checkpoint)
        }
        return isUnavailableResponse(value)
          ? applyUnavailable(value)
          : publish('unavailable', Object.freeze({ kind: 'contract_invalid' }))
      } catch (error) {
        return knownFailure(error, false)
      }
    })
  }

  function transition(
    input: StudyProductionTransitionInput,
    signal?: AbortSignal,
  ): Promise<StudyProductionControllerSnapshot> {
    if (!session || !TRANSITION_TYPES.has(input.type) ||
        (input.segmentId !== null && !isStudyProductionSafeRef(input.segmentId))) {
      return Promise.resolve(publish(session ? 'rejected' : 'resume_required', Object.freeze({
        kind: session ? 'contract_invalid' : 'mutation_pending',
      })))
    }
    if (!pending && (status === 'conflict' || status === 'resume_required')) {
      return Promise.resolve(snapshot())
    }
    const current = session
    const requestWithoutIdentity = Object.freeze({
      sessionId: current.sessionId,
      expectedRevision: current.revision,
      curriculumReleaseVersion: current.curriculumBinding.releaseVersion,
      transition: Object.freeze({ type: input.type, segmentId: input.segmentId }),
    })
    const fingerprint = canonical(requestWithoutIdentity)
    return startMutation('transition', fingerprint, async (identity) => {
      const request = Object.freeze({
        sessionId: requestWithoutIdentity.sessionId,
        expectedRevision: requestWithoutIdentity.expectedRevision,
        idempotencyKey: identity,
        curriculumReleaseVersion: requestWithoutIdentity.curriculumReleaseVersion,
        transition: requestWithoutIdentity.transition,
      })
      try {
        const value: StudyProductionTransitionResponse =
          await options.sessions.transition(request, signal)
        if (pending?.identity === identity) pending = null
        if (value.status === 'stored') {
          if (!sameSessionRequest(value, request) || value.revision !== current.revision + 1) {
            return publish('unavailable', Object.freeze({ kind: 'contract_invalid' }))
          }
          return acceptSession(value, checkpointRevision)
        }
        if (value.status === 'revision-conflict') {
          return publish('conflict', Object.freeze({
            kind: 'revision_conflict',
            currentRevision: value.currentRevision,
            currentState: value.currentState,
          }))
        }
        if (value.status === 'invalid-transition') {
          return publish('rejected', Object.freeze({
            kind: 'invalid_transition',
            currentRevision: value.currentRevision,
            currentState: value.currentState,
            transitionType: value.transitionType,
          }))
        }
        if (value.status === 'idempotency-collision') {
          return publish('conflict', Object.freeze({ kind: 'idempotency_collision' }))
        }
        return applyUnavailable(value)
      } catch (error) {
        return knownFailure(error, true)
      }
    })
  }

  function readCheckpoint(signal?: AbortSignal): Promise<StudyProductionControllerSnapshot> {
    if (!session || pending || status === 'conflict' || status === 'resume_required') {
      return Promise.resolve(publish('resume_required', Object.freeze({ kind: 'mutation_pending' })))
    }
    const current = session
    const request = Object.freeze({
      sessionId: current.sessionId,
      curriculumReleaseVersion: current.curriculumBinding.releaseVersion,
    })
    return startRead('checkpoint', canonical(request), async () => {
      try {
        const value: StudyProductionCheckpointReadResponse =
          await options.sessions.readCheckpoint(request, signal)
        if (value.status === 'found' || value.status === 'not-found' ||
            value.status === 'integrity-failed') {
          if (value.curriculumBinding.releaseVersion !== request.curriculumReleaseVersion) {
            return publish('unavailable', Object.freeze({ kind: 'contract_invalid' }))
          }
          if (value.sessionRevision !== current.revision || value.currentState !== current.state) {
            return publish('resume_required', Object.freeze({
              kind: 'revision_conflict',
              currentRevision: value.sessionRevision,
              currentState: value.currentState,
            }))
          }
          if (value.status === 'integrity-failed') {
            return publish('manual_review', Object.freeze({ kind: 'checkpoint_integrity' }))
          }
          if (value.checkpoint && (value.checkpoint.sessionId !== current.sessionId ||
              value.checkpoint.lessonId !== current.lessonId)) {
            return publish('unavailable', Object.freeze({ kind: 'contract_invalid' }))
          }
          checkpointRevision = value.checkpoint?.revision ?? 0
          acceptedCheckpoint = value.checkpoint
          return publish('ready')
        }
        return isUnavailableResponse(value)
          ? applyUnavailable(value)
          : publish('unavailable', Object.freeze({ kind: 'contract_invalid' }))
      } catch (error) {
        return knownFailure(error, false)
      }
    })
  }

  function saveCheckpoint(
    draft: StudyProductionCheckpointDraft,
    signal?: AbortSignal,
  ): Promise<StudyProductionControllerSnapshot> {
    if (!session) {
      return Promise.resolve(publish('resume_required', Object.freeze({ kind: 'mutation_pending' })))
    }
    if (!pending && (status === 'conflict' || status === 'resume_required')) {
      return Promise.resolve(snapshot())
    }
    const current = session
    const checkpointCandidate = {
      ...draft,
      sessionId: current.sessionId,
      lessonId: current.lessonId,
      revision: checkpointRevision + 1,
    }
    const checkpoint = parseStudyCheckpointDraft(checkpointCandidate)
    if (!checkpoint) return Promise.resolve(invalidInput())
    const requestWithoutIdentity = Object.freeze({
      sessionId: current.sessionId,
      expectedRevision: checkpointRevision,
      checkpoint,
      curriculumReleaseVersion: current.curriculumBinding.releaseVersion,
    })
    const fingerprint = canonical(requestWithoutIdentity)
    return startMutation('checkpoint', fingerprint, async (identity) => {
      const request: StudyProductionCheckpointRequest = Object.freeze({
        sessionId: requestWithoutIdentity.sessionId,
        expectedRevision: requestWithoutIdentity.expectedRevision,
        mutationId: identity,
        checkpoint: requestWithoutIdentity.checkpoint,
        curriculumReleaseVersion: requestWithoutIdentity.curriculumReleaseVersion,
      })
      try {
        const value: StudyProductionCheckpointResponse =
          await options.sessions.saveCheckpoint(request, signal)
        if (pending?.identity === identity) pending = null
        if (value.status === 'stored') {
          if (value.checkpointRevision !== request.expectedRevision + 1 ||
              value.curriculumBinding.releaseVersion !== request.curriculumReleaseVersion) {
            return publish('unavailable', Object.freeze({ kind: 'contract_invalid' }))
          }
          if (value.sessionRevision !== current.revision || value.currentState !== current.state) {
            return publish('resume_required', Object.freeze({
              kind: 'revision_conflict',
              currentRevision: value.sessionRevision,
              currentState: value.currentState,
            }))
          }
          checkpointRevision = value.checkpointRevision
          acceptedCheckpoint = request.checkpoint
          return publish('ready')
        }
        if (value.status === 'revision-conflict') {
          return publish('conflict', Object.freeze({
            kind: 'checkpoint_revision_conflict',
            currentCheckpointRevision: value.currentCheckpointRevision,
            sessionRevision: value.sessionRevision,
            currentState: value.currentState,
          }))
        }
        if (value.status === 'invalid-transition') {
          return publish('rejected', Object.freeze({
            kind: 'invalid_transition',
            currentRevision: value.currentRevision,
            currentState: value.currentState,
            transitionType: value.transitionType,
          }))
        }
        if (value.status === 'invalid-checkpoint') {
          return publish('rejected', Object.freeze({
            kind: 'invalid_checkpoint', reasonCode: value.reasonCode,
          }))
        }
        if (value.status === 'idempotency-collision') {
          return publish('conflict', Object.freeze({ kind: 'idempotency_collision' }))
        }
        return applyUnavailable(value)
      } catch (error) {
        return knownFailure(error, true)
      }
    })
  }

  function selectSegment(segmentId: string | null): StudyProductionControllerSnapshot {
    if (segmentId !== null && !isStudyProductionSafeRef(segmentId)) return invalidInput()
    selectedSegmentId = segmentId
    return snapshot()
  }

  return Object.freeze({
    checkReadiness,
    begin,
    resume,
    transition,
    readCheckpoint,
    saveCheckpoint,
    selectSegment,
    snapshot,
    subscribe(listener: (snapshot: StudyProductionControllerSnapshot) => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  })
}
