import {
  COMPONENT_VERSIONS,
  RELEASE_MODE,
  RELEASE_NAME,
  RELEASE_VERSION,
} from "./version.ts";

export interface RuntimeHealth {
  readonly status: "ready-for-production-integration";
  readonly release: {
    readonly name: typeof RELEASE_NAME;
    readonly version: typeof RELEASE_VERSION;
    readonly mode: typeof RELEASE_MODE;
  };
  readonly components: typeof COMPONENT_VERSIONS;
  readonly authorities: {
    readonly instruction: "Tutor Core v0.2";
    readonly studyContracts: "Session 1";
    readonly pacing: "Session 2 algorithms";
    readonly bridge: "Session 6-R2";
    readonly student: "Session 7-R2";
    readonly calendarParent: "Session 8-R3";
  };
  readonly compatibility: {
    readonly node: ">=22 <23";
    readonly studySchemaVersion: 1;
    readonly bridgeContractVersion: 1;
  };
  readonly limitations: readonly string[];
}

export function inspectRuntimeHealth(): RuntimeHealth {
  return {
    status: "ready-for-production-integration",
    release: {
      name: RELEASE_NAME,
      version: RELEASE_VERSION,
      mode: RELEASE_MODE,
    },
    components: COMPONENT_VERSIONS,
    authorities: {
      instruction: "Tutor Core v0.2",
      studyContracts: "Session 1",
      pacing: "Session 2 algorithms",
      bridge: "Session 6-R2",
      student: "Session 7-R2",
      calendarParent: "Session 8-R3",
    },
    compatibility: {
      node: ">=22 <23",
      studySchemaVersion: 1,
      bridgeContractVersion: 1,
    },
    limitations: [
      "In-memory release-candidate ports are not production persistence.",
      "Production safety classification requires an injected reviewed classifier.",
      "Authentication, authorization, RLS, migrations, deployment, and external delivery are not included.",
    ],
  };
}
