import { createHash } from 'node:crypto'
import { createAdminAuthorization } from './_shared/admin-authorization.js'
import { createAdminCurriculumAuthoringService } from './_shared/admin-curriculum-authoring.js'
import { createAdminCurriculumRegistryReader } from './_shared/admin-curriculum-registry-reader.js'
import { createAdminCurriculumStudioService } from './_shared/admin-curriculum-studio.js'
import { createAdminCurriculumPreviewService } from './_shared/admin-curriculum-preview.js'
import {
  assertExactObject,
  boundedInteger,
  errorResponse,
  hasQuery,
  jsonResponse,
  readJsonBody,
} from './_shared/http.js'
import { createFilesystemCurriculumSource } from '../../src/admin/curriculum/filesystemSource.node.ts'
import {
  CURRICULUM_AUTHORING_SCHEMA_VERSION,
  CURRICULUM_DRAFT_ENTITY_TYPES,
  validateCurriculumDraftEntity,
} from '../../src/admin/curriculum-authoring/contracts.ts'
import { loadAdminCurriculumValidationEvidence } from './_shared/admin-curriculum-evidence.js'

const API_PREFIX = '/api/admin/curriculum/'
const FUNCTION_PREFIX = '/.netlify/functions/admin-curriculum/'
const LESSON_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const RELEASE_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/
const TARGET_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ENTITY_REF = /^[a-z0-9][a-z0-9:-]{2,127}$/
const ENTITY_TYPES = new Set(CURRICULUM_DRAFT_ENTITY_TYPES)
const MAX_BODY_BYTES = 1_100_000

function decode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function draftRoute(resource) {
  const segments = resource.split('/')
  if (segments[0] !== 'drafts') return null
  if (segments.length === 1) return { kind: 'drafts' }
  const draftId = decode(segments[1])
  if (!draftId || !UUID.test(draftId)) return null
  if (segments.length === 2) return { kind: 'draft', draftId }
  if (
    segments.length === 4
    && (segments[2] === 'materialization' || segments[2] === 'validation' || segments[2] === 'preview')
    && /^[1-9][0-9]{0,14}$/.test(segments[3])
  ) {
    return {
      kind: segments[2] === 'materialization'
        ? 'draft-materialization'
        : segments[2] === 'validation' ? 'draft-validation' : 'draft-preview',
      draftId,
      revision: Number(segments[3]),
    }
  }
  if (segments[2] !== 'entities') return null
  if (segments.length === 3) return { kind: 'draft-entities', draftId }
  const entityType = decode(segments[3])
  const entityRef = segments.length > 4 ? decode(segments[4]) : null
  if (!entityType || !ENTITY_TYPES.has(entityType) || !entityRef || !ENTITY_REF.test(entityRef)) return null
  if (segments.length === 5) return { kind: 'draft-entity', draftId, entityType, entityRef }
  if (segments.length === 6 && segments[5] === 'tombstone') {
    return { kind: 'draft-entity-tombstone', draftId, entityType, entityRef }
  }
  return null
}

function routeFromPath(path) {
  if (typeof path !== 'string') return null
  const prefix = path.startsWith(API_PREFIX)
    ? API_PREFIX
    : path.startsWith(FUNCTION_PREFIX)
      ? FUNCTION_PREFIX
      : null
  if (!prefix) return null
  const resource = path.slice(prefix.length)
  const authoringRoute = draftRoute(resource)
  if (authoringRoute) return authoringRoute
  if (resource === 'catalog') return { kind: 'catalog' }
  if (resource === 'validation') return { kind: 'validation' }
  if (resource === 'releases') return { kind: 'releases' }
  if (resource === 'production-pointer') return { kind: 'production-pointer' }
  if (resource.startsWith('releases/')) {
    try {
      const segments = resource.split('/').map(decodeURIComponent)
      const version = segments[1]
      if (!RELEASE_VERSION.test(version)) return null
      if (segments.length === 2) return { kind: 'release', version }
      if (segments.length === 3 && segments[2] === 'authoring-index') {
        return { kind: 'release-authoring-index', version }
      }
      if (
        segments.length === 6
        && segments[2] === 'authoring'
        && segments[3] === 'entities'
        && ENTITY_TYPES.has(segments[4])
        && ENTITY_REF.test(segments[5])
      ) {
        return {
          kind: 'release-authoring-entity',
          version,
          entityType: segments[4],
          entityRef: segments[5],
        }
      }
      return null
    } catch {
      return null
    }
  }
  if (!resource.startsWith('lessons/')) return null
  try {
    const lessonRef = decodeURIComponent(resource.slice('lessons/'.length))
    return LESSON_REF.test(lessonRef) ? { kind: 'lesson', lessonRef } : null
  } catch {
    return null
  }
}

function requestHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function uuid(value) {
  if (typeof value !== 'string' || !UUID.test(value)) throw Object.assign(new Error('invalid_request'), { request: true })
  return value.toLowerCase()
}

function version(value, pattern) {
  if (typeof value !== 'string' || !pattern.test(value)) throw Object.assign(new Error('invalid_request'), { request: true })
  return value
}

function exactBody(event, required) {
  return assertExactObject(readJsonBody(event, MAX_BODY_BYTES), required)
}

function parseCreateDraft(event) {
  const body = exactBody(event, ['baseReleaseVersion', 'targetVersion', 'authoringSchemaVersion', 'idempotencyKey'])
  const input = {
    baseReleaseVersion: version(body.baseReleaseVersion, RELEASE_VERSION),
    targetVersion: version(body.targetVersion, TARGET_VERSION),
    authoringSchemaVersion: body.authoringSchemaVersion,
    idempotencyKey: uuid(body.idempotencyKey),
  }
  if (input.authoringSchemaVersion !== CURRICULUM_AUTHORING_SCHEMA_VERSION) {
    throw Object.assign(new Error('schema_v2_rejected'), { schema: true })
  }
  return { ...input, requestDigest: requestHash(input) }
}

function parseCreateEntity(event, draftId) {
  const body = exactBody(event, [
    'entityType', 'entityRef', 'origin', 'position', 'payload',
    'expectedDraftRevision', 'idempotencyKey',
  ])
  if (!ENTITY_TYPES.has(body.entityType) || typeof body.entityRef !== 'string' || !ENTITY_REF.test(body.entityRef)) {
    throw Object.assign(new Error('invalid_request'), { request: true })
  }
  if (!['base_override', 'draft_created'].includes(body.origin)) {
    throw Object.assign(new Error('invalid_request'), { request: true })
  }
  const validation = validateCurriculumDraftEntity(body.entityType, body.entityRef, body.payload)
  if (!validation.success) throw Object.assign(new Error('schema_v2_rejected'), { schema: true })
  const input = {
    draftId,
    entityType: body.entityType,
    entityRef: body.entityRef,
    origin: body.origin,
    position: boundedInteger(body.position, 0, 1_000_000_000),
    payload: validation.payload,
    expectedDraftRevision: boundedInteger(body.expectedDraftRevision, 1, Number.MAX_SAFE_INTEGER),
    idempotencyKey: uuid(body.idempotencyKey),
  }
  return { ...input, payloadDigest: requestHash(input.payload), requestDigest: requestHash(input) }
}

function parseUpdateEntity(event, route) {
  const body = exactBody(event, [
    'payload', 'position', 'expectedRevision', 'expectedDraftRevision', 'idempotencyKey',
  ])
  const validation = validateCurriculumDraftEntity(route.entityType, route.entityRef, body.payload)
  if (!validation.success) throw Object.assign(new Error('schema_v2_rejected'), { schema: true })
  const input = {
    draftId: route.draftId,
    entityType: route.entityType,
    entityRef: route.entityRef,
    position: boundedInteger(body.position, 0, 1_000_000_000),
    payload: validation.payload,
    expectedRevision: boundedInteger(body.expectedRevision, 1, Number.MAX_SAFE_INTEGER),
    expectedDraftRevision: boundedInteger(body.expectedDraftRevision, 1, Number.MAX_SAFE_INTEGER),
    idempotencyKey: uuid(body.idempotencyKey),
  }
  return { ...input, payloadDigest: requestHash(input.payload), requestDigest: requestHash(input) }
}

function parseTombstone(event, route) {
  const body = exactBody(event, ['expectedRevision', 'expectedDraftRevision', 'idempotencyKey'])
  const input = {
    draftId: route.draftId,
    entityType: route.entityType,
    entityRef: route.entityRef,
    expectedRevision: boundedInteger(body.expectedRevision, 1, Number.MAX_SAFE_INTEGER),
    expectedDraftRevision: boundedInteger(body.expectedDraftRevision, 1, Number.MAX_SAFE_INTEGER),
    idempotencyKey: uuid(body.idempotencyKey),
  }
  return { ...input, requestDigest: requestHash(input) }
}

function authoringMethod(route, method) {
  if (route.kind === 'drafts') return method === 'GET' || method === 'POST'
  if (route.kind === 'draft') return method === 'GET'
  if (route.kind === 'draft-entities') return method === 'POST'
  if (route.kind === 'draft-entity') return method === 'GET' || method === 'PUT'
  if (route.kind === 'draft-entity-tombstone') return method === 'POST'
  if (route.kind === 'draft-materialization' || route.kind === 'draft-validation' || route.kind === 'draft-preview') return method === 'GET'
  return false
}

function serviceError(error) {
  if (error?.code === 'not-found') return errorResponse(404, 'curriculum_draft_unavailable')
  if (error?.code === 'conflict' || error?.code === 'replay-conflict') return errorResponse(409, error.code === 'replay-conflict' ? 'idempotency_conflict' : 'revision_conflict')
  if (error?.code === 'invalid') return errorResponse(400, 'invalid_request')
  return errorResponse(503, 'curriculum_authoring_unavailable')
}

export function createAdminCurriculumHandler(overrides = {}) {
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env: overrides.env ?? process.env,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    client: overrides.client,
    authVerifier: overrides.authVerifier,
  })
  const source = overrides.source ?? {
    ...createFilesystemCurriculumSource(),
    loadValidationEvidence: loadAdminCurriculumValidationEvidence,
  }
  const registry = overrides.registry ?? createAdminCurriculumRegistryReader({
    env: overrides.env ?? process.env,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    client: overrides.registryClient,
  })
  const authoring = overrides.authoring ?? createAdminCurriculumAuthoringService({
    env: overrides.env ?? process.env,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    client: overrides.authoringClient,
  })
  const studio = overrides.studio ?? createAdminCurriculumStudioService({ authoring })
  const preview = overrides.preview ?? createAdminCurriculumPreviewService({ authoring })

  return async (event) => {
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')
    const route = routeFromPath(event?.path)
    if (!route) return errorResponse(404, 'not_found')

    if (route.kind.startsWith('draft')) {
      if (!authoringMethod(route, event?.httpMethod)) return errorResponse(405, 'method_not_allowed')
      const writing = event.httpMethod !== 'GET'
      const authorized = await authorization.require(
        event,
        writing ? 'curriculum:drafts:write' : 'curriculum:read',
      )
      if (!authorized.ok) return authorized.response
      try {
        const actor = authorized.principal.userId
        const value = route.kind === 'drafts' && event.httpMethod === 'GET'
          ? await authoring.list(actor)
          : route.kind === 'drafts'
            ? await authoring.createDraft(actor, parseCreateDraft(event))
            : route.kind === 'draft'
              ? await authoring.read(actor, route.draftId)
              : route.kind === 'draft-entities'
                ? await authoring.createEntity(actor, parseCreateEntity(event, route.draftId))
                : route.kind === 'draft-entity' && event.httpMethod === 'GET'
                  ? await authoring.readEntity(actor, route.draftId, route.entityType, route.entityRef)
                  : route.kind === 'draft-materialization'
                    ? await studio.readMaterialization(actor, route.draftId, route.revision)
                    : route.kind === 'draft-validation'
                      ? await studio.validateDraft(actor, route.draftId, route.revision)
                      : route.kind === 'draft-preview'
                        ? await preview.read(actor, route.draftId, route.revision)
                  : route.kind === 'draft-entity'
                    ? await authoring.updateEntity(actor, parseUpdateEntity(event, route))
                    : await authoring.tombstoneEntity(actor, parseTombstone(event, route))
        return jsonResponse(writing && value.replayed === false && (route.kind === 'drafts' || route.kind === 'draft-entities') ? 201 : 200, value)
      } catch (error) {
        if (error?.schema) return errorResponse(422, 'schema_v2_rejected')
        if (error?.request || error?.name === 'GatewayError') return errorResponse(400, 'invalid_request')
        return serviceError(error)
      }
    }

    if (event?.httpMethod !== 'GET') return errorResponse(405, 'method_not_allowed', { allow: 'GET' })

    const authorized = await authorization.require(event, 'curriculum:read')
    if (!authorized.ok) return authorized.response
    try {
      const value = route.kind === 'catalog'
        ? await source.loadCatalog()
        : route.kind === 'validation'
          ? await source.loadValidationEvidence()
          : route.kind === 'lesson'
            ? await source.loadLesson(route.lessonRef)
            : route.kind === 'releases'
              ? await registry.list()
            : route.kind === 'release'
                ? await registry.details(route.version)
                : route.kind === 'release-authoring-index'
                  ? await studio.readBaseIndex(route.version)
                  : route.kind === 'release-authoring-entity'
                    ? await studio.readBaseEntity(route.version, route.entityType, route.entityRef)
                : await registry.productionPointer()
      return jsonResponse(200, value)
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null
      if (code === 'not-found') return errorResponse(
        404,
        route.kind === 'release' || route.kind === 'release-authoring-index'
          ? 'curriculum_release_unavailable'
          : 'curriculum_record_unavailable',
      )
      return errorResponse(503, 'curriculum_source_unavailable')
    }
  }
}

export const handler = createAdminCurriculumHandler()
