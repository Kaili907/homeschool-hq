/**
 * Provisional, framework-independent session orchestration types.
 *
 * The tutor core remains authoritative for instructional decisions. The study
 * engine records a core-provided directive but never derives mastery or a
 * misconception from learner activity.
 */

export const SESSION_PHASES = [
  "check_in",
  "retrieve_prior_knowledge",
  "teach_visually",
  "guided_practice",
  "independent_attempt",
  "confidence_check",
  "correct_or_reteach",
  "schedule_future_review",
  "break_continue_or_finish",
  "on_break",
  "finished",
] as const;

export type SessionPhase = (typeof SESSION_PHASES)[number];

export type CoreInstructionDirective = "correct" | "reteach";

export type PacingDisposition = "break" | "continue" | "finish";

export type SessionEvent =
  | { readonly type: "check_in_completed"; readonly at: string }
  | { readonly type: "prior_retrieval_completed"; readonly at: string }
  | { readonly type: "visual_teaching_completed"; readonly at: string }
  | { readonly type: "guided_practice_completed"; readonly at: string }
  | { readonly type: "independent_attempt_completed"; readonly at: string }
  | {
      readonly type: "confidence_check_completed";
      readonly at: string;
      /**
       * This value must be supplied by the authoritative tutor core. It is not
       * inferred by this package.
       */
      readonly coreDirective: CoreInstructionDirective;
    }
  | { readonly type: "core_instruction_completed"; readonly at: string }
  | {
      readonly type: "review_scheduled";
      readonly at: string;
      readonly reviewDate: string;
    }
  | {
      readonly type: "pacing_disposition_recorded";
      readonly at: string;
      readonly disposition: PacingDisposition;
    }
  | { readonly type: "break_resume_confirmed"; readonly at: string };

export interface SessionTransition {
  readonly at: string;
  readonly event: SessionEvent["type"];
  readonly from: SessionPhase;
  readonly to: SessionPhase;
}

export interface StudySessionState {
  readonly schemaVersion: "provisional-study-session.v1";
  /**
   * An opaque, pseudonymous reference. Names, emails, transcripts, and other
   * direct identifiers are intentionally not part of this state.
   */
  readonly sessionRef: string;
  readonly phase: SessionPhase;
  readonly status: "active" | "on_break" | "finished";
  readonly cycleNumber: number;
  readonly startedAt: string;
  readonly lastEventAt: string;
  readonly coreDirective?: CoreInstructionDirective;
  readonly scheduledReviewDate?: string;
  readonly lastDisposition?: PacingDisposition;
  readonly history: readonly SessionTransition[];
}

export interface CreateStudySessionInput {
  readonly sessionRef: string;
  readonly startedAt: string;
}

export type SessionTransitionErrorCode =
  | "invalid_session_ref"
  | "invalid_timestamp"
  | "event_before_session"
  | "invalid_review_date"
  | "invalid_core_directive"
  | "invalid_disposition"
  | "invalid_state"
  | "invalid_transition"
  | "session_finished";

export class SessionTransitionError extends Error {
  public readonly name = "SessionTransitionError";

  public constructor(
    public readonly code: SessionTransitionErrorCode,
    message: string,
  ) {
    super(message);
  }
}
