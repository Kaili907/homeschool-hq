/**
 * STUDY-A1-TUTOR-CONTENT-ELIGIBILITY-CONTRACT — the decision, made against the
 * frozen content.
 *
 * ../contracts/tutor/eligibility.ts states the question and the admissible
 * answers and can see no content. This module can, and it is the only place the
 * answer is computed.
 *
 * THE FALLBACK, AND WHY IT IS NOT CHANGED WHERE IT LIVES.
 *
 * `selectTutorProgram` ends `matched ?? registration.programs[0]`. That is a
 * defect on the production path and a load-bearing assumption on the preview
 * one: the mounted preview host sends Study-namespace ids like
 * `skill:equivalent-fractions`, which the frozen content deliberately does not
 * declare (subject-registry.ts:22-27 says so and calls the mapping a curriculum
 * decision), and the preview works today precisely because those resolve to the
 * subject default. Making `selectTutorProgram` fail closed would take the
 * preview surface dark, and it would do it by changing the semantics of a
 * function in the frozen tree that another test suite already pins
 * (adaptive-tutor/study-engine/tests/final-assembly/subject-registry.test.ts
 * asserts the fallback by name).
 *
 * So legacy keeps the fallback and production gets `selectEligibleTutorProgram`
 * below, whose entire difference is `?? null` where the other has
 * `?? registration.programs[0]`. The difference is not left to be inferred:
 * ./tutorContentEligibility.test.ts drives BOTH functions over the same
 * unmatched input in one test and asserts that one returns the place-value
 * program and the other returns nothing.
 *
 * NO LEARNER GRADE, NO WORKING LEVEL. Every input is content metadata and every
 * check reads content. `reviewedV1GradeBand` reads `program.gradeBand` — the
 * band the CONTENT declares — and the request has no grade field for a caller
 * to supply one, which ../contracts/tutor/eligibility.ts pins structurally and
 * ./tutorAdapter.test.ts pins at the adapter's own request shape.
 */
import {
  mapStudyTaskToTutorPhase,
  type StudyGradeBand,
  type StudyTaskType,
} from '../../../adaptive-tutor/study-engine/bridges/tutor-core/src/index.ts'
import type { TutorProgram } from '../../../adaptive-tutor/core/index.ts'
import {
  resolveTutorSubjectRegistration,
  type TutorBridgeSubject,
  type TutorProgramRegistration,
  type TutorSubjectRegistration,
} from '../../../adaptive-tutor/study-engine/runtime/src/subject-registry.ts'
import {
  STUDY_TUTOR_INELIGIBLE_REASONS,
  type StudyTutorContentGradeBand,
  type StudyTutorEligibility,
  type StudyTutorEligibilityRequest,
} from '../contracts/tutor/eligibility'
import type { CanonicalStudyTaskType, StudySubject } from '../types'

/** Compiles only when its argument is `never`; the drift alarm. */
type Exhaustive<T extends never> = T

/*
 * The two aliases below are never referenced, and that is what they are for.
 * ../contracts/tutor/eligibility.ts restates the grade-band union rather than
 * importing it, so that its measured content-free import closure stays that
 * way. This module may see both, so the drift alarm lives here: a member added
 * to or removed from either side fails the typecheck.
 */
/** A band the Tutor Core bridge declares and the contract omits. */
type _EveryGradeBandCarried = Exhaustive<Exclude<StudyGradeBand, StudyTutorContentGradeBand>>
/** A band the contract invents and the bridge does not declare. */
type _NoGradeBandInvented = Exhaustive<Exclude<StudyTutorContentGradeBand, StudyGradeBand>>

/*
 * The host's task-type union and the bridge's are the same fourteen members
 * today. These assert it, so `mapStudyTaskToTutorPhase` can be handed a host
 * task type directly rather than through a cast that would silently keep
 * compiling after the two unions diverged.
 */
/** A task type the host declares and the bridge does not. */
type _EveryHostTaskTypeBridged = Exhaustive<Exclude<CanonicalStudyTaskType, StudyTaskType>>
/** A task type the bridge declares and the host does not. */
type _NoBridgeTaskTypeUnmapped = Exhaustive<Exclude<StudyTaskType, CanonicalStudyTaskType>>

/**
 * D1 — the grade band this wrapper sends, and the whole of what it means.
 *
 * `StudyContextV1.gradeBand` is a closed three-member union the bridge
 * validates for membership and folds into the accepted event's digest. For the
 * currently reviewed frozen Tutor content it is otherwise semantically inert:
 * nothing in `orchestrateStudyCoreBridge`, the Core engine, the projection or
 * the recommendation branches on it, and no program is selected by it — program
 * selection is by subject and routing id.
 *
 * It is therefore a CONTENT-COMPATIBILITY CONSTANT owned by this wrapper. It is
 * derived from what the reviewed frozen content declares, and it is not derived
 * from and does not describe any learner:
 *
 *  - it is NOT the learner's nominal grade,
 *  - it is NOT her working level,
 *  - it is NOT a browser-supplied or student-supplied grade,
 *  - it carries NO authority: it cannot place, promote, or hold back a child,
 *    and `STUDY_TUTOR_FORBIDDEN_KEYS` keeps every one of those vocabularies out
 *    of the contract in both directions.
 *
 * The reason no `gradeBand` field was added to `StudyTutorLaunch` or
 * `StudyTutorTurn` is exactly that. A field would be a channel, and the only
 * values a host could put in it are the learner's real grade or her working
 * level — the two things a Tutor must not be told.
 *
 * THE LIMIT OF THIS CONSTANT. It is compatible with the content reviewed as of
 * this card, and with nothing else. It says nothing about Grade 7 or Grade 8
 * material, and a later card that registers such a program MUST reopen this
 * constant rather than let it ride: `middle-6-8` content sent as `elementary-3-5`
 * would be a false statement about what a child is being taught, recorded in a
 * durable event digest. `reviewedV1GradeBand` below is what stops that
 * happening silently.
 */
export const STUDY_TUTOR_V1_GRADE_BAND: StudyGradeBand = 'elementary-3-5'

/**
 * The envelope the constant above was chosen against, read off the frozen
 * content rather than assumed.
 *
 * The frozen Math R1 manifest declares grades 4–6 and the English program
 * declares 4–6 with items from 3. Those are the two registrations
 * `resolveTutorSubjectRegistration` can return today, and `elementary-3-5` is
 * the legal union member that covers them.
 *
 * A program declaring anything outside this window is content this wrapper was
 * not reviewed for, and it fails closed rather than being relabelled.
 */
export const STUDY_TUTOR_V1_REVIEWED_GRADE_ENVELOPE = Object.freeze({
  minimumGrade: 3,
  maximumGrade: 6,
})

/**
 * D1's fail-closed half. Returns the compatibility constant only for content
 * inside the reviewed envelope, and `null` for anything else.
 *
 * `null` is not an error and not a stop: it is "this wrapper has not been
 * reviewed for this content", which is a statement about the CARD, not about
 * the child sitting in front of it.
 */
export function reviewedV1GradeBand(program: TutorProgram): StudyGradeBand | null {
  const band = program.gradeBand
  if (
    !Number.isSafeInteger(band.min) ||
    !Number.isSafeInteger(band.max) ||
    band.min < STUDY_TUTOR_V1_REVIEWED_GRADE_ENVELOPE.minimumGrade ||
    band.max > STUDY_TUTOR_V1_REVIEWED_GRADE_ENVELOPE.maximumGrade
  ) return null
  return STUDY_TUTOR_V1_GRADE_BAND
}

/**
 * The host's subject vocabulary, mapped to the two reviewed Tutor subjects.
 *
 * Restated from the preview facade's module-private `subjectForBridge`
 * (runtimeFacade.ts:102) deliberately, and with one difference that matters:
 * that one THROWS for `other`, and this returns `null`. Eligibility must be
 * total — it is destined for a server surface where a throw becomes a fault
 * rather than a refusal, and "the Tutor cannot teach this" is an ordinary
 * answer, not an error.
 *
 * `other` is where `parent-created` and `romeo-virtual-academy` blocks land
 * (HOST_STUDY_MAPPING in ../curriculumAdapter.ts), and those are exactly the
 * blocks a Tutor must not teach: their mastery authority is `completion-only`.
 */
export function reviewedTutorSubject(subject: StudySubject): TutorBridgeSubject | null {
  if (subject === 'math') return 'math'
  if (subject === 'reading' || subject === 'writing') return 'english'
  return null
}

/**
 * Whether the Tutor bridge has a teaching phase for this task type.
 *
 * DERIVED, not listed. `TASK_PHASES` in the bridge's mappings.ts is a PARTIAL
 * record: seven of the fourteen study task types map to a phase and the rest
 * come back `{ status: 'unsupported', reasonCode: 'study-only-task' }`. Asking
 * the bridge means this cannot drift from it — a task type that gains or loses
 * a phase changes this answer with no edit here.
 *
 * The seven unsupported ones are not an oversight: `reading`, `writing`,
 * `discussion`, `problem-solving`, `project-work`, `reflection` and `custom` are
 * study work the host owns, and a `custom` segment is a parent-created or Romeo
 * activity whose mastery authority is `completion-only`.
 *
 * STRICTER THAN THE PER-TURN MAPPING, deliberately, and the difference is
 * pinned by ./tutorContentEligibility.test.ts rather than left to be noticed.
 * `bridgeTaskType` in ./tutorRuntime.ts admits three more — it casts `reading`
 * and `writing` to `guided-practice` and passes `reflection` through — because
 * it is answering a different question: given that this block is already
 * running, what phase does this segment become? A pre-launch check is asked
 * whether the block should run at all, and the honest authority for that is the
 * bridge's own map, not a per-turn cast. Where the two disagree this one
 * refuses, which is the safe direction and costs nothing while the route is
 * dark.
 */
export function tutorTeachableTaskType(taskType: CanonicalStudyTaskType): boolean {
  return mapStudyTaskToTutorPhase(taskType).status === 'mapped'
}

/**
 * The production program selector, and the whole of this card's correctness fix.
 *
 * Identical to `selectTutorProgram` except for the last word: no match is
 * `null`, never `registration.programs[0]`. Returns the REGISTRATION rather
 * than the program so a caller keeps the routing ids that justified the match
 * and cannot silently re-derive them.
 *
 * Deliberately no id transformation, exactly like the legacy selector: matching
 * is exact. A selector that normalised, prefixed or fuzzy-matched would be
 * inventing the curriculum mapping that subject-registry.ts says is a curriculum
 * decision, and inventing it in the place least able to review it.
 */
export function selectEligibleTutorProgram(
  registration: TutorSubjectRegistration,
  ...requestIds: readonly string[]
): TutorProgramRegistration | null {
  return registration.programs.find((entry) =>
    requestIds.some((id) => entry.routingIds.has(id))) ?? null
}

function ineligible(
  reason: Extract<StudyTutorEligibility, { eligible: false }>['reason'],
): StudyTutorEligibility {
  return Object.freeze({ eligible: false as const, reason })
}

/**
 * The two content checks, over a registration the caller supplies.
 *
 * Separated from the resolution below so both branches are FORCIBLE. Every
 * program the frozen registry can return today declares a band inside the
 * reviewed envelope — which is what makes the envelope correct — so a band
 * refusal cannot be driven through a function that fetches its own
 * registration, and a check nothing can exercise is a check a mutation removes
 * for free. A caller here can hand in a registration whose program declares
 * Grade 7, which is the content the card names.
 *
 * The order is the whole point:
 *
 *  1. LESSON. Some registered program must declare one of the requested routing
 *     ids. This is the check that did not exist: the `programs[0]` fallback
 *     answered it YES unconditionally.
 *  2. GRADE BAND. The MATCHED program's declared band must lie inside the
 *     reviewed envelope. After the match, deliberately — run before it, it
 *     would be reading the band of whichever program the fallback happened to
 *     return, which is exactly how a wrongly-selected but in-band program
 *     sailed through at this card's base.
 */
export function reviewedContentDecision(
  registration: TutorSubjectRegistration,
  routingIds: readonly string[],
): StudyTutorEligibility {
  const matched = selectEligibleTutorProgram(registration, ...routingIds)
  if (matched === null) return ineligible(STUDY_TUTOR_INELIGIBLE_REASONS.unmatchedLesson)

  const gradeBand = reviewedV1GradeBand(matched.program)
  if (gradeBand === null) return ineligible(STUDY_TUTOR_INELIGIBLE_REASONS.unreviewedGradeBand)

  return Object.freeze({ eligible: true as const, programRef: matched.program.id, gradeBand })
}

/**
 * The content half: everything that needs a resolved Tutor subject.
 *
 * Split from the pre-launch check below because the two callers arrive with
 * different vocabularies and neither should have to fake the other's. The
 * pre-launch check starts from host vocabulary and maps it; ./tutorAdapter.ts is
 * downstream of `bridgeSubject` and `bridgeTaskType` in ./tutorRuntime.ts and
 * already holds a resolved Tutor subject, so asking it to reconstruct a host
 * subject would mean guessing whether an `english` turn came from a reading
 * block or a writing one — inventing an input in order to check it.
 *
 * Total. A registry that refuses — a subject with no registration, or frozen
 * content that failed its own schema validation at registration — is
 * `unvouchedDecision` rather than a throw, because "no trustworthy yes" is the
 * honest answer to give a host that is about to start durable work.
 */
export function evaluateReviewedTutorContent(
  subject: TutorBridgeSubject,
  routingIds: readonly string[],
): StudyTutorEligibility {
  let registration: TutorSubjectRegistration
  try {
    registration = resolveTutorSubjectRegistration(subject)
  } catch {
    return ineligible(STUDY_TUTOR_INELIGIBLE_REASONS.unvouchedDecision)
  }
  return reviewedContentDecision(registration, routingIds)
}

/**
 * The pre-launch check, from host vocabulary, and the shape a future server
 * eligibility endpoint answers.
 *
 * Four checks, cheapest question first, and the frozen registry is never
 * touched for content already refused. Each corresponds to a mutation this
 * card's campaign restores, so none of them is decoration:
 *
 *  1. SUBJECT. `other` has no reviewed registration at all — that is where
 *     `parent-created` and `romeo-virtual-academy` blocks land.
 *  2. TASK TYPE. EVERY task type the block's segments declare must map to a
 *     Tutor teaching phase. Every one: a block whose mastery-check is teachable
 *     but whose other segment is a completion-only custom activity is not a
 *     block this Tutor can run, and `.every` rather than `.some` is what says so.
 *  3. LESSON and 4. GRADE BAND, via `evaluateReviewedTutorContent` above.
 *
 * The lesson reference goes in FIRST. It is the block's own identity and the
 * primary routing reference; the skill references follow in declaration order,
 * matching what `selectTutorProgram` has always done with the pair it is given.
 */
export function evaluateStudyTutorContentEligibility(
  request: StudyTutorEligibilityRequest,
): StudyTutorEligibility {
  const subject = reviewedTutorSubject(request.subject)
  if (subject === null) return ineligible(STUDY_TUTOR_INELIGIBLE_REASONS.unsupportedSubject)

  if (!request.taskTypes.every(tutorTeachableTaskType)) {
    return ineligible(STUDY_TUTOR_INELIGIBLE_REASONS.unsupportedTaskType)
  }

  return evaluateReviewedTutorContent(subject, [request.lessonRef, ...request.skillRefs])
}
