import {
  acceptStudyTutorResult,
  parseStudyTutorLearnerText,
  parseStudyTutorRef,
  type StudyTutorRuntime,
} from '../../study/contracts/tutor'
import { STUDY_LEARNER_STOP_MESSAGE } from '../../study/safety/learnerSafe'
import { studyBridgeSessionRef } from '../../study/studyBridgeSessionRef'
import type {
  StudyHostTurn,
  StudyHostTurnResult,
  StudySessionBinding,
  StudySessionTutorSeam,
} from './studySessionSurface'

/**
 * STUDY-A1-PRODUCTION-SAFE-CONTAINER — the production Tutor seam.
 *
 * Everything in here was `StudySessionContainer`'s production branch, moved
 * whole rather than rewritten. It is the ONE implementation: no preview copy
 * exists, and the preview facade does not cross this module at any point.
 *
 * The import list is the reason this module is separate from the surface it
 * serves. It reaches the Tutor contract, the host's own stop message and the
 * bridge session bound — and nothing else. In particular it does not reach
 * `src/study/runtimeFacade.ts`, whose closure is the single measured cause of
 * the container being production-unsafe, and ./productionContainerImportClosure.test.ts
 * proves that transitively rather than by reading this list.
 */

/**
 * STUDY-A1-PROD-TUTOR-WRAPPER Phase 14 — every Tutor-facing reference through
 * a canonical parser, and no manual assertion anywhere.
 *
 * `sessionRef` is bounded by `studyBridgeSessionRef` first, exactly as the
 * preview seam bounds it: the durable host reference can exceed the bridge's
 * 128-character opaque-id rule, and a refusal there arrives as
 * `stop-invalid-input` — a durable safety stop about a child who did nothing.
 * The durable reference itself is untouched and stays whole everywhere else.
 *
 * A reference the contract will not admit throws, which rejects the launch.
 * That is the fail-closed direction and it costs nothing durable: the witness
 * is never produced, so no durable preparation runs.
 *
 * `initialEntry` and not `entry`, deliberately: the Tutor's lesson reference is
 * the block this mount was opened on, and it stays that for the whole session
 * even as segments complete.
 */
function productionTutorLaunch(binding: StudySessionBinding) {
  const tutorSessionRef = parseStudyTutorRef(studyBridgeSessionRef(binding.sessionRef))
  const tutorLessonRef = parseStudyTutorRef(binding.initialEntry.lessonRef)
  if (!tutorSessionRef || !tutorLessonRef) {
    throw new Error('This Study Session has a reference the Tutor contract does not admit.')
  }
  return {
    sessionRef: tutorSessionRef,
    lessonRef: tutorLessonRef,
    householdTimeZone: binding.context.householdTimeZone,
    learnerLocalDate: binding.context.learnerLocalDate,
  }
}

/**
 * STUDY-A1-F4-PARSE-BEFORE-HOST — the host's own acceptance of a Tutor result.
 *
 * The parameter is `unknown`, and that is the whole of that card. It used to be
 * the branded validated-result type that `StudyTutorRuntime.submit` returns —
 * so this function trusted a COMPILE-TIME fact about a value produced by
 * out-of-process work the host does not own. A single explicit `as` to that
 * branded type forges it, from a wrapper's raw transport output or straight
 * from `unknown`, and no host can make that expression impossible.
 * `wrapperObligations.ts` records the residual honestly and F4 stays OPEN for
 * exactly that reason. What this function does is make it stop mattering here:
 * the brand is no longer load-bearing at the host, because the host does not
 * rely on it.
 *
 * The branded type is deliberately not NAMED anywhere in this file — not
 * imported, not annotated, not asserted — and a tripwire in
 * src/study/production/productionImportBoundary.test.ts keeps it that way. The
 * host's only dependency is `unknown` in, canonical parser, canonical value
 * out.
 *
 * `acceptStudyTutorResult` is the FIRST operation, before any branch and before
 * anything is read. Everything below reads the canonical value it rebuilt — a
 * frozen object whose every field was validated and copied — and never the
 * caller's object. So a hostile accessor is read once, by the parser, and the
 * value that was CHECKED is the value that travels. A result the contract
 * cannot vouch for arrives here as `quarantined`, which writes nothing durable,
 * locks nothing, invents no interruption, and says nothing about the learner.
 *
 * The production contract's `stopped` arm carries no learner-facing message,
 * and that absence is deliberate: the host owns the words a stopped child
 * reads. So the message comes from the host's own constant here rather than
 * from anything a Tutor said.
 *
 * STUDY-A1-PRODUCTION-SAFE-CONTAINER — this crossing moved here from the
 * container body, and it is still the only one. The production container has no
 * other way to obtain a `StudyHostTurnResult`, because the surface it renders
 * accepts results from the seam and from nowhere else.
 */
function acceptedTurnResult(raw: unknown): StudyHostTurnResult {
  const result = acceptStudyTutorResult(raw)
  if (result.status === 'accepted') {
    return { status: 'accepted', eventRef: result.eventRef, visibleText: result.visibleText }
  }
  if (result.status === 'stopped') {
    return {
      status: 'stopped',
      reasonCode: result.reasonCode,
      deliveryStatus: result.deliveryStatus,
      studentMessage: STUDY_LEARNER_STOP_MESSAGE,
    }
  }
  if (result.status === 'interrupted') return { status: 'interrupted', interruption: result.interruption }
  return { status: 'quarantined' }
}

/**
 * One production turn, built entirely from canonical parsers.
 *
 * Every reference goes through `parseStudyTutorRef` and the learner's words go
 * through `parseStudyTutorLearnerText`. Over-long learner input is REFUSED
 * here, not truncated: the bridge's pre-core gateway refuses text over 4,000
 * characters before its classifier runs and shapes that refusal as
 * `stop-invalid-input`, which the stopped branch would write to the durable
 * safety ledger — a girl told to find a trusted adult for pasting her long
 * division. Truncating instead would send the Tutor the stump of her sentence
 * and let it answer that.
 *
 * A refusal returns `quarantined`, which writes nothing durable, locks
 * nothing, and says nothing about her.
 */
async function productionTurnResult(
  tutor: StudyTutorRuntime,
  binding: StudySessionBinding,
  turn: StudyHostTurn,
): Promise<StudyHostTurnResult> {
  const launch = productionTutorLaunch(binding)
  const requestRef = parseStudyTutorRef(turn.requestRef)
  const segmentRef = parseStudyTutorRef(turn.segmentRef)
  const skillRef = parseStudyTutorRef(binding.context.skillRefs[0] ?? `${binding.entry.lessonRef}:completion`)
  const transientLearnerText = parseStudyTutorLearnerText(turn.transientLearnerText)
  if (!requestRef || !segmentRef || !skillRef || !transientLearnerText) return { status: 'quarantined' }
  return acceptedTurnResult(await tutor.submit({
    sessionRef: launch.sessionRef,
    requestRef,
    lessonRef: launch.lessonRef,
    segmentRef,
    subject: binding.context.subject,
    skillRef,
    taskType: binding.entry.segments.find((candidate) => candidate.segmentRef === turn.segmentRef)?.taskType
      ?? 'guided-practice',
    transientLearnerText,
    expectedAnswer: 'ready',
    occurredAt: turn.occurredAt,
    learnerLocalDate: binding.context.learnerLocalDate,
    householdTimeZone: binding.context.householdTimeZone,
  }))
}

/**
 * The seam a production host installs.
 *
 * `turn.isCurrentBinding` is deliberately not read. Host lifecycle staleness is
 * host authority and the surface already holds this call inside its own
 * lifecycle token — the Tutor contract has no field for it and must not grow
 * one. See `StudyTutorTurn` in src/study/contracts/tutor/runtime.ts.
 */
export function createProductionStudyTutorSeam(tutor: StudyTutorRuntime): StudySessionTutorSeam {
  return {
    launch: (binding) => tutor.launch(productionTutorLaunch(binding)),
    submit: (binding, turn) => productionTurnResult(tutor, binding, turn),
  }
}
