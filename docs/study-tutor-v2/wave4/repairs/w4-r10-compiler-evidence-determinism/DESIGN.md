# W4-R10 — Deterministic Compiler Evidence (Design)

Companion to `AUDIT.md`, which proves the defect. This document specifies the replacement.

## Problem restated

`compileOutputSha256` hashed the whole `tsc --listFiles` listing. Across the eight mutation
compile projects, 50.6%–96.0% of the listed files were dependency file paths (`typescript/lib`,
`@types/node`, `undici-types`) — 52.7%–95.9% of the hashed bytes. The digest therefore
tracked the installed dependency closure — which is unpinned — instead of the mutation. It
proved almost nothing about the mutation while guaranteeing eventual irreproducibility.

## Replacement record

`compileOutputSha256` is removed from the live framework and replaced by `compilerEvidence`
(`adaptive-tutor/scripts/tutor-v4/compiler-evidence.ts`):

| Field | Meaning |
| --- | --- |
| `compilerEvidenceVersion` | Record format version (currently 1) |
| `compiler` | `{ name, version, resolvedBinaryRelPath }` — toolchain identity as **data** |
| `node` | `{ version }` |
| `command` | Exact argv, repo-relative |
| `project` | `{ tsconfigRelPath, tsconfigSha256 }`; `null` for `node --check` mutations |
| `mutatedSource` | `{ relPath, sha256 }` — digest of the source **after** rewrite |
| `sourceMembershipProof` | `{ includedInCompile, listFilesRelPath }` |
| `exitCode` | Compiler exit code |
| `diagnostics` | Normalized, repo-relative, stably sorted |
| `normalization` | `{ version, rules, appliedRewrites }` |
| `compilerEvidenceSha256` | sha256 over canonical JSON of all of the above, excluding itself |

### Why this still proves what the old digest claimed
The claim that matters is *the mutated source compiled and was a member of the compile*. That
is now carried explicitly by `mutatedSource.sha256` (what was compiled),
`sourceMembershipProof.includedInCompile` + `listFilesRelPath` (that it was in the compile),
`project.tsconfigSha256` (which compile), `command` (how), and `exitCode` (result). The full
dependency listing is still read to compute membership — it is simply not hashed.

Toolchain drift is now *recorded and legible* (`compiler.version`, `node.version`) rather than
silently baked into an opaque digest. A genuine compiler change is visible; dependency-layout
churn in `@types/node` is correctly invisible.

## Normalization (version 1)

One default rule only:

- **R1** — proven disposable-worktree / repo-root absolute prefix → `<REPO_ROOT>`

Roots are the disposable mutant root and the host repo root, each with its `realpath`, applied
longest-first so a nested root cannot be partially rewritten. `appliedRewrites` counts only
rewrites within **retained** content (diagnostics plus the membership path), never over the
discarded listing — otherwise the count would itself vary with dependency-set size and
reintroduce the defect.

Normalization cannot hide meaningful diagnostics:

- A line is treated as a listing entry only if it is an absolute path that does **not** parse
  as a diagnostic. Diagnostics that carry absolute paths are still classified as diagnostics.
- Anything unrecognised is retained as an `unparsed` diagnostic rather than dropped.
- Indented continuation lines stay attached to their primary diagnostic.
- No rule removes or rewrites diagnostic codes, messages, categories, or file identities.

## Canonical form

`canonicalJson` emits recursively key-sorted JSON with no indentation — hence UTF-8, LF-safe,
no trailing whitespace by construction.

**Array sort key** — `diagnostics` are sorted by: `file`, then `line`, then `column`, then
`code`, then `category`, then `text`. `line`/`column` compare numerically, so 9 precedes 10.
All other arrays (`command`, `rules`) are ordered by construction and are not re-sorted.

## Evidence and framework versions

`evidenceVersion` and `frameworkVersion` for the mutation campaign move 3 → **4**;
`mutationKind` stays `implementation` and `booleanEvidenceFlipOnly` stays `false`. The
`evidenceExecutionSha` subject-binding model is unchanged.

`HARD-GATE-RESULT.json` keeps `frameworkVersion: 3` deliberately: R10 did not change the
hard-gate evidence format, and bumping it would falsely signal a format change.

## Release verification

`generate-release.ts` now additionally fails when:

1. any mutation lacks `compilerEvidence`, or its `compilerEvidenceSha256` does not re-verify,
   or `exitCode !== 0`, or `sourceMembershipProof.includedInCompile` is false, or compiler/node
   identity is missing; or
2. any consumed evidence file still contains a raw `"compileOutputSha256"`.

All three failure modes were exercised against a passing tree and each threw as intended.

## Disposition of the R9 campaign evidence

`docs/study-tutor-v2/wave4/repairs/w4-r9-mutation-evidence-binding/CAMPAIGN-EVIDENCE.json` is
**relabelled**, not rewritten, mirroring how R6 was handled:

- `artifactStatus: "HISTORICAL_R9_FRAMEWORK_RUN"`
- `evidenceExecutionSha` → `historicalExecutionSubjectSha` (subject `875f53ce…` preserved)
- `supersededBy` → the R10 campaign evidence
- `compileOutputSha256` → `historicalCompileOutputSha256`, values preserved verbatim, with
  `historicalCompileOutputNote` recording why they are not reproducible

Rewriting it in place would have been false: R9 did not produce v4 evidence, and its digests
cannot be regenerated. Relabelling keeps the history truthful while ensuring no *live* raw
digest survives anywhere in the tree.

## Out of scope / unchanged

Mutation definitions, detectors, gates, thresholds, and M04/M06/M07 semantics are untouched.
No root dependency manifest or lockfile was added or changed. No file under `src/**`,
`netlify/**`, or `supabase/**` was modified.
