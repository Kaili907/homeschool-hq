import { createClient } from '@supabase/supabase-js'

const TIMEOUT_MS = 5_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REVIEW_KEY = /^csr-[0-9a-f]{16}$/
const FINDING_ID = /^cvf-[0-9a-f]{16}$/
const STATES = new Set(['in_review', 'approved_mapping', 'rejected_mapping', 'needs_evidence'])

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

function exactKeys(value, keys) {
  return record(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

function timestamp(value) {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))
}

function nullableText(value) {
  return value === null || typeof value === 'string'
}

function decision(value) {
  const keys = [
    'schemaVersion', 'reviewKey', 'contextKind', 'contextRef', 'sourceLabel', 'grade',
    'courseRef', 'findingRule', 'affectedCount', 'findingIds', 'status',
    'canonicalStandardId', 'frameworkVersion', 'canonicalTitle', 'evidenceSource',
    'reviewerNote', 'revision', 'updatedAt',
  ]
  if (
    !exactKeys(value, keys) || value.schemaVersion !== 1
    || typeof value.reviewKey !== 'string' || !REVIEW_KEY.test(value.reviewKey)
    || !['published_release', 'draft'].includes(value.contextKind)
    || typeof value.contextRef !== 'string' || value.contextRef.length > 128
    || typeof value.sourceLabel !== 'string' || value.sourceLabel.length > 240
    || !Number.isSafeInteger(value.grade) || value.grade < 0 || value.grade > 12
    || typeof value.courseRef !== 'string' || value.findingRule !== 'standards.human_review_required'
    || !Number.isSafeInteger(value.affectedCount) || value.affectedCount < 1 || value.affectedCount > 1000
    || !Array.isArray(value.findingIds) || value.findingIds.length !== value.affectedCount
    || value.findingIds.some((findingId) => typeof findingId !== 'string' || !FINDING_ID.test(findingId))
    || !STATES.has(value.status)
    || !nullableText(value.canonicalStandardId) || !nullableText(value.frameworkVersion)
    || !nullableText(value.canonicalTitle) || !nullableText(value.evidenceSource)
    || !nullableText(value.reviewerNote)
    || !Number.isSafeInteger(value.revision) || value.revision < 1
    || !timestamp(value.updatedAt)
  ) return null
  return Object.freeze({ ...value, findingIds: Object.freeze([...value.findingIds]) })
}

function adaptList(value) {
  if (!exactKeys(value, ['schemaVersion', 'decisions']) || value.schemaVersion !== 1 || !Array.isArray(value.decisions) || value.decisions.length > 10_000) return null
  const decisions = value.decisions.map(decision)
  return decisions.some((item) => item === null) ? null : Object.freeze({ schemaVersion: 1, decisions: Object.freeze(decisions) })
}

function adaptMutation(value) {
  if (!exactKeys(value, ['schemaVersion', 'replayed', 'decision']) || value.schemaVersion !== 1 || typeof value.replayed !== 'boolean') return null
  const projected = decision(value.decision)
  return projected ? Object.freeze({ schemaVersion: 1, replayed: value.replayed, decision: projected }) : null
}

function unavailable(error) {
  const message = error && typeof error === 'object' && typeof error.message === 'string' ? error.message : ''
  const known = [
    ['CURRICULUM_STANDARDS_REVIEW_EVIDENCE_REQUIRED', 'invalid'],
    ['CURRICULUM_STANDARDS_REVIEW_INPUT_INVALID', 'invalid'],
    ['CURRICULUM_STANDARDS_REVIEW_CAS_CONFLICT', 'conflict'],
    ['CURRICULUM_STANDARDS_REVIEW_IDENTITY_CONFLICT', 'conflict'],
    ['CURRICULUM_STANDARDS_REVIEW_REPLAY_CONFLICT', 'replay-conflict'],
  ]
  const match = known.find(([marker]) => message.includes(marker))
  return Object.assign(new Error('curriculum_standards_review_unavailable'), { code: match?.[1] ?? 'unavailable' })
}

export function createAdminCurriculumStandardsReviewService({ env, fetchImpl, client } = {}) {
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
    list(actorUserRef, contextKind, contextRef) {
      return call('academy_admin_list_curriculum_standard_reviews_v1', {
        p_actor_user_ref: actorUserRef,
        p_context_kind: contextKind,
        p_context_ref: contextRef,
        p_required_capability: 'curriculum:read',
      }, adaptList)
    },
    update(actorUserRef, input) {
      return call('academy_admin_update_curriculum_standard_review_v1', {
        p_actor_user_ref: actorUserRef,
        p_review_key: input.reviewKey,
        p_context_kind: input.contextKind,
        p_context_ref: input.contextRef,
        p_source_label: input.sourceLabel,
        p_grade: input.grade,
        p_course_ref: input.courseRef,
        p_finding_rule: input.findingRule,
        p_finding_ids: input.findingIds,
        p_affected_count: input.affectedCount,
        p_status: input.status,
        p_canonical_standard_id: input.canonicalStandardId,
        p_framework_version: input.frameworkVersion,
        p_canonical_title: input.canonicalTitle,
        p_evidence_source: input.evidenceSource,
        p_reviewer_note: input.reviewerNote,
        p_expected_revision: input.expectedRevision,
        p_request_id: input.idempotencyKey,
        p_request_digest: input.requestDigest,
        p_required_capability: input.status === 'approved_mapping' ? 'curriculum:approve' : 'curriculum:drafts:write',
      }, adaptMutation)
    },
  })
}
