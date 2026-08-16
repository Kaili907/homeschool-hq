import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { WAVE3_SERIALIZED_SCHEMA_ARTIFACTS } from "../../scripts/tutor-v3/generate-schemas.js";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== "static")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalize(child)]));
}

function assertClosed(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertClosed(child, `${path}/${index}`));
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (record.type === "object") assert.equal(record.additionalProperties, false, path);
  for (const [key, child] of Object.entries(record)) assertClosed(child, `${path}/${key}`);
}

test("all eight generated serialized schemas exactly match runtime schemas and are recursively closed", () => {
  const tutorRoot = process.cwd().endsWith("adaptive-tutor") ? process.cwd() : resolve("adaptive-tutor");
  assert.equal(WAVE3_SERIALIZED_SCHEMA_ARTIFACTS.length, 8);
  for (const artifact of WAVE3_SERIALIZED_SCHEMA_ARTIFACTS) {
    const generated = JSON.parse(readFileSync(
      resolve(tutorRoot, "json-schema/v3/wave3", artifact.file),
      "utf8",
    )) as Record<string, unknown>;
    delete generated.$schema;
    delete generated.title;
    assert.deepEqual(canonicalize(generated), canonicalize(artifact.schema), artifact.file);
    assertClosed(generated, artifact.file);
  }
});

test("schema inventory records zero internal-port schemas", () => {
  const tutorRoot = process.cwd().endsWith("adaptive-tutor") ? process.cwd() : resolve("adaptive-tutor");
  const inventory = JSON.parse(readFileSync(
    resolve(tutorRoot, "json-schema/v3/wave3/SCHEMA-INVENTORY.json"),
    "utf8",
  )) as { generatedSchemaCount: number; internalPortSchemasGenerated: number };
  assert.deepEqual(inventory, {
    ...inventory,
    generatedSchemaCount: 8,
    internalPortSchemasGenerated: 0,
  });
});
