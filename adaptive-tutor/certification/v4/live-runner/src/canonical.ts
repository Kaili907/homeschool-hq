import { createHash } from "node:crypto";

import type { JsonValue, Sha256Digest } from "./contracts.ts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("canonical JSON numbers must be finite");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (!isPlainObject(value)) throw new TypeError("canonical JSON objects must have a plain prototype");
  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key] as JsonValue)}`);
  return `{${entries.join(",")}}`;
}

export function sha256(value: JsonValue): Sha256Digest {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

export function deterministicId(prefix: "campaign" | "case" | "trial", value: JsonValue): string {
  return `${prefix}_${sha256(value).slice("sha256:".length, "sha256:".length + 32)}`;
}

export function detached<T>(value: T): T {
  return structuredClone(value);
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
