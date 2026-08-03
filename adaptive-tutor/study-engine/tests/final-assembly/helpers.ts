import type { SafeTutorBridgeRequest } from "../../runtime/src/tutor-bridge.ts";
import { LOCAL_DEMO_SAFETY_CONFIGURATION } from "../../runtime/src/safety.ts";

export const localDemoSafety = LOCAL_DEMO_SAFETY_CONFIGURATION;

export function bridgeRequest(
  overrides: Partial<SafeTutorBridgeRequest> = {},
): SafeTutorBridgeRequest {
  return {
    requestId: "event:final-assembly:001",
    sessionId: "session:final-assembly:001",
    lessonId: "lesson:fractions:001",
    segmentId: "segment:guided:001",
    subject: "math",
    skillId: "skill:equivalent-fractions",
    transientLearnerText: "3/4",
    expectedAnswer: "3/4",
    occurredAt: "2026-07-30T09:15:00-04:00",
    learnerLocalDate: "2026-07-30",
    householdTimeZone: "America/New_York",
    taskType: "guided-practice",
    ...overrides,
  };
}
