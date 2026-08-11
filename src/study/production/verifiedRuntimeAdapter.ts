import type { StudyIdentityClient } from '../client/studyIdentityClient'
import { STUDY_ACADEMIC_OPERATIONS } from '../contracts/identity/academicOperations'
import type {
  StudyProductionReadinessWire,
} from '../client/studyProductionReadinessClient'
import type {
  StudyLearnerSelector,
  StudySessionGrant,
  StudyStudentCapability,
} from '../contracts/identity/session'
import {
  runCurrentStudyWork,
  StudyLifecycleAbortError,
  StudyLifecycleBoundary,
  type StudyCancellationReason,
  type StudyLifecycleToken,
} from '../lifecycle'

export type VerifiedAcademicOperation = Parameters<StudyIdentityClient['executeAcademicOperation']>[0]['operation']

export interface VerifiedRuntimeLaunchInput {
  readonly featureEnabled: boolean
  readonly authenticatedHostSession: boolean
  /** Compared only inside this closure; never sent to the Study APIs or exposed in a snapshot. */
  readonly hostSessionKey: string
  readonly accessToken: string
  readonly selectedStudentRef: StudyLearnerSelector
  readonly readiness: StudyProductionReadinessWire
  readonly signal?: AbortSignal
}
export interface VerifiedRuntimeExecuteInput {
  readonly operation: VerifiedAcademicOperation
  readonly request: Readonly<Record<string, unknown>>
  readonly operationRef: string
  readonly signal?: AbortSignal
}

export interface VerifiedRuntimeSnapshot {
  readonly status: 'ready' | 'not-ready'
  readonly expiresAt: string | null
}

export interface VerifiedStudyRuntimeAdapter {
  launch(input: VerifiedRuntimeLaunchInput): Promise<VerifiedRuntimeSnapshot>
  execute(input: VerifiedRuntimeExecuteInput): Promise<unknown>
  cancel(reason: StudyCancellationReason): Promise<void>
  applyReadiness(readiness: StudyProductionReadinessWire): Promise<void>
  snapshot(): VerifiedRuntimeSnapshot
  isReady(): boolean
}

export interface VerifiedStudyRuntimeAdapterOptions {
  readonly identityClient: StudyIdentityClient
  readonly lifecycle: StudyLifecycleBoundary
  readonly now?: () => number
  readonly createLifecycleRef?: () => string
  /**
   * STUDY-A1-COMP Phase 5 — called with the canonical grant the identity client
   * has just issued, immediately, before this launch does anything else with it.
   * The App installs it into its own Study session lifecycle here.
   *
   * A throw refuses the launch: the catch below cancels the epoch, clears the
   * identity client and re-raises, so a grant that could not be installed leaves
   * Study unavailable rather than half-established. Nothing is passed back out,
   * and the grant is not retained here.
   */
  readonly onSessionGrantIssued?: (grant: StudySessionGrant) => void
}

/**
 * The capability this adapter re-verifies before each operation. Read from the
 * browser allow-list rather than restated here: a second literal in the same
 * lane would be one more place for the same map to go stale, and the map that
 * types `executeAcademicOperation` is the one that decides what may be sent.
 */
const CAPABILITY_BY_OPERATION: Readonly<Record<VerifiedAcademicOperation, StudyStudentCapability>> =
  STUDY_ACADEMIC_OPERATIONS

function selectorKey(selector: StudyLearnerSelector): string {
  return `${selector.kind}\u001f${selector.value}`
}

function readinessIsCurrent(readiness: StudyProductionReadinessWire, now: number): boolean {
  return readiness.status === 'ready' &&
    Number.isFinite(Date.parse(readiness.expiresAt)) &&
    Date.parse(readiness.expiresAt) > now
}

function earliestExpiration(values: readonly string[]): string {
  const expiration = Math.min(...values.map((value) => Date.parse(value)))
  if (!Number.isFinite(expiration)) throw new Error('verified_runtime_expiration_invalid')
  return new Date(expiration).toISOString()
}

function safeLifecycleRef(): string {
  const generated = globalThis.crypto?.randomUUID?.()
  if (generated) return `host-lifecycle:${generated}`
  return `host-lifecycle:${Date.now()}:${Math.random().toString(36).slice(2)}`
}

function abortReason(signal?: AbortSignal): StudyCancellationReason {
  return typeof signal?.reason === 'string'
    ? signal.reason as StudyCancellationReason
    : 'authorization-loss'
}

/**
 * Browser-owned adapter for the server verified academic runtime gateway.
 * It never deserializes household/student/grant authority. The opaque Study
 * bearer remains inside StudyIdentityClient, and the lifecycle sees only
 * host-local epoch references with no server authority identifiers.
 */
export function createVerifiedStudyRuntimeAdapter(
  options: VerifiedStudyRuntimeAdapterOptions,
): VerifiedStudyRuntimeAdapter {
  const identity = options.identityClient
  const lifecycle = options.lifecycle
  const now = options.now ?? Date.now
  const createLifecycleRef = options.createLifecycleRef ?? safeLifecycleRef
  let generation = 0
  let hostSessionKey: string | null = null
  let activeSelectorKey: string | null = null
  let activeExpiresAt: string | null = null
  let hostLifecycleRef: string | null = null
  let selectionEpoch = 0
  let grantEpoch = 0
  let pending: AbortController | null = null
  /** The token of the epoch THIS runtime began, and the only one it may renew. */
  let epochToken: StudyLifecycleToken | null = null

  function snapshot(): VerifiedRuntimeSnapshot {
    const ready = Boolean(
      activeExpiresAt &&
      Date.parse(activeExpiresAt) > now() &&
      identity.hasSession() &&
      lifecycle.token().isCurrent(),
    )
    return Object.freeze({
      status: ready ? 'ready' : 'not-ready',
      expiresAt: ready ? activeExpiresAt : null,
    })
  }

  async function cancel(reason: StudyCancellationReason): Promise<void> {
    generation += 1
    pending?.abort(reason)
    pending = null
    lifecycle.cancel(reason)
    hostSessionKey = null
    activeSelectorKey = null
    activeExpiresAt = null
    hostLifecycleRef = null
    epochToken = null
    try {
      await identity.revoke()
    } catch {
      identity.clear()
    }
  }

  async function rejectLaunch(reason: StudyCancellationReason): Promise<never> {
    await cancel(reason)
    throw new StudyLifecycleAbortError(reason)
  }

  async function launch(input: VerifiedRuntimeLaunchInput): Promise<VerifiedRuntimeSnapshot> {
    if (!input.featureEnabled) return rejectLaunch('feature-disabled')
    if (
      !input.authenticatedHostSession ||
      !input.hostSessionKey ||
      !input.accessToken ||
      !readinessIsCurrent(input.readiness, now())
    ) return rejectLaunch('authorization-loss')
    if (input.signal?.aborted) return rejectLaunch(abortReason(input.signal))

    const nextSelectorKey = selectorKey(input.selectedStudentRef)
    const hostChanged = hostSessionKey !== null && hostSessionKey !== input.hostSessionKey
    const learnerChanged = activeSelectorKey !== null && activeSelectorKey !== nextSelectorKey
    if (hostChanged || learnerChanged) {
      await cancel(hostChanged ? 'session-expired' : 'learner-switch')
    }

    const operationGeneration = ++generation
    pending?.abort('new-lifecycle-epoch')
    const controller = new AbortController()
    pending = controller
    const forwardAbort = () => controller.abort(abortReason(input.signal))
    input.signal?.addEventListener('abort', forwardAbort, { once: true })

    try {
      const reusingSession = identity.hasSession() &&
        hostSessionKey === input.hostSessionKey &&
        activeSelectorKey === nextSelectorKey
      const grant = reusingSession
        ? null
        : await identity.issueGuardianLaunch({
            accessToken: input.accessToken,
            selectedStudentRef: input.selectedStudentRef,
            signal: controller.signal,
          })
      // Immediately, and before the verify round trip: from here on the only
      // holder of the reference is the host's own transport. A reused session
      // installs nothing, because nothing new was issued.
      if (grant) options.onSessionGrantIssued?.(grant)
      const verified = await identity.verify({
        requiredCapability: 'student:progress:read',
        signal: controller.signal,
      })
      if (operationGeneration !== generation || controller.signal.aborted) {
        throw new StudyLifecycleAbortError(abortReason(controller.signal))
      }

      const expiresAt = earliestExpiration([
        input.readiness.expiresAt,
        verified.expiresAt,
        grant?.expiresAt ?? verified.expiresAt,
      ])
      if (Date.parse(expiresAt) <= now()) return rejectLaunch('authorization-loss')

      // STUDY-A1-LEASE-EXTEND — a refresh that changed no authority extends the
      // lease instead of rotating identity.
      //
      // `reusingSession` already IS the reuse identity this may rely on: the same
      // host session key, the same selected learner, and no new grant — because a
      // grant is issued exactly when it is false, and a host or learner change has
      // cancelled and revoked above before reaching here. The refreshed
      // expiration is deliberately no part of that identity.
      //
      // STUDY-A1-LIFECYCLE-AUTHORITY — the last condition, that the epoch this
      // runtime began is still the live one, is now carried by the API rather
      // than by a check next to the call: the token is the proof, and the
      // boundary refuses to renew for anything else. A cancelled epoch, an
      // expired one, and an epoch some other authority has since bound are all
      // replaced rather than extended.
      const renewed = reusingSession && epochToken
        ? lifecycle.renewEpochLeaseIfCurrent(epochToken, expiresAt)
        : null
      if (!renewed) {
        if (!reusingSession) selectionEpoch += 1
        grantEpoch += 1
        hostLifecycleRef ??= createLifecycleRef()
        epochToken = lifecycle.beginEpoch({
          // These are local lifecycle labels, not deserialized server IDs.
          authenticatedSessionRef: hostLifecycleRef,
          householdRef: 'server-bound-authority',
          learnerRef: `selected-learner-epoch:${selectionEpoch}`,
          launchGrantRef: `opaque-grant-epoch:${grantEpoch}`,
          featureEnabled: true,
          authorizationRevision: grantEpoch,
          expiresAt,
        })
      }
      hostSessionKey = input.hostSessionKey
      activeSelectorKey = nextSelectorKey
      activeExpiresAt = expiresAt
      return snapshot()
    } catch (error) {
      if (operationGeneration === generation) {
        lifecycle.cancel(controller.signal.aborted ? abortReason(controller.signal) : 'authorization-loss')
        activeExpiresAt = null
        identity.clear()
      }
      throw error
    } finally {
      input.signal?.removeEventListener('abort', forwardAbort)
      if (pending === controller) pending = null
    }
  }

  async function execute(input: VerifiedRuntimeExecuteInput): Promise<unknown> {
    if (!input.operationRef || !CAPABILITY_BY_OPERATION[input.operation]) {
      throw new Error('verified_runtime_operation_invalid')
    }
    if (!activeExpiresAt || Date.parse(activeExpiresAt) <= now() || !identity.hasSession()) {
      await cancel('authorization-loss')
      throw new StudyLifecycleAbortError('authorization-loss')
    }
    const token = lifecycle.token()
    return runCurrentStudyWork(token, async (signal, context) => {
      await identity.verify({
        requiredCapability: CAPABILITY_BY_OPERATION[input.operation],
        signal,
      })
      context.assertCurrent()
      const result = await identity.executeAcademicOperation({
        operation: input.operation,
        request: input.request,
        signal,
      })
      context.assertCurrent()
      return result
    }, {
      operationRef: input.operationRef,
      signals: input.signal ? [input.signal] : undefined,
    })
  }

  async function applyReadiness(readiness: StudyProductionReadinessWire): Promise<void> {
    if (!readinessIsCurrent(readiness, now())) await cancel('authorization-loss')
  }

  return Object.freeze({
    launch,
    execute,
    cancel,
    applyReadiness,
    snapshot,
    isReady: () => snapshot().status === 'ready',
  })
}
