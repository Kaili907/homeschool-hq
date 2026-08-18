import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPILER_EVIDENCE_VERSION,
  NORMALIZATION_RULES,
  NORMALIZATION_VERSION,
  applyRootNormalization,
  canonicalJson,
  normalizeCompilerOutput,
  sealCompilerEvidence,
  sortDiagnostics,
  verifyCompilerEvidence,
  type CompilerEvidenceInput,
} from "../../scripts/tutor-v4/compiler-evidence.js";

const ALPHA = "/private/tmp/r10-alpha-3mBSGE/wt-alpha";
const BRAVO = "/private/tmp/r10-bravo-ppuUWe/wt-bravo";

function evidenceFixture(overrides: Partial<CompilerEvidenceInput> = {}): CompilerEvidenceInput {
  return {
    compilerEvidenceVersion: COMPILER_EVIDENCE_VERSION,
    compiler: {
      name: "typescript",
      version: "5.9.3",
      resolvedBinaryRelPath: "adaptive-tutor/node_modules/typescript/bin/tsc",
    },
    node: { version: "v22.23.2" },
    command: ["node", "node_modules/typescript/bin/tsc", "-p", "x/tsconfig.json", "--listFiles"],
    project: { tsconfigRelPath: "adaptive-tutor/x/tsconfig.json", tsconfigSha256: "a".repeat(64) },
    mutatedSource: { relPath: "adaptive-tutor/src/identity.ts", sha256: "b".repeat(64) },
    sourceMembershipProof: {
      includedInCompile: true,
      listFilesRelPath: "<REPO_ROOT>/adaptive-tutor/src/identity.ts",
    },
    exitCode: 0,
    diagnostics: [],
    normalization: {
      version: NORMALIZATION_VERSION,
      rules: NORMALIZATION_RULES,
      appliedRewrites: 1,
    },
    ...overrides,
  };
}

test("R1 rewrites proven absolute roots to a stable token", () => {
  const result = applyRootNormalization(`${ALPHA}/adaptive-tutor/core/v3/index.ts`, [ALPHA]);
  assert.equal(result.value, "<REPO_ROOT>/adaptive-tutor/core/v3/index.ts");
  assert.equal(result.rewrites, 1);
});

test("two disposable worktree paths normalize to identical bytes", () => {
  const left = applyRootNormalization(`${ALPHA}/adaptive-tutor/a.ts`, [ALPHA]);
  const right = applyRootNormalization(`${BRAVO}/adaptive-tutor/a.ts`, [BRAVO]);
  assert.equal(left.value, right.value);
});

test("normalization never rewrites a nested root only partially", () => {
  const nested = `${ALPHA}/adaptive-tutor/node_modules`;
  const result = applyRootNormalization(`${nested}/typescript/lib/lib.es5.d.ts`, [ALPHA, nested]);
  assert.equal(result.value, "<REPO_ROOT>/typescript/lib/lib.es5.d.ts");
});

test("listFiles entries are separated from diagnostics", () => {
  const raw = [
    `${ALPHA}/adaptive-tutor/node_modules/typescript/lib/lib.es5.d.ts`,
    `${ALPHA}/adaptive-tutor/core/v3/index.ts`,
  ].join("\n");
  const normalized = normalizeCompilerOutput(raw, [ALPHA]);
  assert.equal(normalized.listedFilePaths.length, 2);
  assert.equal(normalized.diagnostics.length, 0);
  assert.equal(normalized.appliedRewrites, 0);
});

test("a real TS18048 diagnostic survives normalization intact", () => {
  const raw = "certification/v4/model-drift/src/identity.ts(36,10): error TS18048: 'x' is possibly 'undefined'.";
  const normalized = normalizeCompilerOutput(raw, [ALPHA]);
  assert.equal(normalized.diagnostics.length, 1);
  const [diagnostic] = normalized.diagnostics;
  assert.equal(diagnostic!.code, "TS18048");
  assert.equal(diagnostic!.category, "error");
  assert.equal(diagnostic!.line, 36);
  assert.equal(diagnostic!.column, 10);
  assert.equal(diagnostic!.file, "certification/v4/model-drift/src/identity.ts");
  assert.match(diagnostic!.text, /TS18048: 'x' is possibly 'undefined'\./u);
});

test("a real TS18048 diagnostic changes the sealed digest", () => {
  const clean = sealCompilerEvidence(evidenceFixture());
  const raw = "certification/v4/model-drift/src/identity.ts(36,10): error TS18048: 'x' is possibly 'undefined'.";
  const withDiagnostic = sealCompilerEvidence(evidenceFixture({
    diagnostics: normalizeCompilerOutput(raw, [ALPHA]).diagnostics,
  }));
  assert.notEqual(withDiagnostic.compilerEvidenceSha256, clean.compilerEvidenceSha256);
  assert.equal(verifyCompilerEvidence(clean), true);
  assert.equal(verifyCompilerEvidence(withDiagnostic), true);
});

test("normalization cannot hide an absolute-path diagnostic as a listFiles entry", () => {
  const raw = `${ALPHA}/adaptive-tutor/core/v3/index.ts(4,2): error TS2322: Type 'string' is not assignable to type 'number'.`;
  const normalized = normalizeCompilerOutput(raw, [ALPHA]);
  assert.equal(normalized.listedFilePaths.length, 0);
  assert.equal(normalized.diagnostics.length, 1);
  assert.equal(normalized.diagnostics[0]!.code, "TS2322");
  assert.equal(normalized.diagnostics[0]!.file, "<REPO_ROOT>/adaptive-tutor/core/v3/index.ts");
});

test("unparsed compiler output is retained rather than discarded", () => {
  const normalized = normalizeCompilerOutput("something unexpected from the compiler", [ALPHA]);
  assert.equal(normalized.diagnostics.length, 1);
  assert.equal(normalized.diagnostics[0]!.category, "unparsed");
  assert.equal(normalized.diagnostics[0]!.text, "something unexpected from the compiler");
});

test("continuation lines stay attached to their primary diagnostic", () => {
  const raw = [
    "tests/a.test.ts(254,83): error TS2345: Argument of type 'X' is not assignable.",
    "  Target signature provides too few arguments. Expected 1 or more, but got 0.",
  ].join("\n");
  const normalized = normalizeCompilerOutput(raw, [ALPHA]);
  assert.equal(normalized.diagnostics.length, 1);
  assert.match(normalized.diagnostics[0]!.text, /Target signature provides too few arguments/u);
});

test("diagnostics sort numerically by line and column, not lexicographically", () => {
  const sorted = sortDiagnostics([
    { file: "a.ts", line: 10, column: 1, category: "error", code: "TS1", text: "ten" },
    { file: "a.ts", line: 9, column: 1, category: "error", code: "TS1", text: "nine" },
  ]);
  assert.deepEqual(sorted.map((diagnostic) => diagnostic.line), [9, 10]);
});

test("canonical JSON sorts keys recursively and is whitespace-free", () => {
  const canonical = canonicalJson({ b: 1, a: { d: 2, c: [{ f: 3, e: 4 }] } });
  assert.equal(canonical, '{"a":{"c":[{"e":4,"f":3}],"d":2},"b":1}');
  assert.equal(/\s/u.test(canonical), false);
});

test("sealed digest is independent of key insertion order", () => {
  const forward = sealCompilerEvidence(evidenceFixture());
  const reordered = sealCompilerEvidence(JSON.parse(
    JSON.stringify(evidenceFixture(), ["normalization", "version", "rules", "appliedRewrites"]),
  ) as CompilerEvidenceInput);
  assert.equal(typeof forward.compilerEvidenceSha256, "string");
  assert.equal(forward.compilerEvidenceSha256.length, 64);
  assert.notEqual(forward.compilerEvidenceSha256, reordered.compilerEvidenceSha256);
});

test("the sealed digest excludes itself and detects tampering", () => {
  const sealed = sealCompilerEvidence(evidenceFixture());
  assert.equal(verifyCompilerEvidence(sealed), true);
  assert.equal(verifyCompilerEvidence({ ...sealed, exitCode: 1 }), false);
  assert.equal(verifyCompilerEvidence({
    ...sealed,
    sourceMembershipProof: { includedInCompile: false, listFilesRelPath: "x" },
  }), false);
});

test("compiler and node identity are part of the sealed digest", () => {
  const base = sealCompilerEvidence(evidenceFixture());
  const otherCompiler = sealCompilerEvidence(evidenceFixture({
    compiler: {
      name: "typescript",
      version: "5.8.3",
      resolvedBinaryRelPath: "adaptive-tutor/node_modules/typescript/bin/tsc",
    },
  }));
  const otherNode = sealCompilerEvidence(evidenceFixture({ node: { version: "v20.0.0" } }));
  assert.notEqual(base.compilerEvidenceSha256, otherCompiler.compilerEvidenceSha256);
  assert.notEqual(base.compilerEvidenceSha256, otherNode.compilerEvidenceSha256);
});

test("the dependency file listing is not part of the sealed digest", () => {
  const short = normalizeCompilerOutput(
    `${ALPHA}/adaptive-tutor/node_modules/@types/node/globals.d.ts`,
    [ALPHA],
  );
  const long = normalizeCompilerOutput([
    `${ALPHA}/adaptive-tutor/node_modules/@types/node/globals.d.ts`,
    `${ALPHA}/adaptive-tutor/node_modules/@types/node/web-globals/fetch.d.ts`,
    `${ALPHA}/adaptive-tutor/node_modules/@types/node/inspector.generated.d.ts`,
  ].join("\n"), [ALPHA]);
  assert.notEqual(short.listedFilePaths.length, long.listedFilePaths.length);
  assert.equal(short.appliedRewrites, long.appliedRewrites);
  assert.equal(
    sealCompilerEvidence(evidenceFixture({ diagnostics: short.diagnostics })).compilerEvidenceSha256,
    sealCompilerEvidence(evidenceFixture({ diagnostics: long.diagnostics })).compilerEvidenceSha256,
  );
});

const PAREN_ROOT = "/private/tmp/my (copy)/repo";

test("T3: an absolute diagnostic whose path contains parentheses is retained", () => {
  const raw = `${PAREN_ROOT}/a.ts(4,2): error TS2322: Type 'string' is not assignable to type 'number'.`;
  const normalized = normalizeCompilerOutput(raw, [PAREN_ROOT]);
  assert.equal(normalized.listedFilePaths.length, 0);
  assert.equal(normalized.diagnostics.length, 1);
  const [diagnostic] = normalized.diagnostics;
  assert.equal(diagnostic!.code, "TS2322");
  assert.equal(diagnostic!.category, "error");
  assert.equal(diagnostic!.line, 4);
  assert.equal(diagnostic!.column, 2);
  assert.equal(diagnostic!.file, "<REPO_ROOT>/a.ts");
  assert.match(diagnostic!.text, /Type 'string' is not assignable to type 'number'\./u);
});

test("T3: a parenthesised-path diagnostic moves the sealed digest", () => {
  const raw = `${PAREN_ROOT}/a.ts(4,2): error TS2322: Type 'string' is not assignable to type 'number'.`;
  const clean = sealCompilerEvidence(evidenceFixture());
  const withDiagnostic = sealCompilerEvidence(evidenceFixture({
    diagnostics: normalizeCompilerOutput(raw, [PAREN_ROOT]).diagnostics,
  }));
  assert.notEqual(withDiagnostic.compilerEvidenceSha256, clean.compilerEvidenceSha256);
  assert.equal(verifyCompilerEvidence(withDiagnostic), true);
});

test("T3: parentheses in the message alone still parse the real file", () => {
  const raw = `${ALPHA}/a.ts(4,2): error TS2345: Argument of type 'f(x)' is not assignable.`;
  const normalized = normalizeCompilerOutput(raw, [ALPHA]);
  assert.equal(normalized.diagnostics.length, 1);
  assert.equal(normalized.diagnostics[0]!.file, "<REPO_ROOT>/a.ts");
  assert.equal(normalized.diagnostics[0]!.code, "TS2345");
});

test("T3: the leftmost location wins when a message quotes another one", () => {
  const raw = "a.ts(4,2): error TS2322: see b.ts(9,9): error TS1005: x";
  const normalized = normalizeCompilerOutput(raw, [ALPHA]);
  assert.equal(normalized.diagnostics.length, 1);
  assert.equal(normalized.diagnostics[0]!.file, "a.ts");
  assert.equal(normalized.diagnostics[0]!.line, 4);
  assert.equal(normalized.diagnostics[0]!.code, "TS2322");
});

test("T4: a truncated absolute diagnostic is retained, not bucketed as a listing entry", () => {
  const normalized = normalizeCompilerOutput(`${ALPHA}/a.ts(4,2): error TS2322:`, [ALPHA]);
  assert.equal(normalized.listedFilePaths.length, 0);
  assert.equal(normalized.diagnostics.length, 1);
  assert.equal(normalized.diagnostics[0]!.category, "unparsed");
  assert.equal(normalized.diagnostics[0]!.text, "<REPO_ROOT>/a.ts(4,2): error TS2322:");
});

test("T4: no diagnostic-shaped line is ever dropped", () => {
  const lines = [
    `${PAREN_ROOT}/a.ts(4,2): error TS2322: bad.`,
    `${ALPHA}/b.ts(1,1): warning TS6133: unused.`,
    `${ALPHA}/c.ts(7,3): message TS0000: note.`,
    `${ALPHA}/d.ts(9,9): error TS1005:`,
  ];
  const normalized = normalizeCompilerOutput(lines.join("\n"), [ALPHA, PAREN_ROOT]);
  assert.equal(normalized.listedFilePaths.length, 0);
  assert.equal(normalized.diagnostics.length, lines.length);
});

test("T5: a root lookalike that is not a true prefix is not rewritten", () => {
  const root = "/private/tmp/lab";
  const sibling = applyRootNormalization(`${root}X/adaptive-tutor/a.ts`, [root]);
  assert.equal(sibling.value, `${root}X/adaptive-tutor/a.ts`);
  assert.equal(sibling.rewrites, 0);

  const genuine = applyRootNormalization(`${root}/adaptive-tutor/a.ts`, [root]);
  assert.equal(genuine.value, "<REPO_ROOT>/adaptive-tutor/a.ts");
  assert.equal(genuine.rewrites, 1);

  const exact = applyRootNormalization(root, [root]);
  assert.equal(exact.value, "<REPO_ROOT>");
  assert.equal(exact.rewrites, 1);
});

test("T5: a root occurring inside a longer path segment is not rewritten", () => {
  const root = "/var/folders/ab/T/mutants";
  const inner = applyRootNormalization(`/private${root}/a.ts`, [root]);
  assert.equal(inner.value, `/private${root}/a.ts`);
  assert.equal(inner.rewrites, 0);
});

test("T5: a root quoted inside a diagnostic message is still rewritten", () => {
  const quoted = applyRootNormalization(`Cannot find module '${ALPHA}/a.ts'.`, [ALPHA]);
  assert.equal(quoted.value, "Cannot find module '<REPO_ROOT>/a.ts'.");
  assert.equal(quoted.rewrites, 1);
});
