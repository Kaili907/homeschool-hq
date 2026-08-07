import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { syntheticGrade5StudyContext } from './demonstrations'
import { createLocalDevelopmentStudyPorts } from './localDevelopmentPorts'
import type { StudyPortBundle } from './ports'
import { createHostStudyLifecycleSeam } from './composition/hostStudyLifecycle'
import { createSyntheticMathBlock } from './testing/syntheticStudyFixtures'
import type { StudyCalendarEntry, StudyScope } from './types'

// A6-5-C — the stop survives. A flagged learner who presses F5, navigates away
// and back, or opens a new tab must land on the locked surface, not on a fresh
// session that accepts input again.
//
// DOM harness adapted from src/App.studyRouteLifecycle.test.tsx; React's event
// delegation cannot be driven through this shim, so these tests assert what a
// mount renders and what it does to the ports, not synthetic clicks.

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
  return [
    ...(node.tagName === tag ? [node] : []),
    ...node.childNodes.flatMap((child) => tags(child, tag)),
  ]
}

const STOP_MESSAGE = 'The lesson is paused for now. Please go get your dad so he can sit with you. You are not in trouble.'

describe('A6-5-C durable student stop across remounts', () => {
  let container: FakeElement
  let documentTarget: FakeDocument
  let roots: Root[]
  let context: ReturnType<typeof syntheticGrade5StudyContext>
  let entry: StudyCalendarEntry
  let ports: StudyPortBundle
  let started: string[]
  let scope: StudyScope
  let stopKey: { studentRef: string; sessionRef: string }

  beforeEach(async () => {
    vi.resetModules()
    const store = new MemStorage()
    vi.stubGlobal('localStorage', store)
    documentTarget = new FakeDocument()
    const windowTarget = Object.assign(new EventTarget(), {
      document: documentTarget, setTimeout, clearTimeout, HTMLElement: FakeElement,
      HTMLIFrameElement: class {}, getSelection: () => null, navigator: { userAgent: 'test' },
      localStorage: store,
    })
    documentTarget.defaultView = windowTarget as never
    vi.stubGlobal('window', windowTarget)
    vi.stubGlobal('document', documentTarget)
    vi.stubGlobal('navigator', { userAgent: 'test' })
    container = documentTarget.createElement('div')
    documentTarget.body.appendChild(container)
    roots = []

    context = syntheticGrade5StudyContext('math')
    const local = createLocalDevelopmentStudyPorts()
    started = []
    const base = local.ports
    ports = {
      ...base,
      calendar: {
        ...base.calendar,
        start: (learnerScope, blockRef, at, operation) => {
          started.push(blockRef)
          return base.calendar.start(learnerScope, blockRef, at, operation)
        },
      },
    }
    entry = (await createSyntheticMathBlock(ports, { suffix: 'durable-stop' })).entry
    scope = {
      householdRef: context.householdRef,
      learnerRef: context.learnerRef,
      sessionRef: `${entry.blockRef}:session`,
    }
    stopKey = { studentRef: scope.learnerRef, sessionRef: scope.sessionRef }
  })

  afterEach(async () => {
    for (const root of roots) await act(async () => { root.unmount() })
    vi.unstubAllGlobals()
  })

  /** Drains the container's async launch chain. */
  async function settle(): Promise<void> {
    for (let tick = 0; tick < 8; tick += 1) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    }
  }

  /**
   * STUDY-A1-COMP Phase 8 — the App owns one Study lifecycle and hands it to the
   * container. A page load builds it again, so each mount below gets its own.
   */
  function hostStudyLifecycle() {
    return createHostStudyLifecycleSeam({}, {
      authenticatedSessionRef: 'session:a6-5-c-durable-stop',
      householdRef: context.householdRef,
      learnerRef: context.learnerRef,
      launchGrantRef: 'grant:a6-5-c-durable-stop',
      featureEnabled: true,
      authorizationRevision: 1,
    })
  }

  /** One fresh mount of the Study session, as a page load gives it. */
  async function mount(): Promise<FakeElement> {
    const { StudySessionContainer } = await import('../components/study/StudySessionContainer')
    const root = createRoot(container as never)
    roots.push(root)
    await act(async () => {
      root.render(
        <StudySessionContainer context={context} initialEntry={entry} ports={ports} studyLifecycle={hostStudyLifecycle()} onBack={() => {}} />,
      )
    })
    await settle()
    return container
  }

  async function unmountLast(): Promise<void> {
    const root = roots.pop()
    if (root) await act(async () => { root.unmount() })
  }

  it('does not lock a session that was never stopped', async () => {
    const { isSessionStoppedByLocalLedger } = await import('./safety/localStopLedger')
    const surface = await mount()
    expect(isSessionStoppedByLocalLedger(stopKey)).toBe(false)
    expect(hasText(surface, STOP_MESSAGE)).toBe(false)
    expect(surface.childNodes[0]?.getAttribute('data-study-stopped')).toBe(null)
  })

  it('is still stopped after a simulated refresh and cannot accept input', async () => {
    const { recordLocalSessionSafetyStop } = await import('./safety/localStopLedger')
    await recordLocalSessionSafetyStop({
      ...stopKey,
      occurredAt: '2026-08-05T14:00:00.000Z',
      serverCaptureStatus: 'server-answered-stop',
    })

    // A refresh: a brand-new module graph and a brand-new component instance,
    // with only localStorage carried across.
    vi.resetModules()
    started = []
    const surface = await mount()

    expect(hasText(surface, STOP_MESSAGE)).toBe(true)
    expect(tags(surface, 'TEXTAREA')).toHaveLength(0)
    expect(surface.childNodes[0]?.getAttribute('data-study-stopped')).toBe('true')
    // A locked session is never relaunched, so no calendar transition happens.
    expect(started).toEqual([])
  })

  it('is still stopped after navigating away and coming back', async () => {
    const { recordLocalSessionSafetyStop } = await import('./safety/localStopLedger')
    await recordLocalSessionSafetyStop({
      ...stopKey,
      occurredAt: '2026-08-05T14:00:00.000Z',
      serverCaptureStatus: 'server-answered-stop',
    })
    const first = await mount()
    expect(hasText(first, STOP_MESSAGE)).toBe(true)

    await unmountLast()
    const returned = await mount()

    expect(hasText(returned, STOP_MESSAGE)).toBe(true)
    expect(tags(returned, 'TEXTAREA')).toHaveLength(0)
  })

  it('is still stopped in a new tab, which shares the store but no component state', async () => {
    const { recordLocalSessionSafetyStop } = await import('./safety/localStopLedger')
    await recordLocalSessionSafetyStop({
      ...stopKey,
      occurredAt: '2026-08-05T14:00:00.000Z',
      serverCaptureStatus: 'server-acceptance-not-confirmed',
    })
    // A second tab: same origin store, its own module graph and its own root.
    vi.resetModules()
    const second = documentTarget.createElement('div')
    documentTarget.body.appendChild(second)
    const { StudySessionContainer } = await import('../components/study/StudySessionContainer')
    const root = createRoot(second as never)
    roots.push(root)
    await act(async () => {
      root.render(
        <StudySessionContainer context={context} initialEntry={entry} ports={ports} studyLifecycle={hostStudyLifecycle()} onBack={() => {}} />,
      )
    })
    await settle()

    expect(hasText(second, STOP_MESSAGE)).toBe(true)
    expect(tags(second, 'TEXTAREA')).toHaveLength(0)
  })

  it('offers the student no control that clears the lock', async () => {
    const { recordLocalSessionSafetyStop, isSessionStoppedByLocalLedger } = await import('./safety/localStopLedger')
    await recordLocalSessionSafetyStop({
      ...stopKey,
      occurredAt: '2026-08-05T14:00:00.000Z',
      serverCaptureStatus: 'server-answered-stop',
    })
    const surface = await mount()

    // One control only — "Back to Study plan" — and leaving does not unlock.
    expect(tags(surface, 'BUTTON')).toHaveLength(1)
    await unmountLast()
    expect(isSessionStoppedByLocalLedger(stopKey)).toBe(true)
    expect(hasText(await mount(), STOP_MESSAGE)).toBe(true)
  })

  it('locks only the stopped block, so another block still opens', async () => {
    const { recordLocalSessionSafetyStop } = await import('./safety/localStopLedger')
    await recordLocalSessionSafetyStop({
      ...stopKey,
      occurredAt: '2026-08-05T14:00:00.000Z',
      serverCaptureStatus: 'server-answered-stop',
    })
    const other = (await createSyntheticMathBlock(ports, { suffix: 'durable-stop-other' })).entry
    const { StudySessionContainer } = await import('../components/study/StudySessionContainer')
    const root = createRoot(container as never)
    roots.push(root)
    await act(async () => {
      root.render(
        <StudySessionContainer context={context} initialEntry={other} ports={ports} studyLifecycle={hostStudyLifecycle()} onBack={() => {}} />,
      )
    })
    await settle()
    expect(hasText(container, STOP_MESSAGE)).toBe(false)
    expect(container.childNodes[0]?.getAttribute('data-study-stopped')).toBe(null)
  })
})
