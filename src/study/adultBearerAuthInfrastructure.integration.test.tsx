import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// The real deployed gateway, composed through its own test seam. `authVerifier`
// is deliberately never overridden anywhere in this file, so every request below
// runs the production `verifySupabaseBearer` the handler resolves for itself.
import { createTestStudySafetyHandler } from '../../netlify/functions/study-safety-classify.js'
import { createInMemoryAdultReviewStore } from '../../netlify/functions/_shared/study-adult-review/memory-store.js'
import { createTestRecipientResolver } from '../../netlify/functions/_shared/study-adult-review/recipients.js'
import { createStudySessionTransport } from './client/studySessionTransport'
import {
  createHostStudyLifecycleSeam,
  type HostStudyLifecycleSeam,
} from './composition/hostStudyLifecycle'
import type { StudySessionGrant } from './contracts/identity/session'
import { syntheticGrade5StudyContext } from './demonstrations'
import { createMountedStudyPorts } from './mountedPorts'
import type { StudyPortBundle } from './ports'
import { STUDY_LEARNER_STOP_MESSAGE } from './safety/learnerSafe'
import type { StudySessionAuthorizationFailure } from './safety/mountedPort'
import { isSessionStoppedByLocalLedger, readLocalSafetyStops } from './safety/localStopLedger'
import { createSyntheticMathBlock } from './testing/syntheticStudyFixtures'
import type { StudyCancellationReason } from './lifecycle'
import type { StudyCalendarEntry, StudySafeEvent } from './types'

// STUDY-A1-AUTH-INFRA-BOUNDARY-H2 — the sibling of the boundary that
// STUDY-A1-AUTH-INFRA-BOUNDARY-C closed.
//
// That card gave the *learner/session* authorization verifier its own transport
// category. The *adult bearer* verifier — Supabase Auth, reached through
// `verifySupabaseBearer` — is the other authorization dependency of the very
// same request, and it still answered 503 `auth_unavailable` and 504
// `upstream_timeout`. The host could only read those as a safety-service outage,
// so a Supabase blip while a child submitted an answer wrote two durable safety
// records into her parent's ledger, locked her session, appended a `safety-stop`
// event, and showed her the safety copy — surviving a refresh.
//
// Both verifiers run strictly before the safety classifier, so in neither case
// was the learner's text ever read, let alone judged.
//
// Everything here drives the REAL chain and nothing is faked between its ends:
//   real Supabase-auth failure → real `verifySupabaseBearer` → real
//   `study-safety-classify` handler → real safety client → real mounted safety
//   port → real runtime facade → real StudySessionContainer.
// The only injected seam is the Supabase Auth HTTP call itself, which is the
// dependency whose outage is under test.
const shim = vi.hoisted(() => ({ cancellations: [] as string[] }))

const IDS = Object.freeze({
  actor: '11111111-1111-4111-8111-111111111111',
  household: '33333333-3333-4333-8333-333333333333',
  student: '44444444-4444-4444-8444-444444444444',
})

const ENV = Object.freeze({
  ACADEMY_STUDY_ENABLED: 'true',
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-test-key',
  ANTHROPIC_API_KEY: 'provider-test-key',
  STUDY_SAFETY_RATE_LIMIT_HMAC_KEY: 'test-rate-limit-correlation-key',
})

const STUDY_UNAVAILABLE_RETRY_MESSAGE = 'Study is not available right now. Wait a moment, then try again.'
const SESSION_UNAVAILABLE_MESSAGE = 'The Study session ended. Please ask your dad to sign in again. You are not in trouble.'
const BUSY_RETRY_MESSAGE = 'Study is busy right now. Wait a moment, then try again.'
const LEARNER_TEXT_SENTINEL = 'child-answer-sentinel'
const BEARER_SENTINEL = 'bearer-secret-sentinel'
const SESSION_REFERENCE = 'aca_stu_v1_synthetic-study-session-reference-aaaaaaaaa'

// ── The Supabase Auth dependency, in each of its real states ────────────────

type AuthFetch = (url: string, init: { signal?: AbortSignal }) => Promise<unknown>

/** What a real `fetch` rejects with when `AbortSignal.timeout` fires. */
function timeoutRejection(): Error {
  const error = new Error('The operation was aborted due to timeout')
  error.name = 'TimeoutError'
  return error
}

/** The transport never completed: DNS, TLS, connection reset, edge failure. */
const authUnreachable: AuthFetch = async () => { throw new Error('supabase auth unreachable') }

/** The call was still open when the hard timeout fired. */
const authTimedOut: AuthFetch = async () => { throw timeoutRejection() }

/** The connection succeeded and the body did not arrive before the deadline. */
const authBodyTimedOut: AuthFetch = async () => ({
  ok: true,
  status: 200,
  json: async () => { throw timeoutRejection() },
})

/** Reached, answering, and broken — no exception anywhere on this path. */
function authServerError(status: number): AuthFetch {
  return async () => ({ ok: false, status, json: async () => ({ error: 'upstream' }) })
}

/** A genuine identity refusal from a perfectly healthy auth server. */
function authRefuses(status: number): AuthFetch {
  return async () => ({ ok: false, status, json: async () => ({ error: 'invalid token' }) })
}

/** The healthy path: a verified adult bearer. */
const authVerified: AuthFetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({ id: IDS.actor }),
})

// ── The real gateway ────────────────────────────────────────────────────────

interface GatewayOptions {
  readonly auth: AuthFetch
  readonly env?: Record<string, string>
  readonly learnerAuthorization?: unknown
  readonly rateLimiter?: unknown
}

interface Gateway {
  readonly handler: (event: unknown) => Promise<{ statusCode: number; body: string }>
  readonly monitoringEvents: unknown[]
}

function gateway(options: GatewayOptions): Gateway {
  const rawStore = createInMemoryAdultReviewStore()
  const store = Object.freeze({ ...rawStore, isDurable: true })
  const monitoringEvents: unknown[] = []
  const handler = createTestStudySafetyHandler({
    env: options.env ?? ENV,
    // The Supabase Auth call under test. `verifySupabaseBearer` is NOT
    // overridden — the handler resolves the production one itself.
    fetchImpl: options.auth,
    classifier: {
      classifierVersion: 'test-safety-classifier-v1',
      isConfigured: () => true,
      circuitState: () => 'closed',
      async classify(request: { deterministicAssessment: { outcome: string; categories: unknown } }) {
        return {
          classificationVersion: 1,
          classifierVersion: 'test-safety-classifier-v1',
          outcome: request.deterministicAssessment.outcome,
          categories: request.deterministicAssessment.categories,
          reasonCodes: [`safety-provider-${request.deterministicAssessment.outcome}-v1`],
        }
      },
    },
    learnerAuthorization: options.learnerAuthorization ?? {
      isDurable: true,
      verifiesSession: true,
      isReady: () => true,
      resolve: async ({ sessionId }: { sessionId: string }) => ({
        status: 'authorized',
        context: {
          actorUserId: IDS.actor,
          householdId: IDS.household,
          studentId: IDS.student,
          sessionId,
        },
      }),
    },
    proposalPersistence: store,
    outbox: store,
    recipientResolver: Object.freeze({
      ...createTestRecipientResolver({
        proposalRef: 'safety-proposal-placeholder',
        recipients: [{
          recipientRef: 'recipient:test-guardian',
          membershipRef: 'membership:test-guardian',
          learnerRelationshipRef: 'relationship:test-student',
          notificationPermissionRef: 'notification-permission:test-safety',
          relationship: 'guardian',
          routes: [{ channel: 'in-app', routeRef: 'in-app-route:test-guardian' }],
        }],
      }),
      isDurable: true,
    }),
    rateLimiter: options.rateLimiter ?? { isDurable: true, isReady: () => true, reserve: async () => ({ allowed: true }) },
    deliveryProviders: [{
      channel: 'in-app', isDurable: true, isReady: () => true,
      supportsDurableIdempotency: true, deliver: async () => ({ state: 'indeterminate' }),
    }],
    receiptValidators: [{
      channel: 'in-app', isDurable: true, isReady: () => true,
      verifyReceipt: async () => ({ verified: false }),
    }],
    monitoring: {
      isDurable: true,
      isReady: () => true,
      record: async (value: unknown) => { monitoringEvents.push(value) },
    },
    now: () => Date.parse('2026-08-08T12:00:00.000Z'),
  })
  return { handler, monitoringEvents }
}

type FetchLike = (url: string, init: RequestInit) => Promise<{ ok: boolean; status?: number; json(): Promise<unknown> }>

/** The browser's `fetch`, answered by the real handler over a Netlify event. */
function browserFetch(target: Gateway): FetchLike {
  return async (url, init) => {
    const result = await target.handler({
      httpMethod: 'POST',
      path: url,
      headers: Object.fromEntries(new Headers(init.headers as HeadersInit).entries()),
      body: String(init.body),
    })
    return {
      ok: result.statusCode >= 200 && result.statusCode < 300,
      status: result.statusCode,
      json: async () => JSON.parse(result.body),
    }
  }
}

// ── DOM harness ─────────────────────────────────────────────────────────────

function hostStudyLifecycle(): HostStudyLifecycleSeam {
  const seam = createHostStudyLifecycleSeam({}, {
    authenticatedSessionRef: 'session:study-a1-auth-infra-h2',
    householdRef: 'household:synthetic-session12',
    learnerRef: 'learner:synthetic-grade5-math',
    launchGrantRef: 'grant:study-a1-auth-infra-h2',
    featureEnabled: true,
    authorizationRevision: 1,
  })
  const cancel = seam.boundary.cancel.bind(seam.boundary)
  vi.spyOn(seam.boundary, 'cancel').mockImplementation((reason: StudyCancellationReason) => {
    shim.cancellations.push(reason)
    cancel(reason)
  })
  return seam
}

class MemStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
}

class FakeElement extends EventTarget {
  nodeType = 1
  nodeName: string
  tagName: string
  namespaceURI = 'http://www.w3.org/1999/xhtml'
  ownerDocument!: FakeDocument
  parentNode: FakeElement | null = null
  childNodes: FakeElement[] = []
  textContent = ''
  style = {}
  private attributes = new Map<string, string>()
  constructor(tag = 'div') { super(); this.nodeName = tag.toUpperCase(); this.tagName = tag.toUpperCase() }
  appendChild(child: FakeElement) { child.parentNode = this; this.childNodes.push(child); return child }
  insertBefore(child: FakeElement, before: FakeElement | null) {
    child.parentNode = this
    const index = before ? this.childNodes.indexOf(before) : -1
    if (index < 0) this.childNodes.push(child); else this.childNodes.splice(index, 0, child)
    return child
  }
  removeChild(child: FakeElement) { this.childNodes = this.childNodes.filter((item) => item !== child); child.parentNode = null; return child }
  setAttribute(name: string, value: string) { this.attributes.set(name, String(value)) }
  removeAttribute(name: string) { this.attributes.delete(name) }
  getAttribute(name: string) { return this.attributes.get(name) ?? null }
  focus() { this.ownerDocument.activeElement = this }
  get firstChild() { return this.childNodes[0] ?? null }
}

class FakeDocument extends EventTarget {
  nodeType = 9
  nodeName = '#document'
  documentElement: FakeElement
  body: FakeElement
  defaultView!: EventTarget & Record<string, unknown>
  activeElement: FakeElement
  constructor() {
    super()
    this.documentElement = new FakeElement('html'); this.body = new FakeElement('body')
    this.documentElement.ownerDocument = this; this.body.ownerDocument = this; this.activeElement = this.body
  }
  createElement(tag: string) { const e = new FakeElement(tag); e.ownerDocument = this; return e }
  createElementNS(_ns: string, tag: string) { return this.createElement(tag) }
  createTextNode(value: string) { const e = this.createElement('#text'); e.nodeType = 3; e.nodeName = '#text'; e.textContent = value; return e }
}

function renderedText(node: FakeElement): string {
  return `${node.textContent} ${node.childNodes.map(renderedText).join(' ')}`
}

/** Text-node joins introduce spaces mid-sentence, so match with whitespace removed. */
function hasText(node: FakeElement, needle: string): boolean {
  return renderedText(node).replaceAll(/\s+/g, '').includes(needle.replaceAll(/\s+/g, ''))
}

function tags(node: FakeElement, tag: string): FakeElement[] {
  return [...(node.tagName === tag ? [node] : []), ...node.childNodes.flatMap((child) => tags(child, tag))]
}

function reactProps(node: FakeElement): Record<string, never> {
  const key = Object.keys(node).find((name) => name.startsWith('__reactProps$'))
  if (!key) throw new Error('React props are not attached to this node.')
  return (node as unknown as Record<string, Record<string, never>>)[key]!
}

function installedTransport() {
  const transport = createStudySessionTransport()
  transport.install({
    schemaVersion: 1,
    status: 'issued',
    sessionReference: SESSION_REFERENCE,
    expiresAt: '2026-08-09T12:00:00.000Z',
  } as StudySessionGrant)
  return transport
}

describe('STUDY-A1-AUTH-INFRA-BOUNDARY-H2 adult bearer verifier outages', () => {
  let container: FakeElement
  let documentTarget: FakeDocument
  let storage: MemStorage
  let roots: Root[]
  let events: StudySafeEvent[]
  let ports: StudyPortBundle
  let entry: StudyCalendarEntry
  let stopKey: { studentRef: string; sessionRef: string }
  let identityFailures: StudySessionAuthorizationFailure[]
  const context = syntheticGrade5StudyContext('math')

  beforeEach(() => {
    shim.cancellations.length = 0
    identityFailures = []
    storage = new MemStorage()
    documentTarget = new FakeDocument()
    const windowTarget = Object.assign(new EventTarget(), {
      document: documentTarget, setTimeout, clearTimeout, HTMLElement: FakeElement,
      HTMLIFrameElement: class {}, getSelection: () => null, navigator: { userAgent: 'test' },
      localStorage: storage,
    })
    documentTarget.defaultView = windowTarget as never
    vi.stubGlobal('window', windowTarget)
    vi.stubGlobal('document', documentTarget)
    vi.stubGlobal('navigator', { userAgent: 'test' })
    vi.stubGlobal('localStorage', storage)
    container = documentTarget.createElement('div')
    documentTarget.body.appendChild(container)
    roots = []
    events = []
  })

  afterEach(async () => {
    for (const root of roots) await act(async () => { root.unmount() })
    vi.unstubAllGlobals()
  })

  async function settle(): Promise<void> {
    for (let tick = 0; tick < 10; tick += 1) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    }
  }

  interface SessionOptions {
    readonly suffix: string
    readonly fetchImpl: FetchLike
  }

  async function mountSession(options: SessionOptions): Promise<void> {
    const mounted = createMountedStudyPorts({
      getAccessToken: async () => BEARER_SENTINEL,
      fetchImpl: options.fetchImpl,
      sessionAuthorization: installedTransport(),
      // The App clears the learner's verified identity from here. An
      // infrastructure outage must never reach it.
      onSessionAuthorizationFailure: (reason) => { identityFailures.push(reason) },
    })
    const base = mounted.ports
    ports = {
      ...base,
      eventLedger: {
        append: (scope, event, operation) => {
          events.push(event)
          return base.eventLedger.append(scope, event, operation)
        },
      },
    }
    entry = (await createSyntheticMathBlock(ports, { suffix: options.suffix })).entry
    stopKey = { studentRef: context.learnerRef, sessionRef: `${entry.blockRef}:session` }
    await remount()
  }

  /** A page load: the previous mount is torn down, only the store survives. */
  async function remount(): Promise<void> {
    for (const previous of roots.splice(0)) await act(async () => { previous.unmount() })
    const { StudySessionContainer } = await import('../components/study/StudySessionContainer')
    const root = createRoot(container as never)
    roots.push(root)
    const studyLifecycle = hostStudyLifecycle()
    await act(async () => {
      root.render(
        <StudySessionContainer context={context} initialEntry={entry} ports={ports} studyLifecycle={studyLifecycle} onBack={() => {}} />,
      )
    })
    await settle()
  }

  function control(label: string): FakeElement | undefined {
    return tags(container, 'BUTTON').find((button) => hasText(button, label))
  }

  async function submitAnswer(text = 'ready'): Promise<void> {
    const textarea = tags(container, 'TEXTAREA')[0]
    if (!textarea) throw new Error('The live Study surface never rendered a response field.')
    await act(async () => {
      const onChange = reactProps(textarea).onChange as unknown as (event: unknown) => void
      onChange({ target: { value: text } })
    })
    const send = control('Send through Tutor boundary')
    if (!send) throw new Error('The live Study surface never rendered a submit control.')
    await act(async () => {
      const onClick = reactProps(send).onClick as unknown as () => void | Promise<void>
      await onClick()
    })
    await settle()
  }

  function ledger() {
    return readLocalSafetyStops(storage)
  }

  // ── Phase 3 — the exact server statuses, straight off the real handler ────
  // These run the handler alone, with no browser, so the transport contract is
  // pinned independently of anything the client does with it.
  // The slug is only a lesson-reference-safe fixture suffix, so each case gets
  // its own synthetic block and its own storage key.
  const OUTAGES: ReadonlyArray<readonly [string, string, AuthFetch]> = [
    ['the auth transport never completed (auth_unavailable)', 'unreachable', authUnreachable],
    ['the auth call hit its hard timeout (upstream_timeout)', 'timeout', authTimedOut],
    ['the auth body never arrived (upstream_timeout)', 'bodytimeout', authBodyTimedOut],
    ['the auth server answered 500 (auth_unavailable)', 'upstream500', authServerError(500)],
    ['the auth server answered 503 (auth_unavailable)', 'upstream503', authServerError(503)],
  ]

  function classifyEvent(text = 'ordinary answer') {
    return {
      httpMethod: 'POST',
      path: '/api/study/safety/classify',
      headers: {
        authorization: `Bearer ${BEARER_SENTINEL}`,
        'content-type': 'application/json',
        'x-study-session': SESSION_REFERENCE,
      },
      body: JSON.stringify({
        schemaVersion: 1,
        requestId: '22222222-2222-4222-8222-222222222222',
        studentRef: { kind: 'academy-student-id', value: IDS.student },
        sessionId: '55555555-5555-4555-8555-555555555555',
        transientText: text,
      }),
    }
  }

  it.each(OUTAGES)('answers 424 authorization_unavailable when %s', async (_label, _slug, auth) => {
    const result = await gateway({ auth }).handler(classifyEvent())
    expect(result.statusCode).toBe(424)
    expect(JSON.parse(result.body)).toEqual({ error: { code: 'authorization_unavailable' } })
  })

  // ── Phase 5 — identity failures are untouched ────────────────────────────
  it.each([
    ['the auth server refused the token (400)', authRefuses(400)],
    ['the auth server refused the token (401)', authRefuses(401)],
    ['the auth server refused the token (403)', authRefuses(403)],
  ])('still answers 401 unauthenticated when %s', async (_label, auth) => {
    const result = await gateway({ auth }).handler(classifyEvent())
    expect(result.statusCode).toBe(401)
    expect(JSON.parse(result.body)).toEqual({ error: { code: 'unauthenticated' } })
  })

  it('still answers 401 for a missing or malformed bearer, without calling the verifier', async () => {
    const auth = vi.fn(authVerified)
    const result = await gateway({ auth }).handler({
      ...classifyEvent(),
      headers: { 'content-type': 'application/json' },
    })
    expect(result.statusCode).toBe(401)
    expect(auth).not.toHaveBeenCalled()
  })

  it('keeps a misconfigured deployment on 503, not on the infrastructure category', async () => {
    // `service_unavailable` is a deploy fault, not a transient outage: retrying
    // in a moment will not fix it, so it must not borrow the retry semantics.
    const result = await gateway({
      auth: authVerified,
      env: { ACADEMY_STUDY_ENABLED: 'true', STUDY_SAFETY_RATE_LIMIT_HMAC_KEY: 'k' },
    }).handler(classifyEvent())
    expect(result.statusCode).toBe(503)
    expect(JSON.parse(result.body)).toEqual({ error: { code: 'service_unavailable' } })
  })

  // ── Phase 12 — 424 uniqueness across the whole route ─────────────────────
  it('emits 424 for authorization infrastructure and for nothing else on this route', async () => {
    const denyingLearnerAuthorization = {
      isDurable: true, verifiesSession: true, isReady: () => true,
      resolve: async () => ({ status: 'denied', code: 'learner-not-authorized' }),
    }
    const unavailableLearnerAuthorization = {
      isDurable: true, verifiesSession: true, isReady: () => true,
      resolve: async () => ({ status: 'unavailable', code: 'unavailable' }),
    }
    const cases: ReadonlyArray<readonly [string, number, () => Promise<{ statusCode: number }>]> = [
      // The three authorization-infrastructure sources. One semantic category,
      // one status — that is the point of the shared code.
      ['adult bearer: transport failed', 424, () => gateway({ auth: authUnreachable }).handler(classifyEvent())],
      ['adult bearer: hard timeout', 424, () => gateway({ auth: authTimedOut }).handler(classifyEvent())],
      ['learner/session verifier unavailable', 424, () => gateway({ auth: authVerified, learnerAuthorization: unavailableLearnerAuthorization }).handler(classifyEvent())],
      // Everything else on this route keeps its own status.
      ['gateway disabled', 503, () => gateway({ auth: authVerified, env: { ...ENV, ACADEMY_STUDY_ENABLED: 'false' } }).handler(classifyEvent())],
      ['auth not configured', 503, () => gateway({ auth: authVerified, env: { ACADEMY_STUDY_ENABLED: 'true', STUDY_SAFETY_RATE_LIMIT_HMAC_KEY: 'k' } }).handler(classifyEvent())],
      ['service not ready', 503, () => gateway({ auth: authVerified, rateLimiter: { isDurable: true, isReady: () => false, reserve: async () => ({ allowed: true }) } }).handler(classifyEvent())],
      ['rate limiter threw', 503, () => gateway({ auth: authVerified, rateLimiter: { isDurable: true, isReady: () => true, reserve: async () => { throw new Error('down') } } }).handler(classifyEvent())],
      ['rate limited', 429, () => gateway({ auth: authVerified, rateLimiter: { isDurable: true, isReady: () => true, reserve: async () => ({ allowed: false, retryAfterSeconds: 17 }) } }).handler(classifyEvent())],
      ['adult bearer refused', 401, () => gateway({ auth: authRefuses(401) }).handler(classifyEvent())],
      ['learner not authorized', 403, () => gateway({ auth: authVerified, learnerAuthorization: denyingLearnerAuthorization }).handler(classifyEvent())],
      ['method not allowed', 405, () => gateway({ auth: authVerified }).handler({ ...classifyEvent(), httpMethod: 'PUT' })],
      ['unknown path', 404, () => gateway({ auth: authVerified }).handler({ ...classifyEvent(), path: '/api/study/safety/other' })],
      ['query string present', 400, () => gateway({ auth: authVerified }).handler({ ...classifyEvent(), rawQuery: 'a=1' })],
      ['malformed body', 400, () => gateway({ auth: authVerified }).handler({ ...classifyEvent(), body: '{' })],
      ['unsupported content type', 415, () => gateway({ auth: authVerified }).handler({ ...classifyEvent(), headers: { authorization: `Bearer ${BEARER_SENTINEL}`, 'content-type': 'text/plain' } })],
      ['a clear classification', 200, () => gateway({ auth: authVerified }).handler(classifyEvent())],
      ['an urgent classification', 200, () => gateway({ auth: authVerified }).handler(classifyEvent('I want to die'))],
    ]
    const observed: Array<[string, number]> = []
    for (const [label, expected, run] of cases) {
      const result = await run()
      observed.push([label, result.statusCode])
      expect([label, result.statusCode]).toEqual([label, expected])
    }
    // The uniqueness pin itself: exactly the three authorization-infrastructure
    // sources produce 424, and every other condition on this route does not.
    expect(observed.filter(([, code]) => code === 424).map(([label]) => label)).toEqual([
      'adult bearer: transport failed',
      'adult bearer: hard timeout',
      'learner/session verifier unavailable',
    ])
  })

  // ── Phase 2 / 7 — the RED, through the whole real chain ──────────────────
  it.each(OUTAGES)('writes no learner-safety record through the whole chain when %s', async (_label, slug, auth) => {
    await mountSession({ suffix: `h2red${slug}`, fetchImpl: browserFetch(gateway({ auth })) })
    await submitAnswer(LEARNER_TEXT_SENTINEL)

    // Zero durable safety records, of either origin.
    expect(ledger()).toEqual([])
    for (const origin of ['local-pre-acceptance-stop', 'local-session-stop']) {
      expect(ledger().filter((record) => record.captureOrigin === origin)).toEqual([])
    }
    expect(events.map((event) => event.type)).not.toContain('safety-stop')
    expect(shim.cancellations).not.toContain('safety-stop')
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(false)
    // No false child-safety claim anywhere on the surface.
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(false)
    expect(container.childNodes[0]?.getAttribute('data-study-stopped')).toBe(null)
    // The technical copy, and only it.
    expect(hasText(container, STUDY_UNAVAILABLE_RETRY_MESSAGE)).toBe(true)
    expect(hasText(container, SESSION_UNAVAILABLE_MESSAGE)).toBe(false)
    expect(hasText(container, BUSY_RETRY_MESSAGE)).toBe(false)
    expect(events.map((event) => event.type)).not.toContain('session-completed')
  })

  // ── Phase 9 — identity survives an outage ────────────────────────────────
  it.each(OUTAGES)('does not clear a valid identity when %s', async (_label, slug, auth) => {
    await mountSession({ suffix: `h2id${slug}`, fetchImpl: browserFetch(gateway({ auth })) })
    await submitAnswer()
    expect(identityFailures).toEqual([])
  })

  it('still clears identity when the adult bearer is genuinely refused', async () => {
    await mountSession({ suffix: 'h2-401', fetchImpl: browserFetch(gateway({ auth: authRefuses(401) })) })
    await submitAnswer()

    expect(identityFailures).toEqual(['adult-authentication-rejected'])
    expect(hasText(container, SESSION_UNAVAILABLE_MESSAGE)).toBe(true)
    expect(hasText(container, STUDY_UNAVAILABLE_RETRY_MESSAGE)).toBe(false)
  })

  it('still clears the Study session when the learner authorization is genuinely refused', async () => {
    await mountSession({
      suffix: 'h2-403',
      fetchImpl: browserFetch(gateway({
        auth: authVerified,
        learnerAuthorization: {
          isDurable: true, verifiesSession: true, isReady: () => true,
          resolve: async () => ({ status: 'denied', code: 'learner-not-authorized' }),
        },
      })),
    })
    await submitAnswer()

    expect(identityFailures).toEqual(['study-session-rejected'])
    expect(hasText(container, SESSION_UNAVAILABLE_MESSAGE)).toBe(true)
    expect(hasText(container, STUDY_UNAVAILABLE_RETRY_MESSAGE)).toBe(false)
    expect(ledger()).toEqual([])
  })

  // ── Phase 8 — retry after the outage clears ──────────────────────────────
  it('lets the learner retry in place and recover once Supabase Auth returns', async () => {
    let down = true
    const target = gateway({ auth: async (url, init) => (down ? authUnreachable : authVerified)(url, init) })
    await mountSession({ suffix: 'h2-retry', fetchImpl: browserFetch(target) })
    await submitAnswer()

    const textarea = tags(container, 'TEXTAREA')[0]
    expect(textarea).toBeDefined()
    expect(reactProps(textarea!).disabled).not.toBe(true)
    expect(reactProps(textarea!).value).toBe('ready')
    expect(reactProps(control('Send through Tutor boundary')!).disabled).not.toBe(true)
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(false)

    down = false
    await submitAnswer()

    expect(hasText(container, STUDY_UNAVAILABLE_RETRY_MESSAGE)).toBe(false)
    expect(ledger()).toEqual([])
    expect(events.map((event) => event.type)).toContain('tutor-directive')
  })

  it('does not survive a refresh: an outage is not durable', async () => {
    await mountSession({ suffix: 'h2-refresh', fetchImpl: browserFetch(gateway({ auth: authUnreachable })) })
    await submitAnswer()
    expect(hasText(container, STUDY_UNAVAILABLE_RETRY_MESSAGE)).toBe(true)

    await remount()

    expect(hasText(container, STUDY_UNAVAILABLE_RETRY_MESSAGE)).toBe(false)
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(false)
    expect(tags(container, 'TEXTAREA')).toHaveLength(1)
  })

  it('keeps repeated outages free of any safety record and always retryable', async () => {
    await mountSession({ suffix: 'h2-repeat', fetchImpl: browserFetch(gateway({ auth: authTimedOut })) })
    for (let attempt = 0; attempt < 3; attempt += 1) await submitAnswer()

    expect(ledger()).toEqual([])
    expect(events.map((event) => event.type)).not.toContain('safety-stop')
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(false)
    expect(tags(container, 'TEXTAREA')).toHaveLength(1)
  })

  // ── Phase 10 — the safety control ────────────────────────────────────────
  it('still records a genuine learner-safety stop through the same real chain', async () => {
    await mountSession({ suffix: 'h2-control', fetchImpl: browserFetch(gateway({ auth: authVerified })) })
    await submitAnswer('I want to die')

    // The control that proves H2 did not globally weaken fail-closed safety:
    // a healthy adult bearer, a real urgent classification, full consequences.
    expect(ledger().length).toBeGreaterThan(0)
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(true)
    expect(events.map((event) => event.type)).toContain('safety-stop')
    expect(shim.cancellations).toContain('safety-stop')
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(true)
    expect(hasText(container, STUDY_UNAVAILABLE_RETRY_MESSAGE)).toBe(false)
  })

  it('records the genuine safety stop that follows an outage, and only that one', async () => {
    let down = true
    const target = gateway({ auth: async (url, init) => (down ? authUnreachable : authVerified)(url, init) })
    await mountSession({ suffix: 'h2-then-stop', fetchImpl: browserFetch(target) })
    await submitAnswer('I want to die')
    expect(ledger()).toEqual([])

    down = false
    await submitAnswer('I want to die')

    expect(ledger().filter((record) => record.captureOrigin === 'local-session-stop')).toHaveLength(1)
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(true)
  })

  // ── Phase 11 / 13 — no body authority, and the non-auth neighbours ───────
  // These bypass the handler and answer the browser directly, which is how a
  // CDN, an edge proxy or anything else that can speak on the gateway's behalf
  // would reach it. Each carries the *exact* wire code the adult bearer
  // verifier used to emit, so a classifier that read the body instead of the
  // status would reclassify every one of them as harmless infrastructure.
  function rawStatus(code: number, body: unknown): FetchLike {
    return async () => ({ ok: false, status: code, json: async () => body })
  }
  const AUTH_UNAVAILABLE_BODY = { error: { code: 'auth_unavailable' } }
  const UPSTREAM_TIMEOUT_BODY = { error: { code: 'upstream_timeout' } }

  const NON_AUTH_FAILURES: ReadonlyArray<readonly [string, string, FetchLike]> = [
    ['a 500 carrying auth_unavailable', 'body500', rawStatus(500, AUTH_UNAVAILABLE_BODY)],
    ['a 502 carrying auth_unavailable', 'body502', rawStatus(502, AUTH_UNAVAILABLE_BODY)],
    ['a generic 503 carrying auth_unavailable', 'body503', rawStatus(503, AUTH_UNAVAILABLE_BODY)],
    ['a generic 504 carrying upstream_timeout', 'body504', rawStatus(504, UPSTREAM_TIMEOUT_BODY)],
    ['an unrecognised 418 carrying auth_unavailable', 'body418', rawStatus(418, AUTH_UNAVAILABLE_BODY)],
    ['a malformed answer', 'bodymalformed', async () => ({ ok: true, json: async () => ({ nonsense: true }) })],
    ['a network failure', 'bodynetwork', async () => { throw new Error('network down') }],
  ]

  it.each(NON_AUTH_FAILURES)('still fails closed to a durable safety stop for %s', async (_label, slug, fetchImpl) => {
    await mountSession({ suffix: `h2neighbor${slug}`, fetchImpl })
    await submitAnswer()

    // A 503 or a 504 that did not come from the adult bearer verifier is not
    // this category, whatever its body says it is.
    expect(ledger().length).toBeGreaterThan(0)
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(true)
    expect(events.map((event) => event.type)).toContain('safety-stop')
    expect(shim.cancellations).toContain('safety-stop')
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(true)
    expect(hasText(container, STUDY_UNAVAILABLE_RETRY_MESSAGE)).toBe(false)
  })

  it('follows the trusted status, not a hostile body, on a real 424', async () => {
    // The mirror image of the attack above: a 424 whose body is doing its best
    // to be read as a learner safety stop. Nothing reads it.
    await mountSession({
      suffix: 'h2hostilebody',
      fetchImpl: rawStatus(424, {
        error: { code: 'urgent' },
        classification: 'urgent',
        learner: { message: STUDY_LEARNER_STOP_MESSAGE, mayContinue: false },
        failureMode: 'classifier-unreachable',
        continueToTutorCore: false,
      }),
    })
    await submitAnswer()

    expect(ledger()).toEqual([])
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(false)
    expect(events.map((event) => event.type)).not.toContain('safety-stop')
    expect(hasText(container, STUDY_UNAVAILABLE_RETRY_MESSAGE)).toBe(true)
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(false)
  })

  // ── Phase 14 — privacy ───────────────────────────────────────────────────
  it('shows the child no technical identifier and logs nothing sensitive', async () => {
    const consoleCalls: unknown[] = []
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => { consoleCalls.push(...args) })
    }
    const target = gateway({ auth: authUnreachable })
    await mountSession({ suffix: 'h2-privacy', fetchImpl: browserFetch(target) })
    await submitAnswer(LEARNER_TEXT_SENTINEL)

    const surface = renderedText(container)
    for (const forbidden of [
      '424', '503', '504', 'authorization_unavailable', 'auth_unavailable', 'upstream_timeout',
      'Supabase', 'gateway', 'credential', 'token', 'HTTP', 'bearer',
      BEARER_SENTINEL, SESSION_REFERENCE, LEARNER_TEXT_SENTINEL,
    ]) {
      expect(surface).not.toContain(forbidden)
    }
    const logged = consoleCalls.map((value) => String(value)).join(' ')
    const monitored = JSON.stringify(target.monitoringEvents)
    for (const forbidden of [LEARNER_TEXT_SENTINEL, BEARER_SENTINEL, SESSION_REFERENCE, context.householdRef]) {
      expect(logged).not.toContain(forbidden)
      expect(monitored).not.toContain(forbidden)
    }
    vi.restoreAllMocks()
  })
})
