import { act, StrictMode, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createHostStudyLifecycleSeam,
  hostStudyLifecycleBoundary,
  type HostStudyLifecycleSeam,
} from '../../study/composition/hostStudyLifecycle'
import { syntheticGrade5StudyContext } from '../../study/demonstrations'
import type { StudyLifecycleBinding } from '../../study/lifecycle'
import { createLocalDevelopmentStudyPorts } from '../../study/localDevelopmentPorts'
import type { StudyPortBundle } from '../../study/ports'
import { AcceptedRc1HostRuntime } from '../../study/runtimeFacade'
import { createSyntheticMathBlock } from '../../study/testing/syntheticStudyFixtures'
import type { StudyCalendarEntry } from '../../study/types'
import { StudySessionRoute } from './StudySessionRoute'

// STUDY-A1-STRICTMODE-PREVIEW. `main.tsx` wraps the App in `<StrictMode>` and the
// Study preview surface is DEV-only, so every real preview mount IS a StrictMode
// mount — and StrictMode deliberately runs
//
//   effect setup → effect cleanup → effect setup
//
// inside one commit, with no render between them. The route and the container
// cancelled the App's shared epoch from their effect cleanup, so that probe
// destroyed the authority the second setup then had to attach to; and because
// `joinHostStudyLifecycle` is correctly attach-only, nothing could put it back.
// The App's own revival runs during RENDER, and the probe schedules none, so
// preview settled on binding = null, lastReason = 'navigation-away' and a learner
// surface stuck on "Rechecking…" forever. Every preview mount, not a race.
//
// Witnessed on the parent commit (dd00922) exactly as written below, then fixed.
//
// These drive the REAL preview path — an App-shaped owner deriving the seam during
// render, the real `StudySessionRoute`, the real container underneath it, and real
// `<StrictMode>`. Never a hand-written setup/cleanup/setup simulation.

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

const RECHECKING = 'Rechecking the selected learner and calendar block'
const PREPARING = 'Checking the runtime and learner binding'

const context = syntheticGrade5StudyContext('math')

function baseBinding(overrides: Partial<StudyLifecycleBinding> = {}): StudyLifecycleBinding {
  return {
    authenticatedSessionRef: 'host-study-epoch:strictmode-preview',
    householdRef: context.householdRef,
    learnerRef: context.learnerRef,
    launchGrantRef: 'host-study-launch:strictmode-preview',
    featureEnabled: true,
    authorizationRevision: 1,
    ...overrides,
  }
}

describe('the preview Study surface under real React StrictMode', () => {
  let container: FakeElement
  let documentTarget: FakeDocument
  let roots: Root[]
  let ports: StudyPortBundle
  let entry: StudyCalendarEntry
  /** Every durable Study write the mount path can make, in the order it made it. */
  let durable: string[]
  let launches: number

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
    durable = []
    launches = 0

    const local = createLocalDevelopmentStudyPorts()
    const created = await createSyntheticMathBlock(local.ports, {
      suffix: `strictmode-${Math.random().toString(36).slice(2, 8)}`,
    })
    entry = created.entry
    // Recorded after the fixture is built, so only the surface's own writes count.
    ports = {
      ...local.ports,
      calendar: {
        ...local.ports.calendar,
        start: (...args) => { durable.push('calendar.start'); return local.ports.calendar.start(...args) },
        resume: (...args) => { durable.push('calendar.resume'); return local.ports.calendar.resume(...args) },
        completeCurrentSegment: (...args) => {
          durable.push('calendar.completeCurrentSegment')
          return local.ports.calendar.completeCurrentSegment(...args)
        },
      },
      eventLedger: {
        ...local.ports.eventLedger,
        append: (scope, event) => { durable.push(`ledger.${event.type}`); return local.ports.eventLedger.append(scope, event) },
      },
      persistence: {
        ...local.ports.persistence,
        saveSession: (record) => { durable.push('persistence.saveSession'); return local.ports.persistence.saveSession(record) },
      },
    }
    const realLaunch = AcceptedRc1HostRuntime.prototype.launch
    vi.spyOn(AcceptedRc1HostRuntime.prototype, 'launch').mockImplementation(function (this: AcceptedRc1HostRuntime, ...args) {
      launches += 1
      return realLaunch.apply(this, args)
    })
  })

  afterEach(async () => {
    for (const root of roots) await act(async () => root.unmount())
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /**
   * The App's shape, reduced to what this blocker turns on: the seam is derived
   * during the owner's RENDER, which is why StrictMode's effect replay — which
   * runs no render between the cleanup and the second setup — cannot be rescued by
   * the owner's own revival path.
   */
  function PreviewHost({ owner, binding, mounted = true, learnerRef = context.learnerRef }: {
    owner: object
    binding: StudyLifecycleBinding
    mounted?: boolean
    learnerRef?: string
  }) {
    const seam = createHostStudyLifecycleSeam(owner, binding)
    if (!mounted) return <p>Study plan</p>
    return (
      <StudySessionRoute
        context={context}
        ports={ports}
        studyLifecycle={seam}
        blockRef={entry.blockRef}
        learnerRef={learnerRef}
        onBack={() => {}}
      />
    )
  }

  /** The surface with NO owner re-deriving authority — a logged-out App. */
  function orphanedSurface(seam: HostStudyLifecycleSeam) {
    return (
      <StudySessionRoute
        context={context}
        ports={ports}
        studyLifecycle={seam}
        blockRef={entry.blockRef}
        learnerRef={context.learnerRef}
        onBack={() => {}}
      />
    )
  }

  async function settle() {
    for (let pass = 0; pass < 8; pass += 1) await act(async () => { await Promise.resolve() })
  }

  async function mount(node: React.ReactElement) {
    const root = createRoot(container as unknown as Element)
    roots.push(root)
    await act(async () => root.render(node))
    await settle()
    return root
  }

  function live(): boolean {
    return tags(container, 'TEXTAREA').length > 0
  }

  // PHASE 18. The harness has to be honest about what it is testing: if this
  // environment did not actually replay effects, every StrictMode assertion below
  // would pass for the wrong reason. The loose Probe is the control — same tree,
  // same commit, one setup.
  it('really does replay the mount effect under StrictMode and not without it', async () => {
    const setups: string[] = []
    function Probe({ label }: { label: string }) {
      useEffect(() => { setups.push(label) }, [label])
      return null
    }
    await mount(
      <>
        <StrictMode><Probe label="strict" /></StrictMode>
        <Probe label="loose" />
      </>,
    )
    expect(setups.filter((label) => label === 'strict')).toHaveLength(2)
    expect(setups.filter((label) => label === 'loose')).toHaveLength(1)
  })

  // PHASE 7.
  it('mounts on the authority the App already holds, without a probe cancelling it', async () => {
    const owner = {}
    const seam = createHostStudyLifecycleSeam(owner, baseBinding())
    expect(seam.boundary.binding).not.toBeNull()
    const born = seam.boundary.token().epoch

    await mount(<StrictMode><PreviewHost owner={owner} binding={baseBinding()} /></StrictMode>)

    // The epoch is untouched: same one, still current, never navigation-away.
    expect(seam.boundary.binding).not.toBeNull()
    expect(seam.boundary.lastReason).not.toBe('navigation-away')
    expect(seam.boundary.token().isCurrent()).toBe(true)
    expect(seam.boundary.token().epoch).toBe(born)
    // And the learner is on the session, not on a permanent loading state.
    expect(hasText(container, RECHECKING)).toBe(false)
    expect(hasText(container, PREPARING)).toBe(false)
    expect(live()).toBe(true)
  })

  // PHASE 18 control: the same mount without StrictMode must reach the same
  // place, so the test above is about the replay and not about mounting at all.
  it('reaches the same place without StrictMode, so the replay is what is proven', async () => {
    const owner = {}
    const seam = createHostStudyLifecycleSeam(owner, baseBinding())
    const born = seam.boundary.token().epoch

    await mount(<PreviewHost owner={owner} binding={baseBinding()} />)

    expect(seam.boundary.token().isCurrent()).toBe(true)
    expect(seam.boundary.token().epoch).toBe(born)
    expect(live()).toBe(true)
  })

  // PHASE 8. The replay must cost nothing durable. Measured against the
  // non-StrictMode control in the same file, so "once" is the surface's real
  // preparation cost and not a number copied from a passing run.
  it('makes no duplicate durable write across the StrictMode replay', async () => {
    const owner = {}
    createHostStudyLifecycleSeam(owner, baseBinding())
    await mount(<StrictMode><PreviewHost owner={owner} binding={baseBinding()} /></StrictMode>)
    const replayed = [...durable]
    const replayedLaunches = launches

    // Exactly one session start, one calendar transition, one launch event and
    // one session record — no second authority, no second learner session.
    expect(replayedLaunches).toBe(1)
    expect(replayed.filter((call) => call === 'calendar.start')).toHaveLength(1)
    expect(replayed.filter((call) => call === 'calendar.resume')).toHaveLength(0)
    expect(replayed.filter((call) => call === 'ledger.session-launched')).toHaveLength(1)
    expect(replayed.filter((call) => call === 'persistence.saveSession')).toHaveLength(1)
    expect(hostStudyLifecycleBoundary(owner).token().isCurrent()).toBe(true)

    // And that is the same bill the single-setup mount runs up.
    for (const root of roots.splice(0)) await act(async () => root.unmount())
    durable = []
    launches = 0
    const loose = {}
    createHostStudyLifecycleSeam(loose, baseBinding())
    const created = await createSyntheticMathBlock(ports, { suffix: `control-${Math.random().toString(36).slice(2, 8)}` })
    entry = created.entry
    durable = []
    await mount(<PreviewHost owner={loose} binding={baseBinding()} />)
    expect(launches).toBe(replayedLaunches)
    expect(durable).toEqual(replayed)
  })

  // PHASE 8, the second half: the probe must not leave a stale surface token
  // behind. The re-armed binding key is what the Tutor turn checks, and the
  // probe's cleanup used to close it permanently.
  it('leaves the replayed surface able to take a Tutor turn', async () => {
    const owner = {}
    // A safety service that answers, so the turn reaches Tutor Core rather than
    // the local-development fail-closed stop. What is under test here is the host
    // binding the probe used to leave closed, not the classifier.
    ports = {
      ...ports,
      safety: {
        mode: 'production',
        classifierVersion: 'test-study-a1-strictmode-v1',
        evaluate: async () => ({ outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }),
      },
    }
    createHostStudyLifecycleSeam(owner, baseBinding())
    await mount(<StrictMode><PreviewHost owner={owner} binding={baseBinding()} /></StrictMode>)

    const textarea = tags(container, 'TEXTAREA')[0]
    expect(textarea).toBeDefined()
    const props = (node: FakeElement) => {
      const key = Object.keys(node).find((name) => name.startsWith('__reactProps$'))
      if (!key) throw new Error('React props are not attached to this node.')
      return (node as unknown as Record<string, Record<string, never>>)[key]!
    }
    await act(async () => {
      (props(textarea!) as unknown as { onChange: (event: unknown) => void }).onChange({ target: { value: 'ready' } })
    })
    const submit = tags(container, 'BUTTON').find((node) => hasText(node, 'Send through Tutor boundary'))
    expect(submit).toBeDefined()
    await act(async () => { await (props(submit!) as unknown as { onClick: () => Promise<void> }).onClick() })
    await settle()

    // The turn went through the boundary and was accepted. A surface the probe
    // had left closed is quarantined as `stale-host-binding`, which the container
    // surfaces as "The Tutor result could not be accepted." with no completion.
    expect(hasText(container, 'The Tutor result could not be accepted.')).toBe(false)
    expect(hasText(container, 'Your Tutor Core check was accepted')).toBe(true)
    expect(durable.filter((call) => call === 'calendar.completeCurrentSegment')).toHaveLength(1)
  })

  // PHASE 9. A real exit is the route's own `leaveStudy`, which is a user-initiated
  // handler and not an effect cleanup — so React never replays it. It retires the
  // epoch, which is what stops the surface doing learner work.
  it('stops learner work on a real exit, which is the route\'s and not the probe\'s', async () => {
    const owner = {}
    const seam = createHostStudyLifecycleSeam(owner, baseBinding())
    await mount(<StrictMode><PreviewHost owner={owner} binding={baseBinding()} /></StrictMode>)
    const working = seam.boundary.token()
    expect(working.isCurrent()).toBe(true)

    const exit = tags(container, 'BUTTON').find((node) => hasText(node, 'Save and exit'))
    expect(exit).toBeDefined()
    const props = (node: FakeElement) => {
      const key = Object.keys(node).find((name) => name.startsWith('__reactProps$'))
      if (!key) throw new Error('React props are not attached to this node.')
      return (node as unknown as Record<string, Record<string, never>>)[key]!
    }
    await act(async () => { (props(exit!) as unknown as { onClick: () => void }).onClick() })

    expect(seam.boundary.binding).toBeNull()
    expect(seam.boundary.lastReason).toBe('navigation-away')
    expect(working.isCurrent()).toBe(false)
  })

  // PHASE 9, stated as the complementary property: an unmount ALONE says nothing
  // about the App's authority. This is exactly what makes the probe survivable,
  // and it is the assertion that would have to be deleted to reintroduce the bug.
  it('leaves the epoch alone when the surface merely unmounts', async () => {
    const owner = {}
    const seam = createHostStudyLifecycleSeam(owner, baseBinding())
    const root = await mount(<StrictMode><PreviewHost owner={owner} binding={baseBinding()} /></StrictMode>)
    const born = seam.boundary.token().epoch

    await act(async () => { root.render(<StrictMode><PreviewHost owner={owner} binding={baseBinding()} mounted={false} /></StrictMode>) })
    await settle()

    expect(seam.boundary.binding).not.toBeNull()
    expect(seam.boundary.lastReason).not.toBe('navigation-away')
    expect(seam.boundary.token().epoch).toBe(born)
  })

  // PHASE 10.
  it('mounts again after a real navigate-away-and-back', async () => {
    const owner = {}
    const seam = createHostStudyLifecycleSeam(owner, baseBinding())
    const root = await mount(<StrictMode><PreviewHost owner={owner} binding={baseBinding()} /></StrictMode>)
    expect(live()).toBe(true)

    // The learner exits for real: the controlling route retires the epoch, then
    // the App renders another screen.
    seam.boundary.cancel('navigation-away')
    await act(async () => { root.render(<StrictMode><PreviewHost owner={owner} binding={baseBinding()} mounted={false} /></StrictMode>) })
    await settle()
    expect(hostStudyLifecycleBoundary(owner).binding).not.toBeNull()

    // And comes back — onto the epoch the OWNER re-asserted during its render.
    await act(async () => { root.render(<StrictMode><PreviewHost owner={owner} binding={baseBinding()} /></StrictMode>) })
    await settle()

    expect(hostStudyLifecycleBoundary(owner).token().isCurrent()).toBe(true)
    expect(hasText(container, RECHECKING)).toBe(false)
    expect(live()).toBe(true)
  })

  // PHASE 11.
  it('fails closed after a logout, and no replay attaches the old surface back', async () => {
    const owner = {}
    const seam = createHostStudyLifecycleSeam(owner, baseBinding())
    await mount(<StrictMode><PreviewHost owner={owner} binding={baseBinding()} /></StrictMode>)
    const learnerToken = seam.boundary.token()
    expect(learnerToken.isCurrent()).toBe(true)

    // Exactly what App.signOut does.
    hostStudyLifecycleBoundary(owner).cancel('logout')
    expect(learnerToken.isCurrent()).toBe(false)

    // The App is signed out, so nothing is re-deriving authority. Mounting the
    // surface again under StrictMode must not manufacture any.
    for (const root of roots.splice(0)) await act(async () => root.unmount())
    await mount(<StrictMode>{orphanedSurface(seam)}</StrictMode>)

    expect(hostStudyLifecycleBoundary(owner).binding).toBeNull()
    expect(hostStudyLifecycleBoundary(owner).lastReason).toBe('logout')
    expect(learnerToken.isCurrent()).toBe(false)
    expect(live()).toBe(false)
    expect(hasText(container, RECHECKING)).toBe(true)
  })

  it('fails closed for the previous learner when the App switches learner', async () => {
    const owner = {}
    const seam = createHostStudyLifecycleSeam(owner, baseBinding())
    const root = await mount(<StrictMode><PreviewHost owner={owner} binding={baseBinding()} /></StrictMode>)
    const previous = seam.boundary.token()
    expect(previous.isCurrent()).toBe(true)

    const switched = baseBinding({ learnerRef: 'learner:another-child' })
    await act(async () => { root.render(<StrictMode><PreviewHost owner={owner} binding={switched} mounted={false} /></StrictMode>) })
    await settle()

    // The old learner's token is stale, and it is a genuinely different epoch.
    expect(previous.isCurrent()).toBe(false)
    expect(hostStudyLifecycleBoundary(owner).binding?.learnerRef).toBe('learner:another-child')
  })

  it('refuses to open when the route is asked for a learner the context does not name', async () => {
    const owner = {}
    const seam = createHostStudyLifecycleSeam(owner, baseBinding())
    await mount(
      <StrictMode><PreviewHost owner={owner} binding={baseBinding()} learnerRef="learner:someone-else" /></StrictMode>,
    )

    // A learner mismatch is a real authorization failure and must fail closed
    // however many times React replays the effect that detects it.
    expect(hasText(container, 'The selected learner changed. This Study Session was not opened.')).toBe(true)
    expect(seam.boundary.binding).toBeNull()
    expect(seam.boundary.lastReason).toBe('learner-switch')
    expect(live()).toBe(false)
    expect(durable).toEqual([])
  })

  // PHASE 12.
  it('gives a switched-off Study nothing to attach to, replay or not', async () => {
    const owner = {}
    const off = baseBinding({ featureEnabled: false })
    const seam = createHostStudyLifecycleSeam(owner, off)
    expect(seam.boundary.binding).toBeNull()
    expect(seam.boundary.lastReason).toBe('feature-disabled')

    await mount(<StrictMode><PreviewHost owner={owner} binding={off} /></StrictMode>)

    expect(seam.boundary.binding).toBeNull()
    expect(seam.boundary.lastReason).toBe('feature-disabled')
    expect(seam.boundary.token().isCurrent()).toBe(false)
    expect(live()).toBe(false)
    expect(durable).toEqual([])
  })

  // PHASE 13.
  it('follows Study true -> false to fail-closed while the surface is mounted', async () => {
    const owner = {}
    const seam = createHostStudyLifecycleSeam(owner, baseBinding())
    const root = await mount(<StrictMode><PreviewHost owner={owner} binding={baseBinding()} /></StrictMode>)
    expect(live()).toBe(true)

    await act(async () => {
      root.render(<StrictMode><PreviewHost owner={owner} binding={baseBinding({ featureEnabled: false })} /></StrictMode>)
    })
    await settle()

    expect(hostStudyLifecycleBoundary(owner).binding).toBeNull()
    expect(hostStudyLifecycleBoundary(owner).lastReason).toBe('feature-disabled')
    expect(hostStudyLifecycleBoundary(owner).token().isCurrent()).toBe(false)
  })

  it('gives an already-expired grant nothing to attach to', async () => {
    const owner = {}
    const expired = baseBinding({ expiresAt: new Date(Date.now() - 60_000).toISOString() })
    const seam = createHostStudyLifecycleSeam(owner, expired)
    expect(seam.boundary.binding).toBeNull()
    expect(seam.boundary.lastReason).toBe('grant-expired')

    await mount(<StrictMode><PreviewHost owner={owner} binding={expired} /></StrictMode>)

    expect(seam.boundary.binding).toBeNull()
    expect(seam.boundary.lastReason).toBe('grant-expired')
    expect(live()).toBe(false)
    expect(durable).toEqual([])
  })

  // PHASE 14, at the surface. The lifecycle-authority correction says a join
  // attaches to the LIVE deadline and never to the one the epoch was born with.
  // A StrictMode replay must not become a second way in.
  it('does not let a replay revive an epoch whose renewed lease has run out', async () => {
    const owner = {}
    const born = new Date(Date.now() + 3_600_000).toISOString()
    const seam = createHostStudyLifecycleSeam(owner, baseBinding({ expiresAt: born }))
    // The authority SHORTENS the window to one already past.
    seam.boundary.renewEpochLeaseIfCurrent(seam.boundary.token(), new Date(Date.now() + 25).toISOString())
    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(seam.boundary.token().isCurrent()).toBe(false)

    // No owner re-derivation: the surface is on its own with the seam it holds,
    // whose binding still names the LATER birth deadline.
    await mount(<StrictMode>{orphanedSurface(seam)}</StrictMode>)

    expect(seam.boundary.binding).toBeNull()
    expect(seam.boundary.token().isCurrent()).toBe(false)
    expect(live()).toBe(false)
    expect(durable).toEqual([])
  })

  it('still attaches when the authority EXTENDED past the deadline the seam names', async () => {
    const owner = {}
    const born = new Date(Date.now() + 30).toISOString()
    const seam = createHostStudyLifecycleSeam(owner, baseBinding({ expiresAt: born }))
    seam.boundary.renewEpochLeaseIfCurrent(seam.boundary.token(), new Date(Date.now() + 3_600_000).toISOString())
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(seam.boundary.token().isCurrent()).toBe(true)

    await mount(<StrictMode>{orphanedSurface(seam)}</StrictMode>)

    // The birth deadline has passed and the epoch is still the live one.
    expect(seam.boundary.binding?.expiresAt).toBe(born)
    expect(seam.boundary.token().isCurrent()).toBe(true)
    expect(live()).toBe(true)
  })
})
