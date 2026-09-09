import { Type, type Static } from "../../schema/typebox.js";

export const TUTOR_V2_CONTRACT_VERSION = "2.0.0" as const;
export const TUTOR_V2_ACTION_SCHEMA_VERSION = 1 as const;
export const TUTOR_V2_COMPATIBILITY_ID =
  "manuel-academy.study-tutor-v2.contracts.v2" as const;
export const TUTOR_V2_ACTION_COMPATIBILITY_ID =
  "manuel-academy.study-tutor-v2.action.v1" as const;

export const TutorV2VersionHeaderSchema = Type.Object(
  {
    contractVersion: Type.Literal(TUTOR_V2_CONTRACT_VERSION),
    actionSchemaVersion: Type.Literal(TUTOR_V2_ACTION_SCHEMA_VERSION),
    compatibilityId: Type.Literal(TUTOR_V2_COMPATIBILITY_ID),
    actionCompatibilityId: Type.Literal(TUTOR_V2_ACTION_COMPATIBILITY_ID),
  },
  { additionalProperties: false, $id: "TutorV2VersionHeader" },
);
export type TutorV2VersionHeader = Static<typeof TutorV2VersionHeaderSchema>;
