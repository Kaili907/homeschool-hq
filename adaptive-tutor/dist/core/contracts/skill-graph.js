import { Type } from "../schema/typebox.js";
import { GradeBandSchema, StableIdSchema, SubjectSchema } from "./common.js";
export const SkillNodeSchema = Type.Object({
    id: StableIdSchema,
    title: Type.String({ minLength: 1, maxLength: 160 }),
    description: Type.String({ minLength: 1, maxLength: 1200 }),
    subject: SubjectSchema,
    gradeBand: GradeBandSchema,
    observableEvidence: Type.Array(Type.String({ minLength: 1, maxLength: 500 }), {
        minItems: 1,
        maxItems: 20,
    }),
}, { additionalProperties: false });
export const PrerequisiteEdgeSchema = Type.Object({
    prerequisiteSkillId: StableIdSchema,
    dependentSkillId: StableIdSchema,
    strength: Type.Union([
        Type.Literal("required"),
        Type.Literal("recommended"),
        Type.Literal("supporting"),
    ]),
    rationale: Type.String({ minLength: 1, maxLength: 600 }),
}, { additionalProperties: false });
export const PrerequisiteSkillGraphSchema = Type.Object({
    id: StableIdSchema,
    version: Type.String({ pattern: "^\\d+\\.\\d+\\.\\d+$" }),
    nodes: Type.Array(SkillNodeSchema, { minItems: 1, maxItems: 1000 }),
    edges: Type.Array(PrerequisiteEdgeSchema, { maxItems: 5000 }),
}, { additionalProperties: false, $id: "PrerequisiteSkillGraph" });
//# sourceMappingURL=skill-graph.js.map