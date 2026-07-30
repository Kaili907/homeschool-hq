import type { PrerequisiteSkillGraph, StableId } from "../contracts/index.js";
export interface SkillGraphValidation {
    valid: boolean;
    errors: string[];
    topologicalOrder: StableId[];
}
export declare function validateSkillGraph(graph: PrerequisiteSkillGraph): SkillGraphValidation;
export declare function getMissingPrerequisites(graph: PrerequisiteSkillGraph, skillId: StableId, demonstratedSkillIds: ReadonlySet<StableId>): StableId[];
//# sourceMappingURL=skill-graph.d.ts.map