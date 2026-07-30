import { Value } from "../schema/value.js";
export function validateWithSchema(schema, value) {
    if (Value.Check(schema, value)) {
        return { ok: true, value: value };
    }
    const issues = [...Value.Errors(schema, value)].map((error) => ({
        path: error.path || "/",
        message: error.message,
        value: error.value,
    }));
    return { ok: false, issues };
}
export function assertValid(schema, value, label) {
    const result = validateWithSchema(schema, value);
    if (!result.ok) {
        const details = result.issues
            .map((issue) => `${issue.path}: ${issue.message}`)
            .join("\n");
        throw new Error(`${label} failed validation:\n${details}`);
    }
    return result.value;
}
//# sourceMappingURL=validation.js.map