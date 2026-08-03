import { Value } from "../schema/value.js";
import type { TSchema } from "../schema/typebox.js";

export interface ValidationIssue {
  path: string;
  message: string;
  value: unknown;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

export function validateWithSchema<T>(schema: TSchema, value: unknown): ValidationResult<T> {
  if (Value.Check(schema, value)) {
    return { ok: true, value: value as T };
  }

  const issues = [...Value.Errors(schema, value)].map((error) => ({
    path: error.path || "/",
    message: error.message,
    value: error.value,
  }));
  return { ok: false, issues };
}

export function assertValid<T>(schema: TSchema, value: unknown, label: string): T {
  const result = validateWithSchema<T>(schema, value);
  if (!result.ok) {
    const details = result.issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("\n");
    throw new Error(`${label} failed validation:\n${details}`);
  }
  return result.value;
}
