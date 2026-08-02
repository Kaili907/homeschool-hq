export { EnglishCoreV02ExtensionSchema } from "./adapters/english-core-v02-extension.js";
export { clearParagraphRevisionModule } from "./modules/clear-paragraph-revision.js";
export { decodingMultisyllableWordsModule } from "./modules/decoding-multisyllable-words.js";
export { mainIdeaSupportingDetailsModule } from "./modules/main-idea-supporting-details.js";
export { sentenceCompletenessModule } from "./modules/sentence-completeness.js";
export { coreChangeRequests, integrationMatrix } from "./integration-matrix.js";
export { englishTutoringRules, learnerSafetyLanguage } from "./policies.js";
export { validateEnglishModule } from "./validation.js";
export type * from "./types.js";

import { clearParagraphRevisionModule } from "./modules/clear-paragraph-revision.js";
import { decodingMultisyllableWordsModule } from "./modules/decoding-multisyllable-words.js";
import { mainIdeaSupportingDetailsModule } from "./modules/main-idea-supporting-details.js";
import { sentenceCompletenessModule } from "./modules/sentence-completeness.js";

export const englishModules = [
  decodingMultisyllableWordsModule,
  sentenceCompletenessModule,
  mainIdeaSupportingDetailsModule,
  clearParagraphRevisionModule,
] as const;
