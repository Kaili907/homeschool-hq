/**
 * Which paths an evidence-only commit may contain, and which evidence inputs
 * the release check requires.
 *
 * W4-R11: these two lists live in one module because the R10 blocker was a
 * disagreement between them. The release check demanded an evidence input at
 * `docs/study-tutor-v2/wave4/repairs/w4-r10-compiler-evidence-determinism/CAMPAIGN-EVIDENCE.json`
 * while its own allowlist named only the w4-r9 directory, so the check rejected
 * the path it demanded. `REQUIRED_EVIDENCE_INPUT_PATHS` is consumed by the
 * release check and asserted admissible by the wave4 gate tests, so the two
 * can no longer drift apart unnoticed.
 */

/** The generated release bundle: everything under it is evidence by construction. */
const ALLOWED_EVIDENCE_PREFIXES: readonly string[] = [
  "adaptive-tutor/tutor-v2-wave4-release/",
];

/**
 * Machine-generated campaign evidence for a wave4 repair round. The filename is
 * pinned, so prose living in the same directory (README.md, VALIDATION.md,
 * AUDIT.md, DESIGN.md) is not admissible in an evidence-only commit. Only the
 * round slug varies, so a new repair round needs no edit here.
 */
const ALLOWED_EVIDENCE_PATTERNS: readonly RegExp[] = [
  /^docs\/study-tutor-v2\/wave4\/repairs\/w4-r\d+-[a-z0-9-]+\/CAMPAIGN-EVIDENCE\.json$/u,
];

/** Evidence inputs the release check reads and verifies, repo-relative. */
export const REQUIRED_EVIDENCE_INPUT_PATHS: readonly string[] = [
  "adaptive-tutor/tutor-v2-wave4-release/NEGATIVE-CONTROL-EVIDENCE.json",
  "docs/study-tutor-v2/wave4/repairs/w4-r10-compiler-evidence-determinism/CAMPAIGN-EVIDENCE.json",
];

/** True when an evidence-only commit is permitted to contain this path. */
export function isEvidenceOnlyPath(path: string): boolean {
  return ALLOWED_EVIDENCE_PREFIXES.some((prefix) => path.startsWith(prefix))
    || ALLOWED_EVIDENCE_PATTERNS.some((pattern) => pattern.test(path));
}

/** Reject an empty diff, or any diff carrying a path that is not evidence. */
export function assertEvidenceOnlyDiff(changedPaths: readonly string[]): void {
  if (changedPaths.length === 0 || changedPaths.some((path) => !isEvidenceOnlyPath(path))) {
    throw new Error(`Parent-to-HEAD diff is not evidence-only: ${changedPaths.join(", ")}`);
  }
}
