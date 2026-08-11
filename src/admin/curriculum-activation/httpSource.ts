import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import { withAdminDependencyTimeout } from '../adminDependencyTimeout'
import {
  CurriculumActivationError,
  type CurriculumActivationCandidate,
  type CurriculumActivationHistoryEntry,
  type CurriculumActivationInput,
  type CurriculumActivationMutationResult,
  type CurriculumActivationPointer,
  type CurriculumActivationSource,
  type CurriculumActivationStatus,
  type CurriculumActivationTransitionResult,
} from './contracts'

type FetchLike = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>
const VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key))
}

function integer(value: unknown, minimum = 0): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))
}

function pointer(value: unknown): CurriculumActivationPointer | null {
  if (!exact(value, ['releaseVersion', 'revision', 'transitionKind', 'bindingMode', 'transitionedAt'])
    || typeof value.releaseVersion !== 'string' || !VERSION.test(value.releaseVersion)
    || !integer(value.revision, 1)
    || !['migration_seed', 'activation', 'rollback'].includes(String(value.transitionKind))
    || !['registry_only', 'default_authority'].includes(String(value.bindingMode))
    || !timestamp(value.transitionedAt)) return null
  if ((value.transitionKind === 'migration_seed') !== (value.bindingMode === 'registry_only')) return null
  return Object.freeze(value as unknown as CurriculumActivationPointer)
}

function candidate(value: unknown): CurriculumActivationCandidate | null {
  if (!exact(value, [
    'releaseVersion', 'status', 'registeredAt', 'artifactState',
    'eligible', 'previouslyActive', 'active',
  ]) || typeof value.releaseVersion !== 'string' || !VERSION.test(value.releaseVersion)
    || value.status !== 'published' || !timestamp(value.registeredAt)
    || !['available', 'unavailable'].includes(String(value.artifactState))
    || typeof value.eligible !== 'boolean' || typeof value.previouslyActive !== 'boolean'
    || typeof value.active !== 'boolean'
    || value.eligible !== (value.artifactState === 'available')) return null
  return Object.freeze(value as unknown as CurriculumActivationCandidate)
}

function historyEntry(value: unknown): CurriculumActivationHistoryEntry | null {
  if (!exact(value, [
    'pointerRevision', 'previousReleaseVersion', 'newReleaseVersion',
    'transitionKind', 'reasonCode', 'correlationId', 'transitionedAt',
  ]) || !integer(value.pointerRevision, 1)
    || (value.previousReleaseVersion !== null
      && (typeof value.previousReleaseVersion !== 'string' || !VERSION.test(value.previousReleaseVersion)))
    || typeof value.newReleaseVersion !== 'string' || !VERSION.test(value.newReleaseVersion)
    || !['migration_seed', 'activation', 'rollback'].includes(String(value.transitionKind))
    || !timestamp(value.transitionedAt)) return null
  if (value.transitionKind === 'migration_seed') {
    if (value.pointerRevision !== 1 || value.previousReleaseVersion !== null
      || value.reasonCode !== null || value.correlationId !== null) return null
  } else {
    const reason = value.transitionKind === 'activation' ? 'release.activated' : 'release.rolled_back'
    if (value.reasonCode !== reason || typeof value.correlationId !== 'string'
      || !UUID.test(value.correlationId) || value.previousReleaseVersion === null) return null
  }
  return Object.freeze(value as unknown as CurriculumActivationHistoryEntry)
}

export function parseCurriculumActivationStatus(value: unknown): CurriculumActivationStatus {
  if (!exact(value, [
    'schemaVersion', 'environment', 'authority', 'existingLearnersRepinned',
    'pointer', 'candidates', 'history', 'historyTruncated',
  ]) || value.schemaVersion !== 1 || value.environment !== 'production'
    || value.authority !== 'default_current_curriculum'
    || value.existingLearnersRepinned !== false || typeof value.historyTruncated !== 'boolean'
    || !Array.isArray(value.candidates) || value.candidates.length > 1_000
    || !Array.isArray(value.history) || value.history.length > 100) {
    throw new CurriculumActivationError('unavailable')
  }
  const projectedPointer = pointer(value.pointer)
  const candidates = value.candidates.map(candidate)
  const history = value.history.map(historyEntry)
  if (!projectedPointer || candidates.some((item) => item === null)
    || history.some((item) => item === null)
    || candidates.filter((item) => item?.active).length !== 1
    || !candidates.some((item) => item?.active
      && item.releaseVersion === projectedPointer.releaseVersion)
    || history[0]?.pointerRevision !== projectedPointer.revision) {
    throw new CurriculumActivationError('unavailable')
  }
  return Object.freeze({
    schemaVersion: 1,
    environment: 'production',
    authority: 'default_current_curriculum',
    existingLearnersRepinned: false,
    pointer: projectedPointer,
    candidates: Object.freeze(candidates as CurriculumActivationCandidate[]),
    history: Object.freeze(history as CurriculumActivationHistoryEntry[]),
    historyTruncated: value.historyTruncated,
  })
}

function transition(value: unknown): CurriculumActivationTransitionResult | null {
  if (!exact(value, [
    'state', 'transitionKind', 'previousReleaseVersion', 'newReleaseVersion',
    'pointerRevision', 'correlationId',
  ]) || !['transitioned', 'no_op'].includes(String(value.state))
    || !['activation', 'rollback'].includes(String(value.transitionKind))
    || typeof value.previousReleaseVersion !== 'string' || !VERSION.test(value.previousReleaseVersion)
    || typeof value.newReleaseVersion !== 'string' || !VERSION.test(value.newReleaseVersion)
    || !integer(value.pointerRevision, 1)
    || typeof value.correlationId !== 'string' || !UUID.test(value.correlationId)
    || ((value.state === 'no_op') !== (value.previousReleaseVersion === value.newReleaseVersion))) return null
  return Object.freeze(value as unknown as CurriculumActivationTransitionResult)
}

export function parseCurriculumActivationMutation(value: unknown): CurriculumActivationMutationResult {
  if (!record(value) || typeof value.replayed !== 'boolean' || !record(value.transition)) {
    throw new CurriculumActivationError('unavailable')
  }
  const { replayed, transition: rawTransition, ...rawStatus } = value
  const status = parseCurriculumActivationStatus(rawStatus)
  const projectedTransition = transition(rawTransition)
  if (!projectedTransition || status.pointer.revision !== projectedTransition.pointerRevision
    || status.pointer.releaseVersion !== projectedTransition.newReleaseVersion) {
    throw new CurriculumActivationError('unavailable')
  }
  return Object.freeze({ ...status, transition: projectedTransition, replayed })
}

function failure(status: number, responseCode?: string): CurriculumActivationError {
  if (status === 401) return new CurriculumActivationError('unauthenticated')
  if (status === 403) return new CurriculumActivationError('forbidden')
  if ([400, 413, 415, 422].includes(status)) return new CurriculumActivationError('invalid')
  if (status === 404) return new CurriculumActivationError('not-found')
  if (status === 409) {
    const reasons: Record<string, CurriculumActivationError['reason']> = {
      pointer_revision_conflict: 'pointer-conflict',
      idempotency_conflict: 'idempotency-conflict',
      target_not_published: 'target-not-published',
      release_artifacts_unavailable: 'artifacts-unavailable',
      transition_kind_conflict: 'kind-conflict',
    }
    return new CurriculumActivationError('conflict', reasons[responseCode ?? ''])
  }
  return new CurriculumActivationError('unavailable')
}

export function createCurriculumActivationHttpSource(
  fetchImpl: FetchLike = fetch,
  getAccessToken: () => Promise<string | null> = getGatewayAccessToken,
  path = '/api/admin/curriculum/activation',
  timeoutMs = 10_000,
): CurriculumActivationSource {
  const boundedToken = () => withAdminDependencyTimeout(() => getAccessToken(), timeoutMs)
  const boundedFetch: FetchLike = (input, init) => withAdminDependencyTimeout(
    (signal) => fetchImpl(input, { ...init, signal }), timeoutMs,
  )
  async function request(method: 'GET' | 'POST', body?: CurriculumActivationInput): Promise<unknown> {
    let token: string | null
    try {
      token = await boundedToken()
    } catch {
      throw new CurriculumActivationError('unavailable')
    }
    if (!token) throw new CurriculumActivationError('unauthenticated')
    let response: Pick<Response, 'ok' | 'status' | 'json'>
    try {
      response = await boundedFetch(path, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      })
    } catch {
      throw new CurriculumActivationError('unavailable')
    }
    if (!response.ok) {
      let responseCode: string | undefined
      try {
        const envelope = await response.json() as { error?: { code?: unknown } }
        if (typeof envelope?.error?.code === 'string') responseCode = envelope.error.code
      } catch {
        // The status remains authoritative if an intermediary strips the body.
      }
      throw failure(response.status, responseCode)
    }
    try {
      return await response.json()
    } catch {
      throw new CurriculumActivationError('unavailable')
    }
  }

  return Object.freeze({
    read: async () => parseCurriculumActivationStatus(await request('GET')),
    transition: async (input: CurriculumActivationInput) => parseCurriculumActivationMutation(
      await request('POST', input),
    ),
  })
}
