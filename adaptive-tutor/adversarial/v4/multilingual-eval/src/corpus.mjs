import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const CORPUS_URL = new URL("../corpus/cases.v1.json", import.meta.url);
const MANIFEST_URL = new URL("../corpus/manifest.v1.json", import.meta.url);

export const ATTACK_FAMILIES = Object.freeze([
  "translation_answer_leak",
  "instruction_hierarchy_change",
  "meaning_reversal",
  "numeric_corruption",
  "unit_corruption",
  "refusal_weakening",
  "guardian_safety_meaning_drift",
  "grounding_support_mismatch",
  "code_switching_attack",
  "unicode_confusable",
]);

export const ACADEMIC_SHAPES = Object.freeze([
  "math",
  "language_arts",
  "science",
  "humanities_social_studies",
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertString(value, path) {
  assert(typeof value === "string" && value.length > 0, `${path} must be a non-empty string`);
}

function assertUniqueStrings(values, path, { allowEmpty = false } = {}) {
  assert(Array.isArray(values), `${path} must be an array`);
  assert(allowEmpty || values.length > 0, `${path} must not be empty`);
  values.forEach((value, index) => assertString(value, `${path}[${index}]`));
  assert(new Set(values).size === values.length, `${path} must not contain duplicates`);
}

function assertStrings(values, path, { allowEmpty = false } = {}) {
  assert(Array.isArray(values), `${path} must be an array`);
  assert(allowEmpty || values.length > 0, `${path} must not be empty`);
  values.forEach((value, index) => assertString(value, `${path}[${index}]`));
}

function codePoints(value) {
  return [...value].map((character) =>
    `U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`);
}

function validateCase(testCase, index) {
  const path = `cases[${index}]`;
  assertString(testCase.caseId, `${path}.caseId`);
  assertString(testCase.title, `${path}.title`);
  assert(testCase.synthetic === true, `${path}.synthetic must be true`);
  assert(testCase.deidentified === true, `${path}.deidentified must be true`);
  assert(ACADEMIC_SHAPES.includes(testCase.academicShape), `${path}.academicShape is invalid`);
  assert(testCase.sourceLocale === "en-US", `${path}.sourceLocale must be en-US`);
  assertString(testCase.evaluationLocale, `${path}.evaluationLocale`);
  assertString(testCase.languageFamily, `${path}.languageFamily`);
  assertUniqueStrings(testCase.writingSystems, `${path}.writingSystems`);
  assertUniqueStrings(testCase.attackFamilies, `${path}.attackFamilies`);
  testCase.attackFamilies.forEach((family) =>
    assert(ATTACK_FAMILIES.includes(family), `${path} has unknown attack family ${family}`));
  assert(testCase.curriculumSupportClaim === "none", `${path}.curriculumSupportClaim must be none`);
  assert(testCase.evaluationUseOnly === true, `${path}.evaluationUseOnly must be true`);

  const input = testCase.input;
  assert(input && typeof input === "object", `${path}.input must be an object`);
  assertUniqueStrings(input.trustedInstructions.map((instruction) => instruction.id), `${path}.input.trustedInstructions ids`);
  input.trustedInstructions.forEach((instruction, instructionIndex) => {
    assert(["system", "developer", "guardian_policy"].includes(instruction.authority),
      `${path}.input.trustedInstructions[${instructionIndex}].authority is invalid`);
    assertString(instruction.text, `${path}.input.trustedInstructions[${instructionIndex}].text`);
  });
  assertUniqueStrings(input.grounding.map((fact) => fact.ref), `${path}.input.grounding refs`);
  input.grounding.forEach((fact, factIndex) =>
    assertString(fact.text, `${path}.input.grounding[${factIndex}].text`));
  assertString(input.sourceText, `${path}.input.sourceText`);
  assertString(input.adversarialText, `${path}.input.adversarialText`);
  assertString(input.untrustedInstructionId, `${path}.input.untrustedInstructionId`);

  assert(Array.isArray(testCase.unicodeSignals), `${path}.unicodeSignals must be an array`);
  testCase.unicodeSignals.forEach((signal, signalIndex) => {
    assertString(signal.value, `${path}.unicodeSignals[${signalIndex}].value`);
    assertStrings(signal.codePoints, `${path}.unicodeSignals[${signalIndex}].codePoints`);
    assertString(signal.role, `${path}.unicodeSignals[${signalIndex}].role`);
    assert(JSON.stringify(codePoints(signal.value)) === JSON.stringify(signal.codePoints),
      `${path}.unicodeSignals[${signalIndex}] code points do not match value`);
    assert(input.adversarialText.includes(signal.value),
      `${path}.unicodeSignals[${signalIndex}] is absent from adversarialText`);
  });

  const reference = testCase.reference;
  assert(reference && typeof reference === "object", `${path}.reference must be an object`);
  assertUniqueStrings(reference.semanticAtoms, `${path}.reference.semanticAtoms`);
  assertUniqueStrings(reference.groundingRefs, `${path}.reference.groundingRefs`);
  const availableGrounding = new Set(input.grounding.map((fact) => fact.ref));
  reference.groundingRefs.forEach((ref) =>
    assert(availableGrounding.has(ref), `${path} references unavailable grounding ${ref}`));
  assert(Array.isArray(reference.quantities), `${path}.reference.quantities must be an array`);
  assert(new Set(reference.quantities.map((quantity) => quantity.key)).size === reference.quantities.length,
    `${path}.reference.quantities keys must be unique`);
  reference.quantities.forEach((quantity, quantityIndex) => {
    assertString(quantity.key, `${path}.reference.quantities[${quantityIndex}].key`);
    assertString(quantity.value, `${path}.reference.quantities[${quantityIndex}].value`);
    assertString(quantity.unit, `${path}.reference.quantities[${quantityIndex}].unit`);
  });

  assert(["withhold", "refuse", "respond_without_answer"].includes(reference.answerBoundary.mode),
    `${path}.reference.answerBoundary.mode is invalid`);
  assertUniqueStrings(reference.answerBoundary.forbiddenTokens,
    `${path}.reference.answerBoundary.forbiddenTokens`);
  assertUniqueStrings(reference.authority.honor, `${path}.reference.authority.honor`);
  assertUniqueStrings(reference.authority.ignore, `${path}.reference.authority.ignore`);
  const trustedIds = new Set(input.trustedInstructions.map((instruction) => instruction.id));
  reference.authority.honor.forEach((id) =>
    assert(trustedIds.has(id), `${path} honors unknown trusted instruction ${id}`));
  assert(reference.authority.ignore.includes(input.untrustedInstructionId),
    `${path} must ignore its untrusted instruction`);
  assert(reference.authority.ignore.every((id) => !trustedIds.has(id)),
    `${path} cannot ignore a trusted instruction`);

  assert(typeof reference.safety.mustRefuse === "boolean", `${path}.reference.safety.mustRefuse must be boolean`);
  assertUniqueStrings(reference.safety.reasons, `${path}.reference.safety.reasons`, { allowEmpty: true });
  assertUniqueStrings(reference.safety.actions, `${path}.reference.safety.actions`, { allowEmpty: true });
  assertUniqueStrings(reference.safety.forbiddenActions,
    `${path}.reference.safety.forbiddenActions`, { allowEmpty: true });
  if (reference.safety.mustRefuse) {
    assert(reference.answerBoundary.mode === "refuse", `${path} safety refusal must use answer mode refuse`);
    assert(reference.safety.reasons.length > 0, `${path} safety refusal requires a reason`);
    assert(reference.safety.actions.length > 0, `${path} safety refusal requires an action`);
  }
}

export function validateCorpus(corpus) {
  assert(corpus?.schemaVersion === "manuel-multilingual-certification-corpus/v1",
    "schemaVersion must be manuel-multilingual-certification-corpus/v1");
  assertString(corpus.corpusId, "corpusId");
  assertString(corpus.revision, "revision");
  assert(corpus.dataClassification === "synthetic_deidentified",
    "dataClassification must be synthetic_deidentified");
  assert(corpus.execution?.liveModelCalls === false, "liveModelCalls must be false");
  assert(corpus.execution?.networkAccess === false, "networkAccess must be false");
  assert(corpus.curriculum?.supportAssertion === "none", "curriculum supportAssertion must be none");
  assert(corpus.curriculum?.evaluationOnly === true, "curriculum evaluationOnly must be true");
  assertString(corpus.curriculum?.evidence?.path, "curriculum.evidence.path");
  assertString(corpus.curriculum?.evidence?.statement, "curriculum.evidence.statement");
  assert(Array.isArray(corpus.cases) && corpus.cases.length > 0, "cases must not be empty");
  corpus.cases.forEach(validateCase);
  assert(new Set(corpus.cases.map((testCase) => testCase.caseId)).size === corpus.cases.length,
    "case IDs must be unique");

  const coveredAttacks = new Set(corpus.cases.flatMap((testCase) => testCase.attackFamilies));
  ATTACK_FAMILIES.forEach((family) => assert(coveredAttacks.has(family), `missing attack coverage: ${family}`));
  const coveredShapes = new Set(corpus.cases.map((testCase) => testCase.academicShape));
  ACADEMIC_SHAPES.forEach((shape) => assert(coveredShapes.has(shape), `missing academic shape: ${shape}`));
  assert(new Set(corpus.cases.map((testCase) => testCase.evaluationLocale)).size >= 10,
    "corpus must include at least 10 evaluation locales");
  assert(new Set(corpus.cases.map((testCase) => testCase.languageFamily)).size >= 8,
    "corpus must include at least 8 language families");
  assert(new Set(corpus.cases.flatMap((testCase) => testCase.writingSystems)).size >= 8,
    "corpus must include at least 8 writing systems");
  return corpus;
}

export async function loadCorpus() {
  const [serialized, serializedManifest] = await Promise.all([
    readFile(CORPUS_URL, "utf8"),
    readFile(MANIFEST_URL, "utf8"),
  ]);
  const corpus = validateCorpus(JSON.parse(serialized));
  const manifest = JSON.parse(serializedManifest);
  assert(manifest.schemaVersion === "manuel-multilingual-corpus-manifest/v1",
    "manifest schemaVersion is invalid");
  assert(manifest.corpusFile === "cases.v1.json", "manifest corpusFile is invalid");
  assert(manifest.corpusId === corpus.corpusId, "manifest corpusId does not match corpus");
  assert(manifest.corpusRevision === corpus.revision, "manifest revision does not match corpus");
  assert(manifest.caseCount === corpus.cases.length, "manifest caseCount does not match corpus");
  const digest = createHash("sha256").update(serialized, "utf8").digest("hex");
  assert(manifest.sha256 === digest, "manifest sha256 does not match cases.v1.json");
  return { ...corpus, contentDigest: `sha256:${digest}` };
}
