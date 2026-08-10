import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const TIMEOUT_MS = 10_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/
const HASH = /^[0-9a-f]{64}$/
const KINDS = new Set(['migration_seed', 'activation', 'rollback'])

function config(env) {
  const rawUrl = (env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || '').trim()
  const serviceRoleKey = (env?.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || url.username || url.password || !serviceRoleKey) return null
    return { url: url.toString().replace(/\/+$/, ''), serviceRoleKey }
  } catch {
    return null
  }
}

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exact(value, keys) {
  return record(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key))
}

function integer(value, minimum = 0) {
  return Number.isSafeInteger(value) && value >= minimum
}

function timestamp(value) {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))
}

function pointer(value) {
  if (
    !exact(value, ['releaseVersion', 'revision', 'transitionKind', 'bindingMode', 'transitionedAt'])
    || typeof value.releaseVersion !== 'string' || !VERSION.test(value.releaseVersion)
    || !integer(value.revision, 1) || !KINDS.has(value.transitionKind)
    || !['registry_only', 'default_authority'].includes(value.bindingMode)
    || !timestamp(value.transitionedAt)
    || (value.transitionKind === 'migration_seed') !== (value.bindingMode === 'registry_only')
  ) return null
  return Object.freeze({ ...value })
}

function candidate(value) {
  if (
    !exact(value, [
      'releaseVersion', 'status', 'registeredAt', 'artifactState',
      'eligible', 'previouslyActive', 'active',
    ])
    || typeof value.releaseVersion !== 'string' || !VERSION.test(value.releaseVersion)
    || value.status !== 'published' || !timestamp(value.registeredAt)
    || !['available', 'unavailable'].includes(value.artifactState)
    || typeof value.eligible !== 'boolean'
    || typeof value.previouslyActive !== 'boolean' || typeof value.active !== 'boolean'
    || value.eligible !== (value.artifactState === 'available')
  ) return null
  return Object.freeze({ ...value })
}

function historyEntry(value) {
  if (
    !exact(value, [
      'pointerRevision', 'previousReleaseVersion', 'newReleaseVersion',
      'transitionKind', 'reasonCode', 'correlationId', 'transitionedAt',
    ])
    || !integer(value.pointerRevision, 1)
    || (value.previousReleaseVersion !== null
      && (typeof value.previousReleaseVersion !== 'string' || !VERSION.test(value.previousReleaseVersion)))
    || typeof value.newReleaseVersion !== 'string' || !VERSION.test(value.newReleaseVersion)
    || !KINDS.has(value.transitionKind) || !timestamp(value.transitionedAt)
  ) return null
  if (value.transitionKind === 'migration_seed') {
    if (value.pointerRevision !== 1 || value.previousReleaseVersion !== null
      || value.reasonCode !== null || value.correlationId !== null) return null
  } else if (
    value.reasonCode !== `release.${value.transitionKind === 'activation' ? 'activated' : 'rolled_back'}`
    || typeof value.correlationId !== 'string' || !UUID.test(value.correlationId)
    || value.previousReleaseVersion === null
  ) return null
  return Object.freeze({ ...value })
}

function status(value) {
  if (
    !exact(value, [
      'schemaVersion', 'environment', 'authority', 'existingLearnersRepinned',
      'pointer', 'candidates', 'history', 'historyTruncated',
    ])
    || value.schemaVersion !== 1 || value.environment !== 'production'
    || value.authority !== 'default_current_curriculum'
    || value.existingLearnersRepinned !== false
    || typeof value.historyTruncated !== 'boolean'
    || !Array.isArray(value.candidates) || value.candidates.length > 1_000
    || !Array.isArray(value.history) || value.history.length > 100
  ) return null
  const projectedPointer = pointer(value.pointer)
  const candidates = value.candidates.map(candidate)
  const history = value.history.map(historyEntry)
  if (!projectedPointer || candidates.some((item) => item === null) || history.some((item) => item === null)) return null
  if (candidates.filter((item) => item.active).length !== 1
    || !candidates.some((item) => item.active && item.releaseVersion === projectedPointer.releaseVersion)
    || history[0]?.pointerRevision !== projectedPointer.revision) return null
  return Object.freeze({
    schemaVersion: 1,
    environment: 'production',
    authority: 'default_current_curriculum',
    existingLearnersRepinned: false,
    pointer: projectedPointer,
    candidates: Object.freeze(candidates),
    history: Object.freeze(history),
    historyTruncated: value.historyTruncated,
  })
}

function transition(value) {
  if (
    !exact(value, [
      'state', 'transitionKind', 'previousReleaseVersion', 'newReleaseVersion',
      'pointerRevision', 'correlationId',
    ])
    || !['transitioned', 'no_op'].includes(value.state)
    || !['activation', 'rollback'].includes(value.transitionKind)
    || typeof value.previousReleaseVersion !== 'string' || !VERSION.test(value.previousReleaseVersion)
    || typeof value.newReleaseVersion !== 'string' || !VERSION.test(value.newReleaseVersion)
    || !integer(value.pointerRevision, 1)
    || typeof value.correlationId !== 'string' || !UUID.test(value.correlationId)
    || (value.state === 'no_op') !== (value.previousReleaseVersion === value.newReleaseVersion)
  ) return null
  return Object.freeze({ ...value })
}

function mutation(value) {
  if (!record(value) || typeof value.replayed !== 'boolean' || !record(value.transition)) return null
  const { replayed, transition: transitionValue, ...statusValue } = value
  const projectedStatus = status(statusValue)
  const projectedTransition = transition(transitionValue)
  if (!projectedStatus || !projectedTransition
    || projectedStatus.pointer.revision !== projectedTransition.pointerRevision
    || projectedStatus.pointer.releaseVersion !== projectedTransition.newReleaseVersion) return null
  return Object.freeze({ ...projectedStatus, transition: projectedTransition, replayed })
}

function unavailable(error) {
  const message = error && typeof error === 'object' && typeof error.message === 'string'
    ? error.message : ''
  const known = [
    ['CURRICULUM_ACTIVATION_REQUIRED', 'forbidden'],
    ['CURRICULUM_ACTIVATION_INPUT_INVALID', 'invalid'],
    ['CURRICULUM_ACTIVATION_REPLAY_CONFLICT', 'replay-conflict'],
    ['CURRICULUM_ACTIVATION_POINTER_CONFLICT', 'pointer-conflict'],
    ['CURRICULUM_ACTIVATION_TARGET_NOT_PUBLISHED', 'target-not-published'],
    ['CURRICULUM_ACTIVATION_TARGET_NOT_FOUND', 'target-not-found'],
    ['CURRICULUM_ACTIVATION_ARTIFACTS_UNAVAILABLE', 'artifacts-unavailable'],
    ['CURRICULUM_ACTIVATION_KIND_CONFLICT', 'kind-conflict'],
    ['CURRICULUM_ACTIVATION_POINTER_UNAVAILABLE', 'unavailable'],
  ]
  const match = known.find(([marker]) => message.includes(marker))
  return Object.assign(new Error('curriculum_activation_unavailable'), {
    code: match?.[1] ?? 'unavailable',
  })
}

function canonicalRequest(input) {
  return JSON.stringify({
    targetReleaseVersion: input.targetReleaseVersion,
    expectedPointerRevision: input.expectedPointerRevision,
    transitionKind: input.transitionKind,
    reasonCode: input.reasonCode,
    idempotencyKey: input.idempotencyKey,
  })
}

export function createAdminCurriculumActivationPersistence({ env, fetchImpl, client } = {}) {
  let database = client
  function getClient() {
    if (database) return database
    const resolved = config(env)
    if (!resolved) return null
    database = createClient(resolved.url, resolved.serviceRoleKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
    return database
  }

  async function call(name, args, adapt) {
    const target = getClient()
    if (!target) throw unavailable()
    const signal = AbortSignal.timeout(TIMEOUT_MS)
    try {
      const { data, error } = await target.rpc(name, args).abortSignal(signal)
      if (signal.aborted || error) throw unavailable(error)
      const projected = adapt(data)
      if (!projected) throw unavailable()
      return projected
    } catch (error) {
      if (error?.code) throw error
      throw unavailable(error)
    }
  }

  return Object.freeze({
    read(actorUserRef) {
      return call('academy_admin_read_curriculum_activation_v1', {
        p_actor_user_ref: actorUserRef,
        p_required_capability: 'curriculum:read',
      }, status)
    },
    transition(actorUserRef, input) {
      const requestDigest = createHash('sha256').update(canonicalRequest(input)).digest('hex')
      return call('academy_admin_transition_curriculum_pointer_v1', {
        p_actor_user_ref: actorUserRef,
        p_target_version: input.targetReleaseVersion,
        p_expected_pointer_revision: input.expectedPointerRevision,
        p_transition_kind: input.transitionKind,
        p_reason_code: input.reasonCode,
        p_request_id: input.idempotencyKey,
        p_request_digest: requestDigest,
        p_required_capability: 'releases:manage',
      }, mutation)
    },
  })
}

export const adminCurriculumActivationInternals = Object.freeze({
  candidate, historyEntry, mutation, pointer, status, transition,
})
