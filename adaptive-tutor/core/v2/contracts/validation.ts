import type { Static, TSchema } from "../../schema/typebox.js";
import { Value } from "../../schema/value.js";

export interface ExactValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type ExactValidationResult<T> =
  | { readonly status: "accepted"; readonly value: T }
  | {
      readonly status: "rejected";
      readonly code: "CONTRACT_VALIDATION_REJECTED";
      readonly issues: readonly ExactValidationIssue[];
    };

const MAXIMUM_DEPTH = 24;
const MAXIMUM_NODES = 10_000;
const MAXIMUM_ARRAY_ITEMS = 1_000;
const MAXIMUM_OBJECT_KEYS = 100;
const MAXIMUM_STRING_LENGTH = 16_000;
const RESERVED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function inspectJsonBoundary(value: unknown): ExactValidationIssue[] {
  const issues: ExactValidationIssue[] = [];
  const ancestors = new Set<object>();
  let nodeCount = 0;

  const inspect = (candidate: unknown, path: string, depth: number): void => {
    nodeCount += 1;
    if (nodeCount > MAXIMUM_NODES) {
      issues.push({ path, message: "Contract exceeds the maximum node count." });
      return;
    }
    if (depth > MAXIMUM_DEPTH) {
      issues.push({ path, message: "Contract exceeds the maximum nesting depth." });
      return;
    }
    if (candidate === null || typeof candidate === "boolean") return;
    if (typeof candidate === "string") {
      if (candidate.length > MAXIMUM_STRING_LENGTH) {
        issues.push({ path, message: "String exceeds the contract boundary limit." });
      }
      return;
    }
    if (typeof candidate === "number") {
      if (!Number.isFinite(candidate)) {
        issues.push({ path, message: "Only finite JSON numbers are allowed." });
      }
      return;
    }
    if (typeof candidate !== "object") {
      issues.push({ path, message: "Value is not JSON-safe." });
      return;
    }
    if (ancestors.has(candidate)) {
      issues.push({ path, message: "Cyclic values are not allowed." });
      return;
    }

    const prototype = Object.getPrototypeOf(candidate);
    if (Array.isArray(candidate)) {
      if (prototype !== Array.prototype) {
        issues.push({ path, message: "Array has an unsupported prototype." });
        return;
      }
      if (candidate.length > MAXIMUM_ARRAY_ITEMS) {
        issues.push({ path, message: "Array exceeds the contract boundary limit." });
        return;
      }
      ancestors.add(candidate);
      for (let index = 0; index < candidate.length; index += 1) {
        if (!Object.hasOwn(candidate, index)) {
          issues.push({ path: `${path}/${index}`, message: "Sparse arrays are not allowed." });
          continue;
        }
        inspect(candidate[index], `${path}/${index}`, depth + 1);
      }
      ancestors.delete(candidate);
      return;
    }

    if (prototype !== Object.prototype) {
      issues.push({ path, message: "Only plain JSON objects are allowed." });
      return;
    }
    const descriptors = Object.getOwnPropertyDescriptors(candidate);
    const keys = Object.keys(descriptors);
    if (keys.length > MAXIMUM_OBJECT_KEYS) {
      issues.push({ path, message: "Object exceeds the contract key limit." });
      return;
    }
    ancestors.add(candidate);
    for (const key of keys) {
      const descriptor = descriptors[key];
      const childPath = `${path}/${key}`;
      if (RESERVED_KEYS.has(key)) {
        issues.push({ path: childPath, message: "Reserved object keys are not allowed." });
        continue;
      }
      if (!descriptor || descriptor.get || descriptor.set || !("value" in descriptor)) {
        issues.push({ path: childPath, message: "Accessors are not allowed." });
        continue;
      }
      inspect(descriptor.value, childPath, depth + 1);
    }
    ancestors.delete(candidate);
  };

  inspect(value, "$", 0);
  return issues;
}

export function validateExact<const T extends TSchema>(
  schema: T,
  value: unknown,
): ExactValidationResult<Static<T>> {
  const boundaryIssues = inspectJsonBoundary(value);
  if (boundaryIssues.length > 0) {
    return {
      status: "rejected",
      code: "CONTRACT_VALIDATION_REJECTED",
      issues: boundaryIssues,
    };
  }
  if (Value.Check(schema, value)) {
    return { status: "accepted", value: value as Static<T> };
  }
  return {
    status: "rejected",
    code: "CONTRACT_VALIDATION_REJECTED",
    issues: [...Value.Errors(schema, value)].map((error) => ({
      path: error.path.length > 0 ? error.path : "$",
      message: error.message,
    })),
  };
}

export function isExactContract<const T extends TSchema>(
  schema: T,
  value: unknown,
): value is Static<T> {
  return validateExact(schema, value).status === "accepted";
}
