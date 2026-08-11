import { describe, expect, it, vi } from 'vitest'
import { resolveAdminCostRange } from './_shared/admin-cost-projection.js'
import { readJsonBody } from './_shared/http.js'
import { createAdminAccessHandler } from './admin-access.js'
import { createAdminAuditHandler } from './admin-audit.js'
import { createAdminAuthorizationHandler } from './admin-authorization.js'
import { createAdminConfigurationHandler } from './admin-configuration.js'
import { createAdminCorrelationsHandler } from './admin-correlations.js'
import { createAdminCostsHandler } from './admin-costs.js'
import { createAdminCurriculumHandler } from './admin-curriculum.js'
import { createAdminEnginePerformanceHandler } from './admin-engine-performance.js'
import { createAdminHealthHandler } from './admin-health.js'
import { createAdminLearnersHandler } from './admin-learners.js'
import { createAdminOverviewHandler } from './admin-overview.js'
import { createAdminProductionReadinessHandler } from './admin-production-readiness.js'
import { createAdminSafetyOperationsHandler } from './admin-safety-operations.js'

const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const DRAFT = '10000000-0000-4000-8000-000000000001'
const REQUEST = '20000000-0000-4000-8000-000000000001'
const ASSIGNMENT = '30000000-0000-4000-8000-000000000001'
const PRINCIPAL = '40000000-0000-4000-8000-000000000001'
const STAGING = '50000000-0000-4000-8000-000000000001'
const VALIDATION = '60000000-0000-4000-8000-000000000001'
const TOKEN = 't'.repeat(43)
const PRIVATE_SENTINEL = 'prompt response assessment_answer student_work guardian_note secret_private_token_marker'

function allowAuthorization() {
  return {
    require: vi.fn(async () => ({
      ok: true,
      accessToken: 'verified-access-token',
      principal: {
        userId: ACTOR,
        role: 'owner',
        capabilities: [
          'overview:read', 'learners:read', 'engines:read', 'costs:read', 'safety:read',
          'health:read', 'curriculum:read', 'configuration:read', 'audit:read', 'releases:read',
          'curriculum:drafts:write', 'admin_roles:manage', 'configuration:manage',
          'curriculum:approve', 'curriculum:publish', 'releases:manage',
        ],
      },
    })),
  }
}

function responseBody(response) {
  expect(response.statusCode).toBeGreaterThanOrEqual(400)
  expect(response.statusCode).toBeLessThan(500)
  expect(response.headers?.['content-type']).toMatch(/^application\/json/)
  const body = JSON.parse(response.body)
  expect(body).toEqual({ error: { code: expect.any(String) } })
  expect(response.body).not.toContain(PRIVATE_SENTINEL)
  return body
}

const READ_SURFACES = [
  ['authorization', '/api/admin/v1/authorization', (authorization) => createAdminAuthorizationHandler({ authorization })],
  ['overview', '/api/admin/v1/overview', (authorization) => createAdminOverviewHandler({ authorization })],
  ['learners', '/api/admin/v1/learners', (authorization) => createAdminLearnersHandler({ authorization })],
  ['costs', '/api/admin/v1/costs', (authorization) => createAdminCostsHandler({ authorization })],
  ['engine performance', '/api/admin/v1/engine-performance', (authorization) => createAdminEnginePerformanceHandler({ authorization })],
  ['health', '/api/admin/v1/health', (authorization) => createAdminHealthHandler({ authorization })],
  ['safety', '/api/admin/v1/safety-operations', (authorization) => createAdminSafetyOperationsHandler({ authorization })],
  ['audit', '/api/admin/v1/audit', (authorization) => createAdminAuditHandler({ authorization })],
  ['correlations', '/api/admin/v1/correlations', (authorization) => createAdminCorrelationsHandler({ authorization })],
  ['access', '/api/admin/v1/access', (authorization) => createAdminAccessHandler({ authorization })],
  ['configuration', '/api/admin/v1/configuration', (authorization) => createAdminConfigurationHandler({ authorization })],
  ['readiness', '/api/admin/v1/production-readiness', (authorization) => createAdminProductionReadinessHandler({ authorization })],
  ['curriculum', '/api/admin/curriculum/catalog', (authorization) => createAdminCurriculumHandler({ authorization })],
]

const BODY_ON_READ_CASES = [
  ['object JSON', '{}'],
  ['array JSON', '[]'],
  ['null JSON', 'null'],
  ['private payload', JSON.stringify({ prompt: PRIVATE_SENTINEL })],
  ['non-string event body', { role: 'owner', capabilities: ['*'] }],
]

describe('Admin API reusable adversarial contract suite', () => {
  it.each(READ_SURFACES.flatMap(([surface, path, create]) =>
    BODY_ON_READ_CASES.map(([bodyKind, body]) => [surface, bodyKind, path, create, body]))) (
    '%s rejects a non-empty %s body before authorization or source access',
    async (_surface, _bodyKind, path, create, body) => {
      const authorization = allowAuthorization()
      const response = await create(authorization)({
        httpMethod: 'GET', path, headers: { authorization: 'Bearer forged' }, body,
      })
      responseBody(response)
      expect(authorization.require).not.toHaveBeenCalled()
    },
  )

  const curriculumReadPaths = [
    '/api/admin/curriculum/catalog',
    '/api/admin/curriculum/validation',
    '/api/admin/curriculum/integrity',
    '/api/admin/curriculum/history',
    '/api/admin/curriculum/activation',
    '/api/admin/curriculum/releases',
    '/api/admin/curriculum/releases/1.0.0',
    '/api/admin/curriculum/releases/1.0.0/authoring-index',
    '/api/admin/curriculum/releases/1.0.0/authoring/entities/course/course%3Amath-5',
    '/api/admin/curriculum/production-pointer',
    '/api/admin/curriculum/lessons/ma-g5-mathematics-u01-l01',
    '/api/admin/curriculum/standards-reviews/published_release/1.0.0',
    `/api/admin/curriculum/standards-reviews/draft/${DRAFT}`,
    '/api/admin/curriculum/drafts',
    `/api/admin/curriculum/drafts/${DRAFT}`,
    `/api/admin/curriculum/drafts/${DRAFT}/collaborators`,
    `/api/admin/curriculum/drafts/${DRAFT}/entities/course/course%3Amath-5`,
    `/api/admin/curriculum/drafts/${DRAFT}/materialization/1`,
    `/api/admin/curriculum/drafts/${DRAFT}/validation/1`,
    `/api/admin/curriculum/drafts/${DRAFT}/preview/1`,
    `/api/admin/curriculum/drafts/${DRAFT}/standards-review/1`,
    `/api/admin/curriculum/drafts/${DRAFT}/approval`,
    `/api/admin/curriculum/drafts/${DRAFT}/staging`,
    `/api/admin/curriculum/drafts/${DRAFT}/publishing`,
  ]

  it.each(curriculumReadPaths)('rejects bodies on curriculum read contract %s', async (path) => {
    const authorization = allowAuthorization()
    const response = await createAdminCurriculumHandler({ authorization })({
      httpMethod: 'GET', path, body: JSON.stringify({ privateNotes: PRIVATE_SENTINEL }),
    })
    responseBody(response)
    expect(authorization.require).not.toHaveBeenCalled()
  })

  const noQuerySurfaces = READ_SURFACES.filter(([surface]) =>
    ['authorization', 'access', 'configuration', 'readiness', 'curriculum'].includes(surface))
  const malformedNoQuery = [
    ['unknown key', { queryStringParameters: { role: 'owner' } }],
    ['array query map', { queryStringParameters: [] }],
    ['array multi-value map', { multiValueQueryStringParameters: [] }],
    ['non-string raw query', { rawQueryString: 7 }],
  ]

  it.each(noQuerySurfaces.flatMap(([surface, path, create]) =>
    malformedNoQuery.map(([kind, query]) => [surface, kind, path, create, query]))) (
    '%s rejects %s on a queryless contract',
    async (_surface, _kind, path, create, query) => {
      const authorization = allowAuthorization()
      const response = await create(authorization)({ httpMethod: 'GET', path, ...query })
      responseBody(response)
      expect(authorization.require).not.toHaveBeenCalled()
    },
  )
})

function queryFuzz(key, valid, alternate) {
  return [
    ['duplicate raw parameter', {
      queryStringParameters: undefined,
      rawQueryString: `${key}=${encodeURIComponent(valid)}&${key}=${encodeURIComponent(alternate)}`,
    }],
    ['duplicate multi-value parameter', {
      queryStringParameters: undefined,
      multiValueQueryStringParameters: { [key]: [valid, alternate] },
    }],
    ['conflicting raw and canonical values', {
      queryStringParameters: { [key]: valid }, rawQueryString: `${key}=${encodeURIComponent(alternate)}`,
    }],
    ['conflicting raw fields', {
      queryStringParameters: undefined,
      rawQueryString: `${key}=${encodeURIComponent(valid)}`,
      rawQuery: `${key}=${encodeURIComponent(alternate)}`,
    }],
    ['malformed URL encoding', { queryStringParameters: undefined, rawQueryString: `${key}=%GG` }],
    ['array instead of query object', { queryStringParameters: [] }],
    ['unknown authority query', { queryStringParameters: { role: 'owner' }, rawQueryString: undefined }],
    ['path traversal-style value', { queryStringParameters: { [key]: '../private\\secret' }, rawQueryString: undefined }],
    ['very large Unicode value', { queryStringParameters: { [key]: `\u202e${'x'.repeat(16_384)}` }, rawQueryString: undefined }],
  ]
}

function querySurfaceHarnesses() {
  const surfaces = []
  {
    const touched = vi.fn()
    const authorization = allowAuthorization()
    const sources = {
      learners: touched, health: touched, enginePerformance: touched, costs: touched,
      providerAttemptCoverage: touched, monthlyCostAlert: touched, safety: touched,
      curriculumCatalog: touched, curriculumValidation: touched, disabledEngines: [],
    }
    surfaces.push({
      name: 'overview', key: 'range', valid: 'today', alternate: '30-days', touched,
      request: { httpMethod: 'GET', path: '/api/admin/v1/overview', queryStringParameters: { range: 'today' } },
      handler: createAdminOverviewHandler({ authorization, sources, now: () => new Date('2026-08-10T12:00:00Z') }),
    })
  }
  {
    const touched = vi.fn()
    const authorization = allowAuthorization()
    surfaces.push({
      name: 'learners', key: 'today', valid: '2026-08-10', alternate: '2026-08-09', touched,
      request: { httpMethod: 'GET', path: '/api/admin/v1/learners', queryStringParameters: { today: '2026-08-10' } },
      handler: createAdminLearnersHandler({ authorization, reader: { readSnapshot: touched, readDetail: touched } }),
    })
  }
  {
    const touched = vi.fn()
    const projectionRead = vi.fn(async (event) => {
      resolveAdminCostRange(event, new Date('2026-08-10T12:00:00Z'))
      touched()
      return { generatedAt: '2026-08-10T12:00:00.000Z' }
    })
    surfaces.push({
      name: 'costs', key: 'range', valid: 'today', alternate: '30-days', touched,
      request: { httpMethod: 'GET', path: '/api/admin/v1/costs', queryStringParameters: { range: 'today' } },
      handler: createAdminCostsHandler({
        authorization: allowAuthorization(), projection: { read: projectionRead },
        monthlyCostAlertEvaluator: { read: vi.fn() },
      }),
    })
  }
  for (const [name, key, valid, alternate, path, create] of [
    ['engine performance', 'window', '30d', '7d', '/api/admin/v1/engine-performance',
      (authorization, touched) => createAdminEnginePerformanceHandler({ authorization, reader: { aggregate: touched } })],
    ['health', 'window', '1h', '24h', '/api/admin/v1/health',
      (authorization, touched) => createAdminHealthHandler({ authorization, source: { list: touched } })],
    ['safety', 'limit', '50', '100', '/api/admin/v1/safety-operations',
      (authorization, touched) => createAdminSafetyOperationsHandler({ authorization, reader: { read: touched } })],
    ['audit', 'limit', '50', '100', '/api/admin/v1/audit',
      (authorization, touched) => createAdminAuditHandler({ authorization, reader: { list: touched } })],
    ['correlations', 'domain', 'runtime', 'admin-audit', '/api/admin/v1/correlations',
      (authorization, touched) => createAdminCorrelationsHandler({
        authorization,
        reader: { runtime: touched, audit: touched, providerAccounting: touched },
        now: () => '2026-08-10T12:00:00.000Z',
      })],
  ]) {
    const touched = vi.fn()
    surfaces.push({
      name, key, valid, alternate, touched,
      request: { httpMethod: 'GET', path, queryStringParameters: { [key]: valid } },
      handler: create(allowAuthorization(), touched),
    })
  }
  return surfaces
}

describe('Admin query canonicalization fuzz matrix', () => {
  it.each(querySurfaceHarnesses().flatMap((surface) =>
    queryFuzz(surface.key, surface.valid, surface.alternate)
      .map(([kind, overrides]) => [surface, kind, overrides]))) (
    '$0.name rejects $1 without reading a backend',
    async (surface, _kind, overrides) => {
      const response = await surface.handler({ ...surface.request, ...overrides })
      responseBody(response)
      expect(surface.touched).not.toHaveBeenCalled()
    },
  )
})

const COURSE = {
  schema_set_version: '2.0.0', course_id: 'course:math-5', grade: 5,
  subject: 'mathematics', title: 'Mathematics 5',
  description: 'A complete fifth grade mathematics course.', days: 180, order: 1,
  unit_refs: ['unit:math-5-1'],
  standards: [{ framework_ref: 'framework:legacy', legacy_label: '5.NBT', mapping_status: 'human-review' }],
}

function curriculumMutationHarness() {
  const touched = vi.fn()
  const authoring = {
    read: vi.fn(async () => ({ draftId: DRAFT, revision: 3 })),
    listCollaborators: vi.fn(async () => ({ currentResponsibility: 'editor' })),
    createDraft: touched, createEntity: touched, updateEntity: touched,
    tombstoneEntity: touched, addCollaborator: touched, revokeCollaborator: touched,
  }
  return {
    touched,
    handler: createAdminCurriculumHandler({
      authorization: allowAuthorization(), authoring,
      approval: { read: vi.fn(), decide: touched },
      standardsReview: { list: vi.fn(), update: touched },
      studio: { readStaging: vi.fn(), stageDraft: touched },
      publishing: { read: vi.fn(), publish: touched },
      activation: { read: vi.fn(), transition: touched },
      preview: {}, integrity: {}, source: {}, registry: {}, staging: {},
    }),
  }
}

function mutationEvent(target, body = target.body) {
  return {
    httpMethod: target.method,
    path: target.path,
    headers: {
      authorization: 'Bearer verified-access-token',
      'content-type': 'application/json',
      'x-admin-role': 'owner',
      'x-admin-capabilities': '*',
    },
    body: JSON.stringify(body),
  }
}

const CONFIG_PREVIEW = {
  settingKey: 'runtime.ai.enabled', expectedRevision: '1', newValue: true,
  reasonCode: 'operator.request',
}
const CONFIG_COMMIT = { ...CONFIG_PREVIEW, requestId: REQUEST, confirmationToken: TOKEN }
const ACCESS_CHANGE = {
  assignmentRef: ASSIGNMENT, expectedRevision: '1', reasonCode: 'operator.request',
  requestId: REQUEST, newRole: 'admin',
}
const ACCESS_REVOKE = {
  assignmentRef: ASSIGNMENT, expectedRevision: '1', reasonCode: 'operator.request', requestId: REQUEST,
}
const STANDARDS_REVIEW = {
  reviewKey: 'csr-1234567890abcdef', contextKind: 'published_release', contextRef: '1.0.0',
  sourceLabel: 'Source label', grade: 5, courseRef: 'course:math-5',
  findingRule: 'standards.human_review_required', affectedCount: 1,
  findingIds: ['cvf-1234567890abcdef'], status: 'in_review',
  canonicalStandardId: null, frameworkVersion: null, canonicalTitle: null,
  evidenceSource: null, reviewerNote: null, expectedRevision: 0, idempotencyKey: REQUEST,
}

const WRITE_TARGETS = [
  {
    name: 'configuration preview', method: 'POST', path: '/api/admin/v1/configuration/preview', body: CONFIG_PREVIEW,
    make() {
      const touched = vi.fn()
      return { touched, handler: createAdminConfigurationHandler({ authorization: allowAuthorization(), source: { preview: touched } }) }
    },
  },
  {
    name: 'configuration commit', method: 'POST', path: '/api/admin/v1/configuration/commit', body: CONFIG_COMMIT,
    make() {
      const touched = vi.fn()
      return { touched, handler: createAdminConfigurationHandler({ authorization: allowAuthorization(), source: { commit: touched } }) }
    },
  },
  {
    name: 'access change-role', method: 'POST', path: '/api/admin/v1/access/change-role', body: ACCESS_CHANGE,
    make() {
      const touched = vi.fn()
      return { touched, handler: createAdminAccessHandler({ authorization: allowAuthorization(), source: { mutate: touched } }) }
    },
  },
  {
    name: 'access revoke', method: 'POST', path: '/api/admin/v1/access/revoke', body: ACCESS_REVOKE,
    make() {
      const touched = vi.fn()
      return { touched, handler: createAdminAccessHandler({ authorization: allowAuthorization(), source: { mutate: touched } }) }
    },
  },
  { name: 'draft creation', method: 'POST', path: '/api/admin/curriculum/drafts', body: {
    baseReleaseVersion: '1.0.0', targetVersion: '2.0.0-draft.1',
    authoringSchemaVersion: '2.0.0', idempotencyKey: REQUEST,
  }, make: curriculumMutationHarness },
  { name: 'entity creation', method: 'POST', path: `/api/admin/curriculum/drafts/${DRAFT}/entities`, body: {
    entityType: 'course', entityRef: 'course:math-5', origin: 'base_override', position: 1,
    payload: COURSE, expectedDraftRevision: 1, idempotencyKey: REQUEST,
  }, make: curriculumMutationHarness },
  { name: 'entity update', method: 'PUT', path: `/api/admin/curriculum/drafts/${DRAFT}/entities/course/course%3Amath-5`, body: {
    payload: COURSE, position: 1, expectedRevision: 1, expectedDraftRevision: 1, idempotencyKey: REQUEST,
  }, make: curriculumMutationHarness },
  { name: 'entity tombstone', method: 'POST', path: `/api/admin/curriculum/drafts/${DRAFT}/entities/course/course%3Amath-5/tombstone`, body: {
    expectedRevision: 1, expectedDraftRevision: 1, idempotencyKey: REQUEST,
  }, make: curriculumMutationHarness },
  { name: 'collaborator add', method: 'POST', path: `/api/admin/curriculum/drafts/${DRAFT}/collaborators`, body: {
    principalRef: PRINCIPAL, responsibility: 'reviewer', expectedDraftRevision: 1, idempotencyKey: REQUEST,
  }, make: curriculumMutationHarness },
  { name: 'collaborator revoke', method: 'POST', path: `/api/admin/curriculum/drafts/${DRAFT}/collaborators/${PRINCIPAL}/revoke`, body: {
    expectedDraftRevision: 1, idempotencyKey: REQUEST,
  }, make: curriculumMutationHarness },
  { name: 'standards review', method: 'POST', path: '/api/admin/curriculum/standards-reviews', body: STANDARDS_REVIEW, make: curriculumMutationHarness },
  { name: 'approval', method: 'POST', path: `/api/admin/curriculum/drafts/${DRAFT}/approval`, body: {
    draftRevision: 3, decision: 'approved', reasonCode: 'approval.ready',
    validationSnapshotId: VALIDATION, idempotencyKey: REQUEST,
  }, make: curriculumMutationHarness },
  { name: 'staging', method: 'POST', path: `/api/admin/curriculum/drafts/${DRAFT}/staging`, body: {
    draftRevision: 3, idempotencyKey: REQUEST,
  }, make: curriculumMutationHarness },
  { name: 'publishing', method: 'POST', path: `/api/admin/curriculum/drafts/${DRAFT}/publishing`, body: {
    stagingId: STAGING, idempotencyKey: REQUEST,
  }, make: curriculumMutationHarness },
  { name: 'activation/rollback', method: 'POST', path: '/api/admin/curriculum/activation', body: {
    targetReleaseVersion: '2.0.0', expectedPointerRevision: 1, transitionKind: 'activation',
    reasonCode: 'release.activated', idempotencyKey: REQUEST,
  }, make: curriculumMutationHarness },
]

function deepBody() {
  const root = {}
  let current = root
  for (let depth = 0; depth < 70; depth += 1) {
    current.child = {}
    current = current.child
  }
  return JSON.stringify(root)
}

const INVALID_ENVELOPES = [
  ['missing body', (event) => ({ ...event, body: undefined })],
  ['empty body', (event) => ({ ...event, body: '' })],
  ['malformed JSON', (event) => ({ ...event, body: '{"prompt":' })],
  ['array body', (event) => ({ ...event, body: '[]' })],
  ['scalar body', (event) => ({ ...event, body: '"NaN"' })],
  ['null body', (event) => ({ ...event, body: 'null' })],
  ['wrong content type', (event) => ({ ...event, headers: { ...event.headers, 'content-type': 'text/plain' } })],
  ['ambiguous content type', (event) => ({
    ...event, multiValueHeaders: { 'content-type': ['application/json', 'text/plain'] },
  })],
  ['unsupported content encoding', (event) => ({
    ...event, headers: { ...event.headers, 'content-encoding': 'gzip' },
  })],
  ['very deep body', (event) => ({ ...event, body: deepBody() })],
  ['oversized body', (event) => ({ ...event, body: JSON.stringify({ value: 'x'.repeat(1_100_001) }) })],
  ['unpaired Unicode surrogate', (event) => ({ ...event, body: '{"value":"\\ud800"}' })],
  ['invalid UTF-8', (event) => ({
    ...event,
    body: Buffer.from([0x7b, 0x22, 0x76, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d]).toString('base64'),
    isBase64Encoded: true,
  })],
]

describe('Admin mutation envelope fuzz matrix', () => {
  it.each(WRITE_TARGETS.flatMap((target) => INVALID_ENVELOPES.map(([kind, mutate]) => [target, kind, mutate]))) (
    '$0.name rejects $1 without mutation',
    async (target, _kind, mutate) => {
      const { handler, touched } = target.make()
      const response = await handler(mutate(mutationEvent(target)))
      responseBody(response)
      expect(touched).not.toHaveBeenCalled()
    },
  )

  it.each(WRITE_TARGETS)('$name rejects browser authority and protected-content keys', async (target) => {
    const { handler, touched } = target.make()
    const response = await handler(mutationEvent(target, {
      ...target.body,
      role: 'owner', capability: '*', capabilities: ['*'], actor: ACTOR,
      prompt: PRIVATE_SENTINEL, response: PRIVATE_SENTINEL, guardianNotes: PRIVATE_SENTINEL,
    }))
    responseBody(response)
    expect(touched).not.toHaveBeenCalled()
  })

  it('preserves valid Unicode scalar values and the explicit UTF-8 JSON media type', () => {
    expect(readJsonBody({
      headers: { 'content-type': 'application/json; charset="UTF-8"' },
      body: JSON.stringify({ label: 'Learner 👩🏽‍🎓' }),
    }, 256)).toEqual({ label: 'Learner 👩🏽‍🎓' })
  })
})

describe('Admin scalar, money, revision, UUID, and path fuzz matrix', () => {
  it.each([
    1, 1.1, -1, 0, null, '1.0', '01', '+1', '-1', 'NaN', 'Infinity',
    '1000000000000.1', '1000000000001', '9'.repeat(128),
  ])('rejects non-canonical integer-micros value %j', async (newValue) => {
    const touched = vi.fn()
    const handler = createAdminConfigurationHandler({
      authorization: allowAuthorization(), source: { preview: touched },
    })
    const target = {
      method: 'POST', path: '/api/admin/v1/configuration/preview',
      body: { ...CONFIG_PREVIEW, settingKey: 'cost.warning.monthly_micros', newValue },
    }
    responseBody(await handler(mutationEvent(target)))
    expect(touched).not.toHaveBeenCalled()
  })

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, null, '1', 'NaN', 1e100])(
    'rejects unsafe curriculum revision %j',
    async (draftRevision) => {
      const target = WRITE_TARGETS.find(({ name }) => name === 'staging')
      const { handler, touched } = target.make()
      responseBody(await handler(mutationEvent(target, { ...target.body, draftRevision })))
      expect(touched).not.toHaveBeenCalled()
    },
  )

  it.each([0, -1, 1, 1.5, null, '0', '-1', '01', '9223372036854775808', '9'.repeat(128)])(
    'rejects unsafe access revision %j',
    async (expectedRevision) => {
      const touched = vi.fn()
      const handler = createAdminAccessHandler({ authorization: allowAuthorization(), source: { mutate: touched } })
      const target = {
        method: 'POST', path: '/api/admin/v1/access/change-role',
        body: { ...ACCESS_CHANGE, expectedRevision },
      }
      responseBody(await handler(mutationEvent(target)))
      expect(touched).not.toHaveBeenCalled()
    },
  )

  it.each([
    '', 'not-a-uuid', '00000000-0000-0000-0000-000000000000',
    '10000000-0000-6000-8000-000000000001', '../private', `${REQUEST}/other`, null, 42,
  ])('rejects invalid request UUID %j', async (idempotencyKey) => {
    const target = WRITE_TARGETS.find(({ name }) => name === 'activation/rollback')
    const { handler, touched } = target.make()
    responseBody(await handler(mutationEvent(target, { ...target.body, idempotencyKey })))
    expect(touched).not.toHaveBeenCalled()
  })

  it.each([
    `/api/admin/curriculum/drafts/${DRAFT}/preview/-1`,
    `/api/admin/curriculum/drafts/${DRAFT}/preview/0`,
    `/api/admin/curriculum/drafts/${DRAFT}/preview/1.5`,
    `/api/admin/curriculum/drafts/${DRAFT}/preview/${'9'.repeat(32)}`,
    '/api/admin/curriculum/drafts/not-a-uuid',
    '/api/admin/curriculum/drafts/..%2Fprivate',
    '/api/admin/curriculum/lessons/..%2Fprivate',
    '/api/admin/curriculum/releases/%GG',
    `/api/admin/curriculum/drafts/${DRAFT}\\entities`,
  ])('rejects malformed or traversal path %s before authorization', async (path) => {
    const authorization = allowAuthorization()
    const response = await createAdminCurriculumHandler({ authorization })({ httpMethod: 'GET', path })
    expect(response.statusCode).toBe(404)
    expect(JSON.parse(response.body)).toEqual({ error: { code: 'not_found' } })
    expect(authorization.require).not.toHaveBeenCalled()
  })
})
