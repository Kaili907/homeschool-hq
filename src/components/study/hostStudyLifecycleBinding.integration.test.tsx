import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createHostStudyLifecycleSeam,
  type HostStudyLifecycleSeam,
} from '../../study/composition/hostStudyLifecycle'
import { syntheticGrade5StudyContext } from '../../study/demonstrations'
import { StudyLifecycleBoundary, runCurrentStudyWork } from '../../study/lifecycle'
import { createLocalDevelopmentStudyPorts } from '../../study/localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from '../../study/ports'
import { STUDY_LEARNER_STOP_MESSAGE } from '../../study/safety/learnerSafe'
import { isSessionStoppedByLocalLedger, readLocalSafetyStops } from '../../study/safety/localStopLedger'
import { isStudyBridgeOpaqueId } from '../../study/studyRequestRef'
import { createSyntheticMathBlock } from '../../study/testing/syntheticStudyFixtures'
import type { StudyCalendarEntry } from '../../study/types'
import { StudySessionContainer } from './StudySessionContainer'
import { StudySessionRoute } from './StudySessionRoute'

// STUDY-A1-COMP Phase 8. StudySessionRoute and StudySessionContainer each built
// their own `new StudyLifecycleBoundary()` with no binding. That boundary has no
// controller and no binding, so every token it issues is already stale and every
// guarded operation aborts before it starts — their live production paths were
// dead, and only their failure surfaces were ever reachable.
//
// The App now owns one boundary for the active Study launch and hands the same
// seam to both, which is what these tests exercise: one epoch, invalidated once,
// rejecting stale work from either surface.

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

const clearSafety: StudySafetyPort = {
  mode: 'production',
  classifierVersion: 'test-study-a1-comp-binding-v1',
  evaluate: async () => ({ outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }),
}

const context = syntheticGrade5StudyContext('math')

function hostSeam(overrides: Partial<Parameters<typeof createHostStudyLifecycleSeam>[1]> = {}): HostStudyLifecycleSeam {
  return createHostStudyLifecycleSeam({}, {
    authenticatedSessionRef: 'host-lifecycle:study-a1-comp',
    householdRef: context.householdRef,
    learnerRef: context.learnerRef,
    launchGrantRef: 'opaque-grant-epoch:1',
    featureEnabled: true,
    authorizationRevision: 1,
    ...overrides,
  })
}

describe('host-owned Study lifecycle binding for the route and the container', () => {
  let container: FakeElement
  let documentTarget: FakeDocument
  let roots: Root[]
  let ports: StudyPortBundle
  let entry: StudyCalendarEntry

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

    const local = createLocalDevelopmentStudyPorts()
    ports = { ...local.ports, safety: clearSafety }
    const created = await createSyntheticMathBlock(ports, {
      suffix: `binding-${Math.random().toString(36).slice(2, 8)}`,
    })
    entry = created.entry
  })

  afterEach(async () => {
    for (const root of roots) await act(async () => root.unmount())
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  async function render(node: React.ReactElement) {
    const root = createRoot(container as unknown as Element)
    roots.push(root)
    await act(async () => root.render(node))
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    return root
  }

  it('shows why an unbound boundary makes a live path unreachable', async () => {
    // The root cause, isolated: a boundary built with no binding hands out
    // tokens that are stale before any work begins.
    const unbound = new StudyLifecycleBoundary()
    expect(unbound.token().isCurrent()).toBe(false)
    await expect(runCurrentStudyWork(unbound.token(), async () => 'never')).rejects.toThrow()

    // The host-owned seam is the opposite: its token is current straight away.
    const seam = hostSeam()
    expect(seam.boundary.token().isCurrent()).toBe(true)
    await expect(runCurrentStudyWork(seam.boundary.token(), async () => 'reached')).resolves.toBe('reached')
  })

  it('reaches the live session surface through the real route with the host binding', async () => {
    const seam = hostSeam()
    await render(
      <StudySessionRoute
        context={context}
        ports={ports}
        studyLifecycle={seam}
        blockRef={entry.blockRef}
        learnerRef={context.learnerRef}
        onBack={() => {}}
      />,
    )
    // The route resolved the learner-scoped block and handed off to the
    // container, which prepared the session. None of this was reachable with an
    // unbound boundary.
    expect(hasText(container, 'The learner-scoped Study block could not be loaded safely.')).toBe(false)
    expect(hasText(container, 'This Study Session could not start safely.')).toBe(false)
    expect(hasText(container, entry.title)).toBe(true)
    expect(hasText(container, 'Send through Tutor boundary')).toBe(true)
  })

  it('operates the real container on the same host binding', async () => {
    const seam = hostSeam()
    await render(
      <StudySessionContainer
        context={context}
        initialEntry={entry}
        ports={ports}
        studyLifecycle={seam}
        onBack={() => {}}
      />,
    )
    expect(hasText(container, 'This Study Session could not start safely.')).toBe(false)
    const textarea = tags(container, 'TEXTAREA')[0]
    expect(textarea).toBeDefined()

    await act(async () => {
      (reactProps(textarea!) as unknown as { onChange: (event: unknown) => void })
        .onChange({ target: { value: 'ready' } })
    })
    const submit = tags(container, 'BUTTON').find((node) => hasText(node, 'Send through Tutor boundary'))
    expect(submit).toBeDefined()
    await act(async () => {
      await (reactProps(submit!) as unknown as { onClick: () => Promise<void> }).onClick()
    })
    await act(async () => { await Promise.resolve() })

    // A clear turn is accepted and the completion is recorded: nothing about
    // this turn was a safety stop, and nothing failed on the way through the
    // calendar, the ledger or persistence.
    expect(hasText(container, 'Study paused')).toBe(false)
    expect(hasText(container, 'The Tutor result could not be accepted.')).toBe(false)
    expect(hasText(container, 'Your Tutor Core check was accepted')).toBe(true)
  })

  it('mints a request reference the Tutor bridge admits, whatever the block is called', async () => {
    // The container's own construction, observed at the runtime seam it calls.
    const facade = await import('../../study/runtimeFacade')
    const refs: string[] = []
    const original = facade.AcceptedRc1HostRuntime.prototype.submit
    vi.spyOn(facade.AcceptedRc1HostRuntime.prototype, 'submit').mockImplementation(
      function (this: InstanceType<typeof facade.AcceptedRc1HostRuntime>, input) {
        refs.push(input.requestRef)
        return original.call(this, input)
      },
    )

    // A block reference at the top of what the calendar runtime itself admits,
    // which is where the legacy request reference overshot the Tutor bridge.
    const longLesson = 'manuel-academy:mathematics:level-5:unit-04:lesson-03:multiplying-whole-numbers'
    const long = await createSyntheticMathBlock(ports, { suffix: longLesson })
    expect(long.entry.blockRef.length).toBeGreaterThan(120)
    const seam = hostSeam()
    await render(
      <StudySessionContainer
        context={context}
        initialEntry={long.entry}
        ports={ports}
        studyLifecycle={seam}
        onBack={() => {}}
      />,
    )
    const textarea = tags(container, 'TEXTAREA')[0]
    expect(textarea).toBeDefined()
    await act(async () => {
      (reactProps(textarea!) as unknown as { onChange: (event: unknown) => void })
        .onChange({ target: { value: 'ready' } })
    })
    const submit = tags(container, 'BUTTON').find((node) => hasText(node, 'Send through Tutor boundary'))
    await act(async () => {
      await (reactProps(submit!) as unknown as { onClick: () => Promise<void> }).onClick()
    })

    expect(refs).toHaveLength(1)
    expect(refs[0]!.length).toBeLessThanOrEqual(128)
    expect(isStudyBridgeOpaqueId(refs[0]!)).toBe(true)
    // The block reference alone is longer than the whole request reference.
    expect(long.entry.blockRef.length).toBeGreaterThan(refs[0]!.length)
  })

  // STUDY-A1-SESSIONREF-C. The container derives `${blockRef}:session` and that
  // value reaches the Tutor bridge as `sessionId`, where the same 128-character
  // opaque-id bound applies. An Academy-length block overshoots it, the gateway
  // refuses the turn before the classifier runs, and the container recorded that
  // refusal in the durable A6-5-C ledger as a learner safety stop.
  it('does not turn an Academy-length session reference into a durable safety stop', async () => {
    const longLesson = 'manuel-academy:mathematics:level-5:unit-04:lesson-03:multiplying-whole-numbers'
    const long = await createSyntheticMathBlock(ports, { suffix: longLesson })
    const sessionRef = `${long.entry.blockRef}:session`
    // The reference the container actually builds is over the bridge's bound.
    expect(isStudyBridgeOpaqueId(sessionRef)).toBe(false)
    expect(sessionRef.length).toBeGreaterThan(128)

    await render(
      <StudySessionContainer
        context={context}
        initialEntry={long.entry}
        ports={ports}
        studyLifecycle={hostSeam()}
        onBack={() => {}}
      />,
    )
    const textarea = tags(container, 'TEXTAREA')[0]
    expect(textarea).toBeDefined()
    await act(async () => {
      (reactProps(textarea!) as unknown as { onChange: (event: unknown) => void })
        .onChange({ target: { value: 'ready' } })
    })
    const submit = tags(container, 'BUTTON').find((node) => hasText(node, 'Send through Tutor boundary'))
    await act(async () => {
      await (reactProps(submit!) as unknown as { onClick: () => Promise<void> }).onClick()
    })
    await act(async () => { await Promise.resolve() })

    // Nothing durable was written, so no adult sees a safety incident and no
    // refresh finds this session locked.
    expect(readLocalSafetyStops(window.localStorage)).toEqual([])
    expect(isSessionStoppedByLocalLedger(
      { studentRef: context.learnerRef, sessionRef },
      window.localStorage,
    )).toBe(false)
    // And a clear "ready" is an ordinary accepted turn.
    expect(hasText(container, 'Study paused')).toBe(false)
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(false)
    expect(hasText(container, 'Your Tutor Core check was accepted')).toBe(true)
  })

  it('keeps a genuine stop durable on that same Academy-length session reference', async () => {
    // The durable A6-5-C key is the Study session reference, unchanged by this
    // card. A real classifier stop must still lock the session across remounts.
    const longLesson = 'manuel-academy:mathematics:level-5:unit-04:lesson-03:multiplying-whole-numbers'
    const long = await createSyntheticMathBlock(ports, { suffix: longLesson })
    const sessionRef = `${long.entry.blockRef}:session`
    const flagged: StudyPortBundle = {
      ...ports,
      safety: {
        mode: 'production',
        classifierVersion: 'test-study-a1-sessionref-urgent-v1',
        evaluate: async () => ({
          outcome: 'urgent' as const,
          mayContinue: false,
          adultHelpState: 'proposed-not-delivered' as const,
        }),
      },
    }
    await render(
      <StudySessionContainer
        context={context}
        initialEntry={long.entry}
        ports={flagged}
        studyLifecycle={hostSeam()}
        onBack={() => {}}
      />,
    )
    const textarea = tags(container, 'TEXTAREA')[0]
    await act(async () => {
      (reactProps(textarea!) as unknown as { onChange: (event: unknown) => void })
        .onChange({ target: { value: 'ready' } })
    })
    const submit = tags(container, 'BUTTON').find((node) => hasText(node, 'Send through Tutor boundary'))
    await act(async () => {
      await (reactProps(submit!) as unknown as { onClick: () => Promise<void> }).onClick()
    })
    await act(async () => { await Promise.resolve() })

    expect(hasText(container, 'Study paused')).toBe(true)
    const records = readLocalSafetyStops(window.localStorage)
    expect(records).toHaveLength(1)
    // Recorded against the durable Study session reference, not a bridge value.
    expect(records[0]!.sessionRef).toBe(sessionRef)
    expect(isSessionStoppedByLocalLedger(
      { studentRef: context.learnerRef, sessionRef },
      window.localStorage,
    )).toBe(true)

    // A remount of the same genuine session — a refresh, or a new tab — is
    // still stopped, and offers no way back in.
    const remounted = documentTarget.createElement('div')
    documentTarget.body.appendChild(remounted)
    const remountRoot = createRoot(remounted as unknown as Element)
    roots.push(remountRoot)
    await act(async () => remountRoot.render(
      <StudySessionContainer
        context={context}
        initialEntry={long.entry}
        ports={flagged}
        studyLifecycle={hostSeam()}
        onBack={() => {}}
      />,
    ))
    await act(async () => { await Promise.resolve() })
    expect(hasText(remounted, 'Study paused')).toBe(true)
    expect(hasText(remounted, 'Send through Tutor boundary')).toBe(false)
  })

  it('is the same seam for the same epoch, so a host re-render is not a relaunch', async () => {
    // The App derives this seam during render, so an ordinary re-render — a sync
    // status tick, a theme change — calls in again for the SAME launch. When that
    // produced a new object, the prop identity the route and the container hold
    // it by changed, their effects re-ran, and the cleanup cancelled the epoch as
    // `navigation-away` before preparing the session again from the top.
    //
    // Measured at the runtime, not at a message: a girl whose answer was already
    // with the classifier when the re-render landed had that turn aborted and was
    // told "The Tutor result could not be accepted."
    const facade = await import('../../study/runtimeFacade')
    let launches = 0
    const originalLaunch = facade.AcceptedRc1HostRuntime.prototype.launch
    vi.spyOn(facade.AcceptedRc1HostRuntime.prototype, 'launch').mockImplementation(
      function (this: InstanceType<typeof facade.AcceptedRc1HostRuntime>, ...args) {
        launches += 1
        return originalLaunch.apply(this, args)
      },
    )

    const owner = {}
    const binding = hostSeam().binding
    const first = createHostStudyLifecycleSeam(owner, binding)
    const root = await render(
      <StudySessionContainer
        context={context}
        initialEntry={entry}
        ports={ports}
        studyLifecycle={first}
        onBack={() => {}}
      />,
    )
    expect(launches).toBe(1)
    const token = first.boundary.token()

    const second = createHostStudyLifecycleSeam(owner, binding)
    expect(second).toBe(first)
    await act(async () => {
      root.render(
        <StudySessionContainer
          context={context}
          initialEntry={entry}
          ports={ports}
          studyLifecycle={second}
          onBack={() => {}}
        />,
      )
    })
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })

    // The session was not prepared a second time, and the epoch the in-flight
    // work is running under was never cancelled.
    expect(launches).toBe(1)
    expect(token.isCurrent()).toBe(true)
    expect(first.boundary.lastReason).not.toBe('navigation-away')
    expect(hasText(container, 'This Study Session could not start safely.')).toBe(false)
    expect(hasText(container, 'Send through Tutor boundary')).toBe(true)
  })

  it('rejects container work once the host boundary is invalidated by a learner change', async () => {
    const seam = hostSeam()
    await render(
      <StudySessionContainer
        context={context}
        initialEntry={entry}
        ports={ports}
        studyLifecycle={seam}
        onBack={() => {}}
      />,
    )
    const token = seam.boundary.token()
    expect(token.isCurrent()).toBe(true)

    // The App switching learners re-epochs the one boundary both surfaces share.
    seam.boundary.beginEpoch({ ...seam.binding, learnerRef: 'learner:another-child' })
    expect(token.isCurrent()).toBe(false)
    expect(seam.boundary.lastReason).toBe('learner-switch')
    await expect(runCurrentStudyWork(token, async () => 'stale')).rejects.toThrow()
  })

  it('rejects route and container work once the host boundary is cleared by logout', async () => {
    const seam = hostSeam()
    await render(
      <StudySessionRoute
        context={context}
        ports={ports}
        studyLifecycle={seam}
        blockRef={entry.blockRef}
        learnerRef={context.learnerRef}
        onBack={() => {}}
      />,
    )
    const token = seam.boundary.token()
    seam.boundary.cancel('logout')
    expect(token.isCurrent()).toBe(false)
    expect(seam.boundary.lastReason).toBe('logout')
    await expect(runCurrentStudyWork(token, async () => 'stale')).rejects.toThrow()
  })

  it('gives the route and the container one boundary, not two unrelated ones', async () => {
    const owner = {}
    const binding = hostSeam().binding
    const first = createHostStudyLifecycleSeam(owner, binding)
    const second = createHostStudyLifecycleSeam(owner, binding)
    expect(second.boundary).toBe(first.boundary)
    // And a cancellation on one is a cancellation on the other.
    const token = first.boundary.token()
    second.boundary.cancel('logout')
    expect(token.isCurrent()).toBe(false)
  })

  it('returns the same seam object while the epoch is unchanged', () => {
    // The App derives this during render, so an ordinary re-render calls in
    // again for the same launch. A new object each time would change the prop
    // identity the route and the container hold it by, re-running their effects
    // — whose cleanup cancels the epoch as `navigation-away` and restarts the
    // session, aborting a turn already at the classifier.
    const owner = {}
    const binding = {
      authenticatedSessionRef: 'host-lifecycle:stability',
      householdRef: context.householdRef,
      learnerRef: context.learnerRef,
      launchGrantRef: 'opaque-grant-epoch:1',
      featureEnabled: true,
      authorizationRevision: 1,
    }
    // A fresh binding literal each call, exactly as a render produces.
    const first = createHostStudyLifecycleSeam(owner, { ...binding })
    for (let render = 0; render < 20; render += 1) {
      expect(createHostStudyLifecycleSeam(owner, { ...binding })).toBe(first)
    }
  })

  it('returns a new seam when the epoch genuinely changes', () => {
    const owner = {}
    const binding = {
      authenticatedSessionRef: 'host-lifecycle:stability',
      householdRef: context.householdRef,
      learnerRef: context.learnerRef,
      launchGrantRef: 'opaque-grant-epoch:1',
      featureEnabled: true,
      authorizationRevision: 1,
    }
    const first = createHostStudyLifecycleSeam(owner, { ...binding })
    const token = first.boundary.token()
    // A different learner is a different epoch, and both surfaces must see it.
    const second = createHostStudyLifecycleSeam(owner, { ...binding, learnerRef: 'learner:another-child' })
    expect(second).not.toBe(first)
    expect(second.boundary).toBe(first.boundary)
    expect(token.isCurrent()).toBe(false)
    expect(first.boundary.lastReason).toBe('learner-switch')
  })

  it('carries no Study session reference and no bearer in the binding it shares', () => {
    const seam = hostSeam()
    const serialized = JSON.stringify(seam.binding)
    // No opaque Study-session reference and no bearer value. `authorizationRevision`
    // is a counter, not a credential, so the check is for the shapes a secret
    // would actually take.
    expect(serialized).not.toMatch(/aca_stu_v1_/)
    expect(serialized).not.toMatch(/Bearer\s/i)
    expect(serialized).not.toMatch(/eyJ/)
    // Host-local epoch labels only. The seam carries the boundary's own
    // normalized binding, which also names the optional lifetime and identity
    // epoch fields, so this is a closed set rather than an exact list — an
    // unexpected key is still a failure.
    expect(Object.keys(seam.binding).sort().filter((key) => ![
      'authenticatedSessionRef',
      'authorizationRevision',
      'expiresAt',
      'featureEnabled',
      'householdRef',
      'identityEpochs',
      'launchGrantRef',
      'learnerRef',
    ].includes(key))).toEqual([])
    expect(seam.binding.authenticatedSessionRef).toBe('host-lifecycle:study-a1-comp')
    expect(seam.binding.learnerRef).toBe(context.learnerRef)
  })
})
