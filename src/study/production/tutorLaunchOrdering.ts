/**
 * STUDY-A1-PROD-TUTOR-WRAPPER — launch before durable preparation, made
 * structural.
 *
 * This closes STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT (F1) in
 * ../contracts/tutor/wrapperObligations.ts.
 *
 * What the host does today, at StudySessionContainer.tsx:182 as of the base of
 * this card:
 *
 *   runtime.launch(context, initialEntry, sessionRef)      // not awaited
 *   if (next.state === 'scheduled') next = await ports.calendar.start(...)
 *   await ports.eventLedger.append(scope, { type: 'session-launched', ... })
 *   await ports.persistence.saveSession({ ..., status: 'active' })
 *
 * That is correct for the preview runtime and only for it: `AcceptedRc1HostRuntime.launch`
 * is synchronous, so by the time the next line runs it has either returned or
 * thrown. The production contract's `launch` returns `Promise<void>`, and for
 * that shape the same four lines mean: start the block, write the durable
 * session-launched event and persist the active session row, and only then find
 * out whether the Tutor session exists at all. When it does not, a girl who
 * never got a Study session has a calendar block marked begun, a durable record
 * saying Study started, and an active session row her next visit will resume
 * into. Nothing rolls back — the rejection is caught by the container's error
 * branch, which shows a message and writes nothing.
 *
 * A comment saying "await this" would not have stopped it, and neither would a
 * boolean: `if (launched)` is satisfiable by a caller that sets a flag before
 * the promise settles, which is precisely the mistake being prevented. So the
 * ordering is expressed as a capability instead.
 *
 * `LaunchSettled` is a branded witness. It is produced in exactly one place —
 * `settleStudyTutorLaunch` below, after the await and after the lifecycle token
 * has been re-asserted — and `prepareDurableStudySession` will not run without
 * one. The brand is an unexported `unique symbol`, so a caller cannot write the
 * witness down, cannot build an object literal of the right shape, and cannot
 * obtain one from anywhere but a launch that actually settled. Reordering the
 * two calls is not a subtle bug that review has to catch; it does not compile.
 *
 * The residual bypass is a type assertion, and it is the same residual the
 * validated-result brand has — recorded honestly in wrapperObligations.ts. One
 * `as LaunchSettled` compiles. What the brand removes is every bypass that
 * reads as correct code.
 */
import {
  acceptStudyTutorEligibility,
  type StudyTutorIneligibleReason,
} from '../contracts/tutor/eligibility'
import { runCurrentStudyWork, type StudyLifecycleToken } from '../lifecycle'
import type { ProductionStudySessionPorts } from '../ports'
import type { StudyCalendarEntry, StudyScope, StudyLearnerScope } from '../types'

declare const STUDY_TUTOR_LAUNCH_SETTLED_BRAND: unique symbol

/**
 * Proof that a Tutor launch was awaited to settlement and that the host's
 * authority was still current afterwards.
 *
 * Deliberately not a boolean and deliberately not `void`. It carries the epoch
 * it was minted for so that a witness from an earlier epoch is visible as one,
 * and so that a reader can see the value is about a moment rather than about a
 * fact that stays true.
 */
export interface LaunchSettled {
  readonly [STUDY_TUTOR_LAUNCH_SETTLED_BRAND]: 'study-tutor.launch-settled'
  /** The lifecycle epoch that was current on both sides of the await. */
  readonly epoch: number
}

/**
 * Module-private, and the only place the brand is applied.
 *
 * Not exported, for the same reason `validated` in ../contracts/tutor/results.ts
 * is not: exporting it would hand a caller exactly the bypass the brand exists
 * to remove.
 */
function settled(epoch: number): LaunchSettled {
  return Object.freeze({ epoch }) as LaunchSettled
}

/**
 * Await the Tutor launch, re-assert the host's authority, and mint the witness.
 *
 * Three things happen here and each one is load-bearing.
 *
 * The `await` is the requirement itself. `launch` is typed as returning
 * `unknown` rather than `Promise<void>` so that a synchronous launch — the
 * preview runtime's — is awaited on exactly the same path: `await` of a
 * non-promise still yields to the microtask queue, and a synchronous throw
 * still arrives here as a rejection. There is one ordering rule and one code
 * path that implements it, so preview and production cannot drift apart.
 *
 * The post-await `assertCurrent` is the second requirement, and it is separate
 * from the first. A launch can take a real interval, and in that interval a
 * learner can be switched, an adult can log out, a grant can expire or Study can
 * be turned off. A witness minted without re-checking would authorize durable
 * writes for an epoch that no longer exists — the launch succeeded, but not for
 * this learner and not now.
 *
 * A rejection propagates unchanged. The caller's existing failure surface
 * handles it, and — because no witness was produced — there is nothing it could
 * have written durably before finding out.
 */
export async function settleStudyTutorLaunch(
  token: StudyLifecycleToken,
  launch: () => unknown,
): Promise<LaunchSettled> {
  token.assertCurrent()
  await launch()
  token.assertCurrent()
  return settled(token.epoch)
}

/**
 * STUDY-A1-TUTOR-CONTENT-ELIGIBILITY-CONTRACT — the refusal a host raises when
 * the Tutor cannot teach this block's content.
 *
 * Deliberately an ERROR and not a result. `settleEligibleStudyTutorLaunch`
 * returns `Promise<LaunchSettled>`, and a witness is the ONLY thing it may
 * return: an ineligible outcome that came back as a value would have to be a
 * second branch a caller could ignore, and ignoring it is exactly the mistake.
 * A rejection lands on the failure surface the host already has for a launch
 * that could not start, and — because no witness was produced —
 * `prepareDurableStudySession` cannot run on any path that reaches it.
 *
 * The reason code travels so an operator can tell WHICH refusal happened. It is
 * content vocabulary, never learner vocabulary, so nothing about a child is
 * recorded by raising it.
 */
export class StudyTutorContentIneligibleError extends Error {
  readonly reasonCode: StudyTutorIneligibleReason
  constructor(reasonCode: StudyTutorIneligibleReason) {
    super(`This Study block's content is not eligible for the Tutor: ${reasonCode}`)
    this.name = 'StudyTutorContentIneligibleError'
    this.reasonCode = reasonCode
  }
}

/**
 * STUDY-A1-TUTOR-CONTENT-ELIGIBILITY-CONTRACT — content eligibility, before the
 * launch and therefore before everything.
 *
 * ZERO DURABLE WORK is the property being bought, and the ordering that buys it
 * is the whole of this function: the eligibility decision is settled BEFORE
 * `launch` is called, so an ineligible block never opens a Tutor session, never
 * mints a `LaunchSettled`, and therefore cannot reach `calendar.start`, the
 * `session-launched` event or `saveSession` — the three writes
 * `prepareDurableStudySession` performs and the only place they are performed.
 *
 * The decision arrives as `unknown` and is REPARSED here. That is F4's lesson
 * applied to a second transport: this decision is destined to come back from a
 * pre-launch server check, and a host that trusted a `StudyTutorEligibility`
 * type its caller declared would be trusting a compile-time fact about a value
 * that crossed a network. `acceptStudyTutorEligibility` fails closed — an
 * unparseable answer is INELIGIBLE, not a shrug — so a malformed or truncated
 * response cannot read as a yes.
 *
 * WHY THIS IS A SECOND ENTRY POINT rather than a parameter on
 * `settleStudyTutorLaunch`. That function is on the mounted preview path too,
 * and the preview does not route reviewed Tutor content at launch: its
 * `AcceptedRc1HostRuntime.launch` selects no program at all, and program
 * selection happens later, on submit. Requiring an eligibility decision there
 * would mean inventing one for a path that has nothing to decide, and the only
 * shape that invention can take is a constant that always says yes — the
 * `programs[0]` fallback again, wearing a different hat.
 *
 * THE RESIDUAL, stated plainly and in the same terms F1 and F4 use for theirs:
 * a production host can still call `settleStudyTutorLaunch` directly and skip
 * this. That is not closed here and cannot be, because the production host does
 * not exist yet — the obligation to come through this door is recorded as F5 in
 * ../contracts/tutor/wrapperObligations.ts and stays OPEN until a mounted
 * production host discharges it. What this entry point removes is the harder
 * failure: a host that DOES check eligibility but checks it in the wrong place.
 * There is one ordering rule here and one code path that implements it.
 */
export async function settleEligibleStudyTutorLaunch(
  eligibility: unknown,
  token: StudyLifecycleToken,
  launch: () => unknown,
): Promise<LaunchSettled> {
  const decision = acceptStudyTutorEligibility(eligibility)
  if (!decision.eligible) throw new StudyTutorContentIneligibleError(decision.reason)
  return settleStudyTutorLaunch(token, launch)
}

/**
 * The durable preparations a Study session mount performs, and the exact set
 * the F1 requirement names: calendar start or resume, the session-launched
 * event, and session persistence.
 *
 * Derived from the mounted host rather than invented — this is
 * StudySessionContainer's own preparation body, moved behind the witness. The
 * ordering inside it is unchanged, including the detail that the calendar
 * transition is chosen by the block's state and that the segment is resolved
 * from the entry the calendar returned rather than from the one that went in.
 */
export interface DurableStudySessionPreparation {
  readonly token: StudyLifecycleToken
  /**
   * The three roles this preparation consumes, and not the nine-role bundle it
   * used to ask for. A durable preparation touches the calendar, the event
   * ledger and the session row; it has never touched the review queue, parent
   * settings, adult-private notes or the outbox, and requiring them said a
   * deployment could not open a session until it could deliver an adult review.
   *
   * `StudyPortBundle` is still accepted — it is assignable to this — so the
   * mounted host's call site is unchanged. What is no longer accepted is the
   * reverse: this signature can no longer be read as a licence to reach for a
   * fourth role without saying so here first.
   */
  readonly ports: Pick<ProductionStudySessionPorts, 'calendar' | 'eventLedger' | 'persistence'>
  readonly scope: StudyScope
  readonly learnerScope: StudyLearnerScope
  readonly entry: StudyCalendarEntry
  readonly sessionRef: string
  /** One instant for the whole preparation, truncated by the caller. */
  readonly now: string
}

/**
 * Everything durable a session mount writes, and nothing that is not durable.
 *
 * The `settled` parameter is never read. That is the point: it is a capability,
 * not data, and requiring it is what makes "launch first" a property of the
 * type system rather than of the order two statements happen to appear in. It
 * is named rather than discarded so that a reader sees what it is, and so that
 * deleting it from the signature is a visible change to this module's contract
 * rather than a silent widening.
 */
export async function prepareDurableStudySession(
  settled: LaunchSettled,
  preparation: DurableStudySessionPreparation,
): Promise<StudyCalendarEntry> {
  void settled
  const { token, ports, scope, learnerScope, entry, sessionRef, now } = preparation
  let next = entry
  if (next.state === 'scheduled') {
    next = await runCurrentStudyWork(token, () => ports.calendar.start(learnerScope, next.blockRef, now))
  }
  if (next.state === 'paused') {
    next = await runCurrentStudyWork(token, () => ports.calendar.resume(learnerScope, next.blockRef, now))
  }
  const segment = next.segments.find((candidate) => !next.completedSegmentRefs.includes(candidate.segmentRef))
  if (!segment) throw new Error('This Study block is already complete.')
  await runCurrentStudyWork(token, () => ports.eventLedger.append(scope, {
    eventRef: `launch:${sessionRef}`,
    occurredAt: now,
    type: 'session-launched',
    payload: { lessonRef: next.lessonRef, segmentRef: segment.segmentRef },
  }))
  await runCurrentStudyWork(token, () => ports.persistence.saveSession({
    scope,
    lessonRef: next.lessonRef,
    segmentRef: segment.segmentRef,
    status: 'active',
    updatedAt: now,
    lastAcceptedEventRef: null,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  }))
  token.assertCurrent()
  return next
}
