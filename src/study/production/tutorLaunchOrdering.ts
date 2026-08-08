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
import { runCurrentStudyWork, type StudyLifecycleToken } from '../lifecycle'
import type { StudyPortBundle } from '../ports'
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
  readonly ports: StudyPortBundle
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
