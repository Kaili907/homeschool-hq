import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { TSchema } from "../../core/schema/typebox.js";
import {
  WAVE2_ADAPTIVE_COMPOSITION_VERSION,
  Wave2AdaptiveCompositionRequestSchema,
  Wave2StudyDecisionPacketSchema,
} from "../../study-engine/tutor-v2/adaptive/index.js";

interface SchemaArtifact {
  readonly file: string;
  readonly title: string;
  readonly source: string;
  readonly schema: TSchema;
}

const artifacts: readonly SchemaArtifact[] = [
  {
    file: "wave2-adaptive-composition-request.schema.json",
    title: "Study Tutor V2 Wave 2 Adaptive Composition Request",
    source: "study-engine/tutor-v2/adaptive/contracts.ts#Wave2AdaptiveCompositionRequestSchema",
    schema: Wave2AdaptiveCompositionRequestSchema,
  },
  {
    file: "wave2-study-decision-packet.schema.json",
    title: "Study Tutor V2 Wave 2 Study Decision Packet",
    source: "study-engine/tutor-v2/adaptive/contracts.ts#Wave2StudyDecisionPacketSchema",
    schema: Wave2StudyDecisionPacketSchema,
  },
] as const;

const outputDirectory = resolve("json-schema/v2/wave2");
const checkOnly = process.argv.includes("--check");

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

function serialize(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

const outputs = new Map<string, string>();
for (const artifact of artifacts) {
  outputs.set(artifact.file, serialize({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: artifact.title,
    ...artifact.schema,
  }));
}
const inventory = artifacts.map((artifact) => {
  const content = outputs.get(artifact.file);
  if (content === undefined) throw new Error(`Missing schema content: ${artifact.file}`);
  return { file: artifact.file, source: artifact.source, sha256: sha256(content) };
});
outputs.set("SCHEMA-INVENTORY.json", serialize({
  schemaInventoryVersion: 1,
  product: "Manuel Academy Study Tutor V2",
  wave: "Wave 2 Adaptive Intelligence Candidate",
  compositionVersion: WAVE2_ADAPTIVE_COMPOSITION_VERSION,
  generatedSchemaCount: artifacts.length,
  internalPortSchemasGenerated: 0,
  schemas: inventory,
}));

if (checkOnly) {
  const actualFiles = (await readdir(outputDirectory)).sort();
  const expectedFiles = [...outputs.keys()].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(`Wave 2 schema inventory differs: expected ${expectedFiles.join(", ")}; found ${actualFiles.join(", ")}`);
  }
  for (const [file, expected] of outputs) {
    const actual = await readFile(resolve(outputDirectory, file), "utf8");
    if (actual !== expected) throw new Error(`Wave 2 schema drift detected: ${file}`);
  }
  process.stdout.write(`PASS wave2-schema-check ${artifacts.length} schemas + inventory\n`);
} else {
  await mkdir(outputDirectory, { recursive: true });
  for (const [file, content] of outputs) {
    await writeFile(resolve(outputDirectory, file), content, "utf8");
  }
  process.stdout.write(`PASS wave2-schema-generation ${artifacts.length} schemas + inventory\n`);
}
