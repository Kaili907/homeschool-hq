export interface PromptTemplate {
    id: string;
    purpose: string;
    system: string;
    userTemplate: string;
    requiredVariables: string[];
}
export declare const promptTemplates: readonly PromptTemplate[];
//# sourceMappingURL=templates.d.ts.map