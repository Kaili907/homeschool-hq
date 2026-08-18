import { createHash } from "node:crypto";

/**
 * Deterministic, semantically meaningful compiler evidence for the Wave 4
 * implementation-mutation campaign.
 *
 * W4-R10 replaces the raw `compileOutputSha256`, which hashed the entire
 * `tsc --listFiles` listing. That listing was 93-96% dependency file paths
 * (typescript/lib, @types/node, undici-types), so the digest tracked the
 * installed dependency closure rather than the mutation. See
 * docs/study-tutor-v2/wave4/repairs/w4-r10-compiler-evidence-determinism/AUDIT.md
 *
 * This record proves the mutated source compiled and was a member of the
 * compile, and hashes only content that is meaningful to that claim.
 */

export const COMPILER_EVIDENCE_VERSION = 1;
export const NORMALIZATION_VERSION = 1;

/**
 * The single default rewrite. It is the only rule permitted by the R10 audit:
 * a proven disposable-worktree / repo-root absolute prefix becomes a stable
 * token. No rule removes or rewrites diagnostic codes, messages, or file
 * identities.
 */
export const REPO_ROOT_TOKEN = "<REPO_ROOT>";
export const NORMALIZATION_RULES: readonly string[] = [
  "R1: proven disposable-worktree/repo-root absolute prefix -> <REPO_ROOT>",
];

/**
 * A tsc diagnostic line. Continuation lines (indented) belong to the preceding
 * primary line and are never separated from it.
 */
const PRIMARY_DIAGNOSTIC = /^(?<file>[^()]*?)\((?<line>\d+),(?<column>\d+)\): (?<category>error|warning|message) (?<code>TS\d+): (?<message>.*)$/u;
const GLOBAL_DIAGNOSTIC = /^(?<category>error|warning|message) (?<code>TS\d+): (?<message>.*)$/u;

export interface CompilerDiagnostic {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly category: string;
  readonly code: string;
  readonly text: string;
}

export interface NormalizedCompilerOutput {
  readonly listedFilePaths: readonly string[];
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly appliedRewrites: number;
}

/**
 * Apply R1 to a single string. Longest roots first so that a nested root
 * (for example <repo>/adaptive-tutor/node_modules) cannot be partially
 * rewritten by a shorter ancestor.
 */
export function applyRootNormalization(
  value: string,
  roots: readonly string[],
): { readonly value: string; readonly rewrites: number } {
  const ordered = [...new Set(roots.filter((root) => root.length > 0))]
    .sort((left, right) => right.length - left.length);
  let output = value;
  let rewrites = 0;
  for (const root of ordered) {
    let index = output.indexOf(root);
    while (index >= 0) {
      rewrites += 1;
      output = `${output.slice(0, index)}${REPO_ROOT_TOKEN}${output.slice(index + root.length)}`;
      index = output.indexOf(root, index + REPO_ROOT_TOKEN.length);
    }
  }
  return { value: output, rewrites };
}

/**
 * Split raw compiler output into the `--listFiles` listing and the diagnostics.
 *
 * A line is only treated as a listing entry when it is an absolute path that
 * does not parse as a diagnostic. Anything else is retained as a diagnostic, so
 * normalization can never silently discard compiler output.
 */
export function normalizeCompilerOutput(
  rawOutput: string,
  roots: readonly string[],
): NormalizedCompilerOutput {
  const listedFilePaths: string[] = [];
  const diagnostics: CompilerDiagnostic[] = [];
  let appliedRewrites = 0;
  const pendingContinuations: string[][] = [];

  for (const line of rawOutput.split(/\r?\n/u)) {
    if (line.trim().length === 0) continue;
    const isContinuation = /^\s/u.test(line);
    const openContinuation = pendingContinuations[pendingContinuations.length - 1];
    if (isContinuation && openContinuation !== undefined) {
      openContinuation.push(line.trimEnd());
      continue;
    }
    const primary = PRIMARY_DIAGNOSTIC.exec(line);
    const global = primary === null ? GLOBAL_DIAGNOSTIC.exec(line) : null;
    if (primary === null && global === null && line.startsWith("/")) {
      listedFilePaths.push(line);
      continue;
    }
    const groups = primary?.groups ?? global?.groups;
    const rawFile = groups?.file ?? "";
    const normalizedFile = applyRootNormalization(rawFile, roots);
    const normalizedLine = applyRootNormalization(line.trimEnd(), roots);
    appliedRewrites += normalizedLine.rewrites;
    diagnostics.push({
      file: normalizedFile.value,
      line: Number(groups?.line ?? 0),
      column: Number(groups?.column ?? 0),
      category: groups?.category ?? "unparsed",
      code: groups?.code ?? "",
      text: normalizedLine.value,
    });
    pendingContinuations.push([]);
  }

  // Re-attach continuation lines to the diagnostic that owns them.
  const withContinuations = diagnostics.map((diagnostic, index) => {
    const extra = pendingContinuations[index] ?? [];
    if (extra.length === 0) return diagnostic;
    const joined = applyRootNormalization(extra.join("\n"), roots);
    appliedRewrites += joined.rewrites;
    return { ...diagnostic, text: `${diagnostic.text}\n${joined.value}` };
  });

  return {
    listedFilePaths,
    diagnostics: sortDiagnostics(withContinuations),
    appliedRewrites,
  };
}

/**
 * Stable array ordering. Sort key, in order:
 *   file, line, column, code, category, text
 * Numeric comparison on line/column so 9 precedes 10.
 */
export function sortDiagnostics(
  diagnostics: readonly CompilerDiagnostic[],
): readonly CompilerDiagnostic[] {
  return [...diagnostics].sort((left, right) =>
    left.file.localeCompare(right.file)
    || left.line - right.line
    || left.column - right.column
    || left.code.localeCompare(right.code)
    || left.category.localeCompare(right.category)
    || left.text.localeCompare(right.text));
}

/**
 * Canonical JSON: recursively key-sorted, array order preserved as produced by
 * the documented sort keys, UTF-8, no indentation and therefore no trailing
 * whitespace and no embedded CR.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalize(child)]));
}

export interface CompilerEvidence {
  readonly compilerEvidenceVersion: number;
  readonly compiler: {
    readonly name: string;
    readonly version: string;
    readonly resolvedBinaryRelPath: string;
  };
  readonly node: { readonly version: string };
  readonly command: readonly string[];
  readonly project: {
    readonly tsconfigRelPath: string;
    readonly tsconfigSha256: string;
  } | null;
  readonly mutatedSource: { readonly relPath: string; readonly sha256: string };
  readonly sourceMembershipProof: {
    readonly includedInCompile: boolean;
    readonly listFilesRelPath: string;
  };
  readonly exitCode: number;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly normalization: {
    readonly version: number;
    readonly rules: readonly string[];
    readonly appliedRewrites: number;
  };
  readonly compilerEvidenceSha256: string;
}

export type CompilerEvidenceInput = Omit<CompilerEvidence, "compilerEvidenceSha256">;

/** sha256 over the canonical JSON of every field except the digest itself. */
export function sealCompilerEvidence(input: CompilerEvidenceInput): CompilerEvidence {
  const compilerEvidenceSha256 = createHash("sha256")
    .update(canonicalJson(input), "utf8")
    .digest("hex");
  return { ...input, compilerEvidenceSha256 };
}

/** Recompute and compare; used by release verification and tests. */
export function verifyCompilerEvidence(evidence: CompilerEvidence): boolean {
  const { compilerEvidenceSha256, ...rest } = evidence;
  return createHash("sha256")
    .update(canonicalJson(rest), "utf8")
    .digest("hex") === compilerEvidenceSha256;
}
