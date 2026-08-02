export const RELEASE_NAME = "Manuel Academy Adaptive Study Engine" as const;
export const RELEASE_VERSION = "1.0.0-rc.1" as const;

export const COMPONENT_VERSIONS = Object.freeze({
  tutorCore: "0.2.0",
  tutorCoreStatus: "frozen",
  tutorCoreBridge: "1.0.1",
  tutorCoreBridgeContract: 1,
  studentRuntime: "0.7.2",
  calendarParentRuntime: "0.8.1",
} as const);

export const RELEASE_MODE = "portable-non-production" as const;
