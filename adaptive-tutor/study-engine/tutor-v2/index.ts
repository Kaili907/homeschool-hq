export * from "./evidence/index.js";
export * from "./privacy/index.js";
export * from "./parent-explanations/index.js";
export * from "./prerequisite-repair/index.js";
export * from "./reteach/index.js";

// Public bridge envelopes are stable Study-side boundaries. Neither the Wave 1
// bridge orchestrator nor the Study-internal Wave 2 adaptive composer is
// re-exported here. Study code that owns the trusted Wave 2 envelope imports the
// internal adaptive module directly; browser/provider callers have no shared
// package entrypoint to that deterministic boundary.
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
