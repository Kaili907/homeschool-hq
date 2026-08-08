import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStudySessionTransport, type StudySessionAuthorization } from './client/studySessionTransport'
import {
  createHostStudyLifecycleSeam,
  type HostStudyLifecycleSeam,
} from './composition/hostStudyLifecycle'
import type { StudySessionGrant } from './contracts/identity/session'
import { syntheticGrade5StudyContext } from './demonstrations'
import { createMountedStudyPorts } from './mountedPorts'
import type { StudyPortBundle } from './ports'
import { STUDY_LEARNER_STOP_MESSAGE, learnerSafeResult } from './safety/learnerSafe'
import type { StudySessionAuthorizationFailure } from './safety/mountedPort'
import { isSessionStoppedByLocalLedger, readLocalSafetyStops } from './safety/localStopLedger'
import { createSyntheticMathBlock } from './testing/syntheticStudyFixtures'
import type { StudyCancellationReason } from './lifecycle'
import type { StudyCalendarEntry, StudySafeEvent } from './types'

// STUDY-A1-AUTH-INFRA-BOUNDARY-C — the whole boundary end to end through
// production code: real safety client → real mounted safety port → real runtime
// facade → real StudySessionContainer.
//
// The gateway answers `authorization_unavailable` when its learner-authorization
// verifier could not be reached at all. That happens BEFORE the classifier ever
// sees the learner's text and outside the ordinary learner-response path, so it
// is evidence about a server, not about a child. Before this card it arrived as
// a plain gateway error and StudySessionContainer wrote it to the durable A6-5-C
// safety ledger, locking the session and standing in her dad's record as a
// safety incident she had caused.
//
// Everything that genuinely is a safety incident, and everything structural,
// must be completely unchanged — which is what the fail-closed matrix below is
// for. The safety system is never globally disabled by this category.
const shim = vi.hoisted(() => ({ cancellations: [] as string[] }))

function hostStudyLifecycle(): HostStudyLifecycleSeam {
  const seam = createHostStudyLifecycleSeam({}, {
    authenticatedSessionRef: 'session:study-a1-auth-infra-c',
    householdRef: 'household:synthetic-session12',
    learnerRef: 'learner:synthetic-grade5-math',
    launchGrantRef: 'grant:study-a1-auth-infra-c',
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

/** Phase 12 — the exact learner copy this card fixes. */
const STUDY_UNAVAILABLE_RETRY_MESSAGE = 'Study is not available right now. Wait a moment, then try again.'
const SESSION_UNAVAILABLE_MESSAGE = 'The Study session ended. Please ask your dad to sign in again. You are not in trouble.'
const BUSY_RETRY_MESSAGE = 'Study is busy right now. Wait a moment, then try again.'
const LEARNER_TEXT_SENTINEL = 'child-answer-sentinel'
const BEARER_SENTINEL = 'bearer-secret-sentinel'
const BODY_SENTINEL = 'body-secret-sentinel'
const SESSION_REFERENCE = 'aca_stu_v1_synthetic-study-session-reference-aaaaaaaaa'

type FetchLike = (url: string, init: RequestInit) => Promise<{ ok: boolean; status?: number; json(): Promise<unknown> }>

/**
 * The gateway's own refusal body travels with every status, so a classifier that
 * ever reads it would find `authorization_unavailable` on statuses that must
 * stay on the safety side. That is the point: the body is identical everywhere.
 */
function status(code: number): FetchLike {
  return async () => ({
    ok: false,
    status: code,
    json: async () => ({
      error: { code: 'authorization_unavailable' },
      detail: BODY_SENTINEL,
      sessionReference: SESSION_REFERENCE,
    }),
  })
}

function classification(outcome: 'clear' | 'urgent' | 'uncertain'): FetchLike {
  return async () => ({
    ok: true,
    json: async () => ({
      schemaVersion: 1,
      classification: outcome,
      learner: learnerSafeResult(outcome),
      continueToTutorCore: outcome === 'clear',
    }),
  })
}

function installedTransport() {
  const transport = createStudySessionTransport()
  transport.install({
    schemaVersion: 1,
    status: 'issued',
    sessionReference: SESSION_REFERENCE,
    expiresAt: '2026-08-06T12:00:00.000Z',
  } as StudySessionGrant)
  return transport
}

describe('STUDY-A1-AUTH-INFRA-BOUNDARY-C authorization infrastructure boundary', () => {
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
    readonly fetchImpl?: FetchLike
    readonly getAccessToken?: () => Promise<string | null>
    readonly sessionAuthorization?: StudySessionAuthorization
  }

  /** One live Study session wired to the real mounted safety port. */
  async function mountSession(options: SessionOptions): Promise<void> {
    const mounted = createMountedStudyPorts({
      getAccessToken: options.getAccessToken ?? (async () => BEARER_SENTINEL),
      fetchImpl: options.fetchImpl ?? classification('clear'),
      sessionAuthorization: 'sessionAuthorization' in options ? options.sessionAuthorization : installedTransport(),
      // Phase 8 — the App clears the learner's verified identity from here. An
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

  // ── RED / Phase 11 — durable event proof ─────────────────────────────────
  it('writes no learner-safety durable record when the authorization verifier is unavailable', async () => {
    await mountSession({ suffix: 'infra-red-durable', fetchImpl: status(424) })
    await submitAnswer(LEARNER_TEXT_SENTINEL)

    // Zero durable safety records, of either origin, and no adult-visible
    // safety review: the classifier never judged this learner.
    expect(ledger()).toEqual([])
    for (const origin of ['local-pre-acceptance-stop', 'local-session-stop']) {
      expect(ledger().filter((record) => record.captureOrigin === origin)).toEqual([])
    }
    expect(events.map((event) => event.type)).not.toContain('safety-stop')
    expect(shim.cancellations).not.toContain('safety-stop')
    // No false child-safety classification anywhere on the surface.
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(false)
    expect(container.childNodes[0]?.getAttribute('data-study-stopped')).toBe(null)
  })

  // ── Phase 6 — container semantics ────────────────────────────────────────
  it('shows the exact technical-interruption copy and nothing about the learner', async () => {
    await mountSession({ suffix: 'infra-copy', fetchImpl: status(424) })
    await submitAnswer()

    expect(hasText(container, STUDY_UNAVAILABLE_RETRY_MESSAGE)).toBe(true)
    // Not the safety copy, not the ended-session copy, not the busy copy: this
    // is its own category and says so.
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(false)
    expect(hasText(container, SESSION_UNAVAILABLE_MESSAGE)).toBe(false)
    expect(hasText(container, BUSY_RETRY_MESSAGE)).toBe(false)
    // The session is not falsely completed.
    expect(events.map((event) => event.type)).not.toContain('session-completed')
  })

  // ── Phase 12/13 — copy and privacy ───────────────────────────────────────
  it('shows the child no technical identifier and logs nothing sensitive', async () => {
    const consoleCalls: unknown[] = []
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => { consoleCalls.push(...args) })
    }
    await mountSession({ suffix: 'infra-privacy', fetchImpl: status(424) })
    await submitAnswer(LEARNER_TEXT_SENTINEL)

    const surface = renderedText(container)
    for (const forbidden of [
      '424', '503', 'authorization_unavailable', 'RPC', 'Supabase', 'gateway',
      'credential', 'token', 'HTTP', BEARER_SENTINEL, BODY_SENTINEL, SESSION_REFERENCE,
    ]) {
      expect(surface).not.toContain(forbidden)
    }
    // Nothing about the learner's own words is shown back or logged.
    expect(surface).not.toContain(LEARNER_TEXT_SENTINEL)
    const logged = consoleCalls.map((value) => String(value)).join(' ')
    for (const forbidden of [LEARNER_TEXT_SENTINEL, BEARER_SENTINEL, BODY_SENTINEL, SESSION_REFERENCE, context.householdRef]) {
      expect(logged).not.toContain(forbidden)
    }
    vi.restoreAllMocks()
  })

  // ── Phase 7/8 — retry and identity ───────────────────────────────────────
  it('keeps the learner able to retry, and recovers on the next successful attempt', async () => {
    let unavailable = true
    await mountSession({
      suffix: 'infra-retry',
      fetchImpl: (url, init) => (unavailable ? status(424) : classification('clear'))(url, init),
    })
    await submitAnswer()

    // Retryable in place: the answer she already typed is put back and the
    // surface is still live. A refused session would have disabled all of this.
    const textarea = tags(container, 'TEXTAREA')[0]
    expect(textarea).toBeDefined()
    expect(reactProps(textarea!).disabled).not.toBe(true)
    expect(reactProps(textarea!).value).toBe('ready')
    expect(reactProps(control('Send through Tutor boundary')!).disabled).not.toBe(true)
    // No durable lock stands in the way of the retry.
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(false)

    unavailable = false
    await submitAnswer()

    // The outage copy is gone and real Tutor work resumed on the same session.
    expect(hasText(container, STUDY_UNAVAILABLE_RETRY_MESSAGE)).toBe(false)
    expect(ledger()).toEqual([])
    expect(events.map((event) => event.type)).toContain('tutor-directive')
  })

  it('does not clear verified identity when only the verifier was unavailable', async () => {
    await mountSession({ suffix: 'infra-identity', fetchImpl: status(424) })
    await submitAnswer()

    // The App's identity-clearing callback is the one that signs the adult out
    // and drops the learner's Study session. An outage must never reach it.
    expect(identityFailures).toEqual([])
  })

  // ── Phase 9 — fail-closed matrix ─────────────────────────────────────────
  // Every one of these carries the identical `authorization_unavailable` body,
  // so any classifier that read prose instead of the status would wrongly
  // reclassify all of them.
  const SAFETY_PATHS: ReadonlyArray<readonly [string, SessionOptions]> = [
    ['service_not_ready / gateway_disabled (503)', { suffix: 'closed-503', fetchImpl: status(503) }],
    ['a generic 500', { suffix: 'closed-500', fetchImpl: status(500) }],
    ['a 502 from the edge', { suffix: 'closed-502', fetchImpl: status(502) }],
    ['an unrecognised 418', { suffix: 'closed-418', fetchImpl: status(418) }],
    ['a malformed classifier answer', { suffix: 'closed-malformed', fetchImpl: async () => ({ ok: true, json: async () => ({ nonsense: true }) }) }],
    ['a network failure', { suffix: 'closed-network', fetchImpl: async () => { throw new Error('network down') } }],
    ['an urgent classification', { suffix: 'closed-urgent', fetchImpl: classification('urgent') }],
    ['an uncertain classification', { suffix: 'closed-uncertain', fetchImpl: classification('uncertain') }],
  ]

  it.each(SAFETY_PATHS)('still records a durable safety stop and locks the session for %s', async (_label, options) => {
    await mountSession(options)
    await submitAnswer()

    // The control that proves the safety system was not globally disabled.
    expect(ledger().length).toBeGreaterThan(0)
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(true)
    expect(events.map((event) => event.type)).toContain('safety-stop')
    expect(shim.cancellations).toContain('safety-stop')
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(true)
    expect(hasText(container, STUDY_UNAVAILABLE_RETRY_MESSAGE)).toBe(false)
  })

  // The two neighbouring lifecycle categories keep their own copy and their own
  // recovery: this card adds a third, it does not absorb them.
  it('leaves a refused Study session (403) on its own path', async () => {
    await mountSession({ suffix: 'closed-403', fetchImpl: status(403) })
    await submitAnswer()

    expect(hasText(container, SESSION_UNAVAILABLE_MESSAGE)).toBe(true)
    expect(hasText(container, STUDY_UNAVAILABLE_RETRY_MESSAGE)).toBe(false)
    expect(identityFailures).toEqual(['study-session-rejected'])
    expect(ledger()).toEqual([])
  })

  it('leaves a shed request (429) on its own path', async () => {
    await mountSession({ suffix: 'closed-429', fetchImpl: status(429) })
    await submitAnswer()

    expect(hasText(container, BUSY_RETRY_MESSAGE)).toBe(true)
    expect(hasText(container, STUDY_UNAVAILABLE_RETRY_MESSAGE)).toBe(false)
    expect(ledger()).toEqual([])
  })

  it('leaves a refused adult bearer (401) on its own path', async () => {
    await mountSession({ suffix: 'closed-401', fetchImpl: status(401) })
    await submitAnswer()

    expect(hasText(container, SESSION_UNAVAILABLE_MESSAGE)).toBe(true)
    expect(hasText(container, STUDY_UNAVAILABLE_RETRY_MESSAGE)).toBe(false)
    expect(identityFailures).toEqual(['adult-authentication-rejected'])
  })

  // ── Phase 9 — adversarial ────────────────────────────────────────────────
  it('does not unlock a genuine safety stop when an outage follows it', async () => {
    let flagged = true
    await mountSession({
      suffix: 'infra-after-stop',
      fetchImpl: (url, init) => (flagged ? classification('urgent') : status(424))(url, init),
    })
    await submitAnswer()
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(true)
    const recorded = ledger().length

    flagged = false
    await remount()

    // The locked surface has no response field, so the outage can never be
    // reached, and nothing about it clears the stop.
    expect(tags(container, 'TEXTAREA')).toHaveLength(0)
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(true)
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(true)
    expect(ledger()).toHaveLength(recorded)
  })

  it('records the genuine safety stop that follows an outage, and only that one', async () => {
    let unavailable = true
    await mountSession({
      suffix: 'infra-then-stop',
      fetchImpl: (url, init) => (unavailable ? status(424) : classification('urgent'))(url, init),
    })
    await submitAnswer()
    expect(ledger()).toEqual([])

    unavailable = false
    await submitAnswer()

    expect(ledger().filter((record) => record.captureOrigin === 'local-session-stop')).toHaveLength(1)
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(true)
  })

  it('keeps repeated outages free of any safety record and always retryable', async () => {
    await mountSession({ suffix: 'infra-repeat', fetchImpl: status(424) })
    for (let attempt = 0; attempt < 3; attempt += 1) await submitAnswer()

    expect(ledger()).toEqual([])
    expect(events.map((event) => event.type)).not.toContain('safety-stop')
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(false)
    expect(tags(container, 'TEXTAREA')).toHaveLength(1)
  })

  it('does not survive a refresh: an outage is not durable', async () => {
    await mountSession({ suffix: 'infra-refresh', fetchImpl: status(424) })
    await submitAnswer()
    expect(hasText(container, STUDY_UNAVAILABLE_RETRY_MESSAGE)).toBe(true)

    await remount()

    expect(hasText(container, STUDY_UNAVAILABLE_RETRY_MESSAGE)).toBe(false)
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(false)
    expect(tags(container, 'TEXTAREA')).toHaveLength(1)
  })
})
