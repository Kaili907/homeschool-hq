/**
 * STUDY-A1-TUTOR-CONTRACT — the production Tutor runtime boundary.
 *
 * This module states what the host requires of a Tutor and nothing else. It
 * chooses no implementation, imports none, and names none. The preview surface
 * currently drives `AcceptedRc1HostRuntime`, which is bound to the
 * local-release-candidate identity sentinel and to a `portable-non-production`
 * release mode, so it is structurally forbidden in production. A production
 * wrapper does not exist yet and is deliberately not started here:
 * PROD_TUTOR_WRAPPER_REMAINS_SEPARATE.
 *
 * Every member below was derived from what the mounted host actually reads, in
 * src/study/runtimeFacade.ts and src/components/study/StudySessionContainer.tsx.
 * The exclusions are as much a part of the contract as the inclusions and each
 * one is recorded against the line that justifies it, so a reviewer can check
 * the derivation rather than trust it.
 *
 * The rule the shapes below hold to:
 *
 *   Every field a host may write durably is a closed union or a bounded opaque
 *   reference. The one free-text field, `visibleText`, is transient
 *   presentation and is never persisted.
 *
 * That is what keeps a Tutor from smuggling a learner's words into Study
 * evidence through an identifier or a code.
 */
import type { StudyTutorRef } from './refs'
import type { CanonicalStudyTaskType, StudyRuntimeInterruption, StudySubject } from '../../types'

/** Mirrors the `study-production.v1` convention in ../production/ports.ts. */
export const STUDY_TUTOR_CONTRACT_VERSION = 'study-tutor.v1' as const

/**
 * Opening a Tutor session for one Study block.
 *
 * The host discards whatever the preview's `launch` returns
 * (StudySessionContainer.tsx:174 calls it for effect only, and the bridge's
 * `StudentSessionLaunch` echoes back nothing the host did not supply), so this
 * resolves to nothing. A failure is a rejection, which the host surfaces as
 * "this Study Session could not start safely" — the single outcome the mounted
 * host has for every launch failure today (StudySessionContainer.tsx:211).
 *
 * Not carried, and deliberately:
 *  - the calendar block reference. `launchStudentSession` only echoes it, and
 *    no later Tutor call takes it. Host scheduling identity stays on the host.
 *  - subject, skills and accessibility. None reaches the bridge at launch.
 */
export interface StudyTutorLaunch {
  /**
   * The learner's opaque Study session reference, and the ONLY identity a
   * Tutor is given. There is no household reference, no learner reference, no
   * host profile reference, no student record id, no session grant and no
   * bearer anywhere in this contract: the host's `hostProfileRef` goes to the
   * host's own safety port (runtimeFacade.ts:263) and never to a Tutor.
   *
   * Bounded by the already-approved host boundary — `isStudyBridgeOpaqueId` in
   * src/study/studyRequestRef.ts, at most 128 characters — so a long reference
   * cannot come back as a refusal the host records as a safety incident.
   *
   * That bound is structural, not documentary: `StudyTutorRef` is producible
   * only by `parseStudyTutorRef`. See ./refs.ts for the per-field derivation of
   * which references are bridge-facing and what each one's refusal costs.
   */
  readonly sessionRef: StudyTutorRef
  readonly lessonRef: StudyTutorRef
  /** IANA zone; the Tutor's day boundary, not a location claim. */
  readonly householdTimeZone: string
  /** ISO calendar date in the household's zone. */
  readonly learnerLocalDate: string
}

/**
 * One learner turn.
 *
 * Instruction only. Everything here is either an opaque reference the host
 * already approved, a closed domain value, or the learner's transient words.
 * There is no authority in it to carry: no permission level, no service role,
 * no grant, no bearer, no household or student record id — see
 * STUDY_TUTOR_FORBIDDEN_KEYS.
 *
 * Not carried, and deliberately:
 *  - the host's `StudyScope`. It would hand a Tutor the household and learner
 *    references it has no use for; `sessionRef` alone correlates the turn.
 *  - the whole `StudyCalendarEntry`. It would drag block, schedule, completion
 *    and resume state across the boundary. The four fields the bridge actually
 *    reads out of it (runtimeFacade.ts:344-351) are named individually.
 *  - `isCurrentBinding`. Host lifecycle staleness is host authority; the
 *    mounted host already wraps this call in its own lifecycle token
 *    (StudySessionContainer.tsx:288).
 */
export interface StudyTutorTurn {
  /** See StudyTutorLaunch.sessionRef. Same bound, same opacity. */
  readonly sessionRef: StudyTutorRef
  /**
   * Per-turn idempotency reference. Bounded like `sessionRef`, and for the same
   * reason: it reaches the bridge's pre-core gateway as `eventId`, where an
   * over-long value is refused as `stop-invalid-input` before the classifier
   * runs — a durable safety stop about a child who did nothing.
   */
  readonly requestRef: StudyTutorRef
  readonly lessonRef: StudyTutorRef
  readonly segmentRef: StudyTutorRef
  /**
   * Host vocabulary, not Tutor vocabulary. An implementation that cannot teach
   * a subject or a task type returns `quarantined` rather than guessing — which
   * is what the preview's `subjectForBridge`/`taskForBridge` throws already
   * become (runtimeFacade.ts:380).
   */
  readonly subject: StudySubject
  /** One skill. The host chooses which; the preview takes `skillRefs[0]`. */
  readonly skillRef: StudyTutorRef
  readonly taskType: CanonicalStudyTaskType
  /**
   * The learner's words, for this call only. Transient input, never
   * persistence: no Study record, checkpoint, event payload or adult-review
   * proposal may contain it, and nothing in StudyTutorResult can carry it back.
   */
  readonly transientLearnerText: string
  readonly expectedAnswer: string
  readonly occurredAt: string
  readonly learnerLocalDate: string
  readonly householdTimeZone: string
}

/** The two states a host may record for a proposed adult hand-off. */
export type StudyTutorAdultHelpDelivery = 'proposed-not-delivered' | 'not-confirmed'

/**
 * Closed. Four branches, each with a distinct meaning that the host must not
 * be able to confuse for another:
 *
 *  accepted    — the turn was evaluated and there is something to show.
 *  stopped     — the learner safety boundary fired.
 *  interrupted — the turn could not be evaluated, and the reason was not the
 *                learner.
 *  quarantined — the Tutor's own output could not be vouched for. Technical and
 *                structural; never a statement about a child.
 *
 * There is no fifth catch-all. An implementation with nothing to say returns
 * `quarantined`, which the host already fails closed on.
 *
 * A `stopped` result does not clear, soften or override the host safety
 * boundary; it can only add to it. The host's own pre-Tutor safety check, its
 * durable stop ledger and its locked surface are all upstream of and
 * independent of anything here, and no branch of this union can reach them.
 */
export type StudyTutorResult =
  | {
      readonly status: 'accepted'
      /**
       * Opaque, and the only value from a Tutor the host persists
       * (`lastAcceptedEventRef`, StudySessionContainer.tsx:390). Bounded to the
       * approved opaque-reference syntax by `parseStudyTutorResult`, so a
       * learner's sentence cannot be returned in its place and written to
       * durable Study state.
       */
      readonly eventRef: string
      /**
       * Learner-facing prose for this turn. Transient presentation: shown, and
       * held in the surface's own state for as long as the mount lasts. Nothing
       * durable takes it, and there is no transcript field in this contract for
       * it to accumulate in.
       */
      readonly visibleText: string
    }
  | {
      readonly status: 'stopped'
      /**
       * Operator vocabulary. The host writes it to the durable safety-stop
       * event (StudySessionContainer.tsx:352), which is exactly why
       * `parseStudyTutorResult` restricts it to a short lower-case code: prose,
       * and therefore a learner's words, cannot travel in it.
       */
      readonly reasonCode: string
      /**
       * Whether a server actually answered. The host distinguishes
       * `server-answered-stop` from `server-acceptance-not-confirmed` on it
       * (StudySessionContainer.tsx:339).
       */
      readonly deliveryStatus: StudyTutorAdultHelpDelivery
      /**
       * There is deliberately no learner-facing message here. The host owns the
       * words a stopped child reads — its locked surface renders
       * STUDY_LEARNER_STOP_MESSAGE (StudySessionContainer.tsx:417) — and a
       * Tutor authoring safety copy would be the boundary inverted.
       */
    }
  | {
      readonly status: 'interrupted'
      /**
       * The host's existing closed set of non-learner failures. A refused adult
       * bearer, a refused Study session and a shed request fail closed exactly
       * like a stop but are none of one: nothing about this child may be
       * recorded, locked, or shown to her parent as an incident.
       */
      readonly interruption: StudyRuntimeInterruption
    }
  | {
      readonly status: 'quarantined'
      /**
       * Operator-facing only, never shown to a learner, and restricted to the
       * same short lower-case code shape as a stop's. This is the one field in
       * the union the mounted preview host does not read today — it throws on
       * quarantine (StudySessionContainer.tsx:361) — and it is kept because a
       * structural refusal with no code is undiagnosable in production.
       */
      readonly reasonCode: string
    }

/**
 * The production Tutor boundary.
 *
 * An implementation is instructional and advisory. It cannot change a learner's
 * official grade or working level, the curriculum, any permission, any parent
 * control, or any safety clearance, because this contract gives it no way to
 * say so: there is no field for it in either direction, and
 * `parseStudyTutorResult` rejects any result carrying an unexpected key.
 *
 * A rejection from either method is treated by the host as a failed turn.
 * Implementations should prefer returning `quarantined` to throwing, so the
 * host can tell a structural refusal from a crash.
 */
export interface StudyTutorRuntime {
  /** Pinned so a host can refuse a mismatched wrapper once, at installation. */
  readonly contractVersion: typeof STUDY_TUTOR_CONTRACT_VERSION
  /**
   * Asynchronous, and therefore awaitable — which is an obligation on the host,
   * not a detail of the return type.
   *
   * A host that does not await this has started nothing it can rely on. Until
   * the promise settles the Tutor session may not exist and may still fail, so
   * calendar start, the session-launched event and session persistence must all
   * wait for it: STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT in ./wrapperObligations.ts.
   * Otherwise a rejected launch leaves a durable record of a Study session a
   * learner never got.
   *
   * WRAPPER_LANDING_REQUIREMENT, open. The mounted preview host calls the
   * preview runtime's synchronous launch for effect and is out of scope here.
   */
  launch(launch: StudyTutorLaunch): Promise<void>
  /**
   * The returned value must have been through `parseStudyTutorResult` — or
   * `acceptStudyTutorResult`, which is the same check with the fail-closed
   * branch already taken. An implementation's raw transport output is `unknown`
   * until then, and typing it as `StudyTutorResult` beforehand skips this
   * boundary while appearing to honour it:
   * STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT in ./wrapperObligations.ts.
   */
  submit(turn: StudyTutorTurn): Promise<StudyTutorResult>
}

/**
 * Keys no Tutor input or result may carry, in either direction.
 *
 * Authority (Phase 5): a Tutor advises. It does not set a grade, a level, a
 * curriculum, a permission, a parent control or a safety clearance.
 *
 * Credentials and record identity (Phase 3): a Tutor is given one opaque
 * session reference. Not a bearer, not a role, not a household or student
 * record id, not a grant.
 *
 * Persistence and privacy (Phase 6): no transcript, no audio, no emotional or
 * personality label, no diagnosis, no adult-private note, no raw answer.
 *
 * Enforced structurally rather than by list: the declared shapes above contain
 * none of these, and `parseStudyTutorResult` admits an exact key set per
 * branch, so any of them arriving on a result is rejected. The list is the
 * statement of intent the tests hold the shapes to.
 */
export const STUDY_TUTOR_FORBIDDEN_KEYS = Object.freeze([
  'accessToken',
  'apiKey',
  'audio',
  'audioUrl',
  'authorization',
  'bearer',
  'clearance',
  'curriculum',
  'curriculumRef',
  'diagnosis',
  'emotion',
  'emotionalState',
  'grade',
  'gradeLevel',
  'grantId',
  'householdId',
  'learnerSessionId',
  'masteryDecision',
  'officialGrade',
  'parentControls',
  'permission',
  'permissionLevel',
  'permissions',
  'personality',
  'privateNote',
  'promote',
  'rawAnswer',
  'role',
  'safetyClearance',
  'serviceRole',
  'studentId',
  'studentSessionGrantId',
  'transcript',
  'transcriptIncluded',
  'workingLevel',
] as const)
