import { Type } from "../../schema/typebox.js";
export const TUTOR_V2_CONTRACT_VERSION = "2.0.0";
export const TUTOR_V2_ACTION_SCHEMA_VERSION = 1;
export const TUTOR_V2_COMPATIBILITY_ID = "manuel-academy.study-tutor-v2.contracts.v2";
export const TUTOR_V2_ACTION_COMPATIBILITY_ID = "manuel-academy.study-tutor-v2.action.v1";
export const TutorV2VersionHeaderSchema = Type.Object({
    contractVersion: Type.Literal(TUTOR_V2_CONTRACT_VERSION),
    actionSchemaVersion: Type.Literal(TUTOR_V2_ACTION_SCHEMA_VERSION),
    compatibilityId: Type.Literal(TUTOR_V2_COMPATIBILITY_ID),
    actionCompatibilityId: Type.Literal(TUTOR_V2_ACTION_COMPATIBILITY_ID),
}, { additionalProperties: false, $id: "TutorV2VersionHeader" });
