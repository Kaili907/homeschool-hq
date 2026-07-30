import type { TSchema } from "../schema/typebox.js";
export interface ValidationIssue {
    path: string;
    message: string;
    value: unknown;
}
export type ValidationResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    issues: ValidationIssue[];
};
export declare function validateWithSchema<T>(schema: TSchema, value: unknown): ValidationResult<T>;
export declare function assertValid<T>(schema: TSchema, value: unknown, label: string): T;
//# sourceMappingURL=validation.d.ts.map