import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const TIMEOUT_MS = 30_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HASH = /^[0-9a-f]{64}$/
const VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/
const STATES = new Set(['not_staged', 'blocked', 'eligible', 'published'])
const BLOCKERS = new Set([
  'staged_candidate_missing',
  'staging_identity_mismatch',
  'artifact_set_incomplete',
  'artifact_tampered',
  'manifest_mismatch',
  'package_mismatch',
  'approval_stale',
  'validation_blocked',
  'human_review_blocked',
  'target_version_collision',
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

function exactKeys(value, keys) {
  return record(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

function integer(value, minimum = 0) {
  return Number.isSafeInteger(value) && value >= minimum
}

function timestamp(value) {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))
}

function digest(value) {
  return typeof value === 'string' && HASH.test(value)
}

function verification(value) {
  const keys = [
    'artifactSetComplete', 'contentVerified', 'manifestVerified', 'packageVerified',
    'actualFileCount', 'actualByteCount',
  ]
  if (
    !exactKeys(value, keys)
    || typeof value.artifactSetComplete !== 'boolean'
    || typeof value.contentVerified !== 'boolean'
    || typeof value.manifestVerified !== 'boolean'
    || typeof value.packageVerified !== 'boolean'
    || !integer(value.actualFileCount)
    || !integer(value.actualByteCount)
  ) return null
  return Object.freeze({ ...value })
}

function candidate(value) {
  const keys = [
    'stagingId', 'status', 'draftRevision', 'validationSnapshotId', 'validationStatus',
    'approvalId', 'approvalStatus', 'humanReviewStatus', 'fileCount', 'byteCount',
    'contentHash', 'manifestHash', 'packageHash', 'verification',
  ]
  const checked = verification(value?.verification)
  if (
    !exactKeys(value, keys)
    || typeof value.stagingId !== 'string' || !UUID.test(value.stagingId)
    || value.status !== 'staged' || !integer(value.draftRevision, 1)
    || typeof value.validationSnapshotId !== 'string' || !UUID.test(value.validationSnapshotId)
    || !['publication_ready', 'blocked'].includes(value.validationStatus)
    || typeof value.approvalId !== 'string' || !UUID.test(value.approvalId)
    || !['current', 'stale'].includes(value.approvalStatus)
    || !['clear', 'blocked'].includes(value.humanReviewStatus)
    || !integer(value.fileCount, 1) || !integer(value.byteCount, 1)
    || !digest(value.contentHash) || !digest(value.manifestHash) || !digest(value.packageHash)
    || !checked
  ) return null
  return Object.freeze({ ...value, verification: checked })
}

function published(value) {
  const keys = [
    'releaseId', 'version', 'status', 'activationStatus', 'stagingId',
    'contentHash', 'manifestHash', 'packageHash', 'fileCount', 'byteCount',
    'publishedAt', 'authority',
  ]
  if (
    !exactKeys(value, keys)
    || typeof value.releaseId !== 'string' || !UUID.test(value.releaseId)
    || typeof value.version !== 'string' || !VERSION.test(value.version)
    || value.status !== 'published' || value.activationStatus !== 'not_active'
    || typeof value.stagingId !== 'string' || !UUID.test(value.stagingId)
    || !digest(value.contentHash) || !digest(value.manifestHash) || !digest(value.packageHash)
    || !integer(value.fileCount, 1) || !integer(value.byteCount, 1)
    || !timestamp(value.publishedAt) || value.authority !== 'curriculum:publish'
  ) return null
  return Object.freeze({ ...value })
}

function status(value) {
  const keys = [
    'schemaVersion', 'draftId', 'draftRevision', 'baseReleaseVersion', 'targetVersion',
    'schemaSetVersion', 'publicationState', 'eligible', 'blockingReasons',
    'candidate', 'published',
  ]
  if (
    !exactKeys(value, keys) || value.schemaVersion !== 1
    || typeof value.draftId !== 'string' || !UUID.test(value.draftId)
    || !integer(value.draftRevision, 1)
    || typeof value.baseReleaseVersion !== 'string' || !VERSION.test(value.baseReleaseVersion)
    || typeof value.targetVersion !== 'string' || !VERSION.test(value.targetVersion)
    || value.schemaSetVersion !== '2.0.0'
    || !STATES.has(value.publicationState) || typeof value.eligible !== 'boolean'
    || !Array.isArray(value.blockingReasons) || value.blockingReasons.length > 16
    || value.blockingReasons.some((reason) => !BLOCKERS.has(reason))
  ) return null
  const checkedCandidate = value.candidate === null ? null : candidate(value.candidate)
  const checkedPublished = value.published === null ? null : published(value.published)
  if (value.candidate !== null && !checkedCandidate) return null
  if (value.published !== null && !checkedPublished) return null
  if (
    value.eligible !== (value.publicationState === 'eligible')
    || (value.publicationState === 'not_staged') !== (checkedCandidate === null)
    || (value.publicationState === 'published') !== (checkedPublished !== null)
    || (value.publicationState === 'blocked') !== (value.blockingReasons.length > 0 && checkedCandidate !== null)
    || (checkedPublished !== null && checkedCandidate?.stagingId !== checkedPublished.stagingId)
  ) return null
  return Object.freeze({
    ...value,
    blockingReasons: Object.freeze([...value.blockingReasons]),
    candidate: checkedCandidate,
    published: checkedPublished,
  })
}

function mutation(value) {
  if (!record(value) || typeof value.replayed !== 'boolean') return null
  const { replayed, ...statusValue } = value
  const checked = status(statusValue)
  return checked ? Object.freeze({ ...checked, replayed }) : null
}

function unavailable(error) {
  const message = error && typeof error === 'object' && typeof error.message === 'string' ? error.message : ''
  const known = [
    ['CURRICULUM_PUBLICATION_NOT_FOUND', 'not-found'],
    ['CURRICULUM_PUBLICATION_REQUIRED', 'forbidden'],
    ['CURRICULUM_PUBLICATION_ARTIFACT_INVALID', 'artifact-invalid'],
    ['CURRICULUM_PUBLICATION_MANIFEST_MISMATCH', 'manifest-mismatch'],
    ['CURRICULUM_PUBLICATION_PACKAGE_MISMATCH', 'package-mismatch'],
    ['CURRICULUM_PUBLICATION_APPROVAL_STALE', 'approval-stale'],
    ['CURRICULUM_PUBLICATION_VALIDATION_BLOCKED', 'validation-blocked'],
    ['CURRICULUM_PUBLICATION_HUMAN_REVIEW_BLOCKED', 'human-review-blocked'],
    ['CURRICULUM_PUBLICATION_TARGET_COLLISION', 'target-collision'],
    ['CURRICULUM_PUBLICATION_REVISION_CONFLICT', 'revision-conflict'],
    ['CURRICULUM_PUBLICATION_REPLAY_CONFLICT', 'replay-conflict'],
    ['CURRICULUM_PUBLICATION_INPUT_INVALID', 'invalid'],
    ['CURRICULUM_PUBLICATION_GATE_BLOCKED', 'gate-blocked'],
  ]
  const match = known.find(([marker]) => message.includes(marker))
  return Object.assign(new Error('curriculum_publication_unavailable'), { code: match?.[1] ?? 'unavailable' })
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function createAdminCurriculumPublishingPersistence({ env, fetchImpl, client } = {}) {
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
    read(actorUserRef, draftId) {
      return call('academy_admin_read_curriculum_publication_v1', {
        p_actor_user_ref: actorUserRef,
        p_draft_id: draftId,
        p_required_capability: 'curriculum:read',
      }, status)
    },
    publish(actorUserRef, stagingId, idempotencyKey) {
      const requestDigest = sha256(JSON.stringify({ stagingId, idempotencyKey }))
      return call('academy_admin_publish_curriculum_release_v1', {
        p_actor_user_ref: actorUserRef,
        p_staging_id: stagingId,
        p_request_id: idempotencyKey,
        p_request_digest: requestDigest,
        p_required_capability: 'curriculum:publish',
      }, mutation)
    },
  })
}

export const adminCurriculumPublishingInternals = Object.freeze({ candidate, published, status, mutation })
