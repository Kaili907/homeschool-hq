# W3-B3 Validation

## Baseline custody

- Candidate: `dfc512283ad1e7194558bdddb5debb2c0f8c7589` (repaired B1).
- Failed W3-13 ancestor: `4ea58cfb4346c579fd6a18898dd48d491e5cd8fd`.
- B2 sibling, intentionally not imported: `add32beacaabe7b2d81ad48095fd2f4c3508a763`.
- The pre-campaign strict Tutor V3 compile, 30-test Wave 3 suite, and 18-family
  hard gate passed.
- Focused foreign-digest, top-level subject mismatch, per-attempt overrun, and
  trusted-clock deadline probes passed before mutation execution.

## Mutation campaign

- Evidence version: 2.
- Mutation kind: executable implementation/runtime behavior.
- Boolean-evidence-only: false.
- Qualifying mutants: 18.
- Compile-valid mutants: 18.
- Permanent focused detectors executed: 18.
- Killed: 18.
- Survived: 0.
- Invalid mutants: 0.
- Baseline blocked: 0.
- Exact killed ratio: 18/18.
- Aggregate status: PASS.

Every result records the candidate and runner revisions, source paths, before
Git blobs, after SHA-256 hashes, exact unified diff, commands and exit statuses,
expected and actual detector failures, normalized log hashes and paths,
classification, and cleanup proof.

## Post-campaign regressions

- Wave 3 convergence: 30/30 PASS.
- Wave 3 hard gates: 18/18 PASS.
- B1 operation-integrity families: 90/90 PASS.
- Wave 2 convergence: 288/288 PASS.
- Wave 1 hard boundaries: 253/253 PASS.
- Strict Tutor V3, Tutor V2, adaptive-root, and repository-root typechecks: PASS.
- `git diff --check`: PASS.

All disposable mutation worktrees were removed and pruned. Product source,
permanent tests, `src/**`, `netlify/**`, and `supabase/**` remain unchanged.
