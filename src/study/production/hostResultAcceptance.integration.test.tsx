/**
 * STUDY-A1-F4-PARSE-BEFORE-HOST-C — the host reparses every Tutor result.
 *
 * WHY THIS FILE EXISTS. `StudyTutorRuntime.submit` returns
 * `ValidatedStudyTutorResult`, a shape branded with an unexported `unique
 * symbol`, and the host used to take that brand at its word: the normalizer at
 * StudySessionContainer.tsx accepted a `ValidatedStudyTutorResult` and read its
 * fields straight into presentation and durable state.
 *
 * A brand is a COMPILE-TIME fact, and exactly one explicit assertion forges it:
 *
 *   return raw as ValidatedStudyTutorResult
 *
 * `wrapperObligations.ts` records that residual honestly and it stays open —
 * TypeScript cannot stop a programmer from asserting, and no host can change
 * that. What a host CAN do is stop depending on it. This file drives the real
 * container against a runtime that performs precisely that one assertion and
 * pins the property the reparse buys:
 *
 *   TUTOR_RESULT_CONTENT_CANNOT_AFFECT_HOST_BEFORE_CANONICAL_RUNTIME_ACCEPTANCE
 *
 * THE BRAND IS FORGED HERE ON PURPOSE, and only here. It is deliberately NOT
 * forged in tutorAcceptedTurn.integration.test.tsx, whose header guarantees no
 * brand is minted anywhere in it; that file's guarantee is what makes it
 * evidence about the real runtime, and it is left intact.
 *
 * Every canonical value below comes from `acceptStudyTutorResult`. The only
 * assertion in this file is the single one inside `ForgingTutorRuntime.submit`,
 * which IS the attack.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductionStudySessionContainer } from '../../components/study/ProductionStudySessionContainer'
import {
  STUDY_BUSY_RETRY_MESSAGE,
  STUDY_SESSION_UNAVAILABLE_MESSAGE,
  STUDY_UNAVAILABLE_RETRY_MESSAGE,
} from '../../components/study/studySessionSurface'
import {
  createHostStudyLifecycleSeam,
  type HostStudyLifecycleSeam,
} from '../composition/hostStudyLifecycle'
import {
  STUDY_TUTOR_CONTRACT_VERSION,
  STUDY_TUTOR_RESULT_KEYS,
  STUDY_TUTOR_UNPARSED_RESULT_REASON_CODE,
  STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH,
  acceptStudyTutorResult,
  type StudyTutorLaunch,
  type StudyTutorRuntime,
  type StudyTutorTurn,
  type ValidatedStudyTutorResult,
} from '../contracts/tutor'
import { syntheticGrade5StudyContext } from '../demonstrations'
import { createLocalDevelopmentStudyPorts } from '../localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from '../ports'
import { STUDY_LEARNER_STOP_MESSAGE } from '../safety/learnerSafe'
import { readLocalSafetyStops, isSessionStoppedByLocalLedger } from '../safety/localStopLedger'
import { createSyntheticMathBlock } from '../testing/syntheticStudyFixtures'
import type { HostStudyLaunchContext, StudyCalendarEntry, StudySafeEvent, StudySessionSnapshot } from '../types'

class MemStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
  /** Everything the mount put in local storage, for the privacy sweep. */
  dump() { return JSON.stringify([...this.values.entries()]) }
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

/** Whether any node in the tree carries the attribute at all. */
function hasAttribute(node: FakeElement, name: string): boolean {
  return node.getAttribute(name) !== null || node.childNodes.some((child) => hasAttribute(child, name))
}

/** React's event delegation cannot be driven through this shim; its props can. */
function reactProps(node: FakeElement): Record<string, never> {
  const key = Object.keys(node).find((name) => name.startsWith('__reactProps$'))
  if (!key) throw new Error('React props are not attached to this node.')
  return (node as unknown as Record<string, Record<string, never>>)[key]!
}

const TECHNICAL_FAILURE_MESSAGE = 'The Tutor result could not be accepted. No completion was recorded.'

/**
 * A learner's own words, wearing a machine field's clothes.
 *
 * `reasonCode` is written STRAIGHT into the durable safety-stop event payload
 * by the host's stopped branch, so it is the one field on a Tutor result whose
 * content reaches an adult-visible durable record verbatim. The canonical
 * parser bounds it to short lower-case machine vocabulary
 * (`isStudyTutorReasonCode`) for exactly this reason, and prose fails that.
 *
 * This is the high-value witness of the whole card: a forged brand is enough to
 * put a sentence a ten-year-old typed into her father's permanent record, under
 * a field name that reads like a code.
 */
const LEARNER_PROSE_SENTINEL =
  'Kaili typed that she feels unsafe at home and asked the Tutor not to tell her dad'

/** 500 characters, well past the bridge's 128-character opaque-id bound. */
const FORGED_EVENT_REF = `forged:${'e'.repeat(493)}`
/** 25,000 characters, ten times the validated learner-facing bound. */
const FORGED_VISIBLE_TEXT = 'Z'.repeat(25_000)

/** A reference the contract genuinely admits, for the positive controls. */
const CANONICAL_EVENT_REF = 'canonical:accepted-event:1'

const clearSafety: StudySafetyPort = {
  mode: 'production',
  classifierVersion: 'test-study-a1-f4-parse-before-host',
  evaluate: async () => ({ outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }),
}

const context = syntheticGrade5StudyContext('math')

/**
 * The attack, in one line.
 *
 * `submit` must return `Promise<ValidatedStudyTutorResult>` — that contract does
 * NOT change under this card, and must not: the brand is a real compile-time
 * layer against the two mistakes that read as correct code. What it cannot stop
 * is the assertion below, which is the residual `wrapperObligations.ts` records
 * as `single-explicit-type-assertion` and keeps F4 open.
 *
 * Everything else here is honest: the launch really resolves, the turn is
 * really the one the container built, and the value handed back is whatever the
 * forge produced — never parsed, never frozen, never rebuilt.
 */
class ForgingTutorRuntime implements StudyTutorRuntime {
  readonly contractVersion = STUDY_TUTOR_CONTRACT_VERSION
  readonly launches: StudyTutorLaunch[] = []
  readonly turns: StudyTutorTurn[] = []

  constructor(private readonly forge: () => unknown) {}

  async launch(launch: StudyTutorLaunch): Promise<void> {
    this.launches.push(launch)
  }

  async submit(turn: StudyTutorTurn): Promise<ValidatedStudyTutorResult> {
    this.turns.push(turn)
    // THE forge. One explicit assertion, from `unknown`, exactly as the
    // obligation record says a wrapper author can always write.
    return this.forge() as ValidatedStudyTutorResult
  }
}

/** Every durable write the mount performs, in the order it performed it. */
interface DurableWrites {
  readonly events: StudySafeEvent[]
  readonly sessions: StudySessionSnapshot[]
}

function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

describe('the production host reparses every Tutor result before it can act on one', () => {
  let container: FakeElement
  let documentTarget: FakeDocument
  let storage: MemStorage
  let roots: Root[]
  let ports: StudyPortBundle
  let entry: StudyCalendarEntry
  let sessionRef: string
  let durable: DurableWrites
  let seam: HostStudyLifecycleSeam
  let runtime: ForgingTutorRuntime
  let logged: string[]

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

    // PHASE 11 — monitoring capture. A rejected raw Tutor object must not be
    // serialized "for debugging"; that is the classic way privacy-bearing
    // content escapes a boundary that otherwise refused it.
    logged = []
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        logged.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '))
      })
    }
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
      authenticatedSessionRef: 'host-lifecycle:study-a1-f4-parse-before-host',
      householdRef: context.householdRef,
      learnerRef: context.learnerRef,
      launchGrantRef: 'opaque-grant-epoch:1',
      featureEnabled: true,
      authorizationRevision: 1,
    })
  }

  interface MountOptions {
    readonly suffix: string
    /** What the Tutor hands back, unparsed. */
    readonly forge: () => unknown
    /** Overridden only where the transcript must actually be on screen. */
    readonly hostContext?: HostStudyLaunchContext
  }

  async function mount(options: MountOptions): Promise<void> {
    const local = createLocalDevelopmentStudyPorts()
    const base = { ...local.ports, safety: clearSafety }
    entry = (await createSyntheticMathBlock(base, { suffix: options.suffix })).entry
    sessionRef = `${entry.blockRef}:session`

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
    runtime = new ForgingTutorRuntime(options.forge)

    const root = createRoot(container as unknown as Element)
    roots.push(root)
    await act(async () => {
      root.render(
        <ProductionStudySessionContainer
          context={options.hostContext ?? context}
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

  async function beginAnswerSubmission(text: string): Promise<{ readonly completion: Promise<void> }> {
    const textarea = tags(container, 'TEXTAREA')[0]
    if (!textarea) throw new Error('The live Study surface never rendered a response field.')
    await act(async () => {
      const onChange = reactProps(textarea).onChange as unknown as (event: unknown) => void
      onChange({ target: { value: text } })
    })
    const send = control('Send through Tutor boundary')
    if (!send) throw new Error('The live Study surface never rendered a submit control.')
    let completion!: Promise<void>
    await act(async () => {
      const onClick = reactProps(send).onClick as unknown as () => void | Promise<void>
      completion = Promise.resolve(onClick()).then(() => undefined)
      await Promise.resolve()
    })
    return { completion }
  }

  function holdSafetyLedgerLock(): {
    readonly entered: Promise<void>
    readonly release: () => void
  } {
    const entered = deferred()
    const released = deferred()
    Object.assign(globalThis.navigator, {
      locks: {
        request: async <T,>(_name: string, callback: () => Promise<T>): Promise<T> => {
          entered.resolve()
          await released.promise
          return callback()
        },
      },
    })
    return { entered: entered.promise, release: released.resolve }
  }

  async function beginHeldCanonicalStop(suffix: string): Promise<{
    readonly epochA: ReturnType<HostStudyLifecycleSeam['boundary']['token']>
    readonly completion: Promise<void>
    readonly release: () => void
  }> {
    const heldLock = holdSafetyLedgerLock()
    await mount({
      suffix,
      forge: () => acceptStudyTutorResult({
        status: 'stopped',
        reasonCode: 'mounted-input-safety-urgent',
        deliveryStatus: 'proposed-not-delivered',
      }),
    })
    const epochA = seam.boundary.token()
    const { completion } = await beginAnswerSubmission('ready')
    await heldLock.entered
    return { epochA, completion, release: heldLock.release }
  }

  /** The whole durable footprint plus local storage, as one searchable string. */
  function durableFootprint(): string {
    return `${JSON.stringify(durable)} ${storage.dump()} ${JSON.stringify(readLocalSafetyStops(storage))}`
  }

  function isLocked(): boolean {
    return isSessionStoppedByLocalLedger({ studentRef: context.learnerRef, sessionRef }, storage)
  }

  /**
   * What a forged result must NEVER produce, whatever it claims to be.
   *
   * PHASE 10 — a canonical parse failure maps to `quarantined` and to nothing
   * else. Not a safety stop, not a learner lock, not a lifecycle safety
   * cancellation, and not an invented technical interruption.
   */
  function expectNoSafetyOrInterruptionConsequences(token: { isCurrent(): boolean }): void {
    expect(readLocalSafetyStops(storage)).toEqual([])
    expect(isLocked()).toBe(false)
    expect(durable.events.map((event) => event.type)).not.toContain('safety-stop')
    expect(durable.events.map((event) => event.type)).not.toContain('session-completed')
    expect(durable.events.map((event) => event.type)).not.toContain('tutor-directive')
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(false)
    expect(hasText(container, 'Study paused')).toBe(false)
    // No interruption was invented out of a structural failure.
    expect(hasAttribute(container, 'data-study-interrupted')).toBe(false)
    expect(hasText(container, STUDY_BUSY_RETRY_MESSAGE)).toBe(false)
    expect(hasText(container, STUDY_UNAVAILABLE_RETRY_MESSAGE)).toBe(false)
    expect(hasText(container, STUDY_SESSION_UNAVAILABLE_MESSAGE)).toBe(false)
    // The lifecycle epoch was never cancelled: `lifecycle.cancel('safety-stop')`
    // is the stopped branch's last act and it must not have run.
    expect(token.isCurrent()).toBe(true)
    // And the honest technical surface IS what she was shown.
    expect(hasText(container, TECHNICAL_FAILURE_MESSAGE)).toBe(true)
  }

  // ────────────────────────────────────────────────────────────────────────
  // PHASE 2 — a forged ACCEPTED result
  // ────────────────────────────────────────────────────────────────────────

  it('refuses a forged accepted result: no oversized prose to the learner, no forged reference to durable state', async () => {
    const forged = {
      status: 'accepted',
      eventRef: FORGED_EVENT_REF,
      visibleText: FORGED_VISIBLE_TEXT,
    }

    // The counterfactual, stated first and executably: the canonical parser
    // rejects this shape outright. Everything below is about whether the HOST
    // asked it.
    const canonical = acceptStudyTutorResult(forged)
    expect(canonical.status).toBe('quarantined')
    if (canonical.status !== 'quarantined') return
    expect(canonical.reasonCode).toBe(STUDY_TUTOR_UNPARSED_RESULT_REASON_CODE)
    expect(FORGED_EVENT_REF).toHaveLength(500)
    expect(FORGED_VISIBLE_TEXT.length).toBeGreaterThan(STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH)

    await mount({ suffix: 'forged-accepted', forge: () => forged })
    const token = seam.boundary.token()
    await submitAnswer('ready')

    expect(runtime.turns).toHaveLength(1)

    // The forged prose never reached her screen.
    expect(hasText(container, FORGED_VISIBLE_TEXT)).toBe(false)
    // Nor any recognisable run of it — a host that truncated rather than
    // rejected would fail here while passing the assertion above.
    expect(hasText(container, 'Z'.repeat(200))).toBe(false)

    // The forged reference never reached durable state, under any key.
    expect(durableFootprint()).not.toContain(FORGED_EVENT_REF)
    expect(durable.sessions.map((session) => session.lastAcceptedEventRef)).not.toContain(FORGED_EVENT_REF)
    expect(durableFootprint()).not.toContain(FORGED_VISIBLE_TEXT)

    expectNoSafetyOrInterruptionConsequences(token)
  })

  // ────────────────────────────────────────────────────────────────────────
  // PHASE 3 — a forged STOPPED result carrying learner prose
  // ────────────────────────────────────────────────────────────────────────

  it('refuses a forged stopped result: no durable safety stop, no lock, and the learner prose is written nowhere', async () => {
    const forged = {
      status: 'stopped',
      reasonCode: LEARNER_PROSE_SENTINEL,
      deliveryStatus: 'not-confirmed',
    }

    // The counterfactual. `deliveryStatus` is genuinely admissible here; it is
    // the prose `reasonCode` alone that the contract refuses, which is the
    // point — one forged field is enough.
    const canonical = acceptStudyTutorResult(forged)
    expect(canonical.status).toBe('quarantined')
    if (canonical.status !== 'quarantined') return
    expect(canonical.reasonCode).toBe(STUDY_TUTOR_UNPARSED_RESULT_REASON_CODE)

    await mount({ suffix: 'forged-stopped', forge: () => forged })
    const token = seam.boundary.token()
    await submitAnswer('ready')

    expect(runtime.turns).toHaveLength(1)

    // PHASE 11 — the sentinel appears in ZERO durable events, in no safety-stop
    // ledger entry, in no session record, in no rendered text, and in nothing
    // captured for monitoring.
    expect(durableFootprint()).not.toContain(LEARNER_PROSE_SENTINEL)
    expect(durableFootprint()).not.toContain('unsafe at home')
    expect(hasText(container, LEARNER_PROSE_SENTINEL)).toBe(false)
    expect(logged.join(' ')).not.toContain(LEARNER_PROSE_SENTINEL)
    expect(logged.join(' ')).not.toContain('unsafe at home')

    // And the safety path itself never ran.
    expectNoSafetyOrInterruptionConsequences(token)
  })

  // ────────────────────────────────────────────────────────────────────────
  // PHASE 6 — the remaining two forged branches
  // ────────────────────────────────────────────────────────────────────────

  it('refuses a forged authorization-infrastructure interruption rather than inventing a technical outage', async () => {
    // A bare interruption kind carrying a second key. `narrowedInterruption`
    // rejects it, so the whole result fails the contract.
    const forged = {
      status: 'interrupted',
      interruption: { kind: 'authorization-infrastructure', reason: 'gateway-unreachable' },
    }
    expect(acceptStudyTutorResult(forged).status).toBe('quarantined')

    await mount({ suffix: 'forged-auth-infra', forge: () => forged })
    const token = seam.boundary.token()
    await submitAnswer('ready')

    expect(runtime.turns).toHaveLength(1)
    expectNoSafetyOrInterruptionConsequences(token)
  })

  it('refuses a forged session-authorization interruption rather than ending the lesson', async () => {
    // `session-authorization` requires a `reason` the contract recognises; this
    // one has none. At the host, an invented session-authorization interruption
    // is not merely a message — it latches `sessionAuthorizationLost` and
    // disables every control for the rest of the mount.
    const forged = { status: 'interrupted', interruption: { kind: 'session-authorization' } }
    expect(acceptStudyTutorResult(forged).status).toBe('quarantined')

    await mount({ suffix: 'forged-session-auth', forge: () => forged })
    const token = seam.boundary.token()
    await submitAnswer('ready')

    expect(runtime.turns).toHaveLength(1)
    expectNoSafetyOrInterruptionConsequences(token)
  })

  it('refuses a forged quarantined result carrying learner prose without ever reading its fields', async () => {
    /**
     * The honest one. The host's `quarantined` branch reads NO fields, so a
     * forged quarantined result and its canonical replacement drive identical
     * host behaviour — this test would pass with or without the reparse, and it
     * is recorded as such in the campaign (M-equivalent).
     *
     * It is here anyway, because the property it pins is not the branch: it is
     * that a `reasonCode` bearing a child's words does not reach a durable
     * write or a log even on the arm nothing reads.
     */
    const forged = { status: 'quarantined', reasonCode: LEARNER_PROSE_SENTINEL }
    expect(acceptStudyTutorResult(forged).status).toBe('quarantined')

    await mount({ suffix: 'forged-quarantined', forge: () => forged })
    const token = seam.boundary.token()
    await submitAnswer('ready')

    expect(runtime.turns).toHaveLength(1)
    expect(durableFootprint()).not.toContain(LEARNER_PROSE_SENTINEL)
    expect(logged.join(' ')).not.toContain(LEARNER_PROSE_SENTINEL)
    expectNoSafetyOrInterruptionConsequences(token)
  })

  // ────────────────────────────────────────────────────────────────────────
  // PHASE 6 — positive controls. The reparse must not quarantine everything.
  // ────────────────────────────────────────────────────────────────────────

  it('preserves an accepted turn whose result really is canonical', async () => {
    await mount({
      suffix: 'canonical-accepted',
      forge: () => acceptStudyTutorResult({
        status: 'accepted',
        eventRef: CANONICAL_EVENT_REF,
        visibleText: 'Nice work. Try the next one.',
      }),
    })
    await submitAnswer('ready')

    // Value semantics survive the host's own reparse: the prose is on screen and
    // the reference is the one persisted against the session.
    expect(hasText(container, 'Nice work. Try the next one.')).toBe(true)
    expect(hasText(container, TECHNICAL_FAILURE_MESSAGE)).toBe(false)
    expect(durable.sessions.at(-1)!.lastAcceptedEventRef).toBe(CANONICAL_EVENT_REF)
    expect(readLocalSafetyStops(storage)).toEqual([])
    expect(isLocked()).toBe(false)
  })

  it('preserves a genuine safety stop whose result really is canonical', async () => {
    await mount({
      suffix: 'canonical-stopped',
      forge: () => acceptStudyTutorResult({
        status: 'stopped',
        reasonCode: 'mounted-input-safety-urgent',
        deliveryStatus: 'proposed-not-delivered',
      }),
    })
    const originatingEpoch = seam.boundary.token()
    await submitAnswer('ready')

    // The reparse must not have cost a real stop its durability. This is the
    // half that matters most if the parse were ever made too strict.
    expect(isLocked()).toBe(true)
    expect(readLocalSafetyStops(storage)).toHaveLength(1)
    expect(durable.events.map((event) => event.type)).toContain('safety-stop')
    const stop = durable.events.find((event) => event.type === 'safety-stop')!
    expect(stop.payload).toEqual({
      reasonCode: 'mounted-input-safety-urgent',
      deliveryStatus: 'proposed-not-delivered',
    })
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(true)
    expect(hasText(container, 'Study paused')).toBe(true)
    expect(originatingEpoch.isCurrent()).toBe(false)
    expect(seam.boundary.lastReason).toBe('safety-stop')
  })

  it('does not let an old safety-stop completion cancel the newer learner epoch', async () => {
    const { epochA, completion: oldCompletion, release } = await beginHeldCanonicalStop(
      'stale-safety-stop-epoch-a',
    )

    seam.boundary.beginEpoch({
      ...seam.binding,
      authenticatedSessionRef: 'host-lifecycle:study-a1-stale-authority:epoch-b',
      learnerRef: 'learner:epoch-b',
      launchGrantRef: 'opaque-grant-epoch:2',
      authorizationRevision: 2,
    })
    const epochB = seam.boundary.token()
    expect(epochA.isCurrent()).toBe(false)
    expect(epochB.isCurrent()).toBe(true)

    release()
    await act(async () => { await oldCompletion })
    await settle()

    expect(epochB.isCurrent()).toBe(true)
    expect(seam.boundary.binding?.learnerRef).toBe('learner:epoch-b')
    expect(seam.boundary.lastReason).not.toBe('safety-stop')
    expect(durable.events.map((event) => event.type)).not.toContain('safety-stop')
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(false)
    const records = readLocalSafetyStops(storage)
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ studentRef: context.learnerRef, sessionRef })
    expect(records.some((record) => record.studentRef === 'learner:epoch-b')).toBe(false)
  })

  it('does not let Epoch A cancel Epoch C after two authority rotations while its lock waits', async () => {
    const { epochA, completion, release } = await beginHeldCanonicalStop(
      'stale-safety-stop-epoch-a-to-b-to-c',
    )
    seam.boundary.beginEpoch({
      ...seam.binding,
      authenticatedSessionRef: 'host-lifecycle:study-a1-stale-authority:epoch-b',
      learnerRef: 'learner:epoch-b',
      launchGrantRef: 'opaque-grant-epoch:2',
      authorizationRevision: 2,
    })
    const epochB = seam.boundary.token()
    seam.boundary.beginEpoch({
      ...seam.binding,
      authenticatedSessionRef: 'host-lifecycle:study-a1-stale-authority:epoch-c',
      learnerRef: 'learner:epoch-c',
      launchGrantRef: 'opaque-grant-epoch:3',
      authorizationRevision: 3,
    })
    const epochC = seam.boundary.token()
    expect(epochA.isCurrent()).toBe(false)
    expect(epochB.isCurrent()).toBe(false)
    expect(epochC.isCurrent()).toBe(true)

    release()
    await act(async () => { await completion })
    await settle()

    expect(epochB.isCurrent()).toBe(false)
    expect(epochC.isCurrent()).toBe(true)
    expect(seam.boundary.binding?.learnerRef).toBe('learner:epoch-c')
    expect(durable.events.map((event) => event.type)).not.toContain('safety-stop')
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(false)
  })

  it('uses epoch identity rather than learner equality for a same-learner replacement session', async () => {
    const { epochA, completion, release } = await beginHeldCanonicalStop(
      'stale-safety-stop-same-learner-new-epoch',
    )
    seam.boundary.beginEpoch({
      ...seam.binding,
      authenticatedSessionRef: 'host-lifecycle:study-a1-stale-authority:same-learner-epoch-b',
      launchGrantRef: 'opaque-grant-same-learner-epoch:2',
      authorizationRevision: 2,
    })
    const replacementEpoch = seam.boundary.token()
    expect(epochA.binding.learnerRef).toBe(replacementEpoch.binding.learnerRef)
    expect(epochA.isCurrent()).toBe(false)
    expect(replacementEpoch.isCurrent()).toBe(true)

    release()
    await act(async () => { await completion })
    await settle()

    expect(replacementEpoch.isCurrent()).toBe(true)
    expect(seam.boundary.binding?.authenticatedSessionRef).toContain('same-learner-epoch-b')
    expect(durable.events.map((event) => event.type)).not.toContain('safety-stop')
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(false)
  })

  it('stops after a swallowed stale event-append rejection instead of finalizing against Epoch B', async () => {
    await mount({
      suffix: 'stale-during-safety-event-append',
      forge: () => acceptStudyTutorResult({
        status: 'stopped',
        reasonCode: 'mounted-input-safety-urgent',
        deliveryStatus: 'proposed-not-delivered',
      }),
    })
    const appendEntered = deferred()
    const appendReleased = deferred()
    Object.assign(ports, { eventLedger: {
      append: async () => {
        appendEntered.resolve()
        await appendReleased.promise
        throw new Error('event ledger unavailable')
      },
    } })
    const epochA = seam.boundary.token()
    const { completion } = await beginAnswerSubmission('ready')
    await appendEntered.promise

    seam.boundary.beginEpoch({
      ...seam.binding,
      authenticatedSessionRef: 'host-lifecycle:study-a1-stale-append:epoch-b',
      learnerRef: 'learner:stale-append-epoch-b',
      launchGrantRef: 'opaque-grant-stale-append:2',
      authorizationRevision: 2,
    })
    const epochB = seam.boundary.token()
    expect(epochA.isCurrent()).toBe(false)
    expect(epochB.isCurrent()).toBe(true)

    appendReleased.resolve()
    await act(async () => { await completion })
    await settle()

    expect(epochB.isCurrent()).toBe(true)
    expect(seam.boundary.lastReason).not.toBe('safety-stop')
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(false)
    expect(durable.events.map((event) => event.type)).not.toContain('safety-stop')
  })

  it('does not let an unmounted Epoch A completion cancel a newly mounted current epoch', async () => {
    const { epochA, completion, release } = await beginHeldCanonicalStop(
      'stale-safety-stop-unmounted-epoch-a',
    )
    const oldRoot = roots.pop()
    if (!oldRoot) throw new Error('The Epoch A root was not mounted.')
    await act(async () => { oldRoot.unmount() })

    const epochBContext = { ...context, learnerRef: 'learner:newly-mounted-epoch-b' }
    seam.boundary.beginEpoch({
      ...seam.binding,
      authenticatedSessionRef: 'host-lifecycle:study-a1-unmount:epoch-b',
      learnerRef: epochBContext.learnerRef,
      launchGrantRef: 'opaque-grant-unmount:2',
      authorizationRevision: 2,
    })
    const epochBBinding = seam.boundary.binding
    if (!epochBBinding) throw new Error('Epoch B did not bind.')
    const epochBSeam: HostStudyLifecycleSeam = Object.freeze({
      boundary: seam.boundary,
      binding: epochBBinding,
    })
    const epochB = seam.boundary.token()
    container = documentTarget.createElement('div')
    documentTarget.body.appendChild(container)
    const newRoot = createRoot(container as unknown as Element)
    roots.push(newRoot)
    await act(async () => {
      newRoot.render(
        <ProductionStudySessionContainer
          context={epochBContext}
          initialEntry={entry}
          ports={ports}
          studyLifecycle={epochBSeam}
          tutorRuntime={runtime}
          onBack={() => {}}
        />,
      )
    })
    await settle()
    expect(epochA.isCurrent()).toBe(false)
    expect(epochB.isCurrent()).toBe(true)

    release()
    await act(async () => { await completion })
    await settle()

    expect(epochB.isCurrent()).toBe(true)
    expect(seam.boundary.binding?.learnerRef).toBe(epochBContext.learnerRef)
    expect(seam.boundary.lastReason).not.toBe('safety-stop')
  })

  it('preserves a genuine rate-limit interruption whose result really is canonical', async () => {
    await mount({
      suffix: 'canonical-interrupted',
      forge: () => acceptStudyTutorResult({ status: 'interrupted', interruption: { kind: 'rate-limit' } }),
    })
    await submitAnswer('ready')

    expect(hasAttribute(container, 'data-study-interrupted')).toBe(true)
    expect(hasText(container, STUDY_BUSY_RETRY_MESSAGE)).toBe(true)
    // Nothing durable, no stop, no lock — a shed request is only a wait.
    expect(readLocalSafetyStops(storage)).toEqual([])
    expect(isLocked()).toBe(false)
    expect(durable.events.map((event) => event.type)).not.toContain('safety-stop')
  })

  it('preserves a genuine quarantine whose result really is canonical', async () => {
    await mount({
      suffix: 'canonical-quarantined',
      forge: () => acceptStudyTutorResult({ status: 'quarantined', reasonCode: 'bridge-replayed-turn' }),
    })
    const token = seam.boundary.token()
    await submitAnswer('ready')

    expectNoSafetyOrInterruptionConsequences(token)
  })

  // ────────────────────────────────────────────────────────────────────────
  // PHASE 7 — double-parse idempotence
  // ────────────────────────────────────────────────────────────────────────

  it('accepts its own output for all four branches, by value', () => {
    const raws: readonly unknown[] = [
      { status: 'accepted', eventRef: CANONICAL_EVENT_REF, visibleText: 'Nice work.' },
      { status: 'stopped', reasonCode: 'mounted-input-safety-urgent', deliveryStatus: 'proposed-not-delivered' },
      { status: 'interrupted', interruption: { kind: 'rate-limit' } },
      { status: 'interrupted', interruption: { kind: 'session-authorization', reason: 'study-session-rejected' } },
      { status: 'quarantined', reasonCode: 'bridge-replayed-turn' },
    ]

    for (const raw of raws) {
      const once = acceptStudyTutorResult(raw)
      const twice = acceptStudyTutorResult(once)

      // By VALUE. Identity is deliberately not asserted: the parser rebuilds
      // field by field, so a second pass produces a fresh frozen object and
      // reference equality would be the wrong pin.
      expect(twice).toEqual(once)
      expect(twice.status).toBe(once.status)
      expect(Object.isFrozen(twice)).toBe(true)
      expect(Object.keys(twice).sort()).toEqual([...STUDY_TUTOR_RESULT_KEYS[twice.status]].sort())

      // The round trip did not degrade a valid result into a quarantine — which
      // is what a non-idempotent parser would look like from the host's side.
      expect(twice.status).not.toBe(
        once.status === 'quarantined' ? 'accepted' : 'quarantined',
      )

      // Nested values are rebuilt and frozen too, not carried by reference.
      if (twice.status === 'interrupted' && once.status === 'interrupted') {
        expect(twice.interruption).toEqual(once.interruption)
        expect(Object.isFrozen(twice.interruption)).toBe(true)
      }
    }
  })

  // ────────────────────────────────────────────────────────────────────────
  // PHASE 8 — a hostile accessor
  // ────────────────────────────────────────────────────────────────────────

  it('reads a hostile visibleText accessor exactly once and renders the value it validated', async () => {
    /**
     * NOT RED BEFORE THIS CARD, and recorded as such rather than dressed up.
     *
     * The pre-card normalizer already COPIED `eventRef` and `visibleText` into a
     * fresh object before the host's branches ran, so the accepted arm read a
     * hostile accessor exactly once even with no parse in front of it. This test
     * does not witness the F4 defect.
     *
     * It is kept because it is load-bearing in the other direction: it is what
     * fails if any later edit makes the accepted arm read the RAW object again
     * (campaign M3 and M9). The genuinely-red rebuild witness is the nested
     * interruption below, which the pre-card normalizer passed through by
     * reference rather than copying.
     *
     * The transcript is switched on for this mount so a second read would have
     * somewhere visible to land: the container appends `result.visibleText` to
     * the approved transcript immediately after setting the utterance.
     */
    let visibleTextReads = 0
    const hostileText = 'X'.repeat(3_000)
    const forged = {
      status: 'accepted',
      eventRef: CANONICAL_EVENT_REF,
      get visibleText() {
        visibleTextReads += 1
        return visibleTextReads === 1 ? 'Nice work.' : hostileText
      },
    }

    await mount({
      suffix: 'hostile-accessor',
      forge: () => forged,
      hostContext: {
        ...context,
        accessibility: { ...context.accessibility, transientTranscript: true },
      },
    })
    await submitAnswer('ready')

    // ONE read, by the parser. The host never touched the raw object.
    expect(visibleTextReads).toBe(1)

    // The validated value is the value rendered.
    expect(hasText(container, 'Nice work.')).toBe(true)

    // Open the transcript, where a re-read would have landed on screen.
    const toggle = control('Show transcript')
    if (toggle) {
      await act(async () => {
        const onClick = reactProps(toggle).onClick as unknown as () => void
        onClick()
      })
      await settle()
    }
    expect(hasText(container, hostileText)).toBe(false)
    expect(hasText(container, 'X'.repeat(200))).toBe(false)
    expect(durableFootprint()).not.toContain(hostileText)

    // Still exactly one read after all of that.
    expect(visibleTextReads).toBe(1)
  })

  it('writes the reasonCode it VALIDATED to the safety ledger, not the one the object says next', async () => {
    /**
     * PHASE 8 + PHASE 11, on the one field whose content reaches an adult's
     * permanent record verbatim.
     *
     * This forge is a GENUINE safety stop — it parses, the learner really is
     * stopped, and the durable write really must happen. The attack is in the
     * second read: `reasonCode` answers the contract's check with proper machine
     * vocabulary and then, once past it, returns a sentence the child typed.
     * `deliveryStatus` flips too, which is what decides whether the ledger
     * records the safety service as having ANSWERED or merely as unconfirmed.
     *
     * Found by the mutation campaign, not by design: mutant M4 (stopped branch
     * re-reads raw fields) survived the first pass, because every other stopped
     * fixture here feeds the parser's own frozen output, where a re-read cannot
     * differ. It is the highest-value witness on the card and it was the one
     * missing.
     */
    let reasonCodeReads = 0
    let deliveryStatusReads = 0
    const forged = {
      status: 'stopped',
      get reasonCode() {
        reasonCodeReads += 1
        return reasonCodeReads === 1 ? 'mounted-input-safety-urgent' : LEARNER_PROSE_SENTINEL
      },
      get deliveryStatus() {
        deliveryStatusReads += 1
        return deliveryStatusReads === 1 ? 'proposed-not-delivered' : 'not-confirmed'
      },
    }

    await mount({ suffix: 'hostile-stopped-fields', forge: () => forged })
    await submitAnswer('ready')

    expect(runtime.turns).toHaveLength(1)

    // Each field read exactly once, by the parser.
    expect(reasonCodeReads).toBe(1)
    expect(deliveryStatusReads).toBe(1)

    // The stop is real and durable — the reparse must not have cost it that.
    expect(isLocked()).toBe(true)
    expect(readLocalSafetyStops(storage)).toHaveLength(1)
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(true)

    // And what was written is what was CHECKED.
    const stop = durable.events.find((event) => event.type === 'safety-stop')!
    expect(stop.payload).toEqual({
      reasonCode: 'mounted-input-safety-urgent',
      deliveryStatus: 'proposed-not-delivered',
    })
    expect(readLocalSafetyStops(storage)[0]!.serverCaptureStatus).toBe('server-answered-stop')

    // The learner's sentence reached no durable write, no ledger entry, no
    // screen, and no log — on the one path that genuinely does write.
    expect(durableFootprint()).not.toContain(LEARNER_PROSE_SENTINEL)
    expect(durableFootprint()).not.toContain('unsafe at home')
    expect(hasText(container, LEARNER_PROSE_SENTINEL)).toBe(false)
    expect(logged.join(' ')).not.toContain(LEARNER_PROSE_SENTINEL)

    expect(reasonCodeReads).toBe(1)
    expect(deliveryStatusReads).toBe(1)
  })

  it('reads a stopped child the HOST’s words, never words the Tutor smuggled past the parser', async () => {
    /**
     * STUDY-A1-PRODUCTION-SAFE-CONTAINER, and the honest version of what this
     * card's mutation campaign found.
     *
     * Two mutants of the seam's stopped arm SURVIVED — `studentMessage` taken
     * from the raw object, and `studentMessage` set to the operator reason code.
     * Both are DECLARED EQUIVALENT, and the reason is worth stating because it
     * is not the reason it first looked like.
     *
     * `StudyHostTurnResult`'s `studentMessage` reaches `setJarvisText` and stops
     * there. The locked surface does not render `jarvisText`: it passes
     * STUDY_LEARNER_STOP_MESSAGE directly, as a constant, and once `stopped` is
     * true the branch that would have shown `jarvisText` is unreachable. So no
     * value the seam puts in that field can be displayed to a stopped child by
     * this surface, and no behavioural fixture can distinguish the mutants.
     *
     * The guarantee is therefore STRUCTURAL, and this test pins the structure
     * rather than pretending a behavioural pin exists — the counterpart
     * assertion at the end is the one that would fail if a later card wired the
     * locked surface to `jarvisText` and made the field live.
     *
     * What IS behavioural here is the rest, and it is not vacuous: prose that a
     * Tutor smuggles past the parser must reach no durable write, no safety
     * ledger entry, no screen and no log, on the one path that genuinely writes.
     *
     * THE FIXTURE HAS TO DEFEAT THE PARSER TO REACH THE STOPPED BRANCH AT ALL.
     * `parseStudyTutorResult` admits an exact key set per branch using
     * `Reflect.ownKeys`, so an OWN `studentMessage` — enumerable or not — is
     * rejected and the result becomes `quarantined`, which never enters the
     * stopped branch. Inherited properties are not own keys, so the message
     * rides the PROTOTYPE: the parser sees a clean two-key stopped result and
     * accepts it, the stop is genuine and durable, and `raw.studentMessage`
     * still resolves for anything that reaches back for it. That is not a
     * contrived shape — it is what a transport wrapper returning a class
     * instance produces.
     */
    const TUTOR_AUTHORED_WORDS = 'You are in serious trouble. Do not tell your parents about this.'
    class TransportStoppedResult {
      readonly status = 'stopped'
      readonly reasonCode = 'mounted-input-safety-urgent'
      readonly deliveryStatus = 'proposed-not-delivered'
    }
    // On the prototype, so it is invisible to Reflect.ownKeys and therefore to
    // the parser's key check, while `forged.studentMessage` still reads it.
    Object.defineProperty(TransportStoppedResult.prototype, 'studentMessage', {
      value: TUTOR_AUTHORED_WORDS,
      enumerable: false,
    })
    const forged = new TransportStoppedResult()
    // The fixture cannot fail silently: if the parser ever starts rejecting this
    // shape, the stopped branch stops running and the assertions below would be
    // proving nothing. Both halves are stated.
    expect(Reflect.ownKeys(forged)).toEqual(['status', 'reasonCode', 'deliveryStatus'])
    expect((forged as { studentMessage?: string }).studentMessage).toBe(TUTOR_AUTHORED_WORDS)

    await mount({ suffix: 'tutor-authored-stop-words', forge: () => forged })
    await submitAnswer('ready')

    // The stop is REAL: it parsed, it locked, and it was recorded. Without this
    // the test would pass just as well against a container that quarantined.
    expect(isLocked()).toBe(true)
    expect(readLocalSafetyStops(storage)).toHaveLength(1)
    expect(durable.events.find((event) => event.type === 'safety-stop')).toBeDefined()

    // And she reads the host's words. Not the Tutor's — nowhere on the surface,
    // nowhere durable, and nowhere in the log.
    expect(hasText(container, STUDY_LEARNER_STOP_MESSAGE)).toBe(true)
    expect(hasText(container, TUTOR_AUTHORED_WORDS)).toBe(false)
    expect(hasText(container, 'Do not tell your parents')).toBe(false)
    expect(durableFootprint()).not.toContain(TUTOR_AUTHORED_WORDS)
    expect(durableFootprint()).not.toContain('Do not tell your parents')
    expect(logged.join(' ')).not.toContain(TUTOR_AUTHORED_WORDS)

    /**
     * The structural counterpart, and the load-bearing half — see the note
     * above on why the behavioural half cannot distinguish the two equivalent
     * mutants.
     *
     * The locked surface renders the host's constant DIRECTLY. It does not
     * render `jarvisText`, which is where a Tutor-authored message would have
     * landed. Wiring those together is the one edit that would turn the
     * equivalent mutants live, and it fails here.
     */
    const body = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'components', 'study', 'studySessionSurface.tsx'),
      'utf8',
    )
    const lockedSurface = body.slice(body.indexOf('if (stopped) return ('), body.indexOf('if (loading) return'))
    expect(lockedSurface).toContain('visibleText={STUDY_LEARNER_STOP_MESSAGE}')
    expect(lockedSurface).not.toContain('jarvisText')
    // And the slice really is the locked surface, so the two assertions above
    // are about the screen a stopped child sees rather than about an empty
    // string that trivially satisfies both.
    expect(lockedSurface).toContain('data-study-stopped="true"')
  })

  it('holds the REBUILT interruption, not the Tutor object that produced it', async () => {
    /**
     * PHASE 8, the red half. The pre-card normalizer copied the accepted arm's
     * primitives but passed the interruption arm's nested object straight
     * through — `{ status: 'interrupted', interruption: result.interruption }`.
     * That object then lived in React state and was re-read on every render.
     *
     * So a one-key interruption with a hostile `kind` accessor is admissible on
     * its first read and something else on every read after it. Before this card
     * that turned a retryable rate limit into a session-authorization lockout:
     * the answer she had already typed was not put back, every control was
     * disabled for the rest of the mount, and she was told the session ended.
     *
     * The canonical parser reads `kind` once and freezes `{ kind }` from the
     * value it read, so after the reparse the host holds a rebuilt object that
     * cannot change its mind.
     */
    let kindReads = 0
    const forged = {
      status: 'interrupted',
      interruption: {
        get kind() {
          kindReads += 1
          return kindReads === 1 ? 'rate-limit' : 'session-authorization'
        },
      },
    }

    await mount({ suffix: 'hostile-interruption', forge: () => forged })
    await submitAnswer('ready')

    expect(runtime.turns).toHaveLength(1)

    // Read once, by the parser, and never again.
    expect(kindReads).toBe(1)

    // The interruption the host acted on is the one that was validated.
    expect(hasText(container, STUDY_BUSY_RETRY_MESSAGE)).toBe(true)
    expect(hasText(container, STUDY_SESSION_UNAVAILABLE_MESSAGE)).toBe(false)

    // A rate limit is retryable, so her answer is back in the box and the
    // controls are still live. A latched `sessionAuthorizationLost` would have
    // disabled both.
    const textarea = tags(container, 'TEXTAREA')[0]!
    expect((reactProps(textarea) as unknown as { value: string }).value).toBe('ready')
    expect((reactProps(textarea) as unknown as { disabled: boolean }).disabled).toBe(false)
    expect(control('Send through Tutor boundary')).toBeDefined()

    // Nothing durable, and no safety consequence, on either reading.
    expect(readLocalSafetyStops(storage)).toEqual([])
    expect(isLocked()).toBe(false)
    expect(durable.events.map((event) => event.type)).not.toContain('safety-stop')

    // Still one read after every render the assertions above provoked.
    expect(kindReads).toBe(1)
  })

  // ────────────────────────────────────────────────────────────────────────
  // PHASE 9 — a frozen forge
  // ────────────────────────────────────────────────────────────────────────

  it('reparses a FROZEN forged result: freeze means immutable, not vouched for', async () => {
    const forged = Object.freeze({
      status: 'accepted',
      eventRef: FORGED_EVENT_REF,
      visibleText: FORGED_VISIBLE_TEXT,
    })
    // The trap this pins: the canonical parser freezes what it returns, so
    // `Object.isFrozen` looks like a cheap provenance test. It is not one — an
    // attacker can freeze too, and here has.
    expect(Object.isFrozen(forged)).toBe(true)
    expect(acceptStudyTutorResult(forged).status).toBe('quarantined')

    await mount({ suffix: 'frozen-forge', forge: () => forged })
    const token = seam.boundary.token()
    await submitAnswer('ready')

    expect(runtime.turns).toHaveLength(1)
    expect(hasText(container, FORGED_VISIBLE_TEXT)).toBe(false)
    expect(durableFootprint()).not.toContain(FORGED_EVENT_REF)
    expectNoSafetyOrInterruptionConsequences(token)
  })
})
