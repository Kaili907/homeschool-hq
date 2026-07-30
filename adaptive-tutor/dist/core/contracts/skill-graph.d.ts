import { type Static } from "../schema/typebox.js";
export declare const SkillNodeSchema: import("../schema/typebox.js").TSchema<{
    description: string;
    id: string;
    subject: "math" | "english" | "science" | "social-studies" | "general";
    gradeBand: {
        min: number;
        max: number;
        label: string;
    } & {};
    observableEvidence: string[];
    title: string;
} & {}>;
export declare const PrerequisiteEdgeSchema: import("../schema/typebox.js").TSchema<{
    strength: "required" | "recommended" | "supporting";
    prerequisiteSkillId: string;
    dependentSkillId: string;
    rationale: string;
} & {}>;
export declare const PrerequisiteSkillGraphSchema: import("../schema/typebox.js").TSchema<{
    id: string;
    nodes: ({
        description: string;
        id: string;
        subject: "math" | "english" | "science" | "social-studies" | "general";
        gradeBand: {
            min: number;
            max: number;
            label: string;
        } & {};
        observableEvidence: string[];
        title: string;
    } & {})[];
    edges: ({
        strength: "required" | "recommended" | "supporting";
        prerequisiteSkillId: string;
        dependentSkillId: string;
        rationale: string;
    } & {})[];
    version: string;
} & {}>;
export type SkillNode = Static<typeof SkillNodeSchema>;
export type PrerequisiteEdge = Static<typeof PrerequisiteEdgeSchema>;
export type PrerequisiteSkillGraph = Static<typeof PrerequisiteSkillGraphSchema>;
//# sourceMappingURL=skill-graph.d.ts.map