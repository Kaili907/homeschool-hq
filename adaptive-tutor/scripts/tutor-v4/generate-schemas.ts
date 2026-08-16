import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { TSchema } from "../../core/schema/typebox.js";
import {
  BoundedCommercialProviderResponseSchema,
  StudyCommercialEffectReceiptSchema,
  StudyCommercialTutorAdvisorySchema,
  StudyCommercialTutorInvocationSchema,
} from "../../core/v3/contracts/index.js";
import { InstructionalMemoryDeltaSchema } from "../../core/v3/memory/index.js";
import { DurableMultimodalEvidenceSchema } from "../../core/v3/multimodal/index.js";
import { BoundedCommercialProviderRequestSchema } from "../../core/v3/provider-request/index.js";
import { MinimizedAcceptedStudyEffectEventSchema } from "../../core/v3/recovery/index.js";
import { TutorCommercialTelemetryEventSchema } from "../../core/v3/telemetry/index.js";
import { ParentReportSchema } from "../../study-engine/tutor-v2/parent-reporting/index.js";

interface SchemaArtifact {
  readonly file: string;
  readonly title: string;
  readonly source: string;
  readonly schema: TSchema;
}

export const WAVE4_SERIALIZED_SCHEMA_ARTIFACTS: readonly SchemaArtifact[] = [
  { file: "study-commercial-tutor-invocation.schema.json", title: "Study Commercial Tutor Invocation", source: "core/v3/contracts/commercial.ts#StudyCommercialTutorInvocationSchema", schema: StudyCommercialTutorInvocationSchema },
  { file: "bounded-commercial-provider-request.schema.json", title: "Bounded Commercial Provider Request", source: "core/v3/provider-request/contracts.ts#BoundedCommercialProviderRequestSchema", schema: BoundedCommercialProviderRequestSchema },
  { file: "bounded-commercial-provider-response.schema.json", title: "Bounded Commercial Provider Response", source: "core/v3/contracts/commercial.ts#BoundedCommercialProviderResponseSchema", schema: BoundedCommercialProviderResponseSchema },
  { file: "study-commercial-tutor-advisory.schema.json", title: "Study Commercial Tutor Advisory", source: "core/v3/contracts/commercial.ts#StudyCommercialTutorAdvisorySchema", schema: StudyCommercialTutorAdvisorySchema },
  { file: "study-commercial-effect-receipt.schema.json", title: "Study Commercial Effect Receipt", source: "core/v3/contracts/commercial.ts#StudyCommercialEffectReceiptSchema", schema: StudyCommercialEffectReceiptSchema },
  { file: "commercial-operation-telemetry-event.schema.json", title: "Commercial Operation Telemetry Event", source: "core/v3/telemetry/contracts.ts#TutorCommercialTelemetryEventSchema", schema: TutorCommercialTelemetryEventSchema },
  { file: "parent-report.schema.json", title: "Authorized Commercial Parent Report", source: "study-engine/tutor-v2/parent-reporting/parent-report.ts#ParentReportSchema", schema: ParentReportSchema },
  { file: "instructional-memory-delta.schema.json", title: "Recoverable Instructional Memory Delta", source: "core/v3/memory/instructional-memory-delta.ts#InstructionalMemoryDeltaSchema", schema: InstructionalMemoryDeltaSchema },
  { file: "durable-multimodal-evidence.schema.json", title: "Durable Multimodal Evidence", source: "core/v3/multimodal/contracts.ts#DurableMultimodalEvidenceSchema", schema: DurableMultimodalEvidenceSchema },
  { file: "minimized-accepted-study-effect-event.schema.json", title: "Minimized Accepted Study Effect Event", source: "core/v3/recovery/recoverable-memory-replay.ts#MinimizedAcceptedStudyEffectEventSchema", schema: MinimizedAcceptedStudyEffectEventSchema },
] as const;

const outputDirectory = resolve("json-schema/v4/wave4");
const checkOnly = process.argv.includes("--check");

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalize(child)]));
}

function serialize(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function assertRecursivelyClosed(schema: unknown, path: string): void {
  if (schema === null || typeof schema !== "object") return;
  if (Array.isArray(schema)) {
    schema.forEach((child, index) => assertRecursivelyClosed(child, `${path}/${index}`));
    return;
  }
  const record = schema as Record<string, unknown>;
  if (record.type === "object" && record.additionalProperties !== false) {
    throw new Error(`Wave 4 object schema is not closed at ${path}`);
  }
  for (const [key, child] of Object.entries(record)) {
    if (key !== "static") assertRecursivelyClosed(child, `${path}/${key}`);
  }
}

const outputs = new Map<string, string>();
for (const artifact of WAVE4_SERIALIZED_SCHEMA_ARTIFACTS) {
  assertRecursivelyClosed(artifact.schema, artifact.file);
  outputs.set(artifact.file, serialize({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: artifact.title,
    ...artifact.schema,
  }));
}
const schemas = WAVE4_SERIALIZED_SCHEMA_ARTIFACTS.map((artifact) => {
  const content = outputs.get(artifact.file);
  if (content === undefined) throw new Error(`Missing schema content: ${artifact.file}`);
  return { file: artifact.file, source: artifact.source, sha256: sha256(content) };
});
outputs.set("SCHEMA-INVENTORY.json", serialize({
  schemaInventoryVersion: 1,
  product: "Manuel Academy Study Tutor V2",
  wave: "Wave 4 Adversarial Certification + Repair Reconvergence",
  generatedSchemaCount: WAVE4_SERIALIZED_SCHEMA_ARTIFACTS.length,
  internalPortSchemasGenerated: 0,
  allSerializedObjectSchemasRecursivelyClosed: true,
  historicalWave3SchemaDirectoryRewritten: false,
  previousAcceptedSchemaDirectory: "json-schema/v3/wave3",
  currentSchemaDirectory: "json-schema/v4/wave4",
  additionalSerializedBoundaryCount: 0,
  additionalBoundaryAdjudications: [
    { candidate: "CommercialExecutionScope", classification: "TRUSTED_INTERNAL_CONTRACT" },
    { candidate: "model certification", classification: "TOOLING_ARTIFACT" },
    { candidate: "campaign evidence", classification: "TOOLING_ARTIFACT" },
    { candidate: "accepted presentation", classification: "TRUSTED_INTERNAL_CONTRACT", durableProjection: "DurableMultimodalEvidence" },
  ],
  schemas,
}));

if (checkOnly) {
  const actualFiles = (await readdir(outputDirectory)).sort();
  const expectedFiles = [...outputs.keys()].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(`Wave 4 schema inventory differs: expected ${expectedFiles.join(", ")}; found ${actualFiles.join(", ")}`);
  }
  for (const [file, expected] of outputs) {
    const actual = await readFile(resolve(outputDirectory, file), "utf8");
    if (actual !== expected) throw new Error(`Wave 4 schema drift detected: ${file}`);
  }
  process.stdout.write(`PASS wave4-schema-check ${WAVE4_SERIALIZED_SCHEMA_ARTIFACTS.length} schemas + inventory\n`);
} else {
  await mkdir(outputDirectory, { recursive: true });
  for (const [file, content] of outputs) {
    await writeFile(resolve(outputDirectory, file), content, "utf8");
  }
  process.stdout.write(`PASS wave4-schema-generation ${WAVE4_SERIALIZED_SCHEMA_ARTIFACTS.length} schemas + inventory\n`);
}
