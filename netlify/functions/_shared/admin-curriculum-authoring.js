import { createClient } from '@supabase/supabase-js'
import { validateCurriculumDraftEntity } from '../../../src/admin/curriculum-authoring/contracts.ts'

const TIMEOUT_MS = 5_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/
const REF = /^[a-z0-9][a-z0-9:-]{2,127}$/
const HASH = /^[0-9a-f]{64}$/
const ENTITY_TYPES = new Set(['course', 'unit', 'lesson', 'assessment', 'media_resource'])
const ORIGINS = new Set(['base_override', 'draft_created'])
const COLLABORATOR_RESPONSIBILITIES = new Set(['editor', 'reviewer'])

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

function timestamp(value) {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))
}

function integer(value, minimum = 0) {
  return Number.isSafeInteger(value) && value >= minimum
}

function exactKeys(value, keys) {
  return record(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

function entity(value) {
  const keys = ['entityType', 'entityRef', 'origin', 'revision', 'position', 'tombstoned', 'digest', 'createdAt', 'updatedAt']
  if (
    !exactKeys(value, keys)
    || !ENTITY_TYPES.has(value.entityType)
    || typeof value.entityRef !== 'string' || !REF.test(value.entityRef)
    || !ORIGINS.has(value.origin)
    || !integer(value.revision, 1) || !integer(value.position)
    || typeof value.tombstoned !== 'boolean'
    || typeof value.digest !== 'string' || !HASH.test(value.digest)
    || !timestamp(value.createdAt) || !timestamp(value.updatedAt)
  ) return null
  return Object.freeze({ ...value })
}

function draft(value) {
  const keys = ['schemaVersion', 'draftId', 'baseReleaseVersion', 'targetVersion', 'authoringSchemaVersion', 'lifecycleState', 'revision', 'createdAt', 'updatedAt']
  if (
    !exactKeys(value, keys) || value.schemaVersion !== 1
    || typeof value.draftId !== 'string' || !UUID.test(value.draftId)
    || typeof value.baseReleaseVersion !== 'string' || !VERSION.test(value.baseReleaseVersion)
    || typeof value.targetVersion !== 'string' || !VERSION.test(value.targetVersion)
    || value.authoringSchemaVersion !== '2.0.0' || value.lifecycleState !== 'draft'
    || !integer(value.revision, 1) || !timestamp(value.createdAt) || !timestamp(value.updatedAt)
  ) return null
  return Object.freeze({ ...value })
}

function adaptList(value) {
  if (!exactKeys(value, ['schemaVersion', 'drafts']) || value.schemaVersion !== 1 || !Array.isArray(value.drafts) || value.drafts.length > 1_000) return null
  const drafts = value.drafts.map(draft)
  return drafts.some((item) => item === null) ? null : Object.freeze({ schemaVersion: 1, drafts: Object.freeze(drafts) })
}

function adaptDraft(value) {
  if (!record(value) || !Array.isArray(value.entities) || value.entities.length > 10_000) return null
  const { entities, ...summaryValue } = value
  const summary = draft(summaryValue)
  const projectedEntities = entities.map(entity)
  if (!summary || projectedEntities.some((item) => item === null)) return null
  return Object.freeze({ ...summary, entities: Object.freeze(projectedEntities) })
}

function adaptEntity(value) {
  if (!record(value) || value.schemaVersion !== 1 || typeof value.draftId !== 'string' || !UUID.test(value.draftId) || !record(value.payload)) return null
  const { schemaVersion, draftId, payload, ...summaryValue } = value
  const summary = entity(summaryValue)
  if (!summary) return null
  const validation = validateCurriculumDraftEntity(summary.entityType, summary.entityRef, payload)
  return validation.success
    ? Object.freeze({ schemaVersion, draftId, ...summary, payload: Object.freeze(validation.payload) })
    : null
}

function adaptMutation(value) {
  if (
    !record(value) || value.schemaVersion !== 1 || typeof value.replayed !== 'boolean'
    || typeof value.draftId !== 'string' || !UUID.test(value.draftId)
    || !integer(value.draftRevision, 1)
    || Object.keys(value).some((key) => !['schemaVersion', 'replayed', 'draftId', 'draftRevision', 'entity'].includes(key))
  ) return null
  const projectedEntity = value.entity === undefined ? undefined : entity(value.entity)
  if (value.entity !== undefined && !projectedEntity) return null
  return Object.freeze({ ...value, ...(projectedEntity ? { entity: projectedEntity } : {}) })
}

function collaborator(value) {
  const keys = [
    'principalRef', 'responsibility', 'status', 'assignmentRevision',
    'assignedAt', 'revokedAt',
  ]
  if (
    !exactKeys(value, keys)
    || typeof value.principalRef !== 'string' || !UUID.test(value.principalRef)
    || !COLLABORATOR_RESPONSIBILITIES.has(value.responsibility)
    || !['active', 'revoked'].includes(value.status)
    || !integer(value.assignmentRevision, 1)
    || !timestamp(value.assignedAt)
    || (value.revokedAt !== null && !timestamp(value.revokedAt))
    || (value.status === 'active' && (value.assignmentRevision !== 1 || value.revokedAt !== null))
    || (value.status === 'revoked' && (value.assignmentRevision !== 2 || value.revokedAt === null))
  ) return null
  return Object.freeze({ ...value })
}

function adaptCollaborators(value) {
  if (
    !exactKeys(value, [
      'schemaVersion', 'draftId', 'draftRevision', 'currentResponsibility',
      'collaborators',
    ])
    || value.schemaVersion !== 1
    || typeof value.draftId !== 'string' || !UUID.test(value.draftId)
    || !integer(value.draftRevision, 1)
    || !COLLABORATOR_RESPONSIBILITIES.has(value.currentResponsibility)
    || !Array.isArray(value.collaborators) || value.collaborators.length > 1_000
  ) return null
  const projected = value.collaborators.map(collaborator)
  if (projected.some((item) => item === null || item.status !== 'active')) return null
  return Object.freeze({ ...value, collaborators: Object.freeze(projected) })
}

function adaptCollaboratorMutation(value) {
  if (
    !exactKeys(value, [
      'schemaVersion', 'replayed', 'draftId', 'draftRevision', 'collaborator',
    ])
    || value.schemaVersion !== 1 || typeof value.replayed !== 'boolean'
    || typeof value.draftId !== 'string' || !UUID.test(value.draftId)
    || !integer(value.draftRevision, 1)
  ) return null
  const projected = collaborator(value.collaborator)
  return projected ? Object.freeze({ ...value, collaborator: projected }) : null
}

function unavailable(error) {
  const message = error && typeof error === 'object' && typeof error.message === 'string' ? error.message : ''
  const known = [
    ['CURRICULUM_DRAFT_NOT_FOUND', 'not-found'],
    ['CURRICULUM_ENTITY_NOT_FOUND', 'not-found'],
    ['CURRICULUM_COLLABORATOR_NOT_FOUND', 'not-found'],
    ['CURRICULUM_COLLABORATION_REQUIRED', 'forbidden'],
    ['CURRICULUM_COLLABORATOR_PRINCIPAL_INVALID', 'verified-principal'],
    ['CURRICULUM_COLLABORATOR_LAST_EDITOR', 'last-editor'],
    ['CURRICULUM_COLLABORATOR_EXISTS', 'already-assigned'],
    ['CURRICULUM_CAS_CONFLICT', 'conflict'],
    ['CURRICULUM_REPLAY_CONFLICT', 'replay-conflict'],
    ['CURRICULUM_ENTITY_EXISTS', 'conflict'],
    ['CURRICULUM_DRAFT_INPUT_INVALID', 'invalid'],
    ['CURRICULUM_ENTITY_INPUT_INVALID', 'invalid'],
    ['CURRICULUM_COLLABORATOR_INPUT_INVALID', 'invalid'],
    ['CURRICULUM_BASE_RELEASE_INVALID', 'invalid'],
  ]
  const match = known.find(([marker]) => message.includes(marker))
  return Object.assign(new Error('curriculum_authoring_unavailable'), { code: match?.[1] ?? 'unavailable' })
}

export function createAdminCurriculumAuthoringService({ env, fetchImpl, client } = {}) {
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

  async function call(name, args, adapt, missingIsNotFound = false) {
    const target = getClient()
    if (!target) throw unavailable()
    const signal = AbortSignal.timeout(TIMEOUT_MS)
    try {
      const { data, error } = await target.rpc(name, args).abortSignal(signal)
      if (signal.aborted || error) throw unavailable(error)
      if (missingIsNotFound && data === null) throw Object.assign(new Error('missing'), { code: 'not-found' })
      const projected = adapt(data)
      if (!projected) throw unavailable()
      return projected
    } catch (error) {
      if (error?.code) throw error
      throw unavailable(error)
    }
  }

  return Object.freeze({
    list(actorUserRef) {
      return call('academy_admin_list_curriculum_drafts_v1', {
        p_actor_user_ref: actorUserRef, p_required_capability: 'curriculum:read',
      }, adaptList)
    },
    read(actorUserRef, draftId) {
      return call('academy_admin_read_curriculum_draft_v1', {
        p_actor_user_ref: actorUserRef, p_draft_id: draftId, p_required_capability: 'curriculum:read',
      }, adaptDraft, true)
    },
    readEntity(actorUserRef, draftId, entityType, entityRef) {
      return call('academy_admin_read_curriculum_draft_entity_v1', {
        p_actor_user_ref: actorUserRef, p_draft_id: draftId, p_entity_type: entityType,
        p_entity_ref: entityRef, p_required_capability: 'curriculum:read',
      }, adaptEntity, true)
    },
    createDraft(actorUserRef, input) {
      return call('academy_admin_create_curriculum_draft_v1', {
        p_actor_user_ref: actorUserRef, p_base_release_version: input.baseReleaseVersion,
        p_target_version: input.targetVersion, p_authoring_schema_version: input.authoringSchemaVersion,
        p_request_id: input.idempotencyKey, p_request_digest: input.requestDigest,
        p_required_capability: 'curriculum:drafts:write',
      }, adaptMutation)
    },
    createEntity(actorUserRef, input) {
      return call('academy_admin_create_curriculum_draft_entity_v1', {
        p_actor_user_ref: actorUserRef, p_draft_id: input.draftId, p_entity_type: input.entityType,
        p_entity_ref: input.entityRef, p_origin: input.origin, p_position: input.position,
        p_payload: input.payload, p_payload_digest: input.payloadDigest,
        p_expected_draft_revision: input.expectedDraftRevision, p_request_id: input.idempotencyKey,
        p_request_digest: input.requestDigest, p_required_capability: 'curriculum:drafts:write',
      }, adaptMutation)
    },
    updateEntity(actorUserRef, input) {
      return call('academy_admin_update_curriculum_draft_entity_v1', {
        p_actor_user_ref: actorUserRef, p_draft_id: input.draftId, p_entity_type: input.entityType,
        p_entity_ref: input.entityRef, p_position: input.position, p_payload: input.payload,
        p_payload_digest: input.payloadDigest, p_expected_revision: input.expectedRevision,
        p_expected_draft_revision: input.expectedDraftRevision, p_request_id: input.idempotencyKey,
        p_request_digest: input.requestDigest, p_required_capability: 'curriculum:drafts:write',
      }, adaptMutation)
    },
    tombstoneEntity(actorUserRef, input) {
      return call('academy_admin_tombstone_curriculum_draft_entity_v1', {
        p_actor_user_ref: actorUserRef, p_draft_id: input.draftId, p_entity_type: input.entityType,
        p_entity_ref: input.entityRef, p_expected_revision: input.expectedRevision,
        p_expected_draft_revision: input.expectedDraftRevision, p_request_id: input.idempotencyKey,
        p_request_digest: input.requestDigest, p_required_capability: 'curriculum:drafts:write',
      }, adaptMutation)
    },
    listCollaborators(actorUserRef, draftId) {
      return call('academy_admin_list_curriculum_draft_collaborators_v1', {
        p_actor_user_ref: actorUserRef, p_draft_id: draftId,
        p_required_capability: 'curriculum:read',
      }, adaptCollaborators)
    },
    addCollaborator(actorUserRef, input) {
      return call('academy_admin_add_curriculum_draft_collaborator_v1', {
        p_actor_user_ref: actorUserRef, p_draft_id: input.draftId,
        p_principal_user_ref: input.principalRef,
        p_responsibility: input.responsibility,
        p_expected_draft_revision: input.expectedDraftRevision,
        p_request_id: input.idempotencyKey,
        p_request_digest: input.requestDigest,
        p_required_capability: 'curriculum:drafts:write',
      }, adaptCollaboratorMutation)
    },
    revokeCollaborator(actorUserRef, input) {
      return call('academy_admin_revoke_curriculum_draft_collaborator_v1', {
        p_actor_user_ref: actorUserRef, p_draft_id: input.draftId,
        p_principal_user_ref: input.principalRef,
        p_expected_draft_revision: input.expectedDraftRevision,
        p_request_id: input.idempotencyKey,
        p_request_digest: input.requestDigest,
        p_required_capability: 'curriculum:drafts:write',
      }, adaptCollaboratorMutation)
    },
  })
}
