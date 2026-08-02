import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runDeterministicDemonstrations } from "../src/demonstrations.ts";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

const traces = await runDeterministicDemonstrations();
const document = {
  contract: "manuel-academy.adaptive-study-engine.demonstrations.v1",
  releaseVersion: "1.0.0-rc.1",
  generatedFromDeterministicInputs: true,
  demonstrations: traces,
};
const canonical = canonicalJson(document);
const digest = createHash("sha256").update(canonical).digest("hex").toUpperCase();
const directory = resolve(process.cwd(), "../release/traces");
await mkdir(directory, { recursive: true });
await writeFile(
  resolve(directory, "deterministic-end-to-end.json"),
  `${JSON.stringify(document, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(directory, "deterministic-end-to-end.sha256"),
  `${digest}  deterministic-end-to-end.json\n`,
  "utf8",
);
console.log(JSON.stringify({ demonstrations: traces.length, sha256: digest }));
