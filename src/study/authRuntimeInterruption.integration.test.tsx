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
import { isSessionStoppedByLocalLedger, readLocalSafetyStops } from './safety/localStopLedger'
import { createSyntheticMathBlock } from './testing/syntheticStudyFixtures'
import type { StudyCancellationReason } from './lifecycle'
import type { StudyCalendarEntry, StudySafeEvent } from './types'

// STUDY-A1-AUTH-C — the whole boundary, end to end, through production code:
// real safety client → real mounted safety port → real runtime facade → real
// StudySessionContainer. A refused adult bearer, a refused Study session and an
// HTTP 429 must all fail closed without ever being recorded, locked, or shown as
// a learner safety incident. Everything that genuinely is one must be unchanged.

// STUDY-A1-COMP Phase 8 closed the hand-off this file used to shim: the App now
// owns one Study lifecycle and passes it to the container as a prop, so the
// binding arrives the way production supplies it rather than through a mocked
// module. The boundary below is the real one; only its `cancel` is observed, so
// the assertions about what a refused session must NOT cancel are unchanged.
const shim = vi.hoisted(() => ({ cancellations: [] as string[] }))

function hostStudyLifecycle(): HostStudyLifecycleSeam {
  const seam = createHostStudyLifecycleSeam({}, {
    authenticatedSessionRef: 'session:study-a1-auth-c',
    householdRef: 'household:synthetic-session12',
    learnerRef: 'learner:synthetic-grade5-math',
    launchGrantRef: 'grant:study-a1-auth-c',
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

/**
 * React attaches the live element props to the host node, which is how this
 * DOM-less shim invokes the container's own handlers. Event delegation needs a
 * bubbling tree the shim does not have, so a synthetic click cannot be used.
 */
function reactProps(node: FakeElement): Record<string, never> {
  const key = Object.keys(node).find((name) => name.startsWith('__reactProps$'))
  if (!key) throw new Error('React props are not attached to this node.')
  return (node as unknown as Record<string, Record<string, never>>)[key]!
}

const SESSION_UNAVAILABLE_MESSAGE = 'The Study session ended. Please ask your dad to sign in again. You are not in trouble.'
const BUSY_RETRY_MESSAGE = 'Study is busy right now. Wait a moment, then try again.'
const LEARNER_TEXT_SENTINEL = 'child-answer-sentinel'
const BEARER_SENTINEL = 'bearer-secret-sentinel'
const BODY_SENTINEL = 'body-secret-sentinel'
const SESSION_REFERENCE = 'aca_stu_v1_synthetic-study-session-reference-aaaaaaaaa'

type FetchLike = (url: string, init: RequestInit) => Promise<{ ok: boolean; status?: number; json(): Promise<unknown> }>

function status(code: number): FetchLike {
  return async () => ({
    ok: false,
    status: code,
    json: async () => ({ error: 'refused', detail: BODY_SENTINEL, sessionReference: SESSION_REFERENCE }),
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

describe('STUDY-A1-AUTH-C authorization and runtime interruption boundary', () => {
  let container: FakeElement
  let documentTarget: FakeDocument
  let storage: MemStorage
  let roots: Root[]
  let events: StudySafeEvent[]
  let ports: StudyPortBundle
  let entry: StudyCalendarEntry
  let stopKey: { studentRef: string; sessionRef: string }
  const context = syntheticGrade5StudyContext('math')

  beforeEach(() => {
    shim.cancellations.length = 0
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
    readonly timeoutMs?: number
  }

  /** One live Study session wired to the real mounted safety port. */
  async function mountSession(options: SessionOptions): Promise<void> {
    const mounted = createMountedStudyPorts({
      getAccessToken: options.getAccessToken ?? (async () => BEARER_SENTINEL),
      fetchImpl: options.fetchImpl ?? classification('clear'),
      sessionAuthorization: 'sessionAuthorization' in options ? options.sessionAuthorization : installedTransport(),
      timeoutMs: options.timeoutMs,
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
    // A page load builds the App's Study composition again, so each mount gets
    // the host lifecycle a fresh load would hand it.
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

  /**
   * Types one answer and sends it through the real Tutor boundary. The default
   * is the confirmation the surface asks for, which the Tutor bridge accepts as
   * well-formed input; a caller that needs a canary passes its own.
   */
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

  // ── RED 1 ────────────────────────────────────────────────────────────────
  it('does not turn a refused Study session (403) into a learner safety incident', async () => {
    await mountSession({ suffix: 'red-1-403', fetchImpl: status(403) })
    await submitAnswer()

    // Not a safety stop: no durable record, no lock, no Dad-visible event, no
    // safety-stop cancellation, and none of the safety-stop copy.
    expect(ledger()).toEqual([])
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(false)
    expect(events.map((event) => event.type)).not.toContain('safety-stop')
    expect(shim.cancellations).not.toContain('safety-stop')
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(false)
    expect(container.childNodes[0]?.getAttribute('data-study-stopped')).toBe(null)

    // A neutral session-unavailable state that cannot accept more Tutor work.
    expect(hasText(container, SESSION_UNAVAILABLE_MESSAGE)).toBe(true)
    expect(reactProps(tags(container, 'TEXTAREA')[0]!).disabled).toBe(true)
    expect(reactProps(control('Send through Tutor boundary')!).disabled).toBe(true)
  })

  // ── RED 2 ────────────────────────────────────────────────────────────────
  it('does not turn rate limiting (429) into a learner safety incident and stays retryable', async () => {
    await mountSession({ suffix: 'red-2-429', fetchImpl: status(429) })
    await submitAnswer()

    expect(ledger()).toEqual([])
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(false)
    expect(events.map((event) => event.type)).not.toContain('safety-stop')
    expect(shim.cancellations).not.toContain('safety-stop')
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(false)
    expect(container.childNodes[0]?.getAttribute('data-study-stopped')).toBe(null)

    // Busy, not stopped: the lesson stays alive and the learner may try again.
    expect(hasText(container, BUSY_RETRY_MESSAGE)).toBe(true)
    expect(reactProps(tags(container, 'TEXTAREA')[0]!).disabled).toBe(false)
    expect(reactProps(control('Send through Tutor boundary')!).disabled).toBe(false)
    expect(reactProps(control('Take a water break')!).disabled).toBe(false)
  })

  it('leaves the learner able to try again after a rate limit, with nothing recorded', async () => {
    let shed = true
    const classifications: string[] = []
    await mountSession({
      suffix: 'retry-429',
      fetchImpl: (url, init) => {
        classifications.push(String((JSON.parse(String(init.body)) as { transientText: string }).transientText))
        return (shed ? status(429) : status(403))(url, init)
      },
    })
    await submitAnswer()
    expect(hasText(container, BUSY_RETRY_MESSAGE)).toBe(true)
    expect(classifications).toHaveLength(1)
    // The answer she already typed is still in the field, so trying again costs
    // her nothing. It was never written anywhere outside this component.
    expect(reactProps(tags(container, 'TEXTAREA')[0]!).value).toBe('ready')

    // The retry genuinely reaches the classifier again — proved here by the
    // second request and by the surface moving to the other interruption.
    shed = false
    await submitAnswer()

    expect(classifications).toHaveLength(2)
    expect(hasText(container, BUSY_RETRY_MESSAGE)).toBe(false)
    expect(hasText(container, SESSION_UNAVAILABLE_MESSAGE)).toBe(true)
    expect(ledger()).toEqual([])
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(false)
    expect(events.map((event) => event.type)).not.toContain('safety-stop')
  })

  // ── Phase 8 — zero safety records for every authorization path ───────────
  const AUTHORIZATION_PATHS: ReadonlyArray<readonly [string, SessionOptions]> = [
    ['a missing adult bearer', { suffix: 'auth-missing-bearer', getAccessToken: async () => null }],
    ['a failing token store', { suffix: 'auth-token-store', getAccessToken: async () => { throw new Error('token store down') } }],
    ['a missing Study-session seam', { suffix: 'auth-missing-seam', sessionAuthorization: undefined }],
    ['a cleared Study-session seam', { suffix: 'auth-cleared-seam', sessionAuthorization: createStudySessionTransport() }],
    ['a throwing Study-session seam', {
      suffix: 'auth-throwing-seam',
      sessionAuthorization: { authorizeStudyRequestHeaders: () => { throw new Error('seam blew up') } },
    }],
    ['HTTP 401', { suffix: 'auth-401', fetchImpl: status(401) }],
    ['HTTP 403', { suffix: 'auth-403', fetchImpl: status(403) }],
    ['HTTP 429', { suffix: 'auth-429', fetchImpl: status(429) }],
  ]

  it.each(AUTHORIZATION_PATHS)('writes no local safety record of either kind for %s', async (_label, options) => {
    await mountSession(options)
    await submitAnswer()

    expect(ledger()).toEqual([])
    for (const origin of ['local-pre-acceptance-stop', 'local-session-stop']) {
      expect(ledger().filter((record) => record.captureOrigin === origin)).toEqual([])
    }
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(false)
    expect(events.map((event) => event.type)).not.toContain('safety-stop')
    expect(shim.cancellations).not.toContain('safety-stop')
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(false)
  })

  // ── Phase 8 — genuine safety paths keep their durable stop ───────────────
  const SAFETY_PATHS: ReadonlyArray<readonly [string, SessionOptions]> = [
    ['HTTP 500', { suffix: 'safety-500', fetchImpl: status(500) }],
    ['HTTP 502', { suffix: 'safety-502', fetchImpl: status(502) }],
    ['HTTP 503', { suffix: 'safety-503', fetchImpl: status(503) }],
    ['a classifier timeout', {
      suffix: 'safety-timeout',
      timeoutMs: 1,
      fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => { reject(new Error('aborted')) }, { once: true })
      }),
    }],
    ['a network failure', { suffix: 'safety-network', fetchImpl: async () => { throw new Error('network down') } }],
    ['a malformed classifier answer', { suffix: 'safety-malformed', fetchImpl: async () => ({ ok: true, json: async () => ({ nonsense: true }) }) }],
    ['an urgent classification', { suffix: 'safety-urgent', fetchImpl: classification('urgent') }],
    ['an uncertain classification', { suffix: 'safety-uncertain', fetchImpl: classification('uncertain') }],
  ]

  it.each(SAFETY_PATHS)('still records a durable safety stop and locks the session for %s', async (_label, options) => {
    await mountSession(options)
    await submitAnswer()

    expect(ledger().length).toBeGreaterThan(0)
    expect(ledger().filter((record) => record.captureOrigin === 'local-session-stop')).toHaveLength(1)
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(true)
    expect(events.map((event) => event.type)).toContain('safety-stop')
    expect(shim.cancellations).toContain('safety-stop')
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(true)
    expect(container.childNodes[0]?.getAttribute('data-study-stopped')).toBe('true')
    expect(tags(container, 'TEXTAREA')).toHaveLength(0)
  })

  // ── Phase 9 — adversarial ────────────────────────────────────────────────
  it('keeps repeated 403s and repeated 429s free of any safety record', async () => {
    await mountSession({ suffix: 'repeat-429', fetchImpl: status(429) })
    for (let attempt = 0; attempt < 3; attempt += 1) await submitAnswer()
    expect(ledger()).toEqual([])

    await mountSession({ suffix: 'repeat-403', fetchImpl: status(403) })
    for (let attempt = 0; attempt < 3; attempt += 1) {
      // The session-unavailable surface refuses further Tutor work, so only the
      // first attempt can reach the boundary at all.
      if (tags(container, 'TEXTAREA').length > 0 && reactProps(tags(container, 'TEXTAREA')[0]!).disabled !== true) {
        await submitAnswer()
      }
    }
    expect(ledger()).toEqual([])
    expect(events.map((event) => event.type)).not.toContain('safety-stop')
  })

  it('records the genuine classifier failure that follows a 403, and only that one', async () => {
    let refused = true
    await mountSession({
      suffix: 'order-403-then-500',
      fetchImpl: (url, init) => (refused ? status(403) : status(500))(url, init),
    })
    await submitAnswer()
    expect(ledger()).toEqual([])

    // The 403 disabled submission for this mount, so the classifier failure is
    // driven through a fresh mount of the same block, exactly as a reload would.
    refused = false
    await remount()
    await submitAnswer()

    expect(ledger().filter((record) => record.captureOrigin === 'local-session-stop')).toHaveLength(1)
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(true)
  })

  it('does not unlock a genuine safety stop when a later 403 arrives', async () => {
    let failing = true
    await mountSession({
      suffix: 'order-500-then-403',
      fetchImpl: (url, init) => (failing ? status(500) : status(403))(url, init),
    })
    await submitAnswer()
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(true)
    const recorded = ledger().length

    failing = false
    await remount()

    // The locked surface has no response field, so the 403 can never be reached.
    expect(tags(container, 'TEXTAREA')).toHaveLength(0)
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(true)
    expect(ledger()).toHaveLength(recorded)
  })

  it('cannot be talked into an interruption by a forged 200 answer', async () => {
    await mountSession({
      suffix: 'forged-200',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          schemaVersion: 1,
          classification: 'clear',
          learner: learnerSafeResult('clear'),
          continueToTutorCore: true,
          interruption: { kind: 'session-authorization', reason: 'study-session-rejected' },
        }),
      }),
    })
    await submitAnswer()

    // A forged body is a malformed classifier answer: a real safety stop.
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(true)
    expect(hasText(container, SESSION_UNAVAILABLE_MESSAGE)).toBe(false)
    expect(hasText(container, BUSY_RETRY_MESSAGE)).toBe(false)
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(true)
  })

  it('survives a refresh as an ordinary session, never as a lock, after 403 and after 429', async () => {
    for (const [suffix, code, copy] of [
      ['refresh-403', 403, SESSION_UNAVAILABLE_MESSAGE],
      ['refresh-429', 429, BUSY_RETRY_MESSAGE],
    ] as const) {
      await mountSession({ suffix, fetchImpl: status(code) })
      await submitAnswer()
      expect(hasText(container, copy)).toBe(true)

      // A refresh: same store, brand-new component instance.
      await remount()

      expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(false)
      expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(false)
      expect(container.childNodes[0]?.getAttribute('data-study-stopped')).toBe(null)
      expect(tags(container, 'TEXTAREA')).toHaveLength(1)
    }
  })

  it('leaks no bearer, session reference, server body or learner text into the surface, ledger or events', async () => {
    await mountSession({ suffix: 'no-leak', fetchImpl: status(403) })
    await submitAnswer(LEARNER_TEXT_SENTINEL)

    const exposed = JSON.stringify({
      surface: renderedText(container),
      ledger: ledger(),
      events,
      cancellations: shim.cancellations,
    })
    for (const secret of [BEARER_SENTINEL, BODY_SENTINEL, LEARNER_TEXT_SENTINEL, 'aca_stu_v1_', 'refused']) {
      expect(exposed).not.toContain(secret)
    }
  })
})
