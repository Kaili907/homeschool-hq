import { SESSION_DEFINITIONS, type LearningSegmentId } from "@study-content";
import {
  completeCheckIn,
  completeCurrentSegment,
  createRuntimeWorkspace,
  setReflectionValue,
  setResponseDraft,
  submitCurrentResponse,
} from "@runtime/state/runtimeMachine";
import type {
  RuntimeSubjectId,
  RuntimeWorkspaceV1,
} from "@runtime/runtimeTypes";

export const TRACE_BASE = Date.parse("2026-07-28T14:00:00.000Z");

export function traceAt(step: number): string {
  return new Date(TRACE_BASE + step * 1_000).toISOString();
}

export function beginLearning(
  subjectId: RuntimeSubjectId,
  checkIn = "ready",
): RuntimeWorkspaceV1 {
  return completeCheckIn(
    createRuntimeWorkspace(subjectId, traceAt(0)),
    checkIn,
    traceAt(1),
  );
}

export function acceptedResponse(
  subjectId: RuntimeSubjectId,
  segment: Exclude<LearningSegmentId, "self-check">,
): string {
  const definition = SESSION_DEFINITIONS[subjectId].segments[segment];
  if (definition.expectedAnswer) return definition.expectedAnswer;
  return "I used the nearby action as evidence for the likely meaning.";
}

export async function answerAndAdvance(
  workspace: RuntimeWorkspaceV1,
  response: string,
  step: number,
): Promise<RuntimeWorkspaceV1> {
  const segment = workspace.currentSegment;
  let next = setResponseDraft(workspace, segment, response, traceAt(step));
  next = await submitCurrentResponse(next, traceAt(step + 1));
  if (next.feedback[segment] !== "ready") {
    throw new Error(`Expected an accepted response for ${segment}.`);
  }
  return completeCurrentSegment(next, traceAt(step + 2));
}

export async function reflectAndAdvance(
  workspace: RuntimeWorkspaceV1,
  reflection: {
    readonly confidence: "not-yet" | "getting-there" | "ready";
    readonly effort: "light" | "steady" | "a-lot";
    readonly frustration: "calm" | "some" | "high";
  },
  step: number,
): Promise<RuntimeWorkspaceV1> {
  let next = setReflectionValue(
    workspace,
    "confidence",
    reflection.confidence,
    traceAt(step),
  );
  next = setReflectionValue(
    next,
    "effort",
    reflection.effort,
    traceAt(step + 1),
  );
  next = setReflectionValue(
    next,
    "frustration",
    reflection.frustration,
    traceAt(step + 2),
  );
  next = await submitCurrentResponse(next, traceAt(step + 3));
  if (next.feedback["self-check"] !== "ready") {
    throw new Error("Expected the reflection check to be accepted.");
  }
  return completeCurrentSegment(next, traceAt(step + 4));
}
