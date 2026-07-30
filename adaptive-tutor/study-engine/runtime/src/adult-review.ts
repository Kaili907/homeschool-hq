import type { PreCoreUrgentSafetyResult } from "../../bridges/tutor-core/src/safety-gateway.ts";

type StoppedSafetyResult = Extract<
  PreCoreUrgentSafetyResult,
  {
    readonly status:
      | "stop-for-urgent-adult-review"
      | "stop-for-uncertain-adult-review";
  }
>;

export interface AdultReviewProposal {
  readonly status: "proposed-not-delivered";
  readonly hook: StoppedSafetyResult["adultHook"];
}

export function adultReviewProposalFromSafety(
  result: PreCoreUrgentSafetyResult,
): AdultReviewProposal | null {
  if (
    result.status !== "stop-for-urgent-adult-review" &&
    result.status !== "stop-for-uncertain-adult-review"
  ) {
    return null;
  }
  return {
    status: "proposed-not-delivered",
    hook: result.adultHook,
  };
}
