import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const TIMEOUT_MS = 30_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HASH = /^[0-9a-f]{64}$/
const VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/
const STAGE_STATES = new Set(['blocked', 'eligible', 'staged'])
const BLOCKING_REASONS = new Set([
  'validation_missing',
  'validation_blocked',
  'approval_missing',
  'approval_stale',
  'changes_requested',
  'target_version_collision',
  'revision_mismatch',
  'schema_set_unsupported',
])
const SNAPSHOT_COLLECTIONS = Object.freeze([
  'courses',
  'units',
  'lessons',
  'assessments',
  'assessment_interpretations',
  'schedules',
  'standard_frameworks',
  'resources',
  'policy_sets',
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

function hash(value) {
  return typeof value === 'string' && HASH.test(value)
}

function counts(value) {
  if (!record(value) || Object.keys(value).length > 20) return null
  for (const [key, count] of Object.entries(value)) {
    if (!/^[a-z][a-z_]{0,39}$/.test(key) || !integer(count)) return null
  }
  return Object.freeze({ ...value })
}

function candidate(value) {
  const keys = [
    'stagingId', 'status', 'publicationStatus', 'validationSnapshotId', 'approvalId',
    'entityCounts', 'fileCount', 'byteCount', 'contentHash', 'manifestHash',
    'packageHash', 'stagedAt', 'authority',
  ]
  const projectedCounts = counts(value?.entityCounts)
  if (
    !exactKeys(value, keys)
    || typeof value.stagingId !== 'string' || !UUID.test(value.stagingId)
    || value.status !== 'staged' || !['not_published', 'published'].includes(value.publicationStatus)
    || typeof value.validationSnapshotId !== 'string' || !UUID.test(value.validationSnapshotId)
    || typeof value.approvalId !== 'string' || !UUID.test(value.approvalId)
    || !projectedCounts || !integer(value.fileCount, 1) || !integer(value.byteCount, 1)
    || !hash(value.contentHash) || !hash(value.manifestHash) || !hash(value.packageHash)
    || !timestamp(value.stagedAt) || value.authority !== 'curriculum:publish'
  ) return null
  return Object.freeze({ ...value, entityCounts: projectedCounts })
}

function status(value) {
  const keys = [
    'schemaVersion', 'draftId', 'draftRevision', 'baseReleaseVersion', 'targetVersion',
    'schemaSetVersion', 'stageState', 'eligible', 'blockingReasons', 'validation',
    'approval', 'candidate',
  ]
  if (
    !exactKeys(value, keys) || value.schemaVersion !== 1
    || typeof value.draftId !== 'string' || !UUID.test(value.draftId)
    || !integer(value.draftRevision, 1)
    || typeof value.baseReleaseVersion !== 'string' || !VERSION.test(value.baseReleaseVersion)
    || typeof value.targetVersion !== 'string' || !VERSION.test(value.targetVersion)
    || value.schemaSetVersion !== '2.0.0'
    || !STAGE_STATES.has(value.stageState) || typeof value.eligible !== 'boolean'
    || !Array.isArray(value.blockingReasons) || value.blockingReasons.length > 16
    || value.blockingReasons.some((reason) => !BLOCKING_REASONS.has(reason))
    || (value.validation !== null && !exactKeys(value.validation, ['status', 'validationSnapshotId']))
    || (value.approval !== null && !exactKeys(value.approval, ['status', 'approvalId']))
  ) return null
  if (
    value.validation !== null
    && (!['valid', 'invalid', 'incomplete', 'unavailable', 'error'].includes(value.validation.status)
      || typeof value.validation.validationSnapshotId !== 'string'
      || !UUID.test(value.validation.validationSnapshotId))
  ) return null
  if (
    value.approval !== null
    && (!['approved', 'changes_requested', 'stale'].includes(value.approval.status)
      || (value.approval.approvalId !== null
        && (typeof value.approval.approvalId !== 'string' || !UUID.test(value.approval.approvalId))))
  ) return null
  const projectedCandidate = value.candidate === null ? null : candidate(value.candidate)
  if (value.candidate !== null && !projectedCandidate) return null
  if (
    (value.stageState === 'staged') !== (projectedCandidate !== null)
    || value.eligible !== (value.stageState === 'eligible')
    || (value.stageState === 'blocked') !== (value.blockingReasons.length > 0)
  ) return null
  return Object.freeze({
    ...value,
    blockingReasons: Object.freeze([...value.blockingReasons]),
    validation: value.validation === null ? null : Object.freeze({ ...value.validation }),
    approval: value.approval === null ? null : Object.freeze({ ...value.approval }),
    candidate: projectedCandidate,
  })
}

function mutation(value) {
  if (!record(value) || typeof value.replayed !== 'boolean') return null
  const { replayed, ...statusValue } = value
  const projected = status(statusValue)
  return projected ? Object.freeze({ ...projected, replayed }) : null
}

function unavailable(error) {
  const message = error && typeof error === 'object' && typeof error.message === 'string' ? error.message : ''
  const known = [
    ['CURRICULUM_STAGING_NOT_FOUND', 'not-found'],
    ['CURRICULUM_STAGING_REQUIRED', 'forbidden'],
    ['CURRICULUM_STAGING_GATE_BLOCKED', 'gate-blocked'],
    ['CURRICULUM_STAGING_TARGET_COLLISION', 'target-collision'],
    ['CURRICULUM_STAGING_REVISION_CONFLICT', 'revision-conflict'],
    ['CURRICULUM_STAGING_REPLAY_CONFLICT', 'replay-conflict'],
    ['CURRICULUM_STAGING_PACKAGE_CONFLICT', 'package-conflict'],
    ['CURRICULUM_STAGING_INPUT_INVALID', 'invalid'],
  ]
  const match = known.find(([marker]) => message.includes(marker))
  return Object.assign(new Error('curriculum_staging_unavailable'), { code: match?.[1] ?? 'unavailable' })
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!record(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value))
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function artifact(relativePath, content) {
  const canonicalContent = canonicalJson(content)
  return Object.freeze({
    relativePath,
    byteCount: Buffer.byteLength(canonicalContent, 'utf8'),
    sha256: sha256(canonicalContent),
    canonicalContent,
  })
}

/**
 * Freezes the complete Schema v2 snapshot. Operational timestamps are kept out
 * of every content hash; approval and validation identities remain in the
 * deterministic staging manifest.
 */
export function buildCurriculumStagedCandidate({ draft, snapshot, approval }) {
  if (
    !draft || !snapshot || !approval?.publishGate?.eligible
    || approval.publishGate.draftRevision !== draft.revision
    || approval.draftRevision !== draft.revision
    || approval.schemaSetVersion !== draft.authoringSchemaVersion
    || approval.targetVersion !== draft.targetVersion
    || approval.baseReleaseVersion !== draft.baseReleaseVersion
    || !approval.publishGate.approvalId
    || !approval.publishGate.validationSnapshotId
    || approval.currentDecision?.approvalId !== approval.publishGate.approvalId
    || approval.latestValidation?.validationSnapshotId !== approval.publishGate.validationSnapshotId
  ) throw Object.assign(new Error('curriculum_staging_gate_blocked'), { code: 'gate-blocked' })

  const artifacts = [artifact('snapshot/manifest.json', snapshot.manifest)]
  const entityCounts = {}
  for (const collection of SNAPSHOT_COLLECTIONS) {
    const values = snapshot[collection]
    if (!Array.isArray(values)) throw Object.assign(new Error('curriculum_staging_input_invalid'), { code: 'invalid' })
    entityCounts[collection] = values.length
    artifacts.push(artifact(`snapshot/${collection}.json`, values))
  }
  artifacts.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  const byteCount = artifacts.reduce((total, entry) => total + entry.byteCount, 0)
  const contentHash = sha256(artifacts.map((entry) => (
    `${entry.relativePath}\u0000${entry.byteCount}\u0000${entry.sha256}\n`
  )).join(''))
  const manifest = Object.freeze({
    schemaVersion: 1,
    packageFormat: 'manuel-academy-curriculum-staged-v1',
    releaseIdentity: Object.freeze({
      packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
      version: draft.targetVersion,
    }),
    baseReleaseVersion: draft.baseReleaseVersion,
    targetVersion: draft.targetVersion,
    schemaSetVersion: draft.authoringSchemaVersion,
    draft: Object.freeze({ id: draft.draftId, revision: draft.revision }),
    validation: Object.freeze({
      id: approval.publishGate.validationSnapshotId,
      resultDigest: approval.latestValidation.resultDigest,
    }),
    approval: Object.freeze({ id: approval.publishGate.approvalId }),
    entityCounts: Object.freeze(entityCounts),
    fileCount: artifacts.length,
    byteCount,
    files: Object.freeze(artifacts.map(({ relativePath, byteCount: bytes, sha256: digest }) => Object.freeze({
      relativePath, byteCount: bytes, sha256: digest,
    }))),
    contentHash,
  })
  const manifestCanonical = canonicalJson(manifest)
  const manifestHash = sha256(manifestCanonical)
  const packageHash = sha256(`manuel-academy-curriculum-staged-v1\n${contentHash}\n${manifestHash}\n`)
  return Object.freeze({
    draftId: draft.draftId,
    draftRevision: draft.revision,
    baseReleaseVersion: draft.baseReleaseVersion,
    targetVersion: draft.targetVersion,
    schemaSetVersion: draft.authoringSchemaVersion,
    validationSnapshotId: approval.publishGate.validationSnapshotId,
    validationResultDigest: approval.latestValidation.resultDigest,
    approvalId: approval.publishGate.approvalId,
    entityCounts: Object.freeze(entityCounts),
    fileCount: artifacts.length,
    byteCount,
    contentHash,
    manifest,
    manifestCanonical,
    manifestHash,
    packageHash,
    artifacts: Object.freeze(artifacts),
  })
}

export function createAdminCurriculumStagingPersistence({ env, fetchImpl, client } = {}) {
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
      return call('academy_admin_read_curriculum_staging_v1', {
        p_actor_user_ref: actorUserRef,
        p_draft_id: draftId,
        p_required_capability: 'curriculum:read',
      }, status)
    },
    stage(actorUserRef, candidateValue, idempotencyKey) {
      const request = {
        ...candidateValue,
        idempotencyKey,
      }
      const requestDigest = sha256(canonicalJson(request))
      return call('academy_admin_stage_curriculum_release_v1', {
        p_actor_user_ref: actorUserRef,
        p_draft_id: candidateValue.draftId,
        p_draft_revision: candidateValue.draftRevision,
        p_validation_snapshot_id: candidateValue.validationSnapshotId,
        p_approval_id: candidateValue.approvalId,
        p_manifest: candidateValue.manifest,
        p_manifest_canonical: candidateValue.manifestCanonical,
        p_artifacts: candidateValue.artifacts.map((entry) => ({
          relativePath: entry.relativePath,
          byteCount: entry.byteCount,
          sha256: entry.sha256,
          canonicalContent: entry.canonicalContent,
        })),
        p_content_sha256: candidateValue.contentHash,
        p_manifest_sha256: candidateValue.manifestHash,
        p_package_sha256: candidateValue.packageHash,
        p_request_id: idempotencyKey,
        p_request_digest: requestDigest,
        p_required_capability: 'curriculum:publish',
      }, mutation)
    },
  })
}

export const adminCurriculumStagingInternals = Object.freeze({ artifact, candidate, status, mutation, sha256 })
