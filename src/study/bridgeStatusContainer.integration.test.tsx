import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createHostStudyLifecycleSeam,
  type HostStudyLifecycleSeam,
} from './composition/hostStudyLifecycle'
import { syntheticGrade5StudyContext } from './demonstrations'
import { createLocalDevelopmentStudyPorts } from './localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from './ports'
import { STUDY_LEARNER_STOP_MESSAGE } from './safety/learnerSafe'
import { isSessionStoppedByLocalLedger, readLocalSafetyStops } from './safety/localStopLedger'
import { createSyntheticMathBlock } from './testing/syntheticStudyFixtures'
import type { StudyCancellationReason } from './lifecycle'
import type { StudyCalendarEntry, StudySafeEvent } from './types'

// STUDY-A1-BRIDGE-STATUS-C, at the surface a child actually sees.
//
// The runtime boundary is proved in bridgeStatusBoundary.integration.test.ts.
// This file asks the other half of the question: what does StudySessionContainer
// do with each class? A structural Tutor bridge failure must leave no durable
// safety record, no learner safety event, no permanent lock and no safety-stop
// cancellation — and a genuine classifier stop must keep every one of them.
//
// DOM harness as in durableSafetyStop.integration.test.tsx and
// authRuntimeInterruption.integration.test.tsx; React's event delegation cannot
// be driven through this shim, so the container's own handlers are invoked
// through the props React attaches to each host node.

const shim = vi.hoisted(() => ({ cancellations: [] as string[] }))

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

const TECHNICAL_FAILURE_MESSAGE = 'The Tutor result could not be accepted. No completion was recorded.'
const OVER_LONG = 'x'.repeat(140)

const alwaysClear: StudySafetyPort = {
  mode: 'production',
  classifierVersion: 'test-study-a1-bridge-status-container-clear-v1',
  evaluate: async () => ({ outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }),
}

function classifyingPort(outcome: 'urgent' | 'uncertain'): StudySafetyPort {
  return {
    mode: 'production',
    classifierVersion: `test-study-a1-bridge-status-container-${outcome}-v1`,
    evaluate: async () => ({ outcome, mayContinue: false, adultHelpState: 'proposed-not-delivered' as const }),
  }
}

describe('STUDY-A1-BRIDGE-STATUS-C at the Study session surface', () => {
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

  function hostStudyLifecycle(): HostStudyLifecycleSeam {
    const seam = createHostStudyLifecycleSeam({}, {
      authenticatedSessionRef: 'session:study-a1-bridge-status-c',
      householdRef: context.householdRef,
      learnerRef: context.learnerRef,
      launchGrantRef: 'grant:study-a1-bridge-status-c',
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

  interface SessionOptions {
    readonly suffix: string
    /** How the durable event ledger answers the bridge's accepted-event append. */
    readonly ledgerAnswer?: 'duplicate-ignored' | 'idempotency-collision'
    /** A persisted block whose lesson reference exceeds the bridge's bound. */
    readonly legacyLessonRef?: boolean
    readonly safety?: StudySafetyPort
  }

  async function mountSession(options: SessionOptions): Promise<void> {
    const { ports: local } = createLocalDevelopmentStudyPorts()
    const base: StudyPortBundle = { ...local, safety: options.safety ?? alwaysClear }
    ports = {
      ...base,
      eventLedger: {
        append: (scope, event, operation) => {
          events.push(event)
          if (options.ledgerAnswer && event.type === 'tutor-directive') {
            return Promise.resolve(options.ledgerAnswer)
          }
          return base.eventLedger.append(scope, event, operation)
        },
      },
      ...(options.legacyLessonRef
        ? {
            calendar: {
              ...base.calendar,
              start: async (scope, blockRef, at, operation) => ({
                ...(await base.calendar.start(scope, blockRef, at, operation)),
                lessonRef: `manuel-academy:legacy:${OVER_LONG}`,
              }),
            },
          }
        : {}),
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

  const STRUCTURAL_PATHS: ReadonlyArray<readonly [string, SessionOptions]> = [
    ['an event-ledger collision on the accepted event', { suffix: 'structural-collision', ledgerAnswer: 'idempotency-collision' }],
    ['a replayed accepted event', { suffix: 'structural-duplicate', ledgerAnswer: 'duplicate-ignored' }],
    ['a persisted lesson reference past the bridge bound', { suffix: 'structural-legacy-lesson', legacyLessonRef: true }],
  ]

  it.each(STRUCTURAL_PATHS)('writes no learner safety incident for %s', async (_label, options) => {
    await mountSession(options)
    await submitAnswer()

    // Not a safety stop: nothing durable, no lock, no adult-visible safety event,
    // no safety-stop cancellation, and none of the safety-stop copy.
    expect(ledger()).toEqual([])
    for (const origin of ['local-pre-acceptance-stop', 'local-session-stop']) {
      expect(ledger().filter((record) => record.captureOrigin === origin)).toEqual([])
    }
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(false)
    expect(events.map((event) => event.type)).not.toContain('safety-stop')
    expect(shim.cancellations).not.toContain('safety-stop')
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(false)
    expect(container.childNodes[0]?.getAttribute('data-study-stopped')).toBe(null)
  })

  it.each(STRUCTURAL_PATHS)('fails closed with neutral technical copy for %s', async (_label, options) => {
    await mountSession(options)
    await submitAnswer()

    // Neutral and technical: it says the result was not accepted and that nothing
    // was recorded. It makes no claim about the learner and names no service,
    // session or adult account.
    expect(hasText(container, TECHNICAL_FAILURE_MESSAGE)).toBe(true)
    // No Tutor work continues from here: the segment is not completed and the
    // surface offers no way to send another turn on this mount.
    expect(events.map((event) => event.type)).not.toContain('session-completed')
    expect(tags(container, 'TEXTAREA')).toHaveLength(0)
    expect(control('Send through Tutor boundary')).toBeUndefined()
  })

  it.each(STRUCTURAL_PATHS)('survives a refresh as an ordinary session after %s', async (_label, options) => {
    await mountSession(options)
    await submitAnswer()
    expect(hasText(container, TECHNICAL_FAILURE_MESSAGE)).toBe(true)

    // A refresh: same store, brand-new component instance. A technical refusal
    // is not a safety incident, so it must not outlive the mount that saw it.
    await remount()

    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(false)
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(false)
    expect(container.childNodes[0]?.getAttribute('data-study-stopped')).toBe(null)
    expect(tags(container, 'TEXTAREA')).toHaveLength(1)
  })

  const SAFETY_PATHS: ReadonlyArray<readonly [string, SessionOptions, string]> = [
    ['an urgent classification', { suffix: 'safety-urgent', safety: classifyingPort('urgent') }, 'ready'],
    ['an uncertain classification', { suffix: 'safety-uncertain', safety: classifyingPort('uncertain') }, 'ready'],
    ['the bridge escalating above a clear host classifier', { suffix: 'safety-bridge-urgent' }, 'i want to die'],
    ['learner text the gateway refuses before classifying it', { suffix: 'safety-input-limit' }, 'a'.repeat(5_000)],
    // The host's own safety port classifies before the bridge is reached, so a
    // session whose identifiers can never satisfy the bridge still stops durably
    // for a child in trouble rather than showing her a technical failure.
    ['an urgent classification behind a structurally broken session', { suffix: 'safety-urgent-broken', safety: classifyingPort('urgent'), legacyLessonRef: true }, 'ready'],
  ]

  it.each(SAFETY_PATHS)('still records a durable safety stop and locks the session for %s', async (_label, options, text) => {
    await mountSession(options)
    await submitAnswer(text)

    expect(ledger().filter((record) => record.captureOrigin === 'local-session-stop')).toHaveLength(1)
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(true)
    expect(events.map((event) => event.type)).toContain('safety-stop')
    expect(shim.cancellations).toContain('safety-stop')
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(true)
    expect(container.childNodes[0]?.getAttribute('data-study-stopped')).toBe('true')
    expect(tags(container, 'TEXTAREA')).toHaveLength(0)
  })

  it('does not let a structural failure clear a lock a real stop already wrote', async () => {
    await mountSession({ suffix: 'lock-then-structural', safety: classifyingPort('urgent') })
    await submitAnswer()
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(true)
    const recorded = ledger().length

    // The same block reopened with a structural failure waiting for it.
    ports = {
      ...ports,
      safety: alwaysClear,
      eventLedger: {
        append: (scope, event, operation) => {
          events.push(event)
          return event.type === 'tutor-directive'
            ? Promise.resolve('idempotency-collision' as const)
            : ports.eventLedger.append(scope, event, operation)
        },
      },
    }
    await remount()

    // The locked surface has no response field, so the structural path is never
    // reached, and the lock is untouched.
    expect(tags(container, 'TEXTAREA')).toHaveLength(0)
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(true)
    expect(ledger()).toHaveLength(recorded)
  })

  it('records the genuine stop that follows a structural failure, and only that one', async () => {
    let structural = true
    const { ports: local } = createLocalDevelopmentStudyPorts()
    let safetyOutcome: 'clear' | 'urgent' = 'clear'
    ports = {
      ...local,
      safety: {
        mode: 'production',
        classifierVersion: 'test-study-a1-bridge-status-container-switching-v1',
        evaluate: async () => safetyOutcome === 'clear'
          ? { outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }
          : { outcome: 'urgent', mayContinue: false, adultHelpState: 'proposed-not-delivered' },
      },
      eventLedger: {
        append: (scope, event, operation) => {
          events.push(event)
          return structural && event.type === 'tutor-directive'
            ? Promise.resolve('idempotency-collision' as const)
            : local.eventLedger.append(scope, event, operation)
        },
      },
    }
    entry = (await createSyntheticMathBlock(ports, { suffix: 'structural-then-genuine' })).entry
    stopKey = { studentRef: context.learnerRef, sessionRef: `${entry.blockRef}:session` }
    await remount()

    await submitAnswer()
    expect(ledger()).toEqual([])

    // The structural refusal replaced the live surface for this mount, so the
    // genuine stop is driven through a fresh mount, exactly as a reload would.
    structural = false
    safetyOutcome = 'urgent'
    await remount()
    await submitAnswer()

    expect(ledger().filter((record) => record.captureOrigin === 'local-session-stop')).toHaveLength(1)
    expect(isSessionStoppedByLocalLedger(stopKey, storage)).toBe(true)
  })

  it('leaks no learner text into the surface, the ledger or the events on a structural failure', async () => {
    await mountSession({ suffix: 'structural-no-leak', ledgerAnswer: 'idempotency-collision' })
    await submitAnswer('child-answer-sentinel')

    const exposed = JSON.stringify({
      surface: renderedText(container),
      ledger: ledger(),
      events,
      cancellations: shim.cancellations,
    })
    expect(exposed).not.toContain('child-answer-sentinel')
  })
})
