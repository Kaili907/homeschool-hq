import type { TSchema } from "./typebox.js";
export interface ValueError {
    path: string;
    message: string;
    value: unknown;
}
export declare const Value: {
    Check(schema: TSchema, value: unknown): boolean;
    Errors(schema: TSchema, value: unknown): Iterable<ValueError>;
};
//# sourceMappingURL=value.d.ts.map