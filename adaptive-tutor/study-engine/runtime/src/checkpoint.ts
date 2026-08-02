import {
  BRIDGE_CONTRACT_VERSION,
  validateRecoveryCheckpoint,
  type ResumeValidationContext,
  type SafeInstructionalCursorV1,
  type StudyRecoveryCheckpointV1,
} from "../../bridges/tutor-core/src/index.ts";

export interface CreateRecoveryCheckpointInput {
  readonly checkpointId: string;
  readonly revision: number;
  readonly timestamp: string;
  readonly sessionId: string;
  readonly lessonId: string;
  readonly segmentId: string;
  readonly safeInstructionalCursor: SafeInstructionalCursorV1;
  readonly completedSegmentIds: readonly string[];
  readonly perSegmentActiveTime: readonly {
    readonly segmentId: string;
    readonly activeSeconds: number;
  }[];
  readonly pausedSeconds: number;
  readonly breakSeconds: number;
  readonly protectedDraftRef: string | null;
  readonly protectedTutorStateRef: string;
  readonly lastAcceptedEventId: string | null;
  readonly tutorInteractionRef: string;
}

export function createRecoveryCheckpoint(
  input: CreateRecoveryCheckpointInput,
): StudyRecoveryCheckpointV1 {
  return Object.freeze({
    contract: "study-core-bridge.recovery-checkpoint.v1",
    contractVersion: BRIDGE_CONTRACT_VERSION,
    checkpointId: input.checkpointId,
    revision: input.revision,
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
    sessionId: input.sessionId,
    lessonId: input.lessonId,
    segmentId: input.segmentId,
    safeInstructionalCursor: input.safeInstructionalCursor,
    completedSegmentIds: [...input.completedSegmentIds],
    perSegmentActiveTime: input.perSegmentActiveTime.map((entry) => ({
      ...entry,
    })),
    pausedSeconds: input.pausedSeconds,
    breakSeconds: input.breakSeconds,
    protectedDraftRef: input.protectedDraftRef,
    protectedTutorStateRef: input.protectedTutorStateRef,
    lastAcceptedEventId: input.lastAcceptedEventId,
    eventVersion: BRIDGE_CONTRACT_VERSION,
    tutorInteractionRef: input.tutorInteractionRef,
    technicalInterruption: {
      status: "none" as const,
      interruptionId: null,
      category: "none" as const,
      startedAt: null,
    },
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  });
}

export {
  validateRecoveryCheckpoint,
  type ResumeValidationContext,
  type SafeInstructionalCursorV1,
  type StudyRecoveryCheckpointV1,
};
