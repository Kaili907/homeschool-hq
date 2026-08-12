import { describe, expect, it, vi } from 'vitest'
import {
  ACADEMY_GRADE5_MATH_UNIT5_CENSUS,
  ACADEMY_SOURCE_PINS,
  REVIEWED_HOST_SEGMENTS,
} from '../../../../src/study/server/tutorHostMapping.ts'
import { createTestServerTutorArtifactCustody } from './artifact-custody.js'
import {
  SERVER_TUTOR_CONTENT_BINDING_STATUSES,
  SERVER_TUTOR_FORBIDDEN_BROWSER_FIELDS,
  createServerTutorContentBindingService,
  createTestServerTutorContentBindingService,
  isTestServerTutorBinding,
  isTestStaticAcademyPermit,
  isTrustedServerTutorBinding,
  isTrustedStaticAcademyPermit,
  parseServerTutorOperationRequest,
} from './content-binding.js'

vi.mock('../study-identity/supabase.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    createTrustedStudySessionVerifier: vi.fn(actual.createTrustedStudySessionVerifier),
  }
})
const { createTrustedStudySessionVerifier } = await import('../study-identity/supabase.js')

const SESSION_REFERENCE = `aca_stu_v1_${'A'.repeat(43)}`
const IDS = Object.freeze({
  grant: '11111111-1111-4111-8111-111111111111',
  household: '22222222-2222-4222-8222-222222222222',
  student: '33333333-3333-4333-8333-333333333333',
  session: '44444444-4444-4444-8444-444444444444',
})
const VERIFIED = Object.freeze({
  schemaVersion: 1,
  status: 'verified',
  grantId: IDS.grant,
  householdId: IDS.household,
  studentId: IDS.student,
  learnerSessionId: IDS.session,
  sessionEpoch: IDS.session,
  sessionVersion: 1,
  authorizationRevision: 4,
  issuedAt: '2026-08-11T14:00:00.000Z',
  expiresAt: '2026-08-11T14:15:00.000Z',
  contractVersion: 1,
  issuerVersion: 'academy-student-session-issuer.v1',
  scope: Object.freeze([
    'student:assignments:read',
    'student:attempts:create',
    'student:progress:read',
  ]),
})

function operation(operationLocator = 'operation:unit5:l01:retrieve', overrides = {}) {
  return {
    status: 'resolved',
    operation: {
      schemaVersion: 1,
      operationLocator,
      sessionEpoch: IDS.session,
      operationRevision: 7,
      contentReference: 'academy-content:unit5:l01:retrieve',
      ...overrides,
    },
  }
}

function content(operationLocator = 'operation:unit5:l01:retrieve', overrides = {}) {
  return {
    status: 'resolved',
    content: {
      schemaVersion: 1,
      operationLocator,
      sessionEpoch: IDS.session,
      operationRevision: 7,
      contentReference: 'academy-content:unit5:l01:retrieve',
      academySourcePins: ACADEMY_SOURCE_PINS,
      lessonRef: 'ma-g5-mathematics-u05-l01',
      segmentRef: 'ma-g5-mathematics-u05-l01:segment:retrieve',
      subject: 'math',
      taskType: 'retrieval-practice',
      ...overrides,
    },
  }
}

function request(operationLocator = 'operation:unit5:l01:retrieve') {
  return {
    sessionReference: SESSION_REFERENCE,
    request: { schemaVersion: 1, operationLocator },
  }
}

function harness(options = {}) {
  const runtime = options.runtime ?? {
    start: vi.fn(),
    submit: vi.fn(),
    continue: vi.fn(),
  }
  const calls = {
    verifySession: options.verifySession ?? vi.fn().mockResolvedValue(VERIFIED),
    resolveOperation: options.resolveOperation ?? vi.fn(async ({ operationLocator }) => operation(operationLocator)),
    resolveContent: options.resolveContent ?? vi.fn(async ({ operation: resolved }) => content(resolved.operationLocator)),
    verifyAcademyPins: options.verifyAcademyPins ?? vi.fn(() => true),
    verifyFrozenPins: options.verifyFrozenPins ?? vi.fn(() => true),
    lookup: options.lookup ?? vi.fn(() => null),
    eligibility: options.eligibility ?? vi.fn(() => Object.freeze({
      eligible: true,
      programRef: 'math-seq-equivalent-fractions-v1',
      gradeBand: 'elementary-3-5',
    })),
    pseudonym: options.pseudonym ?? vi.fn(async () => 'learner:00112233445566778899aabbccddeeff'),
    createRuntime: options.createRuntime ?? vi.fn(() => runtime),
    liveAuthority: options.liveAuthority ?? vi.fn(async ({ operation: resolved }) => ({
      status: 'safe-current',
      sessionEpoch: resolved.sessionEpoch,
      operationRevision: resolved.operationRevision,
    })),
  }
  const sessionVerifier = Object.freeze({
    isReady: options.sessionReady ?? (() => true),
    isDurable: true,
    verify: calls.verifySession,
  })
  const operationResolver = Object.freeze({
    isReady: options.operationReady ?? (() => true),
    resolve: calls.resolveOperation,
  })
  const hostContentResolver = Object.freeze({
    isReady: options.contentReady ?? (() => true),
    resolve: calls.resolveContent,
  })
  const artifactCustody = options.artifactCustody ?? createTestServerTutorArtifactCustody({
    verifyAcademySourcePins: calls.verifyAcademyPins,
    verifyFrozenTutorPins: calls.verifyFrozenPins,
    resolveApprovedMapping: calls.lookup,
    evaluateApprovedMapping: calls.eligibility,
    deriveLearnerPseudonym: calls.pseudonym,
    createRuntime: calls.createRuntime,
  })
  const hostAuthority = Object.freeze({
    isReady: options.authorityReady ?? (() => true),
    check: calls.liveAuthority,
  })
  const service = createTestServerTutorContentBindingService({
    sessionVerifier,
    operationResolver,
    hostContentResolver,
    artifactCustody,
    hostAuthority,
  })
  return { service, calls, runtime }
}

function expectBare(result, status) {
  expect(result).toEqual({ schemaVersion: 1, status })
  expect(Object.keys(result)).toEqual(['schemaVersion', 'status'])
  const serialized = JSON.stringify(result)
  for (const privateValue of Object.values(IDS)) expect(serialized).not.toContain(privateValue)
  expect(serialized).not.toMatch(/reason|diagnostic|message|student|household|lessonRef|segmentRef/i)
}

describe('strict server Tutor operation request', () => {
  it('accepts only the exact two-field descriptor snapshot without normalization', () => {
    const operationLocator = '  Operation:e\u0301:Exact  '
    expect(parseServerTutorOperationRequest({ schemaVersion: 1, operationLocator })).toEqual({
      schemaVersion: 1,
      operationLocator,
    })
    expect(parseServerTutorOperationRequest({ schemaVersion: '1', operationLocator })).toBeNull()
    expect(parseServerTutorOperationRequest({ schemaVersion: 1, operationLocator: 7 })).toBeNull()
    expect(parseServerTutorOperationRequest({ schemaVersion: 1 })).toBeNull()
    expect(parseServerTutorOperationRequest({ schemaVersion: 1, operationLocator, extra: true })).toBeNull()
  })

  it.each(SERVER_TUTOR_FORBIDDEN_BROWSER_FIELDS)(
    'rejects the browser authority/content claim %s before authorization',
    async (field) => {
      const { service, calls } = harness()
      const raw = request()
      raw.request[field] = 'caller-claim'
      expectBare(await service.resolve(raw), 'auth-refused')
      expect(calls.verifySession).not.toHaveBeenCalled()
    },
  )

  it('rejects raw learner text before every resolver and custody hook', async () => {
    const { service, calls } = harness()
    const raw = request()
    raw.request.transientLearnerText = 'private learner words'
    expectBare(await service.resolve(raw), 'auth-refused')
    expect(calls.verifySession).not.toHaveBeenCalled()
    expect(calls.resolveOperation).not.toHaveBeenCalled()
    expect(calls.resolveContent).not.toHaveBeenCalled()
    expect(calls.lookup).not.toHaveBeenCalled()
  })

  it('rejects symbols, hidden fields, accessors, nonplain prototypes and throwing proxies', () => {
    const symbol = { schemaVersion: 1, operationLocator: 'operation:exact' }
    symbol[Symbol('authority')] = true

    const hidden = { schemaVersion: 1, operationLocator: 'operation:exact' }
    Object.defineProperty(hidden, 'hidden', { value: true, enumerable: false })

    const hiddenRequired = { schemaVersion: 1 }
    Object.defineProperty(hiddenRequired, 'operationLocator', {
      value: 'operation:exact',
      enumerable: false,
    })

    let accessorReads = 0
    const accessor = { schemaVersion: 1 }
    Object.defineProperty(accessor, 'operationLocator', {
      enumerable: true,
      get() {
        accessorReads += 1
        return 'operation:exact'
      },
    })

    class ClaimedRequest {
      constructor() {
        this.schemaVersion = 1
        this.operationLocator = 'operation:exact'
      }
    }

    const throwing = [
      new Proxy({}, { getPrototypeOf() { throw new Error('trap') } }),
      new Proxy({}, { ownKeys() { throw new Error('trap') } }),
      new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('trap') } }),
    ]

    for (const raw of [symbol, hidden, hiddenRequired, accessor, new ClaimedRequest(), ...throwing]) {
      expect(parseServerTutorOperationRequest(raw)).toBeNull()
    }
    expect(accessorReads).toBe(0)
  })

  it('does not invoke a caller coercion hook', () => {
    const toString = vi.fn(() => 'operation:coerced')
    expect(parseServerTutorOperationRequest({
      schemaVersion: 1,
      operationLocator: { toString },
    })).toBeNull()
    expect(toString).not.toHaveBeenCalled()
  })
})

describe('ordered fail-closed content binding', () => {
  it('uses the exact credential capability, then the exact locator under the verified session', async () => {
    const locator = '  operation:No-Normalization  '
    const { service, calls } = harness()
    const result = await service.resolve(request(locator))

    expect(result.status).toBe('ordinary-content-ineligible')
    expect(isTrustedStaticAcademyPermit(result.staticPermit)).toBe(false)
    expect(isTestStaticAcademyPermit(result.staticPermit)).toBe(true)
    for (const forged of [
      JSON.parse(JSON.stringify(result.staticPermit)),
      structuredClone(result.staticPermit),
      { ...result.staticPermit },
    ]) {
      expect(isTrustedStaticAcademyPermit(forged)).toBe(false)
      expect(isTestStaticAcademyPermit(forged)).toBe(false)
    }
    expect(calls.verifySession).toHaveBeenCalledWith({
      sessionReference: SESSION_REFERENCE,
      requiredCapability: 'student:attempts:create',
    })
    expect(calls.resolveOperation).toHaveBeenCalledWith({
      authorizedSession: expect.objectContaining({
        status: 'verified',
        sessionEpoch: IDS.session,
        studentId: IDS.student,
      }),
      operationLocator: locator,
    })
    expect(calls.resolveContent).toHaveBeenCalledWith({
      authorizedSession: expect.objectContaining({ sessionEpoch: IDS.session }),
      operation: expect.objectContaining({ operationLocator: locator }),
    })
  })

  it.each([
    ['a malformed credential', request(), 'auth-refused', null],
    ['a denied credential', request(), 'auth-refused', { status: 'denied' }],
    ['unavailable authorization', request(), 'auth-infrastructure-unavailable', { status: 'unavailable' }],
  ])('closes on %s before operation resolution', async (_label, input, status, verifierResult) => {
    const verifySession = verifierResult === null
      ? vi.fn().mockResolvedValue(VERIFIED)
      : vi.fn().mockResolvedValue(verifierResult)
    const { service, calls } = harness({ verifySession })
    if (verifierResult === null) input.sessionReference = 'invalid'
    expectBare(await service.resolve(input), status)
    expect(calls.resolveOperation).not.toHaveBeenCalled()
    expect(calls.resolveContent).not.toHaveBeenCalled()
    expect(calls.lookup).not.toHaveBeenCalled()
  })

  it('distinguishes authorization infrastructure failure from denial', async () => {
    const { service, calls } = harness({
      verifySession: vi.fn().mockRejectedValue(new Error('private infrastructure detail')),
    })
    expectBare(await service.resolve(request()), 'auth-infrastructure-unavailable')
    expect(calls.resolveOperation).not.toHaveBeenCalled()
  })

  it('refuses a verified grant that does not carry the exact attempt capability', async () => {
    const { service, calls } = harness({
      verifySession: vi.fn().mockResolvedValue({
        ...VERIFIED,
        scope: ['student:assignments:read'],
      }),
    })
    expectBare(await service.resolve(request()), 'auth-refused')
    expect(calls.resolveOperation).not.toHaveBeenCalled()
    expect(calls.resolveContent).not.toHaveBeenCalled()
    expect(calls.lookup).not.toHaveBeenCalled()
  })

  it('refuses a resolved operation not bound to the exact authorized session', async () => {
    const { service, calls } = harness({
      resolveOperation: vi.fn(async ({ operationLocator }) => operation(operationLocator, {
        sessionEpoch: '55555555-5555-4555-8555-555555555555',
      })),
    })
    expectBare(await service.resolve(request()), 'server-unavailable')
    expect(calls.resolveContent).not.toHaveBeenCalled()
  })

  it.each([
    ['refused', 'auth-refused'],
    ['unavailable', 'server-unavailable'],
  ])('does not resolve content after operation status %s', async (operationStatus, expected) => {
    const { service, calls } = harness({
      resolveOperation: vi.fn().mockResolvedValue({ status: operationStatus }),
    })
    expectBare(await service.resolve(request()), expected)
    expect(calls.resolveContent).not.toHaveBeenCalled()
    expect(calls.lookup).not.toHaveBeenCalled()
  })

  it.each([
    ['integrity-failed', 'host-content-integrity-failed'],
    ['stale', 'mapping-stale'],
    ['unavailable', 'server-unavailable'],
  ])('stops before custody after host-content status %s', async (contentStatus, expected) => {
    const artifactCustody = { verify: vi.fn() }
    const { service, calls } = harness({
      resolveContent: vi.fn().mockResolvedValue({ status: contentStatus }),
      artifactCustody,
    })
    expectBare(await service.resolve(request()), expected)
    expect(artifactCustody.verify).not.toHaveBeenCalled()
    expect(calls.lookup).not.toHaveBeenCalled()
  })

  it('stops on artifact integrity failure before source pins and lookup', async () => {
    const artifactCustody = {
      verify: vi.fn().mockResolvedValue({ status: 'mapping-integrity-failed' }),
    }
    const { service, calls } = harness({ artifactCustody })
    expectBare(await service.resolve(request()), 'mapping-integrity-failed')
    expect(calls.verifyAcademyPins).not.toHaveBeenCalled()
    expect(calls.verifyFrozenPins).not.toHaveBeenCalled()
    expect(calls.lookup).not.toHaveBeenCalled()
  })

  it('does not verify frozen pins or lookup after Academy pin staleness', async () => {
    const { service, calls } = harness({
      verifyAcademyPins: vi.fn(() => false),
    })
    expectBare(await service.resolve(request()), 'mapping-stale')
    expect(calls.verifyAcademyPins).toHaveBeenCalledOnce()
    expect(calls.verifyFrozenPins).not.toHaveBeenCalled()
    expect(calls.lookup).not.toHaveBeenCalled()
  })

  it('does not lookup after frozen pin staleness', async () => {
    const { service, calls } = harness({
      verifyFrozenPins: vi.fn(() => false),
    })
    expectBare(await service.resolve(request()), 'mapping-stale')
    expect(calls.verifyAcademyPins).toHaveBeenCalledOnce()
    expect(calls.verifyFrozenPins).toHaveBeenCalledOnce()
    expect(calls.lookup).not.toHaveBeenCalled()
  })

  it('treats an approved row rejected by frozen eligibility as stale and mints nothing', async () => {
    const selection = Object.freeze({ fixture: 'future-approved' })
    const { service, calls } = harness({
      lookup: vi.fn(() => selection),
      eligibility: vi.fn(() => Object.freeze({ eligible: false, status: 'ineligible' })),
    })
    expectBare(await service.resolve(request()), 'mapping-stale')
    expect(calls.eligibility).toHaveBeenCalledWith(selection, {
      subject: 'math',
      lessonRef: 'ma-g5-mathematics-u05-l01',
      taskType: 'retrieval-practice',
    })
    expect(calls.pseudonym).not.toHaveBeenCalled()
    expect(calls.liveAuthority).not.toHaveBeenCalled()
  })

  it('closes on hostile or nonexact eligibility decisions instead of escaping the union', async () => {
    const accessor = {}
    Object.defineProperties(accessor, {
      eligible: { enumerable: true, get() { throw new Error('accessor') } },
      programRef: { enumerable: true, value: 'math-seq-equivalent-fractions-v1' },
      gradeBand: { enumerable: true, value: 'elementary-3-5' },
    })
    const decisions = [
      ['accessor', accessor],
      ['throwing proxy', new Proxy({}, { getPrototypeOf() { throw new Error('proxy') } })],
      ['extra key', {
        eligible: true,
        programRef: 'math-seq-equivalent-fractions-v1',
        gradeBand: 'elementary-3-5',
        diagnostic: 'extra',
      }],
      ['missing key', { eligible: true, programRef: 'math-seq-equivalent-fractions-v1' }],
    ]

    for (const [label, decision] of decisions) {
      const { service, calls } = harness({
        lookup: vi.fn(() => Object.freeze({ fixture: 'future-approved' })),
        eligibility: () => decision,
      })
      const result = await service.resolve(request())
      expect(result.status, label).toBe('mapping-stale')
      expectBare(result, 'mapping-stale')
      expect(calls.pseudonym).not.toHaveBeenCalled()
      expect(calls.liveAuthority).not.toHaveBeenCalled()
    }
  })

  it('mints no permit or binding when the late live authority refuses', async () => {
    const { service } = harness({
      liveAuthority: vi.fn().mockResolvedValue({ status: 'unsafe' }),
    })
    const result = await service.resolve(request())
    expectBare(result, 'safety-failure')
    expect(Object.hasOwn(result, 'staticPermit')).toBe(false)
    expect(Object.hasOwn(result, 'binding')).toBe(false)
  })
})

describe('zero-mapping Unit 5 oracle', () => {
  it('returns 90 trusted static permits without touching any Tutor operation', async () => {
    const rows = []
    for (const lesson of ACADEMY_GRADE5_MATH_UNIT5_CENSUS) {
      for (const segment of REVIEWED_HOST_SEGMENTS) {
        const locator = `operation:${lesson.hostLessonRef}:${segment.suffix}`
        rows.push({ lesson, segment, locator })
      }
    }
    const byLocator = new Map(rows.map((row) => [row.locator, row]))
    const ledgerWrite = vi.fn()
    const runtime = {
      start: vi.fn(),
      submit: vi.fn(),
      continue: vi.fn(),
      ledgerWrite,
    }
    const { service, calls } = harness({
      runtime,
      resolveOperation: vi.fn(async ({ operationLocator }) => operation(operationLocator, {
        contentReference: `academy-content:${operationLocator}`,
      })),
      resolveContent: vi.fn(async ({ operation: resolved }) => {
        const row = byLocator.get(resolved.operationLocator)
        return content(resolved.operationLocator, {
          contentReference: resolved.contentReference,
          lessonRef: row.lesson.hostLessonRef,
          segmentRef: `${row.lesson.hostLessonRef}:segment:${row.segment.suffix}`,
          taskType: row.segment.taskType,
        })
      }),
    })

    const results = []
    for (const row of rows) results.push(await service.resolve(request(row.locator)))

    expect(rows).toHaveLength(18 * 5)
    expect(results).toHaveLength(90)
    for (const result of results) {
      expect(result.status).toBe('ordinary-content-ineligible')
      expect(Object.keys(result)).toEqual(['schemaVersion', 'status', 'staticPermit'])
      expect(isTrustedStaticAcademyPermit(result.staticPermit)).toBe(false)
      expect(isTestStaticAcademyPermit(result.staticPermit)).toBe(true)
      expect(isTrustedServerTutorBinding(result.staticPermit)).toBe(false)
      expect(isTestServerTutorBinding(result.staticPermit)).toBe(false)
    }
    expect(calls.verifySession).toHaveBeenCalledTimes(90)
    expect(calls.resolveOperation).toHaveBeenCalledTimes(90)
    expect(calls.resolveContent).toHaveBeenCalledTimes(90)
    expect(calls.verifyAcademyPins).toHaveBeenCalledTimes(90)
    expect(calls.verifyFrozenPins).toHaveBeenCalledTimes(90)
    expect(calls.lookup).toHaveBeenCalledTimes(90)
    expect(calls.eligibility).not.toHaveBeenCalled()
    expect(calls.pseudonym).not.toHaveBeenCalled()
    expect(calls.createRuntime).not.toHaveBeenCalled()
    expect(runtime.start).not.toHaveBeenCalled()
    expect(runtime.submit).not.toHaveBeenCalled()
    expect(runtime.continue).not.toHaveBeenCalled()
    expect(ledgerWrite).not.toHaveBeenCalled()
  })
})

describe('future reviewed eligible binding fixture', () => {
  it('derives only a server-session pseudonym and mints an identity-bound private binding', async () => {
    const selection = Object.freeze({ fixture: 'future-approved-row' })
    const { service, calls } = harness({ lookup: vi.fn(() => selection) })
    const result = await service.resolve(request())

    expect(result.status).toBe('eligible')
    expect(Object.keys(result)).toEqual(['schemaVersion', 'status', 'binding'])
    expect(isTrustedServerTutorBinding(result.binding)).toBe(false)
    expect(isTestServerTutorBinding(result.binding)).toBe(true)
    expect(isTrustedStaticAcademyPermit(result.binding)).toBe(false)
    expect(isTestStaticAcademyPermit(result.binding)).toBe(false)
    expect(calls.pseudonym).toHaveBeenCalledWith(IDS.session)
    expect(calls.pseudonym).not.toHaveBeenCalledWith(SESSION_REFERENCE)
    expect(calls.createRuntime).not.toHaveBeenCalled()

    expect(Reflect.ownKeys(result.binding)).toEqual([])
    const jsonClone = JSON.parse(JSON.stringify(result.binding))
    const structuredCloneBinding = structuredClone(result.binding)
    const spread = { ...result.binding }
    for (const forged of [jsonClone, structuredCloneBinding, spread, Object.freeze({})]) {
      expect(isTrustedServerTutorBinding(forged)).toBe(false)
      expect(isTestServerTutorBinding(forged)).toBe(false)
    }

    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain(IDS.student)
    expect(serialized).not.toContain(IDS.household)
    expect(serialized).not.toContain(IDS.session)
    expect(serialized).not.toContain('learner:00112233445566778899aabbccddeeff')
  })

  it('runs the late safety check after eligible-only pseudonym derivation', async () => {
    const order = []
    const selection = Object.freeze({ fixture: 'future-approved-row' })
    const { service } = harness({
      lookup: vi.fn(() => { order.push('lookup'); return selection }),
      eligibility: vi.fn(() => {
        order.push('eligibility')
        return {
          eligible: true,
          programRef: 'math-seq-equivalent-fractions-v1',
          gradeBand: 'elementary-3-5',
        }
      }),
      pseudonym: vi.fn(async () => { order.push('pseudonym'); return 'learner:00112233445566778899aabbccddeeff' }),
      liveAuthority: vi.fn(async ({ operation: resolved }) => {
        order.push('live-authority')
        return {
          status: 'safe-current',
          sessionEpoch: resolved.sessionEpoch,
          operationRevision: resolved.operationRevision,
        }
      }),
    })
    expect((await service.resolve(request())).status).toBe('eligible')
    expect(order).toEqual(['lookup', 'eligibility', 'pseudonym', 'live-authority'])
  })
})

describe('closed result vocabulary', () => {
  it('contains exactly the requested union and only ordinary content carries a static permit', () => {
    expect(SERVER_TUTOR_CONTENT_BINDING_STATUSES).toEqual([
      'eligible',
      'ordinary-content-ineligible',
      'auth-refused',
      'auth-infrastructure-unavailable',
      'mapping-integrity-failed',
      'mapping-stale',
      'host-content-integrity-failed',
      'server-unavailable',
      'safety-failure',
    ])
  })
})

describe('production composition', () => {
  it('passes the session verifier only its two contractual transport dependencies, forwarding nothing else', async () => {
    createTrustedStudySessionVerifier.mockClear()
    const env = Object.freeze({})
    const fetchImpl = vi.fn()
    createServerTutorContentBindingService({
      env,
      fetchImpl,
      operationResolver: { isReady: () => true, resolve: vi.fn() },
      hostContentResolver: { isReady: () => true, resolve: vi.fn() },
      hostAuthority: { isReady: () => true, check: vi.fn() },
      verifier: { isReady: () => true, verify: vi.fn() },
      timeoutMs: 1,
      extraneous: 'must-not-reach-the-trust-boundary',
    })
    expect(createTrustedStudySessionVerifier).toHaveBeenCalledTimes(1)
    const [forwarded] = createTrustedStudySessionVerifier.mock.calls[0]
    expect(forwarded).toEqual({ env, fetchImpl })
    expect(Object.keys(forwarded)).toEqual(['env', 'fetchImpl'])
  })

  it('runs the real production session verifier end to end through a mocked transport, still closing on denial', async () => {
    createTrustedStudySessionVerifier.mockClear()
    const env = Object.freeze({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    })
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'denied', schemaVersion: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const operationResolver = { isReady: () => true, resolve: vi.fn() }
    const hostContentResolver = { isReady: () => true, resolve: vi.fn() }
    const hostAuthority = { isReady: () => true, check: vi.fn() }
    const service = createServerTutorContentBindingService({
      env,
      fetchImpl,
      operationResolver,
      hostContentResolver,
      hostAuthority,
    })
    const result = await service.resolve(request())
    expectBare(result, 'auth-refused')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(operationResolver.resolve).not.toHaveBeenCalled()
    expect(hostContentResolver.resolve).not.toHaveBeenCalled()
    expect(hostAuthority.check).not.toHaveBeenCalled()
  })
})

describe('forged or unbranded artifact capability refusal', () => {
  it('refuses a capability object with the exact right method shape that was never minted by artifact custody', async () => {
    const forgedMethods = Object.freeze({
      verifyAcademySourcePins: vi.fn(() => true),
      verifyFrozenTutorPins: vi.fn(() => true),
      resolveApprovedMapping: vi.fn(() => null),
      evaluateApprovedMapping: vi.fn(),
      deriveLearnerPseudonym: vi.fn(),
      createRuntime: vi.fn(),
    })
    const forgedCapability = Object.freeze({ ...forgedMethods })
    const artifactCustody = {
      verify: vi.fn().mockResolvedValue({ status: 'verified', capability: forgedCapability }),
    }
    const { service } = harness({ artifactCustody })
    expectBare(await service.resolve(request()), 'mapping-integrity-failed')
    for (const method of Object.values(forgedMethods)) expect(method).not.toHaveBeenCalled()
  })

  it('refuses an unbranded plain object masquerading as the capability envelope itself', async () => {
    const artifactCustody = {
      verify: vi.fn().mockResolvedValue({
        status: 'verified',
        capability: Object.freeze({ notACapability: true }),
      }),
    }
    const { service, calls } = harness({ artifactCustody })
    expectBare(await service.resolve(request()), 'mapping-integrity-failed')
    expect(calls.verifyAcademyPins).not.toHaveBeenCalled()
    expect(calls.lookup).not.toHaveBeenCalled()
  })
})

describe('exact approved-selection shape (broken custody contracts fail closed)', () => {
  it.each([
    ['undefined', undefined],
    ['zero', 0],
    ['empty string', ''],
    ['false', false],
    ['NaN', Number.NaN],
    ['an unfrozen plain object', {}],
    ['a frozen array', Object.freeze([])],
    ['a Promise (resolveApprovedMapping is a synchronous contract, never awaited)', Promise.resolve(Object.freeze({}))],
  ])('treats a %s lookup result as a broken custody contract, not a selection', async (_label, badSelection) => {
    const { service, calls } = harness({ lookup: vi.fn(() => badSelection) })
    expectBare(await service.resolve(request()), 'mapping-integrity-failed')
    expect(calls.eligibility).not.toHaveBeenCalled()
    expect(calls.pseudonym).not.toHaveBeenCalled()
    expect(calls.liveAuthority).not.toHaveBeenCalled()
  })

  it('still accepts exact null as "no selection" and a frozen plain object as a selection', async () => {
    const nullLookup = harness({ lookup: vi.fn(() => null) })
    expect((await nullLookup.service.resolve(request())).status).toBe('ordinary-content-ineligible')

    const selection = Object.freeze({ fixture: 'valid-selection' })
    const objectLookup = harness({ lookup: vi.fn(() => selection) })
    expect((await objectLookup.service.resolve(request())).status).toBe('eligible')
  })
})
