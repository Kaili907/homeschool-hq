import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createHostStudyLifecycleSeam,
  type HostStudyLifecycleSeam,
} from '../../study/composition/hostStudyLifecycle'
import { syntheticGrade5StudyContext } from '../../study/demonstrations'
import type { StudyLifecycleBinding } from '../../study/lifecycle'
import { createLocalDevelopmentStudyPorts } from '../../study/localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from '../../study/ports'
import { createSyntheticMathBlock } from '../../study/testing/syntheticStudyFixtures'
import type { StudyCalendarEntry } from '../../study/types'
import { StudySessionContainer } from './StudySessionContainer'

// STUDY-A1-PROD-SEAM C5. The App derives the host seam during render, so an
// ordinary re-render — a sync tick, a theme change, a status transition — calls
// in again for the SAME launch.
//
// A boundary that cancelled itself inside `beginEpoch` (its grant had already
// expired, or the feature had been switched off) has a null binding, and the seam
// was cached against that binding. Null never matched, so every render minted a
// new seam AND re-ran `acquireHostStudyLifecycle`, starting a fresh epoch. A new
// seam object is a new `studyLifecycle` prop identity, which re-runs the
// container's effect, whose cleanup cancels the epoch as `navigation-away` and
// prepares the session again from the top.
//
// Measured here at the boundary's own epoch counter, through the real container.

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

const context = syntheticGrade5StudyContext('math')

function baseBinding(overrides: Partial<StudyLifecycleBinding> = {}): StudyLifecycleBinding {
  return {
    authenticatedSessionRef: 'host-lifecycle:prod-seam-stability',
    householdRef: context.householdRef,
    learnerRef: context.learnerRef,
    launchGrantRef: 'opaque-grant-epoch:1',
    featureEnabled: true,
    authorizationRevision: 1,
    ...overrides,
  }
}

describe('host Study seam stability through the real session container', () => {
  let container: FakeElement
  let documentTarget: FakeDocument
  let roots: Root[]
  let ports: StudyPortBundle
  let entry: StudyCalendarEntry
  /** Armed only after the first render, so it gates a turn and not the prepare. */
  let classifierGate: Promise<void> | null
  let releaseClassifier: (() => void) | null

  beforeEach(async () => {
    documentTarget = new FakeDocument()
    const windowTarget = Object.assign(new EventTarget(), {
      document: documentTarget, setTimeout, clearTimeout, HTMLElement: FakeElement,
      HTMLIFrameElement: class {}, getSelection: () => null, navigator: { userAgent: 'test' },
      localStorage: new MemStorage(),
    })
    documentTarget.defaultView = windowTarget as never
    vi.stubGlobal('window', windowTarget)
    vi.stubGlobal('document', documentTarget)
    vi.stubGlobal('navigator', { userAgent: 'test' })
    vi.stubGlobal('localStorage', new MemStorage())
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = documentTarget.createElement('div')
    documentTarget.body.appendChild(container)
    roots = []
    classifierGate = null
    releaseClassifier = null

    const gatedSafety: StudySafetyPort = {
      mode: 'production',
      classifierVersion: 'test-study-a1-prod-seam-v1',
      evaluate: async () => {
        if (classifierGate) await classifierGate
        return { outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }
      },
    }
    const local = createLocalDevelopmentStudyPorts()
    ports = { ...local.ports, safety: gatedSafety }
    const created = await createSyntheticMathBlock(ports, {
      suffix: `prod-seam-${Math.random().toString(36).slice(2, 8)}`,
    })
    entry = created.entry
  })

  afterEach(async () => {
    releaseClassifier?.()
    for (const root of roots) await act(async () => root.unmount())
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function session(seam: HostStudyLifecycleSeam) {
    return (
      <StudySessionContainer
        context={context}
        initialEntry={entry}
        ports={ports}
        studyLifecycle={seam}
        onBack={() => {}}
      />
    )
  }

  async function render(node: React.ReactElement) {
    const root = createRoot(container as unknown as Element)
    roots.push(root)
    await act(async () => root.render(node))
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    return root
  }

  it('does not cancel a turn already at the classifier when a benign re-render lands', async () => {
    const owner = {}
    const first = createHostStudyLifecycleSeam(owner, baseBinding())
    const root = await render(session(first))
    const token = first.boundary.token()
    expect(token.isCurrent()).toBe(true)

    const textarea = tags(container, 'TEXTAREA')[0]
    expect(textarea).toBeDefined()
    await act(async () => {
      (reactProps(textarea!) as unknown as { onChange: (event: unknown) => void })
        .onChange({ target: { value: 'ready' } })
    })

    // Hold the classifier so the turn is genuinely in flight.
    classifierGate = new Promise<void>((resolve) => { releaseClassifier = resolve })
    const submit = tags(container, 'BUTTON').find((node) => hasText(node, 'Send through Tutor boundary'))
    expect(submit).toBeDefined()
    let pending: Promise<void> | null = null
    await act(async () => {
      pending = (reactProps(submit!) as unknown as { onClick: () => Promise<void> }).onClick()
    })
    // The turn really is in flight: nothing has been accepted yet.
    expect(hasText(container, 'Your Tutor Core check was accepted')).toBe(false)

    // The re-render a sync tick or a status transition produces: the App derives
    // the seam again for the same launch, mid-turn.
    const second = createHostStudyLifecycleSeam(owner, baseBinding())
    expect(second).toBe(first)
    await act(async () => { root.render(session(second)) })

    releaseClassifier!()
    await act(async () => { await pending })
    await act(async () => { await Promise.resolve() })

    // The turn survived: the epoch it was running under was never cancelled, and
    // the girl was not told her answer could not be accepted.
    expect(token.isCurrent()).toBe(true)
    expect(first.boundary.lastReason).not.toBe('navigation-away')
    expect(hasText(container, 'The Tutor result could not be accepted.')).toBe(false)
    expect(hasText(container, 'Your Tutor Core check was accepted')).toBe(true)
  })

  it('does not restart the epoch on re-renders once an expired grant cancelled it', async () => {
    const owner = {}
    const expired = baseBinding({ expiresAt: new Date(Date.now() - 60_000).toISOString() })
    const first = createHostStudyLifecycleSeam(owner, expired)
    expect(first.boundary.binding).toBeNull()
    expect(first.boundary.lastReason).toBe('grant-expired')

    const root = await render(session(first))
    const mounted = first.boundary.token().epoch

    for (let pass = 0; pass < 5; pass += 1) {
      const next = createHostStudyLifecycleSeam(owner, { ...expired })
      expect(next).toBe(first)
      await act(async () => { root.render(session(next)) })
      await act(async () => { await Promise.resolve() })
    }

    // No render started a new epoch, so the container's effect never re-ran and
    // never cancelled anything as `navigation-away`.
    expect(first.boundary.token().epoch).toBe(mounted)
  })

  it('does not restart the epoch on re-renders once the feature was switched off', async () => {
    const owner = {}
    const disabled = baseBinding({ featureEnabled: false })
    const first = createHostStudyLifecycleSeam(owner, disabled)
    expect(first.boundary.binding).toBeNull()
    expect(first.boundary.lastReason).toBe('feature-disabled')

    const root = await render(session(first))
    const mounted = first.boundary.token().epoch

    for (let pass = 0; pass < 5; pass += 1) {
      const next = createHostStudyLifecycleSeam(owner, { ...disabled })
      expect(next).toBe(first)
      await act(async () => { root.render(session(next)) })
      await act(async () => { await Promise.resolve() })
    }
    expect(first.boundary.token().epoch).toBe(mounted)
    // A disabled epoch stays unusable — stability is not a way back in.
    expect(first.boundary.token().isCurrent()).toBe(false)
  })

  it('still re-epochs and re-runs the surface when the learner genuinely changes', async () => {
    const owner = {}
    const first = createHostStudyLifecycleSeam(owner, baseBinding())
    const root = await render(session(first))
    const token = first.boundary.token()
    const mounted = token.epoch
    expect(token.isCurrent()).toBe(true)

    const second = createHostStudyLifecycleSeam(owner, baseBinding({ learnerRef: 'learner:another-child' }))
    expect(second).not.toBe(first)
    expect(second.boundary).toBe(first.boundary)
    await act(async () => { root.render(session(second)) })
    await act(async () => { await Promise.resolve() })

    // The previous learner's token is stale and the epoch genuinely moved on.
    expect(token.isCurrent()).toBe(false)
    expect(second.boundary.token().epoch).toBeGreaterThan(mounted)
  })
})
