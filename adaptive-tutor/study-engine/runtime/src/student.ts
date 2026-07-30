import { assertHouseholdTimeZone } from "./calendar.ts";
import type { AcceptedEventLedgerPort } from "./ledger.ts";
import {
  runSafeTutorBridge,
  type SafeTutorBridgeDependencies,
  type SafeTutorBridgeRequest,
  type SafeTutorBridgeResult,
} from "./tutor-bridge.ts";

export interface StudentSessionLaunch {
  readonly sessionId: string;
  readonly lessonId: string;
  readonly calendarBlockId: string;
  readonly householdTimeZone: string;
  readonly learnerLocalDate: string;
  readonly status: "check-in";
}

export function launchStudentSession(
  input: Omit<StudentSessionLaunch, "status">,
): StudentSessionLaunch {
  assertHouseholdTimeZone(input.householdTimeZone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.learnerLocalDate)) {
    throw new Error("learnerLocalDate must be an ISO calendar date.");
  }
  return {
    ...input,
    status: "check-in",
  };
}

export async function submitStudentTurn(
  request: SafeTutorBridgeRequest,
  eventLedger: AcceptedEventLedgerPort,
  options: Omit<SafeTutorBridgeDependencies, "eventLedger">,
): Promise<SafeTutorBridgeResult> {
  assertHouseholdTimeZone(request.householdTimeZone);
  return runSafeTutorBridge(request, {
    ...options,
    eventLedger,
  });
}

export type {
  SafeTutorBridgeRequest,
  SafeTutorBridgeResult,
} from "./tutor-bridge.ts";
