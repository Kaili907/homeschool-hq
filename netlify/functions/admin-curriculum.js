import { createHash } from 'node:crypto'
import { createAdminAuthorization } from './_shared/admin-authorization.js'
import { createAdminCurriculumAuthoringService } from './_shared/admin-curriculum-authoring.js'
import { createAdminCurriculumStandardsReviewService } from './_shared/admin-curriculum-standards-review.js'
import { createAdminCurriculumApprovalService } from './_shared/admin-curriculum-approval.js'
import {
  createAdminCurriculumIntegrityEvidenceReader,
  createAdminCurriculumIntegrityService,
} from './_shared/admin-curriculum-integrity.js'
import { createAdminCurriculumActivationPersistence } from './_shared/admin-curriculum-activation.js'
import { createAdminCurriculumRegistryReader } from './_shared/admin-curriculum-registry-reader.js'
import { createAdminCurriculumStagingPersistence } from './_shared/admin-curriculum-staging.js'
import { createAdminCurriculumPublishingPersistence } from './_shared/admin-curriculum-publishing.js'
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
import {
  CURRICULUM_APPROVAL_DECISIONS,
  CURRICULUM_APPROVAL_REASON_CODES,
} from '../../src/admin/curriculum-approval/contracts.ts'
import { loadAdminCurriculumValidationEvidence } from './_shared/admin-curriculum-evidence.js'

const API_PREFIX = '/api/admin/curriculum/'
const FUNCTION_PREFIX = '/.netlify/functions/admin-curriculum/'
const LESSON_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const RELEASE_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/
const TARGET_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ENTITY_REF = /^[a-z0-9][a-z0-9:-]{2,127}$/
const REVIEW_KEY = /^csr-[0-9a-f]{16}$/
const FINDING_ID = /^cvf-[0-9a-f]{16}$/
const ENTITY_TYPES = new Set(CURRICULUM_DRAFT_ENTITY_TYPES)
const APPROVAL_DECISIONS = new Set(CURRICULUM_APPROVAL_DECISIONS)
const APPROVAL_REASON_CODES = new Set(CURRICULUM_APPROVAL_REASON_CODES)
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
  if (segments[2] === 'collaborators') {
    if (segments.length === 3) return { kind: 'draft-collaborators', draftId }
    const principalRef = segments.length > 3 ? decode(segments[3]) : null
    if (
      segments.length === 5
      && segments[4] === 'revoke'
      && principalRef
      && UUID.test(principalRef)
    ) return { kind: 'draft-collaborator-revoke', draftId, principalRef: principalRef.toLowerCase() }
    return null
  }
  if (segments.length === 3 && segments[2] === 'approval') {
    return { kind: 'draft-approval', draftId }
  }
  if (segments.length === 3 && segments[2] === 'staging') {
    return { kind: 'draft-staging', draftId }
  }
  if (segments.length === 3 && segments[2] === 'publishing') {
    return { kind: 'draft-publishing', draftId }
  }
  if (
    segments.length === 4
    && segments[2] === 'standards-review'
    && /^[1-9][0-9]{0,14}$/.test(segments[3])
  ) return { kind: 'draft-standards-review', draftId, revision: Number(segments[3]) }
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
  if (resource === 'standards-reviews') return { kind: 'standards-reviews' }
  if (resource.startsWith('standards-reviews/')) {
    const segments = resource.split('/')
    if (segments.length !== 3 || !['published_release', 'draft'].includes(segments[1])) return null
    const contextRef = decode(segments[2])
    if (!contextRef || contextRef.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(contextRef)) return null
    return { kind: 'standards-review-list', contextKind: segments[1], contextRef }
  }
  const authoringRoute = draftRoute(resource)
  if (authoringRoute) return authoringRoute
  if (resource === 'catalog') return { kind: 'catalog' }
  if (resource === 'validation') return { kind: 'validation' }
  if (resource === 'integrity') return { kind: 'integrity' }
  if (resource === 'history') return { kind: 'history' }
  if (resource === 'activation') return { kind: 'activation' }
  if (resource === 'releases') return { kind: 'releases' }
  if (resource === 'production-pointer') return { kind: 'production-pointer' }
  if (resource.startsWith('releases/')) {
    try {
      const segments = resource.split('/').map(decodeURIComponent)
      const version = segments[1]
      if (!TARGET_VERSION.test(version)) return null
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

function boundedText(value, minimum, maximum, nullable = false) {
  if (nullable && value === null) return null
  if (
    typeof value !== 'string' || value.trim() !== value
    || value.length < minimum || value.length > maximum
    || /[\u0000-\u001f\u007f]/.test(value)
  ) throw Object.assign(new Error('invalid_request'), { request: true })
  return value
}

function parseStandardsReview(event) {
  const body = exactBody(event, [
    'reviewKey', 'contextKind', 'contextRef', 'sourceLabel', 'grade', 'courseRef',
    'findingRule', 'affectedCount', 'findingIds', 'status', 'canonicalStandardId',
    'frameworkVersion', 'canonicalTitle', 'evidenceSource', 'reviewerNote',
    'expectedRevision', 'idempotencyKey',
  ])
  if (
    typeof body.reviewKey !== 'string' || !REVIEW_KEY.test(body.reviewKey)
    || !['published_release', 'draft'].includes(body.contextKind)
    || typeof body.contextRef !== 'string' || body.contextRef.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(body.contextRef)
    || (body.contextKind === 'published_release' && !RELEASE_VERSION.test(body.contextRef))
    || (body.contextKind === 'draft' && !UUID.test(body.contextRef))
    || typeof body.courseRef !== 'string' || !ENTITY_REF.test(body.courseRef)
    || body.findingRule !== 'standards.human_review_required'
    || !Array.isArray(body.findingIds) || body.findingIds.length < 1 || body.findingIds.length > 1000
    || body.findingIds.some((findingId) => typeof findingId !== 'string' || !FINDING_ID.test(findingId))
    || new Set(body.findingIds).size !== body.findingIds.length
    || !['in_review', 'approved_mapping', 'rejected_mapping', 'needs_evidence'].includes(body.status)
  ) throw Object.assign(new Error('invalid_request'), { request: true })
  const input = {
    reviewKey: body.reviewKey,
    contextKind: body.contextKind,
    contextRef: body.contextRef,
    sourceLabel: boundedText(body.sourceLabel, 1, 240),
    grade: boundedInteger(body.grade, 0, 12),
    courseRef: body.courseRef,
    findingRule: body.findingRule,
    affectedCount: boundedInteger(body.affectedCount, 1, 1000),
    findingIds: body.findingIds,
    status: body.status,
    canonicalStandardId: boundedText(body.canonicalStandardId, 1, 160, true),
    frameworkVersion: boundedText(body.frameworkVersion, 1, 160, true),
    canonicalTitle: boundedText(body.canonicalTitle, 1, 500, true),
    evidenceSource: boundedText(body.evidenceSource, 8, 1000, true),
    reviewerNote: boundedText(body.reviewerNote, 1, 500, true),
    expectedRevision: boundedInteger(body.expectedRevision, 0, Number.MAX_SAFE_INTEGER),
    idempotencyKey: uuid(body.idempotencyKey),
  }
  if (input.affectedCount !== input.findingIds.length) {
    throw Object.assign(new Error('invalid_request'), { request: true })
  }
  const mappingValues = [input.canonicalStandardId, input.frameworkVersion, input.canonicalTitle, input.evidenceSource]
  if (input.status === 'approved_mapping') {
    if (mappingValues.some((value) => value === null) || !input.reviewerNote || input.reviewerNote.length < 8) {
      throw Object.assign(new Error('evidence_required'), { evidence: true })
    }
  } else if (mappingValues.some((value) => value !== null)) {
    throw Object.assign(new Error('invalid_request'), { request: true })
  } else if (['rejected_mapping', 'needs_evidence'].includes(input.status) && (!input.reviewerNote || input.reviewerNote.length < 8)) {
    throw Object.assign(new Error('evidence_required'), { evidence: true })
  }
  return { ...input, requestDigest: requestHash(input) }
}

function parseAddCollaborator(event, draftId) {
  const body = exactBody(event, [
    'principalRef', 'responsibility', 'expectedDraftRevision', 'idempotencyKey',
  ])
  if (!['editor', 'reviewer'].includes(body.responsibility)) {
    throw Object.assign(new Error('invalid_request'), { request: true })
  }
  const input = {
    draftId,
    principalRef: uuid(body.principalRef),
    responsibility: body.responsibility,
    expectedDraftRevision: boundedInteger(body.expectedDraftRevision, 1, Number.MAX_SAFE_INTEGER),
    idempotencyKey: uuid(body.idempotencyKey),
  }
  return { ...input, requestDigest: requestHash(input) }
}

function parseRevokeCollaborator(event, route) {
  const body = exactBody(event, ['expectedDraftRevision', 'idempotencyKey'])
  const input = {
    draftId: route.draftId,
    principalRef: route.principalRef,
    expectedDraftRevision: boundedInteger(body.expectedDraftRevision, 1, Number.MAX_SAFE_INTEGER),
    idempotencyKey: uuid(body.idempotencyKey),
  }
  return { ...input, requestDigest: requestHash(input) }
}

function parseApprovalDecision(event, draftId) {
  const body = exactBody(event, [
    'draftRevision', 'decision', 'reasonCode', 'validationSnapshotId', 'idempotencyKey',
  ])
  if (!APPROVAL_DECISIONS.has(body.decision) || !APPROVAL_REASON_CODES.has(body.reasonCode)) {
    throw Object.assign(new Error('invalid_request'), { request: true })
  }
  if (
    (body.decision === 'approved' && body.reasonCode !== 'approval.ready')
    || (body.decision === 'changes_requested' && !body.reasonCode.startsWith('changes.'))
    || (body.validationSnapshotId !== null && (typeof body.validationSnapshotId !== 'string' || !UUID.test(body.validationSnapshotId)))
  ) throw Object.assign(new Error('invalid_request'), { request: true })
  const input = {
    draftId,
    draftRevision: boundedInteger(body.draftRevision, 1, Number.MAX_SAFE_INTEGER),
    decision: body.decision,
    reasonCode: body.reasonCode,
    validationSnapshotId: body.validationSnapshotId === null ? null : uuid(body.validationSnapshotId),
    idempotencyKey: uuid(body.idempotencyKey),
  }
  return { ...input, requestDigest: requestHash(input) }
}

function parseStagingRequest(event, draftId) {
  const body = exactBody(event, ['draftRevision', 'idempotencyKey'])
  return {
    draftId,
    draftRevision: boundedInteger(body.draftRevision, 1, Number.MAX_SAFE_INTEGER),
    idempotencyKey: uuid(body.idempotencyKey),
  }
}

function parsePublishingRequest(event, draftId) {
  const body = exactBody(event, ['stagingId', 'idempotencyKey'])
  return {
    draftId,
    stagingId: uuid(body.stagingId),
    idempotencyKey: uuid(body.idempotencyKey),
  }
}

function parseActivationRequest(event) {
  const body = exactBody(event, [
    'targetReleaseVersion', 'expectedPointerRevision', 'transitionKind',
    'reasonCode', 'idempotencyKey',
  ])
  if (!['activation', 'rollback'].includes(body.transitionKind)) {
    throw Object.assign(new Error('invalid_request'), { request: true })
  }
  const expectedReason = body.transitionKind === 'activation'
    ? 'release.activated' : 'release.rolled_back'
  if (body.reasonCode !== expectedReason) {
    throw Object.assign(new Error('invalid_request'), { request: true })
  }
  return {
    targetReleaseVersion: version(body.targetReleaseVersion, RELEASE_VERSION),
    expectedPointerRevision: boundedInteger(
      body.expectedPointerRevision, 1, Number.MAX_SAFE_INTEGER,
    ),
    transitionKind: body.transitionKind,
    reasonCode: body.reasonCode,
    idempotencyKey: uuid(body.idempotencyKey),
  }
}

function authoringMethod(route, method) {
  if (route.kind === 'drafts') return method === 'GET' || method === 'POST'
  if (route.kind === 'draft') return method === 'GET'
  if (route.kind === 'draft-collaborators') return method === 'GET' || method === 'POST'
  if (route.kind === 'draft-collaborator-revoke') return method === 'POST'
  if (route.kind === 'draft-entities') return method === 'POST'
  if (route.kind === 'draft-entity') return method === 'GET' || method === 'PUT'
  if (route.kind === 'draft-entity-tombstone') return method === 'POST'
  if (route.kind === 'draft-materialization' || route.kind === 'draft-validation' || route.kind === 'draft-preview') return method === 'GET'
  if (route.kind === 'draft-standards-review') return method === 'GET'
  if (route.kind === 'draft-approval') return method === 'GET' || method === 'POST'
  if (route.kind === 'draft-staging') return method === 'GET' || method === 'POST'
  if (route.kind === 'draft-publishing') return method === 'GET' || method === 'POST'
  return false
}

function serviceError(error, unavailableCode = 'curriculum_authoring_unavailable') {
  if (error?.code === 'not-found') return errorResponse(404, 'curriculum_draft_unavailable')
  if (error?.code === 'forbidden') return errorResponse(
    403,
    unavailableCode === 'curriculum_authoring_unavailable'
      ? 'curriculum_collaboration_required'
      : 'admin_access_denied',
  )
  if (error?.code === 'verified-principal') return errorResponse(422, 'verified_admin_principal_required')
  if (error?.code === 'last-editor') return errorResponse(422, 'last_editor_required')
  if (error?.code === 'already-assigned') return errorResponse(409, 'collaborator_already_assigned')
  if (error?.code === 'validation-blocked') return errorResponse(
    409,
    unavailableCode === 'curriculum_publication_unavailable'
      ? 'publication_validation_blocked'
      : 'validation_blocked',
  )
  if (error?.code === 'decision-conflict') return errorResponse(409, 'approval_transition_conflict')
  if (error?.code === 'gate-blocked') return errorResponse(409, 'staging_gate_blocked')
  if (error?.code === 'artifact-invalid') return errorResponse(409, 'publication_artifact_invalid')
  if (error?.code === 'manifest-mismatch') return errorResponse(409, 'publication_manifest_mismatch')
  if (error?.code === 'package-mismatch') return errorResponse(409, 'publication_package_mismatch')
  if (error?.code === 'approval-stale') return errorResponse(409, 'publication_approval_stale')
  if (error?.code === 'human-review-blocked') return errorResponse(409, 'publication_human_review_blocked')
  if (error?.code === 'target-collision') return errorResponse(409, 'target_version_collision')
  if (error?.code === 'package-conflict') return errorResponse(409, 'staging_package_conflict')
  if (error?.code === 'revision-conflict') return errorResponse(409, 'revision_conflict')
  if (error?.code === 'conflict' || error?.code === 'replay-conflict') return errorResponse(409, error.code === 'replay-conflict' ? 'idempotency_conflict' : 'revision_conflict')
  if (error?.code === 'invalid') return errorResponse(400, 'invalid_request')
  return errorResponse(503, unavailableCode)
}

function activationError(error) {
  if (error?.code === 'forbidden') return errorResponse(403, 'admin_access_denied')
  if (error?.code === 'invalid') return errorResponse(400, 'invalid_request')
  if (error?.code === 'target-not-found') return errorResponse(404, 'curriculum_release_unavailable')
  if (error?.code === 'replay-conflict') return errorResponse(409, 'idempotency_conflict')
  if (error?.code === 'pointer-conflict') return errorResponse(409, 'pointer_revision_conflict')
  if (error?.code === 'target-not-published') return errorResponse(409, 'target_not_published')
  if (error?.code === 'artifacts-unavailable') return errorResponse(409, 'release_artifacts_unavailable')
  if (error?.code === 'kind-conflict') return errorResponse(409, 'transition_kind_conflict')
  return errorResponse(503, 'curriculum_activation_unavailable')
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
  const approval = overrides.approval ?? createAdminCurriculumApprovalService({
    env: overrides.env ?? process.env,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    client: overrides.approvalClient,
  })
  const standardsReview = overrides.standardsReview ?? createAdminCurriculumStandardsReviewService({
    env: overrides.env ?? process.env,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    client: overrides.standardsReviewClient,
  })
  const staging = overrides.staging ?? createAdminCurriculumStagingPersistence({
    env: overrides.env ?? process.env,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    client: overrides.stagingClient,
  })
  const studio = overrides.studio ?? createAdminCurriculumStudioService({
    authoring,
    approval,
    staging,
    standardsReview,
  })
  const preview = overrides.preview ?? createAdminCurriculumPreviewService({ authoring, standardsReview })
  const publishing = overrides.publishing ?? createAdminCurriculumPublishingPersistence({
    env: overrides.env ?? process.env,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    client: overrides.publishingClient,
  })
  const activation = overrides.activation ?? createAdminCurriculumActivationPersistence({
    env: overrides.env ?? process.env,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    client: overrides.activationClient,
  })
  const integrityEvidence = overrides.integrityEvidence ?? createAdminCurriculumIntegrityEvidenceReader({
    env: overrides.env ?? process.env,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    client: overrides.integrityClient,
  })
  const integrity = overrides.integrity ?? createAdminCurriculumIntegrityService({
    evidence: integrityEvidence,
    registry,
  })

  return async (event) => {
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')
    const route = routeFromPath(event?.path)
    if (!route) return errorResponse(404, 'not_found')

    if (route.kind === 'standards-review-list') {
      if (event?.httpMethod !== 'GET') return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
      const authorized = await authorization.require(event, 'curriculum:read')
      if (!authorized.ok) return authorized.response
      try {
        return jsonResponse(200, await standardsReview.list(
          authorized.principal.userId, route.contextKind, route.contextRef,
        ))
      } catch {
        return errorResponse(503, 'curriculum_standards_review_unavailable')
      }
    }

    if (route.kind === 'standards-reviews') {
      if (event?.httpMethod !== 'POST') return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
      let input
      try {
        input = parseStandardsReview(event)
      } catch (error) {
        return errorResponse(error?.evidence ? 422 : 400, error?.evidence ? 'standards_mapping_evidence_required' : 'invalid_request')
      }
      const authorized = await authorization.require(
        event,
        input.status === 'approved_mapping' ? 'curriculum:approve' : 'curriculum:drafts:write',
      )
      if (!authorized.ok) return authorized.response
      try {
        if (input.contextKind === 'draft') {
          await authoring.read(authorized.principal.userId, input.contextRef)
        }
        return jsonResponse(200, await standardsReview.update(authorized.principal.userId, input))
      } catch (error) {
        if (error?.code === 'forbidden' || error?.code === 'not-found') {
          return serviceError(error)
        }
        if (error?.code === 'conflict' || error?.code === 'replay-conflict') {
          return errorResponse(409, error.code === 'replay-conflict' ? 'idempotency_conflict' : 'revision_conflict')
        }
        if (error?.code === 'invalid') return errorResponse(422, 'standards_mapping_evidence_required')
        return errorResponse(503, 'curriculum_standards_review_unavailable')
      }
    }

    if (route.kind.startsWith('draft')) {
      if (!authoringMethod(route, event?.httpMethod)) return errorResponse(405, 'method_not_allowed')
      const writing = event.httpMethod !== 'GET'
      const authorized = await authorization.require(
        event,
        route.kind === 'draft-approval' && writing
          ? 'curriculum:approve'
          : (route.kind === 'draft-staging' || route.kind === 'draft-publishing') && writing
            ? 'curriculum:publish'
          : writing ? 'curriculum:drafts:write' : 'curriculum:read',
      )
      if (!authorized.ok) return authorized.response
      try {
        const actor = authorized.principal.userId
        if (route.kind === 'draft-approval' || route.kind === 'draft-staging') {
          try {
            await authoring.read(actor, route.draftId)
          } catch (error) {
            return serviceError(error)
          }
        }
        let value
        if (route.kind === 'drafts' && event.httpMethod === 'GET') {
          value = await authoring.list(actor)
        } else if (route.kind === 'drafts') {
          value = await authoring.createDraft(actor, parseCreateDraft(event))
        } else if (route.kind === 'draft') {
          value = await authoring.read(actor, route.draftId)
        } else if (route.kind === 'draft-collaborators' && event.httpMethod === 'GET') {
          value = await authoring.listCollaborators(actor, route.draftId)
        } else if (route.kind === 'draft-collaborators') {
          value = await authoring.addCollaborator(actor, parseAddCollaborator(event, route.draftId))
        } else if (route.kind === 'draft-collaborator-revoke') {
          value = await authoring.revokeCollaborator(actor, parseRevokeCollaborator(event, route))
        } else if (route.kind === 'draft-entities') {
          value = await authoring.createEntity(actor, parseCreateEntity(event, route.draftId))
        } else if (route.kind === 'draft-entity' && event.httpMethod === 'GET') {
          value = await authoring.readEntity(actor, route.draftId, route.entityType, route.entityRef)
        } else if (route.kind === 'draft-materialization') {
          value = await studio.readMaterialization(actor, route.draftId, route.revision)
        } else if (route.kind === 'draft-validation') {
          value = await studio.validateDraft(actor, route.draftId, route.revision)
        } else if (route.kind === 'draft-preview') {
          value = await preview.read(actor, route.draftId, route.revision)
        } else if (route.kind === 'draft-standards-review') {
          value = await studio.readStandardsReview(actor, route.draftId, route.revision)
        } else if (route.kind === 'draft-approval' && event.httpMethod === 'GET') {
          value = await approval.read(actor, route.draftId)
        } else if (route.kind === 'draft-approval') {
          value = await approval.decide(actor, parseApprovalDecision(event, route.draftId))
        } else if (route.kind === 'draft-staging' && event.httpMethod === 'GET') {
          value = await studio.readStaging(actor, route.draftId)
        } else if (route.kind === 'draft-staging') {
          const input = parseStagingRequest(event, route.draftId)
          value = await studio.stageDraft(actor, input.draftId, input.draftRevision, input.idempotencyKey)
        } else if (route.kind === 'draft-publishing' && event.httpMethod === 'GET') {
          value = await publishing.read(actor, route.draftId)
        } else if (route.kind === 'draft-publishing') {
          const input = parsePublishingRequest(event, route.draftId)
          value = await publishing.publish(actor, input.stagingId, input.idempotencyKey)
        } else if (route.kind === 'draft-entity') {
          value = await authoring.updateEntity(actor, parseUpdateEntity(event, route))
        } else {
          value = await authoring.tombstoneEntity(actor, parseTombstone(event, route))
        }
        return jsonResponse(
          writing && value.replayed === false
            && ['drafts', 'draft-entities', 'draft-collaborators', 'draft-approval', 'draft-staging', 'draft-publishing'].includes(route.kind)
            ? 201 : 200,
          value,
        )
      } catch (error) {
        if (error?.schema) return errorResponse(422, 'schema_v2_rejected')
        if (error?.request || error?.name === 'GatewayError') return errorResponse(400, 'invalid_request')
        return serviceError(
          error,
          route.kind === 'draft-approval'
            ? 'curriculum_approval_unavailable'
            : route.kind === 'draft-staging'
              ? 'curriculum_staging_unavailable'
              : route.kind === 'draft-publishing'
                ? 'curriculum_publication_unavailable'
            : 'curriculum_authoring_unavailable',
        )
      }
    }

    if (route.kind === 'activation') {
      if (!['GET', 'POST'].includes(event?.httpMethod)) {
        return errorResponse(405, 'method_not_allowed', { allow: 'GET, POST' })
      }
      const writing = event.httpMethod === 'POST'
      const authorized = await authorization.require(
        event,
        writing ? 'releases:manage' : 'curriculum:read',
      )
      if (!authorized.ok) return authorized.response
      try {
        const value = writing
          ? await activation.transition(
            authorized.principal.userId,
            parseActivationRequest(event),
          )
          : await activation.read(authorized.principal.userId)
        return jsonResponse(
          writing && value.transition.state === 'transitioned' && !value.replayed ? 201 : 200,
          value,
        )
      } catch (error) {
        if (error?.request || error?.name === 'GatewayError') {
          return errorResponse(400, 'invalid_request')
        }
        return activationError(error)
      }
    }

    if (event?.httpMethod !== 'GET') return errorResponse(405, 'method_not_allowed', { allow: 'GET' })

    const authorized = await authorization.require(event, 'curriculum:read')
    if (!authorized.ok) return authorized.response
    try {
      if (route.kind === 'history') {
        const [releaseRegistry, activationStatus] = await Promise.all([
          registry.list(),
          activation.read(authorized.principal.userId),
        ])
        return jsonResponse(200, {
          schemaVersion: 1,
          releaseRegistry,
          activation: activationStatus,
        })
      }
      const value = route.kind === 'integrity'
        ? await integrity.verify(authorized.principal.userId)
        : route.kind === 'catalog'
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
      if (route.kind === 'history' && code === 'forbidden') {
        return errorResponse(403, 'admin_access_denied')
      }
      if (code === 'not-found') return errorResponse(
        404,
        route.kind === 'release' || route.kind === 'release-authoring-index'
          ? 'curriculum_release_unavailable'
          : 'curriculum_record_unavailable',
      )
      return errorResponse(
        503,
        route.kind === 'integrity' ? 'curriculum_integrity_unavailable' : 'curriculum_source_unavailable',
      )
    }
  }
}

export const handler = createAdminCurriculumHandler()
