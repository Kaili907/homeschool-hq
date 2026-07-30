import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(here, "reconciliation-manifest.json");
const tracesPath = path.join(here, "flow-traces.json");
const mappingsPath = path.join(here, "exact-mappings.json");

export function isOpaqueId(value) {
  return typeof value === "string"
    && /^[A-Za-z0-9_-]{16,128}$/.test(value)
    && !/[a-z]{3,}[-_][a-z]{3,}/i.test(value);
}

export function validateEvent(event, seen = new Set()) {
  const errors = [];
  if (!isOpaqueId(event.eventId)) errors.push("eventId");
  if (!isOpaqueId(event.streamId)) errors.push("streamId");
  if (!/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(event.name ?? "")) errors.push("name");
  if (!/^\d+\.\d+\.\d+$/.test(event.version ?? "")) errors.push("version");
  if (seen.has(event.eventId)) errors.push("duplicateEventId");
  if (errors.length === 0) seen.add(event.eventId);
  return { valid: errors.length === 0, errors };
}

export function applyParentPrecedence(input) {
  const reasons = [];
  let duration = input.gradeBandDefault;
  if (input.engineRecommendation != null) duration = input.engineRecommendation;
  if (input.parentManualOverride != null) duration = input.parentManualOverride;
  if (input.parentHardMaximum != null) duration = Math.min(duration, input.parentHardMaximum);
  if (input.requiredAccommodation?.maximumDuration != null) {
    duration = Math.min(duration, input.requiredAccommodation.maximumDuration);
    reasons.push("required_accommodation");
  }
  if (input.safetyMaximum != null) {
    duration = Math.min(duration, input.safetyMaximum);
    reasons.push("safety_limit");
  }
  if (input.minimumDuration != null && duration < input.minimumDuration) {
    return { status: "manual_review", duration, reasons: [...reasons, "minimum_conflict"] };
  }
  return { status: "applied", duration, reasons };
}

export function projectLearner(record) {
  const forbidden = new Set([
    "adultPrivateNote", "rawAnswer", "rawTranscript", "emailAddress",
    "legalName", "diagnosis", "hiddenBehaviorScore"
  ]);
  return Object.fromEntries(Object.entries(record).filter(([key]) => !forbidden.has(key)));
}

export function handleVersion(envelope, supportedMajor = 1) {
  const match = /^(\d+)\.\d+\.\d+$/.exec(envelope.version ?? "");
  if (!match || Number(match[1]) !== supportedMajor) {
    return { accepted: false, quarantineRequired: true, reason: "unsupported_version" };
  }
  return { accepted: true, quarantineRequired: false };
}

export async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex").toUpperCase();
}

export async function runProbe() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const traces = JSON.parse(await readFile(tracesPath, "utf8"));
  const mappings = JSON.parse(await readFile(mappingsPath, "utf8"));
  const result = {
    validManifest: manifest.manifestVersion === "1.1.0",
    allChecksumsPass: manifest.integrity.allChecksumsPass === true,
    traceCount: traces.traces.length,
    fieldMappingCount: mappings.fieldMappings.length,
    eventMappingCount: mappings.eventMappings.length,
    blockerCount: manifest.classifications.filter((x) => x.classification === "BLOCKER").length,
    files: {
      manifestBytes: (await stat(manifestPath)).size,
      tracesBytes: (await stat(tracesPath)).size
    }
  };
  if (!result.validManifest || !result.allChecksumsPass || result.traceCount !== 15
    || result.fieldMappingCount < 15 || result.eventMappingCount < 10 || result.blockerCount < 1) {
    process.exitCode = 1;
  }
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await runProbe(), null, 2));
}
