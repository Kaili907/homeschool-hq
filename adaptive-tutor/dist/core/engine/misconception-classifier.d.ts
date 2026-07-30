import type { MisconceptionClassification, MisconceptionDefinition, StableId } from "../contracts/index.js";
export interface ClassificationEvidence {
    tags: StableId[];
}
export declare function classifyMisconceptions(skillId: StableId, definitions: readonly MisconceptionDefinition[], evidence: readonly ClassificationEvidence[]): MisconceptionClassification;
//# sourceMappingURL=misconception-classifier.d.ts.map