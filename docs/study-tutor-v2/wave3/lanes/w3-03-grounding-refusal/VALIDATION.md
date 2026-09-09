# W3-03 validation

Run validation from `adaptive-tutor/`.

## Required checks

| Check | Command | Result |
| --- | --- | --- |
| Strict core typecheck | `tsc -p tsconfig.json --noEmit` | PASS |
| Compiled focused suite | `node --test .test-dist/core/v3/grounding/grounding.test.js` after `tsc -p tsconfig.test.json` | PASS — 32/32 |
| Existing adaptive-tutor core suite | `node --test .test-dist/tests/*.test.js` | PASS — 21/21 |
| Tutor-v2 convergence suite | `node --test scripts/tutor-v2/.dist/tests/tutor-v2-convergence/*.test.js` | PASS — 288/288 |

The worktree did not contain local dependency binaries, so the commands used
the repository's existing sibling installation of TypeScript 5.8.3 and Node
22.23.2. No dependency, lockfile, generated artifact, provider, or live-model
change was made.

## Coverage

The focused suite covers exact reviewed resolution, absent claims, unknown and
unexpected references, scope mismatches, stale and invalid context, digest
mismatch, missing Study review, duplicate ambiguity, closed confidence,
provider self-attestation, active-assessment anti-answer precedence, reviewed
static fallback selection, fallback rejection, malformed/open/hostile inputs,
input immutability, deterministic replay, and zero-material-claim proposals.

The same evaluator is exercised against math-, language-, science-, and
humanities-shaped opaque fixtures. These differ only in their opaque
references; no subject name or subject-specific rule exists in production
code.
