/**
 * STUDY-A1-PROD-TUTOR-WRAPPER-H2 — an ACCEPTED production Tutor turn, driven
 * through the real StudySessionContainer.
 *
 * WHY THIS FILE EXISTS. The independent review of 604a7a3 found that
 * `productionTurnResult` (StudySessionContainer.tsx:295) was never driven: all
 * three mounts that supplied a `tutorRuntime` used a runtime whose `submit`
 * returned `quarantined` with reason code `not-exercised-here`. So the branch
 * that builds a production turn, parses every reference and the learner's words,
 * calls `submit`, and hands an accepted result to the surface had ZERO coverage
 * — and the review's second survivor followed directly from that: inserting
 * `.slice(0, 4_000)` before `parseStudyTutorLearnerText` converted the
 * documented refusal into the exact silent truncation the comment above it
 * forbids, and all 2,609 tests stayed green.
 *
 * Nothing here is stubbed at the point that matters. The container is the real
 * one, the ports are the local development bundle wrapped only to observe, the
 * runtime is a real `ProductionStudyTutorRuntime` over the real adapter and the
 * real frozen Tutor Core, and the result is whatever `acceptStudyTutorResult`
 * produced. The only test-owned object is a recorder that delegates every call
 * to that runtime and writes down what crossed.
 *
 * NO BRAND IS MINTED ANYWHERE IN THIS FILE. There is no `as ValidatedStudyTutorResult`,
 * no `as StudyTutorRef` and no `as StudyTutorLearnerText`: every branded value
 * asserted below was produced by the container calling a canonical parser, and
 * the recorder returns the runtime's own result unchanged.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductionStudySessionContainer } from '../../components/study/ProductionStudySessionContainer'
import {
  createHostStudyLifecycleSeam,
  type HostStudyLifecycleSeam,
} from '../composition/hostStudyLifecycle'
import {
  STUDY_TUTOR_CONTRACT_VERSION,
  STUDY_TUTOR_LEARNER_TEXT_MAX_LENGTH,
  STUDY_TUTOR_RESULT_KEYS,
  STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH,
  isStudyTutorLearnerText,
  isStudyTutorRef,
  parseStudyTutorLearnerText,
  type StudyTutorLaunch,
  type StudyTutorRuntime,
  type StudyTutorTurn,
  type ValidatedStudyTutorResult,
} from '../contracts/tutor'
import { syntheticGrade5StudyContext } from '../demonstrations'
import { createLocalDevelopmentStudyPorts } from '../localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from '../ports'
import { readLocalSafetyStops, isSessionStoppedByLocalLedger } from '../safety/localStopLedger'
import { studyBridgeSessionRef } from '../studyBridgeSessionRef'
import {
  REVIEWED_TUTOR_MATH_SKILL_REF,
  createSyntheticMathBlock,
  createSyntheticParentCreatedBlock,
} from '../testing/syntheticStudyFixtures'
import type { StudyCalendarEntry, StudySafeEvent, StudySessionSnapshot } from '../types'
import { ProductionStudyTutorRuntime } from './tutorRuntime'

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

/** React's event delegation cannot be driven through this shim; its props can. */
function reactProps(node: FakeElement): Record<string, never> {
  const key = Object.keys(node).find((name) => name.startsWith('__reactProps$'))
  if (!key) throw new Error('React props are not attached to this node.')
  return (node as unknown as Record<string, Record<string, never>>)[key]!
}

const TECHNICAL_FAILURE_MESSAGE = 'The Tutor result could not be accepted. No completion was recorded.'

const clearSafety: StudySafetyPort = {
  mode: 'production',
  classifierVersion: 'test-study-a1-prod-tutor-wrapper-h2-accepted-turn',
  evaluate: async () => ({ outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }),
}

const context = syntheticGrade5StudyContext('math')

/**
 * A real `ProductionStudyTutorRuntime`, wrapped so what crossed is observable.
 *
 * Every method delegates. `submit` returns the runtime's own result object —
 * this class never constructs a `ValidatedStudyTutorResult`, and could not: the
 * brand is an unexported unique symbol, so the value recorded below is the one
 * `acceptStudyTutorResult` produced or nothing at all.
 */
class RecordingProductionRuntime implements StudyTutorRuntime {
  readonly contractVersion = STUDY_TUTOR_CONTRACT_VERSION
  readonly launches: StudyTutorLaunch[] = []
  readonly turns: StudyTutorTurn[] = []
  readonly results: ValidatedStudyTutorResult[] = []

  constructor(private readonly inner: ProductionStudyTutorRuntime) {}

  async launch(launch: StudyTutorLaunch): Promise<void> {
    this.launches.push(launch)
    await this.inner.launch(launch)
  }

  async submit(turn: StudyTutorTurn): Promise<ValidatedStudyTutorResult> {
    this.turns.push(turn)
    const result = await this.inner.submit(turn)
    this.results.push(result)
    return result
  }
}

/** Every durable write the mount performs, in the order it performed it. */
interface DurableWrites {
  readonly events: StudySafeEvent[]
  readonly sessions: StudySessionSnapshot[]
}

describe('an accepted production Tutor turn through the real Study session container', () => {
  let container: FakeElement
  let documentTarget: FakeDocument
  let storage: MemStorage
  let roots: Root[]
  let base: StudyPortBundle
  let ports: StudyPortBundle
  let entry: StudyCalendarEntry
  let durable: DurableWrites
  let seam: HostStudyLifecycleSeam
  let runtime: RecordingProductionRuntime
  let appended: StudySafeEvent[]

  beforeEach(() => {
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
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = documentTarget.createElement('div')
    documentTarget.body.appendChild(container)
    roots = []
    durable = { events: [], sessions: [] }
    appended = []
  })

  afterEach(async () => {
    for (const root of roots) await act(async () => { root.unmount() })
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  async function settle(): Promise<void> {
    for (let tick = 0; tick < 10; tick += 1) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    }
  }

  function hostSeam(): HostStudyLifecycleSeam {
    return createHostStudyLifecycleSeam({}, {
      authenticatedSessionRef: 'host-lifecycle:study-a1-prod-tutor-wrapper-h2',
      householdRef: context.householdRef,
      learnerRef: context.learnerRef,
      launchGrantRef: 'opaque-grant-epoch:1',
      featureEnabled: true,
      authorizationRevision: 1,
    })
  }

  interface MountOptions {
    readonly suffix: string
    /** Fires as the bridge's own accepted-event append lands, for the M19 attack. */
    readonly onAcceptedEventAppend?: () => void
    /**
     * STUDY-A1-PRODUCTION-SAFE-CONTAINER — mount a `completion-only` block
     * instead of a Tutor-governed one. The default stays Tutor-governed, so
     * every existing test in this file is untouched.
     */
    readonly completionOnly?: boolean
  }

  /**
   * A real mount: real container, real ports, real production runtime.
   *
   * The runtime's `bridgeSessionRef` is derived exactly as the container derives
   * the turn's `sessionRef` — `studyBridgeSessionRef` over the durable session
   * reference — because a host wiring the two differently would be wiring itself
   * a permanent idempotency collision, and this test would not notice.
   */
  async function mount(options: MountOptions): Promise<void> {
    const local = createLocalDevelopmentStudyPorts()
    base = { ...local.ports, safety: clearSafety }
    // STUDY-A1-TUTOR-CONTENT-ELIGIBILITY-CONTRACT — this file's turns are
    // supposed to be ACCEPTED, so the block has to carry content the reviewed
    // Tutor can actually teach. The default synthetic skill reference is
    // Study-namespace and routes to no registered program; before this card it
    // silently reached sequence 01 through the `programs[0]` fallback, so every
    // "accepted turn" below was an accepted turn of the wrong lesson.
    entry = (
      await (options.completionOnly
        ? createSyntheticParentCreatedBlock(base, { suffix: options.suffix })
        : createSyntheticMathBlock(base, {
            suffix: options.suffix,
            skillRefs: [REVIEWED_TUTOR_MATH_SKILL_REF],
          }))
    ).entry
    const sessionRef = `${entry.blockRef}:session`
    const scope = { householdRef: context.householdRef, learnerRef: context.learnerRef, sessionRef }

    ports = {
      ...base,
      eventLedger: {
        append: async (eventScope, event, operation) => {
          durable.events.push(event)
          return base.eventLedger.append(eventScope, event, operation)
        },
      },
      persistence: {
        ...base.persistence,
        saveSession: async (snapshot, operation) => {
          durable.sessions.push(snapshot)
          return base.persistence.saveSession(snapshot, operation)
        },
      },
    }

    seam = hostSeam()
    const token = seam.boundary.token()
    runtime = new RecordingProductionRuntime(new ProductionStudyTutorRuntime({
      scope,
      hostProfileRef: context.hostProfileRef,
      safety: clearSafety,
      eventLedger: {
        append: async (eventScope, event, operation) => {
          appended.push(event)
          const status = await ports.eventLedger.append(eventScope, event, operation)
          options.onAcceptedEventAppend?.()
          return status
        },
      },
      isCurrent: () => token.isCurrent(),
      bridgeSessionRef: studyBridgeSessionRef(sessionRef),
    }))

    const root = createRoot(container as unknown as Element)
    roots.push(root)
    await act(async () => {
      root.render(
        <ProductionStudySessionContainer
          context={context}
          initialEntry={entry}
          ports={ports}
          studyLifecycle={seam}
          tutorRuntime={runtime}
          onBack={() => {}}
        />,
      )
    })
    await settle()
  }

  function control(label: string): FakeElement | undefined {
    return tags(container, 'BUTTON').find((button) => hasText(button, label))
  }

  async function submitAnswer(text: string): Promise<void> {
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

  it('drives one genuinely accepted turn: launch, durable prep, submit, presentation', async () => {
    await mount({ suffix: 'accepted-turn' })

    // The launch really happened through the production contract, and the three
    // durable preparations really followed it. HOST_AWAIT stays closed.
    expect(runtime.launches).toHaveLength(1)
    expect(durable.events.map((event) => event.type)).toEqual(['session-launched'])
    expect(durable.sessions.map((session) => session.status)).toEqual(['active'])

    await submitAnswer('ready')

    // The submit path was reached exactly once, and this is the branch the
    // review found had no accepted-turn coverage at all.
    expect(runtime.turns).toHaveLength(1)
    expect(runtime.results).toHaveLength(1)
    const result = runtime.results[0]!
    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') return

    // Canonical, not hand-minted. The parser freezes what it returns, so an
    // `as ValidatedStudyTutorResult` on a fresh literal is distinguishable from
    // this — the residual F4 records, and the campaign's M15.
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.keys(result).sort()).toEqual([...STUDY_TUTOR_RESULT_KEYS.accepted].sort())

    // The accepted canonical result reached learner presentation, as a string,
    // and the string that arrived is the one the contract validated.
    expect(typeof result.visibleText).toBe('string')
    expect(result.visibleText.trim()).not.toBe('')
    expect(result.visibleText.length).toBeLessThanOrEqual(STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH)
    expect(hasText(container, result.visibleText)).toBe(true)

    // Nothing about this turn was a safety event: no stop, no lock, no lock copy.
    expect(readLocalSafetyStops(storage)).toEqual([])
    expect(isSessionStoppedByLocalLedger({ studentRef: context.learnerRef, sessionRef: `${entry.blockRef}:session` }, storage)).toBe(false)
    expect(durable.events.map((event) => event.type)).not.toContain('safety-stop')
    expect(hasText(container, TECHNICAL_FAILURE_MESSAGE)).toBe(false)

    // And the turn completed: the accepted event is the one the host recorded
    // against the session it persisted.
    expect(appended.map((event) => event.type)).toEqual(['tutor-directive'])
    const lastSession = durable.sessions.at(-1)!
    expect(lastSession.lastAcceptedEventRef).toBe(result.eventRef)
  })

  it('builds that turn out of canonical parser output and nothing else', async () => {
    await mount({ suffix: 'accepted-turn-boundaries' })
    await submitAnswer('ready')

    expect(runtime.turns).toHaveLength(1)
    const turn = runtime.turns[0]!

    // Every reference field. These are `StudyTutorRef` at compile time, which
    // only `parseStudyTutorRef` produces; the runtime re-check below is what an
    // `as` cast on the container's side could not satisfy.
    for (const ref of [turn.sessionRef, turn.requestRef, turn.lessonRef, turn.segmentRef, turn.skillRef]) {
      expect(isStudyTutorRef(ref)).toBe(true)
    }
    // Identity, not just admissibility: the session reference the Tutor sees is
    // the bridge-bounded form of the host's durable one, and the lesson, segment
    // and skill are this block's own.
    expect(turn.sessionRef).toBe(studyBridgeSessionRef(`${entry.blockRef}:session`))
    expect(turn.lessonRef).toBe(entry.lessonRef)
    expect(turn.segmentRef).toBe(entry.segments[0]!.segmentRef)
    expect(turn.skillRef).toBe(entry.skillRefs[0])

    // The learner's words crossed as `StudyTutorLearnerText`, which only
    // `parseStudyTutorLearnerText` produces, and crossed WHOLE.
    expect(isStudyTutorLearnerText(turn.transientLearnerText)).toBe(true)
    expect(turn.transientLearnerText).toBe('ready')

    // No host identity rode along on the turn.
    expect(Object.hasOwn(turn, 'hostProfileRef')).toBe(false)
    expect(Object.hasOwn(turn, 'scope')).toBe(false)

    const result = runtime.results[0]!
    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') return
    // The presentation seam is string-only, and the surface renders that string.
    expect(typeof result.visibleText).toBe('string')
    expect(hasText(container, result.visibleText)).toBe(true)
  })

  it('persists nothing about the learner, her words, or the Tutor prose', async () => {
    await mount({ suffix: 'accepted-turn-privacy' })
    await submitAnswer('ready')

    const result = runtime.results[0]!
    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') return

    // Absence, over the whole durable footprint. Nothing a Tutor said, nothing
    // she typed, and no vocabulary a transcript or a diagnosis would arrive in.
    const written = JSON.stringify(durable)
    expect(written).not.toContain(result.visibleText)
    expect(written).not.toContain('ready')
    const events = JSON.stringify(durable.events).toLowerCase()
    const sessions = JSON.stringify(durable.sessions).toLowerCase()
    for (const forbidden of ['transcript', 'conversation', 'prompt', 'utterance', 'audio', 'diagnos', 'emotion']) {
      expect(events).not.toContain(forbidden)
      // A session snapshot legitimately carries `transcriptIncluded`, and it is
      // asserted `false` below rather than by absence. Every other vocabulary is
      // absent from the snapshot too.
      if (forbidden !== 'transcript') expect(sessions).not.toContain(forbidden)
    }

    // And the structural half, which absence alone would not give: the exact
    // shape of every durable write an accepted turn produces. A payload that
    // grew a field — under any name — fails here rather than only when someone
    // guessed the name above.
    const payloadKeys: Readonly<Record<string, readonly string[]>> = {
      'session-launched': ['lessonRef', 'segmentRef'],
      'tutor-directive': ['bridgeEventVersion', 'eventLedgerIdempotencyKey'],
      'session-completed': ['blockRef', 'lessonRef'],
    }
    expect(durable.events.map((event) => event.type)).toEqual(['session-launched', 'tutor-directive'])
    for (const event of durable.events) {
      expect(Object.keys(event.payload).sort()).toEqual([...payloadKeys[event.type]!].sort())
    }
    for (const session of durable.sessions) {
      expect(Object.keys(session).sort()).toEqual([
        'lastAcceptedEventRef', 'lessonRef', 'rawAnswerIncluded', 'scope',
        'segmentRef', 'status', 'transcriptIncluded', 'updatedAt',
      ])
      // Both flags are `false` in the TYPE as well, so a snapshot claiming
      // otherwise does not compile. Asserted anyway: a type is exactly as strong
      // as the weakest cast on the path to it.
      expect(session.rawAnswerIncluded).toBe(false)
      expect(session.transcriptIncluded).toBe(false)
    }

    // The presentation is transient: on the screen, and in no durable write.
    expect(hasText(container, result.visibleText)).toBe(true)
  })

  it('refuses over-long learner input instead of shortening it into a valid turn', async () => {
    /**
     * PHASE 2 — reject, never truncate, at the actual container call site.
     *
     * The fixture is the forcing one: 4,001 UTF-16 units whose first 4,000 the
     * canonical parser WOULD admit. So any truncating transform on the path —
     * `.slice(0, 4_000)`, `.substring(0, 4_000)`, a slice to the exported
     * maximum, or a slice to 400 — turns this refusal into an accepted turn and
     * fails this test. Without the pair of assertions below, a test that merely
     * checked "over-long input is refused" would pass with the truncation in
     * place, because the truncated text is refused by nothing.
     */
    await mount({ suffix: 'oversized-learner-input' })
    const oversized = 'a'.repeat(STUDY_TUTOR_LEARNER_TEXT_MAX_LENGTH + 1)
    expect(parseStudyTutorLearnerText(oversized)).toBeNull()
    // The laundering this refusal exists to prevent, stated executably: the
    // shortened form is admissible, so shortening is what would make an invalid
    // answer into an accepted turn.
    expect(parseStudyTutorLearnerText(oversized.slice(0, STUDY_TUTOR_LEARNER_TEXT_MAX_LENGTH))).not.toBeNull()
    expect(parseStudyTutorLearnerText(oversized.slice(0, 400))).not.toBeNull()

    const eventsBefore = durable.events.length
    const sessionsBefore = durable.sessions.length
    await submitAnswer(oversized)

    // The Tutor was never asked. No turn was built, so there was no oversized
    // turn for anything to shorten.
    expect(runtime.turns).toEqual([])
    expect(appended).toEqual([])

    // And no durable turn result is attributable to it: no accepted event, no
    // completion, no new session row, and — because a quarantine is structural
    // rather than a safety determination — no stop and no lock.
    expect(durable.events.slice(eventsBefore)).toEqual([])
    expect(durable.sessions.slice(sessionsBefore)).toEqual([])
    expect(durable.events.map((event) => event.type)).not.toContain('tutor-directive')
    expect(durable.events.map((event) => event.type)).not.toContain('session-completed')
    expect(durable.events.map((event) => event.type)).not.toContain('safety-stop')
    expect(readLocalSafetyStops(storage)).toEqual([])
    expect(isSessionStoppedByLocalLedger({ studentRef: context.learnerRef, sessionRef: `${entry.blockRef}:session` }, storage)).toBe(false)

    // The learner is told, in neutral technical words, that nothing was recorded.
    expect(hasText(container, TECHNICAL_FAILURE_MESSAGE)).toBe(true)
  })

  it('admits the same input one unit shorter, so the refusal is the bound and not the length', async () => {
    // The control for the test above. Without it, a container that refused every
    // long answer — or every answer — would pass it.
    await mount({ suffix: 'at-bound-learner-input' })
    const atBound = 'a'.repeat(STUDY_TUTOR_LEARNER_TEXT_MAX_LENGTH)
    await submitAnswer(atBound)

    expect(runtime.turns).toHaveLength(1)
    // Whole, to the last unit: the parser normalizes nothing and the container
    // shortens nothing, so what she typed is what the Tutor was given.
    expect(runtime.turns[0]!.transientLearnerText).toBe(atBound)
    expect(runtime.turns[0]!.transientLearnerText).toHaveLength(STUDY_TUTOR_LEARNER_TEXT_MAX_LENGTH)
  })

  it('shows and records nothing for a result that arrives after the authority changed', async () => {
    /**
     * PHASE 9 — the M19 late-result attack, at the surface rather than at the
     * runtime. The turn is authorized the whole way through; the learner switch
     * lands as the bridge's own accepted event is appended, which leaves exactly
     * one later caller of `isCurrent` — the runtime's final staleness check.
     *
     * Driving an accepted turn must not have created a path that bypasses it.
     */
    await mount({
      suffix: 'late-result',
      onAcceptedEventAppend: () => { seam.boundary.cancel('learner-switch') },
    })
    const beforeTurn = durable.events.length
    await submitAnswer('ready')

    expect(runtime.turns).toHaveLength(1)
    const result = runtime.results[0]!
    expect(result.status).toBe('quarantined')
    if (result.status !== 'quarantined') return
    expect(result.reasonCode).toBe('stale-host-authority')

    // The accepted event WAS appended — the turn genuinely succeeded — and the
    // host still shows nothing and records nothing further for the new epoch.
    expect(appended).toHaveLength(1)
    expect(durable.events.slice(beforeTurn).map((event) => event.type)).toEqual(['tutor-directive'])
    expect(durable.events.map((event) => event.type)).not.toContain('session-completed')
    expect(durable.sessions.map((session) => session.status)).toEqual(['active'])
    expect(readLocalSafetyStops(storage)).toEqual([])
  })

  it('writes no learner text to the session row when a completion-only block completes', async () => {
    /**
     * STUDY-A1-PRODUCTION-SAFE-CONTAINER — found by this card's mutation
     * campaign (M12), not by design, and the branch it covers is one the product
     * ships rather than one only a test can reach.
     *
     * `masteryAuthority` is `completion-only` for a parent-created activity and
     * for a Romeo Virtual Academy activity (curriculumAdapter.ts). On that path
     * the container asks no Tutor anything, so `acceptedEventRef` stays null all
     * the way to `persistence.saveSession`, and the row is written with
     * `lastAcceptedEventRef: null`.
     *
     * Every mounted test before this one drove a Tutor-governed block, where
     * `acceptedEventRef` is always a real reference by the time that line runs.
     * So `lastAcceptedEventRef: acceptedEventRef ?? transient` — one `??` — put
     * the sentence a girl typed into her father's permanent Study record on the
     * only path where the fallback can fire, and the whole suite stayed green.
     *
     * The needle is a sentence, not a word, and it is asserted over the WHOLE
     * durable footprint rather than over the one field: a later card moving the
     * value to a different key would still be caught.
     */
    await mount({ suffix: 'completion-only-privacy', completionOnly: true })
    expect(entry.masteryAuthority).toBe('completion-only')

    const typed = 'I finished the poster with mom and it took me an hour'
    await submitAnswer(typed)

    // No Tutor was asked, so no result exists to have carried a reference.
    expect(runtime.turns).toEqual([])
    expect(runtime.results).toEqual([])

    // The segment really did complete — this is the positive half, without which
    // a container that simply refused completion-only work would pass below.
    expect(durable.sessions).not.toHaveLength(0)
    const completion = durable.sessions.at(-1)!
    expect(completion.segmentRef).toBe(entry.segments[0]!.segmentRef)

    // And the row carries NO reference at all, rather than her sentence.
    for (const session of durable.sessions) {
      expect(session.lastAcceptedEventRef).toBeNull()
      expect(session.rawAnswerIncluded).toBe(false)
      expect(session.transcriptIncluded).toBe(false)
    }
    expect(JSON.stringify(durable)).not.toContain(typed)
    // Local storage too, read through the Storage API this fixture implements.
    const stored = Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .map((key) => `${key}=${key === null ? '' : storage.getItem(key)}`)
      .join('\n')
    expect(stored).not.toContain(typed)
    // The host recorded a completion and invented no mastery decision. A
    // parent-created block has one segment, so completing it finishes the block
    // and the surface is the completed one rather than the caption view.
    expect(durable.events.map((event) => event.type)).toContain('session-completed')
    expect(completion.status).toBe('completed')
    expect(hasText(container, 'Study block complete')).toBe(true)
    expect(hasText(container, 'No host mastery decision was invented')).toBe(true)
    // No Tutor event was ever appended, because no Tutor was asked.
    expect(durable.events.map((event) => event.type)).not.toContain('tutor-directive')
  })
})
