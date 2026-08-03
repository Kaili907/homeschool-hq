import type { LearningSegmentId, SubjectId } from "../prototype/src/content";
import type { PacingDecision } from "../prototype/src/sessionStore";

/**
 * UI-owned intent envelope. It deliberately stops short of importing or
 * mutating the authoritative study-engine orchestrator.
 */
export type StudyUxIntent =
  | {
      readonly type: "ui/check-in-submitted";
      readonly sessionRef: string;
      readonly subjectId: SubjectId;
      readonly at: string;
      readonly checkIn: string;
    }
  | {
      readonly type: "ui/segment-completed";
      readonly sessionRef: string;
      readonly subjectId: SubjectId;
      readonly at: string;
      readonly segment: LearningSegmentId;
      readonly completionKey: string;
    }
  | {
      readonly type: "ui/break-requested";
      readonly sessionRef: string;
      readonly at: string;
      readonly returnSegment: LearningSegmentId;
      readonly lifecycleBreak: boolean;
    }
  | {
      readonly type: "ui/break-returned";
      readonly sessionRef: string;
      readonly at: string;
      readonly returnSegment: LearningSegmentId;
      readonly lifecycleBreak: boolean;
    }
  | {
      readonly type: "ui/pacing-selected";
      readonly sessionRef: string;
      readonly at: string;
      readonly decision: PacingDecision;
    }
  | {
      readonly type: "ui/technical-interruption";
      readonly sessionRef: string;
      readonly at: string;
      readonly recoveryKey: string;
      readonly returnSegment: LearningSegmentId;
    }
  | {
      readonly type: "ui/work-saved";
      readonly sessionRef: string;
      readonly at: string;
      readonly returnSegment: LearningSegmentId;
    };

export type ProvisionalOrchestratorEvent =
  | { readonly type: "check_in_completed"; readonly at: string }
  | { readonly type: "prior_retrieval_completed"; readonly at: string }
  | { readonly type: "visual_teaching_completed"; readonly at: string }
  | { readonly type: "guided_practice_completed"; readonly at: string }
  | { readonly type: "independent_attempt_completed"; readonly at: string }
  | {
      readonly type: "pacing_disposition_recorded";
      readonly at: string;
      readonly disposition: PacingDecision;
    }
  | { readonly type: "break_resume_confirmed"; readonly at: string };

export interface AdapterDecision {
  readonly orchestratorEvent?: ProvisionalOrchestratorEvent;
  readonly reason:
    | "forward"
    | "ui-local"
    | "requires-core-directive"
    | "requires-review-scheduling";
}

/**
 * Pure mapping helper for the eventual integration layer. Confidence/self-check
 * never manufactures a core directive, and technical refresh events remain
 * observability records rather than learning transitions.
 */
export function mapStudyUxIntent(intent: StudyUxIntent): AdapterDecision {
  switch (intent.type) {
    case "ui/check-in-submitted":
      return {
        orchestratorEvent: { type: "check_in_completed", at: intent.at },
        reason: "forward",
      };
    case "ui/segment-completed":
      switch (intent.segment) {
        case "warm-up":
          return {
            orchestratorEvent: { type: "prior_retrieval_completed", at: intent.at },
            reason: "forward",
          };
        case "visual-lesson":
          return {
            orchestratorEvent: { type: "visual_teaching_completed", at: intent.at },
            reason: "forward",
          };
        case "guided-practice":
          return {
            orchestratorEvent: { type: "guided_practice_completed", at: intent.at },
            reason: "forward",
          };
        case "independent-attempt":
          return {
            orchestratorEvent: { type: "independent_attempt_completed", at: intent.at },
            reason: "forward",
          };
        case "self-check":
          return { reason: "requires-core-directive" };
        case "exit-ticket":
          return { reason: "requires-review-scheduling" };
      }
    case "ui/pacing-selected":
      return {
        orchestratorEvent: {
          type: "pacing_disposition_recorded",
          at: intent.at,
          disposition: intent.decision,
        },
        reason: "forward",
      };
    case "ui/break-returned":
      return intent.lifecycleBreak
        ? {
            orchestratorEvent: { type: "break_resume_confirmed", at: intent.at },
            reason: "forward",
          }
        : { reason: "ui-local" };
    case "ui/break-requested":
    case "ui/technical-interruption":
    case "ui/work-saved":
      return { reason: "ui-local" };
  }
}

export function stableCompletionKey(
  sessionRef: string,
  segment: LearningSegmentId,
): string {
  return `complete:${sessionRef}:${segment}`;
}
