import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AssessmentItemSchema,
  ConfidenceEstimateSchema,
  GuidedPracticeContractSchema,
  IndependentMasteryContractSchema,
  MediaFallbackSchema,
  MisconceptionClassificationSchema,
  NarrationTrackSchema,
  ParentTeacherReviewSchema,
  PrerequisiteSkillGraphSchema,
  SafetyDecisionSchema,
  SpokenTurnSchema,
  TutorProgramSchema,
  TutorResponseSchema,
  VisualBoardCommandSchema,
} from "../core/contracts/index.js";

const schemas = {
  "assessment-item.schema.json": AssessmentItemSchema,
  "prerequisite-skill-graph.schema.json": PrerequisiteSkillGraphSchema,
  "misconception-classification.schema.json": MisconceptionClassificationSchema,
  "confidence-estimate.schema.json": ConfidenceEstimateSchema,
  "tutor-response.schema.json": TutorResponseSchema,
  "visual-board-command.schema.json": VisualBoardCommandSchema,
  "spoken-turn.schema.json": SpokenTurnSchema,
  "narration-caption-transcript.schema.json": NarrationTrackSchema,
  "guided-practice.schema.json": GuidedPracticeContractSchema,
  "independent-mastery.schema.json": IndependentMasteryContractSchema,
  "parent-teacher-review.schema.json": ParentTeacherReviewSchema,
  "media-fallback.schema.json": MediaFallbackSchema,
  "safety-decision.schema.json": SafetyDecisionSchema,
  "tutor-program.schema.json": TutorProgramSchema,
};

const outputDirectory = resolve("json-schema");
await mkdir(outputDirectory, { recursive: true });
for (const [filename, schema] of Object.entries(schemas)) {
  await writeFile(resolve(outputDirectory, filename), `${JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", ...schema }, null, 2)}\n`, "utf8");
}
console.log(`Exported ${Object.keys(schemas).length} JSON Schema files to ${outputDirectory}`);
