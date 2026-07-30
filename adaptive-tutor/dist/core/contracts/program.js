import { Type } from "../schema/typebox.js";
import { AssessmentItemSchema } from "./assessment.js";
import { GradeBandSchema, LocaleSchema, StableIdSchema, SubjectSchema } from "./common.js";
import { GuidedPracticeContractSchema, IndependentMasteryContractSchema } from "./practice.js";
import { MediaFallbackSchema } from "./media.js";
import { MisconceptionDefinitionSchema } from "./misconception.js";
import { PrerequisiteSkillGraphSchema } from "./skill-graph.js";
import { TutorResponseSchema } from "./tutor-response.js";
export const TeachingSequenceSchema = Type.Object({
    misconceptionId: Type.Union([StableIdSchema, Type.Literal("default")]),
    turns: Type.Array(TutorResponseSchema, { minItems: 1, maxItems: 20 }),
}, { additionalProperties: false });
export const TutorProgramSchema = Type.Object({
    id: StableIdSchema,
    version: Type.String({ pattern: "^\\d+\\.\\d+\\.\\d+$" }),
    title: Type.String({ minLength: 1, maxLength: 200 }),
    subject: SubjectSchema,
    gradeBand: GradeBandSchema,
    locale: LocaleSchema,
    targetSkillId: StableIdSchema,
    skillGraph: PrerequisiteSkillGraphSchema,
    diagnosticItems: Type.Array(AssessmentItemSchema, { minItems: 1, maxItems: 20 }),
    misconceptions: Type.Array(MisconceptionDefinitionSchema, { maxItems: 30 }),
    teachingSequences: Type.Array(TeachingSequenceSchema, { minItems: 1, maxItems: 31 }),
    guidedPractice: GuidedPracticeContractSchema,
    independentMastery: IndependentMasteryContractSchema,
    reassessmentItems: Type.Array(AssessmentItemSchema, { minItems: 1, maxItems: 20 }),
    mediaFallback: MediaFallbackSchema,
    persistentDifficultyCycleLimit: Type.Integer({ minimum: 1, maximum: 10 }),
}, { additionalProperties: false, $id: "TutorProgram" });
//# sourceMappingURL=program.js.map