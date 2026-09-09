import {
  validateExact,
  type ExactValidationResult,
} from "../../v2/contracts/validation.js";
import type { Static, TSchema } from "../../schema/typebox.js";

const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function snapshotJson(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new TypeError("Unsafe array prototype encountered during snapshot.");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const allowedKeys = new Set([
      "length",
      ...Array.from({ length: value.length }, (_, index) => String(index)),
    ]);
    if (Object.keys(descriptors).some((key) => !allowedKeys.has(key))) {
      throw new TypeError("Unknown array property encountered during snapshot.");
    }
    const snapshot: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || descriptor.get || descriptor.set || !("value" in descriptor)) {
        throw new TypeError("Unsafe array property encountered during snapshot.");
      }
      snapshot.push(snapshotJson(descriptor.value));
    }
    return Object.freeze(snapshot);
  }

  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError("Unsafe object prototype encountered during snapshot.");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const snapshot: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (
      RESERVED_KEYS.has(key)
      || descriptor.get
      || descriptor.set
      || !("value" in descriptor)
    ) {
      throw new TypeError("Unsafe object property encountered during snapshot.");
    }
    Object.defineProperty(snapshot, key, {
      value: snapshotJson(descriptor.value),
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return Object.freeze(snapshot);
}

/**
 * Validates hostile runtime input and returns an immutable data-property-only
 * snapshot. Semantic policy never reads the caller-owned object after this
 * boundary.
 */
export function validateExactSnapshot<const T extends TSchema>(
  schema: T,
  candidate: unknown,
): ExactValidationResult<Static<T>> {
  const validation = validateExact(schema, candidate);
  if (validation.status === "rejected") return validation;

  try {
    const snapshot = snapshotJson(validation.value);
    const snapshotValidation = validateExact(schema, snapshot);
    if (snapshotValidation.status === "rejected") return snapshotValidation;
    return { status: "accepted", value: snapshot as Static<T> };
  } catch {
    return {
      status: "rejected",
      code: "CONTRACT_VALIDATION_REJECTED",
      issues: [{ path: "$", message: "Contract could not be safely snapshotted." }],
    };
  }
}
