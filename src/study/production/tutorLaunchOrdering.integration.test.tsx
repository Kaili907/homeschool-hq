/**
 * STUDY-A1-PROD-TUTOR-WRAPPER Phase 2/4 — the primary RED for F1.
 *
 * STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT names three durable preparations that
 * must not precede a settled launch: calendar start, the session-launched event,
 * and session persistence. This file drives the REAL StudySessionContainer
 * against REAL Study ports that record what was actually called, and orders a
 * rejecting launch against every one of them.
 *
 * Nothing here is faked at the point that matters. The ports are the local
 * development bundle wrapped in recorders, so `calendar.start` really transitions
 * the block, `eventLedger.append` really appends, and `persistence.saveSession`
 * really writes the row — a test that stubbed those would prove the container
 * called some functions in some order, not that a learner's record was left
 * alone.
 *
 * The first test is the defect itself, run rather than described: the exact
 * preparation body this card replaced, against the same ports and the same
 * hostile runtime. It exists because a green suite proves nothing about a bug
 * unless the bug can be shown to be real, and because the mutation campaign's
 * M1 restores precisely that ordering.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StudySessionContainer } from '../../components/study/StudySessionContainer'
import {
  createHostStudyLifecycleSeam,
  type HostStudyLifecycleSeam,
} from '../composition/hostStudyLifecycle'
import {
  STUDY_TUTOR_CONTRACT_VERSION,
  acceptStudyTutorResult,
  parseStudyTutorRef,
  type StudyTutorLaunch,
  type StudyTutorRuntime,
  type StudyTutorTurn,
  type ValidatedStudyTutorResult,
} from '../contracts/tutor'
import { syntheticGrade5StudyContext } from '../demonstrations'
import { createLocalDevelopmentStudyPorts } from '../localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from '../ports'
import { createSyntheticMathBlock } from '../testing/syntheticStudyFixtures'
import type { StudyCalendarEntry } from '../types'
import { prepareDurableStudySession, settleStudyTutorLaunch } from './tutorLaunchOrdering'

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

const clearSafety: StudySafetyPort = {
  mode: 'production',
  classifierVersion: 'test-study-a1-prod-tutor-wrapper-v1',
  evaluate: async () => ({ outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }),
}

const context = syntheticGrade5StudyContext('math')

/** The three durable preparations F1 names, plus the launch settlement itself. */
type DurableCall = 'launch-settled' | 'launch-rejected' | 'calendar-start' | 'session-launched-event' | 'session-persistence'

/**
 * Real ports, wrapped so the ORDER of the durable calls is observable.
 *
 * Deliberately a wrapper and not a stub: the underlying local development ports
 * perform the real transitions, so a durable write that happens is a durable
 * write that landed, and the assertions below are about the learner's record
 * rather than about a spy.
 */
function recordingPorts(base: StudyPortBundle, log: DurableCall[]): StudyPortBundle {
  return {
    ...base,
    safety: clearSafety,
    calendar: {
      ...base.calendar,
      start: async (scope, blockRef, at, operation) => {
        log.push('calendar-start')
        return base.calendar.start(scope, blockRef, at, operation)
      },
    },
    eventLedger: {
      append: async (scope, event, operation) => {
        if (event.type === 'session-launched') log.push('session-launched-event')
        return base.eventLedger.append(scope, event, operation)
      },
    },
    persistence: {
      ...base.persistence,
      saveSession: async (snapshot, operation) => {
        log.push('session-persistence')
        return base.persistence.saveSession(snapshot, operation)
      },
    },
  }
}

/**
 * A production Tutor whose launch settles LATE and, by default, rejects.
 *
 * The microtask yields are what make this a forcing fixture rather than a
 * decoration: a host that does not await gets many turns of the microtask queue
 * — comfortably past its three durable writes — before the rejection ever
 * arrives. A host that does await cannot reach them at all.
 */
class LateSettlingTutorRuntime implements StudyTutorRuntime {
  readonly contractVersion = STUDY_TUTOR_CONTRACT_VERSION
  launches = 0

  constructor(
    private readonly log: DurableCall[],
    private readonly outcome: 'reject' | 'resolve' = 'reject',
    private readonly afterLaunch?: () => void,
  ) {}

  async launch(_launch: StudyTutorLaunch): Promise<void> {
    this.launches += 1
    for (let turn = 0; turn < 12; turn += 1) await Promise.resolve()
    this.afterLaunch?.()
    if (this.outcome === 'reject') {
      this.log.push('launch-rejected')
      throw new Error('The Tutor session could not be opened.')
    }
    this.log.push('launch-settled')
  }

  async submit(_turn: StudyTutorTurn): Promise<ValidatedStudyTutorResult> {
    return acceptStudyTutorResult({ status: 'quarantined', reasonCode: 'not-exercised-here' })
  }
}

describe('production Tutor launch ordering against the real host', () => {
  let container: FakeElement
  let documentTarget: FakeDocument
  let roots: Root[]
  let ports: StudyPortBundle
  let base: StudyPortBundle
  let entry: StudyCalendarEntry
  let log: DurableCall[]

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
    log = []

    const local = createLocalDevelopmentStudyPorts()
    base = { ...local.ports, safety: clearSafety }
    ports = recordingPorts(base, log)
    const created = await createSyntheticMathBlock(base, {
      suffix: `launch-order-${Math.random().toString(36).slice(2, 8)}`,
    })
    entry = created.entry
  })

  afterEach(async () => {
    for (const root of roots) await act(async () => root.unmount())
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function hostSeam(): HostStudyLifecycleSeam {
    return createHostStudyLifecycleSeam({}, {
      authenticatedSessionRef: 'host-lifecycle:study-a1-prod-tutor-wrapper',
      householdRef: context.householdRef,
      learnerRef: context.learnerRef,
      launchGrantRef: 'opaque-grant-epoch:1',
      featureEnabled: true,
      authorizationRevision: 1,
    })
  }

  async function render(node: React.ReactElement) {
    const root = createRoot(container as unknown as Element)
    roots.push(root)
    await act(async () => root.render(node))
    for (let settle = 0; settle < 6; settle += 1) await act(async () => { await Promise.resolve() })
    return root
  }

  it('reproduces the defect: an unawaited launch writes all three durable records before it rejects', async () => {
    // The preparation body EXACTLY as it stood at this card's base — the
    // unawaited launch followed immediately by the calendar transition, the
    // session-launched event and saveSession. Same hostile runtime, same real
    // ports. This is what F1 was open about.
    const seam = hostSeam()
    const token = seam.boundary.token()
    const tutor = new LateSettlingTutorRuntime(log, 'reject')
    const sessionRef = `${entry.blockRef}:session`
    const scope = { householdRef: context.householdRef, learnerRef: context.learnerRef, sessionRef }
    const learnerScope = { householdRef: context.householdRef, learnerRef: context.learnerRef }
    const now = new Date().toISOString()
    const launchRef = parseStudyTutorRef('study-session:defect-reproduction')!
    const rejection = tutor
      .launch({ sessionRef: launchRef, lessonRef: launchRef, householdTimeZone: context.householdTimeZone, learnerLocalDate: context.learnerLocalDate })
      .catch(() => 'rejected' as const)

    let next = entry
    if (next.state === 'scheduled') next = await ports.calendar.start(learnerScope, next.blockRef, now)
    const segment = next.segments.find((candidate) => !next.completedSegmentRefs.includes(candidate.segmentRef))!
    await ports.eventLedger.append(scope, {
      eventRef: `launch:${sessionRef}`,
      occurredAt: now,
      type: 'session-launched',
      payload: { lessonRef: next.lessonRef, segmentRef: segment.segmentRef },
    })
    await ports.persistence.saveSession({
      scope,
      lessonRef: next.lessonRef,
      segmentRef: segment.segmentRef,
      status: 'active',
      updatedAt: now,
      lastAcceptedEventRef: null,
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    })

    await expect(rejection).resolves.toBe('rejected')
    // Every durable record landed, and every one of them landed BEFORE the host
    // learned the Tutor session did not exist.
    expect(log).toEqual([
      'calendar-start',
      'session-launched-event',
      'session-persistence',
      'launch-rejected',
    ])
    // And it is not a log artefact: the learner's record actually says Study
    // started, for a session she never got.
    const snapshot = await base.persistence.loadSession(scope)
    expect(snapshot?.status).toBe('active')
    expect(token.isCurrent()).toBe(true)
  })

  it('writes nothing durable when the production launch rejects', async () => {
    const tutor = new LateSettlingTutorRuntime(log, 'reject')
    await render(
      <StudySessionContainer
        context={context}
        initialEntry={entry}
        ports={ports}
        studyLifecycle={hostSeam()}
        tutorRuntime={tutor}
        onBack={() => {}}
      />,
    )

    expect(tutor.launches).toBe(1)
    // The whole of F1: the launch settled, and NOTHING preceded it.
    expect(log).toEqual(['launch-rejected'])
    expect(log).not.toContain('calendar-start')
    expect(log).not.toContain('session-launched-event')
    expect(log).not.toContain('session-persistence')

    // The learner's durable record is untouched: no active session row, and the
    // block is still scheduled rather than begun.
    const sessionRef = `${entry.blockRef}:session`
    const scope = { householdRef: context.householdRef, learnerRef: context.learnerRef, sessionRef }
    expect(await base.persistence.loadSession(scope)).toBeNull()
    const blocks = await base.calendar.list({ householdRef: context.householdRef, learnerRef: context.learnerRef })
    expect(blocks.find((block) => block.blockRef === entry.blockRef)?.state).toBe('scheduled')

    // And the host says so, on the surface it already had for this.
    expect(hasText(container, 'This Study Session could not start safely.')).toBe(true)
  })

  it('writes all three durable records, and only after the launch settles', async () => {
    const tutor = new LateSettlingTutorRuntime(log, 'resolve')
    await render(
      <StudySessionContainer
        context={context}
        initialEntry={entry}
        ports={ports}
        studyLifecycle={hostSeam()}
        tutorRuntime={tutor}
        onBack={() => {}}
      />,
    )

    // The positive half. Without it, a wrapper that simply never prepared
    // anything would pass the rejection test above while having broken Study.
    expect(log).toEqual([
      'launch-settled',
      'calendar-start',
      'session-launched-event',
      'session-persistence',
    ])
    expect(hasText(container, 'This Study Session could not start safely.')).toBe(false)
    expect(hasText(container, 'Send through Tutor boundary')).toBe(true)
  })

  it('prepares nothing durable when the epoch goes stale while the launch is in flight', async () => {
    // A learner switch, a logout or a grant expiry landing inside the launch
    // window. The launch SUCCEEDS — this is not the rejection case — and the
    // durable preparation must still not run, because it would be preparing a
    // session for an authority that no longer exists.
    const seam = hostSeam()
    const tutor = new LateSettlingTutorRuntime(log, 'resolve', () => {
      seam.boundary.cancel('learner-switch')
    })
    await render(
      <StudySessionContainer
        context={context}
        initialEntry={entry}
        ports={ports}
        studyLifecycle={seam}
        tutorRuntime={tutor}
        onBack={() => {}}
      />,
    )

    expect(tutor.launches).toBe(1)
    expect(log).toEqual(['launch-settled'])
    const sessionRef = `${entry.blockRef}:session`
    expect(await base.persistence.loadSession({
      householdRef: context.householdRef,
      learnerRef: context.learnerRef,
      sessionRef,
    })).toBeNull()
  })

  it('holds the preview runtime to the same ordering', async () => {
    // The rule is not conditional on there being a production Tutor. The
    // preview runtime's launch throws synchronously for an incomplete port
    // bundle and a wrong-learner block; it must be just as incapable of leaving
    // durable state behind.
    const wrongLearnerEntry: StudyCalendarEntry = { ...entry, learnerRef: 'learner:someone-else' }
    await render(
      <StudySessionContainer
        context={context}
        initialEntry={wrongLearnerEntry}
        ports={ports}
        studyLifecycle={hostSeam()}
        onBack={() => {}}
      />,
    )
    expect(log).toEqual([])
    expect(hasText(container, 'This Study Session could not start safely.')).toBe(true)
  })

  it('will not let a caller reach durable preparation without a settled launch', async () => {
    // The structural half, stated where a reader can see it. `LaunchSettled` is
    // branded with an unexported symbol, so the only way to obtain the argument
    // below is to have awaited a launch — and the compile-time proof of that is
    // in ./tutorLaunchOrderingWitness.test.ts, which fails the typecheck if
    // the witness is ever weakened to a boolean or made constructible.
    const seam = hostSeam()
    const token = seam.boundary.token()
    const settled = await settleStudyTutorLaunch(token, async () => 'launched')
    const sessionRef = `${entry.blockRef}:session`
    const prepared = await prepareDurableStudySession(settled, {
      token,
      ports,
      scope: { householdRef: context.householdRef, learnerRef: context.learnerRef, sessionRef },
      learnerScope: { householdRef: context.householdRef, learnerRef: context.learnerRef },
      entry,
      sessionRef,
      now: new Date().toISOString(),
    })
    expect(prepared.state).toBe('active')
    expect(log).toEqual(['calendar-start', 'session-launched-event', 'session-persistence'])
  })

  it('rejects rather than mints a witness when the launch rejects', async () => {
    const seam = hostSeam()
    await expect(settleStudyTutorLaunch(seam.boundary.token(), async () => {
      throw new Error('no Tutor session')
    })).rejects.toThrow('no Tutor session')
  })

  it('rejects rather than mints a witness when the epoch lapses across the await', async () => {
    const seam = hostSeam()
    const token = seam.boundary.token()
    await expect(settleStudyTutorLaunch(token, async () => {
      seam.boundary.cancel('logout')
      return 'launched'
    })).rejects.toThrow()
  })
})
