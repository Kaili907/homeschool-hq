export * from "./evidence/index.js";
export * from "./privacy/index.js";
export * from "./adaptive/index.js";
export * from "./parent-explanations/index.js";
export * from "./prerequisite-repair/index.js";
export * from "./reteach/index.js";

// Public bridge envelopes are stable Study-side boundaries. The orchestration
// function is intentionally not re-exported here: W1-08 remains the one
// supported orchestration entrypoint.
export {
  ReviewedStaticFallbackSchema,
  TUTOR_V2_BRIDGE_EVENT_VERSION,
  TUTOR_V2_BRIDGE_VERSION,
  TutorInvocationPermissionSchema,
  TutorV2BridgeEvidenceContextSchema,
  TutorV2BridgeInvocationSchema,
  TutorV2BridgeMemoryAccessSchema,
} from "../bridges/tutor-v2/contracts.js";
export type {
  ReviewedStaticFallback,
  StudyReviewedStaticFallbackPort,
  StudyTutorAgeTurnInspectorPort,
  StudyTutorInvocationPermissionPort,
  StudyTutorSafetyPort,
  TutorInvocationPermission,
  TutorV2AcceptedEventLedgerPort,
  TutorV2BridgeDependencies,
  TutorV2BridgeEvidenceContext,
  TutorV2BridgeInvocation,
  TutorV2BridgeMemoryAccess,
  TutorV2BridgeResult,
  TutorV2MemoryPort,
} from "../bridges/tutor-v2/contracts.js";
