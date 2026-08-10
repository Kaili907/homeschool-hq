import { createClient } from '@supabase/supabase-js'

const TIMEOUT_MS = 5_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HASH = /^[0-9a-f]{64}$/
const VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/
const VALIDATION_STATUSES = new Set(['valid', 'invalid', 'incomplete', 'unavailable', 'error'])
const APPROVAL_STATUSES = new Set(['pending_review', 'approved', 'changes_requested', 'stale'])
const DECISIONS = new Set(['approved', 'changes_requested'])
const REASONS = new Set([
  'approval.ready', 'changes.validation', 'changes.standards',
  'changes.content_quality', 'changes.references', 'changes.accessibility',
  'changes.safety_privacy', 'changes.other',
])
const GATE_REASONS = new Set([
  'approved', 'approval_missing', 'approval_stale', 'changes_requested',
  'validation_missing', 'validation_blocked',
])

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

function integer(value, minimum = 0) {
  return Number.isSafeInteger(value) && value >= minimum
}

function timestamp(value) {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))
}

function exactKeys(value, keys) {
  return record(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

function validation(value) {
  const keys = [
    'validationSnapshotId', 'draftRevision', 'engineVersion', 'resultDigest',
    'status', 'publicationReady', 'blockingCount', 'blockingErrorCount',
    'humanReviewBlockerCount', 'validatedAt',
  ]
  if (
    !exactKeys(value, keys)
    || typeof value.validationSnapshotId !== 'string' || !UUID.test(value.validationSnapshotId)
    || !integer(value.draftRevision, 1)
    || typeof value.engineVersion !== 'string' || value.engineVersion.length < 1 || value.engineVersion.length > 80
    || typeof value.resultDigest !== 'string' || !HASH.test(value.resultDigest)
    || !VALIDATION_STATUSES.has(value.status)
    || typeof value.publicationReady !== 'boolean'
    || !integer(value.blockingCount) || !integer(value.blockingErrorCount)
    || !integer(value.humanReviewBlockerCount) || !timestamp(value.validatedAt)
  ) return null
  return Object.freeze({ ...value })
}

function decision(value) {
  const keys = [
    'approvalId', 'draftRevision', 'decision', 'reasonCode',
    'validationSnapshotId', 'validationResultDigest', 'reviewerRole',
    'decidedAt', 'bindingStatus',
  ]
  if (
    !exactKeys(value, keys)
    || typeof value.approvalId !== 'string' || !UUID.test(value.approvalId)
    || !integer(value.draftRevision, 1) || !DECISIONS.has(value.decision)
    || !REASONS.has(value.reasonCode)
    || (value.validationSnapshotId !== null && (typeof value.validationSnapshotId !== 'string' || !UUID.test(value.validationSnapshotId)))
    || (value.validationResultDigest !== null && (typeof value.validationResultDigest !== 'string' || !HASH.test(value.validationResultDigest)))
    || value.reviewerRole !== 'owner' || !timestamp(value.decidedAt)
    || !['current', 'superseded'].includes(value.bindingStatus)
  ) return null
  return Object.freeze({ ...value })
}

function approvalStatus(value, mutation = false) {
  const keys = [
    'schemaVersion', ...(mutation ? ['replayed'] : []), 'draftId', 'draftRevision',
    'baseReleaseVersion', 'targetVersion', 'schemaSetVersion', 'status',
    'latestValidation', 'currentDecision', 'staleApproval', 'history', 'publishGate',
  ]
  if (
    !exactKeys(value, keys) || value.schemaVersion !== 1
    || (mutation && typeof value.replayed !== 'boolean')
    || typeof value.draftId !== 'string' || !UUID.test(value.draftId)
    || !integer(value.draftRevision, 1)
    || typeof value.baseReleaseVersion !== 'string' || !VERSION.test(value.baseReleaseVersion)
    || typeof value.targetVersion !== 'string' || !VERSION.test(value.targetVersion)
    || value.schemaSetVersion !== '2.0.0' || !APPROVAL_STATUSES.has(value.status)
    || !Array.isArray(value.history) || value.history.length > 100
    || !record(value.publishGate)
  ) return null
  const latestValidation = value.latestValidation === null ? null : validation(value.latestValidation)
  const currentDecision = value.currentDecision === null ? null : decision(value.currentDecision)
  const staleApproval = value.staleApproval === null ? null : decision(value.staleApproval)
  const history = value.history.map(decision)
  const gate = value.publishGate
  if (
    (value.latestValidation !== null && !latestValidation)
    || (value.currentDecision !== null && !currentDecision)
    || (value.staleApproval !== null && !staleApproval)
    || history.some((item) => item === null)
    || !exactKeys(gate, ['eligible', 'reason', 'approvalId', 'draftRevision', 'validationSnapshotId'])
    || typeof gate.eligible !== 'boolean' || !GATE_REASONS.has(gate.reason)
    || (gate.approvalId !== null && (typeof gate.approvalId !== 'string' || !UUID.test(gate.approvalId)))
    || !integer(gate.draftRevision, 1)
    || (gate.validationSnapshotId !== null && (typeof gate.validationSnapshotId !== 'string' || !UUID.test(gate.validationSnapshotId)))
  ) return null
  return Object.freeze({
    ...value,
    latestValidation,
    currentDecision,
    staleApproval,
    history: Object.freeze(history),
    publishGate: Object.freeze({ ...gate }),
  })
}

function serviceError(error) {
  const message = error && typeof error === 'object' && typeof error.message === 'string' ? error.message : ''
  const known = [
    ['CURRICULUM_APPROVAL_REQUIRED', 'forbidden'],
    ['CURRICULUM_APPROVAL_DRAFT_NOT_FOUND', 'not-found'],
    ['CURRICULUM_APPROVAL_REPLAY_CONFLICT', 'replay-conflict'],
    ['CURRICULUM_APPROVAL_VALIDATION_BLOCKED', 'validation-blocked'],
    ['CURRICULUM_APPROVAL_TRANSITION_CONFLICT', 'decision-conflict'],
    ['CURRICULUM_APPROVAL_CAS_CONFLICT', 'conflict'],
    ['CURRICULUM_APPROVAL_INPUT_INVALID', 'invalid'],
  ]
  const match = known.find(([marker]) => message.includes(marker))
  return Object.assign(new Error('curriculum_approval_unavailable'), { code: match?.[1] ?? 'unavailable' })
}

export function createAdminCurriculumApprovalService({ env, fetchImpl, client } = {}) {
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
    if (!target) throw serviceError()
    const signal = AbortSignal.timeout(TIMEOUT_MS)
    try {
      const { data, error } = await target.rpc(name, args).abortSignal(signal)
      if (signal.aborted || error) throw serviceError(error)
      const projected = adapt(data)
      if (!projected) throw serviceError()
      return projected
    } catch (error) {
      if (error?.code) throw error
      throw serviceError(error)
    }
  }

  return Object.freeze({
    read(actorUserRef, draftId) {
      return call('academy_admin_read_curriculum_approval_v1', {
        p_actor_user_ref: actorUserRef,
        p_draft_id: draftId,
        p_required_capability: 'curriculum:read',
      }, (value) => approvalStatus(value))
    },
    recordValidation(actorUserRef, input) {
      return call('academy_admin_record_curriculum_validation_v1', {
        p_actor_user_ref: actorUserRef,
        p_draft_id: input.draftId,
        p_draft_revision: input.draftRevision,
        p_engine_version: input.engineVersion,
        p_result_digest: input.resultDigest,
        p_status: input.status,
        p_publication_ready: input.publicationReady,
        p_blocking_count: input.blockingCount,
        p_blocking_error_count: input.blockingErrorCount,
        p_human_review_blocker_count: input.humanReviewBlockerCount,
        p_required_capability: 'curriculum:read',
      }, validation)
    },
    decide(actorUserRef, input) {
      return call('academy_admin_decide_curriculum_approval_v1', {
        p_actor_user_ref: actorUserRef,
        p_draft_id: input.draftId,
        p_draft_revision: input.draftRevision,
        p_decision: input.decision,
        p_reason_code: input.reasonCode,
        p_validation_snapshot_id: input.validationSnapshotId,
        p_request_id: input.idempotencyKey,
        p_request_digest: input.requestDigest,
        p_required_capability: 'curriculum:approve',
      }, (value) => approvalStatus(value, true))
    },
  })
}

export const adminCurriculumApprovalAdapters = Object.freeze({ validation, approvalStatus })
