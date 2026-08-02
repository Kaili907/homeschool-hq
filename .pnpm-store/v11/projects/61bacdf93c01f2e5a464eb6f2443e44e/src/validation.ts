import {
  AssessmentItemSchema,
  GuidedPracticeContractSchema,
  IndependentMasteryContractSchema,
  MediaFallbackSchema,
  NarrationTrackSchema,
  SpokenTurnSchema,
  TutorProgramSchema,
  TutorResponseSchema,
  VisualBoardCommandSchema,
  validateWithSchema,
} from "../../../core/index.js";
import { EnglishCoreV02ExtensionSchema } from "./adapters/english-core-v02-extension.js";
import type { EnglishModulePackage } from "./types.js";

export interface EnglishValidationCheck {
  moduleId: string;
  contract: string;
  passed: boolean;
  detail: string;
}

function check(
  moduleId: string,
  contract: string,
  schema: Parameters<typeof validateWithSchema>[0],
  value: unknown,
): EnglishValidationCheck {
  const result = validateWithSchema(schema, value);
  return {
    moduleId,
    contract,
    passed: result.ok,
    detail: result.ok
      ? "Valid"
      : result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
  };
}

export function validateEnglishModule(module: EnglishModulePackage): EnglishValidationCheck[] {
  const { coreProgram: program, coreV02Extension: extension, lessonId } = module;
  const items = [
    ...program.diagnosticItems,
    ...program.guidedPractice.items,
    ...program.independentMastery.items,
    ...program.reassessmentItems,
  ];
  const responses = [
    ...Object.values(extension.modeResponses),
    ...program.teachingSequences.flatMap((sequence) => sequence.turns),
  ];
  const commands = responses.flatMap((response) => response.boardCommands);

  return [
    check(lessonId, "TutorProgramSchema", TutorProgramSchema, program),
    ...items.map((item) => check(lessonId, `AssessmentItemSchema:${item.id}`, AssessmentItemSchema, item)),
    ...responses.map((response) => check(lessonId, `TutorResponseSchema:${response.id}`, TutorResponseSchema, response)),
    ...responses.map((response) => check(lessonId, `SpokenTurnSchema:${response.spokenTurn.id}`, SpokenTurnSchema, response.spokenTurn)),
    ...commands.map((command) => check(lessonId, `VisualBoardCommandSchema:${command.id}`, VisualBoardCommandSchema, command)),
    check(lessonId, "GuidedPracticeContractSchema", GuidedPracticeContractSchema, program.guidedPractice),
    check(lessonId, "IndependentMasteryContractSchema", IndependentMasteryContractSchema, program.independentMastery),
    check(lessonId, "MediaFallbackSchema", MediaFallbackSchema, program.mediaFallback),
    check(lessonId, "NarrationTrackSchema", NarrationTrackSchema, extension.narration),
    check(lessonId, "EnglishCoreV02ExtensionSchema", EnglishCoreV02ExtensionSchema, extension),
  ];
}
